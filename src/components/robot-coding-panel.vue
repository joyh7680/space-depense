<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { getCodingBlock, getCodingMission, isCodingBlock, type CodingBlockId } from '../game/coding-missions';
import { ROBOTS } from '../game/wave-one';
import { robotPortraitStyle } from '../game/robot-visuals';
import type { PlaybackSpeed, RobotState } from '../game/types';
import CodingSuccessEffect from './coding-success-effect.vue';

const props = defineProps<{ robot: RobotState; wave: number; interactive: boolean; paused: boolean; playbackSpeed: PlaybackSpeed }>();
const emit = defineEmits<{ change: [slot: number, block: CodingBlockId | null, sourceSlot?: number]; clear: []; run: []; close: []; pause: []; speed: [] }>();
const mission = computed(() => getCodingMission(props.robot.kind, props.robot.missionNumber, props.robot.missionVariant));
const completed = computed(() => props.robot.missionStatus === 'completed');
const draggingBlock = ref<CodingBlockId | null>(null);
const editMessage = ref('');
const missionDetailsOpen = ref(false);
const missionDetailsId = useId();
const overSlot = ref<number | null>(null);
let dragSource: number | null = null;
watch(() => `${props.robot.id}-${props.robot.missionNumber}`, () => { endDrag(); editMessage.value = ''; missionDetailsOpen.value = false; });
watch([() => props.robot.id, () => props.robot.missionNumber, completed, () => props.paused], ([_id, _missionNumber, done, paused], _previous, onCleanup) => {
  if (!done || paused) return;
  const timer = window.setTimeout(() => emit('close'), 1800);
  onCleanup(() => window.clearTimeout(timer));
}, { immediate: true, flush: 'post' });
function addBlock(block: CodingBlockId) {
  if (!props.interactive || completed.value) return;
  const slot = props.robot.code.findIndex(block => block === null);
  if (slot === -1) {
    editMessage.value = '내 코드가 가득 찼어요. 블록을 제거한 뒤 새 블록을 넣어 주세요.';
    return;
  }
  emit('change', slot, block);
  editMessage.value = `${getCodingBlock(block).label} 블록을 ${slot + 1}번째 칸에 넣었어요.`;
}
function drag(event: DragEvent, block: CodingBlockId, source: number | null = null) {
  if (!props.interactive || completed.value) { event.preventDefault(); return; }
  draggingBlock.value = block; dragSource = source;
  event.dataTransfer?.setData('text/plain', block);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = source === null ? 'copy' : 'move';
}
function put(slot: number, block: CodingBlockId) {
  if (!block || !props.interactive || completed.value) return;
  emit('change', slot, block, dragSource ?? undefined);
  editMessage.value = '';
  endDrag();
}
function drop(event: DragEvent, slot: number) {
  const block = event.dataTransfer?.getData('text/plain') ?? '';
  if (draggingBlock.value === block && isCodingBlock(block) && mission.value.palette.includes(block)) put(slot, block);
  overSlot.value = null;
}
function endDrag() { overSlot.value = null; dragSource = null; draggingBlock.value = null; }
function removeBlock(slot: number) {
  emit('change', slot, null);
  editMessage.value = '';
}
function clearBlocks() {
  if (!props.interactive || completed.value || !props.robot.code.some(Boolean)) return;
  endDrag();
  emit('clear');
  editMessage.value = '놓은 블록을 모두 비웠어요.';
}
function runCode() {
  editMessage.value = '';
  emit('run');
}
</script>

