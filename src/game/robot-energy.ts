import type { ElementEnergy, RobotKind, RobotState } from './types.ts';
import { ELEMENTS, ROBOTS } from './wave-one.ts';

export function getRobotEnergyCount(energy: ElementEnergy, kind: RobotKind): number {
  return Math.min(...ROBOTS[kind].recipe.map(part => Math.floor(energy[part.kind] / part.amount)));
}

export function getRobotRecipeLabel(kind: RobotKind): string {
  return ROBOTS[kind].recipe.map(part => `${ELEMENTS[part.kind].name} ${part.amount}개`).join(' + ');
}

export function spendRobotEnergy(energy: ElementEnergy, kind: RobotKind): void {
  for (const part of ROBOTS[kind].recipe) energy[part.kind] -= part.amount;
}

export function getRobotDeployCount(robots: readonly RobotState[], kind: RobotKind): number {
  return robots.filter(robot => robot.kind === kind && !robot.deployed).length;
}

export function getTotalDeployCount(robots: readonly RobotState[]): number {
  return robots.filter(robot => !robot.deployed).length;
}
