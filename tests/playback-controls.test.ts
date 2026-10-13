import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, type Enemy } from '../src/game/defense-simulation.ts';
import { fundRobot } from './robot-energy-helpers.ts';
import { getCodingMission } from '../src/game/coding-missions.ts';

function battle() {
  const game = new DefenseSimulation(() => 0);
  game.startWave();
  fundRobot(game, 'fire');
  game.summon('fire');
  const robot = game.robots[0];
  getCodingMission(robot.kind, 1, robot.missionVariant).slots.forEach((slot, index) => game.updateCode(robot.id, index, slot.block));
  return game;
}

test('2x matches twice as many normal frames for movement, attacks and spawning, including the frame cap', () => {
  for (const dt of [1 / 60, 0.05, 0.2]) {
    const normal = battle();
    const fast = battle();
    fast.toggleSpeed();
    for (let frame = 0; frame < 80; frame++) {
      const normalShots = [...normal.step(dt), ...normal.step(dt)];
      assert.deepEqual(fast.step(dt), normalShots);
    }
    assert.equal(fast.elapsed, normal.elapsed);
    assert.equal(fast.spawned, normal.spawned);
    assert.deepEqual(fast.enemies, normal.enemies);
    assert.deepEqual(fast.robots, normal.robots);
    assert.deepEqual(fast.elementEnergy, normal.elementEnergy);
  }
});

test('pause freezes a 2x battle and resumes from the same position and timers', () => {
  const game = battle();
  game.toggleSpeed();
  game.step(0.05);
  game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let frame = 0; frame < 60; frame++) assert.deepEqual(game.step(0.05), []);
  assert.equal(JSON.stringify(game), snapshot);
  game.togglePause();
  const elapsed = game.elapsed;
  game.step(0.05);
  assert.ok(Math.abs(game.elapsed - elapsed - 0.1) < 1e-9);
  game.toggleSpeed();
  const atNormalSpeed = game.elapsed;
  game.step(0.05);
  assert.ok(Math.abs(game.elapsed - atNormalSpeed - 0.05) < 1e-9);
});

test('2x retains energy rewards from both substeps and stops immediately on defeat', () => {
  const game = new DefenseSimulation(() => 0);
  game.startWave();
  game.toggleSpeed();
  const burning = (id: number, health: number): Enemy => ({ ...ROUTE[0], id, health, waypoint: 1, burnTime: 1, burnDamage: 100, slowTime: 0 });
  game.enemies = [burning(100, 4), burning(101, 9)];
  game.step(0.05);
  assert.equal(game.kills, 2);
  assert.equal(game.lastEnergyRewards.fire, 2);
  assert.equal(game.elementEnergy.fire, 2);
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...burning(102, 100), ...end, waypoint: ROUTE.length - 1, burnDamage: 0 }];
  const elapsed = game.elapsed;
  game.step(0.05);
  assert.equal(game.status, 'defeat');
  assert.ok(Math.abs(game.elapsed - elapsed - 0.05) < 1e-9);
});

test('2x accelerates preparation and boss countdowns; a new game starts at 1x', () => {
  const game = new DefenseSimulation();
  game.toggleSpeed();
  for (let frame = 0; frame < 30; frame++) game.step(0.05);
  assert.equal(game.status, 'running');
  assert.equal(game.countdown, 0);
  const normal = new DefenseSimulation();
  normal.startWave();
  const fast = new DefenseSimulation();
  fast.startWave();
  fast.toggleSpeed();
  for (let frame = 0; frame < 100; frame++) {
    normal.step(0.05);
    fast.step(0.05);
  }
  assert.ok(Math.abs(fast.elapsed - normal.elapsed * 2) < 1e-9);
  assert.equal(normal.monsterSummonCountdown! - fast.monsterSummonCountdown!, 5);
  assert.equal(new DefenseSimulation().playbackSpeed, 1);
});
