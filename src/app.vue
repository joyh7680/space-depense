<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import EnergyIcon from './components/energy-icon.vue';
import VictoryResult from './components/victory-result.vue';
import RobotCodingPanel from './components/robot-coding-panel.vue';
import { ROBOTS, ROBOT_CHARGE_COST, SUMMONED_MONSTER, WAVE_ONE } from './game/wave-one';
import type { DefenseState } from './game/types';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const summonOpen = ref(false);
const summonDialog = ref<HTMLElement>();
const codingRobotId = ref<number | null>(null);
const codingRobot = computed(() => state.value.robots.find(robot => robot.id === codingRobotId.value));
let returnFocus: HTMLElement | null = null;
const portraitUrl = 'url("' + import.meta.env.BASE_URL + 'codmos-assets/player/int-front.png")';
const gameOverArt = `${import.meta.env.BASE_URL}codmos-assets/e56bb4d926f2/6a69a85b-2fab-4322-8b87-30a4eab82980.png`;
const monsterArt = `${import.meta.env.BASE_URL}codmos-assets-monster/759c20f0e742/monster-mint.png`;
const retryButton = ref<HTMLButtonElement>();
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, elementEnergy: { fire: 0, electric: 0, ice: 0 }, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies + 1, escaped: 0, elapsed: 0, countdown: 5, monsterSummonCountdown: SUMMONED_MONSTER.summonDelay, robots: [], robotCount: 0, selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '', defeatAnimationComplete: false });
const canDeploy = computed(() => ready.value && ['ready', 'running'].includes(state.value.status));
const finished = computed(() => state.value.status === 'cleared' || (state.value.status === 'defeat' && state.value.defeatAnimationComplete));
watch(() => state.value.status, status => {
  if (summonOpen.value && (status === 'defeat' || status === 'cleared')) closeSummon();
  if (status === 'defeat' || status === 'cleared') codingRobotId.value = null;
});
watch(() => state.value.robots.length, count => { if (count === 0) codingRobotId.value = null; });
watch(finished, async visible => {
  if (visible && state.value.status === 'defeat') {
    await nextTick();
    retryButton.value?.focus({ preventScroll: true });
  }
});
const kindOrder = ['electric', 'ice', 'fire'] as const;
const robotGroups = computed(() => kindOrder.map(kind => ({ kind, robots: state.value.robots.filter(robot => robot.kind === kind) })));
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
function selectCodingRobot(id: number) {
  if (!canDeploy.value) return;
  closeSummon();
  room.value?.selectRobot(id);
  room.value?.setMode('move');
  codingRobotId.value = id;
}
function replay() {
  codingRobotId.value = null;
  room.value?.reset();
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
  <main class="game-screen" :class="{ 'coding-open': codingRobot }" aria-label="코드모스 우주 디펜스" :style="{ '--portrait-url': portraitUrl }" :data-player-x="state.player.x" :data-player-y="state.player.y">
    <div class="battle-area">
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
    <div class="bottom-controls">
      <div class="robot-button monster-button" role="timer" :aria-label="state.monsterSummonCountdown === null ? '보스급 몬스터 출현' : `보스급 몬스터 자동 출현까지 ${state.monsterSummonCountdown}초`">
        <img class="monster-portrait" :src="monsterArt" alt="" draggable="false" />
        <b>{{ state.monsterSummonCountdown === null ? '보스 출현' : `보스 ${state.monsterSummonCountdown}초` }}</b>
      </div>
      <div class="robot-elements" aria-label="속성 에너지 보유 수량">
        <span v-for="kind in kindOrder" :key="kind" :class="kind" :title="ROBOTS[kind].energyName + ' 에너지'" :aria-label="ROBOTS[kind].energyName + ' 에너지 ' + state.elementEnergy[kind] + '개'">
          <EnergyIcon :kind="kind" /><b>{{ state.elementEnergy[kind] }}</b>
        </span>
      </div>
      <button class="robot-button" :class="{ open: summonOpen }" :disabled="!canDeploy" :aria-label="'로봇, ' + state.robotCount + '대 보유'" aria-haspopup="dialog" aria-controls="robot-hangar" :aria-expanded="summonOpen" @click="openSummon">
        <span class="robot-button-count" role="status" aria-live="polite" aria-atomic="true">{{ state.robotCount }}</span>
        <i class="robot-portrait" :style="robotArt.fire" aria-hidden="true" />
        <b>로봇</b>
      </button>
    </div>
    <p v-if="ready && canDeploy" class="battle-hint" role="status">{{ state.message || '에너지 3개 → 로봇 자동 소환 → 로봇 버튼에서 코딩' }}</p>
    </div>
    <RobotCodingPanel v-if="codingRobot" :key="codingRobot.id" :robot="codingRobot" :interactive="canDeploy && !summonOpen" @change="(slot, block) => room?.updateCode(codingRobot!.id, slot, block)" @run="room?.runCode(codingRobot.id)" @close="codingRobotId = null" />
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="summonOpen" class="summon-backdrop" @click.self="closeSummon">
      <section id="robot-hangar" ref="summonDialog" class="robot-hangar" role="dialog" aria-modal="true" aria-labelledby="hangar-title" tabindex="-1" @keydown="dialogKey">
        <header class="hangar-header"><div><small>ROBOT HANGAR</small><h2 id="hangar-title">소환된 로봇 <b>{{ state.robotCount }}기</b></h2></div><button class="coding-close" aria-label="로봇 목록 닫기" @click="closeSummon">×</button></header>
        <p class="hangar-note">같은 속성 에너지 3개를 모으면 자동 소환돼요.<br />로봇을 선택해 코딩 미션을 시작하세요.</p>
        <div class="robot-roster">
          <section v-for="group in robotGroups" :key="group.kind" class="roster-group" :class="group.kind">
            <h3><EnergyIcon :kind="group.kind" />{{ ROBOTS[group.kind].name }}<small>{{ group.robots.length }}기</small></h3>
            <p v-if="!group.robots.length" class="unsummoned">미소환 · 에너지 {{ state.elementEnergy[group.kind] }}/{{ ROBOT_CHARGE_COST }}</p>
            <button v-for="robot in group.robots" :key="robot.id" class="roster-robot" :class="{ selected: codingRobotId === robot.id, complete: robot.missionStatus === 'completed' }" :disabled="!canDeploy" @click="selectCodingRobot(robot.id)">
              <i class="robot-portrait" :style="robotArt[group.kind]" aria-hidden="true" /><span><b>{{ ROBOTS[group.kind].name }} #{{ robot.serial }}</b><small>{{ robot.missionStatus === 'completed' ? '공격 중 · 코딩 완료' : '코딩 대기 · 공격 대기' }}</small></span><span class="roster-arrow">›</span>
            </button>
          </section>
        </div>
        <p v-if="state.robotCount >= 8" class="hangar-note">현재 배치 한도는 8기예요. 추가 에너지는 보관돼요.</p>
      </section>
    </div>
    <div v-if="finished" class="screen-overlay result-overlay" :class="{ 'defeat-overlay': state.status === 'defeat', 'victory-overlay': state.status === 'cleared' }">
      <section v-if="state.status === 'defeat'" class="defeat-result" role="dialog" aria-modal="true" aria-labelledby="game-over-title" aria-describedby="game-over-description" @keydown.tab.prevent="retryButton?.focus()">
        <div class="result-wave"><i aria-hidden="true" />WAVE 01 <span>전투 종료</span></div>
        <h1 id="game-over-title" class="game-over-title"><img :src="gameOverArt" alt="게임 오버" width="600" height="104" draggable="false" /></h1>
        <p id="game-over-description" class="defeat-description"><strong>우주정거장이 파괴됐어요</strong><span>탈출한 괴물이 우리 기지에 도착했어요.</span></p>
        <dl class="defeat-stats">
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>처치한 괴물</dt><dd>{{ state.kills }}<span>/ {{ state.total }}</span></dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 4H4v16h6m-1-8h12m-5-5 5 5-5 5" /></svg>탈출한 괴물</dt><dd>{{ state.escaped }}<span>마리</span></dd></div>
        </dl>
        <button ref="retryButton" class="retry-button" @click="replay"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg>다시 도전하기</button>
        <p class="retry-tip">로봇의 코딩 미션을 완료해 공격을 활성화해 보세요!</p>
      </section>
      <VictoryResult v-else :wave="state.wave" :kills="state.kills" :total="state.total" :escaped="state.escaped" :reward="WAVE_ONE.clearEnergy" @replay="replay" />
    </div>
  </main>
</template>
