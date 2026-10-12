<script setup lang="ts">
import type { RobotKind } from '../game/types';
defineProps<{ kind: RobotKind }>();
</script>

<template>
  <svg class="element-icon" viewBox="0 0 20 20" aria-hidden="true">
    <path v-if="kind === 'electric'" class="element-shape" fill="#ffd65c" d="m11.5 1.5-7 9h4l-1 8 8-10h-4z" />
    <template v-else-if="kind === 'ice'">
      <g fill="none" stroke="#6dcaff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path v-for="angle in [0, 60, 120, 180, 240, 300]" :key="angle" :transform="`rotate(${angle} 10 10)`" d="M10 1.5V10M7.5 3.5 10 6l2.5-2.5" />
      </g>
      <circle cx="10" cy="10" r="1.2" fill="#c5efff" />
    </template>
    <template v-else>
      <path class="element-shape" fill="#f8758e" d="M11 1.5c.7 4-3.5 4.5-3.2 8-1.3-.5-1.8-1.4-1.8-2.5-2 2.2-3.1 4-2.4 6.8a6.7 6.7 0 0 0 12.8 0C17.5 9.6 14.7 6.3 11 1.5Z" />
      <path fill="#ffb3b5" d="M10.4 9.6c.2 2-2.4 2.8-2.4 4.5a2.1 2.1 0 0 0 4.2 0c0-1.5-.8-2.8-1.8-4.5Z" />
    </template>
  </svg>
</template>
