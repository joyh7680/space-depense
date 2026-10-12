import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, type Enemy } from '../src/game/defense-simulation.ts';
import { getCodingMission, validateRobotCode } from '../src/game/coding-missions.ts';
import type { RobotKind } from '../src/game/types.ts';

const kinds = ['fire', 'ice', 'electric'] as const;
function summon(game: DefenseSimulation, kind: RobotKind) {
  game.elementEnergy[kind] += 3; game.summon(kind);
  return game.robots.at(-1)!;
}
function setup(kind: RobotKind, wave = 1) {
  const game = new DefenseSimulation(() => 0.4);
  game.player = { x: 14, y: 11 }; game.startWave();
  for (let number = 1; number < wave; number++) nextWave(game);
  summon(game, kind);
  return game;
}
const enemy = (id: number, x: number, health = 1000): Enemy => ({ id, x, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0 });
const advance = (game: DefenseSimulation, frames = 11) => {
  // Keep normal spawning enabled, but isolate the supplied targets from new spawns.
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
  getCodingMission(robot.kind, number).slots.forEach((slot, index) => game.updateCode(id, index, slot.block));
  return game.runCode(id);
}
function nextWave(game: DefenseSimulation) {
  game.enemies = []; game.elapsed = 100;
  game.step(0.05);
  for (const target of game.enemies) target.health = 0;
  game.step(0.05);
  assert.equal(game.status, 'cleared');
  const canStart = game.wave < 3;
  assert.equal(game.startWave(), canStart);
}
function upgraded(kind: RobotKind, wave: 2 | 3) {
  const game = setup(kind); complete(game);
  while (game.wave < wave) nextWave(game);
  complete(game);
  return game;
}

test('base missions teach sequence, condition, and two repetitions using the requested blocks', () => {
  const expected = { fire: ['find', 'missile'], ice: ['in-range', 'cool'], electric: ['repeat-two', 'shock'] };
  for (const kind of kinds) {
    assert.deepEqual(getCodingMission(kind, 1).slots.map(slot => slot.block), expected[kind]);
    for (const number of [1, 2, 3]) {
      const mission = getCodingMission(kind, number), code = mission.slots.map(slot => slot.block);
      assert.equal(validateRobotCode(kind, number, code).success, true);
      assert.equal(validateRobotCode(kind, number, [...code, 'missile']).success, false);
      assert.equal(validateRobotCode(kind, number, [...code].reverse()).success, false);
    }
    assert.equal(getCodingMission(kind, 3).slots[3].block, 'else');
  }
});

test('one base completion enables all robots of that kind, including later summons, but not other kinds', () => {
  for (const kind of kinds) {
    const game = setup(kind), first = game.robots[0], second = summon(game, kind);
    const other = summon(game, kinds.find(other => other !== kind)!);
    complete(game, first.id);
    const third = summon(game, kind);
    for (const robot of [first, second, third]) {
      assert.equal(robot.basicCompleted, true);
      assert.equal(robot.missionStatus, 'completed');
      assert.notEqual(robot.code, game.programs[kind][1].code);
    }
    assert.equal(other.basicCompleted, false);
    for (const robot of game.robots) { robot.x = 3; robot.y = 5; }
    game.enemies = [enemy(100, 3)];
    advance(game);
    assert.ok([first, second, third].every(robot => robot.attacks > 0));
    assert.equal(other.attacks, 0);
    const snapshot = JSON.stringify(game.programs[kind]);
    game.updateCode(first.id, 0, null); game.runCode(second.id);
    assert.equal(JSON.stringify(game.programs[kind]), snapshot, 'completed base program is locked');
  }
});

