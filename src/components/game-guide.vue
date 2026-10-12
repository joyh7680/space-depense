<script setup lang="ts">
import { ref } from 'vue';
import { ELEMENTS, MAX_ROBOTS, ROBOTS } from '../game/wave-one';
import { robotPortraitStyle } from '../game/robot-visuals';

defineProps<{ battleRunning: boolean }>();
const dialog = ref<HTMLDialogElement>();
const open = ref(false);
const robotGuides = [
  { kind: 'electric', tip: '가까운 괴물을 빠르게 공격해요.' },
  { kind: 'ice', tip: '주변 괴물을 함께 공격하고, 느리게 만들어요.' },
  { kind: 'fire', tip: '공격이 터지면서 주변 괴물도 함께 맞아요.' },
] as const;

function showGuide() {
  dialog.value?.showModal();
  open.value = true;
}
</script>

<template>
  <button class="guide-trigger" type="button" aria-haspopup="dialog" aria-controls="game-guide" :aria-expanded="open" @click="showGuide"><span aria-hidden="true">?</span>게임 방법</button>
  <dialog id="game-guide" ref="dialog" class="game-guide" aria-labelledby="game-guide-title" aria-describedby="game-guide-intro" @close="open = false" @click="($event.target === $event.currentTarget) && dialog?.close()">
    <article class="guide-content">
      <header class="guide-header">
        <div><small>우주 코딩 디펜스</small><h1 id="game-guide-title">게임 방법</h1></div>
        <button class="guide-close" type="button" aria-label="게임 설명 닫기" autofocus @click="dialog?.close()">×</button>
      </header>
      <p id="game-guide-intro" class="guide-intro"><strong>로봇과 함께 우주 기지를 지켜요!</strong>괴물이 우리 기지에 못 오게 막는 게임이에요.<br />로봇에게 명령을 알려 주고, 3라운드를 모두 지켜 보세요!</p>
      <p v-if="battleRunning" class="guide-battle-note">설명을 읽는 동안에도 전투는 계속돼요.</p>
      <p class="guide-goal">전투 시작 100초 후 보스가 나와요.<br /><strong>모든 괴물과 보스를 잡으면 라운드 성공!</strong></p>

      <ol class="guide-steps">
        <li><h2>내 캐릭터를 옮겨요</h2><p>캐릭터를 마우스나 손가락으로 끌어서 <strong>괴물 길 옆의 빈 바닥</strong>에 놓아요. 가까운 괴물은 알아서 공격해요.</p></li>
        <li><h2>에너지를 모아요</h2><p>괴물을 잡으면 <strong>전기, 냉기(얼음), 화염(불)</strong> 중 하나를 얻어요. 화면 아래에서 몇 개 모았는지 볼 수 있어요.</p></li>
        <li><h2>로봇을 불러요</h2><p>아래의 <strong>‘로봇 배치’</strong>를 누르고 원하는 로봇을 골라요. 필요한 에너지가 모이면 부를 수 있어요. 흐린 카드는 아직 에너지가 부족하다는 뜻이에요.</p></li>
        <li><h2>로봇에게 명령해요</h2><p>바닥에 나온 <strong>로봇을 누르면 코딩 문제</strong>가 열려요. 문제에 적힌 순서대로 블록을 눌러 ‘내 코드’에 넣어요. 정답이면 <strong>‘공격 성공!’</strong>이 뜨고 로봇이 알아서 공격해요.</p></li>
      </ol>
      <p class="guide-tip">블록을 잘못 넣었나요? 옆의 <strong>×</strong>로 빼고 다시 넣으면 돼요.<br />로봇도 끌어서 빈 바닥으로 옮길 수 있어요. 최대 {{ MAX_ROBOTS }}대까지 함께 싸워요.</p>

      <section class="guide-robots" aria-labelledby="guide-robots-title">
        <h2 id="guide-robots-title">어떤 로봇을 부를까요?</h2>
        <div v-for="robot in robotGuides" :key="robot.kind" class="guide-robot">
          <i class="robot-portrait" :style="robotPortraitStyle(robot.kind)" aria-hidden="true" />
          <div><h3>{{ ROBOTS[robot.kind].name }}</h3><p>{{ robot.tip }}</p><small>필요한 에너지: {{ ROBOTS[robot.kind].recipe.map(part => `${ELEMENTS[part.kind].name} ${part.amount}개`).join(' + ') }}</small></div>
        </div>
      </section>

      <section class="guide-rounds" aria-labelledby="guide-rounds-title">
        <h2 id="guide-rounds-title">라운드마다 새 코딩에 도전해요</h2>
        <p><strong>WAVE는 ‘라운드’라는 뜻이에요.</strong></p>
        <dl><div><dt>1라운드 · 순서</dt><dd>명령을 위에서 아래로 차례대로 넣어요.</dd></div><div><dt>2라운드 · 반복</dt><dd>같은 명령을 여러 번 하도록 만들어요.</dd></div><div><dt>3라운드 · 조건</dt><dd>‘만약 적이 있다면’처럼, 정해진 상황에 맞춰 명령해요.</dd></div></dl>
        <p>다음 라운드가 시작되면 에너지와 로봇은 처음으로 돌아가요. 다시 모아서 새 코딩 문제를 풀어 주세요!</p>
      </section>

      <p class="guide-important"><strong>괴물이 한 마리라도 기지에 도착하면 실패해요!</strong>로봇을 부른 뒤에는 꼭 코딩 문제를 풀어 주세요. 문제를 풀기 전에는 로봇이 공격하지 않아요. 실패해도 ‘다시 도전하기’를 눌러 다시 할 수 있어요.</p>
      <footer class="guide-footer"><button class="guide-done" type="button" @click="dialog?.close()">알겠어요!</button></footer>
    </article>
  </dialog>
