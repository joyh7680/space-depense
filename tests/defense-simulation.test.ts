import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, isRouteTile, type Enemy } from '../src/game/defense-simulation.ts';
import { DEPLOY_SLOTS, ROBOT_CHARGE_COST, SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';
import type { RobotKind } from '../src/game/types.ts';
import { isWalkable } from '../src/game/room/walkable.ts';
import { getCodingMission } from '../src/game/coding-missions.ts';

const summon = (game: DefenseSimulation, kind: RobotKind = 'fire') => {
  game.elementEnergy[kind] += ROBOT_CHARGE_COST;
  const message = game.summon(kind);
  const robot = game.robots.at(-1)!;
  getCodingMission(kind, game.wave).slots.forEach((slot, index) => game.updateCode(robot.id, index, slot.block));
  game.runCode(robot.id);
  return message;
};

const advance = (game: DefenseSimulation, seconds: number) => { for (let i = 0; i < seconds * 20 && ['ready', 'running'].includes(game.status); i++) game.step(0.05); };
const enemy = (id: number, x: number, y = ROUTE[0].y): Enemy => ({ id, x, y, waypoint: 1, health: 1000, burnTime: 0, burnDamage: 0, slowTime: 0 });

test('room boundaries and flipped wall tiles cannot be walked on; every deploy slot is valid', () => {
  assert.equal(isWalkable(7, 6), true);
  for (const [x, y] of [[-1, 6], [16, 6], [7, 15], [0, 6], [15, 6], [7, 0], [2.5, 6]]) assert.equal(isWalkable(x, y), false);
  for (const slot of DEPLOY_SLOTS) {
    assert.equal(isWalkable(slot.x, slot.y), true);
    assert.equal(isRouteTile(slot.x, slot.y), false);
  }
});

test('robots need five matching energy; other elements and credits cannot substitute', () => {
  const game = new DefenseSimulation();
  assert.equal(ROBOT_CHARGE_COST, 5);
  assert.deepEqual(game.elementEnergy, { fire: 0, electric: 0, ice: 0 });
  game.elementEnergy.fire = 3; game.elementEnergy.electric = 5; game.credits = 9999;
  game.summon('fire'); assert.equal(game.robots.length, 0); assert.equal(game.elementEnergy.fire, 3);
  game.elementEnergy.fire++;
  game.summon('fire'); assert.equal(game.robots.length, 0); assert.equal(game.elementEnergy.fire, 4);
  game.elementEnergy.fire++;
  game.summon('fire');
  assert.equal(game.robots.length, 1); assert.equal(game.robots[0].kind, 'fire');
  assert.equal(game.selectedId, game.robots[0].id);
  assert.equal(game.elementEnergy.fire, 0); assert.equal(game.elementEnergy.electric, 5);
  assert.equal(game.credits, 9999);
  game.summon('fire'); assert.equal(game.robots.length, 1);
  game.summon('electric'); assert.equal(game.robots.length, 2); assert.equal(game.elementEnergy.electric, 0);
  game.elementEnergy.ice = 6; game.credits = 0; game.summon('ice');
  assert.equal(game.robots[2].kind, 'ice'); assert.equal(game.elementEnergy.ice, 1); assert.equal(game.credits, 0);
});

test('invalid placement, occupied slots and full board preserve matching energy', () => {
  const game = new DefenseSimulation(); game.elementEnergy.fire = 10 * ROBOT_CHARGE_COST;
  for (const [x, y] of [[0, 6], [1, 4], [12, 5], [3, 6], [game.player.x, game.player.y]]) game.placeRobot(x, y, 'fire');
  assert.equal(game.elementEnergy.fire, 10 * ROBOT_CHARGE_COST); assert.equal(game.robots.length, 0);
  game.placeRobot(3, 5, 'fire'); game.placeRobot(3, 5, 'fire');
  assert.equal(game.robots.length, 1); assert.equal(game.elementEnergy.fire, 9 * ROBOT_CHARGE_COST);
  for (let i = 0; i < 7; i++) game.summon('fire');
  assert.equal(game.robots.length, 8); assert.equal(game.elementEnergy.fire, 2 * ROBOT_CHARGE_COST);
  game.summon('fire'); assert.equal(game.elementEnergy.fire, ROBOT_CHARGE_COST); assert.equal(game.robots.length, 9);
  assert.equal(game.summon('fire'), '로봇은 최대 9대까지 소환할 수 있어요.');
  assert.equal(game.elementEnergy.fire, ROBOT_CHARGE_COST); assert.equal(game.robots.length, 9);
  assert.equal(new Set(game.deployedRobots.map(robot => `${robot.x},${robot.y}`)).size, 9);
});

test('each killed regular monster grants one random element; living or escaped monsters do not', () => {
  let count = 0;
  const game = new DefenseSimulation(() => [0, 0.4, 0.99][count++ % 3]);
  game.startWave(); game.player = { x: 14, y: 11 };
  game.enemies = [0, 1, 2].map(i => ({ ...enemy(100 + i, 3 + i), health: 0 }));
  game.step(.05);
  assert.equal(game.kills, 3); assert.equal(count, 3);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 1 });
  assert.equal(game.robotCount, 0);
  game.step(.05); assert.equal(count, 3);
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...enemy(200, end.x + .001, end.y), waypoint: ROUTE.length - 1 }];
  game.step(.05); assert.equal(game.escaped, 1); assert.equal(count, 3);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 1 });
});

