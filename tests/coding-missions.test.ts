import { addStoredRobot, fundRobot, setRobotEnergy } from './robot-energy-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, type Enemy } from '../src/game/defense-simulation.ts';
import { getCodingBlock, getCodingMission, isCodingBlock, validateRobotCode, type MissionNumber } from '../src/game/coding-missions.ts';
import type { RobotKind } from '../src/game/types.ts';
import { ROBOT_CHARGE_COST } from '../src/game/wave-one.ts';

const kinds = ['fire', 'ice', 'electric'] as const;
const waves = [1, 2, 3] as const;
function summon(game: DefenseSimulation, kind: RobotKind) {
  fundRobot(game, kind); game.summon(kind);
  return game.robots.at(-1)!;
}
function setup(kind: RobotKind, wave: MissionNumber = 1) {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; game.startWave();
  while (game.wave < wave) nextWave(game);
  summon(game, kind);
  return game;
}
const enemy = (id: number, x: number, health = 1000): Enemy => ({ id, x, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0 });
const advance = (game: DefenseSimulation, frames = 11) => {
  // Isolate supplied targets while keeping normal spawning enabled.
  const ids = new Set(game.enemies.map(enemy => enemy.id));
  return Array.from({ length: frames }, () => {
    const shots = game.step(0.05);
    game.enemies = game.enemies.filter(enemy => ids.has(enemy.id));
    return shots;
  }).flat();
};
function complete(game: DefenseSimulation, id = game.robots[0].id) {
  const robot = game.robots.find(robot => robot.id === id)!;
  const number = robot.missionNumber;
  getCodingMission(robot.kind, number, robot.missionVariant).slots.forEach((slot, index) => game.updateCode(id, index, slot.block));
  return robot.program[number].message;
}
function nextWave(game: DefenseSimulation) {
  game.enemies = []; game.elapsed = 100; game.step(0.05);
  for (const target of game.enemies) target.health = 0;
  game.step(0.05); assert.equal(game.status, 'cleared');
  const canStart = game.wave < 3;
  assert.equal(game.startWave(), canStart);
  if (canStart) {
    assert.equal(game.status, 'ready');
    for (let frame = 0; frame < 60; frame++) game.step(0.05);
    assert.equal(game.status, 'running');
  }
}

test('the first question teaches the wave concept with the matching robot attack', () => {
  const actions = { fire: 'missile', ice: 'cool', electric: 'shock' };
  const controls = { 1: 'find', 2: 'repeat-two', 3: 'in-range' };
  const concepts = { 1: '순차 실행', 2: '반복문', 3: '조건문' };
  const titles = { 1: '기본 미션', 2: '중간 미션', 3: '강화 미션' };
  const messages = new Set<string>();
  for (const wave of waves) for (const kind of kinds) {
    const mission = getCodingMission(kind, wave), code = mission.slots.map(slot => slot.block);
    assert.deepEqual(code, wave === 1 ? [actions[kind]] : [controls[wave], actions[kind]]);
    assert.equal(mission.concept, concepts[wave]); assert.equal(mission.title, titles[wave]);
    assert.deepEqual(mission.slots.map(slot => slot.depth), wave === 1 ? [0] : [0, 1]);
    const result = validateRobotCode(kind, wave, code);
    assert.equal(result.success, true); messages.add(result.message);
    if (code.length > 1) assert.equal(validateRobotCode(kind, wave, code.toReversed()).success, false);
    assert.equal(validateRobotCode(kind, wave, code.map(() => null)).success, false);
    assert.equal(validateRobotCode(kind, wave, [...code, code[1]]).success, false);
    assert.match(mission.effect, /기본 자동 공격/);
  }
  assert.deepEqual([...messages], ['공격 성공! 이 로봇의 기본 자동 공격이 활성화됐어요.']);
});

