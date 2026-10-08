import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, type Enemy } from '../src/game/defense-simulation.ts';
import { WAVE_ONE } from '../src/game/wave-one.ts';

const monster = (id: number, health: number): Enemy => ({
  id, x: 5, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0,
});

test('player kills award exactly one random element from three equally sized ranges', () => {
  for (const [roll, kind] of [[0, 'fire'], [1 / 3 - 0.001, 'fire'], [1 / 3, 'ice'], [2 / 3 - 0.001, 'ice'], [2 / 3, 'electric'], [0.999, 'electric']] as const) {
    let rolls = 0;
    const game = new DefenseSimulation(() => { rolls++; return roll; });
    game.startWave();
    game.enemies = [monster(100, 14)];
    const shots = game.step(0.05);
    assert.ok(shots.some(shot => shot.player));
    assert.equal(game.kills, 1);
    assert.equal(rolls, 1);
    assert.equal(game.elementEnergy[kind], 1);
    assert.equal(Object.values(game.elementEnergy).reduce((a, b) => a + b, 0), 1);
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy);
    game.step(0.05);
    assert.equal(rolls, 1, 'a removed monster must not grant a second reward');
  }
});

test('nonfatal player attacks do not award element energy or consume a random roll', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0; });
  game.startWave(); game.enemies = [monster(100, 1000)];
  game.step(0.05);
  assert.equal(game.enemies.find(enemy => enemy.id === 100)!.health, 986);
  assert.equal(game.kills, 0); assert.equal(rolls, 0);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('simultaneous monster deaths roll independently and accumulate each element once', () => {
  const draws = [0, 0.4, 0.99, 0];
  let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++]);
  game.startWave();
  game.enemies = draws.map((_, index) => monster(100 + index, 0));
  game.step(0.05);
  assert.equal(game.kills, 4); assert.equal(rolls, 4);
  assert.deepEqual(game.elementEnergy, { fire: 2, ice: 1, electric: 1 });
  game.step(0.05);
  assert.equal(rolls, 4);
});

test('burn deaths award an element before movement; pause freezes rewards', () => {
  const game = new DefenseSimulation(() => 0.99);
  game.startWave();
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...monster(100, 0.01), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, burnTime: 1, burnDamage: 10 }];
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 0); assert.equal(game.elementEnergy.electric, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 1); assert.equal(game.elementEnergy.electric, 1);
  assert.equal(game.health, 100); assert.equal(game.escaped, 0);
});

test('escaped monsters grant no element energy and fresh games start without elements', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0; });
  game.startWave(); game.spawned = WAVE_ONE.enemies;
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...monster(100, 1000), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1 }];
  game.step(0.05);
  assert.equal(game.escaped, 1); assert.equal(rolls, 0);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
  game.elementEnergy.fire = 10;
  const fresh = new DefenseSimulation();
  assert.deepEqual(fresh.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});