test('basic drafts and errors are shared by kind; changing kinds preserves each draft', () => {
  const game = setup('ice'), first = game.robots[0], second = summon(game, 'ice'), fire = summon(game, 'fire');
  game.updateCode(first.id, 0, 'cool'); game.selectRobot(second.id);
  assert.deepEqual(second.code, ['cool', null]);
  game.updateCode(second.id, 1, 'in-range'); game.runCode(second.id);
  assert.equal(first.missionStatus, 'error'); assert.match(first.missionMessage, /1번째/);
  game.updateCode(fire.id, 0, 'find'); game.selectRobot(first.id);
  assert.deepEqual(first.code, ['cool', 'in-range']);
  game.updateCode(first.id, 0, null);
  assert.deepEqual(second.code, [null, 'in-range']); assert.deepEqual(fire.code, ['find', null]);
});

test('unfinished basics survive wave changes and remain available for kinds first summoned later', () => {
  const game = setup('fire'), first = game.robots[0];
  game.updateCode(first.id, 0, 'find');
  nextWave(game);
  assert.equal(first.missionNumber, 1); assert.deepEqual(first.code, ['find', null]);
  complete(game); assert.equal(first.basicCompleted, true); assert.equal(first.missionNumber, 2);
  const ice = summon(game, 'ice');
  assert.equal(ice.missionNumber, 1); complete(game, ice.id);
  assert.equal(ice.missionNumber, 2); assert.equal(ice.basicCompleted, true);
  nextWave(game);
  const electric = summon(game, 'electric');
  assert.equal(electric.missionNumber, 1); complete(game, electric.id);
  assert.equal(electric.basicCompleted, true); assert.equal(electric.missionNumber, 3);
});

test('wave transitions retain base code, reinforcement code, effects, deployment and automatic attacks', () => {
  const game = setup('fire'), fire = game.robots[0];
  const ice = summon(game, 'ice'); complete(game, fire.id); complete(game, ice.id);
  const positions = game.robots.map(robot => [robot.id, robot.x, robot.y]);
  const base = JSON.stringify(game.programs.fire[1]);
  nextWave(game);
  assert.equal(game.selectedId, null); assert.equal(game.monsterSummonCountdown, 100);
  assert.ok(game.robots.every(robot => robot.basicCompleted));
  game.enemies = [enemy(100, 3)]; assert.ok(advance(game).length > 0);
  complete(game, fire.id);
  const reinforcement = JSON.stringify(game.programs.fire[2]);
  nextWave(game);
  assert.equal(JSON.stringify(game.programs.fire[1]), base);
  assert.equal(JSON.stringify(game.programs.fire[2]), reinforcement);
  assert.deepEqual(fire.enhancements, [2]); assert.deepEqual(game.enhancementChoices, { 2: 'fire', 3: null });
  assert.deepEqual(game.robots.slice(0, 2).map(robot => [robot.id, robot.x, robot.y]), positions);
  assert.equal(game.elapsed, 0); assert.equal(game.spawned, 0); assert.equal(game.kills, 0);
  game.enemies = [enemy(100, 3), enemy(101, 3.5)];
  advance(game, 5); assert.ok(game.enemies[0].health < 1000 - fire.damage, 'W2 enhanced attack remains active in W3');
  complete(game, ice.id);
  assert.deepEqual(game.enhancementChoices, { 2: 'fire', 3: 'ice' });
  assert.deepEqual(fire.enhancements, [2]); assert.deepEqual(ice.enhancements, [3]);
});

test('reinforcements require explicit successful execution and lock only one kind per wave', () => {
  for (const wave of [2, 3] as const) {
    const game = setup('fire'), fire = game.robots[0], ice = summon(game, 'ice');
    complete(game, fire.id); complete(game, ice.id);
    while (game.wave < wave) nextWave(game);
    game.updateCode(fire.id, 0, getCodingMission('fire', wave).slots[0].block);
    game.runCode(fire.id);
    assert.equal(game.enhancementChoices[wave], null);
    assert.equal(fire.missionStatus, 'error');
    game.selectRobot(ice.id); complete(game, ice.id);
    assert.equal(game.enhancementChoices[wave], 'ice');
    assert.equal(fire.missionNumber, 1); assert.equal(ice.missionNumber, wave);
    const code = JSON.stringify(game.programs.fire[wave]);
    game.updateCode(fire.id, 0, getCodingMission('fire', wave).slots[0].block); game.runCode(fire.id);
    assert.equal(JSON.stringify(game.programs.fire[wave]), code, 'another kind cannot claim this reinforcement');
    const second = summon(game, 'ice');
    assert.deepEqual(second.enhancements, [wave]); assert.equal(second.basicCompleted, true);
  }
});

