import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const folder = path.join(root, '.tmp', 'energy-commit');
fs.mkdirSync(folder, { recursive: true });
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const files = ['README.md', 'src/game/wave-one.ts', 'tests/element-energy.test.ts', 'tests/defense-simulation.test.ts'];
const normalize = text => text.replaceAll('\r\n', '\n');
const replace = (text, before, after) => {
  if (!text.includes(before)) throw new Error(`Missing expected text: ${before}`);
  return text.replace(before, after);
};
const working = file => normalize(fs.readFileSync(path.join(root, file), 'utf8'));
const defenseBlock = /test\('hybrid combinations[\s\S]*?(?=test\('invalid placement)/;
const block = working(files[3]).match(defenseBlock)[0];
function transform(file, text) {
  if (file === files[0]) {
    text = replace(text, '크라이오 볼트는 전기 3개 + 냉기 2개(총 5개', '크라이오 볼트는 전기 3개 + 냉기 3개 + 화염 1개(총 7개');
    text = replace(text, '써멀 쇼크는 냉기 4개 + 화염 3개(총 7개', '써멀 쇼크는 냉기 4개 + 화염 3개 + 전기 2개(총 9개');
    return replace(text, '플라즈마는 화염 5개 + 전기 4개(총 9개', '플라즈마는 화염 5개 + 전기 4개 + 냉기 3개(총 12개');
  }
  if (file === files[1]) {
    text = replace(text, 'ROBOT_CHARGE_COST = 5', 'ROBOT_CHARGE_COST = 7');
    for (const kind of ['fire', 'ice', 'electric']) {
      const recipe = working(file).match(new RegExp(`^  ${kind}: .*?(recipe: \\[.*?\\])`, 'm'))[1];
      text = text.replace(new RegExp(`(^  ${kind}: .*?)recipe: \\[.*?\\]`, 'm'), (_, prefix) => prefix + recipe);
    }
    return text;
  }
  if (file === files[3]) return text.replace(defenseBlock, () => block);
  let selected = working(file);
  selected = replace(selected, '[{ ...monster(100, 14), slowTime: 100, slowFactor: 0 }]', '[monster(100, 14)]');
  selected = replace(selected, '[{ ...monster(100, 1000), slowTime: 100, slowFactor: 0 }]', '[monster(100, 1000)]');
  selected = replace(selected, '[{ ...monster(100, 14), slowTime: 100, slowFactor: 0 }]', '[monster(100, 14)]');
  return selected;
}
if (process.argv[2] === 'prepare') {
  const base = git(['rev-parse', 'HEAD']).trim();
  git(['read-tree', 'HEAD'], { env });
  const staged = {};
  for (const file of files) {
    const original = normalize(git(['show', `HEAD:${file}`]));
    const previousIndex = normalize(git(['show', `:${file}`]));
    if (file === files[2] && previousIndex !== original) throw new Error('Energy tests contain staged changes; review first.');
    const selected = transform(file, original);
    const blob = git(['hash-object', '-w', '--stdin'], { input: selected }).trim();
    git(['update-index', '--cacheinfo', `100644,${blob},${file}`], { env });
    staged[file] = git(['hash-object', '-w', '--stdin'], { input: transform(file, previousIndex) }).trim();
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ base, staged }, null, 2));
  git(['diff', '--cached', '--check'], { env });
  console.log(git(['diff', '--cached', '--stat'], { env }));
  fs.writeFileSync(path.join(folder, 'review.patch'), git(['diff', '--cached'], { env }));
  const tracked = git(['ls-files', 'src/game', 'tests', 'package.json']).trim().split('\n');
  for (const file of tracked) {
    const destination = path.join(folder, 'review', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, git(['show', `:${file}`], { env }));
  }
} else if (process.argv[2] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base) throw new Error('HEAD changed; prepare again.');
  const indexPath = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
  fs.copyFileSync(indexPath, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', 'fix: 로봇 에너지 조합을 최종 추천안으로 변경'], { env }));
  for (const [file, blob] of Object.entries(manifest.staged)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit');
