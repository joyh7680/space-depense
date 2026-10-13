import { fundRobot, setRobotEnergy } from './robot-energy-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE } from '../src/game/defense-simulation.ts';
import { ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE } from '../src/game/wave-one.ts';
import { getRobotDeployCount, getTotalDeployCount } from '../src/game/robot-energy.ts';
import { SUMMONED_MONSTERS } from '../src/game/summoned-monsters.ts';

const advance = (game: DefenseSimulation, seconds: number) => {
  for (let frame = 0; frame < Math.round(seconds * 20); frame++) game.step(0.05);
};
// Reward tests isolate the boss at its scheduled spawn time.
const spawnBoss = (game: DefenseSimulation) => {
  game.player = { x: 14, y: 11 };
  game.startWave();
  game.spawned = game.totalEnemies - 1;
  game.enemies = [];
  game.elapsed = 99.95;
  game.step(0.05);
};

test('the timer starts at 100 and spawns exactly one boss at 100 seconds', () => {
  const game = new DefenseSimulation();
  assert.equal(game.monsterSummonCountdown, 100);
  game.player = { x: 14, y: 11 }; game.startWave();
  for (let frame = 0; frame < 1999; frame++) {
    game.step(0.05);
    for (const enemy of game.enemies) enemy.health = 0;
    assert.equal(game.enemies.some(enemy => enemy.kind === 'summoned'), false);
  }
  assert.equal(game.monsterSummonCountdown, 1);
  assert.equal(game.status, 'running');
  assert.equal(game.kills, WAVE_ONE.enemies);
  game.step(0.05);
  assert.equal(game.monsterSummonCountdown, null);
  const boss = game.enemies[0];
  assert.equal(boss.kind, 'summoned');
  assert.equal(boss.health, SUMMONED_MONSTER.health);
  assert.equal(boss.x, ROUTE[0].x); assert.equal(boss.y, ROUTE[0].y);
  advance(game, 1);
  assert.equal(game.enemies.length, 1); assert.equal(game.enemies[0].id, boss.id);
  boss.health = 0; game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, game.totalEnemies);
});

test('the timer decreases with combat time independently of regular kills', () => {
  const game = new DefenseSimulation(); game.startWave();
  advance(game, 1); assert.equal(game.monsterSummonCountdown, 99);
  game.spawned = game.totalEnemies - 1; game.enemies = []; game.kills = WAVE_ONE.enemies;
  game.step(0.05);
  assert.equal(game.monsterSummonCountdown, 99);
  assert.equal(game.enemies.length, 0); assert.equal(game.status, 'running');
});

test('a boss appears on schedule even with a living regular monster', () => {
  const game = new DefenseSimulation(); game.startWave(); game.player = { x: 14, y: 11 };
  game.spawned = game.totalEnemies - 1; game.elapsed = 99.95;
  const regular = { ...ROUTE[0], id: 1000, health: 1000, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0 };
  game.enemies = [regular]; game.step(0.05);
  assert.equal(game.enemies.length, 2);
  const boss = game.enemies.find(enemy => enemy.kind === 'summoned')!;
  assert.ok(boss); boss.health = 0; game.step(0.05);
  assert.equal(game.status, 'running', 'living regular enemies still prevent victory');
  regular.health = 0; game.step(0.05); assert.equal(game.status, 'cleared');
});

test('pause freezes the timer and resuming triggers the scheduled boss', () => {
  const game = new DefenseSimulation(); game.startWave();
  game.spawned = game.totalEnemies - 1; game.elapsed = 99.95;
  game.togglePause(); const before = JSON.stringify(game);
  advance(game, 90);
  assert.equal(JSON.stringify(game), before); assert.equal(game.monsterSummonCountdown, 1);
  game.togglePause(); game.step(0.05);
  assert.equal(game.enemies[0].kind, 'summoned'); assert.equal(game.monsterSummonCountdown, null);
});

test('defeat stops the timer and a new game resets it to 100 seconds', () => {
  const game = new DefenseSimulation(); game.startWave();
  game.elapsed = 99.95;
  const end = ROUTE.at(-1)!;
  game.enemies = [{ x: end.x + 0.001, y: end.y, id: 1000, health: 1000, waypoint: ROUTE.length - 1, burnTime: 0, burnDamage: 0, slowTime: 0 }];
  game.step(0.05); assert.equal(game.status, 'defeat');
  assert.equal(game.enemies.some(enemy => enemy.kind === 'summoned'), false);
  const before = JSON.stringify(game); advance(game, 60); assert.equal(JSON.stringify(game), before);
  assert.equal(new DefenseSimulation().monsterSummonCountdown, 100);
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

test('each wave spawns only its own boss at 100 seconds and never spawns another', () => {
  const game = new DefenseSimulation(() => 0.5);
  game.player = { x: 14, y: 11 };
  assert.equal(SUMMONED_MONSTERS.length, 3);
  for (const wave of [1, 2, 3]) {
    assert.equal(game.startWave(), true);
    if (wave > 1) advance(game, 3);
    assert.equal(game.wave, wave);
    assert.equal(game.elapsed, 0);
    assert.equal(game.nextBossNumber, wave);
    assert.equal(game.monsterSummonCountdown, 100);
    const regularCount = game.totalEnemies - 1;
    let bossId: number | undefined;
    for (let frame = 1; frame <= 10000; frame++) {
      // Keep the wave running for 500 seconds to check all former extra-spawn deadlines.
      for (const enemy of game.enemies) {
        if (enemy.kind === 'summoned') Object.assign(enemy, ROUTE[0], { waypoint: 1 });
        else enemy.health = 0;
      }
      game.step(0.05);
      const bosses = game.enemies.filter(enemy => enemy.kind === 'summoned');
      assert.equal(bosses.length, frame < 2000 ? 0 : 1);
      assert.equal(game.totalEnemies, regularCount + 1);
      if (frame >= 2000) {
        const boss = bosses[0];
        bossId ??= boss.id;
        assert.equal(boss.id, bossId);
        assert.equal(boss.bossIndex, wave - 1);
        assert.equal(boss.health, SUMMONED_MONSTER.health);
        assert.equal(game.nextBossNumber, null);
        assert.equal(game.monsterSummonCountdown, null);
      }
    }
    assert.equal(game.status, 'running');
    for (const enemy of game.enemies) enemy.health = 0;
    game.step(0.05);
    assert.equal(game.status, 'cleared');
    assert.equal(game.kills, regularCount + 1);
    assert.equal(game.totalEnemies, game.kills);
  }
});

test('a defeated boss never respawns while regular enemies remain', () => {
  const game = new DefenseSimulation();
  spawnBoss(game);
  const boss = game.enemies[0];
  game.enemies.push({ ...ROUTE[0], id: 1000, health: 1000, waypoint: 1, burnTime: 0, burnDamage: 0, slowTime: 0 });
  boss.health = 0; game.step(0.05);
  assert.equal(game.status, 'running');
  for (const deadline of [200, 300, 400, 500]) {
    game.elapsed = deadline - 0.05;
    game.step(0.05);
    assert.equal(game.monsterSummonCountdown, null);
    assert.equal(game.enemies.some(enemy => enemy.kind === 'summoned'), false);
    assert.equal(game.totalEnemies, WAVE_ONE.enemies + 1);
  }
  game.enemies[0].health = 0; game.step(0.05);
  assert.equal(game.status, 'cleared');
});
