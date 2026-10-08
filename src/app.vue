<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import { DRONES, SUMMON_COST, WAVE_ONE } from './game/wave-one';
import type { DefenseState } from './game/types';

const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const portraitUrl = `url("${import.meta.env.BASE_URL}codmos-assets/player/int-front.png")`;
const modal = ref<'help' | 'drones' | 'code' | null>(null);
let resumeAfterModal = false;
let returnFocus: HTMLElement | null = null;
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies, escaped: 0, elapsed: 0, drones: [], selectedId: null, player: { x: 11, y: 4 }, mode: 'move', grid: false, message: '' });
const canDeploy = computed(() => ready.value && ['ready', 'running', 'paused'].includes(state.value.status));
const finished = computed(() => ['cleared', 'defeat'].includes(state.value.status));
const selected = computed(() => state.value.drones.find(d => d.id === state.value.selectedId));
const canMerge = computed(() => canDeploy.value && selected.value && selected.value.grade < 3 && state.value.drones.some(d => d.id !== selected.value!.id && d.kind === selected.value!.kind && d.grade === selected.value!.grade));
const hint = computed(() => state.value.mode === 'build' ? '빛나는 빈 칸을 눌러 배치!' : state.value.status === 'ready' ? '방어 시작! 드론 3개가 자동으로 준비돼요' : state.value.status === 'paused' ? '잠시 쉬는 중' : '드론이 자동 공격해요 · 에너지가 모이면 추가 소환!');
const blocks = [{ id: 'find', name: '가까운 적 찾기', icon: '◎' }, { id: 'attack', name: '공격하기', icon: 'ϟ' }, { id: 'wait', name: '잠깐 기다리기', icon: '◷' }];
function start() {
  for (let i = 0; i < 3 && state.value.drones.length < 3 && state.value.credits >= SUMMON_COST; i++) room.value?.summon();
  room.value?.startWave();
}
function openModal(value: typeof modal.value) {
  if (!modal.value) {
    returnFocus = document.activeElement as HTMLElement;
    resumeAfterModal = state.value.status === 'running';
    if (resumeAfterModal) room.value?.togglePause();
  }
  modal.value = value;
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.modal-close')?.focus());
}
function closeModal() {
  modal.value = null;
  if (resumeAfterModal && state.value.status === 'paused') room.value?.togglePause();
  resumeAfterModal = false;
  returnFocus?.focus();
}
function reset() { resumeAfterModal = false; modal.value = null; room.value?.reset(); }
function deploy() {
  closeModal();
  if (state.value.status === 'paused') room.value?.togglePause();
  room.value?.setMode(state.value.mode === 'build' ? 'move' : 'build');
}
function merge() {
  const wasPaused = state.value.status === 'paused';
  if (wasPaused) room.value?.togglePause();
  room.value?.merge();
  if (wasPaused) room.value?.togglePause();
}
function onKey(event: KeyboardEvent) {
  if (!modal.value) return;
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab') {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)'));
    const first = buttons[0], last = buttons.at(-1);
    if (!buttons.includes(document.activeElement as HTMLButtonElement)) { event.preventDefault(); first?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <main class="game-screen" aria-label="코드모스 우주 디펜스" :style="{ '--portrait-url': portraitUrl }">
    <SpaceDefenseRoom ref="room" @state="state = $event" @ready="ready = true" @error="error = $event" @inspect="openModal('code')" />

    <div class="profile-hud">
      <div class="profile-avatar"><i class="codmos-portrait" /></div>
      <div><small>Lv. 1 <span>ϟ {{ state.credits }}</span></small><strong>우주 지휘관</strong></div>
    </div>
    <div class="wave-hud" aria-label="전투 현황">
      <div class="wave-counter"><small>WAVE</small><strong>01</strong></div>
      <div class="battle-progress"><div><b>우주정거장 방어</b><span>{{ state.kills }} / {{ state.total }}</span></div><div class="progress-track"><i :style="{ width: `${state.kills / state.total * 100}%` }" /></div></div>
      <div class="base-health" :class="{ danger: state.health <= 30 }"><span>♥</span><b>{{ state.health }}</b></div>
    </div>
    <nav class="top-actions" aria-label="게임 도움말">
      <button class="round-button" aria-label="게임 방법" @click="openModal('help')">?</button>
    </nav>

    <div class="station-label">SPACE DEFENSE <span>STATION A-01</span></div>
    <div class="bottom-controls">
      <button class="collection-button" :disabled="!ready" @click="openModal('drones')"><span>✦</span><b>내 드론</b><small>{{ state.drones.length }}/8</small></button>
      <div class="action-area">
        <div class="game-hint" role="status">{{ hint }}</div>
        <div class="action-dock">
          <button class="summon-button" :disabled="!canDeploy || state.status === 'paused' || state.credits < SUMMON_COST || state.drones.length >= 8" @click="room?.summon()"><span class="button-icon">＋</span><span><b>드론 소환</b><small>ϟ {{ SUMMON_COST }}</small></span></button>
          <button v-if="state.status === 'ready'" class="launch-button" :disabled="!ready" @click="start"><span>▶</span><b>방어 시작</b></button>
          <button v-else-if="finished" class="launch-button" @click="reset"><span>↻</span><b>다시 도전</b></button>
          <button v-else class="launch-button pause-button" :disabled="!ready" @click="room?.togglePause()"><span>{{ state.status === 'paused' ? '▶' : 'Ⅱ' }}</span><b>{{ state.status === 'paused' ? '계속하기' : '잠깐 쉬기' }}</b></button>
        </div>
      </div>
      <button class="place-button" :class="{ active: state.mode === 'build' }" :disabled="!canDeploy || state.credits < SUMMON_COST" @click="deploy"><span>⌖</span><b>{{ state.mode === 'build' ? '배치 취소' : '직접 배치' }}</b></button>
    </div>

    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-else-if="state.status === 'paused' && !modal" class="paused-label">Ⅱ 일시 정지</div>
    <div v-if="finished && !modal" class="screen-overlay result-overlay">
      <section class="game-modal result-modal" aria-label="1웨이브 결과"><small>WAVE 01</small><div class="result-symbol">{{ state.status === 'cleared' ? '★' : '↻' }}</div><h1>{{ state.status === 'cleared' ? '방어 성공!' : '다시 도전!' }}</h1><div class="result-numbers"><span>처치 <b>{{ state.kills }}/12</b></span><span>기지 <b>♥ {{ state.health }}</b></span></div><p v-if="state.status === 'cleared'" class="reward">ϟ +{{ WAVE_ONE.clearEnergy }} 에너지</p><p v-else>드론을 더 소환하면 든든해요!</p><button class="launch-button" @click="reset">↻ 다시 플레이</button><small>현재 1웨이브까지 플레이할 수 있어요</small></section>
    </div>

    <div v-if="modal" class="screen-overlay modal-backdrop" @click.self="closeModal">
      <section class="game-modal" role="dialog" aria-modal="true" :aria-label="modal === 'help' ? '게임 방법' : '내 드론'">
        <button class="modal-close" aria-label="닫기" @click="closeModal">×</button>
        <template v-if="modal === 'help'">
          <small>HOW TO PLAY</small><h2>딱 세 가지만!</h2>
          <div class="help-steps"><div><span>▶</span><b>방어 시작</b><p>드론 3개 자동 준비</p></div><div><span>ϟ</span><b>자동 공격!</b><p>모인 에너지로 추가 소환</p></div><div><span>✦</span><b>드론 클릭</b><p>코드 확인 · 같은 드론 합성</p></div></div>
          <p class="modal-note">대원은 바닥 클릭 / 방향키로 이동해요</p><button class="launch-button" @click="closeModal">알겠어요!</button>
        </template>
        <template v-else>
          <small>MY DRONES · {{ state.drones.length }}/8</small><h2>{{ modal === 'code' && selected ? DRONES[selected.kind].name + ' 드론' : '나의 드론' }}</h2>
          <div v-if="!state.drones.length" class="empty-roster">✦<p>방어 시작을 누르면<br />드론 3개가 준비돼요!</p></div>
          <div class="drone-roster"><button v-for="drone in state.drones" :key="drone.id" :class="['drone-token', drone.kind, { selected: drone.id === state.selectedId }]" :aria-label="`${DRONES[drone.kind].name} ${drone.grade}성 드론 선택`" @click="room?.selectDrone(drone.id)"><span>{{ DRONES[drone.kind].symbol }}</span><b>{{ DRONES[drone.kind].name }}</b><small>{{ '★'.repeat(drone.grade) }}</small></button></div>
          <template v-if="selected">
            <div class="drone-stats"><span>공격 <b>{{ selected.damage }}</b></span><span>사거리 <b>{{ selected.range.toFixed(1) }}</b></span><span>공격 횟수 <b>{{ selected.attacks }}</b></span></div>
            <div class="code-stack"><small>⚑ 전투가 시작되면 · 반복</small><div v-for="(block, index) in blocks" :key="block.id" :class="{ executing: selected.activeBlock === block.id }"><span>{{ index + 1 }}</span><b>{{ block.name }}</b><i>{{ block.icon }}</i></div></div>
            <button class="merge-button" :disabled="!canMerge" @click="merge">◇ 같은 드론 합성</button><p class="modal-note">같은 종류 · 같은 별 2개 → 별 +1</p>
          </template>
          <button class="launch-button" @click="closeModal">게임으로</button>
        </template>
      </section>
    </div>
  </main>
</template>
