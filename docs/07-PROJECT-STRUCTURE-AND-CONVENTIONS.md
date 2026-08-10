# 07. 프로젝트 구조 & 코딩 컨벤션

> **문서 지위: 결정(DECISION).** 정본(`01`, `03`, `04`)의 하위 문서이며 `06-TECH-DESIGN.md`와 짝을 이룬다.
> 06이 "무엇을 어떻게 만드는가"라면 이 문서는 "어디에 어떤 이름으로 두는가"다.
> 이 문서의 규칙을 어긴 코드는 동작하더라도 고친다. 1인 개발에서 일관성은 기억력의 대체재다.
>
> 최종 수정: 2026-08-10 / 1인 개발 / 7일

---

## 1. 전체 디렉토리 트리

### 1.1 저장소 최상위

```
PJT20260810/
├─ .gitignore                     루트 무시 규칙. asset/ 제외 + 서명 자산 제외(§6.4)
├─ codemagic.yaml                 ★ 클라우드 macOS CI 정의. iOS 빌드·서명·TestFlight 업로드 (14 §6.4)
├─ docs/                          기획·기술 문서 (이 문서 포함)
├─ asset/                         ★ 원본 에셋 7,846개 / 128MB. 읽기 전용. git 제외
├─ tools/                         에셋 빌드 스크립트 (Node, 브라우저 코드 아님)
│  ├─ asset-manifest.json         무엇을 어디서 가져와 어떻게 변환할지 선언
│  ├─ build-assets.mjs            manifest 실행기 (06 §8.3)
│  └─ convert-audio.sh            ffmpeg mp3→ogg 변환 (1회성)
└─ FE/                            애플리케이션 루트 (npm 프로젝트)
   ├─ index.html
   ├─ vite.config.js
   ├─ capacitor.config.json       android / ios / plugins 블록 (06 §11.1)
   ├─ eslint.config.js
   ├─ .prettierrc
   ├─ .prettierignore
   ├─ .gitignore
   ├─ package.json
   ├─ public/
   │  └─ assets/                  ★ build:atlas 산출물. git 포함(약 6MB)
   │     ├─ actors/               player.png, enemies.png, boss_executioner.png
   │     ├─ fx/                   slash.png, fire_bullet.png, holy_rain.png, chain.png, orb.png
   │     ├─ tiles/                crypt_tiles.png, candle.png, torch.png, spike.png
   │     ├─ ui/                   hud.png, joystick.png, icons16.png, pixel_font.png, pixel_font.xml
   │     ├─ map/                  crypt.json (Tiled export)
   │     └─ audio/                bgm_*.ogg, sfx_*.ogg
   ├─ android/                    ★ Capacitor Android 프로젝트. 커밋한다(§6.4)
   │  └─ app/src/main/AndroidManifest.xml   가로 고정 (06 §11.1)
   ├─ ios/                        ★ Capacitor iOS 프로젝트. 커밋한다. 이번 주 실 산출물이다
   │  └─ App/
   │     ├─ App/Info.plist        ★ 가로 고정·상태바·수출 규정 응답 (06 §11.1)
   │     ├─ App.xcodeproj/project.pbxproj   PRODUCT_BUNDLE_IDENTIFIER·배포 타겟 14.0
   │     ├─ Podfile               CocoaPods. CI가 `pod install`을 돌린다
   │     ├─ Podfile.lock          ★ 반드시 커밋. CI 재현성의 근거다
   │     └─ Pods/                 git 제외 (§6.4)
   └─ src/                        §1.2
```

**★ 이번 개편에서 바뀐 것 3가지**

| 항목 | 이전 | 지금 |
|---|---|---|
| `FE/ios/` | "유지만 함. 이번 주 빌드 대상 아님" | **실 산출물.** Day 7 TestFlight 업로드 대상 |
| `codemagic.yaml` | 없음 | **신설.** Mac이 없으므로 iOS 빌드는 전량 클라우드 macOS CI가 수행한다 |
| 원격 저장소 | 로컬 git 전제 | **필수.** CI가 원격 저장소를 트리거로 잡는다 → §6.1 |

> **CI 정의 파일 위치는 제공자에 따라 다르다.** Codemagic은 **저장소 루트의 `codemagic.yaml`**,
> GitHub Actions는 `.github/workflows/*.yml`이다. 이 프로젝트는 **Codemagic을 1순위**로 잡는다
> (무료 macOS 분량이 더 크다 — 근거는 `14-BUILD-AND-DEPLOY.md`).
> 어느 쪽이든 **`FE/` 안이 아니라 저장소 루트에 둔다.** 저장소 루트가 곧 CI의 작업 디렉토리이기 때문이다.

### 1.2 `FE/src/` 최종 구조 (파일 단위)

이 구조대로 전부 만들면 게임이 완성된다. 빠진 것이 없도록 설계했다.

