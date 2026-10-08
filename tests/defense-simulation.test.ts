import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, isRouteTile, type Enemy } from '../src/game/defense-simulation.ts';
import { DEPLOY_SLOTS, WAVE_ONE } from '../src/game/wave-one.ts';
import { isWalkable } from '../src/game/room/walkable.ts';

const advance = (game: DefenseSimulation, seconds: number) => { for (let i = 0; i < seconds * 20 && ['ready', 'running'].includes(game.status); i++) game.step(0.05); };
const enemy = (id: number, x: number, y = ROUTE[0].y): Enemy => ({ id, x, y, waypoint: 1, health: 1000, burnTime: 0, burnDamage: 0, slowTime: 0, attackCooldown: 0, chaseTarget: null });

test('room boundaries and flipped wall tiles cannot be walked on; every deploy slot is valid', () => {
  assert.equal(isWalkable(7, 6), true);
  for (const [x, y] of [[-1, 6], [16, 6], [7, 15], [0, 6], [15, 6], [7, 0], [2.5, 6]]) assert.equal(isWalkable(x, y), false);
  for (const slot of DEPLOY_SLOTS) {
    assert.equal(isWalkable(slot.x, slot.y), true);
    assert.equal(isRouteTile(slot.x, slot.y), false);
  }
});

test('invalid placement, duplicates, insufficient energy and full board preserve energy and random rolls', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0; });
  for (const [x, y] of [[0, 6], [1, 4], [12, 5], [3, 6]]) game.placeRobot(x, y);
  assert.equal(game.credits, 300); assert.equal(rolls, 0);
  game.placeRobot(3, 5); game.placeRobot(3, 5);
  assert.equal(game.robots.length, 1); assert.equal(game.credits, 225); assert.equal(rolls, 1);
  game.summon(); game.summon(); game.summon(); game.summon();
  assert.equal(game.robots.length, 4); assert.equal(game.credits, 0); assert.equal(rolls, 4);
  game.credits = 1000;
  for (let i = 0; i < 4; i++) game.summon();
  const balance = game.credits;
  game.summon(); assert.equal(game.credits, balance); assert.equal(rolls, 8);
});

test('random summons cover three robot types and select the new robot', () => {
  let count = 0;
  const game = new DefenseSimulation(() => [0, 0.4, 0.99][count++]);
  game.summon(); game.summon(); game.summon();
  assert.deepEqual(game.robots.map(d => d.kind), ['fire', 'ice', 'electric']);
  assert.equal(game.selectedId, game.robots[2].id);
});

test('merge requires matching kind and grade, preserves selected identity and cooldown, and caps at grade 3', () => {
  const game = new DefenseSimulation(() => 0);
  game.credits = 2000;
  game.summon(); game.summon();
  const selected = game.robots[1]; selected.cooldown = 0.65;
  const balance = game.credits;
  game.merge(); assert.equal(game.robots.length, 1); assert.equal(selected.grade, 2);
  assert.equal(game.selectedId, selected.id); assert.equal(selected.cooldown, 0.65); assert.equal(game.credits, balance);
  assert.ok(selected.damage > 19 * 2); assert.ok(selected.range > 3.2);
  game.summon(); game.selectRobot(selected.id); game.merge(); assert.equal(game.robots.length, 2);
  game.summon(); game.selectRobot(game.robots.at(-1)!.id); game.merge();
  assert.equal(game.robots.length, 2); assert.equal(game.robots[1].grade, 2);
  game.selectRobot(selected.id); game.merge(); assert.equal(selected.grade, 3); assert.equal(game.robots.length, 1);
  game.merge(); assert.equal(selected.grade, 3);
});

test('different kinds cannot merge', () => {
  let count = 0;
  const game = new DefenseSimulation(() => count++ ? 0.4 : 0);
  game.summon(); game.summon(); game.merge(); assert.equal(game.robots.length, 2);
});

test('wave starts without robots; pause freezes combat and rejects summon/merge; battle permits both', () => {
  const game = new DefenseSimulation(() => 0);
  assert.equal(game.startWave(), true); assert.equal(game.startWave(), false);
  game.summon();
  game.summon(); assert.equal(game.robots.length, 2);
  game.step(0.05); game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let i = 0; i < 100; i++) game.step(0.05);
  game.summon(); game.merge(); assert.equal(JSON.stringify(game), snapshot);
  game.togglePause(); game.merge(); assert.equal(game.robots.length, 1); assert.equal(game.status, 'running');
});

test('sequential code selects the nearest living in-range target, then attacks, then waits', () => {
  const game = new DefenseSimulation(() => 0);
  game.player = { x: 14, y: 11 };
  game.summon(); game.startWave();
  game.enemies = [enemy(100, 5), enemy(101, 3), enemy(102, 14)];
  game.step(0.05);
  assert.equal(game.robots[0].activeBlock, 'attack'); assert.equal(game.robots[0].targetId, 101);
  const shots = [];
  for (let i = 0; i < 4; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 1); assert.equal(game.robots[0].activeBlock, 'wait');
  assert.equal(game.enemies.find(e => e.id === 100)!.health, 1000);
  assert.ok(game.enemies.find(e => e.id === 101)!.health < 1000);
});

