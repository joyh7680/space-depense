import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const isolatedEnv = { ...process.env, GIT_INDEX_FILE: path.resolve('.tmp/robot-charge-commit.index') };
function git(args, env = process.env, input) {
  const result = spawnSync('git', args, { env, input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
const paths = ['README.md', 'src/app.vue', 'src/game/wave-one.ts', 'tests/coding-missions.test.ts', 'tests/defense-simulation.test.ts', 'tests/element-energy.test.ts', 'tests/monster-summon.test.ts'];
const normalize = text => text.replaceAll('\r\n', '\n');
const current = Object.fromEntries(paths.map(file => [file, normalize(readFileSync(file, 'utf8'))]));
const replace = (text, before, after) => text.replaceAll(before, after);
function transform(file, source) {
  let text = normalize(source);
  if (file === 'README.md') return replace(text, '같은 속성 3개마다', '같은 속성 5개마다');
  if (file === 'src/app.vue') return replace(text, "'에너지 3개 → 로봇 자동 소환 → 로봇 버튼에서 코딩'", '`에너지 ${ROBOT_CHARGE_COST}개 → 로봇 자동 소환 → 로봇 버튼에서 코딩`');
  if (file === 'src/game/wave-one.ts') return replace(text, 'export const ROBOT_CHARGE_COST = 3;', 'export const ROBOT_CHARGE_COST = 5;');
  if (file === 'tests/coding-missions.test.ts') {
    text = replace(text, "import type { RobotKind } from '../src/game/types.ts';", "import type { RobotKind } from '../src/game/types.ts';\nimport { ROBOT_CHARGE_COST } from '../src/game/wave-one.ts';");
    text = replace(text, 'game.elementEnergy[kind] += 3;', 'game.elementEnergy[kind] += ROBOT_CHARGE_COST;');
    text = replace(text, 'game.elementEnergy.electric = 3; game.merge();', 'game.elementEnergy.electric = ROBOT_CHARGE_COST; game.merge();');
    return replace(text, 'game.enemies = [enemy(100, 14, 0), enemy(101, 14, 0), enemy(102, 14, 0)]; game.step(0.05);', 'game.enemies = Array.from({ length: ROBOT_CHARGE_COST }, (_, index) => enemy(100 + index, 14, 0)); game.step(0.05);');
  }
  if (file === 'tests/defense-simulation.test.ts') {
    text = replace(text, 'import { DEPLOY_SLOTS, SUMMONED_MONSTER, WAVE_ONE }', 'import { DEPLOY_SLOTS, ROBOT_CHARGE_COST, SUMMONED_MONSTER, WAVE_ONE }');
    text = replace(text, 'game.elementEnergy[kind] += 3;', 'game.elementEnergy[kind] += ROBOT_CHARGE_COST;');
    const oldStart = text.indexOf("test('robots need three matching energy;");
    const oldEnd = text.indexOf("test('invalid placement,", oldStart);
    const newStart = current[file].indexOf("test('robots need five matching energy;");
    const newEnd = current[file].indexOf("test('invalid placement,", newStart);
    if (oldStart < 0 || oldEnd < 0 || newStart < 0 || newEnd < 0) throw new Error('Missing cost test');
    text = text.slice(0, oldStart) + current[file].slice(newStart, newEnd) + text.slice(oldEnd);
    for (const [before, after] of [
      ['game.elementEnergy.fire = 30;', 'game.elementEnergy.fire = 10 * ROBOT_CHARGE_COST;'],
      ['game.elementEnergy.fire, 30)', 'game.elementEnergy.fire, 10 * ROBOT_CHARGE_COST)'],
      ['game.elementEnergy.fire, 27)', 'game.elementEnergy.fire, 9 * ROBOT_CHARGE_COST)'],
      ['game.elementEnergy.fire, 6)', 'game.elementEnergy.fire, 2 * ROBOT_CHARGE_COST)'],
      ['game.elementEnergy.fire, 3)', 'game.elementEnergy.fire, ROBOT_CHARGE_COST)'],
      ['game.elementEnergy.fire = 3;', 'game.elementEnergy.fire = ROBOT_CHARGE_COST;'],
      ['blocked.elementEnergy.fire = 3;', 'blocked.elementEnergy.fire = ROBOT_CHARGE_COST;'],
    ]) {
      // The explicit boundary test above keeps its literal quantities.
      const start = text.indexOf("test('invalid placement,");
      text = text.slice(0, start) + replace(text.slice(start), before, after);
    }
    return text;
  }
  if (file === 'tests/element-energy.test.ts') {
    for (const [before, after] of [
      ['three matching elements', 'five matching elements'],
      ['three matching energies', 'five matching energies'],
      ['third matching energy', 'fifth matching energy'],
      ['const draws = [0.99, 0.99, 0, 0.4, 0, 0];', 'const draws = [0.99, 0.99, 0, 0.4, 0, 0, 0, 0];'],
      ['    { fire: 2, ice: 1, electric: 2 },\n    { fire: 0, ice: 1, electric: 2 },', '    { fire: 2, ice: 1, electric: 2 },\n    { fire: 3, ice: 1, electric: 2 },\n    { fire: 4, ice: 1, electric: 2 },\n    { fire: 0, ice: 1, electric: 2 },'],
      ['the three accumulated fire energies', 'the five accumulated fire energies'],
      ['Array.from({ length: 6 },', 'Array.from({ length: 2 * ROBOT_CHARGE_COST },'],
    ]) text = replace(text, before, after);
    return text;
  }
  if (file === 'tests/monster-summon.test.ts') {
    text = replace(text, 'import { ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE }', 'import { ROBOT_CHARGE_COST, ROBOT_KINDS, SUMMONED_MONSTER, WAVE_ONE }');
    text = replace(text, '    assert.equal(game.elementEnergy[kind], 0);\n    assert.equal(Object.values(game.elementEnergy).reduce((sum, amount) => sum + amount, 0), 0);\n    assert.equal(game.robotCount, 1);\n    assert.equal(game.robots[0].kind, kind);', '    assert.equal(game.elementEnergy[kind], 3);\n    assert.equal(Object.values(game.elementEnergy).reduce((sum, amount) => sum + amount, 0), 3);\n    assert.equal(game.robotCount, 0);');
    text = replace(text, "game.elementEnergy.fire = 3; game.summon('fire');", "game.elementEnergy.fire = ROBOT_CHARGE_COST; game.summon('fire');");
    text = replace(text, 'game.elementEnergy.fire = 24;', 'game.elementEnergy.fire = 8 * ROBOT_CHARGE_COST;');
    text = replace(text, 'game.elementEnergy.fire = 27;', 'game.elementEnergy.fire = 9 * ROBOT_CHARGE_COST;');
    return replace(text, "  assert.equal(game.health, 100); assert.equal(game.elementEnergy.electric, 0);\n  assert.equal(game.robotCount, 1); assert.equal(game.robots[0].kind, 'electric');", '  assert.equal(game.health, 100); assert.equal(game.elementEnergy.electric, 3);\n  assert.equal(game.robotCount, 0);');
  }
  throw new Error(file);
}
git(['read-tree', 'HEAD'], isolatedEnv);
const originalIndexTree = git(['write-tree']).trim();
const indexUpdates = [];
for (const file of paths) {
  const head = git(['show', `HEAD:${file}`]);
  const staged = git(['show', `:${file}`]);
  const target = transform(file, head);
  if (target === normalize(head)) throw new Error(`No change: ${file}`);
  const blob = git(['hash-object', '-w', '--stdin'], process.env, target).trim();
  git(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`], isolatedEnv);
  indexUpdates.push({ file, blob: git(['hash-object', '-w', '--stdin'], process.env, transform(file, staged)).trim() });
}
writeFileSync('.tmp/robot-charge-index-updates.json', JSON.stringify({ originalIndexTree, indexUpdates, oldHead: git(['rev-parse', 'HEAD']).trim() }, null, 2));
git(['diff', '--cached', '--check'], isolatedEnv);
console.log(git(['diff', '--cached', '--stat'], isolatedEnv));
const verification = path.resolve('.tmp/robot-charge-verification');
mkdirSync(verification, { recursive: true });
git(['checkout-index', '--all', `--prefix=${verification.replaceAll('\\', '/')}/`], isolatedEnv);