```
src/
├─ main.jsx                       엔트리. initNative() → createRoot → <App/>. StrictMode 유지
├─ App.jsx                        ★ 전면 재작성. screen 스위치 + GameCanvas + UI 레이어
├─ index.css                      전역 리셋·세이프에어리어 변수 (06 §11.3)
│
├─ game/                          ─────────── Phaser 영역. React를 절대 import 하지 않는다
│  ├─ config.js                   ★ 전면 교체. 640×360 가로, Scale.FIT, 상수 export
│  ├─ GameManager.js              ★ 전면 교체. Phaser 인스턴스 단일 소유 + HMR/StrictMode 방어
│  ├─ EventBus.js                 ★ 신규. 의존성 0의 경량 emitter (06 §3.1)
│  ├─ constants.js                EVENTS / BASE_STATS / TOLL_FLOORS / DEPTH / 풀 크기
│  ├─ debug.js                    DEBUG 플래그, URL 파라미터 파싱
│  │
│  ├─ scenes/
│  │  ├─ BootScene.js             설정 로드, 최소 로딩 에셋, boot:ready emit
│  │  ├─ PreloadScene.js          전 에셋 로드 + registerAnims + asset:progress emit
│  │  ├─ GameScene.js             ★ 런의 중심. 시스템 소유, update 순서 고정 (06 §4.2)
│  │  ├─ HudScene.js              HP·EXP·타이머·처치수·인간성·조이스틱·데미지숫자 (60fps)
│  │  └─ DebugScene.js            fps/엔티티/시스템별 ms 오버레이. DEBUG일 때만 launch
│  │
│  ├─ systems/                    각 파일은 class + update(dt) 하나만 노출
│  │  ├─ InputSystem.js           플로팅 조이스틱 + 대시 버튼 + 키보드 → 입력 벡터
│  │  ├─ PlayerSystem.js          이동·대시·무적·피격·HUNGER 드레인·레벨업 판정
│  │  ├─ PhaseSystem.js           경과 시간, 90초 페이즈 전환, 보스 소환, BGM 전환 트리거
│  │  ├─ SpawnSystem.js           링 스폰, 상한 시 최원거리 적 텔레포트 재활용
│  │  ├─ EnemyAISystem.js         ★ 4그룹 틱 분산. chase/zigzag/kite/charge 행동
│  │  ├─ WeaponSystem.js          무기 5종 쿨다운 관리 → weapons/*.js 호출
│  │  ├─ CollisionSystem.js       ★ 공간해시 기반 판정. 제곱거리 비교만
│  │  ├─ PickupSystem.js          EXP오브 자석·흡수·병합, 골드·보물상자
│  │  ├─ DamageSystem.js          데미지 큐 일괄 처리, 사망 판정, 흡혈
│  │  ├─ CleanupSystem.js         수명 만료·디스폰 거리 초과 → 풀 반환
│  │  ├─ StatSystem.js            ★ 가산→곱연산→각성→floor 순서 고정 (06 §6)
│  │  ├─ PactSystem.js            ★ 카드 생성·적용·태그 카운터·각성 트리거 (06 §7)
│  │  ├─ AwakeningSystem.js       각성 6종의 비스탯 효과 훅 (처치폭발·오라·마커·부활)
│  │  ├─ BossSystem.js            여명의 처형인 3페이즈 패턴 + 텔레그래프
│  │  ├─ AudioSystem.js           unlock·크로스페이드·SFX 중복 억제 (06 §10)
│  │  ├─ QualitySystem.js         fps 감시 → 저사양 티어 자동 강등 (06 §5.8)
│  │  └─ ProfilerSystem.js        performance.now() 계측. DEBUG 아니면 빈 함수
│  │
│  ├─ entities/                   Phaser GameObject 상속. 로직은 최소, reset()이 핵심
│  │  ├─ Player.js                에일라. 4방향 스프라이트, syncMaxHp(비율 보존)
│  │  ├─ Enemy.js                 적 공용. reset(enemyId, x, y, scaling)
│  │  ├─ Boss.js                  보스 전용. 페이즈 상태 + 패턴 큐
│  │  ├─ Projectile.js            투사체. pierce, hitSet, radius
│  │  ├─ AreaZone.js              장판(성수 낙하, 보스 붉은 장판). 틱 데미지
│  │  ├─ ExpOrb.js                EXP 오브 3티어 + 병합
│  │  ├─ Pickup.js                보물상자, 회복 아이템
│  │  └─ DamageText.js            BitmapText 래퍼. 풀 재활용
│  │
│  ├─ pools/
│  │  ├─ Pool.js                  Phaser Group 기반 고정 풀 공용 클래스 (06 §5.1)
│  │  └─ PoolRegistry.js          enemies/projectiles/orbs/zones/dmgText 풀 일괄 생성·해제
│  │
│  ├─ weapons/                    무기 1종 = 파일 1개. fire(scene, level, stats) 시그니처 통일
│  │  ├─ index.js                 WEAPONS 레지스트리 (id → 모듈)
│  │  ├─ w1_bloodfang.js          피의 송곳니 — 부채꼴 90° 참격
│  │  ├─ w2_emberbolt.js          화염탄 — 최근접 자동조준 투사체
│  │  ├─ w3_boneorbit.js          뼈 회오리 — 궤도 상시
│  │  ├─ w4_sanctumrain.js        성수 낙하 — 랜덤 3곳 장판
│  │  └─ w5_chaintoll.js          사슬 종 — 3체 연쇄 (SHOULD)
│  │
│  ├─ anims/
│  │  └─ registerAnims.js         ★ 전 애니메이션 키 등록 단일 지점 (§3.4)
│  │
│  └─ utils/
│     ├─ SpatialHash.js           ★ 셀 64px 공간해시 (06 §5.2)
│     ├─ math.js                  dist2, clamp, lerp, swapPop, angleTo
│     ├─ rng.js                   시드 고정 RNG (mulberry32). pick/weighted/range
│     └─ camera.js                화면 흔들림·히트스톱·플래시 헬퍼
│
├─ state/                         ─────────── Zustand. Phaser를 절대 import 하지 않는다
│  ├─ store.js                    슬라이스 4개 합성 + getSnapshotForRun()
│  ├─ metaSlice.js                gold, upgrades, unlocked, codex, stats
│  ├─ runSlice.js                 level, humanity, tagCounts, awakenings, bossHp, lastResult
│  ├─ uiSlice.js                  screen, modal, pact{open,cards}, awakeningBanner, loadProgress
│  ├─ settingsSlice.js            볼륨·흔들림·데미지숫자·조이스틱·저사양
│  └─ bridge.js                   ★ EventBus P→R 구독을 스토어에 연결하는 단일 지점
│
├─ ui/                            ─────────── React. Phaser를 절대 import 하지 않는다
│  ├─ GameCanvas.jsx              Phaser 마운트 지점. 앱 수명 내 1회 (06 §3.7)
│  ├─ UiLayer.jsx                 캔버스 위 오버레이 루트. 세이프에어리어 패딩 적용
│  │
│  ├─ screens/
│  │  ├─ TitleScreen.jsx          로고, 시작, 성소, 옵션. ★ 첫 제스처에서 audio unlock
│  │  ├─ LoadingScreen.jsx        asset:progress 진행바 + 녹턴 대사 1줄
│  │  ├─ SanctumScreen.jsx        영구 업그레이드 6종 구매 UI
│  │  ├─ ResultScreen.jsx         런 결과·골드·엔딩 전문·재시작(3초 내 도달)
│  │  ├─ OptionsModal.jsx         정본 03 §13 옵션 전체
│  │  ├─ PauseModal.jsx           계속하기 / 옵션 / 포기
│  │  └─ CodexModal.jsx           각성 도감 (COULD. 컷 가능)
│  │
│  ├─ pact/
│  │  ├─ PactOverlay.jsx          ★ 계약서 3장 컨테이너 + 리롤/스킵
│  │  ├─ PactCard.jsx             카드 1장. 축복/대가/인간성/중첩 표시, 각성 임박 금빛 테두리
│  │  ├─ TollStacks.jsx           ●●○ 중첩 인디케이터
│  │  └─ NocturneLine.jsx         녹턴 대사 1줄 타이핑 연출
│  │
│  ├─ hud/
│  │  ├─ AwakeningBanner.jsx      각성 이름 대형 타이포 (히트스톱 중)
│  │  ├─ BossHpBar.jsx            보스 HP (200ms 스로틀 구독)
│  │  ├─ PhaseToast.jsx           "01:00 축시" 페이드 인/아웃
│  │  └─ DebugPanel.jsx           모바일 실기용 치트 버튼 5개. DEBUG일 때만
│  │
│  ├─ common/
│  │  ├─ Button.jsx               터치 히트박스 1.5배 규칙 내장 (정본 03 §3.3)
│  │  ├─ Modal.jsx                배경 딤 + 포커스 트랩 없음(게임이므로 불필요)
│  │  ├─ IconSprite.jsx           icons16.png에서 배경 오프셋으로 아이콘 1개 렌더
│  │  └─ Fade.jsx                 CSS 트랜지션 래퍼 (JS 애니메이션 루프 금지)
│  │
│  ├─ hooks/
│  │  ├─ useGameEvent.js          EventBus 구독을 useEffect에 안전하게 묶음 (06 §3.6)
│  │  └─ useBackButton.js         웹 환경에서의 ESC 키 = 뒤로가기 동등 처리
│  │
│  └─ styles/
│     ├─ tokens.css               색·간격·폰트 CSS 변수 (심홍/청록/석조)
│     ├─ pact.css                 계약서 스타일 (양피지·인장·붉은 잉크)
│     └─ screens.css              화면 공통 레이아웃
│
├─ data/                          ─────────── 밸런싱은 전부 여기서. 코드 수정 없이
│  ├─ blessings.json              축복 22종 (정본 04 §7)
│  ├─ tolls.json                  대가 6종 + 태그·수치·하한 (정본 04 §4)
│  ├─ awakenings.json             각성 6종 + 완전 흡혈귀화 (정본 04 §5)
│  ├─ enemies.json                적 8 + 엘리트 2 + 보스 1 (정본 03 §7.2)
│  ├─ weapons.json                무기 5종 × Lv1~5 수치
│  ├─ passives.json               패시브 4종
│  ├─ phases.json                 4페이즈 스폰율·배율 곡선 (정본 03 §11)
│  ├─ metaUpgrades.json           성소 6종 × 단계별 비용 (정본 03 §9.1)
│  ├─ nocturneLines.json          녹턴 대사 12줄 (정본 01 §5.2)
│  └─ strings.ko.json             UI 문자열. i18n 키 구조만 (정본 03 §13)
│
├─ save/
│  ├─ SaveManager.js              ★ 2층 저장 래퍼 + 손상 복구 (06 §12)
│  │                              localStorage(동기 핫 캐시) + Preferences(비동기 영속층)
│  │                              hydrateSave() / loadSave() / writeSave() 3개만 export
│  └─ migrations.js               스키마 버전 마이그레이션 (v1 자리만)
│
└─ platform/
   └─ capacitor.js                네이티브 초기화·뒤로가기·appStateChange (06 §11.4)
                                  isNative export — SaveManager가 2층 분기에 쓴다
```

**파일 수 합계 약 90개.** 7일에 1인이 만드는 규모로 상한선이다. 여기서 더 쪼개지 않는다.

### 1.3 의존 방향 (단방향, 위반 금지)

```
ui/  ──▶ state/  ──▶ game/EventBus.js, game/constants.js
 │                         ▲
 └─────────────────────────┘   (ui는 EventBus로만 game에 말을 건다)

game/scenes ──▶ game/systems ──▶ game/entities ──▶ game/pools
     └────────▶ game/utils, game/weapons, data/, save/
```

- `ui/**` 에서 `import Phaser` 또는 `@/game/scenes/*`, `@/game/entities/*` → **금지**
- `game/**` 에서 `import ... from "react"` 또는 `@/ui/*` → **금지**
- `game/**` 에서 `@/state/store` import → **`getSnapshotForRun()` 하나만 허용.** 그 외 금지
- `data/*.json` 은 양쪽 모두 import 가능
- `save/**` 에서 `@/platform/capacitor` import → **`isNative` 하나만 허용.** 06 §12.1의 2층 분기에 필요하다.
  그 외 네이티브 API를 `save/`에서 직접 부르지 않는다 — 플랫폼 분기가 여러 곳으로 번지면 추적이 불가능해진다
- `platform/**` 는 **아무것도 import 하지 않는 최하위 계층에 가깝다.** 예외는 `game/EventBus`·`state/store`뿐이며(06 §11.4),
  `ui/**`·`save/**` 를 import 하지 않는다

---

## 2. 기존 스캐폴드 판정표

각 파일을 실제로 열어 확인한 결과에 기반한다.

### 2.1 설정 파일

| 파일 | 판정 | 이유 / 조치 |
|---|---|---|
| `FE/package.json` | **수정** | name `superdimension`→`bloodsworn`. 의존성 5개 제거 + Capacitor 플러그인 **4개** & sharp 추가. 스크립트 재정의(§7) |
| `FE/vite.config.js` | **수정** | `plugins`/`base:"./"`/`@` alias는 **그대로 유지**(이미 옳다). `build.rollupOptions.manualChunks`, `assetsInlineLimit:0`, `esbuild.drop` 추가. **`base:"./"`의 근거는 Capacitor WebView의 커스텀 스킴이다**(Android `https://localhost` / iOS `capacitor://localhost`) — 06 §14.1 |
| `FE/capacitor.config.json` | **수정** | `appId` → `com.bloodsworn.game`, `appName` → `BLOODSWORN`. `android`/**`ios`**/`plugins` 블록 추가(06 §11.1). `webDir:"dist"`, `bundledWebRuntime:false`는 유지. ⚠ **`server.url`을 남기지 않는다** |
| `FE/eslint.config.js` | **수정** | 현재 `globals.browser`만이라 `tools/*.mjs` lint 시 `process`/`URL` 미정의 에러. Node override 블록 추가(§4.3) |
| `FE/.prettierrc` | **유지** | semi/double quote/tabWidth 4/printWidth 100/es5/arrowParens — 그대로 따른다. 변경 없음 |
| `FE/.prettierignore` | **수정** | `node_modules, dist, .env, *.md` → `.env` 항목 제거(§8에서 `.env` 삭제), `public/assets`, `android`, `ios` 추가 |
| `FE/.gitignore` | **유지** | `node_modules`, `dist`, `*.local` 등 이미 충분 |
| **`FE/.gitignore copy`** | **삭제** | 파일명에 공백이 든 백업 잔재. 아무 역할 없음 |
| `FE/index.html` | **수정** | `lang="ko"`, title `BLOODSWORN · 피의 서약`, viewport에 `viewport-fit=cover, user-scalable=no` 추가, `vite.svg` favicon 교체 |
| `FE/README.md` | **수정** | Vite 기본 템플릿 문구 → 실행/빌드 절차로 교체 (10줄이면 충분) |
| 루트 `.gitignore` | **수정** | `asset/` 제외 규칙 추가(§6.4). `dist` 항목도 추가 |

