import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation, ROUTE, type Enemy } from '../src/game/defense-simulation.ts';
import { ROBOT_CHARGE_COST, ROBOT_KINDS, WAVE_ONE } from '../src/game/wave-one.ts';

const monster = (id: number, health: number): Enemy => ({
  id, x: 5, y: 4, waypoint: 1, health, burnTime: 0, burnDamage: 0, slowTime: 0,
});

test('three matching elements store a waiting robot without deploying it and consume only that element', () => {
  let roll = 0;
  const game = new DefenseSimulation(() => roll);
  game.startWave();
  assert.equal(game.robotCount, 0);

  for (const [index, kind] of ROBOT_KINDS.entries()) {
    roll = (index + 0.5) / ROBOT_KINDS.length;
    game.enemies = [monster(100 + index, 0)];
    game.step(0.05);
    assert.equal(game.elementEnergy[kind], 0);
    assert.equal(game.robotCount, index + 1);
    assert.equal(game.robots.at(-1)!.kind, kind);
    assert.equal(game.robots.at(-1)!.missionStatus, 'waiting');
    assert.equal(game.robots.at(-1)!.deployed, false);
    assert.equal(game.deployedRobots.length, 0);
    assert.equal(game.elementEnergy[kind], 0);
    game.summon(kind);
    assert.equal(game.robotCount, index + 1, 'failed summons do not increase the count');
  }

  const first = game.robots[0];
  game.moveRobot(first.id, 4, 7);
  assert.equal(first.deployed, false, 'moving a stored robot does not deploy it');
  assert.equal(game.canMovePlayer(4, 7), true, 'stored robots do not block room tiles');
  game.selectRobot(first.id);
  assert.equal(first.deployed, true, 'selecting a stored robot deploys it in waiting state');
  assert.equal(first.missionStatus, 'waiting');
  assert.equal(game.deployedRobots.length, 1);
  game.moveRobot(first.id, 4, 7);
  assert.equal(game.robotCount, 3, 'selecting and moving robots does not increase the count');
  assert.equal(new DefenseSimulation().robotCount, 0, 'a new game resets the count');
});

test('player kills independently roll three elements from three equally sized ranges', () => {
  for (const [roll, kind] of [[0, 'fire'], [1 / 3 - 0.001, 'fire'], [1 / 3, 'ice'], [2 / 3 - 0.001, 'ice'], [2 / 3, 'electric'], [0.999, 'electric']] as const) {
    let rolls = 0;
    const game = new DefenseSimulation(() => { rolls++; return roll; });
    game.startWave();
    game.enemies = [monster(100, 14)];
    const shots = game.step(0.05);
    assert.ok(shots.some(shot => shot.player));
    assert.equal(game.kills, 1);
    assert.equal(rolls, 3);
    assert.equal(game.robotCount, 1);
    assert.equal(game.robots[0].kind, kind);
    assert.equal(Object.values(game.elementEnergy).reduce((a, b) => a + b, 0), 0);
    assert.equal(game.credits, 300 + WAVE_ONE.killEnergy);
    game.step(0.05);
    assert.equal(rolls, 3, 'a removed monster must not grant a second reward');
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

test('successive kills can grant electric two plus fire one, then ice one plus fire two', () => {
  const draws = [0.99, 0.99, 0, 0.4, 0, 0];
  let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++]);
  game.startWave();
  game.enemies = [monster(100, 0)];
  game.step(0.05);
  assert.equal(rolls, 3);
  assert.deepEqual(game.elementEnergy, { fire: 1, ice: 0, electric: 2 });
  game.enemies = [monster(101, 0)];
  game.step(0.05);
  assert.equal(game.kills, 2); assert.equal(rolls, 6);
  assert.deepEqual(game.elementEnergy, { fire: 0, ice: 1, electric: 2 });
  assert.equal(game.robotCount, 1);
  assert.equal(game.robots[0].kind, 'fire', 'the three accumulated fire energies charge a robot');
});

test('simultaneous monster deaths each roll three times and preserve energy at the robot limit', () => {
  const draws = [0, 0.4, 0.99, 0, 0, 0.99, 0.4, 0.4, 0.4, 0.99, 0.99, 0.99];
  let rolls = 0;
  const game = new DefenseSimulation(() => draws[rolls++]);
  game.elementEnergy.fire = 8 * ROBOT_CHARGE_COST;
  for (let i = 0; i < 8; i++) game.summon('fire');
  game.startWave();
  game.enemies = Array.from({ length: 4 }, (_, index) => monster(100 + index, 0));
  game.step(0.05);
  assert.equal(game.kills, 4); assert.equal(rolls, 12);
  assert.deepEqual(game.elementEnergy, { fire: 3, ice: 4, electric: 5 });
  game.step(0.05);
  assert.equal(rolls, 12);
});

test('burn deaths award three elements before movement; pause freezes rewards', () => {
  const game = new DefenseSimulation(() => 0.99);
  game.startWave();
  const end = ROUTE.at(-1)!;
  game.enemies = [{ ...monster(100, 0.01), x: end.x + 0.001, y: end.y, waypoint: ROUTE.length - 1, burnTime: 1, burnDamage: 10 }];
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 0); assert.equal(game.elementEnergy.electric, 0);
  game.togglePause(); game.step(0.05);
  assert.equal(game.kills, 1); assert.equal(game.elementEnergy.electric, 0);
  assert.equal(game.robotCount, 1); assert.equal(game.robots[0].kind, 'electric');
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
