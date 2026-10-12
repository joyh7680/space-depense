import type { ElementEnergy, RobotKind, RobotState } from './types.ts';
import { ELEMENTS, MAX_ROBOTS, ROBOTS } from './wave-one.ts';

export function getRobotEnergyCount(energy: ElementEnergy, kind: RobotKind): number {
  return Math.min(...ROBOTS[kind].recipe.map(part => Math.floor(energy[part.kind] / part.amount)));
}

export function getRobotRecipeLabel(kind: RobotKind): string {
  return ROBOTS[kind].recipe.map(part => `${ELEMENTS[part.kind].name} ${part.amount}개`).join(' + ');
}

export function spendRobotEnergy(energy: ElementEnergy, kind: RobotKind): void {
  for (const part of ROBOTS[kind].recipe) energy[part.kind] -= part.amount;
}

export function getRobotDeployCount(energy: ElementEnergy, robots: readonly RobotState[], kind: RobotKind): number {
  const stored = robots.filter(robot => robot.kind === kind && !robot.deployed).length;
  return Math.min(getRobotEnergyCount(energy, kind), MAX_ROBOTS - robots.length + stored);
}

// Count simultaneous deployments without counting shared energy twice.
export function getTotalDeployCount(energy: ElementEnergy, robots: readonly RobotState[]): number {
  const stored = { fire: 0, ice: 0, electric: 0 };
  for (const robot of robots) if (!robot.deployed) stored[robot.kind]++;
  const free = MAX_ROBOTS - robots.length;
  const limits = { fire: getRobotDeployCount(energy, robots, 'fire'), ice: getRobotDeployCount(energy, robots, 'ice'), electric: getRobotDeployCount(energy, robots, 'electric') };
  let total = 0;
  for (let fire = 0; fire <= limits.fire; fire++) {
    for (let ice = 0; ice <= limits.ice; ice++) {
      for (let electric = 0; electric <= limits.electric; electric++) {
        if (fire * 3 + ice * 2 > energy.fire || ice * 3 + electric * 2 > energy.ice || electric * 3 + fire * 2 > energy.electric) continue;
        if (Math.max(0, fire - stored.fire) + Math.max(0, ice - stored.ice) + Math.max(0, electric - stored.electric) > free) continue;
        total = Math.max(total, fire + ice + electric);
      }
    }
  }
  return total;
}