### 2.2 소스 파일

| 파일 | 판정 | 이유 / 조치 |
|---|---|---|
| `src/main.jsx` | **수정(재작성)** | `QueryClientProvider` + `RouterProvider` 제거. `initNative()` → `createRoot(<StrictMode><App/></StrictMode>)` |
| `src/App.jsx` | **수정(전면 재작성)** | 현재 Vite+React 기본 템플릿(카운터 버튼, 로고). 게임과 무관. **추가로 `<Outlet/>`이 없어 라우터 자식이 렌더되지 않는 실제 버그가 있다.** → `screen` 스위치 + `GameCanvas` + `UiLayer` 구조로 교체 |
| `src/App.css` | **삭제** | 템플릿 스타일(로고 회전 애니메이션 등). `ui/styles/*`로 대체 |
| `src/index.css` | **수정(전면 재작성)** | 템플릿 기본값 → 06 §11.3의 모바일 게임 리셋으로 교체 |
| `src/router/index.jsx` | **삭제** | 라우터 제거 결정(06 §0.3). 디렉토리째 삭제 |
| `src/pages/MainPage/MainPage.jsx` | **삭제** | 본문이 `return;`(undefined 반환 → React 19 렌더 에러) + 미사용 `styles` import(ESLint 에러) |
| `src/pages/MainPage/MainPage.module.css` | **삭제** | **0바이트 빈 파일** |
| `src/pages/` (디렉토리) | **삭제** | `ui/screens/`가 대체 |
| `src/game/config.js` | **수정(전면 교체)** | 세로 375×667 + `Scale.RESIZE` + `AUDIENCE_LAYOUT`(이전 프로젝트 잔재). 06 §1.3으로 전체 교체 |
| `src/game/GameManager.js` | **수정(전면 교체)** | **존재하지 않는 `./scenes/AudienceRoomScene.js`를 import → 현재 빌드 불가.** 06 §3.7로 교체. `init/destroy/switchScene` 골격의 의도는 살리되 StrictMode·HMR 방어 추가 |
| `src/utils/getEnv.js` | **삭제** | §8. 미정의 시 throw 하는 함수인데 정의된 변수가 0개 |
| `src/utils/` (디렉토리) | **삭제** | 게임 유틸은 `game/utils/`로 간다. 빈 디렉토리를 남기지 않는다 |
| `src/.env` | **삭제** | **0바이트.** §8 |
| `src/assets/fonts/base_font.woff2` | **유지** | UI 한글 폰트로 사용. `ui/styles/tokens.css`에서 `@font-face` 등록 |
| `src/assets/react.svg` | **삭제** | 템플릿 잔재 |
| `public/vite.svg` | **삭제** | favicon을 게임 아이콘으로 교체 |

### 2.3 네이티브

| 파일 | 판정 | 조치 |
|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | **수정** | `<activity>`에 `android:screenOrientation="landscape"` 추가. `configChanges`, `launchMode="singleTask"`, FileProvider는 **유지**(정상) |
| `android/` 나머지 | **유지** | Capacitor 생성물. 앱 아이콘/`strings.xml`의 `app_name`만 Day 7에 교체 |
| `ios/App/App/Info.plist` | **수정** | ★ 판정이 바뀌었다. 가로 고정(`UISupportedInterfaceOrientations`)·`UIStatusBarHidden`·`UIRequiresFullScreen`·`ITSAppUsesNonExemptEncryption=false` (06 §11.1) |
| `ios/App/App.xcodeproj/project.pbxproj` | **수정** | `PRODUCT_BUNDLE_IDENTIFIER` = `com.bloodsworn.game`. iOS 배포 타겟 **14.0**. ⚠ **업로드 후 Bundle ID는 영구 변경 불가** |
| `ios/App/Podfile` | **확인** | iOS 배포 타겟 14.0이 여기에도 반영돼야 한다. CI가 `pod install`을 돌린다 |
| `ios/` 나머지 | **유지** | Capacitor 생성물. 앱 아이콘(**1024 무알파**)만 Day 7 경로에 남는다 |

> **★ `ios/` 판정이 "유지(빌드 안 함)"에서 "실 산출물"로 바뀌었다.**
> 이전 근거였던 "정본 01 §3.1이 이번 주 산출물에서 배제"는 **2026-08-10 사용자 결정으로 철회**됐다.
> iOS는 Android와 함께 Day 7 테스트 트랙 업로드 대상이다.
> **다만 이 문서가 다루는 것은 "어떤 파일이 어디 있고 무엇을 커밋하는가"까지다.**
> 서명·CI·업로드는 → `14-BUILD-AND-DEPLOY.md`.

### 2.4 의존성 판정

| 패키지 | 판정 | 근거 |
|---|---|---|
| `phaser ^3.90` | **유지** | 게임 엔진 |
| `react ^19.2`, `react-dom ^19.2` | **유지** | UI 셸 |
| `zustand ^5.0` | **유지** | 상태 |
| `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` | **유지** | 네이티브 |
| `@capacitor/ios` | **유지 (판정 근거 변경)** | 이전에는 "스캐폴드 유지 방침". **지금은 실제 배포 대상이다.** Capacitor **7** 유지 — 8로 올리지 않는다(06 §15) |
| **`firebase ^12.9`** | **제거** | 서버·계정·애널리틱스 전부 없음. gzip 약 120KB |
| **`axios ^1.13`** | **제거** | HTTP 요청 0건 |
| **`@tanstack/react-query ^5.90`** | **제거** | 서버 상태 0개 |
| **`react-hook-form ^7.71`** | **제거** | 폼 0개 |
| **`react-router-dom ^7.13`** | **제거** | 06 §0.3. 화면 5개는 `uiSlice.screen`으로 충분 |
| `eslint`, `prettier`, `vite`, `@vitejs/plugin-react` 등 devDeps | **유지** | |
| `@types/react`, `@types/react-dom` | **유지** | TS를 안 써도 에디터 자동완성에 쓰인다. 번들에 영향 없음 |
| **추가:** `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen` | **추가** | 06 §11.2 |
| **추가:** `@capacitor/preferences` | **추가 (신규)** | ★ 06 §12.0. **iOS localStorage는 transient**라 OS가 회수할 수 있다. 세이브 영속층으로 도입. 이전 문서의 "미도입" 결정을 뒤집은 것 |
| **추가(dev):** `sharp` | **추가** | 06 §8.3 에셋 스크립트 |

```bash
npm uninstall firebase axios @tanstack/react-query react-hook-form react-router-dom
npm i @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences
npm i -D sharp
```

> **플러그인은 4개에서 멈춘다.** 4번째(`preferences`)를 추가한 근거는 "세이브 전량 소실 방어"이며,
> 이 기준을 통과하지 못하는 플러그인은 이번 주에 넣지 않는다(06 §15).

### 2.5 Day 1 실행 순서 (이 순서 그대로)

1. **`git init` + GitHub 원격 저장소 생성 + 최초 push** (§6.1) → 현 상태 그대로 초기 커밋 ("chore: 스캐폴드 초기 상태 보존")
   **★ 원격 push까지가 1번이다.** 여기서 멈추면 iOS 경로 전체가 시작조차 못 한다(§6.1)
2. 삭제 목록 일괄 삭제 (`pages/`, `router/`, `utils/`, `.env`, `App.css`, `react.svg`, `vite.svg`, `.gitignore copy`)
3. 의존성 정리 (§2.4 명령 3줄)
4. `game/config.js`, `game/GameManager.js` 교체 + `game/EventBus.js`, `game/constants.js` 신규
5. `scenes/BootScene.js`, `PreloadScene.js`, `GameScene.js` 최소 골격 생성
6. `main.jsx`, `App.jsx`, `index.css` 재작성
7. **`npm run dev`로 검은 화면 + 캔버스가 뜨는지 확인 → 여기까지가 "빌드 복구 완료"**
8. 커밋 ("fix: 스캐폴드 정리 및 빌드 복구")

> **1~8을 Day 1 오전에 끝낸다.** 빌드가 깨진 상태로 하루를 넘기면 7일이 6일이 된다.

---

## 3. 네이밍 컨벤션

### 3.1 파일·디렉토리

| 대상 | 규칙 | 예 |
|---|---|---|
| React 컴포넌트 | `PascalCase.jsx` | `PactCard.jsx`, `SanctumScreen.jsx` |
| Phaser Scene | `PascalCase` + `Scene` 접미 | `GameScene.js`, `HudScene.js` |
| 시스템 | `PascalCase` + `System` 접미 | `EnemyAISystem.js` |
| 엔티티 | `PascalCase.js` | `Enemy.js`, `ExpOrb.js` |
| 훅 | `useXxx.js` | `useGameEvent.js` |
| 일반 모듈·유틸 | `camelCase.js` | `math.js`, `registerAnims.js` |
| Zustand 슬라이스 | `xxxSlice.js` | `runSlice.js` |
| 무기 | `w{번호}_{영문소문자}.js` | `w1_bloodfang.js` |
| 데이터 | `camelCase.json` | `metaUpgrades.json` |
| Node 스크립트 | `kebab-case.mjs` | `build-assets.mjs` |
| CSS | `kebab-case.css` | `screens.css` |
| 디렉토리 | 소문자 단수/복수 혼용 없이 **복수 = 모음, 단수 = 단일 개념** | `systems/`(모음), `save/`(개념) |

> **CSS Modules를 쓰지 않는다.** 컴포넌트가 20개뿐이고 클래스 충돌 위험이 낮다.
> `ui/styles/*.css`를 전역으로 import하고 BEM 유사 접두어(`pact-`, `hud-`, `screen-`)로 구분한다.
> 스캐폴드의 `MainPage.module.css` 방식은 계승하지 않는다.

### 3.2 코드 식별자

