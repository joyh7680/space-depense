import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, type Enemy } from '../src/game/defense-simulation.ts';
import { getCodingMission, validateRobotCode } from '../src/game/coding-missions.ts';
import type { RobotKind } from '../src/game/types.ts';

function setup(kind: RobotKind, wave = 1) {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; game.startWave(); game.wave = wave; game.spawned = 12;
  game.elementEnergy[kind] = 3; game.summon(kind);
  return game;
}
const enemy = (id: number, x: number): Enemy => ({ id, x, y: 4, waypoint: 1, health: 1000, burnTime: 0, burnDamage: 0, slowTime: 0 });
const advance = (game: DefenseSimulation, frames = 5) => Array.from({ length: frames }, () => game.step(0.05)).flat();
const complete = (game: DefenseSimulation, id = game.robots[0].id) => {
  const robot = game.robots.find(robot => robot.id === id)!;
  getCodingMission(robot.kind, game.wave).slots.forEach((slot, index) => game.updateCode(id, index, slot.block));
  game.runCode(id);
};

test('wave transitions replace every existing draft and completed mission with the next block count', () => {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; game.startWave();
  for (const kind of ['electric', 'ice', 'fire'] as const) {
    game.elementEnergy[kind] = 3; game.summon(kind);
  }
  const ids = game.robots.map(robot => robot.id);
  for (const wave of [1, 2, 3]) {
    assert.equal(game.wave, wave);
    assert.ok(game.robots.every(robot => robot.code.length === wave));
    for (const robot of game.robots) complete(game, robot.id);
    assert.ok(game.robots.every(robot => robot.missionStatus === 'completed'));
    // Clear a real wave, including its timed boss, without waiting through the battle.
    game.spawned = 12; game.enemies = []; game.elapsed = 100;
    game.step(0.05);
    assert.equal(game.enemies[0].kind, 'summoned');
    game.enemies[0].health = 0; game.step(0.05);
    assert.equal(game.status, 'cleared');
    assert.equal(game.startWave(), wave < 3);
    if (wave < 3) {
      assert.equal(game.elapsed, 0); assert.equal(game.spawned, 0); assert.equal(game.kills, 0);
      assert.equal(game.monsterSummonCountdown, 100);
      assert.equal(game.selectedId, null);
      assert.ok(game.robots.every(robot => robot.missionStatus === 'waiting' && robot.code.every(block => block === null)));
      assert.deepEqual(game.robots.slice(0, 3).map(robot => robot.id), ids);
      game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
      game.spawned = 12;
      assert.deepEqual(advance(game), [], 'previous wave completion cannot enable attacks in the next wave');
    }
  }
});

test('every robot uses one, two, and three blocks in waves one, two, and three', () => {
  for (const kind of ['electric', 'ice', 'fire'] as const) {
    const action = { electric: 'chain', ice: 'freeze', fire: 'missile' }[kind];
    for (const wave of [1, 2, 3]) {
      const game = setup(kind, wave), robot = game.robots[0];
      const mission = getCodingMission(kind, wave);
      const blocks = mission.slots.map(slot => slot.block);
      assert.deepEqual(blocks, [...(wave === 3 ? ['enemy-count', 'count-three'] : wave === 2 ? ['in-range'] : []), action]);
      assert.equal(robot.code.length, wave);
      assert.equal(mission.autoRun, wave === 1);
      assert.equal(validateRobotCode(kind, wave, blocks).success, true);
      assert.equal(validateRobotCode(kind, wave, [...blocks, 'chain']).success, false);
      complete(game);
      assert.equal(robot.missionStatus, 'completed');
      game.enemies = [enemy(100, 3)];
      assert.equal(advance(game, 11).length > 0, wave < 3);
      if (wave === 3) {
        game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
        assert.ok(advance(game, 20).length > 0);
      }
    }
  }
});

test('wave one activates only the clicked robot for every kind without running code separately', () => {
  for (const kind of ['electric', 'ice', 'fire'] as const) {
    const game = setup(kind); game.elementEnergy[kind] = 3; game.summon(kind);
    const [first, second] = game.robots;
    game.updateCode(first.id, 0, 'nearby-two');
    assert.equal(first.missionStatus, 'waiting');
    game.updateCode(first.id, 0, getCodingMission(kind, 1).slots[0].block);
    assert.equal(first.missionStatus, 'completed'); assert.equal(second.missionStatus, 'waiting');
    game.enemies = [enemy(100, 3)];
    assert.ok(advance(game).some(shot => shot.kind === kind));
  }
});

