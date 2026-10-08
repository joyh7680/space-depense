<script setup lang="ts">
import { computed, ref } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import { ROBOTS, SUMMON_COST, WAVE_ONE } from './game/wave-one';
import type { DefenseState } from './game/types';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const portraitUrl = 'url("' + import.meta.env.BASE_URL + 'codmos-assets/player/int-front.png")';
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies, escaped: 0, elapsed: 0, countdown: 5, robots: [], selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '' });
const canDeploy = computed(() => ready.value && ['ready', 'running'].includes(state.value.status));
const finished = computed(() => ['cleared', 'defeat'].includes(state.value.status));
const selected = computed(() => state.value.robots.find(r => r.id === state.value.selectedId));
const canMerge = computed(() => canDeploy.value && selected.value && selected.value.grade < 3 && state.value.robots.some(r => r.id !== selected.value!.id && r.kind === selected.value!.kind && r.grade === selected.value!.grade));
const hint = computed(() => state.value.mode === 'relocate' ? '빈 바닥을 눌러 로봇 배치 · 드래그도 가능' : '바닥 클릭·터치로 이동 · 대원과 로봇 자동 공격');
const kindOrder = ['electric', 'ice', 'fire'] as const;
const robotArt = {
 fire: { backgroundPosition: '-169.8px -435.3px', clipPath: 'inset(0 0 14px 0)' },
 ice: { backgroundPosition: '-95.4px -402.9px' },
 electric: { backgroundPosition: '-453px -428.4px' },
};
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
      <div class="base-health" :class="{ danger: state.health <= 30 }"><span>♥</span><b>{{ state.health }}</b></div>
    </div>
    <aside class="robot-sidebar" aria-label="나의 로봇">
      <header><b>나의 로봇</b><span>{{ state.robots.length }}/8</span></header>
      <div class="robot-elements"><span v-for="kind in kindOrder" :key="kind" :class="kind">{{ ROBOTS[kind].symbol }} <b>{{ state.robots.filter(r => r.kind === kind).length }}</b></span></div>
      <div class="robot-roster">
        <button v-for="robot in state.robots" :key="robot.id" :class="['robot-token', robot.kind, { selected: robot.id === state.selectedId }]" :disabled="!canDeploy" :aria-label="ROBOTS[robot.kind].name + ' ' + robot.grade + '성 로봇 선택'" :aria-pressed="robot.id === state.selectedId" @click="room?.selectRobot(robot.id)">
          <i class="robot-portrait" :style="robotArt[robot.kind]" /><b>{{ ROBOTS[robot.kind].name }}</b><small>{{ '★'.repeat(robot.grade) }}</small>
        </button>
      </div>
      <div v-if="!state.robots.length" class="robot-empty"><span>＋</span><p>로봇을 소환해<br />함께 싸워요!</p></div>
      <div v-if="selected" class="robot-inline-info">
        <b>{{ ROBOTS[selected.kind].name }} 로봇</b><small>공격 {{ selected.damage }} · 사거리 {{ selected.range.toFixed(1) }}</small>
        <p>선택 → 빈 바닥에 배치</p><button :disabled="!canMerge" @click="room?.merge()">◇ 같은 로봇 합성</button>
      </div>
    </aside>
    <div v-if="ready && state.status === 'ready'" class="countdown-hud" role="status"><small>괴물 출현까지</small><strong>{{ state.countdown }}</strong><span>바닥을 눌러 움직여 보세요</span></div>
    <div class="bottom-controls">
      <div class="action-area"><div class="game-hint" role="status">{{ hint }}</div><div class="action-dock">
        <button class="summon-button" :disabled="!canDeploy || state.credits < SUMMON_COST || state.robots.length >= 8" @click="room?.summon()"><span class="button-icon">＋</span><span><b>로봇 소환</b><small>ϟ {{ SUMMON_COST }}</small></span></button>
      </div><div class="battle-notice" aria-live="polite">{{ state.message }}</div></div>
    </div>
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="finished" class="screen-overlay result-overlay">
      <section class="game-modal result-modal" aria-label="1웨이브 결과"><small>WAVE 01</small><div class="result-symbol">{{ state.status === 'cleared' ? '★' : '↻' }}</div><h1>{{ state.status === 'cleared' ? '방어 성공!' : '다시 도전!' }}</h1><div class="result-numbers"><span>처치 <b>{{ state.kills }}/12</b></span><span>기지 <b>♥ {{ state.health }}</b></span></div><p v-if="state.status === 'cleared'" class="reward">ϟ +{{ WAVE_ONE.clearEnergy }} 에너지</p><p v-else>로봇을 소환하고 길 옆에 배치해 보세요!</p><button class="launch-button" @click="room?.reset()">↻ 다시 플레이</button><small>현재 1웨이브까지 플레이할 수 있어요</small></section>
    </div>
  </main>
</template>