test('nine robots of the same kind receive distinct questions, answers and palettes in every wave', () => {
  for (const wave of waves) for (const kind of kinds) {
    const game = setup(kind, wave);
    for (let i = 1; i < 9; i++) summon(game, kind);
    const missions = game.robots.map(robot => getCodingMission(kind, wave, robot.missionVariant));
    assert.equal(new Set(missions.map(mission => mission.summary)).size, 9);
    assert.equal(new Set(missions.map(mission => JSON.stringify(mission.slots.map(slot => slot.block)))).size, 9);
    assert.equal(new Set(missions.map(mission => JSON.stringify([...mission.palette].sort()))).size, 9);
    assert.ok(missions.every(mission => mission.concept === missions[0].concept));
    for (const [index, robot] of game.robots.entries()) {
      const mission = missions[index];
      const answer = mission.slots.map(slot => slot.block);
      assert.ok(mission.palette.every(block => isCodingBlock(block) && getCodingBlock(block).label.length > 0));
      assert.equal(validateRobotCode(kind, wave, answer, robot.missionVariant).success, true);
      if (answer.length > 1) assert.equal(validateRobotCode(kind, wave, answer.toReversed(), robot.missionVariant).success, false);
      const previousAnswer = missions[(index + 8) % 9].slots.map(slot => slot.block);
      assert.equal(validateRobotCode(kind, wave, previousAnswer, robot.missionVariant).success, false);
      game.selectRobot(robot.id);
      complete(game, robot.id);
      assert.equal(robot.autoAttackActive, true);
      assert.deepEqual(getCodingMission(kind, wave, robot.missionVariant), mission, 'reselection does not replace the question');
      assert.ok(game.robots.slice(index + 1).every(other => other.code.every(block => block === null)));
    }
  }
});

test('a foreign question block cannot enter a robot answer and a merged replacement gets a fresh question', () => {
  for (const wave of waves) {
    const game = setup('fire', wave), first = game.robots[0], second = summon(game, 'fire');
    const own = getCodingMission(first.kind, wave, first.missionVariant);
    const before = JSON.stringify(first.program);
    const foreign = getCodingMission(second.kind, wave, second.missionVariant).palette.find(block => !own.palette.includes(block))!;
    assert.ok(foreign); game.updateCode(first.id, 0, foreign);
    assert.equal(JSON.stringify(first.program), before);
    const oldVariants = game.robots.map(robot => robot.missionVariant);
    setRobotEnergy(game, 'fire'); game.selectRobot(first.id); game.merge();
    assert.equal(game.robotCount, 1, 'merging does not automatically spend energy');
    addStoredRobot(game, 'fire'); assert.equal(game.deployRobotKind('fire'), true);
    const replacement = game.robots.at(-1)!;
    assert.ok(!oldVariants.includes(replacement.missionVariant));
    assert.equal(replacement.deployed, true);
    assert.equal(game.selectedId, replacement.id);
    assert.equal(replacement.missionStatus, 'waiting');
    assert.ok(replacement.code.every(block => block === null));
  }
});

test('all three kinds can finish each wave independently without reserving one kind', () => {
  for (const wave of waves) {
    const game = setup('fire', wave);
    const robots = [game.robots.at(-1)!, summon(game, 'ice'), summon(game, 'electric')];
    for (const robot of robots) {
      assert.equal(robot.missionNumber, wave); assert.equal(robot.autoAttackActive, false);
      complete(game, robot.id);
      assert.equal(robot.missionNumber, wave); assert.equal(robot.missionStatus, 'completed');
      assert.equal(robot.autoAttackActive, true); assert.deepEqual(robot.completedMissions, [wave]);
    }
  }
});

test('mission completion enables only the selected robot, including robots obtained in later waves', () => {
  for (const wave of waves) for (const kind of kinds) {
    const game = setup(kind, wave), first = game.robots.at(-1)!;
    const second = summon(game, kind), other = summon(game, kinds.find(other => other !== kind)!);
    complete(game, first.id); const third = summon(game, kind);
    for (const robot of [second, third, other]) {
      assert.equal(robot.autoAttackActive, false); assert.equal(robot.missionStatus, 'waiting');
      assert.ok(robot.code.every(block => block === null)); assert.notEqual(robot.program, first.program);
    }
    for (const robot of game.robots) { robot.x = 3; robot.y = 5; }
    game.enemies = [enemy(100, 3)]; advance(game);
    assert.ok(first.attacks > 0);
    assert.ok([second, third, other].every(robot => robot.attacks === 0));
    const before = JSON.stringify(first.program);
    assert.equal(game.updateCode(first.id, 0, null), null); game.runCode(first.id);
    assert.equal(JSON.stringify(first.program), before);
  }
});

