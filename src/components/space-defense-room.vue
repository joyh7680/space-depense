<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { DefenseState, GameController, GameMode, RobotKind } from '../game/types';
import type { CodingBlockId } from '../game/coding-missions';

const emit = defineEmits<{ state: [state: DefenseState]; ready: []; error: [message: string]; inspect: [id: number] }>();
const host = ref<HTMLElement>();
let controller: GameController | undefined;
let disposed = false;

onMounted(async () => {
  try {
    const { createDefenseGame } = await import('../game/create-game');
    if (disposed || !host.value) return;
    let didReady = false;
    controller = await createDefenseGame({
      parent: host.value,
      onState: state => {
        emit('state', state);
        if (!didReady) { didReady = true; emit('ready'); }
      },
      onError: message => emit('error', message),
      onInspect: id => emit('inspect', id),
    });
    if (disposed) controller.destroy();
  } catch { emit('error', '게임을 시작하지 못했습니다. 새로고침해 주세요.'); }
});
onBeforeUnmount(() => { disposed = true; controller?.destroy(); });

defineExpose({
  setInteractionLocked: (locked: boolean) => controller?.setInteractionLocked(locked),
  setMode: (mode: GameMode) => controller?.setMode(mode),
  summon: (kind: RobotKind) => controller?.summon(kind),
  deployRobot: (id: number) => controller?.deployRobot(id) ?? false,
  deployRobotKind: (kind: RobotKind) => controller?.deployRobotKind(kind) ?? false,
  selectRobot: (id: number) => controller?.selectRobot(id),
  updateCode: (id: number, slot: number, block: CodingBlockId | null, sourceSlot?: number) => controller?.updateCode(id, slot, block, sourceSlot),
  runCode: (id: number) => controller?.runCode(id),
  merge: () => controller?.merge(),
  toggleGrid: () => controller?.toggleGrid(),
  startWave: () => controller?.startWave(),
  togglePause: () => controller?.togglePause(),
  reset: () => controller?.reset(),
});
</script>

<template>
  <div ref="host" class="game-canvas" role="application" aria-label="우주 코딩 디펜스. 캐릭터나 소환된 로봇을 마우스 또는 터치로 직접 드래그해서 길 밖의 빈 바닥에 배치합니다." tabindex="0" />
</template>

<style scoped>
.game-canvas { position: absolute; inset: 0; width: 100%; height: 100%; outline: none; }
.game-canvas :deep(canvas) { display: block; touch-action: none; }
</style>