test('editing, incomplete code and failed reinforcement never interrupt basic attacks or cooldowns', () => {
  for (const wave of [2, 3] as const) for (const kind of kinds) {
    const game = setup(kind), robot = game.robots[0]; complete(game);
    while (game.wave < wave) nextWave(game);
    game.updateCode(robot.id, 0, getCodingMission(kind, wave).slots[0].block);
    game.enemies = [enemy(100, 3)];
    assert.ok(advance(game).length > 0);
    const combat = [robot.cooldown, robot.phaseTimer, robot.activeBlock, robot.burstRemaining];
    game.runCode(robot.id);
    assert.equal(robot.missionStatus, 'error'); assert.equal(robot.basicCompleted, true);
    assert.deepEqual([robot.cooldown, robot.phaseTimer, robot.activeBlock, robot.burstRemaining], combat);
    assert.ok(advance(game, 30).length > 0);
    const slots = getCodingMission(kind, wave).slots;
    slots.forEach((slot, i) => game.updateCode(robot.id, i, slot.block));
    assert.equal(game.enhancementChoices[wave], null, 'filling slots alone cannot grant reinforcement');
    game.runCode(robot.id); assert.equal(game.enhancementChoices[wave], kind);
  }
});

test('waiting robots and failed basic code cannot attack even with enemies nearby', () => {
  for (const kind of kinds) {
    const game = setup(kind); game.enemies = [enemy(100, 3), enemy(101, 3.3)];
    assert.deepEqual(advance(game), []);
    game.runCode(game.robots[0].id);
    assert.match(game.robots[0].missionMessage, /빈칸/);
    assert.deepEqual(advance(game), []);
  }
});

test('basic electric loop fires exactly twice and retargets after killing its first target', () => {
  const game = setup('electric'); complete(game);
  game.enemies = [enemy(100, 3), enemy(101, 14)];
  const shots = advance(game);
  assert.equal(shots.filter(shot => !shot.chain).length, 2);
  assert.equal(game.enemies[0].health, 1000 - game.robots[0].damage * 2);
  assert.equal(game.enemies[1].health, 1000);
  assert.equal(game.robots[0].attacks, 2);
  const retarget = setup('electric'); complete(retarget);
  retarget.enemies = [enemy(100, 3, 1), enemy(101, 3.4)];
  assert.equal(advance(retarget).filter(shot => !shot.chain).length, 2);
  assert.equal(retarget.robots[0].targetId, 101);
});

test('all base and enhanced programs attack a lone boss and continue targeting living in-range enemies', () => {
  for (const kind of kinds) for (const wave of [1, 2, 3] as const) {
    const game = wave === 1 ? setup(kind) : upgraded(kind, wave);
    if (wave === 1) complete(game);
    game.enemies = [{ ...enemy(100, 3), kind: 'summoned' }, enemy(101, 14)];
    const shots = advance(game);
    assert.ok(shots.some(shot => shot.kind === kind && !shot.player));
    assert.ok(game.enemies[0].health < 1000);
    assert.equal(game.enemies[1].health, 1000);
  }
});

test('wave two missile condition enlarges splash and damage; lone target uses basic fire', () => {
  const game = upgraded('fire', 2), robot = game.robots[0];
  game.enemies = [enemy(100, 3), enemy(101, 5)];
  assert.equal(advance(game, 5).length, 2);
  assert.equal(game.enemies[0].health, 1000 - robot.damage * 1.35);
  assert.equal(game.enemies[1].health, 1000 - robot.damage * 1.35);
  assert.equal(game.enemies[1].burnDamage, robot.damage * 1.35 * 0.3);
  const single = upgraded('fire', 2); single.enemies = [enemy(100, 3)];
  advance(single, 5); assert.equal(single.enemies[0].health, 1000 - single.robots[0].damage);
});

