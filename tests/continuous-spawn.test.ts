import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation } from '../src/game/defense-simulation.ts';
import { SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';

test('regular enemies keep spawning at the same interval beyond twelve kills and during the boss fight', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 };
  game.startWave();
  const spawnTimes: number[] = [];
  for (let frame = 0; frame < 120 * 20; frame++) {
    const before = game.spawned;
    game.step(0.05);
    if (game.spawned > before) spawnTimes.push(game.elapsed);
    // Kill regular enemies so this exercises a defended wave with no escape.
    for (const enemy of game.enemies) if (enemy.kind !== 'summoned' && game.elapsed < 118) enemy.health = 0;
  }
  assert.equal(game.status, 'running');
  assert.equal(game.spawned, Math.ceil(120 / WAVE_ONE.spawnInterval));
  assert.ok(spawnTimes.some(time => time > 20 && time < 99));
  assert.ok(spawnTimes.some(time => time > SUMMONED_MONSTER.summonDelay));
  for (let i = 1; i < spawnTimes.length; i++) {
    assert.ok(Math.abs(spawnTimes[i] - spawnTimes[i - 1] - WAVE_ONE.spawnInterval) <= 0.050001);
  }
  assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 1);
  assert.equal(game.totalEnemies, game.spawned + 1);

  const boss = game.enemies.find(enemy => enemy.kind === 'summoned')!;
  const survivor = game.enemies.find(enemy => enemy.kind !== 'summoned')!;
  for (const enemy of game.enemies) if (enemy !== survivor) enemy.health = 0;
  survivor.health = 1000;
  boss.health = 0;
  const spawned = game.spawned;
  game.step(0.05);
  assert.equal(game.status, 'running', 'remaining regular enemies must still be defeated');
  assert.equal(game.totalEnemies, spawned + 1);
  for (let frame = 0; frame < 40; frame++) game.step(0.05);
  assert.equal(game.spawned, spawned, 'boss defeat stops further regular spawning');
  assert.equal(game.enemies.length, 1);
  survivor.health = 0;
  game.step(0.05);
  assert.equal(game.status, 'cleared');
  assert.equal(game.kills, game.totalEnemies);
  assert.equal(game.credits, 300 + game.kills * WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
});

test('each next wave resets continuous spawning, boss defeat, and the boss countdown', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 };
  for (const wave of [1, 2, 3]) {
    assert.equal(game.startWave(), true);
    assert.equal(game.wave, wave);
    assert.equal(game.spawned, 0);
    assert.equal(game.monsterSummonCountdown, SUMMONED_MONSTER.summonDelay);
    if (wave > 1) {
      assert.equal(game.status, 'ready');
      for (let frame = 0; frame < 60; frame++) game.step(0.05);
      assert.equal(game.status, 'running');
    }
    for (let frame = 0; frame < 100 * 20; frame++) {
      game.step(0.05);
      for (const enemy of game.enemies) if (enemy.kind !== 'summoned') enemy.health = 0;
    }
    assert.equal(game.spawned, WAVE_ONE.enemies);
    assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 1);
    for (const enemy of game.enemies) enemy.health = 0;
    game.step(0.05);
    assert.equal(game.status, 'cleared');
    assert.equal(game.kills, game.totalEnemies);
  }
  assert.equal(game.startWave(), false);
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
