import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, type Enemy } from '../src/game/defense-simulation.ts';
import { ROBOTS, ROBOT_KINDS, MAX_ROBOTS, WAVE_ONE } from '../src/game/wave-one.ts';
import { getAvailableRobotCount, getRobotEnergyCount, getRobotDeployCount, getTotalDeployCount, getTotalSummonCount } from '../src/game/robot-energy.ts';
import { addStoredRobot, fundRobot } from './robot-energy-helpers.ts';

const monster = (id: number, health: number): Enemy => ({
  id, x: 5, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0,
});

test('hybrid robots use the requested names and exact 5, 7 and 9 energy combinations', () => {
  assert.equal(ROBOTS.electric.name, '크라이오 볼트');
  assert.deepEqual(ROBOTS.electric.recipe, [{ kind: 'electric', amount: 3 }, { kind: 'ice', amount: 2 }]);
  assert.equal(ROBOTS.ice.name, '써멀 쇼크');
  assert.deepEqual(ROBOTS.ice.recipe, [{ kind: 'ice', amount: 4 }, { kind: 'fire', amount: 3 }]);
  assert.equal(ROBOTS.fire.name, '플라즈마');
  assert.deepEqual(ROBOTS.fire.recipe, [{ kind: 'fire', amount: 5 }, { kind: 'electric', amount: 4 }]);
});

test('deployment consumes one acquired stored robot without spending energy', () => {
  for (const kind of ROBOT_KINDS) {
    const game = new DefenseSimulation(() => 0.99);
    game.startWave();
    const before = { ...game.elementEnergy };
    assert.equal(game.robotCount, 0); assert.equal(game.storedRobotCount, 0);
    assert.deepEqual(game.elementEnergy, before);
    assert.equal(getRobotDeployCount(game.robots, kind), 0);
    assert.equal(game.deployRobotKind(kind), false, 'no energy or stored inventory');
    addStoredRobot(game, kind); addStoredRobot(game, kind);
    assert.equal(getRobotDeployCount(game.robots, kind), 2);
    assert.equal(game.storedRobotCount, 2); assert.deepEqual(game.elementEnergy, before);
    assert.equal(game.deployRobotKind(kind), true);
    const first = game.robots[0];
    assert.equal(first.kind, kind); assert.equal(first.deployed, true);
    assert.equal(first.autoAttackActive, false); assert.equal(first.missionStatus, 'waiting');
    assert.equal(game.selectedId, first.id);
    assert.equal(getRobotDeployCount(game.robots, kind), 1);
    assert.equal(game.deployRobotKind(kind), true);
    const second = game.robots[1];
    assert.notEqual(first.missionVariant, second.missionVariant);
    assert.notDeepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y });
    assert.equal(game.selectedId, second.id); assert.equal(first.serial, 1); assert.equal(second.serial, 2);
    assert.equal(getRobotDeployCount(game.robots, kind), 0);
    assert.equal(game.deployRobotKind(kind), false);
    assert.deepEqual(game.elementEnergy, before);
  }
});

test('a missing primary or secondary energy blocks deployment without changing resources or selection', () => {
  for (const kind of ROBOT_KINDS) for (const missing of ROBOTS[kind].recipe) {
    const game = new DefenseSimulation(); game.startWave(); fundRobot(game, kind);
    game.elementEnergy[missing.kind]--;
    const before = JSON.stringify(game);
    assert.equal(getRobotEnergyCount(game.elementEnergy, kind), 0);
    assert.equal(game.deployRobotKind(kind), false);
    assert.equal(JSON.stringify(game), before);
    game.summon(kind); assert.equal(JSON.stringify(game), before);
  }
});

test('inventory counts only stored robots regardless of available energy combinations', () => {
  const energy = { electric: 6, ice: 4, fire: 3 };
  assert.equal(getRobotEnergyCount(energy, 'electric'), 2);
  assert.equal(getRobotEnergyCount(energy, 'ice'), 1);
  assert.equal(getRobotEnergyCount(energy, 'fire'), 0);
  assert.equal(getTotalDeployCount([]), 0);
  const game = new DefenseSimulation(); game.elementEnergy = energy; game.startWave();
  addStoredRobot(game, 'fire');
  assert.equal(getTotalDeployCount(game.robots), 1);
  assert.equal(game.deployRobotKind('fire'), true);
  assert.deepEqual(game.elementEnergy, energy);
  assert.equal(getRobotDeployCount(game.robots, 'ice'), 0);
  assert.equal(getRobotDeployCount(game.robots, 'electric'), 0);
  assert.equal(getTotalDeployCount(game.robots), 0);
  addStoredRobot(game, 'electric');
  assert.equal(getTotalDeployCount(game.robots), 1);
});

