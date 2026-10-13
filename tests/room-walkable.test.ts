import { setRobotEnergy } from './robot-energy-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFINE } from '../src/game/room/room-definition.ts';
import { isWalkable } from '../src/game/room/walkable.ts';
import { DefenseSimulation } from '../src/game/defense-simulation.ts';
import { DEPLOY_SLOTS } from '../src/game/wave-one.ts';

test('front and diagonal wall overlays block the floor tiles underneath', () => {
  for (const [row, tiles] of DEFINE.ROOM_FRONT_WALL_TILES.entries()) {
    for (const [x, wall] of tiles.entries()) {
      const y = DEFINE.ROOM_DECO_START_Y + row;
      if (wall) assert.equal(isWalkable(x, y), false, `wall at ${x},${y}`);
    }
  }
});

test('visible floor up to the front wall remains walkable', () => {
  for (let y = 3; y <= 8; y++) {
    for (let x = 2; x <= 13; x++) assert.equal(isWalkable(x, y), true, `floor at ${x},${y}`);
  }
  for (const { x, y } of DEPLOY_SLOTS) assert.equal(isWalkable(x, y), true);
});

test('wall-covered tiles reject robot placement and relocation without consuming energy', () => {
  const game = new DefenseSimulation();
  setRobotEnergy(game, 'fire', 2);
  game.placeRobot(3, 5, 'fire');
  const robot = game.robots[0];
  for (const [row, tiles] of DEFINE.ROOM_FRONT_WALL_TILES.entries()) {
    for (const [x, wall] of tiles.entries()) {
      if (!wall) continue;
      const y = DEFINE.ROOM_DECO_START_Y + row;
      game.placeRobot(x, y, 'fire');
      game.moveRobot(robot.id, x, y);
      assert.equal(game.canMoveRobot(robot.id, x, y), false);
      assert.equal(game.canMovePlayer(x, y), false);
      assert.equal(game.robots.length, 1);
      assert.equal(game.elementEnergy.fire, 3); assert.equal(game.elementEnergy.electric, 2);
      assert.deepEqual({ x: robot.x, y: robot.y }, { x: 3, y: 5 });
    }
  }
});
