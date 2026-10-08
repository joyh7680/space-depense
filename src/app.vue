<script setup lang="ts">
import { computed, ref } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import type { DefenseState, GameMode } from './game/types';

const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, kills: 0, enemies: 0, turrets: 0, player: { x: 7, y: 6 }, mode: 'move', grid: false, message: '방 리소스를 불러오는 중입니다.' });
const canBuild = computed(() => ready.value && ['ready', 'cleared'].includes(state.value.status));
const inWave = computed(() => ['running', 'paused'].includes(state.value.status));
const statusLabel = computed(() => ({ ready: '방어 준비', running: '방어 진행', paused: '일시 정지', cleared: '방어 성공', defeat: '코어 파괴' })[state.value.status]);
function setMode(mode: GameMode) { if (ready.value) room.value?.setMode(mode); }
</script>

<template>
  <div class="shell">
    <header class="header">
      <a class="brand" href="./" aria-label="우주 디펜더 홈">
        <span class="brand-mark">✦</span>
        <span>SPACE <strong>DEFENDER</strong><small>우주정거장 방어 작전</small></span>
      </a>
      <div class="header-right"><span class="prototype">PROTOTYPE 01</span><span class="connection"><i /> 로컬 시뮬레이션</span></div>
    </header>

    <main class="workspace">
      <section class="room-panel" aria-label="게임방">
        <div class="room-topline"><div><span class="eyebrow">STATION / 01</span><h1>우주 디펜더 게임방</h1></div><span class="room-badge"><i /> {{ statusLabel }}</span></div>
        <div class="viewport">
          <SpaceDefenseRoom ref="room" @state="state = $event" @ready="ready = true" @error="error = $event" />
          <div class="map-label"><span class="tiny-square" /> 방어 모듈 A-01 <small>14 × 9 GRID</small></div>
          <button class="grid-button" :class="{ active: state.grid }" :disabled="!ready" :aria-pressed="state.grid" @click="room?.toggleGrid()"><span>▦</span> 그리드</button>
          <div v-if="!ready || error" class="loading-overlay"><span class="loading-star">✦</span><p>{{ error || '우주정거장에 진입하는 중…' }}</p></div>
          <div v-if="state.status === 'paused'" class="pause-overlay"><span>Ⅱ</span><p>작전 일시 정지</p><button class="primary-button" @click="room?.togglePause()">작전 계속하기</button></div>
          <div class="map-coordinates">SECTOR 07 <span>X {{ String(state.player.x).padStart(2, '0') }} / Y {{ String(state.player.y).padStart(2, '0') }}</span></div>
        </div>
        <div class="room-bottomline"><span class="notice-dot" /><p aria-live="polite">{{ state.message }}</p><span class="local-tag">SINGLE ROOM</span></div>
      </section>

      <aside class="control-panel">
        <div class="panel-heading"><span class="eyebrow">MISSION CONTROL</span><h2>방어 준비</h2><p>포탑을 배치하고<br />정거장의 코어를 지키세요.</p></div>
        <div class="core-status"><div class="stat-label"><span><i /> 코어 내구도</span><strong>{{ state.health }}<small> / 100</small></strong></div><div class="health-track"><span :style="{ width: `${state.health}%` }" /></div></div>
        <div class="resource-row"><div><span>보유 에너지</span><strong class="energy"><small>ϟ</small> {{ state.credits }}</strong></div><div><span>웨이브</span><strong>{{ String(state.wave).padStart(2, '0') }}<small> WAVE</small></strong></div></div>
        <div class="separator" />
        <div class="section-label">방어 장치 <span>{{ state.turrets }} 배치됨</span></div>
        <button class="turret-card" :class="{ selected: state.mode === 'build' }" :disabled="!canBuild || state.credits < 75" :aria-pressed="state.mode === 'build'" @click="setMode(state.mode === 'build' ? 'move' : 'build')">
          <span class="turret-art"><svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="46" rx="24" ry="11" fill="#112d3a"/><path d="M13 39v9l19 9 19-9v-9" fill="#42727f"/><path d="m13 39 19-10 19 10-19 10z" fill="#71c7c9"/><rect x="22" y="24" width="20" height="18" rx="4" fill="#9af0e3"/><rect x="28" y="10" width="8" height="25" rx="2" fill="#f5be74"/><rect x="27" y="8" width="10" height="5" rx="1" fill="#fff0cb"/></svg></span>
          <span class="turret-description"><strong>펄스 포탑</strong><small>사거리 4칸 · 자동 공격</small><b>ϟ 75 <span>배치하기 ↗</span></b></span>
        </button>
        <p class="placement-tip">황금색 경로 옆 빈 바닥에 배치하세요.</p>
        <div class="mode-buttons"><button :class="{ active: state.mode === 'move' }" :disabled="!ready" :aria-pressed="state.mode === 'move'" @click="setMode('move')">↖ 이동 모드</button><button :class="{ active: state.mode === 'remove' }" :disabled="!canBuild" :aria-pressed="state.mode === 'remove'" @click="setMode(state.mode === 'remove' ? 'move' : 'remove')">↶ 포탑 회수</button></div>
        <div class="mission-note"><span>◎</span><p>작전 목표<strong>침입 드론으로부터 코어 방어</strong><small>방어 성공 시 에너지 +50</small></p></div>
        <div class="action-area">
          <button v-if="inWave" class="primary-button" :disabled="!ready" @click="room?.togglePause()">{{ state.status === 'paused' ? '▶ 작전 계속하기' : 'Ⅱ 일시 정지' }}</button>
          <button v-else class="primary-button" :disabled="!canBuild || state.turrets === 0" @click="room?.startWave()">{{ state.wave === 0 ? '▶ 방어 테스트 시작' : '▶ 다음 웨이브 시작' }}</button>
          <button class="reset-button" :disabled="!ready" @click="room?.reset()">↻ 방 초기화</button>
        </div>
      </aside>
    </main>

    <footer class="footer"><div class="keyboard-help"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> 이동</span><span class="footer-divider" /><span>바닥 클릭 <b>목적지 이동</b></span></div><span class="footer-note">CODMOS ROOM · DEFENSE SANDBOX</span></footer>
  </div>
</template>
