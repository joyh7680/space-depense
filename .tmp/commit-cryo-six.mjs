import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const folder = path.join(root, '.tmp', 'cryo-six-commit');
fs.mkdirSync(folder, { recursive: true });
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const indexPath = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
const recipeBefore = "[{ kind: 'electric', amount: 3 }, { kind: 'ice', amount: 3 }, { kind: 'fire', amount: 1 }]";
const recipeAfter = "[{ kind: 'electric', amount: 3 }, { kind: 'ice', amount: 2 }, { kind: 'fire', amount: 1 }]";
const replacements = {
  'README.md': [['크라이오 볼트는 전기 3개 + 냉기 3개 + 화염 1개(총 7개', '크라이오 볼트는 전기 3개 + 냉기 2개 + 화염 1개(총 6개']],
  'src/game/wave-one.ts': [['ROBOT_CHARGE_COST = 7', 'ROBOT_CHARGE_COST = 6'], [recipeBefore, recipeAfter]],
  'tests/defense-simulation.test.ts': [['assert.equal(ROBOT_CHARGE_COST, 7);', 'assert.equal(ROBOT_CHARGE_COST, 6);']],
  'tests/element-energy.test.ts': [
    ['exact 7, 9 and 12 energy combinations', 'exact 6, 9 and 12 energy combinations'],
    [recipeBefore, recipeAfter],
    ['assert.equal(getTotalSummonCount(game.elementEnergy, game.robots), 2);', 'assert.equal(getTotalSummonCount(game.elementEnergy, game.robots), 3);'],
    ["assert.equal(getAvailableRobotCount(game.elementEnergy, game.robots, 'electric'), 2);", "assert.equal(getAvailableRobotCount(game.elementEnergy, game.robots, 'electric'), 3);"],
    ['assert.deepEqual(game.elementEnergy, { fire: 1, ice: 0, electric: 5 });', 'assert.deepEqual(game.elementEnergy, { fire: 1, ice: 1, electric: 5 });'],
  ],
};
const transform = (file, text) => {
  for (const [before, after] of replacements[file]) {
    if (!text.includes(before) || text.indexOf(before) !== text.lastIndexOf(before)) throw new Error(`Expected unique anchor in ${file}: ${before}`);
    text = text.replace(before, after);
  }
  return text;
};
if (process.argv[2] === 'prepare') {
  const base = git(['rev-parse', 'HEAD']).trim();
  const previousIndexHash = digest();
  const preserved = {};
  git(['read-tree', 'HEAD'], { env });
  for (const file of Object.keys(replacements)) {
    const selected = transform(file, git(['show', `HEAD:${file}`]));
    const blob = git(['hash-object', '-w', '--stdin'], { input: selected }).trim();
    git(['update-index', '--cacheinfo', `100644,${blob},${file}`], { env });
    preserved[file] = git(['hash-object', '-w', '--stdin'], { input: transform(file, git(['show', `:${file}`])) }).trim();
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ base, previousIndexHash, preserved }, null, 2));
  git(['diff', '--cached', '--check'], { env });
  console.log(git(['diff', '--cached'], { env }));
  for (const file of git(['ls-files', 'src/game', 'tests', 'package.json']).trim().split('\n')) {
    const destination = path.join(folder, 'review', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, git(['show', `:${file}`], { env }));
  }
} else if (process.argv[2] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base || digest() !== manifest.previousIndexHash) throw new Error('HEAD or staged changes changed; prepare again.');
  fs.copyFileSync(indexPath, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', 'fix: 크라이오 볼트 에너지 조합을 총 6개로 조정'], { env }));
  for (const [file, blob] of Object.entries(manifest.preserved)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit');
