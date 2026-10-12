import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const folder = path.join(root, '.tmp', 'empty-hangar-commit');
const review = path.join(folder, 'review');
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const normalize = text => text.replaceAll('\r\n', '\n');
const replace = (text, before, after) => {
  if (text.split(before).length !== 2) throw new Error(`Expected one anchor: ${before}`);
  return text.replace(before, after);
};
function transform(file, input) {
  let text = normalize(input);
  if (file === 'src/style.css') {
    text = replace(text, '.robot-button:hover,.robot-button.open{filter:brightness(1.15);border-color:#fff0b5}', '.robot-button:hover,.robot-button.open{filter:brightness(1.15);border-color:#fff0b5}\n.robot-button.empty{opacity:.4}\n.robot-button.empty:hover,.robot-button.empty.open{filter:none;border-color:#c9cbb5}');
    return replace(text, '.robot-status-roster{', '.robot-status-hud.empty{opacity:.4}\n.robot-status-hud.empty .robot-status-unit:disabled{opacity:1}\n.robot-status-roster{');
  }
  text = replace(text, 'const summonCount = computed(() => getTotalSummonCount(state.value.elementEnergy, state.value.robots));', `const summonCount = computed(() => getTotalSummonCount(state.value.elementEnergy, state.value.robots));
watch([canDeploy, summonCount], ([deployable, count], [wasDeployable, previousCount]) => {
  if (!deployable) {
    closeSummon();
  } else if (count > 0 && (!wasDeployable || count > previousCount)) {
    void openSummon();
  }
});`);
  text = replace(text, `function summonRobot(kind: RobotKind) {
  if (canDeploy.value && room.value?.deployRobotKind(kind)) { codingRobotId.value = null; closeSummon(); }
}`, `async function summonRobot(kind: RobotKind) {
  if (canDeploy.value && room.value?.deployRobotKind(kind)) {
    codingRobotId.value = null;
    await nextTick();
    summonDialog.value?.focus({ preventScroll: true });
  }
}`);
  text = replace(text, ':class="{ open: summonOpen }"', ':class="{ open: summonOpen, empty: summonCount === 0 }"');
  text = replace(text, 'v-if="canDeploy && state.message"', 'v-if="canDeploy && state.message && !summonOpen"');
  return replace(text, 'class="robot-status-hud" role="dialog"', 'class="robot-status-hud" :class="{ empty: summonCount === 0 }" role="dialog"');
}
const files = ['src/app.vue', 'src/style.css'];
const manifestPath = path.join(folder, 'manifest.json');
if (process.argv[2] === 'prepare') {
  fs.mkdirSync(path.join(review, '.tmp'), { recursive: true });
  const base = git(['rev-parse', 'HEAD']).trim();
  git(['read-tree', base], { env });
  const entries = {}, stageEntries = {}, originalEntries = {};
  for (const file of files) {
    entries[file] = git(['hash-object', '-w', '--stdin'], { input: transform(file, git(['show', `${base}:${file}`])) }).trim();
    originalEntries[file] = git(['rev-parse', `:${file}`]).trim();
    stageEntries[file] = git(['hash-object', '-w', '--stdin'], { input: transform(file, git(['show', `:${file}`])) }).trim();
    git(['update-index', '--cacheinfo', `100644,${entries[file]},${file}`], { env });
  }
  git(['diff', '--cached', '--check'], { env });
  fs.writeFileSync(path.join(folder, 'review.patch'), git(['diff', '--cached'], { env }));
  fs.writeFileSync(manifestPath, JSON.stringify({ base, entries, stageEntries, originalEntries }, null, 2));
  git(['checkout-index', '--all', '--force', `--prefix=${review.replaceAll('\\', '/')}/`], { env });
  console.log(git(['diff', '--cached', '--stat'], { env }));
} else if (process.argv[2] === 'commit' || process.argv[2] === 'restore') {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const file of files) {
    const current = git(['rev-parse', `:${file}`]).trim();
    if (current !== manifest.originalEntries[file] && current !== manifest.stageEntries[file]) throw new Error(`Independent staging changed: ${file}`);
  }
  if (process.argv[2] === 'commit') {
    if (git(['rev-parse', 'HEAD']).trim() !== manifest.base) throw new Error('HEAD changed; prepare again.');
    fs.copyFileSync(path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim()), path.join(folder, 'original-index'));
    console.log(git(['commit', '-m', 'fix: 소환 0대에서도 희미한 로봇 배치 모달 열기'], { env }));
  } else {
    for (const file of files)
      if (git(['rev-parse', `HEAD:${file}`]).trim() !== manifest.entries[file]) throw new Error(`Committed file changed: ${file}`);
  }
  git(['update-index', '--index-info'], { input: files.map(file => `100644 ${manifest.stageEntries[file]}\t${file}\n`).join('') });
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare, commit or restore');
