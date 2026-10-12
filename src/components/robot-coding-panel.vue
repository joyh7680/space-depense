<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CODING_BLOCKS, getCodingMission, isCodingBlock, type CodingBlockId } from '../game/coding-missions';
import { ROBOTS } from '../game/wave-one';
import type { RobotState } from '../game/types';
import EnergyIcon from './energy-icon.vue';

const props = defineProps<{ robot: RobotState; wave: number; interactive: boolean }>();
const emit = defineEmits<{ change: [slot: number, block: CodingBlockId | null]; run: [] }>();
const mission = computed(() => getCodingMission(props.robot.kind, props.wave));
const completed = computed(() => props.robot.missionStatus === 'completed');
const draggingBlock = ref<CodingBlockId | null>(null);
const editMessage = ref('');
const overSlot = ref<number | null>(null);
let dragSource: number | null = null;
watch(() => props.robot.id, () => { endDrag(); editMessage.value = ''; });
function addBlock(block: CodingBlockId) {
  if (!props.interactive || completed.value) return;
  const slot = props.robot.code.findIndex(block => block === null);
  if (slot === -1) {
    editMessage.value = '내 코드가 가득 찼어요. 블록을 제거한 뒤 새 블록을 넣어 주세요.';
    return;
  }
  emit('change', slot, block);
  editMessage.value = `${CODING_BLOCKS[block].label} 블록을 ${slot + 1}번째 칸에 넣었어요.`;
}
function drag(event: DragEvent, block: CodingBlockId, source: number | null = null) {
  if (!props.interactive || completed.value) { event.preventDefault(); return; }
  draggingBlock.value = block; dragSource = source;
  event.dataTransfer?.setData('text/plain', block);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = source === null ? 'copy' : 'move';
}
function put(slot: number, block: CodingBlockId) {
  if (!block || !props.interactive || completed.value) return;
  if (dragSource !== null && dragSource !== slot) emit('change', dragSource, props.robot.code[slot]);
  emit('change', slot, block);
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
</script>

<template>
  <aside class="coding-panel" :class="robot.kind" aria-labelledby="coding-title">
    <header class="coding-header"><div><small>ROBOT CODING · WAVE {{ String(mission.number).padStart(2, '0') }}</small><h2 id="coding-title">로봇에게 명령하기</h2></div></header>
    <div class="coding-scroll">
      <div class="coding-robot"><EnergyIcon :kind="robot.kind" /><div><h3>{{ ROBOTS[robot.kind].name }} #{{ robot.serial }}</h3><span :class="{ complete: completed }">{{ completed ? '● 공격 중' : '● 공격 대기 · 코딩 미션' }}</span></div><i class="robot-portrait" :class="'portrait-' + robot.kind" aria-hidden="true" /></div>
      <section class="coding-mission"><small>MISSION {{ mission.number }} <b>{{ mission.concept }}</b></small><p>{{ mission.description }}</p><span>{{ mission.effect }}</span></section>
      <section v-if="completed" class="coding-success" role="status" aria-live="polite" aria-atomic="true">
        <div class="coding-success-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m12 24 8 8 16-16" /></svg></div>
        <span class="coding-success-badge">공격 활성화</span>
        <h3>공격하기 성공!</h3>
        <p>블록을 올바르게 연결했어요.<br />로봇이 명령에 따라 외계인을 공격해요.</p>
      </section>
      <section v-else class="coding-workspace" aria-label="블록코딩 작업 영역">
        <div class="coding-section-title"><h3>내 코드</h3><span>{{ robot.code.filter(Boolean).length }} / {{ mission.slots.length }} 블록</span></div>
        <p v-if="!completed" class="coding-help">{{ mission.autoRun ? '공격 블록을 한 번 클릭해 봐요.' : '블록을 클릭하거나 드래그해서 순서대로 넣어 봐요.' }}</p>
        <div class="code-start">▶ 로봇이 작동하는 동안</div>
        <div class="code-body">
          <div v-for="(slot, index) in mission.slots" :key="index" class="coding-slot-row" :style="{ marginLeft: slot.depth * 16 + 'px' }">
            <button class="coding-slot" :class="[robot.code[index] ? CODING_BLOCKS[robot.code[index]!].category : 'empty', { 'drag-over': overSlot === index }]" :disabled="!interactive || completed" :draggable="!!robot.code[index] && interactive && !completed" :aria-label="`${index + 1}번째 칸: ${robot.code[index] ? CODING_BLOCKS[robot.code[index]!].label : slot.hint}`" @dragstart="robot.code[index] && drag($event, robot.code[index]!, index)" @dragend="endDrag" @dragover.prevent="overSlot = index" @dragleave="overSlot = null" @drop.prevent="drop($event, index)">
              <span class="slot-number">{{ index + 1 }}</span>{{ robot.code[index] ? CODING_BLOCKS[robot.code[index]!].label : slot.hint }}<span v-if="!robot.code[index]" class="slot-plus">+</span>
            </button>
            <button v-if="robot.code[index] && !completed" class="remove-block" :disabled="!interactive" :aria-label="`${index + 1}번째 블록 제거`" @click="removeBlock(index)">×</button>
          </div>
        </div>
        <div class="code-end">{{ mission.autoRun ? '↻ 계속 공격하기' : '↻ 다시 조건 확인하기' }}</div>
      </section>
      <section v-if="!completed" class="coding-palette" aria-label="사용할 수 있는 명령어 블록">
        <div class="coding-section-title"><h3>명령어 블록</h3><span>클릭해서 넣기</span></div>
        <p class="coding-help">{{ mission.autoRun ? '블록을 누르면 코드에 들어가고 자동으로 실행돼요.' : '블록을 누르면 내 코드 영역에 블록이 들어가요.' }}</p>
        <button v-for="block in mission.palette" :key="block" class="palette-block" :class="CODING_BLOCKS[block].category" :disabled="!interactive" :draggable="interactive" @dragstart="drag($event, block)" @dragend="endDrag" @click="addBlock(block)"><span>⠿</span>{{ CODING_BLOCKS[block].label }}</button>
        <p class="coding-edit-message" role="status" aria-live="polite">{{ editMessage }}</p>
      </section>
    </div>
    <footer class="coding-footer">
      <template v-if="!completed">
        <p class="coding-feedback" :class="robot.missionStatus" role="status" aria-live="polite">{{ robot.missionMessage }}</p>
        <button v-if="!mission.autoRun" class="run-code" :disabled="!interactive" @click="emit('run')">▶ 코드 실행</button>
      </template>
      <small>{{ completed ? '로봇은 명령에 따라 계속 공격해요.' : '코딩하는 동안에도 전투는 계속돼요.' }}</small>
    </footer>
  </aside>
</template>
