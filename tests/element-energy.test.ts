import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, type Enemy } from '../src/game/defense-simulation.ts';
import { ROBOT_CHARGE_COST, ROBOT_KINDS, WAVE_ONE } from '../src/game/wave-one.ts';

const monster = (id: number, health: number): Enemy => ({
  id, x: 5, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0,
});

test('five matching elements automatically deploy a waiting robot and consume only that element', () => {
  let roll = 0;
  const game = new DefenseSimulation(() => roll);
  game.startWave();
  assert.equal(game.robotCount, 0);

  for (const [index, kind] of ROBOT_KINDS.entries()) {
    roll = (index + 0.5) / ROBOT_KINDS.length;
    for (let kill = 0; kill < ROBOT_CHARGE_COST; kill++) {
      game.enemies = [monster(100 + index * ROBOT_CHARGE_COST + kill, 0)];
      game.step(0.05);
      if (kill < ROBOT_CHARGE_COST - 1) {
        assert.equal(game.elementEnergy[kind], kill + 1);
        assert.equal(game.robotCount, index, 'a robot needs five matching energies');
      }
    }
    assert.equal(game.elementEnergy[kind], 0);
    assert.equal(game.robotCount, index + 1);
    assert.equal(game.robots.at(-1)!.kind, kind);
    assert.equal(game.robots.at(-1)!.missionStatus, 'waiting');
    assert.equal(game.robots.at(-1)!.deployed, true);
    assert.equal(game.robots.at(-1)!.autoAttackActive, false);
    assert.equal(game.deployedRobots.length, index + 1);
    assert.equal(game.storedRobotCount, 0);
    assert.equal(game.selectedId, null, 'automatic deployment does not open coding selection');
    assert.equal(game.elementEnergy[kind], 0);
    game.summon(kind);
    assert.equal(game.robotCount, index + 1, 'failed summons do not increase the count');
  }

  const first = game.robots[0];
  assert.equal(game.canMovePlayer(first.x, first.y), false, 'automatically deployed robots occupy room tiles');
  game.moveRobot(first.id, 4, 7);
  game.selectRobot(first.id);
  assert.equal(game.selectedId, first.id);
  assert.equal(game.deployRobot(first.id), false, 'hangar clicks cannot duplicate an automatically deployed robot');
  assert.equal(game.storedRobotCount, 0);
  assert.equal(first.missionStatus, 'waiting');
  assert.equal(game.deployedRobots.length, 3);
  assert.equal(game.robotCount, 3, 'selecting and moving robots does not increase the count');
  assert.equal(new DefenseSimulation().robotCount, 0, 'a new game resets the count');
});

test('multiple charged robots deploy immediately and require separate coding missions', () => {
  const game = new DefenseSimulation(() => 0.99);
  game.startWave();
  game.elementEnergy.electric = 2 * ROBOT_CHARGE_COST;
  game.step(0.05);
  const [first, second] = game.robots;
  assert.equal(game.storedRobotCount, 0);
  assert.equal(game.deployedRobots.length, 2);
  assert.equal(game.elementEnergy.electric, 0);
  assert.equal(first.serial, 1); assert.equal(second.serial, 2);
  assert.equal(game.selectedId, null, 'deployment does not open a coding selection');
  assert.equal(first.autoAttackActive, false);
  assert.equal(game.deployRobot(first.id), false);
  assert.equal(game.deployRobot(-1), false);
  assert.equal(game.deployRobot(second.id), false);
  assert.equal(game.storedRobotCount, 0);
  assert.equal(game.robotCount, 2, 'deployed robots still count toward the total limit');
  game.selectRobot(first.id);
  game.updateCode(first.id, 0, 'find'); game.updateCode(first.id, 1, 'shock');
  assert.equal(first.autoAttackActive, true); assert.equal(second.autoAttackActive, false);
  game.selectRobot(second.id); game.selectRobot(first.id);
  assert.equal(game.storedRobotCount, 0);
});

test('automatic placement uses randomness and excludes the route, player and other robots', () => {
  const positions = [];
  for (const roll of [0, 0.99]) {
    const game = new DefenseSimulation(() => roll);
    game.startWave(); game.elementEnergy.fire = 2 * ROBOT_CHARGE_COST; game.step(0.05);
    const [first, second] = game.robots;
    assert.equal(first.deployed, true);
    assert.equal(game.canMoveRobot(first.id, first.x, first.y), true);
    positions.push({ x: first.x, y: first.y });
    assert.equal(second.deployed, true);
    assert.equal(game.canMoveRobot(second.id, second.x, second.y), true);
    assert.notDeepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y });
  }
  assert.notDeepEqual(positions[0], positions[1]);
});

