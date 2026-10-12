import { fundRobot, setRobotEnergy } from './robot-energy-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE } from '../src/game/defense-simulation.ts';
import { ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';
import { getRobotDeployCount, getTotalDeployCount } from '../src/game/robot-energy.ts';

const advance = (game: DefenseSimulation, seconds: number) => {
  for (let frame = 0; frame < Math.round(seconds * 20); frame++) game.step(0.05);
};
// Reward tests isolate the boss by completing regular spawning without rewards.
const spawnBoss = (game: DefenseSimulation) => {
  game.player = { x: 14, y: 11 };
  game.startWave();
  game.spawned = game.totalEnemies - 1;
  game.enemies = [];
  game.step(0.05);
};
const reachLastRegular = (game: DefenseSimulation) => {
  game.player = { x: 14, y: 11 };
  game.startWave();
  while (game.spawned < game.totalEnemies - 1) {
    for (const enemy of game.enemies) enemy.health = 0;
    game.step(0.05);
    assert.equal(game.enemies.some(enemy => enemy.kind === 'summoned'), false);
  }
  return game.enemies[0];
};

test('the last regular kill immediately spawns one boss before 100 seconds', () => {
  const game = new DefenseSimulation();
  assert.equal(game.monsterSummonRemaining, WAVE_ONE.enemies);
  const last = reachLastRegular(game);
  assert.equal(game.monsterSummonRemaining, 1);
  assert.ok(game.elapsed < 100);
  last.health = 0;
  game.step(0.05);
  assert.equal(game.kills, WAVE_ONE.enemies);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.monsterSummonRemaining, null);
  const boss = game.enemies[0];
  assert.equal(boss.kind, 'summoned');
  assert.equal(boss.health, SUMMONED_MONSTER.health);
  assert.equal(boss.waypoint, 1);
  assert.equal(boss.x, ROUTE[0].x);
  assert.equal(boss.y, ROUTE[0].y);
  advance(game, 1);
  assert.equal(game.enemies.length, 1, 'the boss is spawned only once');
  assert.equal(game.enemies[0].id, boss.id);
  boss.health = 0;
  game.step(0.05);
  assert.equal(game.status, 'cleared');
  assert.equal(game.kills, game.totalEnemies);
  const cleared = JSON.stringify(game);
  advance(game, 90);
  assert.equal(JSON.stringify(game), cleared);
});

test('time alone does not spawn a boss while a regular monster remains alive', () => {
  const game = new DefenseSimulation();
  const last = reachLastRegular(game);
  while (game.elapsed < 110) {
    Object.assign(last, ROUTE[0], { waypoint: 1 });
    game.step(0.05);
  }
  assert.equal(game.status, 'running');
  assert.deepEqual(game.enemies, [last]);
  assert.equal(game.monsterSummonRemaining, 1);
  assert.equal(game.startWave(), false);
  last.health = 0;
  game.step(0.05);
  assert.equal(game.enemies[0].kind, 'summoned');
});

test('burn damage killing the last regular monster spawns the boss in the same step', () => {
  const game = new DefenseSimulation();
  const last = reachLastRegular(game);
  Object.assign(last, { health: 0.01, burnTime: 1, burnDamage: 10 });
  game.step(0.05);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemies[0].kind, 'summoned');
});

test('the player killing the last regular monster spawns the boss in the same step', () => {
  const game = new DefenseSimulation();
  const last = reachLastRegular(game);
  game.player = { x: last.x, y: last.y + 1 };
  last.health = 1;
  const shots = game.step(0.05);
  assert.ok(shots.some(shot => shot.player));
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemies[0].kind, 'summoned');
});

test('pause defers the last regular kill and boss spawn until resuming', () => {
  const game = new DefenseSimulation();
  const last = reachLastRegular(game);
  last.health = 0;
  game.togglePause();
  const before = JSON.stringify(game);
  advance(game, 90);
  assert.equal(JSON.stringify(game), before);
  assert.equal(game.monsterSummonRemaining, 1);
  game.togglePause();
  game.step(0.05);
  assert.equal(game.enemies[0].kind, 'summoned');
});

