import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE } from '../src/game/defense-simulation.ts';
import { WAVE_ONE } from '../src/game/wave-one.ts';

test('all three waves spawn exactly 50, 70 and 90 regular enemies at the existing interval', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 };
  for (const [index, count] of [50, 70, 90].entries()) {
    assert.equal(game.startWave(), true);
    assert.equal(game.wave, index + 1);
    assert.equal(game.spawned, 0);
    assert.equal(game.totalEnemies, count + 1);
    assert.equal(game.monsterSummonCountdown, 100);
    if (index > 0) {
      for (let frame = 0; frame < 60; frame++) game.step(0.05);
      assert.equal(game.status, 'running');
    }
    const spawnTimes: number[] = [];
    for (let frame = 0; frame < 160 * 20; frame++) {
      const before = game.spawned;
      game.step(0.05);
      if (game.spawned > before) spawnTimes.push(game.elapsed);
      for (const enemy of game.enemies) {
        if (enemy.kind !== 'summoned') enemy.health = 0;
        else Object.assign(enemy, ROUTE[0], { waypoint: 1 });
      }
    }
    assert.equal(game.status, 'running', 'the wave still waits for the boss');
    assert.equal(game.spawned, count);
    assert.equal(spawnTimes.length, count);
    for (let i = 1; i < spawnTimes.length; i++) {
      assert.ok(Math.abs(spawnTimes[i] - spawnTimes[i - 1] - WAVE_ONE.spawnInterval) <= 0.050001);
    }
    assert.equal(game.enemies.length, 1);
    assert.equal(game.enemies[0].kind, 'summoned');
    game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.status, 'cleared');
    assert.equal(game.kills, count + 1);
    assert.equal(game.totalEnemies, count + 1);
    assert.equal(game.credits, 300 + game.kills * WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
  }
  assert.equal(game.startWave(), false);
});

test('wave three spawns its boss at 100 seconds and still waits for all regular spawns', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.wave = 3; game.countdown = 0; game.player = { x: 14, y: 11 }; game.startWave();
  for (let frame = 0; frame < 100 * 20; frame++) {
    game.step(0.05);
    for (const enemy of game.enemies) enemy.health = 0;
  }
  assert.equal(game.monsterSummonCountdown, 100);
  assert.ok(game.enemies.some(enemy => enemy.kind === 'summoned'));
  game.step(0.05);
  assert.equal(game.status, 'running'); assert.ok(game.spawned < 90);
  assert.equal(game.totalEnemies, 91);
  while (game.spawned < 90) {
    for (const enemy of game.enemies) enemy.health = 0;
    game.step(0.05);
    assert.equal(game.status, 'running');
  }
  for (const enemy of game.enemies) enemy.health = 0;
  game.step(0.05); assert.equal(game.status, 'cleared');
  assert.equal(game.kills, 91);
});

test('pause freezes regular spawning and resumes with the remaining interval', () => {
  const game = new DefenseSimulation();
  game.startWave(); game.step(0.05);
  assert.equal(game.spawned, 1);
  game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let frame = 0; frame < 200; frame++) game.step(0.05);
  assert.equal(JSON.stringify(game), snapshot);
  game.togglePause();
  for (let frame = 0; frame < 30; frame++) game.step(0.05);
  assert.equal(game.spawned, 1);
  for (let frame = 0; frame < 3; frame++) game.step(0.05);
  assert.equal(game.spawned, 2);
});