test('wave two cooling affects a cluster only for an uncooled target; otherwise basic attack', () => {
  const game = upgraded('ice', 2), robot = game.robots[0];
  game.enemies = [enemy(100, 3), enemy(101, 5)];
  assert.equal(advance(game, 5).length, 2);
  assert.ok(game.enemies.every(target => target.slowTime === 3 && target.slowFactor === 0.35));
  assert.equal(game.enemies[0].health, 1000 - robot.damage * 1.15);
  const cooled = upgraded('ice', 2);
  cooled.enemies = [{ ...enemy(100, 3), slowTime: 5, slowFactor: 0.6 }, enemy(101, 5)];
  assert.equal(advance(cooled, 5).length, 1);
  assert.equal(cooled.enemies[0].health, 1000 - cooled.robots[0].damage);
  assert.equal(cooled.enemies[1].slowTime, 0);
});

test('wave two electricity increases chain targets and chain damage while keeping two pulses', () => {
  const game = upgraded('electric', 2), robot = game.robots[0];
  game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)];
  const shots = advance(game);
  assert.equal(shots.filter(shot => !shot.chain).length, 2);
  assert.equal(shots.filter(shot => shot.chain).length, 4);
  assert.equal(game.enemies[1].health, 1000 - robot.damage * 0.75 * 2);
  assert.equal(game.enemies[2].health, 1000 - robot.damage * 0.75 * 2);
});

test('wave three health variable doubles missile damage above 100 and falls back below threshold', () => {
  for (const health of [100, 99]) {
    const game = upgraded('fire', 3), robot = game.robots[0];
    game.enemies = [enemy(100, 3, health)];
    advance(game, 5);
    assert.equal(game.enemies[0].health, health - robot.damage * (health >= 100 ? 2 : 1));
  }
  const game = upgraded('fire', 3), robot = game.robots[0];
  game.enemies = [enemy(100, 3, 120)]; advance(game, 5);
  assert.equal(game.enemies[0].health, 120 - robot.damage * 2);
  robot.cooldown = 0; robot.phaseTimer = 0; robot.activeBlock = 'find';
  advance(game, 5);
  assert.equal(game.enemies[0].burnDamage, robot.damage * 2 * 0.2);
  assert.ok(game.enemies[0].health > 120 - robot.damage * 4 - 10, 'the next attack reevaluates current health and uses basic damage');
});

test('wave three count variable cools all in-range enemies above three; fewer enemies still take basic damage', () => {
  const game = upgraded('ice', 3), robot = game.robots[0];
  game.enemies = [enemy(100, 3), enemy(101, 5), enemy(102, 5.8), enemy(103, 14)];
  const shots = advance(game, 5);
  assert.equal(shots.length, 3);
  assert.ok(game.enemies.slice(0, 3).every(target => target.health === 1000 - robot.damage * 1.4 && target.slowFactor === 0.25 && target.slowTime === 4));
  assert.equal(game.enemies[3].health, 1000);
  const single = upgraded('ice', 3); single.enemies = [enemy(100, 3)];
  assert.equal(advance(single, 5).length, 1);
  assert.equal(single.enemies[0].health, 1000 - single.robots[0].damage); assert.equal(single.enemies[0].slowFactor, 0.6);
});

test('wave three electricity overload fires three pulses and chains to every other in-range target', () => {
  const game = upgraded('electric', 3), robot = game.robots[0];
  game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6), enemy(103, 4)];
  const shots = advance(game, 13);
  assert.equal(shots.filter(shot => !shot.chain).length, 3);
  assert.equal(shots.filter(shot => shot.chain).length, 9);
  assert.equal(game.enemies[0].health, 1000 - robot.damage * 1.25 * 3);
  const single = upgraded('electric', 3); single.enemies = [enemy(100, 3)];
  assert.equal(advance(single, 13).length, 2);
  assert.equal(single.enemies[0].health, 1000 - single.robots[0].damage * 2);
});