| 대상 | 규칙 | 예 |
|---|---|---|
| 클래스 | `PascalCase` | `class SpatialHash` |
| 함수·변수 | `camelCase` | `findNearest`, `tagCounts` |
| 상수(모듈 스코프 불변) | `SCREAMING_SNAKE` | `LOGICAL_WIDTH`, `AWAKEN_MAX` |
| 상수 객체 | `SCREAMING_SNAKE` | `EVENTS`, `BASE_STATS`, `TOLL_FLOORS` |
| private 관례 | `_` 접두 (문법적 강제 아님) | `this._cache` |
| 불리언 | `is/has/can/should` 접두 | `isPaused`, `hasAwakened`, `canSkip` |
| 이벤트 핸들러 | `on` 접두 | `onEnemyKilled`, `onPactChosen` |
| 구독 해제 함수 | `off` 접두 | `offHandlers` |

### 3.3 이벤트명

**규칙: `도메인:동작` 소문자 케밥. 항상 `EVENTS` 상수를 경유한다. 문자열 리터럴 직접 사용 금지.**

| 방향 | 접두 | 예 |
|---|---|---|
| P→R (상태 알림) | 도메인명 | `run:levelup`, `pact:applied`, `awakening:triggered`, `boss:hp` |
| R→P (명령) | **`cmd:`** | `cmd:pact-choose`, `cmd:pause`, `cmd:settings` |
| 진단 | `perf:` / `error:` | `perf:sample`, `error:fatal` |

방향이 이름에서 즉시 읽혀야 한다. `cmd:` 접두가 없는 이벤트를 React가 emit하면 규약 위반이다.

### 3.4 ★ Phaser 텍스처 키 / 프레임 / 애니메이션 키

**텍스처 키와 애니메이션 키는 Phaser 전역 네임스페이스를 공유한다.
충돌하면 조용히 잘못된 스프라이트가 나오고, 원인 추적에 반나절이 든다. 규칙을 엄격히 고정한다.**

**텍스처 키 — `snake_case`, 접두로 분류. 전체 목록을 `constants.js`에 상수로 박는다.**

| 접두 | 의미 | 키 예시 |
|---|---|---|
| (없음) | 액터 시트 | `player`, `enemies`, `boss` |
| `fx_` | 이펙트 | `fx_slash`, `fx_bullet`, `fx_holy`, `fx_chain`, `fx_orb` |
| `tiles_` | 타일셋 | `tiles_crypt` |
| `deco_` | 장식 애니메이션 | `deco_candle`, `deco_torch`, `deco_spike` |
| `ui_` | UI | `ui_hud`, `ui_joystick`, `icons16` |
| `map_` | Tiled JSON | `map_crypt` |
| `bgm_` / `sfx_` | 오디오 | `bgm_ambient`, `sfx_hit` |

```js
/** constants.js — 텍스처 키를 문자열로 흩뿌리지 않는다. */
export const TEX = {
    PLAYER: "player",
    ENEMIES: "enemies",
    BOSS: "boss",
    FX_SLASH: "fx_slash",
    FX_BULLET: "fx_bullet",
    TILES: "tiles_crypt",
    ICONS: "icons16",
    FONT: "pixel",
};
```

**애니메이션 키 — `카테고리/대상/동작` 슬래시 3단. 예외 없음.**

| 카테고리 | 형식 | 예 |
|---|---|---|
| 플레이어 | `player/{action}/{dir}` | `player/idle/down`, `player/run/left`, `player/attack1/up` |
| 적 | `enemy/{id}/{action}` | `enemy/bat/fly`, `enemy/stumbler/walk`, `enemy/hand/crawl` |
| 엘리트 | `elite/{id}/{action}` | `elite/feeder/walk` |
| 보스 | `boss/{id}/{action}` | `boss/executioner/attack`, `boss/executioner/summon` |
| 이펙트 | `fx/{name}/{variant}` | `fx/slash/01`, `fx/holy/impact`, `fx/chain/arc` |
| 장식 | `deco/{name}/{action}` | `deco/candleA/burn`, `deco/torch/burn` |
| 각성 | `awaken/{tag}/{part}` | `awaken/FRAIL/aura`, `awaken/SLOW/shock` |
| 픽업 | `pickup/{name}/{action}` | `pickup/orb/idle`, `pickup/chest/open` |

**왜 슬래시인가.** 3단 고정이면 `key.split("/")`로 프로그래매틱 조립이 가능하다.
적 8종 애니메이션을 8줄이 아니라 루프 하나로 등록할 수 있다.

```js
/**
 * registerAnims — 전 애니메이션 등록 단일 지점.
 * ★ 애니메이션 키가 생성되는 곳은 이 파일뿐이다. 다른 곳에서 anims.create()를 호출하지 않는다.
 */
import { TEX } from "@/game/constants";
import ENEMIES from "@/data/enemies.json";

const DIRS = ["down", "left", "right", "up"];
const PLAYER_ACTIONS = { idle: { row: 0, frames: 8, fps: 6 }, run: { row: 4, frames: 8, fps: 12 } };

/** @param {Phaser.Scene} scene */
export function registerAnims(scene) {
    const a = scene.anims;

    // ── 플레이어: player/{action}/{dir} ──
    for (const [action, cfg] of Object.entries(PLAYER_ACTIONS)) {
        DIRS.forEach((dir, i) => {
            const row = cfg.row + i;
            a.create({
                key: `player/${action}/${dir}`,
                frames: a.generateFrameNumbers(TEX.PLAYER, {
                    start: row * cfg.frames,
                    end: row * cfg.frames + cfg.frames - 1,
                }),
                frameRate: cfg.fps,
                repeat: -1,
            });
        });
    }

    // ── 적: enemy/{id}/{action}. enemies.png는 행 = 적 종류(06 §8.3) ──
    for (const def of Object.values(ENEMIES)) {
        if (def.kind !== "normal") continue;
        const base = def.row * def.framesPerRow;
        a.create({
            key: `enemy/${def.animId}/${def.action}`, // 예: enemy/bat/fly
            frames: a.generateFrameNumbers(TEX.ENEMIES, {
                start: base,
                end: base + def.frameCount - 1,
            }),
            frameRate: def.fps,
            repeat: -1,
        });
    }

    // ── 이펙트: fx/{name}/{variant} ──
    a.create({
        key: "fx/slash/01",
        frames: a.generateFrameNumbers(TEX.FX_SLASH, { start: 0, end: 7 }),
        frameRate: 24,
        repeat: 0,
    });
}
```

**디버그 안전장치.** 개발 모드에서 존재하지 않는 애니메이션 키를 재생하면 Phaser는 조용히 무시한다.
이를 즉시 잡기 위해 `Enemy.reset()`에 다음 가드를 넣는다.

```js
if (import.meta.env.DEV && !this.scene.anims.exists(def.anim)) {
    console.error(`[anim] missing key: ${def.anim} (enemy=${enemyId})`);
}
```

### 3.5 데이터 ID

| 도메인 | 형식 | 예 |
|---|---|---|
| 축복 | `bls_{짧은이름}` / 각인은 `_x` 접미 | `bls_w1`, `bls_dmg`, `bls_w2_x` |
| 대가 태그 | **대문자 단어** (정본 04 §4 그대로) | `FRAIL`, `SLOW`, `MYOPIA`, `GREED`, `BLIND`, `HUNGER` |
| 각성 | `awk_{태그소문자}` | `awk_frail`, `awk_hunger`, `awk_ascension` |
| 적 | `e{번호}_{영문}` / 엘리트 `el{n}_` / 보스 `boss_` | `e1_bat`, `el1_feeder`, `boss_executioner` |
| 무기 | `w{번호}_{영문}` | `w1_bloodfang` |
| 패시브 | `p{번호}_{영문}` | `p1_heart` |
| 성소 업그레이드 | `meta_{영문}` | `meta_toughness`, `meta_awakenBoost` |
| i18n 키 | `화면.요소` 점 표기 | `pact.reroll`, `result.retry` |

**태그만 대문자인 이유:** 정본 04가 `FRAIL`/`SLOW` 표기를 쓴다. 정본과 코드의 문자열이
1:1로 일치해야 문서를 보며 디버깅할 수 있다. 예외를 여기 하나만 둔다.

---

## 4. 코딩 스타일

### 4.1 Prettier (기존 `.prettierrc` 그대로 따른다 — 변경 없음)

```json
{
    "semi": true,
    "singleQuote": false,
    "tabWidth": 4,
    "printWidth": 100,
    "trailingComma": "es5",
    "jsxSingleQuote": false,
    "arrowParens": "always"
}
```

즉 이 프로젝트의 코드는 **들여쓰기 4칸 / 세미콜론 있음 / 큰따옴표 / 줄 100자 / ES5 트레일링 콤마 / 화살표 함수 괄호 항상**이다.
기존 `src/game/config.js`, `GameManager.js`, `main.jsx`가 이미 이 스타일이며, 새 코드도 전부 동일하게 쓴다.

**주의:** `.prettierignore`에 `*.md`가 있으므로 이 문서들은 Prettier 대상이 아니다. 그대로 둔다.

### 4.2 import 순서 (4블록, 블록 사이 빈 줄 1)

```js
// 1) 외부 패키지
import Phaser from "phaser";
import { useEffect } from "react";

// 2) 프로젝트 절대경로 (@/ alias — 기존 vite.config.js의 alias를 적극 사용한다)
import { EventBus } from "@/game/EventBus";
import { EVENTS, TEX } from "@/game/constants";
import ENEMIES from "@/data/enemies.json";

// 3) 상대경로 (같은 디렉토리 또는 인접)
import { SpatialHash } from "./utils/SpatialHash";

// 4) 스타일
import "@/ui/styles/pact.css";
```

**`@/` alias를 기본으로 쓴다.** 기존 스캐폴드가 `main.jsx`에서 `@/router`, `router/index.jsx`에서 `@/App`을
이미 쓰고 있다. 단, **같은 디렉토리 안(`./`)에서는 상대경로**를 쓴다(`./utils/SpatialHash` 같은 1단계까지).
`../../..` 처럼 2단계 이상 올라가는 상대경로는 금지한다.