test('random deployment stays on valid free floor and varies with the random draw', () => {
  const positions = [];
  for (const roll of [0, 0.99]) {
    const game = new DefenseSimulation(() => roll); game.startWave(); fundRobot(game, 'fire', 2);
    addStoredRobot(game, 'fire'); addStoredRobot(game, 'fire');
    assert.equal(game.deployRobotKind('fire'), true);
    const first = game.robots[0];
    assert.equal(game.canMoveRobot(first.id, first.x, first.y), true);
    assert.equal(game.canMovePlayer(first.x, first.y), false);
    positions.push({ x: first.x, y: first.y });
    assert.equal(game.deployRobotKind('fire'), true);
    const second = game.robots[1];
    assert.equal(game.canMoveRobot(second.id, second.x, second.y), true);
    assert.notDeepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y });
  }
  assert.notDeepEqual(positions[0], positions[1]);
});

test('the robot limit preserves energy and merging frees capacity without automatic deployment', () => {
  const game = new DefenseSimulation(); game.startWave(); fundRobot(game, 'fire', 10);
  for (let i = 0; i < MAX_ROBOTS; i++) game.summon('fire');
  const energy = { ...game.elementEnergy };
  assert.equal(game.deployRobotKind('fire'), false); assert.deepEqual(game.elementEnergy, energy);
  assert.equal(getRobotDeployCount(game.robots, 'fire'), 0);
  game.selectRobot(game.robots[0].id); game.merge();
  assert.equal(game.robotCount, 8); assert.deepEqual(game.elementEnergy, energy);
  assert.equal(getRobotDeployCount(game.robots, 'fire'), 0);
  addStoredRobot(game, 'fire'); assert.equal(getRobotDeployCount(game.robots, 'fire'), 1);
  assert.equal(game.deployRobotKind('fire'), true); assert.equal(game.robotCount, 9);
  game.status = 'cleared'; game.startWave();
  assert.equal(game.robotCount, 0); assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('paused and finished games never deploy or consume energy', () => {
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    const game = new DefenseSimulation(); fundRobot(game, 'electric'); game.status = status;
    const before = JSON.stringify(game);
    assert.equal(game.deployRobotKind('electric'), false); assert.equal(JSON.stringify(game), before);
  }
});

test('player kills roll exactly one element from three equally sized ranges', () => {
  for (const [roll, kind] of [[0, 'fire'], [1 / 3 - 0.001, 'fire'], [1 / 3, 'ice'], [2 / 3 - 0.001, 'ice'], [2 / 3, 'electric'], [0.999, 'electric']] as const) {
    let rolls = 0;
    const game = new DefenseSimulation(() => { rolls++; return roll; }); game.startWave();
    game.enemies = [monster(100, 14)];
    assert.ok(game.step(0.05).some(shot => shot.player));
    assert.equal(game.kills, 1); assert.equal(rolls, 1); assert.equal(game.robotCount, 0);
    assert.equal(game.elementEnergy[kind], 1);
    assert.equal(Object.values(game.elementEnergy).reduce((a, b) => a + b, 0), 1);
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy);
    game.step(0.05); assert.equal(rolls, 1);
  }
});

test('nonfatal attacks do not award energy or consume random draws', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0; }); game.startWave();
  game.enemies = [monster(100, 1000)]; game.step(0.05);
  assert.equal(game.enemies.find(enemy => enemy.id === 100)!.health, 986);
  assert.equal(game.kills, 0); assert.equal(rolls, 0);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('kills keep accumulating energy and only the chosen robot consumes its recipe', () => {
  const draws = [0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0, 0, 0]; let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++] ?? 0.5); game.startWave();
  for (let i = 0; i < draws.length; i++) {
    game.enemies = [monster(100 + i, 0)]; game.step(0.05);
    assert.equal(game.kills, i + 1);
    assert.equal(game.robotCount, 0);
    assert.equal(Object.values(game.elementEnergy).reduce((a, b) => a + b, 0), i + 1);
  }
  assert.deepEqual(game.elementEnergy, { fire: 6, ice: 0, electric: 4 });
  assert.equal(game.deployRobotKind('fire'), true);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 0, electric: 0 });
  const robot = game.robots[0];
  assert.equal(robot.kind, 'fire'); assert.equal(robot.deployed, true);
  assert.equal(robot.autoAttackActive, false); assert.equal(robot.missionStatus, 'waiting');
  assert.equal(game.selectedId, robot.id); assert.equal(rolls, 11, 'ten rewards and one placement draw');
});

test('burn deaths reward once before movement; pause freezes rewards and escape grants nothing', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => { rolls++; return 0.99; }); game.startWave();
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...monster(100, 0.01), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, burnTime: 1, burnDamage: 10 }];
  game.togglePause(); game.step(0.05); assert.equal(rolls, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(rolls, 1); assert.equal(game.elementEnergy.electric, 1); assert.equal(game.health, 100);
  game.enemies = [{ ...monster(101, 1000), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1 }];
  game.step(0.05); assert.equal(game.escaped, 1); assert.equal(rolls, 1);
  assert.deepEqual(new DefenseSimulation().elementEnergy, { fire: 0, ice: 0, electric: 0 });
});

