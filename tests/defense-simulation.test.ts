import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, type Enemy } from '../src/game/defense-simulation.ts';
import { DEPLOY_SLOTS, WAVE_ONE } from '../src/game/wave-one.ts';
import { isWalkable } from '../src/game/room/walkable.ts';

const advance = (game: DefenseSimulation, seconds: number) => { for (let i = 0; i < seconds * 20 && game.status === 'running'; i++) game.step(0.05); };
const enemy = (id: number, x: number, y = 7): Enemy => ({ id, x, y, waypoint: 1, health: 1000, burnTime: 0, burnDamage: 0, slowTime: 0 });

test('room boundaries and flipped wall tiles cannot be walked on; every deploy slot is valid', () => {
  assert.equal(isWalkable(7, 6), true);
  for (const [x, y] of [[-1, 6], [16, 6], [7, 15], [0, 6], [15, 6], [7, 0], [2.5, 6]]) assert.equal(isWalkable(x, y), false);
  for (const slot of DEPLOY_SLOTS) assert.equal(isWalkable(slot.x, slot.y), true);
});

test('invalid placement, duplicates, insufficient energy and full board preserve energy and random rolls', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0; });
  for (const [x, y] of [[0, 6], [2, 7], [8, 4], [4, 9]]) game.placeDrone(x, y);
  assert.equal(game.credits, 300); assert.equal(rolls, 0);
  game.placeDrone(3, 6); game.placeDrone(3, 6);
  assert.equal(game.drones.length, 1); assert.equal(game.credits, 225); assert.equal(rolls, 1);
  game.summon(); game.summon(); game.summon(); game.summon();
  assert.equal(game.drones.length, 4); assert.equal(game.credits, 0); assert.equal(rolls, 4);
  game.credits = 1000;
  for (let i = 0; i < 4; i++) game.summon();
  const balance = game.credits;
  game.summon(); assert.equal(game.credits, balance); assert.equal(rolls, 8);
});

test('random summons cover three drone types and select the new drone', () => {
  let count = 0;
  const game = new DefenseSimulation(() => [0, 0.4, 0.99][count++]);
  game.summon(); game.summon(); game.summon();
  assert.deepEqual(game.drones.map(d => d.kind), ['fire', 'ice', 'electric']);
  assert.equal(game.selectedId, game.drones[2].id);
});

test('merge requires matching kind and grade, preserves selected identity and cooldown, and caps at grade 3', () => {
  const game = new DefenseSimulation(() => 0);
  game.credits = 2000;
  game.summon(); game.summon();
  const selected = game.drones[1]; selected.cooldown = 0.65;
  const balance = game.credits;
  game.merge(); assert.equal(game.drones.length, 1); assert.equal(selected.grade, 2);
  assert.equal(game.selectedId, selected.id); assert.equal(selected.cooldown, 0.65); assert.equal(game.credits, balance);
  assert.ok(selected.damage > 19 * 2); assert.ok(selected.range > 3.2);
  game.summon(); game.selectDrone(selected.id); game.merge(); assert.equal(game.drones.length, 2);
  game.summon(); game.selectDrone(game.drones.at(-1)!.id); game.merge();
  assert.equal(game.drones.length, 2); assert.equal(game.drones[1].grade, 2);
  game.selectDrone(selected.id); game.merge(); assert.equal(selected.grade, 3); assert.equal(game.drones.length, 1);
  game.merge(); assert.equal(selected.grade, 3);
});

test('different kinds cannot merge', () => {
  let count = 0;
  const game = new DefenseSimulation(() => count++ ? 0.4 : 0);
  game.summon(); game.summon(); game.merge(); assert.equal(game.drones.length, 2);
});

test('wave requires a drone; pause freezes combat and rejects summon/merge; battle permits both', () => {
  const game = new DefenseSimulation(() => 0);
  assert.equal(game.startWave(), false);
  game.summon(); assert.equal(game.startWave(), true); assert.equal(game.startWave(), false);
  game.summon(); assert.equal(game.drones.length, 2);
  game.step(0.05); game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let i = 0; i < 100; i++) game.step(0.05);
  game.summon(); game.merge(); assert.equal(JSON.stringify(game), snapshot);
  game.togglePause(); game.merge(); assert.equal(game.drones.length, 1); assert.equal(game.status, 'running');
});

