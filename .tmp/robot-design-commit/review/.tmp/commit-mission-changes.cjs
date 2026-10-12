const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const dir = path.join(root, '.tmp', 'mission-commit-review');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'staging.json'), 'utf8'));
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
if (git(['rev-parse', 'HEAD']) !== manifest.base) throw new Error('HEAD changed before committing');
fs.copyFileSync(path.resolve(root, git(['rev-parse', '--git-path', 'index'])), path.join(dir, 'original-index-backup'));
const output = git(['commit', '-m', 'feat: 웨이브별 코딩 미션을 기본 자동 공격 활성화로 통일'], { env: { ...process.env, GIT_INDEX_FILE: manifest.index } });
console.log(output);
// Refresh only the committed entries; preserve other staged changes and all working files.
for (const [file, blob] of Object.entries(manifest.indexContents)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
console.log(git(['log', '-1', '--format=%h %s']));
console.log(git(['diff', '--cached', '--stat']));