### 4.3 ESLint (기존 설정 + Node override 추가)

기존 `eslint.config.js`는 flat config이고 `js.configs.recommended` + react-hooks + react-refresh를 쓰며,
`no-unused-vars`에 `varsIgnorePattern: "^[A-Z_]"` 가 걸려 있다(대문자 시작 미사용 변수 허용).
**이 구조를 유지하고 두 블록만 추가한다.**

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'android', 'ios', 'public/assets']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // ── 추가 ──
      // 빈 catch 블록을 허용한다. localStorage/오디오 unlock 방어 코드에서 필수(06 §12).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 릴리즈에서 esbuild가 console을 제거하므로 error/warn만 남기도록 유도
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // ── 추가: Node 스크립트 (tools/) ──
  {
    files: ['../tools/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: { 'no-console': 'off' },
  },
])
```

> `eslint.config.js` 자체는 스캐폴드가 2칸 들여쓰기 + 싱글쿼트로 작성되어 있다(Prettier 설정과 불일치).
> **이 파일 하나는 기존 스타일 그대로 둔다.** 설정 파일 하나 포맷 맞추자고 diff를 만들 이유가 없다.
> **`src/` 아래 새로 쓰는 코드는 전부 `.prettierrc` 규칙(4칸/더블쿼트)을 따른다.**

### 4.4 ★ JSDoc 타입 힌트 (TypeScript 대신)

TypeScript를 도입하지 않으므로(06 §15) **JSDoc이 유일한 타입 안전망이다.**
VS Code는 `.js`에서도 JSDoc을 읽어 자동완성과 타입 체크를 제공한다.

**필수로 다는 곳 (이 5가지는 예외 없이)**

1. 시스템 클래스의 `constructor` — `@param {GameScene} scene`
2. 공개 메서드의 모든 파라미터와 반환값
3. 콜백을 받는 함수 — `@param {(e: Enemy) => void} fn`
4. 데이터 구조를 담는 필드 — `@type {Enemy[]}`
5. `null`을 반환할 수 있는 함수 — `@returns {Enemy|null}`

**안 달아도 되는 곳:** 지역 변수, 3줄 이하의 화살표 함수, 자명한 게터.

**공용 타입은 `src/types.js` 하나에 `@typedef`로 모은다.** (런타임 코드 0줄인 파일)

```js
/**
 * 프로젝트 공용 타입 정의. 런타임에 아무것도 하지 않는다.
 * 사용: /** @type {import("@/types").Card} *​/
 */

/**
 * @typedef {"common"|"rare"|"epic"} Rarity
 * @typedef {"FRAIL"|"SLOW"|"MYOPIA"|"GREED"|"BLIND"|"HUNGER"} TollTag
 */

/**
 * @typedef {object} Blessing
 * @property {string} id
 * @property {string} name
 * @property {"weapon"|"stat"|"engrave"} kind
 * @property {Rarity[]} rarities
 * @property {number} maxLevel
 * @property {string} [requires] 선행 축복 id (각인 전용)
 */

/**
 * @typedef {object} Toll
 * @property {TollTag} tag
 * @property {string} name
 * @property {string} stat 영향 스탯 키
 * @property {"add"|"mul"} op
 * @property {number} magnitude 1중첩당 기본 수치
 * @property {number} rarityMult 등급배율 (common 1.0 / rare 1.8 / epic 1.4)
 */

/**
 * @typedef {object} Card
 * @property {string} uid
 * @property {Rarity} rarity
 * @property {Blessing} blessing
 * @property {Toll|null} toll
 * @property {number} stacks 부여 중첩 수 (epic은 2)
 * @property {number} humanityCost
 * @property {boolean} willAwaken 선택 시 각성이 발동하는가
 */

/**
 * @typedef {object} RunStats
 * @property {number} timeSec @property {number} kills @property {number} level
 * @property {number} gold @property {number} humanity
 * @property {string[]} awakenings @property {"A"|"B"|"C"|null} ending
 */

export {};
```

`jsconfig.json`을 `FE/`에 추가해 에디터가 alias와 체크를 인식하게 한다.

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["src/*"] },
        "checkJs": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx"
    },
    "include": ["src", "vite.config.js"],
    "exclude": ["node_modules", "dist", "android", "ios"]
}
```

> `checkJs: false`로 둔다. `true`로 켜면 기존 Phaser 타입과의 불일치 경고가 수백 개 쏟아져
> 진짜 문제를 가린다. 자동완성만 얻고 강제 체크는 포기한다. **7일에는 이게 옳은 트레이드오프다.**

### 4.5 기타 스타일 규칙

| 규칙 | 내용 |
|---|---|
| `var` 금지 | `const` 우선, 재할당 시에만 `let` |
| `==` 금지 | 항상 `===` (단, `x == null`로 null/undefined 동시 검사는 허용) |
| 옵셔널 체이닝 | 적극 사용. `scene.player?.hp` |
| `for...of` vs 인덱스 루프 | **런 루프(60fps 경로)에서는 인덱스 `for` 루프만.** `for...of`는 이터레이터 객체를 만든다. UI/초기화 코드에서는 자유 |
| `forEach` | 런 루프에서 금지 (콜백 할당). 초기화에서는 허용 |
| 배열 스프레드 | 런 루프에서 금지 (할당 발생). `array.length = 0` 사용 |
| 구조분해 | 런 루프에서 객체 구조분해 자제 (임시 객체 생성 여지). UI에서는 자유 |
| `class` 필드 문법 | 사용하지 않음. `constructor`에서 초기화 (esbuild target es2020 안전권) |
| 매직넘버 | 밸런스 수치는 전부 `data/*.json`. 코드 상수는 `constants.js` |
| 파일 길이 | 시스템 파일 300줄, 컴포넌트 200줄 상한. 넘으면 쪼갠다 |

---

## 5. 주석 / 문서화 규칙

7일 스코프다. **문서를 위한 문서를 쓰지 않는다.** 다음 4가지만 지킨다.

### 5.1 규칙 1 — 시스템/씬 파일 상단 요약 주석 **필수**

`game/systems/*`, `game/scenes/*`, `game/entities/*`, `state/*Slice.js` 는 예외 없이 파일 첫 줄에
블록 주석을 단다. 기존 스캐폴드(`config.js`, `GameManager.js`)가 이미 이 형식이므로 계승한다.

```js
/**
 * CollisionSystem — 공간해시 기반 충돌 판정.
 * 투사체↔적 / 적↔플레이어 / 장판↔적. Arcade Physics는 쓰지 않는다(06 §5.2).
 * ★ 제곱거리 비교만 사용. Math.sqrt 호출 금지.
 * 예산: 3.5ms/frame (06 §5.7)
 */
```

**포함할 것 4줄 이내:** 무엇을 하는가 / 관련 정본·기술문서 절 번호 / 성능·순서상의 제약 / 예산.

### 5.2 규칙 2 — "왜"만 쓰고 "무엇"은 쓰지 않는다

```js
// ❌ 코드를 그대로 읽은 주석
// i를 1 증가시킨다
i++;

// ✅ 이유를 남긴 주석
// splice는 O(n)이라 프레임당 수십 번이면 예산을 먹는다. 순서가 무의미하므로 swap-pop.
swapPop(this.active, i);

// ✅ 함정을 남긴 주석
// Tiled 타일셋 "이름"과 Phaser 텍스처 "키"가 다르면 조용히 빈 화면이 나온다.
map.addTilesetImage("crypt_tiles", TEX.TILES);
```

### 5.3 규칙 3 — `★` 마커로 위험 지점 표시

건드리면 게임이 깨지는 곳에 `★`를 붙인다. 검색 한 번으로 지뢰밭 전체를 볼 수 있다.

```js
// ★ 순서 고정: 가산 → 곱연산 → 각성 → floor. 바꾸면 밸런스가 무너진다(정본 03 §4.2).
// ★ 이 rebuild()는 모든 이동이 끝난 뒤 정확히 1회만 호출한다.
```

### 5.4 규칙 4 — TODO 태그 3종만

| 태그 | 의미 | 처리 |
|---|---|---|
| `// TODO(dayN):` | 해당 Day에 반드시 처리 | Day 종료 시 `grep TODO` 로 확인 |
| `// CUT:` | 시간 없으면 잘라낼 후보 | Day 6에 일괄 판단 |
| `// HACK:` | 알면서 지른 임시방편 | 남겨도 됨. 단 이유를 반드시 적음 |

`FIXME`, `XXX`, `NOTE` 같은 태그는 쓰지 않는다. 3종이면 충분하고, 종류가 늘면 아무도 안 본다.

### 5.5 하지 않는 것

- 함수 하나하나에 JSDoc 설명문 작성 (§4.4의 5가지 외에는 타입만)
- 별도 API 문서 생성 (JSDoc → HTML)
- 변경 이력 주석 (`// 2026-08-11 수정`) — git이 한다
- README에 아키텍처 설명 — `docs/06`이 한다. README는 실행 방법 10줄

---

## 6. Git 운영

### 6.1 현재 상태와 초기화

**이 프로젝트는 현재 git 저장소가 아니다.** `PJT20260810/` 아래에 `.git`이 없다.
루트에 `.gitignore`(react 템플릿)와 `FE/.gitignore`(vite 템플릿)만 존재한다.

> **★ 이 사실의 무게가 이번 개편에서 완전히 달라졌다.**
> 이전까지 git은 "사고 대비 백업 수단"이었다. **지금은 iOS 배포의 필수 경로다.**
> Mac이 없어 iOS 빌드를 전량 클라우드 macOS CI로 돌리는데, **CI 제공자는 예외 없이 원격 저장소를 트리거로 잡는다.**
> 즉 **원격 저장소가 없으면 iOS는 한 발짝도 못 나간다.** `git init`은 더 이상 "하면 좋은 것"이 아니라 **선행 블로커**다.

