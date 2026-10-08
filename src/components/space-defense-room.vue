<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { DefenseState, GameController, GameMode } from '../game/types';

const emit = defineEmits<{ state: [state: DefenseState]; ready: []; error: [message: string]; inspect: [] }>();
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
      onInspect: () => emit('inspect'),
    });
    if (disposed) controller.destroy();
  } catch { emit('error', '게임을 시작하지 못했습니다. 새로고침해 주세요.'); }
});
onBeforeUnmount(() => { disposed = true; controller?.destroy(); });

defineExpose({
  setMode: (mode: GameMode) => controller?.setMode(mode),
  summon: () => controller?.summon(),
  selectDrone: (id: number) => controller?.selectDrone(id),
  merge: () => controller?.merge(),
  toggleGrid: () => controller?.toggleGrid(),
  startWave: () => controller?.startWave(),
  togglePause: () => controller?.togglePause(),
  reset: () => controller?.reset(),
});
</script>

<template>
  <div ref="host" class="game-canvas" role="application" aria-label="우주 코딩 디펜스. 드론을 클릭하면 선택합니다. 빛나는 칸에 드론을 배치할 수 있습니다." tabindex="0" />
</template>

<style scoped>
.game-canvas { position: absolute; inset: 0; width: 100%; height: 100%; outline: none; }
.game-canvas:focus-visible { outline: 2px solid #8ee6db; outline-offset: -4px; }
.game-canvas :deep(canvas) { display: block; }
</style>
