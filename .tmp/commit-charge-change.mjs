import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const data = JSON.parse(readFileSync('.tmp/robot-charge-index-updates.json', 'utf8'));
function git(args, env = process.env) {
  const result = spawnSync('git', args, { env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
if (git(['rev-parse', 'HEAD']).trim() !== data.oldHead) throw new Error('HEAD changed while preparing the commit');
if (git(['write-tree']).trim() !== data.originalIndexTree) throw new Error('Staged changes changed while preparing the commit');
const env = { ...process.env, GIT_INDEX_FILE: path.resolve('.tmp/robot-charge-commit.index') };
console.log(git(['commit', '-m', 'fix: 로봇 소환에 필요한 속성 에너지를 5개로 변경'], env));
for (const { file, blob } of data.indexUpdates) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
console.log(git(['log', '-1', '--oneline']));
console.log(git(['diff', '--cached', '--stat']));
