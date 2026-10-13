<script setup lang="ts">
defineProps<{ approaching: boolean }>();
</script>

<template>
  <div v-if="approaching" class="boss-hud">
    <div class="boss-warning" role="alert" aria-atomic="true">⚠️ 강력한 보스몹 접근 중!</div>
  </div>
</template>

<style scoped>
.boss-hud{position:absolute;left:50%;top:112px;transform:translateX(-50%);width:min(420px,calc(100% - 32px));z-index:3;pointer-events:none}
.boss-warning{padding:10px 14px;border:2px solid #ff526a;border-radius:12px;background:#451724f5;box-shadow:0 4px 20px #0005,0 0 16px #ff334455;color:#ffd4da;text-align:center;font-size:18px;font-weight:900;word-break:keep-all;animation:boss-warning-blink 1.2s ease-in-out infinite}
@keyframes boss-warning-blink{0%,100%{opacity:1}50%{opacity:.55}}
@media(max-width:760px){.boss-hud{top:102px}.boss-warning{font-size:14px;padding:8px 10px}}
@media(max-height:600px) and (min-width:761px){.boss-hud{top:94px}}
@media(prefers-reduced-motion:reduce){.boss-warning{animation:none}}
</style>