test('merge requires matching kind and grade, preserves selected identity and cooldown, and caps at grade 3', () => {
  const game = new DefenseSimulation();
  summon(game); summon(game);
  const selected = game.robots[1]; selected.cooldown = .65;
  const energy = { ...game.elementEnergy };
  game.merge(); assert.equal(game.robots.length, 1); assert.equal(selected.grade, 2);
  assert.equal(game.selectedId, selected.id); assert.equal(selected.cooldown, .65); assert.deepEqual(game.elementEnergy, energy);
  assert.ok(selected.damage > 19 * 2); assert.ok(selected.range > 3.2);
  summon(game); game.selectRobot(selected.id); game.merge(); assert.equal(game.robots.length, 2);
  summon(game); game.selectRobot(game.robots.at(-1)!.id); game.merge();
  assert.equal(game.robots.length, 2); assert.equal(game.robots[1].grade, 2);
  game.selectRobot(selected.id); game.merge(); assert.equal(selected.grade, 3); assert.equal(game.robots.length, 1);
  game.merge(); assert.equal(selected.grade, 3);
});

test('different kinds cannot merge', () => {
  const game = new DefenseSimulation();
  summon(game, 'fire'); summon(game, 'ice'); game.merge(); assert.equal(game.robots.length, 2);
});

test('pause and finished states reject charged robots without spending energy; battle allows deployment', () => {
  const game = new DefenseSimulation();
  assert.equal(game.startWave(), true); assert.equal(game.startWave(), false);
  summon(game); summon(game); game.elementEnergy.fire = ROBOT_CHARGE_COST;
  game.step(.05); game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let i = 0; i < 100; i++) game.step(.05);
  game.summon('fire'); game.merge(); assert.equal(JSON.stringify(game), snapshot);
  game.togglePause(); game.summon('fire'); assert.equal(game.robots.length, 3); assert.equal(game.elementEnergy.fire, 0);
  for (const status of ['cleared', 'defeat'] as const) {
    game.status = status; game.elementEnergy.fire = ROBOT_CHARGE_COST;
    const ended = JSON.stringify(game);
    game.summon('fire'); game.merge(); assert.equal(JSON.stringify(game), ended);
  }
});

test('sequential code selects the nearest living in-range target, then attacks, then waits', () => {
  const game = new DefenseSimulation(() => 0);
  game.player = { x: 14, y: 11 };
  summon(game, 'ice'); game.startWave();
  game.enemies = [enemy(100, 5), enemy(101, 3), enemy(102, 14)];
  game.step(0.05);
  assert.equal(game.robots[0].activeBlock, 'attack'); assert.equal(game.robots[0].targetId, 101);
  const shots = [];
  for (let i = 0; i < 10; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 1); assert.equal(game.robots[0].activeBlock, 'wait');
  assert.equal(game.enemies.find(e => e.id === 100)!.health, 1000);
  assert.ok(game.enemies.find(e => e.id === 101)!.health < 1000);
});

test('repeated code respects attack cooldown and reacquires dead targets', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; summon(game, 'ice'); game.startWave(); game.enemies = [enemy(100, 3)];
  const times: number[] = [];
  for (let i = 0; i < 160; i++) {
    const before = game.robots[0].attacks;
    game.step(0.05);
    if (game.robots[0].attacks > before) times.push(game.elapsed);
  }
  assert.ok(times.length > 4);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 0.9 - 1e-8);
  game.robots[0].activeBlock = 'attack'; game.robots[0].phaseTimer = 0; game.robots[0].targetId = -1;
  game.step(0.05); assert.equal(game.robots[0].activeBlock, 'find'); assert.equal(game.robots[0].targetId, null);
});