test('drafts and errors stay with each robot when selecting the same or a different kind', () => {
  for (const wave of waves) {
    const game = setup('ice', wave), second = game.robots.at(-1)!, first = summon(game, 'ice'), fire = summon(game, 'fire');
    const control = getCodingMission('ice', wave, first.missionVariant).slots[0].block;
    game.updateCode(first.id, 0, 'cool'); game.selectRobot(second.id);
    assert.ok(second.code.every(block => block === null));
    game.updateCode(first.id, 1, control);
    if (wave === 3) game.updateCode(first.id, 2, 'cool');
    assert.equal(first.missionStatus, 'error'); assert.equal(second.missionStatus, 'waiting');
    const fireControl = getCodingMission(fire.kind, wave, fire.missionVariant).slots[0].block; game.updateCode(fire.id, 0, fireControl); game.selectRobot(first.id);
    assert.deepEqual(first.code, wave === 3 ? ['cool', control, 'cool'] : ['cool', control]);
    game.updateCode(first.id, 0, null);
    assert.ok(second.code.every(block => block === null)); assert.equal(fire.code[0], fireControl); assert.ok(fire.code.slice(1).every(block => block === null));
  }
});

test('wave transitions remove completed robots and drafts; new robots need the current mission', () => {
  const game = setup('fire'), fire = game.robots[0], ice = summon(game, 'ice');
  complete(game, fire.id); game.updateCode(ice.id, 0, 'find');
  const oldIds = [fire.id, ice.id];
  for (const wave of [2, 3] as const) {
    nextWave(game);
    assert.equal(game.wave, wave); assert.equal(game.robotCount, 0);
    assert.equal(game.selectedId, null); assert.equal(game.elapsed, 0); assert.equal(game.kills, 0);
    assert.equal(game.monsterSummonCountdown, 100);
    for (const id of oldIds) assert.equal(game.updateCode(id, 0, 'find'), null);
    const fresh = summon(game, 'fire');
    assert.equal(fresh.serial, 1); assert.equal(fresh.missionNumber, wave);
    assert.equal(fresh.autoAttackActive, false); assert.deepEqual(fresh.completedMissions, []);
    assert.ok(fresh.code.every(block => block === null)); assert.ok(!oldIds.includes(fresh.id));
    game.enemies = [enemy(100, fresh.x)];
    assert.equal(advance(game).filter(shot => !shot.player).length, 0);
    complete(game, fresh.id);
    assert.equal(fresh.autoAttackActive, true); assert.deepEqual(fresh.completedMissions, [wave]);
    oldIds.push(fresh.id);
  }
});

test('new robots in later waves wait for a correct answer before attacking', () => {
  for (const wave of [2, 3] as const) for (const kind of kinds) {
    const game = setup(kind, wave), robot = game.robots[0];
    game.updateCode(robot.id, 0, getCodingMission(kind, wave).slots[0].block);
    game.enemies = [enemy(100, 3)]; assert.equal(advance(game).length, 0);
    game.runCode(robot.id);
    assert.equal(robot.missionStatus, 'error'); assert.equal(robot.autoAttackActive, false);
    assert.equal(advance(game, 30).length, 0);
    complete(game); assert.equal(robot.autoAttackActive, true);
  }
});

test('the final correct block automatically activates attacks and completed answers cannot trigger success again', () => {
  for (const kind of kinds) for (const wave of waves) {
    const game = setup(kind, wave), robot = game.robots.at(-1)!;
    const slots = getCodingMission(kind, wave).slots;
    for (const [index, slot] of slots.entries()) {
      assert.equal(game.updateCode(robot.id, index, slot.block), index === slots.length - 1 ? wave : null);
      assert.equal(robot.autoAttackActive, index === slots.length - 1);
    }
    assert.match(robot.missionMessage, /공격 성공!/);
    game.enemies = [enemy(100, 3)]; assert.ok(advance(game).some(shot => !shot.player && shot.kind === kind));
    assert.equal(game.updateCode(robot.id, 0, slots[0].block), null);
  }
});

