import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE } from '../src/game/defense-simulation.ts';
import { ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';

const advance = (game: DefenseSimulation, seconds: number) => {
  // Isolate the boss timer from regular enemies without disabling the spawner.
  for (let frame = 0; frame < Math.round(seconds * 20); frame++) {
    if (game.status === 'running') game.enemies = game.enemies.filter(enemy => enemy.kind === 'summoned');
    game.step(0.05);
    if (game.status === 'running') game.enemies = game.enemies.filter(enemy => enemy.kind === 'summoned');
  }
};
const spawnBoss = (game: DefenseSimulation) => {
  game.player = { x: 14, y: 11 };
  game.startWave();
  advance(game, SUMMONED_MONSTER.summonDelay);
};

test('one boss automatically appears exactly 100 seconds after game start without input', () => {
  const game = new DefenseSimulation(); game.player = { x: 14, y: 11 };
  game.startWave();
  assert.equal(game.enemies.length, 0);
  assert.equal(game.totalEnemies, WAVE_ONE.enemies + 1);
  assert.equal(game.monsterSummonCountdown, 100);
  advance(game, 99.95);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.monsterSummonCountdown, 1);
  assert.equal(game.status, 'running', 'the wave waits for the automatic boss');
  game.step(0.05);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.monsterSummonCountdown, null);
  const boss = game.enemies[0];
  assert.equal(boss.kind, 'summoned');
  assert.equal(boss.health, SUMMONED_MONSTER.health);
  assert.ok(SUMMONED_MONSTER.health > WAVE_ONE.health);
  assert.ok(SUMMONED_MONSTER.size > 98);
  assert.equal(boss.waypoint, 1);
  assert.ok(boss.x >= ROUTE[0].x && boss.x < ROUTE[0].x + 0.1);
  assert.equal(boss.y, ROUTE[0].y);
  advance(game, 20);
  assert.equal(game.enemies.length, 1, 'the automatic boss is spawned only once');
  assert.equal(game.enemies[0].id, boss.id);
  boss.health = 0; game.step(0.05);
  assert.equal(game.status, 'cleared');
  const cleared = JSON.stringify(game);
  advance(game, 90);
  assert.equal(JSON.stringify(game), cleared);
});

test('the delay starts with the wave and regular monsters continue to spawn', () => {
  const game = new DefenseSimulation(); game.player = { x: 14, y: 11 };
  advance(game, 3);
  assert.equal(game.status, 'running');
  assert.equal(game.monsterSummonCountdown, 100);
  game.step(0.05);
  assert.equal(game.spawned, 1);
  assert.equal(game.enemies[0].kind, undefined);
  game.enemies = [];
  advance(game, 99.9);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.monsterSummonCountdown, 1);
  game.step(0.05);
  assert.equal(game.enemies[0].kind, 'summoned');
});

test('repeated start requests do not restart the automatic boss countdown', () => {
  const game = new DefenseSimulation(); game.player = { x: 14, y: 11 };
  game.startWave();
  advance(game, 20);
  assert.equal(game.startWave(), false);
  assert.equal(game.monsterSummonCountdown, 80);
  advance(game, 80);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.monsterSummonCountdown, null);
});

test('pause freezes automatic spawning, and resuming completes the remaining delay', () => {
  const game = new DefenseSimulation();
  game.startWave();
  advance(game, 15); game.togglePause();
  const before = JSON.stringify(game);
  advance(game, 90);
  assert.equal(JSON.stringify(game), before);
  game.togglePause(); advance(game, 84.95);
  assert.equal(game.enemies.length, 0);
  game.step(0.05);
  assert.equal(game.enemies.length, 1);
});

