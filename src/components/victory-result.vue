<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getCodingMission } from '../game/coding-missions';

defineProps<{ wave: number; kills: number; total: number; escaped: number; reward: number }>();
defineEmits<{ replay: []; next: [] }>();
const replayButton = ref<HTMLButtonElement>();
const dialog = ref<HTMLElement>();
onMounted(() => dialog.value?.focus({ preventScroll: true }));
</script>

<template>
  <section ref="dialog" class="victory-card" role="dialog" aria-modal="true" aria-labelledby="victory-title" aria-describedby="victory-description" tabindex="-1" @keydown.tab.prevent="replayButton?.focus()">
    <div class="victory-meta"><span><i aria-hidden="true" />MISSION COMPLETE</span><span>WAVE {{ String(wave).padStart(2, '0') }}</span></div>
    <div class="victory-emblem" aria-hidden="true">
      <svg viewBox="0 0 180 150" fill="none">
        <defs>
          <linearGradient id="victory-medal" x1="59" y1="35" x2="125" y2="117" gradientUnits="userSpaceOnUse"><stop stop-color="#e8dcff" /><stop offset="1" stop-color="#9573ed" /></linearGradient>
          <linearGradient id="victory-ribbon" x1="75" y1="93" x2="110" y2="139" gradientUnits="userSpaceOnUse"><stop stop-color="#8660ce" /><stop offset="1" stop-color="#493467" /></linearGradient>
        </defs>
        <circle cx="90" cy="73" r="58" stroke="#c9b5ff" stroke-opacity=".13" />
        <circle cx="90" cy="73" r="47" stroke="#c9b5ff" stroke-opacity=".1" stroke-dasharray="2 7" />
        <ellipse cx="90" cy="78" rx="79" ry="24" transform="rotate(-24 90 78)" stroke="#c9b5ff" stroke-opacity=".23" />
        <path d="m66 93-8 39 20-8 12 14 7-40m16-5 9 39-20-8-12 14-7-40" fill="url(#victory-ribbon)" />
        <path d="m90 25 13 8 15 2 6 14 10 11-3 15 1 15-13 9-9 12-15-1-15 3-11-11-14-7-1-15-5-14 9-12 4-15 15-4Z" fill="url(#victory-medal)" />
        <circle cx="90" cy="70" r="28" fill="#31234e" fill-opacity=".24" stroke="#fff" stroke-opacity=".35" />
        <path d="m77 70 9 9 18-19" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="m37 35 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm104 58 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#dbcaff" />
        <circle cx="143" cy="40" r="2" fill="#b9a0ef" /><circle cx="40" cy="111" r="2" fill="#b9a0ef" />
      </svg>
    </div>
    <h1 id="victory-title">방어 성공!</h1>
    <p id="victory-description" class="victory-description">우주정거장을 안전하게 지켜냈어요.</p>
    <dl class="victory-stats">
      <div><dt>처치한 괴물</dt><dd>{{ kills }}<span>/ {{ total }}</span></dd></div>
      <div><dt>탈출한 괴물</dt><dd>{{ escaped }}<span>마리</span></dd></div>
    </dl>
    <div class="victory-reward">
      <span class="victory-reward-label"><span class="victory-energy" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m13 3-8 11h6l-1 7 9-12h-7l1-6Z" fill="currentColor" /></svg></span>웨이브 클리어 보상</span>
      <strong>+{{ reward }}<span>에너지</span></strong>
    </div>
    <button ref="replayButton" class="victory-replay" @click="wave < 3 ? $emit('next') : $emit('replay')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg>{{ wave < 3 ? `웨이브 ${wave + 1} 시작` : '다시 플레이' }}<svg class="victory-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
    <p v-if="wave < 3" class="victory-auto-next" role="status">잠시 후 3초 카운트다운과 함께 다음 웨이브로 자동 진행해요.</p>
    <p class="victory-footnote">{{ wave < 3 ? `다음 웨이브: ${getCodingMission('fire', wave + 1).title} · ${getCodingMission('fire', wave + 1).concept} · 에너지와 로봇 초기화` : '웨이브 3까지 모두 완료했어요' }}</p>
  </section>
</template>

