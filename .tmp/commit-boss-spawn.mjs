import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const folder = path.join(root, '.tmp', 'boss-spawn-commit');
fs.mkdirSync(folder, { recursive: true });
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const indexPath = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
const files = ['README.md', 'src/app.vue', 'src/game/defense-scene.ts', 'src/game/defense-simulation.ts', 'src/game/types.ts', 'src/game/wave-one.ts', 'tests/coding-missions.test.ts', 'tests/continuous-spawn.test.ts', 'tests/defense-simulation.test.ts', 'tests/monster-summon.test.ts'];
const replace = (source, before, after) => {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${before}`);
  return source.replaceAll(before, after);
};
const transform = (file, source) => {
  const working = fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n');
  source = source.replaceAll('\r\n', '\n');
  if (file === 'tests/continuous-spawn.test.ts' || file === 'tests/monster-summon.test.ts') return working;
  if (file === 'README.md') {
    const paragraphs = ['- **다음 웨이브**:', '- 일반 적은 웨이브', '- 보스를 처치하면', '블록 편집은'];
    for (const prefix of paragraphs) {
      const oldLine = source.split('\n').find(line => line.startsWith(prefix));
      const newLine = working.split('\n').find(line => line.startsWith(prefix === '- 보스를 처치하면' ? '- 일반 몬스터를 모두 처치한 뒤' : prefix));
      if (!oldLine || !newLine) throw new Error(`Missing README paragraph ${prefix}`);
      source = replace(source, oldLine, newLine);
    }
    return source;
  }
  source = source.replaceAll('monsterSummonCountdown', 'monsterSummonRemaining');
  if (file === 'src/app.vue') {
    source = replace(source, 'ELEMENTS, ROBOTS, SUMMONED_MONSTER, WAVE_ONE', 'ELEMENTS, ROBOTS, WAVE_ONE');
    source = replace(source, 'monsterSummonRemaining: SUMMONED_MONSTER.summonDelay', 'monsterSummonRemaining: WAVE_ONE.enemies');
    source = replace(source, 'role="timer"', 'role="status"');
    source = replace(source, '보스급 몬스터 자동 출현까지 ${state.monsterSummonRemaining}초', '일반 몬스터 ${state.monsterSummonRemaining}마리를 더 처치하면 보스급 몬스터 출현');
    source = replace(source, '{{ state.monsterSummonRemaining }}s', '{{ state.monsterSummonRemaining }}마리');
  } else if (file === 'src/game/defense-simulation.ts') {
    source = replace(source, 'Math.ceil(Math.max(0, SUMMONED_MONSTER.summonDelay - this.elapsed - 0.000001))', 'Math.max(0, this.regularEnemyCount - this.kills)');
    source = replace(source, "this.bossSpawned || this.elapsed < SUMMONED_MONSTER.summonDelay - 0.000001", "this.bossSpawned || this.spawned < this.regularEnemyCount || this.enemies.some(enemy => enemy.kind !== 'summoned')");
    source = replace(source, '    this.spawnBoss();\n', '');
    source = replace(source, '    this.collectKills();\n    if (this.bossDefeated', '    this.collectKills();\n    this.spawnBoss();\n    if (this.bossDefeated');
  } else if (file === 'src/game/wave-one.ts') {
    source = replace(source, 'const summonDelay = 100;\n', '');
    source = replace(source, 'SUMMONED_MONSTER = { summonDelay,', 'SUMMONED_MONSTER = {');
  } else if (file.startsWith('tests/')) {
    source = source.replaceAll('game.elapsed = SUMMONED_MONSTER.summonDelay; ', '').replaceAll('game.elapsed = 100; ', '')
      .replaceAll('game.monsterSummonRemaining, SUMMONED_MONSTER.summonDelay', 'game.monsterSummonRemaining, game.totalEnemies - 1')
      .replaceAll('game.monsterSummonRemaining, 100', 'game.monsterSummonRemaining, game.totalEnemies - 1');
    if (file === 'tests/defense-simulation.test.ts') {
      source = replace(source, 'ROBOT_CHARGE_COST, SUMMONED_MONSTER, WAVE_ONE', 'ROBOT_CHARGE_COST, WAVE_ONE');
      source = replace(source, '    advance(game, 99.95);', "    for (let frame = 0; frame < 100 * 20 && !game.enemies.some(enemy => enemy.kind === 'summoned'); frame++) game.step(0.05);");
      source = replace(source, 'assert.ok(game.kills > 12);', 'assert.equal(game.kills, WAVE_ONE.enemies);');
      source = replace(source, "    game.step(0.05);\n    assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 1);", "    assert.equal(game.enemies.filter(enemy => enemy.kind === 'summoned').length, 1);");
    }
  }
  return source;
};
if (process.argv[2] === 'prepare') {
  const base = git(['rev-parse', 'HEAD']).trim();
  const previousIndexHash = digest();
  const preserved = {};
  git(['read-tree', 'HEAD'], { env });
  for (const file of files) {
    // The staged prerequisites limit regular spawns to 50/70/90 per wave.
    const selected = transform(file, git(['show', `:${file}`]));
    const blob = git(['hash-object', '-w', '--stdin'], { input: selected }).trim();
    git(['update-index', '--cacheinfo', `100644,${blob},${file}`], { env });
    preserved[file] = blob;
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ base, previousIndexHash, preserved }, null, 2));
  git(['diff', '--cached', '--check'], { env });
  console.log(git(['diff', '--cached', '--stat'], { env }));
  for (const file of git(['ls-files', 'src', 'tests', 'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html']).trim().split('\n')) {
    const destination = path.join(folder, 'review', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, git(['show', `:${file}`], { env }));
  }
} else if (process.argv[2] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base || digest() !== manifest.previousIndexHash) throw new Error('HEAD or staged changes changed; prepare again.');
  fs.copyFileSync(indexPath, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', 'fix: 일반 몬스터 전멸 시 보스 자동 등장'], { env }));
  for (const [file, blob] of Object.entries(manifest.preserved)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit');
