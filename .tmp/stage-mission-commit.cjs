const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const dir = path.join(root, '.tmp', 'mission-commit-review');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
if (git(['rev-parse', 'HEAD']) !== manifest.base) throw new Error('HEAD changed; recheck scope');
const index = path.join(dir, 'index');
const env = { ...process.env, GIT_INDEX_FILE: index };
git(['read-tree', manifest.base], { env });
const indexContents = {};
const blobs = {};
for (const file of manifest.files) {
  const staged = git(['show', `:${file}`]);
  const baseContent = git(['show', `${manifest.base}:${file}`]);
  if (staged !== baseContent && !['README.md', 'src/game/defense-simulation.ts'].includes(file)) throw new Error(`Unexpected staged edits: ${file}`);
  const content = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  const blob = git(['hash-object', '-w', '--stdin'], { input: content });
  git(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`], { env });
  blobs[file] = blob;
  // Preserve the independently staged robot-limit changes on the two overlapping files.
  let preserved = content;
  if (staged !== baseContent && file === 'README.md') preserved = content.replaceAll('최대 8기', '최대 9기').replaceAll('최대 8대', '최대 9대');
  if (staged !== baseContent && file === 'src/game/defense-simulation.ts') preserved = content.replace('MAX_GRADE, ROBOT_CHARGE_COST', 'MAX_GRADE, MAX_ROBOTS, ROBOT_CHARGE_COST').replace("if (this.robots.length >= 8) return '로봇은 최대 8대까지 소환할 수 있어요.';", 'if (this.robots.length >= MAX_ROBOTS) return `로봇은 최대 ${MAX_ROBOTS}대까지 소환할 수 있어요.`;').replaceAll('this.robotCount < 8', 'this.robotCount < MAX_ROBOTS');
  indexContents[file] = git(['hash-object', '-w', '--stdin'], { input: preserved });
}
fs.writeFileSync(path.join(dir, 'staging.json'), JSON.stringify({ ...manifest, index, blobs, indexContents }, null, 2));
console.log(git(['diff', '--cached', '--stat'], { env }));
git(['diff', '--cached', '--check'], { env });
