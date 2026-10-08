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

- **방어 시작**: 부족한 드론을 3개까지 자동 소환하고 바로 1웨이브를 시작합니다. 초기 에너지 300 중 소환에 225를 사용합니다.
- **드론 소환**: 에너지 75로 빈 칸에 랜덤 드론을 추가합니다. 화염·냉기·전기가 각각 1/3 확률로 나옵니다.
- **직접 배치**: 빛나는 빈 칸을 클릭/탭하면 그 자리에 소환합니다. 다시 누르면 배치를 취소합니다.
- **드론 클릭 / 내 드론**: 코드와 능력치를 게임 모달로 확인합니다. 같은 종류·등급 2개는 최대 3성까지 합성할 수 있습니다.
- **잠깐 쉬기**: 전투를 정지합니다. 정보·도움말·메뉴 모달을 열면 자동으로 정지하고, 닫으면 이전 전투 상태로 돌아갑니다.
- 대원 이동: 빈 바닥 클릭 또는 방향키/WASD. 드론 배치 칸과 기지는 통과하지 않습니다.

화면 전체가 게임 필드이며, 체력·웨이브·에너지는 떠 있는 HUD로 표시합니다. 긴 안내와 코드 패널은 초기 화면에서 표시하지 않습니다. PC와 모바일에서 동일한 조작을 사용합니다.

## 1웨이브 범위

- 적 12마리, 일반/슬라임 외형, 기지 체력 100, 돌파당 피해 15
- 드론의 `적 찾기 → 공격 → 기다리기` 완성 예제 실행과 코드 강조
- 화염 지속 피해, 냉기 이동속도 감소, 전기 인접 적 1마리 연쇄 피해
- 소환·배치·선택·합성, 처치 에너지 15, 완료 보상 50, 승패와 재시작
- 배치 8칸 / 최대 3성 / 기본 공격 간격 0.9초
- 같은 종류 3개만 소환해도 기지 피해 없이 완료하도록 테스트한 첫 전투

이번 코드는 관찰용 완성 예제입니다. 블록 편집, W2–W5와 보스, 로그인·저장·실제 코인 지급·LMS 방 포털 연동은 아직 없습니다. 새로고침하면 초기화됩니다.

## 코드모스 원본 에셋

- 대원: `player/int-front`의 **purple** 스킨. 원본 Spine JSON + atlas + PNG와 Phaser 번들 Spine 3.8 런타임으로 애니메이션을 표시합니다.
- 드론: 원본 캐릭터 atlas의 hero/cloud/monitorhead 머리 이미지를 화염·냉기·전기의 비행 유닛으로 사용합니다. `player/drone-heads.json`은 이미지 영역 메타데이터입니다.
- 몬스터: 제공된 `52081da08bde` / `e5f5d6e48832` JSON과 대응 atlas·원본 PNG. idle 및 die 애니메이션을 사용합니다.
- 방: 기존 `public/games/space/SPACE_MAP_TILESET.png` 원본 타일. 바닥·배치 표시·사거리·전투 효과는 코드 그래픽입니다.

기존 원본 JSON·atlas·manifest는 수정하지 않았습니다. 복원한 이미지의 출처는 `public/codmos-assets/ART-SOURCES.md`에 기록했습니다. 나머지 제공된 리그 일부는 아직 PNG가 없으며 이 게임에서 로드하지 않습니다.

## 구조

- `src/game/defense-simulation.ts`: 렌더러 없는 전투 규칙과 순차 코드 실행
- `src/game/wave-one.ts`: 드론, 배치 칸, 밸런스
- `src/game/defense-scene.ts`: 방, 캐릭터, 몬스터, 입력, 효과
- `src/game/create-game.ts`: Spine 플러그인 로드, 게임 생성과 해제
- `src/components/space-defense-room.vue`: Vue와 게임 연결
- `src/app.vue`, `src/style.css`: 화면 전체 게임 HUD와 모달
- `tests/defense-simulation.test.ts`: 소환·합성·공격·속성·승패·정지 검증

`createDefenseGame(options)`는 비동기이며 `parent`, `assetBase`, `onState`, `onError`, `onInspect`를 받습니다. 컨트롤러는 `setMode`, `summon`, `selectDrone`, `merge`, `toggleGrid`, `startWave`, `togglePause`, `reset`, `destroy`를 제공합니다. 컴포넌트를 해제할 때 게임·ResizeObserver·이벤트를 정리합니다.
