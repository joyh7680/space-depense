<template>
  <div class="coding-success-effect" aria-hidden="true">
    <span class="success-ring" />
    <span class="success-ring success-ring-delayed" />
    <span v-for="index in 8" :key="index" class="success-spark" :style="{ '--spark-angle': `${index * 45}deg` }"><i /></span>
  </div>
</template>

<style scoped>
/* Keep the decorative burst independent of the battle's Phaser/Spine lifecycle. */
.success-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100px;
  height: 100px;
  border: 3px solid var(--robot-accent, #a4f3d8);
  border-radius: 50%;
  box-shadow: 0 0 14px color-mix(in srgb, var(--robot-accent, #a4f3d8), transparent 45%);
  animation: success-ring-burst 1.6s ease-out both;
}
.success-ring-delayed { animation-delay: .65s; }
.success-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: rotate(var(--spark-angle));
}
.success-spark i {
  display: block;
  width: 5px;
  height: 12px;
  margin: -6px 0 0 -2.5px;
  border-radius: 50%;
  background: var(--robot-accent, #a4f3d8);
  box-shadow: 0 0 8px var(--robot-accent, #a4f3d8);
  animation: success-spark-burst 1.7s .15s ease-out both;
}
@keyframes success-ring-burst {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.45); }
  15% { opacity: .9; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.65); }
}
@keyframes success-spark-burst {
  0% { opacity: 0; transform: translateY(-40px) scale(.5); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-90px) scale(.2); }
}
@media (prefers-reduced-motion: reduce) {
  .coding-success-effect { display: none; }
  .success-ring, .success-spark i { animation: none; }
}
</style>