<template>
  <aside class="coding-panel" :class="robot.kind" aria-labelledby="coding-title">
    <header class="coding-header"><div><small>ROBOT CODING · WAVE {{ String(Math.max(1, wave)).padStart(2, '0') }}</small><h2 id="coding-title">로봇에게 명령하기</h2></div><button class="coding-close" type="button" aria-label="코딩 패널 닫기" @click="emit('close')">×</button></header>
    <div class="coding-content">
      <section class="coding-mission" @keydown.esc="missionDetailsOpen = false">
        <div class="coding-mission-header">
          <small>WAVE {{ mission.number }} {{ mission.title }} · {{ robot.deploymentOrder }}번째 배치</small>
          <b class="coding-mission-concept">{{ mission.concept }}</b>
          <button class="coding-mission-help" type="button" :aria-label="missionDetailsOpen ? '미션 세부 설명 닫기' : '미션 세부 설명 열기'" :aria-expanded="missionDetailsOpen" :aria-controls="missionDetailsId" @click="missionDetailsOpen = !missionDetailsOpen">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" /><circle class="question-dot" cx="12" cy="16" r=".75" /></svg>
          </button>
        </div>
        <p class="coding-mission-summary">{{ mission.summary }}</p>
        <div v-show="missionDetailsOpen" :id="missionDetailsId" class="coding-mission-details">
          <p>{{ mission.description }}</p>
          <p>{{ mission.effect }}</p>
          <p>이번 미션 {{ mission.slots.length }}개 · Wave 최대 {{ mission.maxBlocks }}개 (제어 블록 포함)</p>
        </div>
      </section>
      <section v-if="completed" :key="`${robot.id}-${mission.number}`" class="coding-success" role="status" aria-live="polite" aria-atomic="true">
        <div class="coding-success-meta"><span>MISSION COMPLETE</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8" /></svg></div>
        <div class="coding-success-art" aria-hidden="true">
          <div class="coding-success-orbit" />
          <div class="coding-success-platform" />
          <i class="robot-portrait" :style="robotPortraitStyle(robot.kind)" aria-hidden="true" />
          <CodingSuccessEffect />
        </div>
        <h3>공격 성공!</h3>
        <p class="coding-success-subtitle">{{ ROBOTS[robot.kind].name }}의 기본 자동 공격이 활성화됐어요.</p>
        <div class="coding-success-status"><span class="coding-success-dot" />기본 자동 공격 활성화<span class="coding-success-status-check" aria-hidden="true">✓</span></div>
        <p class="coding-success-note">이 로봇은 이번 웨이브에서 계속 공격해요.<br />다음 웨이브에서는 에너지와 로봇이 초기화돼요.</p>
      </section>
      <div v-else class="coding-columns">
        <section class="coding-workspace" aria-label="블록코딩 작업 영역">
          <div class="coding-section-title"><h3>내 코드</h3><span>{{ robot.code.filter(Boolean).length }} / {{ mission.slots.length }} 블록</span></div>
          <div class="coding-workspace-tools">
            <p class="coding-help">블록을 클릭하거나 드래그해서 순서대로 넣어 봐요.</p>
            <button class="clear-blocks" type="button" :disabled="!interactive || !robot.code.some(Boolean)" @click="clearBlocks">블록 비우기</button>
          </div>
          <div class="coding-block-list">
            <div class="code-start">▶ 로봇이 작동하는 동안</div>
            <div class="code-body">
              <div v-for="(slot, index) in mission.slots" :key="index" class="coding-slot-row" :style="{ marginLeft: slot.depth * 16 + 'px' }">
                <button class="coding-slot" :class="[robot.code[index] ? getCodingBlock(robot.code[index]!).category : 'empty', { 'drag-over': overSlot === index }]" :disabled="!interactive || completed" :draggable="!!robot.code[index] && interactive && !completed" :aria-label="`${index + 1}번째 칸: ${robot.code[index] ? getCodingBlock(robot.code[index]!).label : '+ 여기에 블록 놓기'}`" @dragstart="robot.code[index] && drag($event, robot.code[index]!, index)" @dragend="endDrag" @dragover.prevent="overSlot = index" @dragleave="overSlot = null" @drop.prevent="drop($event, index)">
                  <span class="slot-number">{{ index + 1 }}</span>{{ robot.code[index] ? getCodingBlock(robot.code[index]!).label : '+ 여기에 블록 놓기' }}
                </button>
                <button v-if="robot.code[index] && !completed" class="remove-block" :disabled="!interactive" :aria-label="`${index + 1}번째 블록 제거`" @click="removeBlock(index)">×</button>
              </div>
            </div>
            <div class="code-end">↻ 기본 자동 공격 계속하기</div>
          </div>
        </section>
        <section class="coding-palette" aria-label="사용할 수 있는 명령어 블록">
          <div class="coding-section-title"><h3>명령어 블록</h3><span>클릭해서 넣기</span></div>
          <p class="coding-help">블록을 올바르게 연결하면 자동으로 공격해요.</p>
          <div class="coding-block-list">
            <button v-for="block in mission.palette" :key="block" class="palette-block" :class="getCodingBlock(block).category" :disabled="!interactive" :draggable="interactive" @dragstart="drag($event, block)" @dragend="endDrag" @click="addBlock(block)"><span>⠿</span>{{ getCodingBlock(block).label }}</button>
          </div>
        </section>
      </div>
    </div>
    <footer class="coding-footer">
      <p class="coding-feedback" :class="robot.missionStatus" role="status" aria-live="polite">{{ paused ? '일시정지 중이에요. 다시시작 버튼을 누르면 이어서 진행해요.' : editMessage || robot.missionMessage }}</p>
      <div class="coding-playback-controls">
        <button class="coding-playback-button coding-pause" type="button" :disabled="!interactive && !paused" :aria-label="paused ? '다시시작' : '일시정지'" :title="paused ? '게임 이어서 진행' : '게임 일시정지'" @click="emit('pause')">
          <svg v-if="paused" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
          <span>{{ paused ? '다시시작' : '일시정지' }}</span>
        </button>
        <button class="launch-button coding-run" type="button" :disabled="!interactive || completed" @click="runCode"><span aria-hidden="true">▶</span>코딩 실행하기</button>
        <button class="coding-playback-button coding-speed" :class="{ active: playbackSpeed === 2 }" type="button" :disabled="!interactive && !paused" :aria-pressed="playbackSpeed === 2" aria-label="2배속" :title="playbackSpeed === 2 ? '기본 속도로 전환' : '2배속으로 전환'" @click="emit('speed')"><span>2배속</span></button>
      </div>
    </footer>
  </aside>
</template>