<style scoped>
.victory-card{outline:none;position:relative;isolation:isolate;width:440px;max-width:100%;max-height:calc(100dvh - 40px);overflow-y:auto;padding:26px 32px 24px;border:1px solid #d9c9ff29;border-radius:28px;background:radial-gradient(ellipse at 50% 0,#a47aec23,transparent 55%),linear-gradient(160deg,#232337,#171923 75%);box-shadow:0 30px 100px #0006,inset 0 1px 0 #ffffff0d;text-align:center;animation:victory-arrive .45s cubic-bezier(.2,.8,.2,1) both}
.victory-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#92909f;font-size:10px;font-weight:600;letter-spacing:1.3px}
.victory-meta>span:first-child{display:flex;align-items:center;gap:7px;color:#c6b5e8}
.victory-meta i{width:5px;height:5px;border-radius:50%;background:#c2a0ff;box-shadow:0 0 10px #bb8fff70}
.victory-meta>span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}
.victory-emblem{width:180px;height:150px;margin:23px auto 6px;position:relative}
.victory-emblem::before{content:'';position:absolute;inset:15px;border-radius:50%;background:#b18aff16;filter:blur(25px);z-index:-1}
.victory-emblem svg{display:block;width:100%;height:100%;filter:drop-shadow(0 8px 12px #0b091833)}
.victory-card h1{margin:0;color:#f6f2ff;font-size:36px;font-weight:800;line-height:1.4;letter-spacing:-1.6px}
.victory-description{margin:7px 0 0;color:#a3a0b3;font-size:13px;font-weight:500;line-height:1.7;letter-spacing:-.3px}
.victory-stats{display:grid;grid-template-columns:1fr 1fr;margin:27px 0 0;padding:20px 0;border:1px solid #ffffff09;border-radius:16px;background:#ffffff03}
.victory-stats>div+div{border-left:1px solid #ffffff0d}
.victory-stats dt{color:#a3a0b3;font-size:11px;font-weight:500}
.victory-stats dd{margin:7px 0 0;color:#f1edf9;font-size:30px;font-weight:800;line-height:1.2;letter-spacing:-.8px;font-variant-numeric:tabular-nums}
.victory-stats dd>span{margin-left:6px;color:#888597;font-size:13px;font-weight:500;letter-spacing:0}
.victory-stats>div:last-child dd{color:#bde5d4}
.victory-reward{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 24px;padding:13px 14px;border:1px solid #cbb0ff12;border-radius:12px;background:#b892ff0a}
.victory-reward-label{display:flex;align-items:center;gap:8px;color:#b3a9c6;font-size:11px;font-weight:500}
.victory-energy{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#eecb7320;color:#ebcd8a}
.victory-energy svg{width:16px;height:16px}
.victory-reward strong{color:#e6d4ff;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.victory-reward strong>span{margin-left:5px;font-size:10px;font-weight:500;color:#b3a9c6}
.victory-replay{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:54px;padding:15px 18px;border:1px solid #e4d4ff66;border-radius:13px;background:linear-gradient(110deg,#dfceff,#c4a6f6);box-shadow:0 4px 20px #b28aed14,inset 0 1px 0 #fff5;color:#2d2042;font-size:15px;font-weight:800;letter-spacing:-.3px;transition:filter .18s,transform .18s,box-shadow .18s}
.victory-replay>svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.victory-replay .victory-arrow{margin-left:auto;width:17px;opacity:.65}
.victory-replay>svg:first-child{margin-right:auto}
.victory-replay:hover{filter:brightness(1.06);box-shadow:0 6px 26px #b28aed2b}
.victory-replay:not(:disabled):active{transform:translateY(1px)}
.victory-replay:focus-visible{outline:2px solid #dec8ff;outline-offset:4px}
.victory-footnote{margin:17px 0 0;color:#888395;font-size:10px;font-weight:500;line-height:1.6;letter-spacing:-.2px}
.victory-auto-next{margin:12px 0 0;color:#c6b5e8;font-size:11px;line-height:1.6}
@keyframes victory-arrive{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@media(max-width:480px){.victory-card{padding:22px 23px;border-radius:24px}.victory-emblem{margin-top:18px}.victory-card h1{font-size:32px}}
@media(max-width:350px){.victory-card{padding:20px 17px}.victory-meta{font-size:9px;letter-spacing:1px}.victory-reward{padding:12px 10px}.victory-reward-label{gap:5px;font-size:10px}}
@media(max-height:650px){.victory-card{padding-top:20px;padding-bottom:20px}.victory-emblem{width:144px;height:120px;margin-top:12px;margin-bottom:2px}.victory-card h1{font-size:30px}.victory-stats{margin-top:20px;padding:15px 0}.victory-reward{margin-bottom:18px}.victory-footnote{margin-top:14px}}
@media(max-height:600px){.victory-emblem{width:108px;height:90px}.victory-stats{margin-top:16px;padding:12px 0}.victory-reward{padding:10px 12px;margin-bottom:16px}}
@media(max-height:500px){.victory-card{padding:10px 24px}.victory-emblem{width:72px;height:60px;margin-top:5px;margin-bottom:0}.victory-card h1{font-size:24px;line-height:1.2}.victory-description{margin-top:4px;font-size:11px;line-height:1.5}.victory-stats{margin-top:12px;padding:7px 0}.victory-stats dt{font-size:10px}.victory-stats dd{margin-top:4px;font-size:23px}.victory-reward{margin:8px 0 12px;padding:6px 12px}.victory-replay{min-height:42px;padding:9px 16px;font-size:14px}.victory-footnote{margin-top:6px;font-size:9px}}
@media(prefers-reduced-motion:reduce){.victory-card{animation:none}}
</style>
