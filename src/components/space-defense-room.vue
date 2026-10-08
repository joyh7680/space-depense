<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { DefenseState, GameController, GameMode } from '../game/types';

const emit = defineEmits<{ state: [state: DefenseState]; ready: []; error: [message: string] }>();
const host = ref<HTMLElement>();
let controller: GameController | undefined;
let disposed = false;

onMounted(async () => {
  try {
    const { createDefenseGame } = await import('../game/create-game');
    if (disposed || !host.value) return;
    let didReady = false;
    controller = createDefenseGame({
      parent: host.value,
      onState: state => {
        emit('state', state);
        if (!didReady) { didReady = true; emit('ready'); }
      },
      onError: message => emit('error', message),
    });
  } catch { emit('error', '게임을 시작하지 못했습니다. 새로고침해 주세요.'); }
});
onBeforeUnmount(() => { disposed = true; controller?.destroy(); });

defineExpose({
  setMode: (mode: GameMode) => controller?.setMode(mode),
  toggleGrid: () => controller?.toggleGrid(),
  startWave: () => controller?.startWave(),
  togglePause: () => controller?.togglePause(),
  reset: () => controller?.reset(),
});
</script>

<template>
  <div ref="host" class="game-canvas" role="application" aria-label="우주 디펜더 게임방. 바닥 클릭 또는 방향키와 WASD로 이동합니다." tabindex="0" />
</template>

<style scoped>
.game-canvas { position: absolute; inset: 0; width: 100%; height: 100%; outline: none; }
.game-canvas:focus-visible { outline: 2px solid #8ee6db; outline-offset: -4px; }
.game-canvas :deep(canvas) { display: block; }
</style>