test('failed missions never activate a waiting robot; swapping the blocks completes it', () => {
  for (const kind of kinds) for (const wave of waves) {
    const game = setup(kind, wave), robot = wave === 1 ? summon(game, kind) : game.robots.at(-1)!;
    const [first, second] = getCodingMission(kind, wave, robot.missionVariant).slots;
    robot.x = 3; robot.y = 5;
    game.updateCode(robot.id, 0, second.block); game.updateCode(robot.id, 1, first.block);
    assert.equal(robot.missionStatus, 'error'); assert.match(robot.missionMessage, /1번째/);
    game.enemies = [enemy(100, 3)]; assert.deepEqual(advance(game), []);
    assert.equal(game.updateCode(robot.id, 0, first.block, 1), wave);
    assert.deepEqual(robot.code, [first.block, second.block]); assert.ok(advance(game).length > 0);
  }
});

test('dragging to an empty slot moves a block and rejects invalid sources', () => {
  const game = setup('ice'), robot = summon(game, 'ice');
  const control = getCodingMission('ice', 1, robot.missionVariant).slots[0].block;
  game.updateCode(robot.id, 0, 'cool'); const before = JSON.stringify(robot.program);
  game.updateCode(robot.id, 1, 'cool', -1); game.updateCode(robot.id, 1, 'find', 0); game.updateCode(robot.id, 1, 'cool', 0.5);
  assert.equal(JSON.stringify(robot.program), before);
  assert.equal(game.updateCode(robot.id, 1, 'cool', 0), null); assert.deepEqual(robot.code, [null, 'cool']);
  assert.equal(robot.autoAttackActive, false); assert.equal(game.updateCode(robot.id, 0, control), 1);
});

function combatSnapshot(kind: RobotKind, wave: MissionNumber) {
  const game = setup(kind, wave), robot = game.robots.at(-1)!;
  const damage = robot.damage, range = robot.range;
  complete(game, robot.id); assert.equal(robot.damage, damage); assert.equal(robot.range, range);
  robot.x = 3; robot.y = 5;
  game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6), enemy(103, 5), enemy(104, 14)];
  const attacksBefore = robot.attacks;
  const shots = advance(game);
  return {
    damage: robot.damage, range: robot.range, attacks: robot.attacks - attacksBefore,
    shots: shots.map(({ from, to, kind, chain }) => ({ from, to, kind, chain })),
    targets: game.enemies.map(({ health, burnDamage, burnTime, slowTime, slowFactor }) => ({ health, burnDamage, burnTime, slowTime, slowFactor })),
  };
}

test('wave two and three success never increases damage, number of shots, splash, burning, cooling or chains', () => {
  for (const kind of kinds) {
    const baseline = combatSnapshot(kind, 1);
    for (const wave of [2, 3] as const) {
      assert.deepEqual(combatSnapshot(kind, wave), baseline);
    }
  }
});

test('basic electricity fires twice and retargets after killing its first target in every wave', () => {
  for (const wave of waves) {
    const game = setup('electric', wave), robot = game.robots.at(-1)!; complete(game, robot.id);
    game.enemies = [enemy(100, 3), enemy(101, 14)];
    assert.equal(advance(game).filter(shot => !shot.chain).length, 2);
    assert.equal(game.enemies[0].health, 1000 - robot.damage * 2); assert.equal(game.enemies[1].health, 1000);
    const retarget = setup('electric', wave), retargetRobot = retarget.robots.at(-1)!;
    complete(retarget, retargetRobot.id);
    retarget.enemies = [enemy(100, 3, 1), enemy(101, 3.4)];
    assert.equal(advance(retarget).filter(shot => !shot.chain).length, 2);
    assert.equal(retargetRobot.targetId, 101);
  }
});

