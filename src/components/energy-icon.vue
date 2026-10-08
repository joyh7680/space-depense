<script setup lang="ts">
import type { RobotKind } from '../game/types';
defineProps<{ kind: RobotKind }>();
</script>

<template>
  <svg class="element-icon" viewBox="0 0 20 20" aria-hidden="true">
    <path v-if="kind === 'electric'" class="element-shape" fill="#ffd65c" d="m11.5 1.5-7 9h4l-1 8 8-10h-4z" />
    <template v-else-if="kind === 'ice'">
      <path class="element-shape" fill="#62d9df" d="M10 1.5C8 5 4 8.8 4 12.3a6 6 0 0 0 12 0C16 8.8 12 5 10 1.5Z" />
      <path fill="none" stroke="#b8f4f3" stroke-width="1.5" stroke-linecap="round" d="M6.8 11.8c-.3 1.5.4 2.7 1.5 3.1" />
    </template>
    <template v-else>
      <path class="element-shape" fill="#f8758e" d="M11 1.5c.7 4-3.5 4.5-3.2 8-1.3-.5-1.8-1.4-1.8-2.5-2 2.2-3.1 4-2.4 6.8a6.7 6.7 0 0 0 12.8 0C17.5 9.6 14.7 6.3 11 1.5Z" />
      <path fill="#ffb3b5" d="M10.4 9.6c.2 2-2.4 2.8-2.4 4.5a2.1 2.1 0 0 0 4.2 0c0-1.5-.8-2.8-1.8-4.5Z" />
    </template>
  </svg>
</template>
