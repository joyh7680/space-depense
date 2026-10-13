import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, type Enemy } from '../src/game/defense-simulation.ts';
import { getBasicRobotAttack, getCodingMission } from '../src/game/coding-missions.ts';
import { ROBOTS, WAVE_ONE } from '../src/game/wave-one.ts';
import type { RobotKind } from '../src/game/types.ts';
import { fundRobot } from './robot-energy-helpers.ts';

function setup(kind: RobotKind) {
  const game = new DefenseSimulation(() => 0.5);
  game.player = { x: 14, y: 11 };
  game.startWave(); game.spawned = WAVE_ONE.enemies;
  fundRobot(game, kind); game.placeRobot(3, 5, kind);
  const robot = game.robots[0];
  getCodingMission(kind, 1).slots.forEach((slot, index) => game.updateCode(robot.id, index, slot.block));
  robot.activeBlock = 'attack'; robot.phaseTimer = 0;
  return { game, robot };
}
const target = (id: number, x: number, y: number, frozen = false): Enemy => ({
  id, x, y, waypoint: 1, health: 100, burnTime: 0, burnDamage: 0,
  slowTime: frozen ? 100 : 0, ...(frozen ? { slowFactor: 0 } : {}),
});

test('one basic attack leaves a 100 HP monster at 70, 55 or 10 HP with the requested effect duration', () => {
  assert.equal(WAVE_ONE.health, 100);
  for (const [kind, remaining, duration] of [['electric', 70, 0.8], ['ice', 55, 1.2], ['fire', 10, 1.3]] as const) {
    const { game, robot } = setup(kind);
    const victim = target(100, 3, 4);
    game.enemies = [victim];
    const shots = game.step(0);
    if (kind === 'fire') {
      assert.equal(shots.length, 1); assert.equal(shots[0].phase, 'charge');
      assert.equal(shots[0].duration, 0.5); assert.equal(victim.health, 100);
      for (let frame = 0; frame < 9; frame++) game.step(0.05);
      assert.equal(victim.health, 100, 'no damage during the first 0.45 seconds of charging');
      const blast = game.step(0.05);
      assert.equal(blast.length, 1); assert.equal(blast[0].phase, undefined);
      assert.equal(blast[0].duration, duration);
      assert.deepEqual(blast[0].from, blast[0].to);
    } else {
      assert.equal(shots.length, 1); assert.equal(shots[0].duration, duration);
    }
    assert.equal(victim.health, remaining);
    assert.equal(robot.attacks, 1);
    robot.autoAttackActive = false;
    game.step(0.05);
    assert.equal(victim.health, remaining, 'visual duration does not cause repeated damage');
  }
});

test('cryo selects the closest enemy, slows only that target and never chains', () => {
  const { game, robot } = setup('electric');
  const farther = target(100, 3.8, 4), closer = target(101, 3, 4);
  game.enemies = [farther, closer];
  const shots = game.step(0);
  assert.equal(closer.health, 70); assert.equal(farther.health, 100);
  assert.equal(closer.slowTime, 2); assert.equal(closer.slowFactor, 0.7);
  assert.equal(farther.slowTime, 0); assert.equal(robot.targetId, closer.id);
  assert.equal(shots.length, 1); assert.equal(shots[0].chain, undefined);
});

test('thermal pierces all enemies on the full forward beam, excluding enemies behind or beside it', () => {
  const { game } = setup('ice');
  const victims = [target(100, 3, 4.5, true), target(101, 3, 4, true), target(102, 3, 3.2, true),
    target(103, 3.5, 4, true), target(104, 3, 5.5, true), target(105, 3, 3, true)];
  game.enemies = victims;
  const shots = game.step(0);
  assert.deepEqual(victims.map(victim => victim.health), [55, 55, 55, 100, 100, 100]);
  assert.equal(shots.length, 1, 'one beam effect covers every pierced target');
  assert.ok(Math.abs(shots[0].to.y - 3.1) < 1e-9);
  assert.ok(victims.every(victim => victim.slowFactor === 0), 'thermal does not replace existing slowing');
});

test('plasma blast covers the entire robot circle and evaluates moving enemies after charging', () => {
  const { game, robot } = setup('fire');
  assert.equal(getBasicRobotAttack('fire').attackRadius, 150);
  const front = target(100, 3, 4, true), behind = target(101, 3, 6.5, true);
  const outside = target(102, 5, 5, true), entrant = target(103, 7, 5, true);
  game.enemies = [front, behind, outside, entrant];
  const charge = game.step(0);
  assert.equal(charge[0].radius, 150);
  front.x = 8; entrant.x = 4;
  const shots = [];
  for (let frame = 0; frame < 10; frame++) shots.push(...game.step(0.05));
  assert.equal(shots[0].radius, 150);
  assert.deepEqual([front, behind, outside, entrant].map(victim => victim.health), [100, 10, 100, 10]);
  assert.equal(robot.attacks, 1);
});

test('pause freezes plasma charging and resume completes the remaining charge once', () => {
  const { game, robot } = setup('fire'); const victim = target(100, 3, 4, true);
  game.enemies = [victim]; game.step(0);
  for (let frame = 0; frame < 4; frame++) game.step(0.05);
  game.togglePause(); const remaining = robot.phaseTimer;
  for (let frame = 0; frame < 40; frame++) assert.deepEqual(game.step(0.05), []);
  assert.equal(robot.phaseTimer, remaining); assert.equal(victim.health, 100);
  game.togglePause();
  for (let frame = 0; frame < 6; frame++) game.step(0.05);
  assert.equal(victim.health, 10); assert.equal(robot.attacks, 1);
});

test('directional weapons rotate toward targets in every quadrant', () => {
  for (const kind of ['electric', 'ice'] as const) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, -0.7]]) {
    const { game, robot } = setup(kind);
    game.enemies = [target(100, robot.x + dx, robot.y + dy, true)];
    game.step(0);
    assert.equal(robot.aimAngle, Math.atan2(dy, dx));
  }
});

test('all waves keep the same base damage and no thermal or plasma slowing', () => {
  assert.deepEqual([ROBOTS.electric.damage, ROBOTS.ice.damage, ROBOTS.fire.damage], [30, 45, 90]);
  assert.equal(getBasicRobotAttack('ice').slowDuration, 0);
  assert.equal(getBasicRobotAttack('fire').slowDuration, 0);
});
