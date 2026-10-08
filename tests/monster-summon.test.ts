import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE } from '../src/game/defense-simulation.ts';
import { ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';

test('each click adds a distinct special monster immediately without replacing the mint wave', () => {
  const game = new DefenseSimulation();
  game.summonMonster(); game.summonMonster();
  assert.equal(game.enemies.length, 2);
  assert.equal(game.totalEnemies, WAVE_ONE.enemies + 2);
  assert.equal(game.spawned, 0);
  assert.notEqual(game.enemies[0].id, game.enemies[1].id);
  for (const enemy of game.enemies) {
    assert.equal(enemy.kind, 'summoned');
    assert.equal(enemy.health, SUMMONED_MONSTER.health);
    assert.deepEqual({ x: enemy.x, y: enemy.y }, ROUTE[0]);
  }
  game.startWave(); game.step(0.05);
  assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 2);
  assert.equal(game.enemies.filter(enemy => !enemy.kind).length, 1);
  assert.equal(new DefenseSimulation().totalEnemies, WAVE_ONE.enemies);
});

test('paused and finished games reject monster summons', () => {
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    const game = new DefenseSimulation(); game.status = status;
    const before = JSON.stringify(game);
    game.summonMonster();
    assert.equal(JSON.stringify(game), before);
  }
});

test('special kills always award one random element, with the rare robot roll independent', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const rolls = [(index + 0.5) / 3, SUMMONED_MONSTER.robotDropChance];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++]);
    game.startWave(); game.summonMonster(); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.elementEnergy[kind], 1);
    assert.equal(Object.values(game.elementEnergy).reduce((sum, amount) => sum + amount, 0), 1);
    assert.equal(game.robotCount, 0);
    assert.equal(game.kills, 1);
    assert.equal(count, 2);
    game.step(0.05); assert.equal(count, 2, 'dead monsters cannot reward twice');
  }
});

test('rare rewards summon every robot kind for free on an available floor tile and preserve selection', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const rolls = [0.5, SUMMONED_MONSTER.robotDropChance - 0.001, (index + 0.5) / 3];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++]);
    game.elementEnergy.fire = 3; game.summon('fire');
    const selected = game.selectedId;
    game.startWave(); game.summonMonster(); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.robotCount, 2);
    assert.equal(game.robots[1].kind, kind);
    assert.equal(game.selectedId, selected);
    assert.deepEqual(game.elementEnergy, { fire: 0, ice: 1, electric: 0 });
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy);
    assert.notDeepEqual({ x: game.robots[1].x, y: game.robots[1].y }, game.player);
    assert.notEqual(game.robots[1].x, game.robots[0].x);
    assert.equal(count, 3);
  }
});

test('rare rewards respect the eight robot limit while still awarding element energy', () => {
  const game = new DefenseSimulation(() => 0);
  game.elementEnergy.fire = 24;
  for (let i = 0; i < 8; i++) game.summon('fire');
  game.startWave(); game.summonMonster(); game.enemies[0].health = 0;
  game.step(0.05);
  assert.equal(game.robotCount, 8);
  assert.equal(game.elementEnergy.fire, 1);
});

test('special monsters award nothing on escape and prevent clearing until defeated', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0.5; });
  game.startWave(); game.spawned = WAVE_ONE.enemies; game.summonMonster();
  game.step(0.05); assert.equal(game.status, 'running');
  const end = ROUTE.at(-1)!;
  Object.assign(game.enemies[0], { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1 });
  game.step(0.05);
  assert.equal(game.status, 'defeat'); assert.equal(rolls, 0);
  assert.equal(game.robotCount, 0);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('burning special monsters reward once before they can escape; paused rewards wait', () => {
  const rolls = [0.99, 0.99]; let count = 0;
  const game = new DefenseSimulation(() => rolls[count++]);
  game.startWave(); game.spawned = WAVE_ONE.enemies; game.summonMonster();
  const end = ROUTE.at(-1)!;
  Object.assign(game.enemies[0], { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, health: 0.01, burnTime: 1, burnDamage: 10 });
  game.togglePause(); game.step(0.05); assert.equal(count, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, 1);
  assert.equal(game.health, 100); assert.equal(game.elementEnergy.electric, 1);
  assert.equal(count, 2);
});