test('defeat prevents boss spawning and a new game resets required regular kills', () => {
  const game = new DefenseSimulation();
  const last = reachLastRegular(game);
  const end = ROUTE.at(-1)!;
  Object.assign(last, { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1 });
  game.step(0.05);
  assert.equal(game.status, 'defeat');
  assert.equal(game.enemies.some(enemy => enemy.kind === 'summoned'), false);
  const before = JSON.stringify(game);
  advance(game, 60);
  assert.equal(JSON.stringify(game), before);
  const reset = new DefenseSimulation();
  reset.startWave();
  assert.equal(reset.monsterSummonRemaining, WAVE_ONE.enemies);
  assert.equal(reset.totalEnemies, WAVE_ONE.enemies + 1);
});

test('special kills always award three random elements, with the rare robot roll independent', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const roll = (index + 0.5) / 3;
    const rolls = [roll, roll, roll, SUMMONED_MONSTER.robotDropChance];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++]);
    spawnBoss(game); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.elementEnergy[kind], 3);
    assert.equal(Object.values(game.elementEnergy).reduce((sum, amount) => sum + amount, 0), 3);
    assert.equal(game.robotCount, 0);
    assert.equal(game.kills, 1);
    assert.equal(count, 4);
    game.step(0.05); assert.equal(count, 4, 'dead monsters cannot reward twice');
  }
});

test('rare rewards store every robot kind for later manual deployment and preserve selection', () => {
  for (const [index, kind] of ROBOT_KINDS.entries()) {
    const rolls = [0, 0.5, 0.99, SUMMONED_MONSTER.robotDropChance - 0.001, (index + 0.5) / 3];
    let count = 0;
    const game = new DefenseSimulation(() => rolls[count++] ?? 0.5);
    setRobotEnergy(game, 'fire'); game.summon('fire');
    const selected = game.selectedId;
    spawnBoss(game); game.enemies[0].health = 0;
    game.step(0.05);
    assert.equal(game.robotCount, 2);
    assert.equal(game.robots[1].kind, kind);
    assert.equal(game.selectedId, selected);
    assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 1 });
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy + WAVE_ONE.clearEnergy);
    assert.equal(game.robots[1].deployed, false);
    assert.equal(game.robots[1].autoAttackActive, false);
    assert.equal(game.deployedRobots.length, 1);
    assert.equal(count, 5);
  }
});

test('rare rewards respect the nine robot limit while still awarding element energy', () => {
  const game = new DefenseSimulation(() => 0);
  setRobotEnergy(game, 'fire', 9);
  for (let i = 0; i < 9; i++) game.summon('fire');
  spawnBoss(game); game.enemies[0].health = 0;
  game.step(0.05);
  assert.equal(game.robotCount, 9);
  assert.equal(game.elementEnergy.fire, 3);
});

test('a rare reward manually deploys without energy as the ninth robot', () => {
  const draws = [0, 0.5, 0.99, 0, 0.99]; let draw = 0;
  const game = new DefenseSimulation(() => draws[draw++] ?? 0.5);
  fundRobot(game, 'fire', 8);
  for (let i = 0; i < 8; i++) game.summon('fire');
  spawnBoss(game); game.enemies[0].health = 0;
  game.enemies.push({ id: 1000, x: 14, y: 4, waypoint: 1, health: 1000, burnTime: 0, burnDamage: 0, slowTime: 0 });
  game.step(0.05);
  const stored = game.robots.at(-1)!;
  assert.equal(game.robotCount, 9); assert.equal(stored.kind, 'electric'); assert.equal(stored.deployed, false);
  const energy = { ...game.elementEnergy };
  assert.equal(getRobotDeployCount(game.robots, 'electric'), 1);
  assert.equal(getTotalDeployCount(game.robots), 1);
  assert.equal(game.deployRobotKind('electric'), true);
  assert.equal(game.robotCount, 9); assert.equal(game.selectedId, stored.id);
  assert.deepEqual(game.elementEnergy, energy);
  assert.equal(stored.autoAttackActive, false);
});

test('rare rewards can add the ninth robot', () => {
  const draws = [0, 0.5, 0.99, 0, 0];
  let count = 0;
  const game = new DefenseSimulation(() => draws[count++] ?? 0.5);
  setRobotEnergy(game, 'fire', 8);
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
    const game = new DefenseSimulation(() => rolls[count++] ?? 0.5);
  spawnBoss(game);
  const end = ROUTE.at(-1)!;
  Object.assign(game.enemies[0], { x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, health: 0.01, burnTime: 1, burnDamage: 10 });
  game.togglePause(); game.step(0.05); assert.equal(count, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, 1);
  assert.equal(game.health, 100); assert.equal(game.elementEnergy.electric, 3);
  assert.equal(game.robotCount, 0);
  assert.equal(count, 4);
});
