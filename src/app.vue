<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import { ROBOTS, SUMMON_COST, WAVE_ONE } from './game/wave-one';
import type { DefenseState, RobotKind } from './game/types';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const summonOpen = ref(false);
const summonDialog = ref<HTMLElement>();
let returnFocus: HTMLElement | null = null;
const portraitUrl = 'url("' + import.meta.env.BASE_URL + 'codmos-assets/player/int-front.png")';
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies, escaped: 0, elapsed: 0, countdown: 5, robots: [], selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '' });
const canDeploy = computed(() => ready.value && ['ready', 'running'].includes(state.value.status));
const canSummon = computed(() => canDeploy.value && state.value.credits >= SUMMON_COST && state.value.robots.length < 8);
const finished = computed(() => ['cleared', 'defeat'].includes(state.value.status));
const selected = computed(() => state.value.robots.find(r => r.id === state.value.selectedId));
const canMerge = computed(() => canDeploy.value && selected.value && selected.value.grade < 3 && state.value.robots.some(r => r.id !== selected.value!.id && r.kind === selected.value!.kind && r.grade === selected.value!.grade));
const kindOrder = ['electric', 'ice', 'fire'] as const;
const robotGroups = computed(() => (['fire', 'ice', 'electric'] as const).map(kind => ({ kind, count: state.value.robots.filter(r => r.kind === kind).length })));
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
function deployKind(kind: RobotKind) {
  const robots = state.value.robots.filter(r => r.kind === kind);
  if (!robots.length) return;
  const current = robots.findIndex(r => r.id === state.value.selectedId);
  const robot = robots[(current + 1) % robots.length];
  closeSummon();
  room.value?.selectRobot(robot.id);
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
      <div class="player-health" :class="{ danger: state.health <= 30 }" :aria-label="'캐릭터 체력 ' + state.health"><span>♥</span><b>{{ state.health }}</b></div>
    </div>
    <div v-if="ready && state.status === 'ready' && !summonOpen" class="countdown-hud" role="status"><small>괴물 출현까지</small><strong>{{ state.countdown }}</strong><span>바닥을 눌러 움직여 보세요</span></div>
    <div class="bottom-controls">
      <div class="action-area">
        <div class="robot-elements" aria-label="속성별 로봇 보유 수량"><span v-for="kind in kindOrder" :key="kind" :class="kind" :aria-label="ROBOTS[kind].name + ' ' + state.robots.filter(r => r.kind === kind).length"><i>{{ ROBOTS[kind].symbol }}</i><small>{{ ROBOTS[kind].name }}</small><b>{{ state.robots.filter(r => r.kind === kind).length }}</b></span></div>
        <div class="action-dock"><button class="summon-button" :disabled="!canDeploy" aria-haspopup="dialog" :aria-expanded="summonOpen" @click="openSummon"><span class="button-icon">＋</span><span><b>로봇 소환</b><small>보유 {{ state.robots.length }}/8</small></span></button></div>
      </div>
    </div>
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="summonOpen" class="screen-overlay summon-backdrop" @click.self="closeSummon">
      <section ref="summonDialog" class="game-modal summon-modal" role="dialog" aria-modal="true" aria-labelledby="summon-title" @keydown="dialogKey">
        <button class="modal-close" aria-label="소환창 닫기" @click="closeSummon">×</button>
        <small>ROBOT HANGAR · {{ state.robots.length }}/8</small><h2 id="summon-title">로봇 소환</h2>
        <div class="robot-roster">
          <button v-for="group in robotGroups" :key="group.kind" :class="['robot-token', group.kind, { selected: selected?.kind === group.kind }]" :disabled="!group.count" :aria-label="ROBOTS[group.kind].name + ' ' + group.count + '대, 배치하기'" @click="deployKind(group.kind)">
            <i class="robot-portrait" :style="robotArt[group.kind]" /><b>{{ ROBOTS[group.kind].name }} <em>{{ group.count }}</em></b><small>{{ group.count ? '배치하기' : '미보유' }}</small>
          </button>
        </div>
        <div v-if="selected" class="robot-inline-info">
          <b>{{ ROBOTS[selected.kind].name }} {{ selected.grade }}성 로봇</b><small>공격 {{ selected.damage }} · 사거리 {{ selected.range.toFixed(1) }}</small>
          <button :disabled="!canMerge" @click="room?.merge()">◇ 같은 로봇 합성</button>
        </div>
        <button class="summon-button modal-summon" :disabled="!canSummon" @click="summonRobot"><span class="button-icon">＋</span><span><b>랜덤 로봇 소환</b><small>ϟ {{ SUMMON_COST }} · 보유 에너지 {{ state.credits }}</small></span></button>
        <p class="modal-note">{{ state.robots.length >= 8 ? '최대 8대예요. 같은 로봇을 합성해 보세요.' : state.credits < SUMMON_COST ? '에너지가 부족해요. 괴물을 처치해 모아보세요.' : '소환하면 같은 속성 카드의 숫자가 늘어나요.' }}<br />카드를 누르면 방으로 돌아가 배치해요.</p>
        <span class="modal-combat-note">소환창을 닫으면 전투가 이어져요</span>
      </section>
    </div>
    <div v-if="finished" class="screen-overlay result-overlay">
      <section class="game-modal result-modal" aria-label="1웨이브 결과"><small>WAVE 01</small><div class="result-symbol">{{ state.status === 'cleared' ? '★' : '↻' }}</div><h1>{{ state.status === 'cleared' ? '방어 성공!' : '게임 오버' }}</h1><div class="result-numbers"><span>처치 <b>{{ state.kills }}/12</b></span><span>내 체력 <b>♥ {{ state.health }}</b></span></div><p v-if="state.status === 'cleared'" class="reward">ϟ +{{ WAVE_ONE.clearEnergy }} 에너지</p><p v-else>살아남은 괴물에게 공격당했어요.<br />괴물을 피해 이동하며 로봇과 함께 싸워보세요!</p><button class="launch-button" @click="room?.reset()">↻ 다시 플레이</button><small>현재 1웨이브까지 플레이할 수 있어요</small></section>
    </div>
  </main>
</template>
