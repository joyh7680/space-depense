# 원본 이미지 출처

- 웨이브별 보스: `acef8de87e1f…`(민트색), `e5f5d6e48832…`(주황색), `52081da08bde…`(초록색), `80fc9024a85d…`(탈것 탄 파란색)의 기존 Spine JSON을 보존했습니다. 현재 WAVE 1·2·3에서는 각각 민트색·주황색·초록색만 사용하며, 탈것 탄 보스는 보관합니다. 추가 보스의 원본 PNG `monster/aa9ad7124c35/f533c098-9a1d-4981-907f-51328eecf2ab.png`, `monster/45b71e6cd32e/21cd105e-fe40-41fa-b76f-79eea999a47c.png`, `monster/266a4159093d/b8c7a40c-b126-4306-a1d3-09584fefac51.png`는 기존 atlas에 기록된 파일명으로 `https://boominkimlogibros.github.io/codmos-survival/play/assets/`에서 복원했습니다. 원본 이미지는 수정하지 않았습니다.
- `80fc9024a85d/boss-mounted.json`은 동일 폴더의 원본 JSON을 보존하고 만든 호환 사본입니다. `armed01` 스킨의 `armor`, `body_armor2` attachment에 기존 atlas의 실제 영역명 `head_armor`, `body_armor`를 각각 path로 지정했습니다. 나머지 데이터는 동일합니다.

- `effect/1036ce357bc3/`: 사용자가 지정한 atlas에 대응하는 `9daf20f9-3b18-4beb-be52-ca86e900effc.png`(276 × 140)와 `attack-success.json`은 로컬 `C:/workspace/codmos-cms/contents/aidt/public/CDN/default/public/`의 동일 PNG 및 `f21fcb67-9ed0-427c-880e-45391f3eb894.json` 원본을 복사했습니다. particle/twinkle 애니메이션을 공격 성공 카드에 재생하며 원본 내용은 수정하지 않았습니다.

- `effect/green-light/`, `effect/cooling-energy/`, `effect/electric-energy/`, `effect/game-clear/`의 PNG는 해당 atlas에 기록된 파일명을 사용해 `https://cdn.codmos.io/default/public/`에서 복원했습니다. 이미지는 수정하지 않았습니다. 누락된 green-light JSON, cooling-energy atlas, game-clear atlas는 기존 `codmos-assets`의 대응 원본을 복사했습니다. electric-energy atlas는 로컬 코드모스 런타임의 `MLT_ATTACK` JSON/atlas 쌍을 확인해 같은 CDN에서 복원했습니다.
- `effect/flame-energy/flame-frames.json`과 PNG는 기존 `game-over/5e04ca1208c8/`의 동일 atlas용 메타데이터와 텍스처를 복사했습니다. 화염 공격 시 원본 6개 영역을 주황색으로 표시해 재생합니다.

- `game-over/5e04ca1208c8/9ae27227-06b4-432c-95e7-305f10efc0e5.png`: 사용자가 지정한 붕괴 연기 atlas의 원본 텍스처(220 × 276). 로컬 `C:/workspace/codmos-cms/contents/aidt/public/CDN/default/public/`에서 동일 파일명의 원본을 복사했습니다. 이미지는 수정하지 않았습니다. `smoke-frames.json`은 같은 폴더의 `03f99ad7-2496-46a1-88d8-ec7523c394bb.atlas`에 있는 6개 영역과 회전 정보를 Phaser JSON atlas 형식으로 옮긴 메타데이터입니다. 기지 침입 후 방 붕괴 연출에 사용합니다.

- `e56bb4d926f2/6a69a85b-2fab-4322-8b87-30a4eab82980.png`: 사용자가 지정한 게임오버 atlas의 원본 텍스처(600 × 104). `https://cdn.codmos.io/default/public/6a69a85b-2fab-4322-8b87-30a4eab82980.png`에서 복원했습니다. 게임오버 결과 화면의 타이틀로 사용하며 이미지는 수정하지 않았습니다.

- `player/int-front.{json,atlas,png}`: 로컬 코드모스 LMS의 `C:/workspace/codmos-web-lms/public/games/common/int/` 원본. `purple` 스킨으로 대원을 표시합니다.
- `player/drone-heads.json`: 위 원본 atlas의 hero/cloud/monitorhead 머리 영역을 Phaser atlas 형식으로 옮긴 메타데이터입니다. 이미지를 다시 그리거나 수정하지 않았습니다. 화염·냉기·전기 드론의 이미지로 사용합니다.
- 아래 PNG는 사용자가 참고로 제공한 코드모스 서바이벌 게임에서 관찰된 원본 파일이며, 기존에 제공된 atlas와 이름이 일치합니다. 원본 JSON/atlas/manifest는 보존했습니다.
  - `monster/1bae1e1a9bf8/172f1112-a4e9-4ba2-a88d-74bea79e4f33.png` — 일반 외계인
  - `monster/aa9ad7124c35/f533c098-9a1d-4981-907f-51328eecf2ab.png` — 슬라임 외계인
  - `3342b1d6b15d/559365af-7fcf-4919-bbd9-7a2f8ed68c8d.png` — 후속 몬스터용 보관
  - `monster/45b71e6cd32e/21cd105e-fe40-41fa-b76f-79eea999a47c.png` — 후속 몬스터용 보관

PNG 출처: `https://boominkimlogibros.github.io/codmos-survival/play/assets/`의 동일 파일명. 1웨이브에서는 일반/슬라임 두 외형을 동일한 전투 수치로 사용합니다.
