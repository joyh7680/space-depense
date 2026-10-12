import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const folder = path.join(root, '.tmp', 'robot-design-commit');
const review = path.join(folder, 'review');
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const normalize = text => text.replaceAll('\r\n', '\n');
const working = file => normalize(fs.readFileSync(path.join(root, file), 'utf8'));
function replace(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Expected one anchor: ${before}`);
  return text.replace(before, after);
}
function transform(file, source) {
  let text = normalize(source);
  if (file === 'README.md') {
    const before = text.split('\n').find(line => line.startsWith('- 로봇: 원본 Spine'));
    const after = working(file).split('\n').find(line => line.startsWith('- 로봇: `public/games/space/robots/`'));
    if (!before || !after) throw new Error('Missing robot documentation');
    return replace(text, before, after);
  }
  if (file === 'src/app.vue') {
    text = replace(text, "import { getAvailableRobotCount, getTotalSummonCount } from './game/robot-energy';", "import { getAvailableRobotCount, getTotalSummonCount } from './game/robot-energy';\nimport { robotPortraitStyle } from './game/robot-visuals';");
    return replace(text, `const robotArt = {
 fire: { backgroundPosition: '-169.8px -435.3px', clipPath: 'inset(0 0 14px 0)' },
 ice: { backgroundPosition: '-95.4px -402.9px' },
 electric: { backgroundPosition: '-453px -428.4px' },
};`, `const robotArt = {
 fire: robotPortraitStyle('fire'),
 ice: robotPortraitStyle('ice'),
 electric: robotPortraitStyle('electric'),
};`);
  }
  if (file === 'src/game/defense-scene.ts') {
    text = replace(text, "import { SPINE_EFFECTS, type SpineEffectKind } from './effects';", "import { SPINE_EFFECTS, type SpineEffectKind } from './effects';\nimport { ROBOT_ART_SCALE, ROBOT_VISUALS, robotAssetUrl } from './robot-visuals';");
    text = replace(text, 'private robotArt = new Map<number, SpineActor>();', 'private robotArt = new Map<number, Phaser.GameObjects.Image>();');
    text = replace(text, "    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);", "    this.load.image('room-tiles', `${base}SPACE_MAP_TILESET.png`);\n    for (const kind of ROBOT_KINDS) {\n      this.load.svg(ROBOT_VISUALS[kind].texture, robotAssetUrl(kind));\n    }");
    text = replace(text, 'const contains = (actor: SpineActor) => {', 'const contains = (actor: SpineActor | Phaser.GameObjects.Image) => {');
    text = replace(text, `        art = this.add.spine(x, y + 24, 'player', 'idle', true).setScale(0.17).setDepth(14);
        art.setSkinByName({ fire: 'volta', ice: 'cloud', electric: 'monitorhead' }[robot.kind]);
        art.skeleton.setSlotsToSetupPose();
        art.updateSize();`, `        art = this.add.image(x, y + 24, ROBOT_VISUALS[robot.kind].texture)
          .setOrigin(0.5, 1).setScale(ROBOT_ART_SCALE).setDepth(14);`);
    return replace(text, 'art.setScale(0.17 *', 'art.setScale(ROBOT_ART_SCALE *');
  }
  // These two files contain only this chat's portrait changes, checked before preparation.
  if (file === 'src/components/robot-coding-panel.vue' || file === 'src/style.css') return working(file);
  throw new Error(`Unknown file: ${file}`);
}
const tracked = ['README.md', 'src/app.vue', 'src/components/robot-coding-panel.vue', 'src/game/defense-scene.ts', 'src/style.css'];
const added = ['src/game/robot-visuals.ts', ...['cryo-bolt', 'thermal-shock', 'plasma'].map(name => `public/games/space/robots/${name}.svg`)];
const manifestPath = path.join(folder, 'manifest.json');
if (process.argv[2] === 'prepare') {
  fs.mkdirSync(review, { recursive: true });
  const base = git(['rev-parse', 'HEAD']).trim();
  git(['read-tree', base], { env });
  const entries = {}, stageEntries = {};
  for (const file of tracked) {
    const contents = transform(file, git(['show', `${base}:${file}`]));
    const staged = transform(file, git(['show', `:${file}`]));
    entries[file] = git(['hash-object', '-w', '--stdin'], { input: contents }).trim();
    stageEntries[file] = git(['hash-object', '-w', '--stdin'], { input: staged }).trim();
  }
  for (const file of added) {
    entries[file] = stageEntries[file] = git(['hash-object', '-w', '--stdin'], { input: working(file) }).trim();
  }
  for (const [file, blob] of Object.entries(entries)) git(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`], { env });
  git(['diff', '--cached', '--check'], { env });
  fs.writeFileSync(path.join(folder, 'review.patch'), git(['diff', '--cached'], { env }));
  fs.writeFileSync(manifestPath, JSON.stringify({ base, entries, stageEntries, originalIndexTree: git(['write-tree']).trim() }, null, 2));
  git(['checkout-index', '--all', '--force', `--prefix=${review.replaceAll('\\', '/')}/`], { env });
  console.log(git(['diff', '--cached', '--stat'], { env }));
  console.log(`Isolated review checkout: ${review}`);
} else if (process.argv[2] === 'restore') {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const parse = output => Object.fromEntries(output.trim().split('\n').filter(Boolean).map(line => {
    const [metadata, file] = line.split('\t');
    return [file, metadata.split(' ')[1]];
  }));
  const current = parse(git(['ls-files', '--stage']));
  const original = parse(git(['ls-files', '--stage'], { env: { ...process.env, GIT_INDEX_FILE: path.join(folder, 'original-index') } }));
  for (const [file, blob] of Object.entries(manifest.stageEntries)) {
    if (current[file] !== original[file] && current[file] !== blob) throw new Error(`Independent staging changed: ${file}`);
    if (git(['rev-parse', `HEAD:${file}`]).trim() !== manifest.entries[file]) throw new Error(`Committed file changed: ${file}`);
  }
  const input = Object.entries(manifest.stageEntries).map(([file, blob]) => `100644 ${blob}\t${file}\n`).join('');
  git(['update-index', '--index-info'], { input });
  console.log('Restored original staging with the committed artwork incorporated.');
} else if (process.argv[2] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base) throw new Error('HEAD changed; prepare again.');
  if (git(['write-tree']).trim() !== manifest.originalIndexTree) throw new Error('Staging changed; prepare again.');
  const index = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
  fs.copyFileSync(index, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', 'feat: 로봇 전용 스프라이트와 밝은 외곽선 없는 디자인 적용'], { env }));
  // Incorporate only the committed artwork changes into the user's original staging.
  for (const [file, blob] of Object.entries(manifest.stageEntries)) git(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit');