test('fire applies damage over time, ice slows, and electric chains to one nearby enemy', () => {
  for (const [roll, effect] of [[0, 'burnTime'], [0.4, 'slowTime']] as const) {
    const game = new DefenseSimulation(() => roll); game.player = { x: 14, y: 11 }; summon(game, effect === 'burnTime' ? 'fire' : 'ice'); game.startWave(); game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
    advance(game, 0.25); assert.ok(game.enemies[0][effect] > 0);
    if (effect === 'burnTime') { const health = game.enemies[0].health; advance(game, 0.2); assert.ok(game.enemies[0].health < health); }
  }
  const game = new DefenseSimulation(() => 0.99); game.player = { x: 14, y: 11 }; summon(game, 'electric'); game.startWave(); game.enemies = [enemy(100, 3), enemy(101, 3.5)];
  const shots = [];
  for (let i = 0; i < 5; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 2); assert.equal(shots[1].chain, true); assert.ok(game.enemies[1].health < 1000);
});

test('a burning enemy killed before reaching the base awards energy without destroying the station', () => {
  const game = new DefenseSimulation(); summon(game); game.startWave();
  const end = ROUTE[ROUTE.length - 1];
  game.enemies = [{ ...enemy(100, end.x + 0.001, end.y), waypoint: ROUTE.length - 1, health: 0.01, burnTime: 1, burnDamage: 10 }];
  const balance = game.credits;
  game.step(0.05); assert.equal(game.health, 100); assert.equal(game.escaped, 0); assert.equal(game.kills, 1); assert.equal(game.credits, balance + 15);
});

test('clearing regular monsters waits for the automatic boss before awarding victory', () => {
  for (const kind of ['fire', 'ice', 'electric'] as const) {
    const game = new DefenseSimulation(); summon(game, kind); summon(game, kind); summon(game, kind); game.startWave();
    advance(game, 99.95);
    assert.equal(game.status, 'running'); assert.ok(game.kills > 12); assert.equal(game.spawned, WAVE_ONE.enemies); assert.equal(game.health, 100); assert.equal(game.wave, 1);
    assert.equal(game.credits, 300 + game.kills * WAVE_ONE.killEnergy);
    game.step(0.05);
    assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 1);
    for (const enemy of game.enemies) enemy.health = 0;
    game.step(0.05);
    assert.equal(game.status, 'cleared'); assert.equal(game.kills, game.spawned + 1);
    assert.equal(game.totalEnemies, game.kills);
    assert.equal(game.credits, 300 + game.kills * WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
    const snapshot = JSON.stringify(game);
    advance(game, 30); game.summon('fire'); game.merge(); assert.equal(JSON.stringify(game), snapshot);
  }
});

test('one survivor escapes through the base and destroys the station instead of clearing the wave', () => {
  const game = new DefenseSimulation(); game.startWave();
  const end = ROUTE.at(-1)!;
  const survivor = { ...enemy(100, end.x + 0.001, end.y), waypoint: ROUTE.length - 1 };
  game.enemies = [survivor];
  const balance = game.credits;
  game.step(0.05);
  assert.ok(game.enemies.every(enemy => enemy.id !== survivor.id)); assert.equal(game.escaped, 1);
  assert.equal(game.health, 0); assert.equal(game.status, 'defeat'); assert.equal(game.kills, 0);
  assert.equal(game.credits, balance);
  const snapshot = JSON.stringify(game);
  for (let i = 0; i < 40; i++) game.step(0.05);
  game.summon('fire'); game.merge(); assert.equal(game.startWave(), false);
  assert.equal(JSON.stringify(game), snapshot);
});

test('an actual unguarded wave ends on the first escape, regardless of player position', () => {
  const game = new DefenseSimulation(); game.player = { x: 14, y: 8 };
  advance(game, 90);
  assert.equal(game.status, 'defeat'); assert.equal(game.health, 0);
  assert.equal(game.escaped, 1);
  assert.ok(game.enemies.every(e => e.waypoint < ROUTE.length));
  const fresh = new DefenseSimulation(); assert.equal(fresh.health, 100); assert.equal(fresh.escaped, 0);
});

