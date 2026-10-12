import type { DefenseSimulation, Robot } from '../src/game/defense-simulation.ts';
import { createRobotProgram, getMissionNumber } from '../src/game/coding-missions.ts';
import type { RobotKind } from '../src/game/types.ts';
import { ROBOTS } from '../src/game/wave-one.ts';

export function fundRobot(game: DefenseSimulation, kind: RobotKind, count = 1): void {
  for (const part of ROBOTS[kind].recipe) game.elementEnergy[part.kind] += part.amount * count;
}

export function setRobotEnergy(game: DefenseSimulation, kind: RobotKind, count = 1): void {
  for (const part of ROBOTS[kind].recipe) game.elementEnergy[part.kind] = part.amount * count;
}

// Supply already-acquired inventory without introducing an acquisition action in the game.
export function addStoredRobot(game: DefenseSimulation, kind: RobotKind): Robot {
  const config = ROBOTS[kind];
  const robot: Robot = {
    id: Math.min(0, ...game.robots.map(robot => robot.id)) - 1,
    x: -1, y: -1, deployed: false, kind, grade: 1, range: config.range, damage: config.damage,
    cooldown: 0, phaseTimer: 0, burstRemaining: 0, burstProfile: null,
    activeBlock: 'find', attacks: 0, targetId: null,
    serial: game.robots.filter(robot => robot.kind === kind).length + 1,
    deploymentOrder: 0, missionVariant: 0, program: createRobotProgram(kind), code: [],
    missionNumber: getMissionNumber(game.wave), autoAttackActive: false, completedMissions: [],
    missionStatus: 'waiting', missionMessage: '',
  };
  game.robots.push(robot);
  return robot;
}
