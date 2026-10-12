import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const folder = path.join(root, '.tmp', 'robot-attack-commit');
const index = path.join(folder, 'index');
const manifestPath = path.join(folder, 'manifest.json');
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const scenePath = 'src/game/defense-scene.ts';
const files = ['README.md', 'src/components/robot-coding-panel.vue', 'src/game/coding-missions.ts', 'src/game/defense-simulation.ts', 'src/game/wave-one.ts', 'tests/coding-missions.test.ts', 'tests/defense-simulation.test.ts'];
if (process.argv[2] === 'prepare') {
  fs.mkdirSync(folder, { recursive: true });
  const base = git(['rev-parse', 'HEAD']).trim();
  const patch = git(['diff', '--binary', '--', ...files]);
  fs.writeFileSync(path.join(folder, 'changes.patch'), patch);
  git(['read-tree', 'HEAD'], { env });
  git(['apply', '--cached', '--check', '-'], { env, input: patch });
  git(['apply', '--cached', '-'], { env, input: patch });
  let scene = git(['show', `${base}:${scenePath}`]);
  function replace(before, after) {
    if (!scene.includes(before)) throw new Error(`Missing scene anchor: ${before}`);
    scene = scene.replace(before, after);
  }
  replace("import type { CodingBlockId } from './coding-missions';", "import { getBasicRobotAttack, type CodingBlockId } from './coding-missions';");
  replace('  private units!: Phaser.GameObjects.Graphics;', '  private units!: Phaser.GameObjects.Graphics;\n  private ranges!: Phaser.GameObjects.Graphics;');
  replace('    this.units = this.add.graphics().setDepth(12);', '    this.units = this.add.graphics().setDepth(12);\n    this.ranges = this.add.graphics().setDepth(4);');
  replace('  private drawUnits(): void {\n    this.units.clear();', '  private drawUnits(): void {\n    this.units.clear();\n    this.ranges.clear();');
  replace('      if (robot.id === s.selectedId) {', `      if (robot.id === s.selectedId) {
        if (robot.kind === 'fire') {
          const radius = ROBOTS.fire.range * 100;
          this.ranges.fillStyle(color, 0.06); this.ranges.fillCircle(x, y, radius);
          this.ranges.lineStyle(2, color, 0.4); this.ranges.strokeCircle(x, y, radius);
        }`);
  replace('      const color = shot.player ? 0xb5fff3 : ROBOTS[shot.kind].color;', `      const color = shot.player ? 0xb5fff3 : ROBOTS[shot.kind].color;
      if (!shot.player && !shot.chain && shot.kind !== 'electric') {
        const x = center(shot.to.x), y = center(shot.to.y) - 20;
        const radius = getBasicRobotAttack(shot.kind).splash * 100;
        const pulse = this.add.circle(x, y, radius, color, 0.15).setStrokeStyle(5, color, 0.9).setScale(0.15);
        this.combatEffects.add(pulse);
        this.tweens.add({ targets: pulse, scale: 1, alpha: 0, duration: 350, onComplete: () => pulse.destroy() });
        if (shot.kind === 'ice') {
          const coldPulse = this.add.circle(x, y, radius, 0x88d9ff, 0.08).setStrokeStyle(4, 0x88d9ff, 0.9).setScale(0.1);
          this.combatEffects.add(coldPulse);
          this.tweens.add({ targets: coldPulse, scale: 1, alpha: 0, duration: 450, onComplete: () => coldPulse.destroy() });
        }
      }`);
  const sceneBlob = git(['hash-object', '-w', '--stdin'], { input: scene }).trim();
  git(['update-index', '--cacheinfo', `100644,${sceneBlob},${scenePath}`], { env });
  const entries = { [scenePath]: sceneBlob };
  for (const file of files) entries[file] = git(['hash-object', '-w', '--path', file, file]).trim();
  fs.writeFileSync(manifestPath, JSON.stringify({ base, entries }, null, 2));
  git(['diff', '--cached', '--check'], { env });
  console.log(git(['diff', '--cached', '--stat'], { env }));
  const review = path.join(folder, 'review');
  fs.mkdirSync(review, { recursive: true });
  git(['checkout-index', '--all', `--prefix=${review.replaceAll('\\', '/')}/`], { env });
} else if (process.argv[2] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base) throw new Error('HEAD changed; prepare again before committing.');
  const indexPath = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
  fs.copyFileSync(indexPath, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', 'fix: 근거리 로봇 공격과 플라즈마 원 영역 적용'], { env }));
  for (const [file, blob] of Object.entries(manifest.entries)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit.');