</template>

<style scoped>
.guide-trigger{position:absolute;top:30px;right:28px;z-index:15;display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 14px;border:1px solid #71849a;border-radius:14px;background:#1c293ded;color:#eff6ff;font-size:13px;box-shadow:0 4px 0 #101626}
.guide-trigger>span{display:grid;place-items:center;width:20px;height:20px;border:1px solid #a7c9dd;border-radius:50%;color:#93e5e5;font-weight:800}
.guide-trigger:hover{background:#30455b}
.game-guide{width:700px;max-width:calc(100% - 32px);max-height:calc(100dvh - 32px);padding:0;border:1px solid #66839b;border-radius:24px;background:#182638;color:#edf4ff;box-shadow:0 24px 90px #0008;overflow-y:auto;overscroll-behavior:contain;text-align:left}
.game-guide::backdrop{background:#070e1bcc;backdrop-filter:blur(5px)}
.guide-content{padding:26px}
.guide-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.guide-header small{color:#8edfd9;font-size:12px}
.guide-header h1{margin:4px 0 0;font-size:26px;letter-spacing:-1px}
.guide-close{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;padding:0;border-radius:12px;background:#ffffff12;font-size:28px}
.guide-close:hover{background:#ffffff24}
.guide-intro{margin:22px 0 16px;font-size:14px;line-height:1.85;color:#c7d6e6;word-break:keep-all;overflow-wrap:anywhere}
.guide-intro>strong{display:block;margin-bottom:7px;font-size:20px;line-height:1.5;color:#fff}
.guide-goal{margin:0;padding:14px 18px;border:1px solid #66d4b44d;border-radius:14px;background:#2c9d791a;font-size:14px;line-height:1.8;color:#d2f4e5}
.guide-steps{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0 16px;padding:0;list-style:none;counter-reset:step}
.guide-steps li{position:relative;padding:18px 16px 16px 48px;background:#ffffff06;border:1px solid #ffffff12;border-radius:15px;counter-increment:step}
.guide-steps li::before{content:counter(step);position:absolute;left:14px;top:17px;display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#4bc9c7;color:#102a36;font-size:14px;font-weight:900}
.guide-content h2{margin:0 0 8px;font-size:16px;color:#f1f6ff;line-height:1.6}
.guide-steps p,.guide-tip,.guide-robot p,.guide-rounds p,.guide-rounds dd,.guide-important{margin:0;font-size:13px;line-height:1.85;color:#c4d2e3;word-break:keep-all;overflow-wrap:anywhere}
.guide-content strong{color:#f1f6ff}
.guide-tip{padding:0 4px}
.guide-robots,.guide-rounds{margin-top:24px;padding-top:22px;border-top:1px solid #ffffff1a}
.guide-robot{display:flex;align-items:center;gap:14px;margin-top:12px;padding:12px 14px;border-radius:14px;background:#0c182b80}
.guide-robot .robot-portrait{flex-shrink:0;width:40px;height:50px;image-rendering:pixelated}
.guide-robot h3{margin:0 0 3px;font-size:14px;color:#e8efff}
.guide-robot small{display:block;margin-top:4px;color:#9dc5d6;font-size:12px;line-height:1.8;word-break:keep-all;overflow-wrap:anywhere}
.guide-rounds dl{display:grid;gap:10px;margin:14px 0}
.guide-rounds dl>div{display:grid;grid-template-columns:140px 1fr;gap:8px}
.guide-rounds dt{font-size:13px;line-height:1.85;color:#91e4dd}
.guide-important{margin-top:22px;padding:16px 18px;border:1px solid #ef9c9140;border-radius:14px;background:#c86c5914}
.guide-important strong{display:block;margin-bottom:5px;color:#ffc2b8}
.guide-footer{margin-top:22px;text-align:center}
.guide-battle-note{margin:0 0 14px;color:#e9cba3;font-size:12px;line-height:1.7}
.guide-done{min-height:46px;width:100%;padding:12px 20px;border-radius:12px;background:#5ce0d3;color:#12313b;font-size:15px;font-weight:800}
.guide-done:hover{background:#88eee5}
@media(max-width:760px){.guide-trigger{top:18px;right:12px;min-height:40px;padding:8px 11px;font-size:12px;gap:6px}}
@media(max-width:600px){.guide-content{padding:20px 17px}.guide-header h1{font-size:23px}.guide-intro>strong{font-size:18px}.guide-steps{grid-template-columns:1fr}.guide-rounds dl>div{grid-template-columns:1fr;gap:0}.guide-robot{padding:12px 10px;gap:10px}}
</style>