test('every mission attacks a lone boss and ignores dead or out-of-range targets', () => {
  for (const kind of kinds) for (const wave of waves) {
    const game = setup(kind, wave), robot = game.robots.at(-1)!; complete(game, robot.id);
    game.enemies = [{ ...enemy(100, 3), kind: 'summoned' }, enemy(101, 14)];
    assert.ok(advance(game).some(shot => !shot.player && shot.kind === kind));
    assert.ok(game.enemies[0].health < 1000); assert.equal(game.enemies[1].health, 1000);
    const waiting = setup(kind, wave); complete(waiting, waiting.robots.at(-1)!.id);
    waiting.enemies = [enemy(100, 14), enemy(101, 3, 0)];
    assert.deepEqual(advance(waiting), []); assert.equal(waiting.enemies[0].health, 1000);
  }
});

test('hangar deployment opens an independent current wave mission', () => {
  for (const wave of waves) {
    const game = setup('ice', wave), first = game.robots.at(-1)!; complete(game, first.id);
    game.elementEnergy.ice = 0; const owned = game.robotCount;
    game.enemies = Array.from({ length: ROBOT_CHARGE_COST }, (_, index) => enemy(100 + index, 14, 0)); game.step(0.05);
    assert.equal(game.robotCount, owned, 'kills accumulate energy without creating robots');
    assert.equal(game.selectedId, first.id);
    fundRobot(game, 'ice');
    addStoredRobot(game, 'ice'); assert.equal(game.deployRobotKind('ice'), true);
    const added = game.robots.at(-1)!;
    assert.equal(added.deployed, true); assert.equal(added.autoAttackActive, false);
    assert.equal(added.missionNumber, wave); assert.deepEqual(added.completedMissions, []);
    assert.equal(game.selectedId, added.id, 'deployment selects the new coding mission');
    assert.equal(game.robotCount, owned + 1);
    for (const robot of game.robots) { robot.x = 3; robot.y = 5; }
    game.enemies = [enemy(200, 3)]; advance(game, 30);
    assert.ok(first.attacks > 0); assert.equal(added.attacks, 0);
    complete(game, added.id); advance(game, 30); assert.ok(added.attacks > 0);
  }
});

test('paused and finished games cannot edit, deploy or spend energy', () => {
  const game = setup('ice'); complete(game);
  game.enemies = Array.from({ length: ROBOT_CHARGE_COST }, (_, index) => enemy(100 + index, 14, 0)); game.step(0.05);
  const stored = game.robots.at(-1)!;
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    game.status = status; const before = JSON.stringify(game);
    game.step(0.05); game.deployRobot(stored.id); game.selectRobot(stored.id); game.runCode(stored.id); game.updateCode(stored.id, 0, 'cool'); game.summon('ice');
    assert.equal(JSON.stringify(game), before);
  }
});

test('rare boss rewards require a new answer even when that kind already completed its mission', () => {
  for (const kind of kinds) {
    const roll = { fire: 0, ice: 0.4, electric: 0.99 }[kind];
    const rewards = [0, 0.4, 0.99, 0.01, roll]; let index = 0;
    const game = new DefenseSimulation(() => rewards[index++] ?? 0.4);
    game.startWave(); game.player = { x: 14, y: 11 };
    const learned = summon(game, kind); complete(game, learned.id);
    game.enemies = [{ ...enemy(100, 14, 0), kind: 'summoned' }, enemy(101, 14)]; game.step(0.05);
    const added = game.robots.at(-1)!;
    assert.equal(added.kind, kind); assert.equal(added.deployed, true); assert.equal(added.autoAttackActive, false);
    assert.ok(added.code.every(block => block === null)); game.selectRobot(added.id);
    for (const robot of game.robots) { robot.x = 3; robot.y = 5; }
    game.enemies = [enemy(200, 3)]; advance(game, 30);
    assert.ok(learned.attacks > 0); assert.equal(added.attacks, 0);
    complete(game, added.id); advance(game, 30); assert.ok(added.attacks > 0);
  }
});

