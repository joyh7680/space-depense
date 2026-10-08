<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import { ROBOTS, ROBOT_CHARGE_COST, WAVE_ONE } from './game/wave-one';
import type { DefenseState, RobotKind } from './game/types';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const summonOpen = ref(false);
const summonDialog = ref<HTMLElement>();
let returnFocus: HTMLElement | null = null;
const portraitUrl = 'url("' + import.meta.env.BASE_URL + 'codmos-assets/player/int-front.png")';
const gameOverArt = `${import.meta.env.BASE_URL}codmos-assets/e56bb4d926f2/6a69a85b-2fab-4322-8b87-30a4eab82980.png`;
const retryButton = ref<HTMLButtonElement>();
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, elementEnergy: { fire: 0, electric: 0, ice: 0 }, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies, escaped: 0, elapsed: 0, countdown: 5, robots: [], robotCount: 0, selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '', defeatAnimationComplete: false });
const canDeploy = computed(() => ready.value && ['ready', 'running'].includes(state.value.status));
const finished = computed(() => state.value.status === 'cleared' || (state.value.status === 'defeat' && state.value.defeatAnimationComplete));
watch(() => state.value.status, status => {
  if (summonOpen.value && (status === 'defeat' || status === 'cleared')) closeSummon();
});
watch(finished, async visible => {
  if (visible) {
    await nextTick();
    retryButton.value?.focus({ preventScroll: true });
  }
});
const kindOrder = ['electric', 'ice', 'fire'] as const;
const robotCards = computed(() => (['fire', 'electric', 'ice'] as const).map(kind => {
  const robots = state.value.robots.filter(robot => robot.kind === kind);
  const selected = robots.find(robot => robot.id === state.value.selectedId);
  const charged = state.value.elementEnergy[kind] >= ROBOT_CHARGE_COST;
  return { kind, charged, available: robots.length > 0 || (charged && state.value.robotCount < 8), selected: !!selected, grade: selected?.grade ?? robots.at(-1)?.grade ?? 1 };
}));
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
  summonDialog.value?.focus({ preventScroll: true });
}
function closeSummon() {
  summonOpen.value = false;
  room.value?.setInteractionLocked(false);
  returnFocus?.focus();
}
function deployKind(kind: RobotKind) {
  if (!canDeploy.value) return;
  if (state.value.elementEnergy[kind] >= ROBOT_CHARGE_COST && state.value.robotCount < 8) {
    room.value?.summon(kind);
    closeSummon();
    return;
  }
  const robots = state.value.robots.filter(robot => robot.kind === kind);
  if (!robots.length) return;
  const current = robots.findIndex(robot => robot.id === state.value.selectedId);
  closeSummon();
  room.value?.selectRobot(robots[(current + 1) % robots.length].id);
}
function dialogKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeSummon(); }
  if (event.key !== 'Tab') return;
  const buttons = Array.from(summonDialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  const first = buttons[0], last = buttons.at(-1);
  if (!first) { event.preventDefault(); summonDialog.value?.focus(); }
  else if (document.activeElement === summonDialog.value) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
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
      <div class="robot-elements" aria-label="속성 에너지 보유 수량">
        <span v-for="kind in kindOrder" :key="kind" :class="kind" :title="ROBOTS[kind].name + ' 에너지'" :aria-label="ROBOTS[kind].name + ' 에너지 ' + state.elementEnergy[kind] + '개'">
          <svg class="element-icon" viewBox="0 0 20 20" aria-hidden="true">
            <path v-if="kind === 'electric'" class="element-shape" fill="#ffd65c" d="m11.5 1.5-7 9h4l-1 8 8-10h-4z" />
            <template v-else-if="kind === 'ice'">
              <path class="element-shape" fill="#62d9df" d="M10 1.5C8 5 4 8.8 4 12.3a6 6 0 0 0 12 0C16 8.8 12 5 10 1.5Z" />
              <path fill="none" stroke="#b8f4f3" stroke-width="1.5" stroke-linecap="round" d="M6.8 11.8c-.3 1.5.4 2.7 1.5 3.1" />
            </template>
            <template v-else>
              <path class="element-shape" fill="#f8758e" d="M11 1.5c.7 4-3.5 4.5-3.2 8-1.3-.5-1.8-1.4-1.8-2.5-2 2.2-3.1 4-2.4 6.8a6.7 6.7 0 0 0 12.8 0C17.5 9.6 14.7 6.3 11 1.5Z" />
              <path fill="#ffb3b5" d="M10.4 9.6c.2 2-2.4 2.8-2.4 4.5a2.1 2.1 0 0 0 4.2 0c0-1.5-.8-2.8-1.8-4.5Z" />
            </template>
          </svg><b>{{ state.elementEnergy[kind] }}</b>
        </span>
      </div>
      <button class="robot-button" :class="{ open: summonOpen }" :disabled="!canDeploy" :aria-label="'로봇, ' + state.robotCount + '대 보유'" aria-haspopup="dialog" aria-controls="robot-hangar" :aria-expanded="summonOpen" @click="openSummon">
        <span class="robot-button-count" role="status" aria-live="polite" aria-atomic="true">{{ state.robotCount }}</span>
        <i class="robot-portrait" :style="robotArt.fire" aria-hidden="true" />
        <b>로봇</b>
      </button>
    </div>
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="summonOpen" class="summon-backdrop" @click.self="closeSummon">
      <section id="robot-hangar" ref="summonDialog" class="robot-hangar" role="dialog" aria-modal="true" aria-label="로봇 충전 및 배치" tabindex="-1" @keydown="dialogKey">
        <div class="robot-roster">
          <button v-for="card in robotCards" :key="card.kind" :class="['robot-card', card.kind, { selected: card.selected, charged: card.charged }]" :disabled="!canDeploy || !card.available" :aria-label="ROBOTS[card.kind].name + ' 로봇, 에너지 ' + state.elementEnergy[card.kind] + '/' + ROBOT_CHARGE_COST + (card.available ? ', 배치하기' : ', 충전 중')" :title="ROBOTS[card.kind].name + ' 에너지 ' + ROBOT_CHARGE_COST + '개로 충전'" @click="deployKind(card.kind)">
            <span class="robot-grade" :aria-label="card.grade + '성'">{{ '★'.repeat(card.grade) }}</span>
            <i class="robot-portrait" :style="robotArt[card.kind]" aria-hidden="true" />
            <b>{{ ROBOTS[card.kind].name }}</b>
          </button>
        </div>
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