test('strong cooling expires without being kept permanently by weaker basic cooling', () => {
  const game = upgraded('ice', 3);
  game.enemies = [enemy(100, 3), enemy(101, 3.3), enemy(102, 3.6)]; advance(game, 5);
  assert.equal(game.enemies[0].slowFactor, 0.25);
  game.enemies = game.enemies.slice(0, 1);
  advance(game, 100);
  assert.equal(game.enemies[0].slowFactor, 0.6, 'after four seconds, the single target returns to the weaker basic cooling');
  assert.ok(game.enemies[0].slowTime > 0);
});

test('base and enhanced programs wait when all enemies are dead or outside range', () => {
  for (const kind of kinds) for (const wave of [1, 2, 3] as const) {
    const game = wave === 1 ? setup(kind) : upgraded(kind, wave);
    if (wave === 1) complete(game);
    game.enemies = [enemy(100, 14), enemy(101, 3, 0)];
    assert.deepEqual(advance(game), []);
    assert.equal(game.enemies.find(enemy => enemy.id === 100)!.health, 1000);
    assert.equal(game.robots[0].attacks, 0);
  }
});

test('shared reinforcement applies to every existing robot and automatically acquired robots after deployment', () => {
  const game = setup('ice'), first = game.robots[0], second = summon(game, 'ice');
  complete(game); nextWave(game); complete(game);
  assert.ok([first, second].every(robot => robot.enhancements.includes(2)));
  game.elementEnergy.ice = 0;
  const owned = game.robotCount;
  game.enemies = [enemy(100, 14, 0), enemy(101, 14, 0), enemy(102, 14, 0)];
  game.step(0.05);
  const stored = game.robots.at(-1)!;
  assert.equal(stored.deployed, false); assert.equal(stored.basicCompleted, true); assert.deepEqual(stored.enhancements, [2]);
  game.selectRobot(stored.id);
  assert.equal(stored.deployed, true); assert.equal(game.robotCount, owned + 1); assert.equal(game.elementEnergy.ice, 0);
  for (const robot of game.robots) { robot.x = 3; robot.y = 5; }
  game.enemies = [enemy(200, 3)]; advance(game, 30);
  assert.ok([first, second, stored].every(robot => robot.attacks > 0));
});

test('paused and finished games cannot edit missions, deploy stored robots or spend energy', () => {
  const game = setup('ice'); complete(game);
  game.enemies = [enemy(100, 14, 0), enemy(101, 14, 0), enemy(102, 14, 0)]; game.step(0.05);
  const stored = game.robots.at(-1)!;
  for (const status of ['paused', 'cleared', 'defeat'] as const) {
    game.status = status; const before = JSON.stringify(game);
    game.step(0.05); game.selectRobot(stored.id); game.runCode(stored.id); game.updateCode(stored.id, 0, 'cool'); game.summon('ice');
    assert.equal(JSON.stringify(game), before);
  }
});

test('invalid inputs do not alter shared programs and new games reset all completion and upgrade choices', () => {
  const game = setup('ice'), robot = game.robots[0], before = JSON.stringify(game);
  game.updateCode(-1, 0, 'in-range'); game.updateCode(robot.id, -1, 'cool'); game.updateCode(robot.id, 0.5, 'cool');
  game.updateCode(robot.id, 0, 'enemy-count'); game.runCode(-1);
  assert.equal(JSON.stringify(game), before);
  complete(game); nextWave(game); complete(game);
  const fresh = new DefenseSimulation();
  assert.equal(fresh.robotCount, 0); assert.deepEqual(fresh.enhancementChoices, { 2: null, 3: null });
  assert.ok(kinds.every(kind => fresh.programs[kind][1].status === 'waiting'));
  assert.notEqual(fresh.programs.ice[1].code, game.programs.ice[1].code);
});