test('complete recipes wait for selection and manual summons use random valid floor', () => {
  for (const kind of ROBOT_KINDS) {
    const positions = [];
    for (const roll of [0, 0.99]) {
      const game = new DefenseSimulation(() => roll); game.startWave();
      game.player = { x: 14, y: 11 }; fundRobot(game, kind, 2);
      game.step(0.05);
      assert.equal(game.robotCount, 0); assert.equal(game.selectedId, null);
      assert.equal(game.deployRobotKind(kind), true); assert.equal(game.deployRobotKind(kind), true);
      assert.equal(game.robotCount, 2); assert.equal(game.storedRobotCount, 0);
      assert.deepEqual(game.elementEnergy, { fire: 0, ice: 0, electric: 0 });
      assert.equal(game.selectedId, game.robots[1].id);
      for (const [index, robot] of game.robots.entries()) {
        assert.equal(robot.kind, kind); assert.equal(robot.deploymentOrder, index + 1);
        assert.equal(game.canMoveRobot(robot.id, robot.x, robot.y), true);
        assert.equal(robot.autoAttackActive, false); assert.equal(robot.missionStatus, 'waiting');
        assert.ok(robot.code.every(block => block === null));
      }
      assert.notDeepEqual({ x: game.robots[0].x, y: game.robots[0].y }, { x: game.robots[1].x, y: game.robots[1].y });
      positions.push({ x: game.robots[0].x, y: game.robots[0].y });
      game.step(0.05); assert.equal(game.robotCount, 2);
    }
    assert.notDeepEqual(positions[0], positions[1]);
  }
});

test('manual choices and total counts never double spend shared energy and respect capacity', () => {
  const game = new DefenseSimulation(() => 0.5); game.startWave(); game.player = { x: 14, y: 11 };
  game.elementEnergy = { fire: 5, ice: 6, electric: 7 };
  game.togglePause(); game.step(0.05);
  assert.equal(game.robotCount, 0); assert.deepEqual(game.elementEnergy, { fire: 5, ice: 6, electric: 7 });
  assert.equal(game.deployRobotKind('ice'), false);
  game.togglePause(); game.step(0.05);
  assert.equal(game.robotCount, 0);
  assert.equal(getTotalSummonCount(game.elementEnergy, game.robots), 2);
  assert.equal(getAvailableRobotCount(game.elementEnergy, game.robots, 'electric'), 2);
  assert.equal(game.deployRobotKind('ice'), true);
  assert.deepEqual(game.elementEnergy, { fire: 2, ice: 2, electric: 7 });
  assert.equal(game.deployRobotKind('electric'), true);
  assert.deepEqual(game.elementEnergy, { fire: 2, ice: 0, electric: 4 });
  fundRobot(game, 'fire', 9); game.step(0.05);
  assert.equal(game.robotCount, 2);
  for (let index = 2; index < MAX_ROBOTS; index++) assert.equal(game.deployRobotKind('fire'), true);
  const energy = { ...game.elementEnergy }; game.step(0.05);
  assert.deepEqual(game.elementEnergy, energy);
  assert.equal(game.deployRobotKind('fire'), false);
  assert.equal(getTotalSummonCount(game.elementEnergy, game.robots), 0);
  const selected = game.robots.find(robot => robot.kind === 'fire')!; game.selectRobot(selected.id); game.merge();
  assert.equal(game.robotCount, MAX_ROBOTS - 1);
  game.step(0.05); assert.equal(game.robotCount, MAX_ROBOTS - 1);
  assert.equal(game.deployRobotKind('fire'), true);
  assert.equal(game.robotCount, MAX_ROBOTS); assert.equal(game.robots.at(-1)!.deploymentOrder, 10);
  for (const part of ROBOTS.fire.recipe) assert.equal(game.elementEnergy[part.kind], energy[part.kind] - part.amount);
});

test('a manually summoned robot cannot attack until its own mission succeeds', () => {
  const game = new DefenseSimulation(() => 0); game.startWave();
  game.elementEnergy = { fire: 4, electric: 4, ice: 0 };
  game.enemies = [monster(100, 14)]; game.step(0.05);
  assert.equal(game.robotCount, 0); assert.equal(game.deployRobotKind('fire'), true);
  const robot = game.robots[0];
  assert.equal(robot.kind, 'fire'); assert.equal(game.lastEnergyRewards.fire, 1);
  assert.deepEqual(game.elementEnergy, { fire: 0, electric: 0, ice: 0 });
  robot.x = 3; robot.y = 5; game.player = { x: 14, y: 11 };
  game.enemies = [{ ...monster(101, 1000), x: 3 }];
  for (let frame = 0; frame < 20; frame++) assert.equal(game.step(0.05).length, 0);
  assert.equal(robot.attacks, 0);
  game.selectRobot(robot.id); game.updateCode(robot.id, 0, 'missile');
  assert.equal(robot.missionStatus, 'completed'); assert.equal(robot.autoAttackActive, true);
  const shots = Array.from({ length: 20 }, () => game.step(0.05)).flat();
  assert.ok(shots.some(shot => !shot.player && shot.kind === 'fire'));
});
