<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SpaceDefenseRoom from './components/space-defense-room.vue';
import EnergyIcon from './components/energy-icon.vue';
import VictoryResult from './components/victory-result.vue';
import RobotCodingPanel from './components/robot-coding-panel.vue';
import GameGuide from './components/game-guide.vue';
import BossHud from './components/boss-hud.vue';
import { ELEMENTS, ROBOTS, SUMMONED_MONSTER, WAVE_ONE } from './game/wave-one';
import { getAvailableRobotCount, getTotalSummonCount } from './game/robot-energy';
import { robotPortraitStyle } from './game/robot-visuals';
import type { DefenseState, RobotKind } from './game/types';
import { getSummonedMonster } from './game/summoned-monsters';
const room = ref<InstanceType<typeof SpaceDefenseRoom>>();
const ready = ref(false);
const error = ref('');
const summonOpen = ref(false);
const summonDialog = ref<HTMLElement>();
const codingRobotId = ref<number | null>(null);
const openRecipe = ref<RobotKind | null>(null);
const codingRobot = computed(() => state.value.robots.find(robot => robot.id === codingRobotId.value));
const portraitAssetUrl = new URL(`${import.meta.env.BASE_URL}codmos-assets/player/int-front.png`, document.baseURI).href;
const portraitUrl = `url("${portraitAssetUrl}")`;
const gameOverArt = `${import.meta.env.BASE_URL}codmos-assets/e56bb4d926f2/6a69a85b-2fab-4322-8b87-30a4eab82980.png`;
const monsterArt = computed(() => `${import.meta.env.BASE_URL}codmos-assets/${getSummonedMonster(Math.max(1, state.value.wave) - 1).portrait}`);
const retryButton = ref<HTMLButtonElement>();
const state = ref<DefenseState>({ status: 'ready', wave: 0, health: 100, credits: 300, elementEnergy: { fire: 0, electric: 0, ice: 0 }, kills: 0, enemies: 0, spawned: 0, total: WAVE_ONE.enemies + 1, escaped: 0, elapsed: 0, countdown: 3, monsterSummonCountdown: SUMMONED_MONSTER.summonDelay, nextBossNumber: 1, bossApproaching: false, bossHealth: null, robots: [], robotCount: 0, storedRobotCount: 0, selectedId: null, player: { x: 5, y: 4 }, mode: 'move', grid: false, message: '', defeatAnimationComplete: false, victoryAnimationComplete: false });
const remainingHearts = computed(() => Math.max(0, Math.min(10, Math.ceil(state.value.health / 10))));
const canDeploy = computed(() => ready.value && state.value.status === 'running');
const finished = computed(() => (state.value.status === 'cleared' && (state.value.wave < 3 || state.value.victoryAnimationComplete)) || (state.value.status === 'defeat' && state.value.defeatAnimationComplete));
watch(() => state.value.status, status => {
  if (status === 'defeat' || status === 'cleared') { codingRobotId.value = null; closeSummon(); }
});
watch(() => state.value.robots.length, count => {
  if (count === 0) {
    codingRobotId.value = null;
  }
});
watch(finished, async visible => {
  if (visible && state.value.status === 'defeat') {
    await nextTick();
    retryButton.value?.focus({ preventScroll: true });
  }
});
watch([finished, () => state.value.wave], ([visible, wave], _previous, onCleanup) => {
  if (!visible || state.value.status !== 'cleared' || wave >= 3) return;
  const timer = window.setTimeout(nextWave, 1000);
  onCleanup(() => window.clearTimeout(timer));
});
const kindOrder = ['electric', 'ice', 'fire'] as const;
const robotStatus = computed(() => (['electric', 'ice', 'fire'] as const).map(kind => ({
  kind, count: getAvailableRobotCount(state.value.elementEnergy, state.value.robots, kind),
})));
const summonCount = computed(() => getTotalSummonCount(state.value.elementEnergy, state.value.robots));
watch([canDeploy, summonCount], ([deployable, count], [wasDeployable, previousCount]) => {
  if (!deployable) {
    closeSummon();
  } else if (count > 0 && (!wasDeployable || count > previousCount)) {
    void openSummon();
  }
});
const robotArt = {
 fire: robotPortraitStyle('fire'),
 ice: robotPortraitStyle('ice'),
 electric: robotPortraitStyle('electric'),
};
function selectCodingRobot(id: number) {
  if (!canDeploy.value || !state.value.robots.some(robot => robot.id === id && robot.deployed)) return;
  closeSummon();
  codingRobotId.value = id;
}
async function openSummon() {
  if (!canDeploy.value) return;
  summonOpen.value = true;
  await nextTick();
  summonDialog.value?.focus({ preventScroll: true });
}
function closeSummon() { summonOpen.value = false; openRecipe.value = null; }
async function summonRobot(kind: RobotKind) {
  if (canDeploy.value && room.value?.deployRobotKind(kind)) {
    codingRobotId.value = null;
    await nextTick();
    summonDialog.value?.focus({ preventScroll: true });
  }
}
function replay() {
  closeSummon();
  codingRobotId.value = null;
  room.value?.reset();
}
function nextWave() {
  closeSummon();
  codingRobotId.value = null;
  room.value?.startWave();
}
</script>
<template>
  <main class="game-screen" aria-label="코드모스 우주 디펜스" :style="{ '--portrait-url': portraitUrl }" :data-player-x="state.player.x" :data-player-y="state.player.y">
    <GameGuide v-if="ready && !error" :battle-running="state.status === 'running'" />
    <div class="battle-area">
    <SpaceDefenseRoom ref="room" @state="state = $event" @ready="ready = true" @error="error = $event" @inspect="selectCodingRobot" />
    <div v-if="ready && !error && state.status === 'ready'" class="countdown-hud" role="status" aria-live="polite" aria-atomic="true">
      <small>{{ state.wave > 1 ? `웨이브 ${state.wave} 시작까지` : '게임 시작까지' }}</small>
      <strong>{{ state.countdown }}</strong>
      <span>잠시 후 전투가 시작돼요!</span>
    </div>
    <div class="profile-hud">
      <div class="profile-avatar"><i class="codmos-portrait" /></div>
      <div><small>Lv. 1 <span>ϟ {{ state.credits }}</span></small><strong>우주 지휘관</strong></div>
    </div>
    <div class="wave-hud" aria-label="전투 현황">
      <div class="wave-counter"><small>WAVE</small><strong>{{ String(Math.max(1, state.wave)).padStart(2, '0') }}</strong></div>
      <div class="battle-progress"><div><b>{{ state.status === 'ready' ? '잠시 후 자동 시작' : '우주정거장 방어' }}</b><span>{{ state.kills }} / {{ state.total }}</span></div><div class="progress-track"><i :style="{ width: state.kills / state.total * 100 + '%' }" /></div></div>
      <div class="player-health" role="img" :aria-label="`정거장 체력: 하트 10개 중 ${remainingHearts}개`">
        <span v-for="heart in 10" :key="heart" :class="{ empty: heart > remainingHearts }" aria-hidden="true">♥</span>
      </div>
    </div>
    <BossHud v-if="ready && !error" :approaching="state.bossApproaching" :health="state.bossHealth" />
    <div class="bottom-controls">
      <div class="robot-button monster-button" role="timer" :aria-label="state.monsterSummonCountdown === null ? `${Math.max(1, state.wave)}번 보스 출현` : `${state.nextBossNumber}번 보스 자동 출현까지 ${state.monsterSummonCountdown}초`">
        <span v-if="state.monsterSummonCountdown !== null" class="robot-button-count monster-summon-timer" aria-hidden="true">{{ state.monsterSummonCountdown }}s</span>
        <img class="monster-portrait" :src="monsterArt" alt="" draggable="false" />
        <b>보스몹 출현</b>
      </div>
      <div class="robot-elements" aria-label="속성 에너지 보유 수량">
        <span v-for="kind in kindOrder" :key="kind" :class="kind" :title="`${ELEMENTS[kind].name} 에너지`" :aria-label="ELEMENTS[kind].name + ' 에너지 ' + state.elementEnergy[kind] + '개'">
          <EnergyIcon :kind="kind" /><b>{{ state.elementEnergy[kind] }}</b>
        </span>
      </div>
      <button class="robot-button" :class="{ open: summonOpen, empty: summonCount === 0 }" :disabled="!canDeploy" :aria-label="`로봇 배치, 소환 가능 ${summonCount}대`" aria-haspopup="dialog" aria-controls="robot-hangar" :aria-expanded="summonOpen" @click="openSummon">
        <span class="robot-button-count">{{ summonCount }}</span>
        <i class="robot-portrait" :style="robotArt.fire" aria-hidden="true" />
        <b>로봇 배치</b>
      </button>
      <Transition name="battle-hint">
        <p v-if="canDeploy && state.message && !summonOpen" class="battle-hint" role="status" aria-atomic="true">{{ state.message }}</p>
      </Transition>
    </div>
    </div>
    <div v-if="summonOpen" class="summon-backdrop" @click.self="closeSummon">
      <section id="robot-hangar" ref="summonDialog" class="robot-status-hud" :class="{ empty: summonCount === 0 }" role="dialog" aria-modal="false" aria-label="로봇 선택" tabindex="-1" @keydown.esc="closeSummon">
        <div class="robot-status-roster">
          <div v-for="card in robotStatus" :key="card.kind" class="robot-card-slot" :class="card.kind">
            <button class="robot-button robot-status-unit" :class="card.kind" :disabled="!canDeploy || !card.count" :aria-label="`${ROBOTS[card.kind].name}, 소환 가능 ${card.count}대, ${ROBOTS[card.kind].description}`" @click="summonRobot(card.kind)">
              <span class="robot-button-count robot-status-count">{{ card.count }}</span>
              <i class="robot-portrait" :style="robotArt[card.kind]" aria-hidden="true" />
              <b>{{ ROBOTS[card.kind].name }}</b>
            </button>
            <div class="robot-info" :class="{ open: openRecipe === card.kind }">
              <button class="robot-info-button" type="button" :aria-label="`${ROBOTS[card.kind].name} 에너지 조합 보기`" :aria-describedby="`robot-recipe-${card.kind}`" :aria-expanded="openRecipe === card.kind" @click="openRecipe = openRecipe === card.kind ? null : card.kind">?</button>
              <div :id="`robot-recipe-${card.kind}`" class="robot-recipe-tooltip" role="tooltip">
                <template v-for="(part, index) in ROBOTS[card.kind].recipe" :key="part.kind">
                  <span v-if="index" class="recipe-plus" aria-hidden="true">+</span>
                  <span class="recipe-part" :aria-label="`${ELEMENTS[part.kind].name} ${part.amount}개`"><EnergyIcon :kind="part.kind" /><b>{{ part.amount }}</b></span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <RobotCodingPanel v-if="codingRobot" :key="`${state.wave}-${codingRobot.id}`" :robot="codingRobot" :wave="state.wave" :interactive="canDeploy" @close="codingRobotId = null" @change="(slot, block, sourceSlot) => room?.updateCode(codingRobot!.id, slot, block, sourceSlot)" />
    <div v-if="!ready || error" class="screen-overlay loading-overlay"><div class="loading-orbit">✦</div><p>{{ error || '우주정거장에 도착하는 중…' }}</p></div>
    <div v-if="finished" class="screen-overlay result-overlay" :class="{ 'defeat-overlay': state.status === 'defeat', 'victory-overlay': state.status === 'cleared' }">
      <section v-if="state.status === 'defeat'" class="defeat-result" role="dialog" aria-modal="true" aria-labelledby="game-over-title" aria-describedby="game-over-description" @keydown.tab.prevent="retryButton?.focus()">
        <div class="result-wave"><i aria-hidden="true" />WAVE {{ String(Math.max(1, state.wave)).padStart(2, '0') }} <span>전투 종료</span></div>
        <h1 id="game-over-title" class="game-over-title"><img :src="gameOverArt" alt="게임 오버" width="600" height="104" draggable="false" /></h1>
        <p id="game-over-description" class="defeat-description"><strong>우주정거장이 파괴됐어요</strong><span>탈출한 괴물이 우리 기지에 도착했어요.</span></p>
        <dl class="defeat-stats">
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>처치한 괴물</dt><dd>{{ state.kills }}<span>/ {{ state.total }}</span></dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 4H4v16h6m-1-8h12m-5-5 5 5-5 5" /></svg>탈출한 괴물</dt><dd>{{ state.escaped }}<span>마리</span></dd></div>
        </dl>
        <button ref="retryButton" class="retry-button" @click="replay"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg>다시 도전하기</button>
        <p class="retry-tip">로봇의 코딩 미션을 완료해 공격을 활성화해 보세요!</p>
      </section>
      <VictoryResult v-else :wave="state.wave" :kills="state.kills" :total="state.total" :escaped="state.escaped" :reward="WAVE_ONE.clearEnergy" @replay="replay" @next="nextWave" />
    </div>
  </main>
</template>