test('defeat stops automatic spawning and a new game starts a fresh 100 second countdown', () => {
  const game = new DefenseSimulation();
  game.startWave();
  const end = ROUTE.at(-1)!;
  game.enemies.push({ ...end, x: end.x + 0.001, id: 100, waypoint: ROUTE.length - 1, health: 100, burnTime: 0, burnDamage: 0, slowTime: 0 });
  game.step(0.05);
  assert.equal(game.status, 'defeat');
  const before = JSON.stringify(game);
  advance(game, 60);
  assert.equal(JSON.stringify(game), before);
  const reset = new DefenseSimulation();
  reset.startWave();
  assert.equal(reset.monsterSummonCountdown, 100);
  assert.equal(reset.totalEnemies, WAVE_ONE.enemies + 1);
  advance(reset, 100);
  assert.equal(reset.enemies.length, 1);
});

test('special kills always award three random elements, with the rare robot roll independent', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const roll = (index + 0.5) / 3;
    const rolls = [roll, roll, roll, SUMMONED_MONSTER.robotDropChance];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++]);
    spawnBoss(game); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.elementEnergy[kind], 0);
    assert.equal(Object.values(game.elementEnergy).reduce((sum, amount) => sum + amount, 0), 0);
    assert.equal(game.robotCount, 1);
    assert.equal(game.robots[0].kind, kind);
    assert.equal(game.kills, 1);
    assert.equal(count, 4);
    game.step(0.05); assert.equal(count, 4, 'dead monsters cannot reward twice');
  }
});

test('rare rewards store every robot kind for free without deploying it and preserve selection', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const rolls = [0, 0.5, 0.99, SUMMONED_MONSTER.robotDropChance - 0.001, (index + 0.5) / 3];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++]);
    game.elementEnergy.fire = 3; game.summon('fire');
    const selected = game.selectedId;
    spawnBoss(game); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.robotCount, 2);
    assert.equal(game.robots[1].kind, kind);
    assert.equal(game.selectedId, selected);
    assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 1 });
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
    assert.equal(game.robots[1].deployed, false);
    assert.deepEqual(game.deployedRobots.map(robot => robot.id), [game.robots[0].id]);
    assert.equal(count, 5);
  }
});

test('rare rewards respect the nine robot limit while still awarding element energy', () => {
  const game = new DefenseSimulation(() => 0);
  game.elementEnergy.fire = 27;
  for (let i = 0; i < 9; i++) game.summon('fire');
  spawnBoss(game); game.enemies[0].health = 0;
  game.step(0.05);
  assert.equal(game.robotCount, 9);
  assert.equal(game.elementEnergy.fire, 3);
});

test('rare rewards can add the ninth robot', () => {
  const draws = [0, 0.5, 0.99, 0, 0];
  let count = 0;
  const game = new DefenseSimulation(() => draws[count++]);
  game.elementEnergy.fire = 24;
  for (let i = 0; i < 8; i++) game.summon('fire');
  spawnBoss(game); game.enemies[0].health = 0;
  game.step(0.05);
  assert.equal(game.robotCount, 9);
  assert.equal(game.robots.at(-1)!.deployed, false);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 1 });
});

test('special monsters award nothing on escape and prevent clearing until defeated', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0.5; });
  spawnBoss(game);
  game.step(0.05); assert.equal(game.status, 'running');
  const end = ROUTE.at(-1)!;
  Object.assign(game.enemies[0], { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1 });
  game.step(0.05);
  assert.equal(game.status, 'defeat'); assert.equal(rolls, 0);
  assert.equal(game.robotCount, 0);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('burning special monsters reward once before they can escape; paused rewards wait', () => {
  const rolls = [0.99, 0.99, 0.99, 0.99]; let count = 0;
  const game = new DefenseSimulation(() => rolls[count++]);
  spawnBoss(game);
  const end = ROUTE.at(-1)!;
  Object.assign(game.enemies[0], { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, health: 0.01, burnTime: 1, burnDamage: 10 });
  game.togglePause(); game.step(0.05); assert.equal(count, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, 1);
  assert.equal(game.health, 100); assert.equal(game.elementEnergy.electric, 0);
  assert.equal(game.robotCount, 1); assert.equal(game.robots[0].kind, 'electric');
  assert.equal(count, 4);
});