test('sequential code selects the nearest living in-range target, then attacks, then waits', () => {
  const game = new DefenseSimulation(() => 0);
  game.summon(); game.startWave();
  game.enemies = [enemy(100, 5), enemy(101, 3), enemy(102, 14)];
  game.step(0.05);
  assert.equal(game.drones[0].activeBlock, 'attack'); assert.equal(game.drones[0].targetId, 101);
  const shots = [];
  for (let i = 0; i < 4; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 1); assert.equal(game.drones[0].activeBlock, 'wait');
  assert.equal(game.enemies.find(e => e.id === 100)!.health, 1000);
  assert.ok(game.enemies.find(e => e.id === 101)!.health < 1000);
});

test('repeated code respects attack cooldown and reacquires dead targets', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.summon(); game.startWave(); game.enemies = [enemy(100, 3)];
  const times: number[] = [];
  for (let i = 0; i < 160; i++) if (game.step(0.05).length) times.push(game.elapsed);
  assert.ok(times.length > 4);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 0.9 - 1e-8);
  game.drones[0].activeBlock = 'attack'; game.drones[0].phaseTimer = 0; game.drones[0].targetId = -1;
  game.step(0.05); assert.equal(game.drones[0].activeBlock, 'find'); assert.equal(game.drones[0].targetId, null);
});

test('fire applies damage over time, ice slows, and electric chains to one nearby enemy', () => {
  for (const [roll, effect] of [[0, 'burnTime'], [0.4, 'slowTime']] as const) {
    const game = new DefenseSimulation(() => roll); game.summon(); game.startWave(); game.enemies = [enemy(100, 3)];
    advance(game, 0.25); assert.ok(game.enemies[0][effect] > 0);
    if (effect === 'burnTime') { const health = game.enemies[0].health; advance(game, 0.2); assert.ok(game.enemies[0].health < health); }
  }
  const game = new DefenseSimulation(() => 0.99); game.summon(); game.startWave(); game.enemies = [enemy(100, 3), enemy(101, 3.5)];
  const shots = [];
  for (let i = 0; i < 5; i++) shots.push(...game.step(0.05));
  assert.equal(shots.length, 2); assert.equal(shots[1].chain, true); assert.ok(game.enemies[1].health < 1000);
});

test('a burning enemy killed before reaching the base awards energy without breach damage', () => {
  const game = new DefenseSimulation(); game.summon(); game.startWave();
  game.enemies = [{ ...enemy(100, 8, 3.001), waypoint: 2, health: 0.01, burnTime: 1, burnDamage: 10 }];
  const balance = game.credits;
  game.step(0.05); assert.equal(game.health, 100); assert.equal(game.escaped, 0); assert.equal(game.kills, 1); assert.equal(game.credits, balance + 15);
});

test('three starting drones can clear wave 1 with every single-kind starting draw', () => {
  for (const roll of [0, 0.4, 0.99]) {
    const game = new DefenseSimulation(() => roll); game.summon(); game.summon(); game.summon(); game.startWave();
    advance(game, 90);
    assert.equal(game.status, 'cleared'); assert.equal(game.kills, 12); assert.equal(game.health, 100); assert.equal(game.wave, 1);
    assert.equal(game.credits, 300 - 3 * 75 + 12 * 15 + 50);
    const snapshot = JSON.stringify(game);
    advance(game, 30); game.summon(); game.merge(); assert.equal(game.startWave(), false); assert.equal(JSON.stringify(game), snapshot);
  }
});

test('an unguarded route causes defeat and cannot restart or duplicate rewards', () => {
  const game = new DefenseSimulation(); game.summon(); game.startWave(); game.drones = [];
  advance(game, 90); assert.equal(game.status, 'defeat'); assert.equal(game.health, 0); assert.equal(game.escaped, 7);
  const balance = game.credits; advance(game, 90); assert.equal(game.credits, balance); assert.equal(game.startWave(), false);
});

test('new games do not share combat, selection or resource state', () => {
  const a = new DefenseSimulation(), b = new DefenseSimulation();
  a.summon(); a.startWave(); advance(a, 5);
  assert.equal(b.status, 'ready'); assert.equal(b.credits, 300); assert.equal(b.drones.length, 0); assert.equal(b.selectedId, null); assert.equal(b.elapsed, 0);
});
