import type { ElementEnergy, RobotKind, RobotState } from './types.ts';
import { ELEMENTS, MAX_ROBOTS, ROBOT_KINDS, ROBOTS } from './wave-one.ts';

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

export function getAvailableRobotCount(energy: ElementEnergy, robots: readonly RobotState[], kind: RobotKind): number {
  return getRobotDeployCount(robots, kind) + Math.min(getRobotEnergyCount(energy, kind), Math.max(0, MAX_ROBOTS - robots.length));
}

// Choose the largest affordable combination without spending shared ingredients twice.
export function getTotalSummonCount(energy: ElementEnergy, robots: readonly RobotState[]): number {
  const capacity = Math.max(0, MAX_ROBOTS - robots.length);
  const limits = ROBOT_KINDS.map(kind => Math.min(capacity, getRobotEnergyCount(energy, kind)));
  let total = 0;
  for (let fire = 0; fire <= limits[0]; fire++) for (let ice = 0; ice <= limits[1]; ice++) for (let electric = 0; electric <= limits[2]; electric++) {
    const counts = [fire, ice, electric];
    const count = fire + ice + electric;
    if (count > capacity || count <= total) continue;
    const spent: ElementEnergy = { fire: 0, ice: 0, electric: 0 };
    ROBOT_KINDS.forEach((kind, index) => {
      for (const part of ROBOTS[kind].recipe) spent[part.kind] += part.amount * counts[index];
    });
    if (ROBOT_KINDS.every(kind => spent[kind] <= energy[kind])) total = count;
  }
  return getTotalDeployCount(robots) + total;
}