test('repeated code respects attack cooldown and reacquires dead targets', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; game.summon(); game.startWave(); game.enemies = [enemy(100, 3)];
  const times: number[] = [];
  for (let i = 0; i < 160; i++) if (game.step(0.05).length) times.push(game.elapsed);
  assert.ok(times.length > 4);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 0.9 - 1e-8);
  game.robots[0].activeBlock = 'attack'; game.robots[0].phaseTimer = 0; game.robots[0].targetId = -1;
  game.step(0.05); assert.equal(game.robots[0].activeBlock, 'find'); assert.equal(game.robots[0].targetId, null);
});

test('fire applies damage over time, ice slows, and electric chains to one nearby enemy', () => {
  for (const [roll, effect] of [[0, 'burnTime'], [0.4, 'slowTime']] as const) {
    const game = new DefenseSimulation(() => roll); game.player = { x: 14, y: 11 }; game.summon(); game.startWave(); game.enemies = [enemy(100, 3)];
    advance(game, 0.25); assert.ok(game.enemies[0][effect] > 0);
    if (effect === 'burnTime') { const health = game.enemies[0].health; advance(game, 0.2); assert.ok(game.enemies[0].health < health); }
  }
  const game = new DefenseSimulation(() => 0.99); game.player = { x: 14, y: 11 }; game.summon(); game.startWave(); game.enemies = [enemy(100, 3), enemy(101, 3.5)];
  const shots = [];
  for (let i = 0; i < 5; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 2); assert.equal(shots[1].chain, true); assert.ok(game.enemies[1].health < 1000);
});

test('a burning enemy killed before finishing the route awards energy without starting a chase', () => {
  const game = new DefenseSimulation(); game.summon(); game.startWave();
  const end = ROUTE[ROUTE.length - 1];
  game.enemies = [{ ...enemy(100, end.x + 0.001, end.y), waypoint: ROUTE.length - 1, health: 0.01, burnTime: 1, burnDamage: 10 }];
  const balance = game.credits;
  game.step(0.05); assert.equal(game.health, 100); assert.equal(game.escaped, 0); assert.equal(game.kills, 1); assert.equal(game.credits, balance + 15);
});

test('three starting robots can clear wave 1 with every single-kind starting draw', () => {
  for (const roll of [0, 0.4, 0.99]) {
    const game = new DefenseSimulation(() => roll); game.summon(); game.summon(); game.summon(); game.startWave();
    advance(game, 90);
    assert.equal(game.status, 'cleared'); assert.equal(game.kills, 12); assert.equal(game.health, 100); assert.equal(game.wave, 1);
    assert.equal(game.credits, 300 - 3 * 75 + 12 * 15 + 50);
    const snapshot = JSON.stringify(game);
    advance(game, 30); game.summon(); game.merge(); assert.equal(game.startWave(), false); assert.equal(JSON.stringify(game), snapshot);
  }
});

test('a surviving monster kills the player and defeat cannot restart or duplicate rewards', () => {
  const game = new DefenseSimulation(); game.startWave();
  game.spawned = WAVE_ONE.enemies;
  game.enemies = [{ ...enemy(100, game.player.x, game.player.y), waypoint: ROUTE.length }];
  advance(game, 8); assert.equal(game.status, 'defeat'); assert.equal(game.health, 0);
  assert.ok(game.enemies[0].health > 0);
  const balance = game.credits; advance(game, 90); assert.equal(game.credits, balance); assert.equal(game.startWave(), false);
});

test('route survivors stay alive, chase the player, and prevent premature wave completion', () => {
  const game = new DefenseSimulation(); game.startWave(); game.spawned = WAVE_ONE.enemies;
  const end = ROUTE.at(-1)!;
  const survivor = { ...enemy(100, end.x + 0.001, end.y), waypoint: ROUTE.length - 1 };
  game.enemies = [survivor];
  game.step(0.05);
  assert.equal(game.enemies.length, 1); assert.equal(game.escaped, 1);
  assert.equal(game.health, 100); assert.equal(game.status, 'running');
  const before = Math.hypot(survivor.x - game.player.x, survivor.y - game.player.y);
  advance(game, 1);
  assert.ok(Math.hypot(survivor.x - game.player.x, survivor.y - game.player.y) < before);
  assert.equal(game.escaped, 1); assert.equal(game.health, 100);
});

test('an actual unguarded wave pursues and defeats a player away from the route', () => {
  const game = new DefenseSimulation(); game.player = { x: 14, y: 8 };
  advance(game, 90);
  assert.equal(game.status, 'defeat'); assert.equal(game.health, 0);
  assert.ok(game.escaped > 0);
  assert.ok(game.enemies.some(e => e.waypoint >= ROUTE.length));
});

