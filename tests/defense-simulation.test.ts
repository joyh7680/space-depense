import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefenseSimulation } from '../src/game/defense-simulation.ts';
import { isWalkable } from '../src/game/room/walkable.ts';

test('room boundaries and flipped wall tiles cannot be walked on', () => {
  assert.equal(isWalkable(7, 6), true);
  for (const [x, y] of [[-1, 6], [16, 6], [7, 15], [0, 6], [15, 6], [7, 0], [2.5, 6]]) assert.equal(isWalkable(x, y), false);
});

test('placement preserves credits on invalid tiles, duplicates, and insufficient balance', () => {
  const game = new DefenseSimulation();
  for (const [x, y] of [[0, 6], [2, 7], [8, 4], [4, 9]]) game.placeTurret(x, y);
  assert.equal(game.credits, 300);
  game.placeTurret(4, 6); game.placeTurret(4, 6);
  assert.equal(game.turrets.length, 1); assert.equal(game.credits, 225);
  for (const x of [5, 6, 7, 9]) game.placeTurret(x, 6);
  assert.equal(game.turrets.length, 4); assert.equal(game.credits, 0);
  game.removeTurret(4, 6);
  assert.equal(game.credits, 75); assert.equal(game.turrets.length, 3);
});

test('wave requires a turret; combat locks placement and pause freezes simulation', () => {
  const game = new DefenseSimulation();
  assert.equal(game.startWave(), false);
  game.placeTurret(5, 6);
  assert.equal(game.startWave(), true);
  assert.equal(game.startWave(), false);
  game.placeTurret(6, 6); game.removeTurret(5, 6);
  assert.equal(game.turrets.length, 1);
  game.step(0.05); game.togglePause();
  const snapshot = JSON.stringify(game);
  for (let i = 0; i < 100; i++) game.step(0.05);
  assert.equal(JSON.stringify(game), snapshot);
  game.togglePause(); assert.equal(game.status, 'running');
});

test('successful defense rewards energy and permits the next wave', () => {
  const game = new DefenseSimulation();
  game.placeTurret(3, 6); game.placeTurret(5, 6); game.placeTurret(7, 6);
  game.startWave();
  for (let i = 0; i < 2400 && game.status === 'running'; i++) game.step(0.05);
  assert.equal(game.status, 'cleared'); assert.equal(game.kills, 6);
  assert.equal(game.health, 100); assert.equal(game.credits, 215);
  assert.equal(game.startWave(), true); assert.equal(game.wave, 2);
});

test('undefended route damages the core and eventually ends the game', () => {
  const game = new DefenseSimulation();
  game.placeTurret(14, 4);
  game.startWave();
  for (let i = 0; i < 4000 && game.status === 'running'; i++) game.step(0.05);
  assert.equal(game.health, 40); assert.equal(game.status, 'cleared');
  game.startWave();
  for (let i = 0; i < 4000 && game.status === 'running'; i++) game.step(0.05);
  assert.equal(game.status, 'defeat'); assert.equal(game.health, 0);
  assert.equal(game.startWave(), false);
});

test('independent game instances do not share room state', () => {
  const a = new DefenseSimulation(); const b = new DefenseSimulation();
  a.placeTurret(4, 6); a.startWave();
  assert.equal(b.status, 'ready'); assert.equal(b.credits, 300); assert.equal(b.turrets.length, 0);
});