```bash
cd "C:/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git init
git branch -M main
git config core.autocrlf true       # Windows. 체크아웃 CRLF / 커밋 LF
git config core.longpaths true      # ★ asset/ 경로가 매우 길다. 이거 없으면 Windows에서 실패한다

# ★ 여기까지가 아니라, 아래까지가 Day 1 블로커다.
git add -A
git commit -m "chore: 스캐폴드 초기 상태 보존"
gh repo create bloodsworn --private --source=. --remote=origin   # 또는 웹에서 private 저장소 생성 후
# git remote add origin git@github.com:<계정>/bloodsworn.git
git push -u origin main
```

> **경고: 이 프로젝트는 OneDrive 동기화 폴더(`OneDrive/바탕 화면/`) 안에 있다.**
> OneDrive가 `.git/` 내부 파일을 동기화 중에 잠그면 git 작업이 간헐적으로 실패한다.
> **Day 1에 OneDrive 설정에서 이 폴더를 "항상 이 장치에 유지" + 동기화 제외로 바꾸거나,
> 프로젝트를 `C:\dev\bloodsworn` 같은 비동기 경로로 옮긴다.** 이건 선택이 아니라 필수다.
> 7일 중 하루를 파일 잠금 디버깅에 쓸 여유가 없다.
> **이 경고의 등급도 올라갔다** — git이 iOS 배포의 필수 경로가 된 이상, OneDrive 파일 잠금은
> "가끔 커밋이 실패한다"가 아니라 **"iOS 빌드를 못 올린다"** 로 번진다.

#### 6.1.1 원격 저장소 운영 규칙 (신설)

원격 저장소는 이제 백업 수단이자 **빌드 트리거**다. 두 역할이 겹치므로 규칙을 명시한다.

| 항목 | 규칙 | 근거 |
|---|---|---|
| 호스팅 | **GitHub private 저장소 1개** | CI 제공자(Codemagic·GitHub Actions) 양쪽이 모두 지원한다 |
| 공개 범위 | **private 고정** | 에셋 라이선스와 서명 관련 설정이 들어 있다. public으로 바꾸지 않는다 |
| 저장소 단위 | **`PJT20260810/` 루트 전체 1개.** `FE/`만 따로 떼지 않는다 | CI가 `codemagic.yaml`(루트)과 `FE/`를 함께 봐야 한다 |
| 기본 브랜치 | `main` | §6.2 |
| push 빈도 | **하루 최소 1회 + iOS 빌드가 필요할 때마다** | §6.5 |
| iOS 빌드 트리거 | **태그 push**를 기본으로 한다 (`git push origin --tags`) | 매 커밋마다 CI를 돌리면 무료 macOS 분량이 순식간에 소진된다 |
| 커밋 금지 대상 | 서명 자산 전부 (§6.4) | 유출 시 앱 사칭 배포가 가능해진다 |

**★ 왜 "태그 push 트리거"인가.**
클라우드 macOS CI의 무료 분량은 유한하고(수백 분 단위), **iOS 첫 그린 빌드까지는 서명·프로파일·Podfile에서
시행착오가 반복된다.** 1회 빌드가 10분 안팎이므로 **시행착오 횟수 = 성공 확률**이다.
Mac이 없어 로컬 재현이 불가능하고 **CI 로그가 유일한 진단 수단**인 이 프로젝트에서, 분량을 낭비하면
디버깅 기회 자체가 사라진다. **매 커밋 트리거는 금지한다.** (제공자 선정 근거와 분량 수치는 → `14-BUILD-AND-DEPLOY.md`)

**★ 원격이 없으면 무엇이 막히는가 — 순서대로**

```
원격 저장소 없음
  → CI 연결 불가
  → macOS 빌드 불가
  → .ipa 없음
  → App Store Connect 업로드 없음
  → TestFlight 없음
  → Day 7 목표의 절반이 사라진다
```

> **이 사슬에는 우회로가 없다.** Mac을 사서 로컬 빌드로 가는 길 외에는 전부 원격 저장소를 지난다.
> 그래서 이 작업이 Day 1 최상위 블로커다. → `12-TASK-BACKLOG.md` D0.

### 6.2 브랜치 전략 — **main / stage / dev 3단** (2026-08-10 확정)

> **변경 이력:** 이 문서의 초판은 "1인 개발이므로 `main` 단일"이었다.
> 2026-08-10에 사용자가 **main / stage / dev 3단 + 작업 브랜치** 방식으로 확정했다.

**원격:** `https://github.com/JH201421228/bloodsworn.git`

| 브랜치 | 역할 | 무엇이 들어오는가 |
|---|---|---|
| **`main`** | **배포 가능 상태.** 릴리스 태그(`v0.1.x`)가 찍히는 곳이며 **CI가 여기서 릴리스 빌드를 만든다** | `stage`에서만 머지 |
| **`stage`** | **통합 검증.** Day 6 기능 동결 후 회귀 테스트, Day 7 릴리스 리허설 | `dev`에서만 머지 |
| **`dev`** | **기본 통합 브랜치.** 평소 작업의 종착지이자 모든 작업 브랜치의 출발점 | 작업 브랜치에서 머지 |

**작업 흐름**

```
dev ──┬── feat/pact-cards ──┐
      │                     ├──▶ dev ──▶ stage ──▶ main ──▶ 태그 v0.1.x ──▶ CI 릴리스 빌드
      └── ci/ios-signing ───┘
```

```bash
# 1) 새 작업 시작 — 반드시 dev에서 판다
git switch dev && git pull origin dev
git switch -c feat/pact-cards

# 2) 작업 중 커밋 (하루 최소 3회 — 6.5)
git add -A
git commit -m "feat(pact): 카드 3장 UI + 축복/대가 적용"
git push -u origin feat/pact-cards

# 3) dev로 머지
git switch dev
git merge --no-ff feat/pact-cards      # --no-ff: 작업 단위를 히스토리에 남긴다
git push origin dev
git branch -d feat/pact-cards          # 로컬 정리
git push origin --delete feat/pact-cards

# 4) 매일 종료 시 태그 (되돌아갈 지점을 매일 만든다)
git tag -a day3 -m "Day3: PACT 시스템 최소 생존선 도달"
git push origin dev --tags

# 5) 승격 (Day 6 동결 시 / Day 7 릴리스 시)
git switch stage && git merge --no-ff dev   && git push origin stage
git switch main  && git merge --no-ff stage && git push origin main
git tag -a v0.1.1 -m "Day7 릴리스" && git push origin main --tags
```

**작업 브랜치 이름** — 커밋 `type`(6.3)과 같은 어휘를 쓴다: `feat/…` `fix/…` `perf/…` `ci/…` `docs/…` `spike/…`
`spike/`는 "될지 안 될지 모르는 실험"용이며 **실패하면 브랜치째 버린다**(머지하지 않는다).

> ⚠ **7일 스프린트에서 3단 브랜치는 그 자체로 오버헤드다.** 가볍게 유지하는 규칙 2가지:
> 1. **작업 브랜치는 하루를 넘기지 않는다.** 당일 안에 `dev`로 머지한다. 오래 살수록 충돌 비용이 기하급수로 는다.
> 2. **충돌이 나면 `rebase`로 씨름하지 말고 `dev` 기준으로 브랜치를 다시 판다.** 1인 개발이라 잃을 리뷰 이력이 없다.
>    25분 룰(`11-ROADMAP-7DAYS.md` 0.1)은 git에도 적용된다.
>
> **일정이 밀리면 `stage`를 건너뛰고 `dev → main` 직행해도 된다.** 브랜치 규칙 때문에 배포가 막히는 것이
> 가장 나쁜 결과다. 다만 그 경우 **Day 6 회귀 테스트를 `dev`에서 수행했다는 사실을 devlog에 남긴다.**

> **CI 트리거와의 관계:** 클라우드 macOS CI는 **`main`의 태그 push**를 릴리스 빌드 트리거로 잡는다
> (`14-BUILD-AND-DEPLOY.md` 6.4). Day 1~2 관통 리허설 동안에는 예외적으로 `dev` push도 트리거에 넣어 왕복을 줄이고,
> 관통이 끝나면 **`dev` 트리거를 끈다** — CI 분량(무료 500분)이 시행착오로 소진되는 걸 막기 위해서다.

### 6.3 커밋 메시지 규칙

**형식: `type(scope): 한국어 요약`** — Conventional Commits 축약판. 본문은 필요할 때만.

| type | 사용처 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `perf` | **성능 개선 (이 프로젝트에서 특히 중요. 나중에 무엇이 효과 있었는지 추적한다)** |
| `refactor` | 동작 변화 없는 구조 변경 |
| `chore` | 설정·의존성·빌드 |
| `asset` | 에셋 추가/변환 |
| `data` | 밸런스 JSON 수정 |
| `docs` | 문서 |

**scope**는 디렉토리 또는 시스템명: `pact`, `combat`, `hud`, `spawn`, `audio`, `cap`, `build`, **`ios`**, **`ci`**.

> `ios`와 `ci`를 추가한 이유: iOS 첫 그린 빌드까지는 **"CI 설정만 고친 커밋"이 연속으로 쌓인다.**
> 게임 코드 커밋과 섞이면 `git log`에서 시행착오 과정을 되짚을 수 없다.
> 예: `ci(ios): 프로비저닝 프로파일 주입 경로 수정`, `fix(ios): Info.plist 방향 배열에서 세로 제거`

```
feat(pact): 각성 트리거 + FRAIL/SLOW/HUNGER 3종 효과
fix(collision): 공간해시 셀 인덱스가 음수 좌표에서 뒤집히던 문제
perf(enemy): AI 재조준을 4그룹 틱 분산으로 변경 (150체 6.2ms → 2.4ms)
data(balance): 3:00 구간 스폰 간격 0.45s → 0.52s (플레이 테스트)
chore(deps): firebase/axios/react-query/react-hook-form/react-router 제거
```

**금지:** `수정`, `작업`, `wip`, `.`, `asdf` 같은 무의미한 메시지. 6일 뒤의 자신이 읽는다.

### 6.4 ★ `asset/` 폴더를 git에 넣을 것인가 — **넣지 않는다**

