import fs from 'node:fs';
for (const file of ['tests/defense-simulation.test.ts', 'tests/coding-missions.test.ts', 'tests/monster-summon.test.ts', 'tests/room-walkable.test.ts']) {
  let code = fs.readFileSync(file, 'utf8');
  code = `import { fundRobot, setRobotEnergy } from './robot-energy-helpers.ts';\n` + code;
  code = code.replaceAll('game.elementEnergy[kind] += ROBOT_CHARGE_COST', 'fundRobot(game, kind)');
  code = code.replace(/(\w+)\.elementEnergy\.(fire|electric|ice) = (?:(\d+) \* )?ROBOT_CHARGE_COST/g, (_, game, kind, count) => `setRobotEnergy(${game}, '${kind}'${count ? ', ' + count : ''})`);
  fs.writeFileSync(file, code);
}