test('waves two and three need every block and an explicit code run for every robot', () => {
  for (const wave of [2, 3]) for (const kind of ['electric', 'ice', 'fire'] as const) {
    const game = setup(kind, wave), robot = game.robots[0];
    const slots = getCodingMission(kind, wave).slots;
    slots.slice(0, -1).forEach((slot, index) => game.updateCode(robot.id, index, slot.block));
    game.runCode(robot.id); assert.equal(robot.missionStatus, 'error');
    game.updateCode(robot.id, slots.length - 1, slots.at(-1)!.block);
    assert.equal(robot.missionStatus, 'waiting');
    game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
    assert.deepEqual(advance(game), []);
    game.runCode(robot.id); assert.equal(robot.missionStatus, 'completed');
    assert.ok(advance(game).length > 0);
  }
});

test('waiting robots and failed code cannot attack even with enough enemies nearby', () => {
  for (const kind of ['electric', 'ice', 'fire'] as const) {
    const game = setup(kind); game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
    assert.deepEqual(advance(game), []); assert.equal(game.robots[0].attacks, 0);
    game.runCode(game.robots[0].id);
    assert.equal(game.robots[0].missionStatus, 'error'); assert.match(game.robots[0].missionMessage, /빈칸/);
    assert.deepEqual(advance(game), []);
    assert.ok(game.enemies.every(enemy => enemy.health === 1000));
  }
});

test('incorrect order fails with a useful slot error; correct code enables only that robot', () => {
  const game = setup('ice', 2); game.elementEnergy.ice = 3; game.summon('ice');
  const [first, second] = game.robots;
  (['freeze', 'in-range'] as const).forEach((block, index) => game.updateCode(first.id, index, block));
  game.runCode(first.id); assert.equal(first.missionStatus, 'error'); assert.match(first.missionMessage, /1번째/);
  complete(game, first.id);
  assert.equal(first.missionStatus, 'completed'); assert.equal(second.missionStatus, 'waiting');
  assert.notEqual(first.code, second.code); assert.equal(first.serial, 1); assert.equal(second.serial, 2);
  const snapshot = [...first.code]; game.updateCode(first.id, 0, null); game.runCode(first.id);
  assert.deepEqual(first.code, snapshot); assert.equal(first.missionStatus, 'completed');
});

test('drafts survive selecting other robots and clearing one block does not change another mission', () => {
  const game = setup('fire', 3); game.elementEnergy.fire = 3; game.summon('fire');
  const [a, b] = game.robots;
  game.updateCode(a.id, 0, 'enemy-count'); game.selectRobot(b.id); game.updateCode(b.id, 2, 'missile'); game.selectRobot(a.id);
  assert.deepEqual(a.code, ['enemy-count', null, null]); assert.deepEqual(b.code, [null, null, 'missile']);
  game.updateCode(a.id, 0, null); assert.deepEqual(b.code, [null, null, 'missile']);
});

test('electric attacks one living in-range enemy and chains when another is nearby', () => {
  const game = setup('electric'); complete(game);
  game.enemies = [enemy(100, 3), enemy(101, 14)];
  assert.ok(advance(game, 20).some(shot => shot.kind === 'electric' && !shot.chain));
  assert.ok(game.enemies[0].health < 1000); assert.equal(game.enemies[1].health, 1000);
  game.enemies = [enemy(100, 3), enemy(101, 3.4)];
  const shots = advance(game, 20);
  assert.ok(shots.some(shot => shot.chain)); assert.ok(game.enemies.every(enemy => enemy.health < 1000));
});

test('ice waits outside range, then emits one attack and slows the target', () => {
  const outside = setup('ice'); complete(outside); outside.enemies = [enemy(100, 14)];
  assert.deepEqual(advance(outside, 11), []);
  const game = setup('ice'); complete(game); game.enemies = [enemy(100, 3)];
  const shots = advance(game, 11);
  assert.equal(shots.length, 1); assert.ok(shots.every(shot => shot.kind === 'ice'));
  assert.equal(game.enemies[0].health, 1000 - game.robots[0].damage); assert.ok(game.enemies[0].slowTime > 0);
});

