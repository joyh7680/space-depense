<script setup lang="ts">
import { computed } from 'vue';
import type { BossHealth } from '../game/types';

const props = defineProps<{ approaching: boolean; health: BossHealth | null }>();
const healthPercent = computed(() => props.health ? Math.max(0, Math.min(100, props.health.health / props.health.maxHealth * 100)) : 0);
</script>

<template>
  <div v-if="approaching || health" class="boss-hud">
    <div v-if="approaching" class="boss-warning" role="alert" aria-atomic="true">⚠️ 강력한 보스몹 접근 중!</div>
    <div v-else-if="health" class="boss-health-panel">
      <div class="boss-health-label"><strong>보스몹 HP</strong><span>{{ Math.ceil(health.health) }} / {{ health.maxHealth }}</span></div>
      <div class="boss-health-track" role="progressbar" aria-label="보스몹 체력" :aria-valuenow="Math.ceil(health.health)" :aria-valuemax="health.maxHealth" :aria-valuemin="0">
        <div class="boss-health-fill" :style="{ width: `${healthPercent}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.boss-hud{position:absolute;left:50%;top:112px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:3;pointer-events:none}
.boss-warning{padding:15px 18px;border:2px solid #ffb45d;border-radius:14px;background:#39221af5;box-shadow:0 4px 20px #0005;color:#ffe3a1;text-align:center;font-size:20px;font-weight:900;word-break:keep-all}
.boss-health-panel{padding:12px 16px;border:2px solid #b85668;border-radius:14px;background:#201827f2;box-shadow:0 4px 18px #0005}
.boss-health-label{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;font-size:14px}
.boss-health-label strong{color:#ffc2ca}.boss-health-label span{color:#fff;font-variant-numeric:tabular-nums}
.boss-health-track{height:20px;border:1px solid #763443;border-radius:8px;background:#3c1e2a;overflow:hidden}
.boss-health-fill{height:100%;background:linear-gradient(90deg,#d73555,#ff8874);transition:width .12s linear}
@media(max-width:760px){.boss-hud{top:102px}.boss-warning{font-size:16px;padding:12px}.boss-health-panel{padding:10px 12px}.boss-health-label{font-size:12px}.boss-health-track{height:18px}}
@media(max-height:600px) and (min-width:761px){.boss-hud{top:94px}}
@media(prefers-reduced-motion:reduce){.boss-health-fill{transition:none}}
</style>
