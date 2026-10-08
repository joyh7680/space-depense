<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import { ROBOTS, SUMMON_COST, WAVE_ONE } from './game/wave-one';
import type { DefenseState } from './game/types';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const summonOpen = ref(false);
const summonDialog = ref<HTMLElement>();
let returnFocus: HTMLElement | null = null;
const portraitUrl = 'url("' + import.meta.env.BASE_URL + 'codmos-assets/player/int-front.png")';
const gameOverArt = `${import.meta.env.BASE_URL}codmos-assets/e56bb4d926f2/6a69a85b-2fab-4322-8b87-30a4eab82980.png`;
const retryButton = ref<HTMLButtonElement>();
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies, escaped: 0, elapsed: 0, countdown: 5, robots: [], selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '', defeatAnimationComplete: false });
const canDeploy = computed(() => ready.value && ['ready', 'running'].includes(state.value.status));
const canSummon = computed(() => canDeploy.value && state.value.credits >= SUMMON_COST && state.value.robots.length < 8);
const finished = computed(() => state.value.status === 'cleared' || (state.value.status === 'defeat' && state.value.defeatAnimationComplete));
watch(finished, async visible => {
  if (visible) {
    await nextTick();
    retryButton.value?.focus({ preventScroll: true });
  }
});
const selected = computed(() => state.value.robots.find(r => r.id === state.value.selectedId));
const canMerge = computed(() => canDeploy.value && selected.value && selected.value.grade < 3 && state.value.robots.some(r => r.id !== selected.value!.id && r.kind === selected.value!.kind && r.grade === selected.value!.grade));
const kindOrder = ['electric', 'ice', 'fire'] as const;
const summonHint = computed(() => state.value.robots.length >= 8 ? '로봇이 가득 찼어요. 같은 로봇을 합성해 보세요.' : state.value.credits < SUMMON_COST ? '에너지가 부족해요. 괴물을 처치해 모아보세요.' : '로봇을 누른 뒤 빈 바닥에 배치하세요.');
const robotArt = {
 fire: { backgroundPosition: '-169.8px -435.3px', clipPath: 'inset(0 0 14px 0)' },
 ice: { backgroundPosition: '-95.4px -402.9px' },
 electric: { backgroundPosition: '-453px -428.4px' },
};
async function openSummon() {
  if (!canDeploy.value) return;
  returnFocus = document.activeElement as HTMLElement;
  room.value?.setInteractionLocked(true);
  summonOpen.value = true;
  await nextTick();
  summonDialog.value?.querySelector<HTMLButtonElement>('.modal-close')?.focus();
}
function closeSummon() {
  summonOpen.value = false;
  room.value?.setInteractionLocked(false);
  returnFocus?.focus();
}
async function summonRobot() {
  if (!canSummon.value) return;
  room.value?.summon();
  await nextTick();
  const action = summonDialog.value?.querySelector<HTMLButtonElement>('.modal-summon');
  (action?.disabled ? summonDialog.value?.querySelector<HTMLButtonElement>('.modal-close') : action)?.focus();
}
function deployRobot(id: number) {
  if (!canDeploy.value || !state.value.robots.some(robot => robot.id === id)) return;
  closeSummon();
  room.value?.selectRobot(id);
}
async function mergeRobots() {
  if (!canMerge.value) return;
  room.value?.merge();
  await nextTick();
  const action = summonDialog.value?.querySelector<HTMLButtonElement>('.hangar-merge');
  (action?.disabled ? summonDialog.value?.querySelector<HTMLButtonElement>('.modal-close') : action)?.focus();
}
function dialogKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeSummon(); }
  if (event.key !== 'Tab') return;
  const buttons = Array.from(summonDialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
</script>
<template>
  <main class="game-screen" aria-label="코드모스 우주 디펜스" :style="{ '--portrait-url': portraitUrl }" :data-player-x="state.player.x" :data-player-y="state.player.y">
    <SpaceDefenseRoom ref="room" @state="state = $event" @ready="ready = true" @error="error = $event" />
    <div class="profile-hud">
      <div class="profile-avatar"><i class="codmos-portrait" /></div>
      <div><small>Lv. 1 <span>ϟ {{ state.credits }}</span></small><strong>우주 지휘관</strong></div>
    </div>
    <div class="wave-hud" aria-label="전투 현황">
      <div class="wave-counter"><small>WAVE</small><strong>01</strong></div>
      <div class="battle-progress"><div><b>{{ state.status === 'ready' ? '잠시 후 자동 시작' : '우주정거장 방어' }}</b><span>{{ state.kills }} / {{ state.total }}</span></div><div class="progress-track"><i :style="{ width: state.kills / state.total * 100 + '%' }" /></div></div>
      <div class="player-health" :class="{ danger: state.health <= 30 }" :aria-label="'정거장 내구도 ' + state.health"><span>♥</span><b>{{ state.health }}</b></div>
    </div>
    <div v-if="ready && state.status === 'ready' && !summonOpen" class="countdown-hud" role="status"><small>괴물 출현까지</small><strong>{{ state.countdown }}</strong><span>바닥을 눌러 움직여 보세요</span></div>
    <div class="bottom-controls">
      <div class="robot-elements" aria-label="속성별 로봇 보유 수량">
        <span v-for="kind in kindOrder" :key="kind" :class="kind" :aria-label="ROBOTS[kind].name + ' ' + state.robots.filter(robot => robot.kind === kind).length">
          <i aria-hidden="true">{{ ROBOTS[kind].symbol }}</i><small>{{ ROBOTS[kind].name }}</small><b>{{ state.robots.filter(robot => robot.kind === kind).length }}</b>
        </span>
      </div>
      <button class="robot-button" :class="{ open: summonOpen }" :disabled="!canDeploy" :aria-label="'로봇, ' + state.robots.length + '대 보유'" aria-haspopup="dialog" aria-controls="robot-hangar" :aria-expanded="summonOpen" @click="openSummon">
        <span class="robot-button-count">{{ state.robots.length }}</span>
        <i class="robot-portrait" :style="robotArt.fire" aria-hidden="true" />
        <b>로봇</b>
      </button>
    </div>
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="summonOpen" class="summon-backdrop" @click.self="closeSummon">
      <section id="robot-hangar" ref="summonDialog" class="robot-hangar" role="dialog" aria-modal="true" aria-labelledby="summon-title" aria-describedby="summon-hint" @keydown="dialogKey">
        <header class="hangar-header">
          <h2 id="summon-title">내 로봇 <span>{{ state.robots.length }} / 8</span></h2>
          <span class="hangar-energy" aria-label="보유 에너지">ϟ {{ state.credits }}</span>
          <button class="modal-close" aria-label="로봇 목록 닫기" @click="closeSummon">×</button>
        </header>
        <div class="robot-roster" aria-label="보유 로봇 목록">
          <button class="robot-summon-card modal-summon" :disabled="!canSummon" :aria-label="'랜덤 로봇 소환, 에너지 ' + SUMMON_COST" @click="summonRobot">
            <span class="summon-spark" aria-hidden="true">✦</span><strong aria-hidden="true">＋</strong><b>소환</b><small>ϟ {{ SUMMON_COST }}</small>
          </button>
          <button v-for="robot in state.robots" :key="robot.id" :class="['robot-card', robot.kind, { selected: selected?.id === robot.id }]" :disabled="!canDeploy" :aria-label="ROBOTS[robot.kind].name + ' ' + robot.grade + '성 로봇 ' + robot.id + ', 배치하기'" @click="deployRobot(robot.id)">
            <span class="robot-grade" :aria-label="robot.grade + '성'">{{ '★'.repeat(robot.grade) }}</span>
            <i class="robot-portrait" :style="robotArt[robot.kind]" aria-hidden="true" />
            <b>{{ ROBOTS[robot.kind].name }}</b>
          </button>
          <div v-if="!state.robots.length" class="hangar-empty"><i class="robot-portrait" :style="robotArt.ice" aria-hidden="true" /><div><b>첫 로봇을 만나보세요!</b><span>소환하면 이곳에 모여요.</span></div></div>
        </div>
        <footer class="hangar-footer">
          <p id="summon-hint" role="status">{{ summonHint }}</p>
          <button v-if="selected" class="hangar-merge" :disabled="!canMerge" @click="mergeRobots" :aria-label="ROBOTS[selected.kind].name + ' ' + selected.grade + '성 로봇 합성'" title="같은 속성·같은 등급 로봇 2대 합성">◇ 합성</button>
        </footer>
      </section>
    </div>
    <div v-if="finished" class="screen-overlay result-overlay" :class="{ 'defeat-overlay': state.status === 'defeat' }">
      <section v-if="state.status === 'defeat'" class="defeat-result" role="dialog" aria-modal="true" aria-labelledby="game-over-title" aria-describedby="game-over-description" @keydown.tab.prevent="retryButton?.focus()">
        <div class="result-wave"><i aria-hidden="true" />WAVE 01 <span>전투 종료</span></div>
        <h1 id="game-over-title" class="game-over-title"><img :src="gameOverArt" alt="게임 오버" width="600" height="104" draggable="false" /></h1>
        <p id="game-over-description" class="defeat-description"><strong>우주정거장이 파괴됐어요</strong><span>탈출한 괴물이 우리 기지에 도착했어요.</span></p>
        <dl class="defeat-stats">
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>처치한 괴물</dt><dd>{{ state.kills }}<span>/ {{ state.total }}</span></dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 4H4v16h6m-1-8h12m-5-5 5 5-5 5" /></svg>탈출한 괴물</dt><dd>{{ state.escaped }}<span>마리</span></dd></div>
        </dl>
        <button ref="retryButton" class="retry-button" @click="room?.reset()"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg>다시 도전하기</button>
        <p class="retry-tip">로봇을 소환하고 길목에 배치해 보세요!</p>
      </section>
      <section v-else class="game-modal result-modal" role="dialog" aria-modal="true" aria-label="1웨이브 결과" @keydown.tab.prevent="retryButton?.focus()"><small>WAVE 01</small><div class="result-symbol">★</div><h1>방어 성공!</h1><div class="result-numbers"><span>처치 <b>{{ state.kills }}/{{ state.total }}</b></span><span>탈출 <b>{{ state.escaped }}마리</b></span></div><p class="reward">ϟ +{{ WAVE_ONE.clearEnergy }} 에너지</p><button ref="retryButton" class="launch-button" @click="room?.reset()">↻ 다시 플레이</button><small>현재 1웨이브까지 플레이할 수 있어요</small></section>
    </div>
  </main>
</template>