test('fire stores nearby count condition, waits below three, then damages multiple targets', () => {
  const game = setup('fire', 3); complete(game); game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 14)];
  assert.equal(advance(game, 20).length, 0);
  game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
  const shots = advance(game, 20);
  assert.ok(shots.length >= 3); assert.ok(game.enemies.every(enemy => enemy.health < 1000 && enemy.burnTime > 0));
});

test('automatic summons can create two independent missions in one reward batch and keep the remainder', () => {
  let rolls = 0;
  const game = new DefenseSimulation(() => rolls++ < 7 ? 0.4 : 0); game.player = { x: 14, y: 11 }; game.startWave();
  game.enemies = Array.from({ length: 3 }, (_, i) => ({ ...enemy(100 + i, 3), health: 0 }));
  game.step(0.05);
  assert.equal(game.robotCount, 2); assert.equal(game.elementEnergy.ice, 1); assert.equal(game.selectedId, null);
  assert.equal(game.deployedRobots.length, 0);
  assert.deepEqual(game.robots.map(robot => [robot.serial, robot.missionStatus]), [[1, 'waiting'], [2, 'waiting']]);
  const [first, second] = game.robots;
  game.selectRobot(first.id);
  assert.deepEqual(game.deployedRobots.map(robot => robot.id), [first.id], 'selecting from the hangar deploys only that robot');
  assert.equal(first.missionStatus, 'waiting');
  const position = [first.x, first.y];
  game.selectRobot(first.id);
  assert.deepEqual([first.x, first.y], position, 'reselecting a robot keeps its position');
  game.enemies = [enemy(200, 3)];
  assert.deepEqual(advance(game, 11), [], 'selected waiting robots cannot attack');
  game.runCode(first.id);
  assert.equal(first.missionStatus, 'error');
  assert.deepEqual(game.deployedRobots.map(robot => robot.id), [first.id], 'invalid code keeps the selected robot deployed');
  assert.deepEqual(advance(game, 11), [], 'failed coding missions cannot enable attacks');
  complete(game);
  assert.deepEqual(game.deployedRobots.map(robot => robot.id), [first.id]);
  assert.equal(second.missionStatus, 'waiting'); assert.equal(second.deployed, false);
  assert.equal(game.canMovePlayer(first.x, first.y), false);
  game.enemies = [enemy(200, 3)];
  assert.equal(advance(game, 11).length, 1, 'the deployed robot starts its wave one attack behavior');
  game.selectRobot(second.id);
  assert.equal(second.missionStatus, 'waiting');
  complete(game, second.id);
  assert.equal(game.deployedRobots.length, 2);
  assert.notDeepEqual([first.x, first.y], [second.x, second.y]);
  assert.equal(game.robotCount, 2, 'deployment does not change the owned robot count');
  assert.equal(game.elementEnergy.ice, 1, 'deployment does not spend more energy');
});

test('paused and finished games cannot deploy stored robots through selection', () => {
  const game = new DefenseSimulation(() => 0.4); game.startWave();
  game.enemies = Array.from({ length: 3 }, (_, id) => ({ ...enemy(100 + id, 3), health: 0 }));
  game.step(0.05);
  const robot = game.robots[0];
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    game.status = status;
    const before = JSON.stringify(game);
    game.selectRobot(robot.id);
    assert.equal(JSON.stringify(game), before);
  }
});

test('automatic summons retain energy at capacity and never spend it in a paused or ended game', () => {
  const game = new DefenseSimulation(); game.elementEnergy.fire = 30;
  for (let i = 0; i < 8; i++) game.summon('fire');
  game.startWave(); game.step(0.05); assert.equal(game.robotCount, 8); assert.equal(game.elementEnergy.fire, 6);
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    game.status = status; const before = JSON.stringify(game); game.step(0.05); game.runCode(game.robots[0].id); game.updateCode(game.robots[0].id, 0, 'enemy-count');
    assert.equal(JSON.stringify(game), before);
  }
});

test('invalid IDs, indices, and foreign blocks leave mission state unchanged; new games clear drafts', () => {
  const game = setup('ice', 2); const before = JSON.stringify(game.robots);
  game.updateCode(-1, 0, 'in-range'); game.updateCode(game.robots[0].id, -1, 'in-range'); game.updateCode(game.robots[0].id, 0.5, 'freeze'); game.updateCode(game.robots[0].id, 0, 'enemy-count'); game.runCode(-1);
  assert.equal(JSON.stringify(game.robots), before);
  const fresh = new DefenseSimulation(); assert.equal(fresh.robotCount, 0); assert.equal(fresh.selectedId, null);
});
