<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CODING_BLOCKS, CODING_MISSIONS, isCodingBlock, type CodingBlockId } from '../game/coding-missions';
import { ROBOTS } from '../game/wave-one';
import type { RobotState } from '../game/types';
import EnergyIcon from './energy-icon.vue';

const props = defineProps<{ robot: RobotState; interactive: boolean }>();
const emit = defineEmits<{ change: [slot: number, block: CodingBlockId | null]; run: []; close: [] }>();
const mission = computed(() => CODING_MISSIONS[props.robot.kind]);
const completed = computed(() => props.robot.missionStatus === 'completed');
const chosen = ref<CodingBlockId | null>(null);
const overSlot = ref<number | null>(null);
let dragSource: number | null = null;
watch(() => props.robot.id, () => { chosen.value = null; overSlot.value = null; dragSource = null; });
function drag(event: DragEvent, block: CodingBlockId, source: number | null = null) {
  if (!props.interactive || completed.value) { event.preventDefault(); return; }
  chosen.value = block; dragSource = source;
  event.dataTransfer?.setData('text/plain', block);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = source === null ? 'copy' : 'move';
}
function put(slot: number, block = chosen.value) {
  if (!block || !props.interactive || completed.value) return;
  if (dragSource !== null && dragSource !== slot) emit('change', dragSource, props.robot.code[slot]);
  emit('change', slot, block);
  chosen.value = null; overSlot.value = null; dragSource = null;
}
function drop(event: DragEvent, slot: number) {
  const block = event.dataTransfer?.getData('text/plain') ?? '';
  if (isCodingBlock(block) && mission.value.palette.includes(block)) put(slot, block);
  overSlot.value = null;
}
function endDrag() { overSlot.value = null; dragSource = null; chosen.value = null; }
</script>

<template>
  <aside class="coding-panel" :class="robot.kind" aria-labelledby="coding-title">
    <header class="coding-header"><div><small>ROBOT CODING · WAVE 01</small><h2 id="coding-title">로봇에게 명령하기</h2></div><button class="coding-close" aria-label="코딩 패널 닫기" @click="emit('close')">×</button></header>
    <div class="coding-scroll">
      <div class="coding-robot"><EnergyIcon :kind="robot.kind" /><div><h3>{{ ROBOTS[robot.kind].name }} #{{ robot.serial }}</h3><span :class="{ complete: completed }">{{ completed ? '● 공격 중' : '● 공격 대기 · 코딩 미션' }}</span></div><i class="robot-portrait" :class="'portrait-' + robot.kind" aria-hidden="true" /></div>
      <section class="coding-mission"><small>MISSION <b>{{ mission.concept }}</b></small><p>{{ mission.description }}</p><span>{{ mission.effect }}</span></section>
      <section class="coding-workspace" aria-label="블록코딩 작업 영역">
        <div class="coding-section-title"><h3>내 코드</h3><span>{{ robot.code.filter(Boolean).length }} / {{ mission.slots.length }} 블록</span></div>
        <div class="code-start">▶ 로봇이 작동하는 동안</div>
        <div class="code-body">
          <div v-for="(slot, index) in mission.slots" :key="index" class="coding-slot-row" :style="{ marginLeft: slot.depth * 16 + 'px' }">
            <button class="coding-slot" :class="[robot.code[index] ? CODING_BLOCKS[robot.code[index]!].category : 'empty', { 'drag-over': overSlot === index }]" :disabled="!interactive || completed" :draggable="!!robot.code[index] && interactive && !completed" :aria-label="`${index + 1}번째 칸: ${robot.code[index] ? CODING_BLOCKS[robot.code[index]!].label : slot.hint}`" @dragstart="robot.code[index] && drag($event, robot.code[index]!, index)" @dragend="endDrag" @dragover.prevent="overSlot = index" @dragleave="overSlot = null" @drop.prevent="drop($event, index)" @click="put(index)">
              <span class="slot-number">{{ index + 1 }}</span>{{ robot.code[index] ? CODING_BLOCKS[robot.code[index]!].label : slot.hint }}<span v-if="!robot.code[index]" class="slot-plus">+</span>
            </button>
            <button v-if="robot.code[index] && !completed" class="remove-block" :disabled="!interactive" :aria-label="`${index + 1}번째 블록 제거`" @click="emit('change', index, null)">×</button>
          </div>
        </div>
        <div class="code-end">↻ 다시 조건 확인하기</div>
      </section>
      <section v-if="!completed" class="coding-palette" aria-label="사용할 수 있는 명령어 블록">
        <div class="coding-section-title"><h3>명령어 블록</h3><span>드래그해서 끼워 넣기</span></div>
        <p class="coding-help">블록을 누른 뒤 빈칸을 눌러도 넣을 수 있어요.</p>
        <button v-for="block in mission.palette" :key="block" class="palette-block" :class="[CODING_BLOCKS[block].category, { chosen: chosen === block }]" :disabled="!interactive" :draggable="interactive" :aria-pressed="chosen === block" @dragstart="drag($event, block)" @dragend="endDrag" @click="chosen = chosen === block ? null : block; dragSource = null"><span>⠿</span>{{ CODING_BLOCKS[block].label }}</button>
        <p v-if="chosen" class="chosen-hint" role="status">넣을 칸을 눌러 주세요.</p>
      </section>
    </div>
    <footer class="coding-footer"><p class="coding-feedback" :class="robot.missionStatus" role="status" aria-live="polite">{{ robot.missionMessage }}</p><button class="run-code" :disabled="!interactive || completed" @click="emit('run')">{{ completed ? '✓ 코딩 완료 · 공격 활성화' : '▶ 코드 실행' }}</button><small>코딩하는 동안에도 전투는 계속돼요.</small></footer>
  </aside>
</template>
