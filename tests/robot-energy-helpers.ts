import type { DefenseSimulation } from '../src/game/defense-simulation.ts';
import type { RobotKind } from '../src/game/types.ts';
import { ROBOTS } from '../src/game/wave-one.ts';

export function fundRobot(game: DefenseSimulation, kind: RobotKind, count = 1): void {
  for (const part of ROBOTS[kind].recipe) game.elementEnergy[part.kind] += part.amount * count;
}

export function setRobotEnergy(game: DefenseSimulation, kind: RobotKind, count = 1): void {
  for (const part of ROBOTS[kind].recipe) game.elementEnergy[part.kind] = part.amount * count;
}