test('every road tile rejects player destinations, robot summons, and robot relocation', () => {
  const game = new DefenseSimulation(() => 0); summon(game);
  const robot = game.robots[0], original = { x: robot.x, y: robot.y }, balance = game.credits;
  for (let y = 3; y <= 7; y++) for (let x = 1; x <= 14; x++) {
    if (!isRouteTile(x, y)) continue;
    assert.equal(game.canMovePlayer(x, y), false);
    assert.equal(game.nextPlayerStep({ x, y }), null);
    game.placeRobot(x, y, 'fire'); game.moveRobot(robot.id, x, y);
    assert.deepEqual({ x: robot.x, y: robot.y }, original);
  }
  assert.equal(game.credits, balance); assert.equal(game.robots.length, 1);
});

test('player pathfinding takes a floor-only detour and respects robots placed in the way', () => {
  const game = new DefenseSimulation(() => 0);
  assert.equal(isRouteTile(game.player.x, game.player.y), false);
  const target = { x: 14, y: 7 };
  for (let i = 0; i < 100 && (game.player.x !== target.x || game.player.y !== target.y); i++) {
    const next = game.nextPlayerStep(target); assert.ok(next);
    assert.equal(Math.abs(next.x - game.player.x) + Math.abs(next.y - game.player.y), 1);
    assert.equal(isRouteTile(next.x, next.y), false); assert.ok(isWalkable(next.x, next.y));
    game.player = next;
  }
  assert.deepEqual(game.player, target);
  const blocked = new DefenseSimulation(() => 0);
  assert.deepEqual(blocked.nextPlayerStep({ x: 11, y: 5 }), { x: 6, y: 5 });
  blocked.elementEnergy.fire = ROBOT_CHARGE_COST; blocked.placeRobot(6, 5, 'fire');
  assert.equal(blocked.canMovePlayer(6, 5), false);
  assert.equal(blocked.nextPlayerStep({ x: 11, y: 5 }), null);
});

test('new games do not share combat, selection or resource state', () => {
  const a = new DefenseSimulation(), b = new DefenseSimulation();
  summon(a); a.startWave(); advance(a, 5);
  assert.equal(b.status, 'ready'); assert.equal(b.credits, 300); assert.equal(b.robots.length, 0); assert.equal(b.selectedId, null); assert.equal(b.elapsed, 0); assert.deepEqual(b.elementEnergy, { fire: 0, electric: 0, ice: 0 });
});

test('three second countdown shows 3, 2, 1 before combat starts once', () => {
 const game = new DefenseSimulation();
 assert.equal(Math.ceil(game.countdown), 3);
 for (const expected of [2, 1]) {
   advance(game, 1);
   assert.ok(Math.abs(game.countdown - expected) < 0.000001);
   assert.equal(game.status, 'ready');
   assert.equal(game.wave, 0); assert.equal(game.elapsed, 0);
   assert.equal(game.spawned, 0); assert.equal(game.enemies.length, 0);
   assert.equal(game.monsterSummonCountdown, SUMMONED_MONSTER.summonDelay);
 }
 advance(game, 0.95); assert.equal(game.status, 'ready'); assert.ok(game.countdown > 0);
 advance(game, 0.05); assert.equal(game.status, 'running'); assert.equal(game.wave, 1); assert.equal(game.robots.length, 0);
 assert.equal(game.countdown, 0); assert.equal(game.elapsed, 0); assert.equal(game.spawned, 0);
 advance(game, 0.1); assert.equal(game.spawned, 1); assert.equal(game.startWave(), false);
});