test('merging retains the selected mission and activation; replacements need a new answer', () => {
  const game = setup('electric'), selected = game.robots[0]; complete(game);
  summon(game, 'electric'); game.selectRobot(selected.id);
  const program = JSON.stringify(selected.program); setRobotEnergy(game, 'electric'); game.merge();
  assert.equal(selected.grade, 2); assert.equal(JSON.stringify(selected.program), program); assert.equal(selected.autoAttackActive, true);
  assert.equal(game.robotCount, 1); addStoredRobot(game, 'electric'); assert.equal(game.deployRobotKind('electric'), true);
  const replacement = game.robots.at(-1)!;
  assert.notEqual(replacement.id, selected.id); assert.equal(replacement.autoAttackActive, false); assert.ok(replacement.code.every(block => block === null));
});

test('invalid blocks cannot mutate a mission and restarting resets all activation and completion', () => {
  const game = setup('ice'), robot = game.robots[0], before = JSON.stringify(game);
  game.updateCode(-1, 0, 'find'); game.updateCode(robot.id, -1, 'cool'); game.updateCode(robot.id, 0.5, 'cool');
  game.updateCode(robot.id, 0, 'missile'); game.updateCode(robot.id, 0, 'in-range'); game.runCode(-1);
  assert.equal(JSON.stringify(game), before);
  complete(game); nextWave(game); summon(game, 'ice'); complete(game);
  const fresh = new DefenseSimulation(); assert.equal(fresh.robotCount, 0);
  const added = summon(fresh, 'ice'); assert.equal(added.missionNumber, 1); assert.equal(added.autoAttackActive, false);
  assert.deepEqual(added.completedMissions, []); assert.ok(added.code.every(block => block === null)); assert.notEqual(added.program, robot.program);
});

test('deployment order sets the requested block counts and includes control blocks in the caps', () => {
  const counts = { 1: [1, 2, 3, 3, 3], 2: [2, 2, 3, 4, 4], 3: [2, 3, 3, 4, 5] };
  for (const wave of waves) for (const kind of kinds) for (let order = 1; order <= 20; order++) {
    const mission = getCodingMission(kind, wave, order - 1);
    assert.equal(mission.slots.length, counts[wave][Math.min(order, 5) - 1]);
    assert.equal(mission.maxBlocks, counts[wave][4]);
    assert.ok(mission.slots.length <= mission.maxBlocks);
    assert.equal(mission.deploymentOrder, order);
    const controls = mission.slots.filter(slot => getCodingBlock(slot.block).category !== 'action');
    assert.equal(controls.length, wave === 1 ? 0 : 1);
    if (wave > 1) {
      assert.equal(getCodingBlock(controls[0].block).category, wave === 2 ? 'loop' : 'condition');
      const controlIndex = mission.slots.indexOf(controls[0]);
      assert.ok(mission.slots.slice(controlIndex + 1).every(slot => slot.depth === 1));
    }
  }
});

test('storage and acquisition order never consume a deployment difficulty step', () => {
  const game = new DefenseSimulation(); game.startWave();
  for (const kind of kinds) addStoredRobot(game, kind);
  assert.equal(game.selectedId, null);
  assert.ok(game.robots.every(robot => robot.deploymentOrder === 0 && robot.code.length === 0));
  const [fire, ice, electric] = game.robots;
  for (const [index, robot] of [electric, fire, ice].entries()) {
    assert.equal(game.deployRobot(robot.id), true);
    assert.equal(robot.deploymentOrder, index + 1);
    assert.equal(robot.code.length, index + 1);
    game.selectRobot(robot.id);
    const before = JSON.stringify(robot.program);
    game.selectRobot(robot.id); game.moveRobot(robot.id, robot.x, robot.y);
    assert.equal(JSON.stringify(robot.program), before);
  }
  complete(game, fire.id); game.selectRobot(electric.id); game.merge();
  nextWave(game);
  const fresh = summon(game, 'ice');
  assert.equal(fresh.deploymentOrder, 1); assert.equal(fresh.code.length, 2);
});

test('merging never reuses a deployment order or changes existing robot difficulty', () => {
  const game = setup('fire'), first = game.robots[0];
  summon(game, 'fire'); const third = summon(game, 'ice');
  game.selectRobot(first.id); game.merge();
  const next = summon(game, 'electric');
  assert.equal(first.deploymentOrder, 1); assert.equal(third.deploymentOrder, 3);
  assert.equal(next.deploymentOrder, 4); assert.equal(next.code.length, 3);
});
