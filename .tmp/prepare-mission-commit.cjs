const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const base = git('rev-parse', 'HEAD').trim();
const dir = path.join(root, '.tmp', 'mission-commit-review');
const head = file => git('show', `${base}:${file}`);
const current = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const save = (file, content) => { const target = path.join(dir, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); };
const replace = (s, a, b) => { if (!s.includes(a)) throw new Error(`Missing: ${a}`); return s.replace(a, b); };
const files = ['README.md', 'src/app.vue', 'src/components/robot-coding-panel.vue', 'src/components/victory-result.vue', 'src/game/coding-missions.ts', 'src/game/defense-scene.ts', 'src/game/defense-simulation.ts', 'src/game/types.ts', 'tests/coding-missions.test.ts'];
for (const file of git('ls-tree', '-r', '--name-only', base, 'src', 'tests', 'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html').trim().split('\n')) save(file, head(file));
save('src/game/coding-missions.ts', current('src/game/coding-missions.ts'));

let s = current('src/game/defense-simulation.ts');
s = replace(s, 'MAX_GRADE, MAX_ROBOTS,', 'MAX_GRADE,');
s = replace(s, 'if (this.robots.length >= MAX_ROBOTS) return `로봇은 최대 ${MAX_ROBOTS}대까지 소환할 수 있어요.`;', "if (this.robots.length >= 8) return '로봇은 최대 8대까지 소환할 수 있어요.';");
s = s.replaceAll('this.robotCount < MAX_ROBOTS', 'this.robotCount < 8');
const waveBlock = head('src/game/defense-simulation.ts').match(/  startWave\(\): boolean \{[\s\S]*?(?=  togglePause\(\))/)[0];
s = s.replace(/  startWave\(\): boolean \{[\s\S]*?(?=  togglePause\(\))/, waveBlock);
save('src/game/defense-simulation.ts', s);
save('src/game/types.ts', current('src/game/types.ts').replace('  victoryAnimationComplete: boolean;\n', ''));

s = head('src/app.vue').replace('enhancementChoices: { 2: null, 3: null }, ', '').replace(' :enhancement-choices="state.enhancementChoices"', '');
s = replace(s, '@change="(slot, block) => room?.updateCode(codingRobot!.id, slot, block)" @run="room?.runCode(codingRobot.id)"', '@change="(slot, block, sourceSlot) => room?.updateCode(codingRobot!.id, slot, block, sourceSlot)"');
save('src/app.vue', s);

s = head('src/game/defense-scene.ts').replaceAll('basicCompleted', 'autoAttackActive').replace('enhancementChoices: { ...s.enhancementChoices }, ', '').replace('({ cooldown, phaseTimer, burstRemaining, burstProfile, ...robot })', '({ program, cooldown, phaseTimer, burstRemaining, burstProfile, ...robot })').replace('enhancements: [...robot.enhancements]', 'completedMissions: [...robot.completedMissions]');
s = replace(s, '이번 웨이브에 강화할 종류를 선택하세요.', '이번 웨이브 미션을 풀 로봇을 선택하세요.');
s = s.replaceAll('기본 미션을 완료', '이번 웨이브 미션을 완료');
s = replace(s, 'updateCode(id: number, slot: number, block: CodingBlockId | null): void {\n    this.simulation.updateCode(id, slot, block); this.publish();', 'updateCode(id: number, slot: number, block: CodingBlockId | null, sourceSlot?: number): void {\n    const completedMission = this.simulation.updateCode(id, slot, block, sourceSlot);\n    if (completedMission) this.notice = this.simulation.robots.find(robot => robot.id === id)!.program[completedMission].message;\n    this.publish();');
save('src/game/defense-scene.ts', s);

s = head('src/components/robot-coding-panel.vue');
s = s.replace("import type { EnhancementChoices } from '../game/coding-missions';\n", '').replace('; enhancementChoices: EnhancementChoices', '').replace('; run: []', '').replace('block: CodingBlockId | null]', 'block: CodingBlockId | null, sourceSlot?: number]');
s = s.replace(/^const enhancementOwner = .*\n/m, '');
s = replace(s, "  if (dragSource !== null && dragSource !== slot) emit('change', dragSource, props.robot.code[slot]);\n  emit('change', slot, block);", "  emit('change', slot, block, dragSource ?? undefined);");
s = s.replace("{{ mission.number === 1 ? '로봇에게 명령하기' : '로봇 공격 강화하기' }}", '로봇에게 명령하기');
s = s.replaceAll('basicCompleted', 'autoAttackActive').replace(' · 종류 공통', ' #{{ robot.serial }}').replace('강화 코딩 중에도 유지', '코딩 중에도 유지').replace('● 공격 대기 · 기본 미션', '● 공격 대기 · 이번 웨이브 미션');
s = s.replace(/      <div class="coding-progress"[\s\S]*?<\/div>/, `      <div class="coding-progress" aria-label="코딩 완료 상태">
        <span v-for="number in ([1, 2, 3] as const)" :key="number" :class="{ learned: robot.completedMissions.includes(number) }">{{ robot.completedMissions.includes(number) ? '✓' : '○' }} W{{ number }} {{ getCodingMission(robot.kind, number).title }}</span>
      </div>`);
s = s.replace(/      <p v-if="wave > 1" class="coding-choice".*<\/p>/, '      <p class="coding-choice" role="status">모든 종류의 로봇이 각자 미션을 풀 수 있어요. 성공하면 이 로봇의 기본 자동 공격이 활성화돼요.</p>');
s = s.replace("{{ mission.number === 1 ? '기본 미션 · 최초 1회' : `WAVE ${mission.number} 강화 미션` }}", 'WAVE {{ mission.number }} {{ mission.title }} · 로봇 #{{ robot.serial }}');
s = s.replace("{{ mission.number === 1 ? '자동 공격 활성화' : '종류 전체 강화 완료' }}", '기본 자동 공격 활성화').replace("{{ mission.number === 1 ? '기본 미션 성공!' : '강화 미션 성공!' }}", '공격 성공!');
s = s.replace('같은 종류의 모든 로봇에 적용됐어요.<br />추가 소환한 로봇도 배치하면 이어서 공격해요.', '이 로봇의 기본 자동 공격이 활성화됐어요.<br />다음 웨이브에서도 계속 공격해요.');
s = s.replace("{{ mission.autoRun ? '공격 블록을 한 번 클릭해 봐요.' : '블록을 클릭하거나 드래그해서 순서대로 넣어 봐요.' }}", '블록을 클릭하거나 드래그해서 순서대로 넣어 봐요.').replace("{{ mission.autoRun ? '↻ 계속 공격하기' : '↻ 다시 조건 확인하기' }}", '↻ 기본 자동 공격 계속하기').replace("{{ mission.autoRun ? '블록을 누르면 코드에 들어가고 자동으로 실행돼요.' : '블록을 누르면 내 코드 영역에 블록이 들어가요.' }}", '블록을 올바르게 연결하면 자동으로 공격해요.');
s = s.replace(/^        <button v-if="!mission.autoRun".*\n/m, '');
s = s.replace("'기본 공격은 계속돼요. 강화 조건이 맞지 않아도 공격해요.' : '종류별 기본 미션을 완료하면 자동 공격을 시작해요.'", "'기본 자동 공격은 다음 웨이브에서도 유지돼요.' : '이번 웨이브 미션을 완료하면 기본 자동 공격을 시작해요.'");
save('src/components/robot-coding-panel.vue', s);

s = head('src/components/victory-result.vue').replace("import { onMounted, ref } from 'vue';", "import { onMounted, ref } from 'vue';\nimport { getCodingMission } from '../game/coding-missions';");
s = s.replace('`다음 웨이브는 모든 로봇이 블록 ${wave + 1}개 문제를 풀어요`', "`다음 웨이브: ${getCodingMission('fire', wave + 1).title} · ${getCodingMission('fire', wave + 1).concept} · 기존 자동 공격 유지`");
save('src/components/victory-result.vue', s);

s = current('README.md').replaceAll('최대 9기', '최대 8기').replaceAll('최대 9대', '최대 8대');
s = s.replace('로봇 위치에 `green-light` 애니메이션과 `공격 성공!` 문구가 나타납니다.', '`공격 성공!` 문구가 나타납니다.');
s = s.replace(/^- \*\*성공 효과\*\*:.*$/m, '- **성공 효과**: 모든 웨이브에서 성공하면 해당 로봇의 기본 자동 공격만 활성화됩니다. 한 종류를 선택해 확정하는 제한이 없으며 미사일·냉각·전기로봇 모두 각자 미션을 수행할 수 있습니다. 공격력 강화나 특수 공격 해금은 없습니다. WAVE 2·3에서 처음 획득했거나 이전 문제를 완료하지 못한 로봇도 현재 웨이브 미션을 풀면 공격을 시작합니다.');
s = s.replace(/^- \*\*자동 공격\*\*:.*$/m, '- **공격 유지**: 한 번 활성화된 기본 자동 공격은 다음 웨이브에서도 유지됩니다. 새 미션을 작성하거나 정답에 실패해도 기존 공격과 재사용 대기 시간은 유지됩니다. 기본 공격 성능은 완료한 웨이브나 학습 블록에 따라 바뀌지 않으며 단독 보스도 공격합니다.');
s = s.replace(/^- \*\*다음 웨이브\*\*:.*$/m, '- **다음 웨이브**: WAVE 1·2를 클리어하면 결과창의 다음 웨이브 버튼으로 진행합니다. 로봇·배치·에너지·개별 미션 완료 상태와 초안을 유지하고 현재 웨이브의 새 미션을 표시합니다. 기존 자동 공격은 계속됩니다. WAVE 3을 클리어하면 다시 플레이할 수 있습니다.');
save('README.md', s);

s = current('tests/coding-missions.test.ts').replace(/  if \(canStart\) \{\n    assert.equal\(game.status, 'ready'\);[\s\S]*?\n  \}/, '');
s = s.replace(/test\('wave transitions remove completed robots[\s\S]*?(?=test\('the final correct block)/, `test('wave transitions retain activated robots and drafts while opening the new mission', () => {
  const game = setup('fire'), fire = game.robots[0], ice = summon(game, 'ice');
  complete(game, fire.id); game.updateCode(ice.id, 0, 'find');
  const base = JSON.stringify(fire.program[1]), draft = JSON.stringify(ice.program[1]);
  const positions = game.robots.map(robot => [robot.id, robot.x, robot.y]);
  for (const wave of [2, 3] as const) {
    nextWave(game); assert.equal(game.wave, wave);
    assert.equal(fire.missionNumber, wave); assert.equal(ice.missionNumber, wave);
    assert.equal(fire.autoAttackActive, true); assert.equal(ice.autoAttackActive, false);
    assert.deepEqual(fire.code, [null, null]); assert.equal(JSON.stringify(fire.program[1]), base);
    assert.equal(JSON.stringify(ice.program[1]), draft);
    assert.deepEqual(game.robots.slice(0, 2).map(robot => [robot.id, robot.x, robot.y]), positions);
    game.enemies = [enemy(100, fire.x)]; assert.ok(advance(game).some(shot => !shot.player && shot.kind === 'fire'));
    complete(game, fire.id);
  }
  assert.deepEqual(fire.completedMissions, [1, 2, 3]);
  complete(game, ice.id); assert.equal(ice.autoAttackActive, true); assert.deepEqual(ice.completedMissions, [3]);
});

test('editing or failing later missions preserves activated attacks and cooldowns', () => {
  for (const wave of [2, 3] as const) for (const kind of kinds) {
    const game = setup(kind), robot = game.robots[0]; complete(game);
    while (game.wave < wave) nextWave(game);
    game.updateCode(robot.id, 0, getCodingMission(kind, wave).slots[0].block);
    game.enemies = [enemy(100, 3)]; assert.ok(advance(game).length > 0);
    const combat = [robot.cooldown, robot.phaseTimer, robot.activeBlock, robot.burstRemaining];
    game.runCode(robot.id); assert.equal(robot.missionStatus, 'error'); assert.equal(robot.autoAttackActive, true);
    assert.deepEqual([robot.cooldown, robot.phaseTimer, robot.activeBlock, robot.burstRemaining], combat);
    assert.ok(advance(game, 30).length > 0); complete(game); assert.equal(robot.autoAttackActive, true);
  }
});

`);
save('tests/coding-missions.test.ts', s);
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ base, files, dir }, null, 2));
console.log(JSON.stringify({ base, dir, files }));