test('automatically deploying nine robots preserves excess energy until capacity is freed', () => {
  const game = new DefenseSimulation(() => 0);
  game.startWave(); game.elementEnergy.fire = 10 * ROBOT_CHARGE_COST; game.step(0.05);
  assert.equal(game.deployedRobots.length, 9); assert.equal(game.elementEnergy.fire, ROBOT_CHARGE_COST);
  const before = game.robots.map(robot => ({ id: robot.id, x: robot.x, y: robot.y }));
  game.step(0.05);
  assert.equal(game.storedRobotCount, 0); assert.equal(game.robotCount, 9);
  assert.equal(game.elementEnergy.fire, ROBOT_CHARGE_COST);
  assert.deepEqual(game.robots.map(robot => ({ id: robot.id, x: robot.x, y: robot.y })), before);
  game.selectRobot(game.robots[0].id); game.merge();
  assert.equal(game.robotCount, 9); assert.equal(game.deployedRobots.length, 9);
  assert.equal(game.elementEnergy.fire, 0);
  assert.equal(game.robots.at(-1)!.autoAttackActive, false);
  game.status = 'cleared'; game.startWave();
  assert.equal(game.storedRobotCount, 0); assert.equal(game.robotCount, 0);
});

test('player kills roll exactly one element from three equally sized ranges', () => {
  for (const [roll, kind] of [[0, 'fire'], [1 / 3 - 0.001, 'fire'], [1 / 3, 'ice'], [2 / 3 - 0.001, 'ice'], [2 / 3, 'electric'], [0.999, 'electric']] as const) {
    let rolls = 0;
    const game = new DefenseSimulation(() => { rolls++; return roll; });
    game.startWave();
    game.enemies = [monster(100, 14)];
    const shots = game.step(0.05);
    assert.ok(shots.some(shot => shot.player));
    assert.equal(game.kills, 1);
    assert.equal(rolls, 1);
    assert.equal(game.robotCount, 0);
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

test('successive kills grant one element each and charge a robot on the fifth matching energy', () => {
  const draws = [0.99, 0.99, 0, 0.4, 0, 0, 0, 0, 0.99];
  let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++]);
  game.startWave();
  const expected = [
    { fire: 0, ice: 0, electric: 1 },
    { fire: 0, ice: 0, electric: 2 },
    { fire: 1, ice: 0, electric: 2 },
    { fire: 1, ice: 1, electric: 2 },
    { fire: 2, ice: 1, electric: 2 },
    { fire: 3, ice: 1, electric: 2 },
    { fire: 4, ice: 1, electric: 2 },
    { fire: 0, ice: 1, electric: 2 },
  ];
  for (const [index, energy] of expected.entries()) {
    game.enemies = [monster(100 + index, 0)];
    game.step(0.05);
    assert.equal(game.kills, index + 1);
    assert.equal(rolls, index + 1 + Number(index === expected.length - 1), 'the fifth matching energy also rolls a deployment position');
    assert.deepEqual(game.elementEnergy, energy);
    assert.equal(game.robotCount, index === expected.length - 1 ? 1 : 0);
  }
  assert.equal(game.robotCount, 1);
  assert.equal(game.robots[0].kind, 'fire', 'the five accumulated fire energies charge a robot');
});

test('simultaneous monster deaths each roll once and preserve energy at the robot limit', () => {
  const draws = [0, 0.4, 0.99, 0.99];
  let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++]);
  game.elementEnergy.fire = 9 * ROBOT_CHARGE_COST;
  for (let i = 0; i < 9; i++) game.summon('fire');
  game.startWave();
  game.enemies = Array.from({ length: 4 }, (_, index) => monster(100 + index, 0));
  game.step(0.05);
  assert.equal(game.kills, 4); assert.equal(rolls, 4);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 2 });
  game.step(0.05);
  assert.equal(rolls, 4);
});

test('element rewards charge the ninth robot and preserve excess energy at the limit', () => {
  const game = new DefenseSimulation(() => 0);
  game.elementEnergy.fire = 8 * ROBOT_CHARGE_COST;
  for (let i = 0; i < 8; i++) game.summon('fire');
  game.startWave();
  game.enemies = Array.from({ length: 2 * ROBOT_CHARGE_COST }, (_, index) => monster(100 + index, 0));
  game.step(0.05);
  assert.equal(game.robotCount, 9);
  assert.equal(game.robots.at(-1)!.deployed, true);
  assert.equal(game.elementEnergy.fire, ROBOT_CHARGE_COST);
});

test('burn deaths award one element before movement; pause freezes rewards', () => {
  const game = new DefenseSimulation(() => 0.99);
  game.startWave();
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...monster(100, 0.01), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, burnTime: 1, burnDamage: 10 }];
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 0); assert.equal(game.elementEnergy.electric, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 1); assert.equal(game.elementEnergy.electric, 1);
  assert.equal(game.robotCount, 0);
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
