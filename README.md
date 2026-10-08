# CODMOS 우주 코딩 디펜스

기획서 `docs/eli5/2026-10-08/space-coding-defense.html`의 **1웨이브**를 플레이하는 Vue 3 + TypeScript + Phaser 3 게임입니다.

## 실행

Node.js 22.12 이상을 사용합니다.

```powershell
npm install
npm run dev
```

로컬 주소: http://127.0.0.1:5174

```powershell
npm run typecheck
npm test
npm run build
```

## 플레이

- 방 로딩이 끝나면 **5초 카운트다운 후 자동 시작**합니다. 시작·일시정지 버튼은 없습니다.
- 대원 이동: **PC는 빈 바닥 마우스 클릭, 태블릿은 터치**로만 이동합니다. 괴물 길 밖에서만 상하좌우로 이동하며 근처 괴물을 자동 공격합니다. 길을 가로질러 이동할 수 없습니다.
- **로봇 소환**: 버튼을 누르면 소환창이 열립니다. 창 안의 랜덤 소환 버튼으로 에너지 75를 사용해 로봇 1대를 소환합니다. 화염·냉기·전기가 각각 1/3 확률로 나옵니다. 창을 보는 동안 전투와 시작 카운트다운이 멈춥니다.
- **로봇 배치**: 소환창의 속성 카드나 방 안의 로봇을 선택한 뒤 길 밖의 빈 바닥을 누릅니다. 방 안에서 로봇을 드래그해 옮길 수도 있습니다. 이동에는 에너지가 들지 않습니다.
- **나의 로봇**: 속성별 수량은 우주정거장 아래에 표시합니다. 소환창에는 화염·냉기·전기 카드가 한 장씩 있고 같은 속성의 로봇은 냉기 2처럼 합산합니다. 카드 선택 시 해당 속성의 로봇을 순서대로 선택해 배치합니다.
- **합성**: 같은 종류·같은 등급 2개를 소환창의 합성 버튼으로 최대 3성까지 합성합니다.

화면 전체가 게임 필드이며 체력·웨이브·에너지는 HUD에 표시합니다. 모바일에서는 빈 바닥 터치로 이동합니다. 승패 후 다시 플레이하면 5초 카운트다운부터 시작합니다.

## 1웨이브 범위

- 적 12마리, monster-mint.png 외형, 상단 하트는 정거장 내구도 100
- 가로 2줄 길: 왼쪽 입구 → 오른쪽으로 이동 → 아래로 회전 → 왼쪽의 우리 기지. 캐릭터와 로봇은 길 밖의 빈 바닥에서만 이동·배치할 수 있습니다. 빈 배치 칸의 + 표시는 없습니다.
- 살아남은 괴물이 한 마리라도 우리 기지에 도달하면 탈출하며 정거장이 파괴됩니다. 지정한 `game-over/5e04ca1208c8` 에셋의 연기가 기지에서 방 전체로 퍼지고 폭발·균열·화면 흔들림이 이어집니다. 2.4초 붕괴 연출이 끝나면 게임 오버가 표시됩니다. 모든 괴물을 탈출 전에 처치해야 승리합니다.
- 로봇의 `적 찾기 → 공격 → 기다리기` 완성 예제 자동 실행
- 화염 지속 피해, 냉기 이동속도 감소, 전기 인접 적 1마리 연쇄 피해
- 소환·배치·선택·합성, 처치 에너지 15, 완료 보상 50, 승패와 재시작
- 최대 8대 / 길 밖 자유 배치 / 최대 3성 / 기본 공격 간격 0.9초
- 같은 종류 3개만 소환해도 탈출 없이 완료하도록 테스트한 첫 전투

이번 코드는 관찰용 완성 예제입니다. 블록 편집, W2–W5와 보스, 로그인·저장·실제 코인 지급·LMS 방 포털 연동은 아직 없습니다. 새로고침하면 초기화됩니다.

## 코드모스 원본 에셋

- 대원: `player/int-front`의 **purple** 스킨. 원본 Spine JSON + atlas + PNG와 Phaser 번들 Spine 3.8 런타임으로 애니메이션을 표시합니다.
- 로봇: 원본 Spine 캐릭터의 volta/cloud/monitorhead 스킨을 화염·냉기·전기로 사용합니다.
- 몬스터: public/codmos-assets-monster/759c20f0e742/monster-mint.png 원본 이미지를 사용합니다.
- 방: 기존 `public/games/space/SPACE_MAP_TILESET.png` 원본 타일. 바닥·배치 표시·사거리·전투 효과는 코드 그래픽입니다.

기존 원본 JSON·atlas·manifest는 수정하지 않았습니다. 복원한 이미지의 출처는 `public/codmos-assets/ART-SOURCES.md`에 기록했습니다. 나머지 제공된 리그 일부는 아직 PNG가 없으며 이 게임에서 로드하지 않습니다.

## 구조

- `src/game/defense-simulation.ts`: 렌더러 없는 전투 규칙과 순차 코드 실행
- `src/game/wave-one.ts`: 로봇, 배치 칸, 밸런스
- `src/game/defense-scene.ts`: 방, 캐릭터, 몬스터, 입력, 효과
- `src/game/create-game.ts`: Spine 플러그인 로드, 게임 생성과 해제
- `src/components/space-defense-room.vue`: Vue와 게임 연결
- `src/app.vue`, `src/style.css`: 화면 전체 게임 HUD, 로봇 목록, 결과창
- `tests/defense-simulation.test.ts`: 소환·합성·공격·속성·승패·정지 검증

`createDefenseGame(options)`는 비동기이며 `parent`, `assetBase`, `onState`, `onError`, `onInspect`를 받습니다. 컨트롤러는 `setMode`, `summon`, `selectRobot`, `merge`, `toggleGrid`, `startWave`, `togglePause`, `reset`, `destroy`를 제공합니다. 컴포넌트를 해제할 때 게임·ResizeObserver·이벤트를 정리합니다.