**실측: 7,846 파일 / 128 MB.**

| 판단 근거 | 내용 |
|---|---|
| **용량** | 128MB. GitHub 저장소 권장 상한(1GB)에 미달하지만, 매 clone이 128MB다 |
| **변경 없음** | 원본 에셋은 **한 번도 수정되지 않는다.** 버전 관리의 이득이 0이다 |
| **바이너리** | PNG/MP3는 델타 압축이 안 된다. 실수로 한 번 커밋하면 히스토리에서 영원히 안 지워진다 |
| **Windows 경로 길이** | `monsters/basic asset pack (8)/basic asset pack/Basic Undead Animations/...` — 260자 제한에 근접. git 작업 실패 원인 |
| **파일명** | 공백·괄호·대소문자 혼용(`Basic Asset Pack` vs `basic asset pack`)이 많다. **Windows는 대소문자 무시, git은 구분** → 유령 변경 발생 |
| **실사용률** | 7,846개 중 실제로 쓰는 건 **50개 미만**(적 8, 캐릭터 8, 이펙트 6, 타일 3, 아이콘시트 1, 오디오 25) |

**결론: `asset/`은 git에서 제외하고, 산출물인 `FE/public/assets/`(약 6MB)만 커밋한다.**

```gitignore
# ── 루트 .gitignore 에 추가 ──

# ★ 원본 에셋 128MB / 7,846파일. 변경되지 않으므로 버전 관리하지 않는다.
#    산출물 FE/public/assets/ 만 커밋한다. 원본은 OneDrive/외장디스크에 별도 백업.
/asset/

# 빌드 산출물
dist/
FE/dist/

# Capacitor 생성물 (android/ · ios/ 자체는 커밋하되 빌드 결과는 제외)
FE/android/app/build/
FE/android/build/
FE/android/.gradle/
FE/android/local.properties
FE/android/app/release/

# iOS 빌드 산출물 — Pods/는 Podfile.lock으로 재현된다. DerivedData는 거대하다
FE/ios/App/Pods/
FE/ios/App/build/
FE/ios/App/DerivedData/
FE/ios/App/App.xcworkspace/xcuserdata/
FE/ios/App/App.xcodeproj/xcuserdata/
*.ipa
*.xcarchive
*.dSYM.zip

# ── 서명 자산 — 절대 커밋 금지 ──
# Android 키스토어
*.keystore
*.jks
keystore.properties

# ★ iOS 서명 자산. Android 키스토어와 정확히 같은 강도로 다룬다.
#   이게 유출되면 제3자가 이 앱의 이름으로 서명된 빌드를 만들 수 있다.
*.p12                    # 배포 인증서 + 개인키 (CI에 base64로 주입)
*.p8                     # App Store Connect API 키 — 재발급 시 기존 키는 폐기된다
*.mobileprovision        # 프로비저닝 프로파일
*.cer                    # Apple이 발급한 인증서
*.certSigningRequest     # CSR
*.key                    # openssl로 만든 개인키. ★ 이것만 잃어도 인증서를 다시 만들어야 한다
ExportOptions.plist      # 팀 ID·프로파일 이름이 들어간다

# 세이브 백업 / 임시
*.corrupt.*
.DS_Store
Thumbs.db
desktop.ini
```

> **⚠ 서명 자산은 "실수로 커밋했다가 지우면 되는" 종류가 아니다.**
> git 히스토리에 한 번 들어가면 이후 커밋으로 지워도 **히스토리에 영원히 남는다.**
> 그래서 `.gitignore`를 **파일을 만들기 전에** 먼저 넣는다. 순서가 바뀌면 소용이 없다.
> 자산은 CI 시크릿(base64 문자열)으로만 전달하고, 로컬에서는 저장소 **바깥** 경로에 보관한다.
> 발급 절차와 CI 주입 방법은 → `14-BUILD-AND-DEPLOY.md`.

**대신 반드시 하는 것 3가지.**
1. `tools/asset-manifest.json`을 커밋한다 → **"원본 어디서 무엇을 가져왔는지"가 버전 관리된다.** 원본만 있으면 산출물을 언제든 재생성할 수 있다.
2. `asset/`을 외장 디스크 또는 별도 클라우드에 **1회 백업**한다. (OneDrive에 이미 있지만 동기화 제외 시 사라질 수 있으므로 별도 사본)
3. `docs/`에 원본 출처와 라이선스를 기록한다. 각 팩의 `License.txt`, `public-license.txt`, `Special Note to the Dev.txt`가 원본에 있으므로 **해당 파일들만 `FE/public/licenses/`에 복사해 커밋**한다(배포 시 라이선스 고지 의무).

> **`FE/android/`는 커밋한다.** Capacitor가 재생성할 수 있지만, `AndroidManifest.xml`의 방향 고정과
> 아이콘·`strings.xml` 수정이 들어가므로 잃으면 다시 해야 한다. `build/`, `.gradle/`만 제외한다.
>
> **`FE/ios/`도 같은 이유로 커밋한다. 다만 이유가 하나 더 있다.**
> `Info.plist`의 가로 고정·수출 규정 응답, `project.pbxproj`의 Bundle ID와 배포 타겟 14.0은
> **CI가 체크아웃해서 그대로 빌드하는 입력값**이다. 커밋되지 않으면 CI는 그 수정을 볼 수 없다.
> **Mac이 없으므로 "CI가 뭘 빌드했는지"를 확인할 수단은 저장소 내용뿐이다.**
> `Podfile.lock`도 반드시 커밋한다 — CocoaPods 버전이 매 빌드마다 흔들리면 재현 가능한 빌드가 성립하지 않는다.

### 6.5 실전 규칙 — **하루 최소 3커밋**

| 시점 | 커밋 성격 |
|---|---|
| 오전 종료 (~13:00) | 그날의 첫 기능 단위 |
| 오후 종료 (~18:00) | 두 번째 기능 단위 |
| 작업 종료 | 통합 + **일일 태그 + push** |

**왜 3회인가.** 7일 프로젝트에서 가장 무서운 사고는 "어제까지 되던 게 안 되는데 어디서 깨졌는지 모르겠다"다.
커밋 간격이 3시간이면 `git diff`로 추적 가능하지만, 하루면 불가능하다.
`git stash`와 `git reset --hard`를 부담 없이 쓸 수 있는 상태를 유지하는 것 자체가 개발 속도다.

**추가 규칙**
- **빌드가 깨진 상태로 커밋하지 않는다.** 커밋 전 `npm run build`가 통과해야 한다. (`npm run lint`는 통과 권장, 강제 아님)
- 밸런스 수치 변경(`data/*.json`)은 **반드시 별도 커밋**. 코드 변경과 섞으면 "밸런스만 되돌리기"가 불가능해진다.
- Day 4 종료 시점(정본 04 §11의 "최소 생존선")에 도달하면 `git tag mvp` 를 별도로 찍는다.

---

## 7. npm 스크립트 최종 정의

기존 `package.json`의 스크립트 12개 중 유지 6 / 삭제 2 / 수정 4 / 추가 6.

```json
{
    "name": "bloodsworn",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview",
        "lint": "eslint .",
        "lint:fix": "eslint . --fix",
        "format": "prettier --write \"src/**/*.{js,jsx,css}\" \"*.{js,json}\"",
        "build:atlas": "node ../tools/build-assets.mjs",
        "cap:sync": "npx cap sync",
        "cap:sync:android": "npx cap sync android",
        "cap:sync:ios": "npx cap sync ios",
        "cap:open": "npx cap open android",
        "cap:run": "npx cap run android",
        "build:android": "npm run build && npx cap sync android",
        "build:ios": "npm run build && npx cap sync ios",
        "build:aab": "npm run build:android && cd android && gradlew.bat bundleRelease",
        "preflight": "npm run lint && npm run build"
    }
}
```

| 스크립트 | 판정 | 설명 |
|---|---|---|
| `dev` | 유지 | Vite dev 서버. 디버그는 `http://localhost:5173/?debug=1` |
| `build` | 유지 | `dist/` 산출 |
| `preview` | 유지 | 빌드 결과 로컬 검증 (`base:"./"`로 상대경로 로드가 되는지 확인). **네이티브에 넣기 전 유일한 로컬 관문** |
| `lint` | 유지 | |
| `lint:fix` | **추가** | |
| `format` | **추가** | 스캐폴드에 prettier가 devDep으로만 있고 스크립트가 없었다 |
| `build:atlas` | **추가** | 06 §8.3. `tools/`가 `FE/` 밖이므로 `../tools/` 경로 |
| `cap:sync` | **수정(원복)** | `npx cap sync` — **인자 없이 양 플랫폼을 동기화한다.** 이전 개정에서 `android`로 고정했으나 iOS가 배포 대상이 되어 되돌린다 |
| `cap:sync:android` | **추가** | 한쪽만 돌리고 싶을 때 |
| `cap:sync:ios` | **추가** | ★ **Windows에서 실행된다.** 파일 복사와 네이티브 설정 갱신뿐이므로 Mac이 필요 없다 |
| `cap:open:android` → `cap:open` | **수정(축약)** | Android Studio 실행 |
| `cap:run:android` → `cap:run` | **수정(축약)** | |
| `build:android` | 유지 | |
| `build:ios` | **유지 (판정 변경)** | 이전에는 "삭제". **지금은 iOS CI 파이프라인의 로컬 전단계다.** `vite build` → `cap sync ios`까지가 Windows의 몫 |
| **`cap:open:ios`, `cap:run:ios`** | **삭제** | ⚠ **둘 다 macOS 전용이다.** `cap open ios`는 Xcode를 열고 `cap run ios`는 시뮬레이터/실기기에 설치한다. **Mac이 없으므로 실행 자체가 불가능하다.** 남겨두면 "왜 안 되지"로 시간을 버린다 |
| `build:aab` | **추가** | Day 7 릴리즈. Windows이므로 `gradlew.bat` |
| `preflight` | **추가** | **커밋 전 1회 실행하는 관문.** §6.5의 "빌드 깨진 채 커밋 금지"를 강제 |