test('chasing monsters retarget a moving player, stay on the floor, and attack only within reach', () => {
  const game = new DefenseSimulation(); game.startWave(); game.spawned = WAVE_ONE.enemies;
  game.player = { x: 9, y: 7 };
  const survivor = { ...enemy(100, 3, 6), waypoint: ROUTE.length };
  game.enemies = [survivor]; advance(game, 1);
  assert.equal(game.health, 100);
  game.player = { x: 3, y: 3 };
  const before = Math.hypot(survivor.x - game.player.x, survivor.y - game.player.y);
  for (let i = 0; i < 40; i++) {
    game.step(0.05);
    assert.ok(isWalkable(Math.round(survivor.x), Math.round(survivor.y)));
  }
  assert.ok(Math.hypot(survivor.x - game.player.x, survivor.y - game.player.y) < before);
  assert.equal(game.health, 100);
  advance(game, 3); assert.ok(game.health < 100);
});

test('monster attacks respect cooldown and pause, and survivors can still be killed for a clear', () => {
  const game = new DefenseSimulation(); game.startWave(); game.spawned = WAVE_ONE.enemies;
  const survivor = { ...enemy(100, game.player.x, game.player.y), waypoint: ROUTE.length };
  game.enemies = [survivor]; game.step(0.05);
  assert.equal(game.health, 100 - WAVE_ONE.attackDamage);
  advance(game, 0.5); assert.equal(game.health, 100 - WAVE_ONE.attackDamage);
  game.togglePause(); const snapshot = JSON.stringify(game);
  for (let i = 0; i < 20; i++) game.step(0.05);
  assert.equal(JSON.stringify(game), snapshot);
  game.togglePause(); advance(game, 0.4);
  assert.equal(game.health, 100 - 2 * WAVE_ONE.attackDamage);
  survivor.health = 0.01; survivor.burnTime = 1; survivor.burnDamage = 10;
  const balance = game.credits; game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, 1);
  assert.equal(game.credits, balance + WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
  const fresh = new DefenseSimulation(); assert.equal(fresh.health, 100); assert.equal(fresh.enemies.length, 0);
});

test('new games do not share combat, selection or resource state', () => {
  const a = new DefenseSimulation(), b = new DefenseSimulation();
  a.summon(); a.startWave(); advance(a, 5);
  assert.equal(b.status, 'ready'); assert.equal(b.credits, 300); assert.equal(b.robots.length, 0); assert.equal(b.selectedId, null); assert.equal(b.elapsed, 0);
});

test('five second countdown starts wave once without summoning and creates mint wave enemies', () => {
 const game = new DefenseSimulation();
 advance(game, 4.9); assert.equal(game.status, 'ready'); assert.ok(game.countdown > 0); assert.equal(game.spawned, 0);
 advance(game, 0.15); assert.equal(game.status, 'running'); assert.equal(game.wave, 1); assert.equal(game.robots.length, 0);
 advance(game, 0.1); assert.equal(game.spawned, 1); assert.equal(game.startWave(), false);
});
test('connected route stays on walkable orthogonal tiles and rejects robot placement', () => {
 for (let i=1; i<ROUTE.length; i++) {
  const a=ROUTE[i-1], b=ROUTE[i]; assert.ok(a.x===b.x || a.y===b.y);
  for(let y=Math.min(a.y,b.y);y<=Math.max(a.y,b.y);y++) for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++) {assert.ok(isWalkable(x,y));assert.ok(isRouteTile(x,y));}
 }
});

test('two horizontal lanes connect through the right turn and leave the middle open for robots', () => {
 const horizontal = ROUTE.slice(1).filter((end, i) => end.y === ROUTE[i].y);
 assert.equal(horizontal.length, 2);
 assert.equal(isRouteTile(8, 4), true); assert.equal(isRouteTile(8, 6), true);
 for (let y = 4; y <= 6; y++) assert.equal(isRouteTile(12, y), true);
 for (const [x, y] of [[8, 3], [8, 7], [13, 5]]) assert.equal(isRouteTile(x, y), false);
 const game = new DefenseSimulation(() => 0);
 game.placeRobot(8, 5);
 assert.equal(game.robots.length, 1);
 assert.deepEqual([game.robots[0].x, game.robots[0].y], [8, 5]);
});
test('robots relocate freely off the road without spending energy and reject occupied or player tiles', () => {
 const game = new DefenseSimulation(() => 0); game.summon(); game.summon();
 const robot = game.robots[0], balance = game.credits;
 game.moveRobot(robot.id, 4, 7); assert.deepEqual([robot.x,robot.y],[4,7]); assert.equal(game.credits,balance);
 for(const p of [{x:0,y:0},{x:1,y:4},game.player,game.robots[1]]) {game.moveRobot(robot.id,p.x,p.y); assert.deepEqual([robot.x,robot.y],[4,7]);}
 game.startWave(); game.moveRobot(robot.id,6,7); assert.deepEqual([robot.x,robot.y],[6,7]);
});
test('the player attacks nearby enemies before any robot is summoned', () => {
 const game = new DefenseSimulation(); game.startWave();
 const shots=[]; for(let i=0;i<20;i++) shots.push(...game.step(.05));
 assert.equal(game.robots.length,0); assert.ok(shots.some(s=>s.player)); assert.ok(game.enemies[0].health<WAVE_ONE.health);
});