test('later waves reset energy and all robots before the same countdown', () => {
 const game = new DefenseSimulation(() => 0.4);
 game.startWave(); game.player = { x: 14, y: 11 }; summon(game, 'fire');
 for (const nextWave of [2, 3]) {
   game.enemies = []; game.elapsed = SUMMONED_MONSTER.summonDelay; game.step(0.05);
   for (const target of game.enemies) target.health = 0;
   game.step(0.05); assert.equal(game.status, 'cleared');
   game.elementEnergy = { fire: 5, electric: 7, ice: 8 };
   assert.equal(game.startWave(), true);
   assert.equal(game.status, 'ready'); assert.equal(game.wave, nextWave); assert.equal(game.countdown, 3);
   assert.equal(game.credits, 300); assert.deepEqual(game.elementEnergy, { fire: 0, electric: 0, ice: 0 });
   assert.equal(game.robotCount, 0); assert.deepEqual(game.deployedRobots, []); assert.equal(game.selectedId, null);
   assert.equal(game.startWave(), false, 'repeated requests cannot bypass the countdown');
   for (const expected of [2, 1]) {
     advance(game, 1);
     assert.ok(Math.abs(game.countdown - expected) < 0.000001);
     assert.equal(game.status, 'ready'); assert.equal(game.wave, nextWave);
     assert.equal(game.elapsed, 0); assert.equal(game.spawned, 0); assert.equal(game.enemies.length, 0);
     assert.equal(game.monsterSummonCountdown, SUMMONED_MONSTER.summonDelay);
     assert.equal(game.movePlayer(4, 7), false);
     assert.equal(game.startWave(), false);
   }
   advance(game, 0.95); assert.equal(game.status, 'ready');
   advance(game, 0.05); assert.equal(game.status, 'running'); assert.equal(game.countdown, 0);
   assert.equal(game.elapsed, 0); assert.equal(game.spawned, 0);
   assert.equal(game.credits, 300); assert.deepEqual(game.elementEnergy, { fire: 0, electric: 0, ice: 0 });
   assert.equal(game.robotCount, 0);
   summon(game, 'fire');
   assert.equal(game.robots[0].serial, 1); assert.equal(game.robots[0].missionNumber, nextWave);
   advance(game, 0.05); assert.equal(game.spawned, 1);
 }
 game.enemies = []; game.elapsed = SUMMONED_MONSTER.summonDelay; game.step(0.05);
 for (const target of game.enemies) target.health = 0;
 game.step(0.05); assert.equal(game.status, 'cleared');
 const finalState = JSON.stringify(game);
 assert.equal(game.startWave(), false);
 for (let frame = 0; frame < 100; frame++) game.step(0.05);
 assert.equal(JSON.stringify(game), finalState, 'the final victory remains on screen');
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
 game.elementEnergy.fire = ROBOT_CHARGE_COST; game.placeRobot(8, 5, 'fire');
 assert.equal(game.robots.length, 1);
 assert.deepEqual([game.robots[0].x, game.robots[0].y], [8, 5]);
});
test('robots relocate freely off the road without spending energy and reject occupied or player tiles', () => {
 const game = new DefenseSimulation(() => 0); summon(game); summon(game);
 const robot = game.robots[0], balance = game.credits;
 game.moveRobot(robot.id, 4, 7); assert.deepEqual([robot.x,robot.y],[4,7]); assert.equal(game.credits,balance);
 for(const p of [{x:0,y:0},{x:1,y:4},game.player,game.robots[1]]) {game.moveRobot(robot.id,p.x,p.y); assert.deepEqual([robot.x,robot.y],[4,7]);}
 game.startWave(); game.moveRobot(robot.id,6,7); assert.deepEqual([robot.x,robot.y],[6,7]);
});

test('player drops place directly on empty floor and rejected drops preserve position and resources', () => {
 const game = new DefenseSimulation();
 const origin = { ...game.player };
 assert.equal(game.movePlayer(4, 7), false, 'countdown blocks placement');
 assert.deepEqual(game.player, origin);
 game.startWave();
 game.elementEnergy.fire = ROBOT_CHARGE_COST; game.placeRobot(4, 7, 'fire');
 const balance = game.credits, energy = { ...game.elementEnergy };
 assert.equal(game.movePlayer(13, 7), true);
 assert.deepEqual(game.player, { x: 13, y: 7 });
 for (const [x, y] of [[0, 0], [1, 4], [12, 5], [4, 7], [2.5, 7]]) {
   assert.equal(game.movePlayer(x, y), false);
   assert.deepEqual(game.player, { x: 13, y: 7 });
 }
 game.togglePause();
 assert.equal(game.movePlayer(5, 5), false);
 assert.deepEqual(game.player, { x: 13, y: 7 });
 assert.equal(game.credits, balance); assert.deepEqual(game.elementEnergy, energy);
});
test('the player attacks nearby enemies before any robot is summoned', () => {
 const game = new DefenseSimulation(); game.startWave();
 const shots=[]; for(let i=0;i<20;i++) shots.push(...game.step(.05));
 assert.equal(game.robots.length,0); assert.ok(shots.some(s=>s.player)); assert.ok(game.enemies[0].health<WAVE_ONE.health);
});