**★ Windows에서 어디까지 갈 수 있는가 — 이 경계를 외워 둔다.**

| 단계 | Android | iOS |
|---|---|---|
| `npm run build` (`dist/`) | Windows | Windows |
| `npx cap sync` | Windows | **Windows** |
| 네이티브 프로젝트 열기 | Windows (Android Studio) | **불가 (Xcode = macOS 전용)** |
| 의존성 설치 | Windows (Gradle) | **macOS (`pod install`) → CI** |
| 아카이브·서명 | Windows (`gradlew.bat bundleRelease`) | **macOS (`xcodebuild archive` → `exportArchive`) → CI** |
| 스토어 업로드 | Play Console 웹 업로드 | **CI → App Store Connect** |

> **결론: `npm run build:ios`까지가 로컬의 끝이다.** 그 다음은 커밋·push하고 CI에 맡긴다.
> **`cap sync ios` 결과를 커밋하지 않은 채 CI를 돌리면 CI는 옛 `dist/`를 빌드한다** — iOS에서 가장 흔한 자충수다.
> CI 워크플로 전문은 → `14-BUILD-AND-DEPLOY.md`.

**환경 요구사항 (Capacitor 7 기준).**

| 항목 | 값 | 어디서 필요한가 |
|---|---|---|
| Node.js | **20 이상** | 로컬 + CI 양쪽. Day 1에 `node -v`로 대조한다 |
| Xcode | **16.0 이상** | CI 머신만 (로컬에 없다) |
| iOS 최소 배포 타겟 | **14.0** | `project.pbxproj`와 `ios/App/Podfile` **양쪽에** 반영 |
| CocoaPods | 필요 | CI 파이프라인에 **`pod install` 단계가 반드시 들어간다** |

> 로컬 Node가 20 미만이면 **CI에서만 재현되는 빌드 실패**가 생긴다. Mac이 없어 진단이 CI 로그뿐인 상황에서
> 이런 종류의 불일치는 비용이 크다. 버전을 먼저 맞춘다.

`"type": "module"` 을 추가한다. `tools/*.mjs`와 `vite.config.js`의 ESM 일관성을 위해서다.
(현재 `vite.config.js`가 이미 ESM 문법이고 확장자가 `.js`이므로, Vite는 자체 처리하지만 명시가 안전하다.)

---

## 8. 환경 변수 — **쓰지 않는다**

### 8.1 현황

- `FE/src/.env` — **0바이트.** 정의된 변수가 하나도 없다.
- `FE/src/utils/getEnv.js` — `import.meta.env["VITE_"+key]`를 읽고, **`undefined`면 `throw`** 한다.

즉 현재 `getEnv("ANYTHING")`을 호출하면 **무조건 예외가 발생한다.** 아무도 호출하지 않아서
문제가 드러나지 않았을 뿐인 지뢰다.

추가로, **`.env`가 `src/` 안에 있는 위치 자체가 잘못됐다.** Vite는 `.env`를 **프로젝트 루트**
(`FE/.env`)에서 읽는다. `src/.env`는 Vite가 아예 보지 않는다. 애초에 동작한 적이 없는 파일이다.

### 8.2 필요한가 — 필요 없다

환경변수가 필요한 상황은 보통 다음 4가지인데, 이 게임은 전부 해당하지 않는다.

| 통상 용도 | 이 게임 |
|---|---|
| API 서버 주소 | **서버 없음** (정본 03 §9) |
| API 키 / 시크릿 | **외부 서비스 0개** (firebase 제거) |
| 애널리틱스 ID | **없음** |
| 개발/운영 분기 | `import.meta.env.DEV` / `import.meta.env.PROD`가 **Vite 내장으로 이미 제공된다.** 별도 파일 불필요 |

**추가 근거:** Capacitor로 빌드하면 `.env` 값은 그대로 번들에 박혀 APK 안에 문자열로 남는다.
클라이언트 전용 앱에서 `.env`는 **비밀 보관 수단이 아니다.** 숨길 것도 없고 숨길 수도 없다.

### 8.3 결정

**`FE/src/.env` 와 `FE/src/utils/getEnv.js` 를 모두 삭제한다.**
개발/운영 분기가 필요한 곳은 Vite 내장 상수와 URL 파라미터로 처리한다(06 §13.1).

```js
/** game/debug.js — 환경변수 대신 이걸 쓴다. */
const params = new URLSearchParams(location.search);

/** 개발 서버이거나 ?debug=1 이면 디버그 모드 */
export const DEBUG = import.meta.env.DEV || params.has("debug");

/** @param {string} key @param {string|null} [fallback] */
export function debugParam(key, fallback = null) {
    return DEBUG ? (params.get(key) ?? fallback) : fallback;
}

/** 빌드 정보 — 릴리즈 화면 하단에 작게 표시해 실기 테스트 시 버전을 식별한다. */
export const BUILD = {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
};
```

`.prettierignore`에서도 `.env` 줄을 제거한다(더 이상 존재하지 않는 파일).

> **만약 나중에** 온라인 랭킹 같은 것을 붙이게 되면, 그때 `FE/.env`(루트)를 만들고
> `import.meta.env.VITE_XXX`를 **직접** 읽는다. `getEnv()` 같은 throw하는 래퍼는 다시 만들지 않는다.
> 환경변수 하나 없다고 게임이 죽는 것보다, 값이 `undefined`인 채로 기능만 꺼지는 게 낫다.

> **★ CI 시크릿은 `.env`와 완전히 별개다. 섞지 않는다.**
> iOS 서명 자산(`.p12` 암호, App Store Connect API 키 등)은 **CI 제공자의 시크릿 저장소에만** 넣는다.
> `.env`에 넣으면 **번들에 문자열로 박혀 앱에 그대로 들어간다**(위 §8.2의 근거가 그대로 적용된다).
> 즉 `.env`를 쓰지 않는 결정은 iOS 도입 이후에도 그대로 유효하며, **오히려 더 중요해졌다.**

---

## 9. 요약 체크리스트 (Day 1 오전에 이대로 실행)

**A. 저장소 — ★ 여기가 막히면 iOS 경로 전체가 막힌다 (§6.1)**

- [ ] OneDrive 동기화 문제 해결 (§6.1 경고) — 폴더 이동 또는 동기화 제외
- [ ] `git init` + `core.longpaths true` + 초기 커밋
- [ ] 루트 `.gitignore`에 `/asset/`·빌드 산출물·**iOS 서명 자산** 규칙 추가 (§6.4) — **파일을 만들기 전에 먼저**
- [ ] **GitHub private 원격 저장소 생성 + `git push -u origin main`** ← **Day 1 최상위 블로커**

**B. 정리와 의존성**

- [ ] 삭제: `src/pages/`, `src/router/`, `src/utils/`, `src/.env`, `src/App.css`, `src/assets/react.svg`, `public/vite.svg`, `FE/.gitignore copy`
- [ ] `npm uninstall firebase axios @tanstack/react-query react-hook-form react-router-dom`
- [ ] `npm i @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences && npm i -D sharp`
- [ ] `node -v`가 **20 이상**인지 확인 (§7)
- [ ] `package.json` name/scripts 교체 (§7), `"type": "module"` 추가

**C. 코드 복구**

- [ ] `game/config.js` 전면 교체 (640×360 가로, `Scale.FIT`)
- [ ] `game/GameManager.js` 전면 교체 (**빌드 복구 — 최우선**)
- [ ] `game/EventBus.js`, `game/constants.js`, `game/debug.js` 신규
- [ ] `main.jsx`, `App.jsx`, `index.css` 재작성 — **`main.jsx`에 `await hydrateSave()` 포함**(06 §12.2)
- [ ] `index.html` 교체 (`lang="ko"`, `viewport-fit=cover`)
- [ ] `eslint.config.js`에 Node override + 규칙 2개 추가
- [ ] `jsconfig.json`, `src/types.js` 신규

**D. 네이티브 — 양 플랫폼을 같은 날 건드린다**

- [ ] `capacitor.config.json` appId/appName 교체 + `android`/`ios` 블록 (06 §11.1)
- [ ] `AndroidManifest.xml`에 `android:screenOrientation="landscape"` 추가
- [ ] `ios/App/App/Info.plist` — 가로 고정 배열에서 **세로 제거** + `ITSAppUsesNonExemptEncryption=false`
- [ ] `project.pbxproj`의 `PRODUCT_BUNDLE_IDENTIFIER` = `com.bloodsworn.game` / 배포 타겟 14.0
- [ ] `npm run build:ios` 실행 → **`ios/` 변경분을 커밋**한다 (§7)

- [ ] **`npm run preflight` 통과 확인 → 커밋 + push**

> **Day 1~2의 iOS 목표는 "게임이 도는 것"이 아니라 "빈 껍데기라도 TestFlight까지 한 번 도달하는 것"이다.**
> 이 문서의 범위는 위 D까지이고, 그 다음 구간(서명·CI·업로드)은 `14-BUILD-AND-DEPLOY.md`와
> `11-ROADMAP-7DAYS.md`가 이어받는다.

---

## 10. 관련 문서

- 기술 설계 전반: → `06-TECH-DESIGN.md` (저장 결정 변경은 §12.0, iOS 네이티브 설정은 §11)
- 게임 규격: → `03-GDD-CORE.md` (정본)
- PACT 시스템: → `04-PACT-SYSTEM.md` (정본)
- 데이터 스키마: → `08-DATA-SCHEMA.md`
- 서명 자산·CI 워크플로·스토어 업로드: → `14-BUILD-AND-DEPLOY.md` (§1.1, §6.1, §6.4, §7에서 참조)
- 7일 일정과 선행 블로커: → `11-ROADMAP-7DAYS.md`, `12-TASK-BACKLOG.md` (§6.1의 원격 저장소 블로커)
- 7일 일정: → `11-ROADMAP-7DAYS.md`
