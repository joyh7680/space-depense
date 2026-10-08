# space-depense

우주정거장 게임컨텐츠개발 - 우주 코딩 디펜스 게임

## Space Defender

CODMOS LMS 우주정거장의 방 하나를 분리한 독립 게임 개발 환경입니다. Vue 3 + TypeScript + Phaser 3 + Vite를 사용합니다. LMS 프로젝트는 수정하지 않았습니다.

## 실행

Node.js 22.12 이상에서 실행합니다.

```powershell
cd C:\workspace\space-defense
npm install
npm run dev
```

접속: http://127.0.0.1:5174 (기존 개발 서버와 겹치지 않도록 별도 포트 사용)

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

## 초기 구현 범위

- 방 하나의 원본 타일 배치와 외벽, 방 안에서 클릭 목적지 이동 및 방향키/WASD 이동
- 벽·포탑 충돌, 전면 벽 근처에서 벽 투명도 조절, 그리드 표시
- 포탑 배치/회수, 에너지, 자동 공격, 테스트 웨이브, 코어 피해, 일시 정지, 재시작
- 데스크톱/모바일 화면 대응. 모바일에서는 클릭/탭으로 이동·배치합니다.

게임 규칙은 개발용 프로토타입입니다. 초기 에너지 300, 포탑 75, 처치 보상 15, 웨이브 보상 50입니다. 인증, API, 실시간 멀티플레이, 상점, 기존 Spine 캐릭터는 포함하지 않습니다. 배치 상태는 새로고침하면 초기화됩니다.

## 원본과 리소스

| 대상 | 원본 |
| --- | --- |
| `public/games/space/SPACE_MAP_TILESET.png` | `C:\workspace\codmos-web-lms\public\games\space\SPACE_MAP_TILESET.png` 그대로 복사 |
| `src/game/room/room-definition.ts` | `app/utils/games/space/util.ts`의 `DEFINE` 그대로 추출 |
| `src/game/room/room.ts` | 원본 `objects/room.ts`의 방/전면 벽 레이어와 `populateLayerWithGids`의 GID 반전 처리 분리 |

원본 방은 100px 타일, 16 × 15 타일맵, 내부 작업 영역 14 × 9입니다. 벽 충돌은 원본 GID 24인 바닥만 통과하도록 판정합니다. 연결 통로와 다른 방은 가져오지 않았습니다.

첨부 이미지의 청록색 표면 테마는 인증된 별도 CDN 리소스여서 복사하지 못했습니다. 현재 청록색 바닥은 Phaser Graphics로 재현했고, 외벽/문/방 배치는 원본을 사용합니다. 대원·코어·포탑·침입 드론은 이 프로젝트의 코드 그래픽입니다. 인증된 테마 원본을 확보하면 `Room`의 surface 렌더링을 원본 tileset 교체로 바꿀 수 있습니다.

## LMS 통합

1. `src/game/`을 LMS의 `app/utils/games/space-defense/`로 복사합니다.
2. `space-defense-room.vue`를 LMS의 컴포넌트 경로에 옮기고 import 경로를 조정합니다.
3. 타일 PNG를 LMS public 리소스 경로에 유지합니다.
4. Phaser가 사용하는 모듈에서 Vite 전용 `import.meta.env.BASE_URL` 대신 `createDefenseGame({ assetBase: '/games/space/', ... })`을 전달하도록 조정합니다. SSR 시 Phaser는 `onMounted` 이후 동적 import를 유지합니다.
5. LMS 인증/사용자/결과 저장은 부모 화면에서 처리하고 `onState` 또는 컴포넌트 `state` 이벤트로 연결합니다.

엔진 진입점은 `createDefenseGame(options)`입니다. 부모 HTMLElement, 리소스 base URL, `onState`, `onError`를 받으며 `setMode`, `toggleGrid`, `startWave`, `togglePause`, `reset`, `destroy`를 반환합니다. 컴포넌트 unmount 시 `destroy()`가 호출되고 이벤트도 정리됩니다. 전역 GameStore나 Nuxt composable에 의존하지 않습니다.

`defense-simulation.ts`는 렌더러 없이 실행 가능한 전투 규칙, `room/`은 원본 방 정의/충돌/렌더링, `defense-scene.ts`는 화면과 입력을 담당합니다.
