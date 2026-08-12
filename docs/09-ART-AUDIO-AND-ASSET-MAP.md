# 09. 아트·오디오 디렉션 & 에셋 매핑

> **문서 지위: 실행 문서(하위).** 상위 규격은 `01-CONCEPT-AND-STORY.md`, `03-GDD-CORE.md`, `04-PACT-SYSTEM.md`.
> 충돌 시 위 3개 정본이 우선한다.
> 최종 수정: 2026-08-10 / 작성: 아트·오디오 디렉션 겸 에셋 관리
> 라이선스 판정은 `17-LICENSES-AND-CREDITS.md`, 이미지 생성 프롬프트는 `15-IMAGE-PROMPTS-FOR-CODEX.md`.

---

## 0. 이 문서의 신뢰 규약

| 표기 | 뜻 |
|---|---|
| ✅ | **실측/원문 확인 완료.** 이 문서 작성 중 파일을 직접 디코딩하거나 텍스트를 직접 읽어 확인함 |
| 🔶 | **근거 있는 추정.** 파일명·구조·업계 관례에 기반. 실물 재확인 전에는 코드에 하드코딩 금지 |
| ❓ | **미확인.** 반드시 `TASK AT-xx`로 처리한 뒤 사용 |

### 0.1 검증에 사용한 방법 (재현 가능)

`asset/` 전체 **7,846개 파일 / 128MB**를 전수 조사했다. 도구는 아래와 같다.

1. `find` + `file` — 전 PNG의 헤더 픽셀 크기 확인
2. **자체 작성 순수 파이썬 PNG 디코더** (zlib + 언필터링) — 알파 채널을 복원해
   **빈 행/열 런(run)** 을 계산 → 프레임 경계를 실제로 측정
3. 격자 점유도 맵 — 시트를 N×M 격자로 나눠 각 칸의 불투명 픽셀 수를 출력 → 행/열의 의미 판별
4. 몽타주 생성기 — 여러 시트의 특정 행만 잘라 한 장으로 합쳐 육안 확인
5. **자체 작성 Node WOFF2 파서** (brotli 해제 → `name`/`cmap` 테이블 파싱) — 폰트 정체·글리프 커버리지 확인
6. 자체 MP3 프레임 헤더 파서 — BGM 21곡의 길이/비트레이트 산출
7. `md5sum` — 중복 파일 검출

> ⚠️ **이 문서에 적힌 모든 경로는 실존을 개별 확인했다.** 확인하지 않은 경로는 쓰지 않았다.

---

## 1. 아트 디렉션

정본 `01-CONCEPT-AND-STORY.md` §7의 톤 가이드("심홍·청록·무채색 석조 / 두 광원의 대비가 시그니처")를
**구현 가능한 수치 규격**으로 확정한다.

### 1.1 코어 팔레트 (16색)

전 UI·VFX·틴트는 이 16색 밖으로 나가지 않는다. 도트 원본(구입 에셋)의 색은 건드리지 않되,
**우리가 그리는 것(UI, 파티클, 오버레이, 틴트, 폰트)** 은 전부 여기서만 고른다.

| # | 토큰 | HEX | 역할 |
|---|---|---|---|
| 01 | `VOID` | `#0B0710` | 배경/레터박스. **정본 §2.1 지정값** |
| 02 | `INK` | `#14101C` | 패널 바닥, 카드 배경 |
| 03 | `STONE_DARK` | `#241E2E` | 카드 프레임 안쪽, 비활성 UI |
| 04 | `STONE` | `#3A3345` | 구획선, 게이지 트랙 |
| 05 | `STONE_LIGHT` | `#6E6478` | 보조 텍스트, 비활성 라벨 |
| 06 | `BONE` | `#D8CFC0` | **기본 본문 텍스트색** (순백 금지 — 눈부심) |
| 07 | `BLOOD_DEEP` | `#4A0A14` | 피 그림자, 05:00 구간 화면 틴트 |
| 08 | `BLOOD` | `#8E1220` | HP 게이지, 대가 잉크 |
| 09 | `BLOOD_BRIGHT` | `#D6203A` | **Epic 등급색**, 위험 강조, 각성 플래시 |
| 10 | `EMBER` | `#FF6B4A` | 불꽃 하이라이트, 화염탄 코어 |
| 11 | `VOTIVE_DEEP` | `#0E3B3A` | 성촉 광원의 그림자 |
| 12 | `VOTIVE` | `#2FBFA8` | **Rare 등급색**, 성촉 불빛, EXP 오브 T1 |
| 13 | `VOTIVE_BRIGHT` | `#7FF3DE` | 성촉 코어, 회복 연출 |
| 14 | `COMMON` | `#9AA0A6` | **Common 등급색** (정본 "회백") |
| 15 | `GOLD` | `#E8B44C` | 골드, **각성 임박 맥동 테두리**, 인장 |
| 16 | `DANGER` | `#FF3B30` | 보스 텔레그래프 인디케이터 **전용**. 다른 곳에 절대 쓰지 않는다 |

**등급색 = 정본 §3(04-PACT)과 1:1 대응** — Common 회백 `#9AA0A6` / Rare 청록 `#2FBFA8` / Epic 심홍 `#D6203A`.

### 1.2 대가 태그 6종 — 색 & 상징

정본 `04-PACT-SYSTEM.md` §4의 6태그에 고유 색과 아이콘 방향을 부여한다.
**태그색은 "대가 배지"와 "각성 오라 파티클"에만 쓴다.** 카드 테두리(등급색)와 절대 같은 요소에 얹지 않는다
— 둘이 겹치면 플레이어가 등급과 태그를 혼동한다.

| 태그 | 한글 | 태그색 | 오라색(파티클) | 상징 아이콘 방향 (16×16 실루엣) |
|---|---|---|---|---|
| `FRAIL` | 허약 | `#D9D2C4` | `#F2ECE0` | **금이 간 심장.** 세로로 갈라진 균열 1줄. 흰 뼈빛 |
| `SLOW` | 둔족 | `#4E7FA8` | `#7FB0D6` | **발목의 족쇄 + 늘어진 사슬 3링.** 아래로 처지는 실루엣 |
| `MYOPIA` | 근시 | `#8B54C6` | `#B98BE6` | **초점 잃은 눈동자.** 홍채가 두 겹으로 어긋난 형태 |
| `GREED` | 탐욕 | `#D9A02B` | `#F0C96B` | **이빨 자국이 난 동전.** 반원으로 베어 물린 원 |
| `BLIND` | 암야 | `#8E7CE0` | `#3B2E63` | **감긴 눈 위의 초승달.** 눈은 가로선 1줄 |
| `HUNGER` | 갈증 | `#B3202E` | `#E04050` | **마른 성배 + 아래로 떨어지는 핏방울 1개** |

> 태그색 선정 기준: (a) 서로 색상환에서 최소 40° 이상 떨어질 것, (b) `VOID` 배경 위 명도차 ≥ 45,
> (c) 등급 3색과 헷갈리지 않을 것. `HUNGER #B3202E`만 Epic `#D6203A`와 가까우므로
> **HUNGER 배지는 반드시 어두운 테두리(`#4A0A14` 1px)를 두른다.**

### 1.3 픽셀 밀도 규칙

| 항목 | 규칙 | 근거 |
|---|---|---|
| **기준 그리드** | **16×16 px** | 정본 §2.2 "일반 적 16×16", 타일 16×16 |
| 논리 해상도 | 640×360, `zoom = 1.0` | 정본 §2.1 |
| 스케일 | **모든 인게임 스프라이트 `scale = 1.0`** | 확대/축소 즉시 도트가 깨진다 |
| 예외 | 확대가 필요하면 **정수배(2×, 3×)만** 허용. 1.5× 금지 | |
| 원본 밀도가 다른 에셋 | 보스(140×93, 80×80)·이펙트(64×64)는 원본 그대로 배치. **적(16px)과 밀도가 다르므로 "크다"로 읽히는 것이 오히려 의도** | |
| 플레이어 | ✅ 실측 유효 실루엣 **약 19×34 px** (프레임은 96×80) | 정본 §2.2의 "약 32×40"은 실측과 다름 → **정본 수치를 실측값으로 갱신 권고** |
| `roundPixels` / `pixelArt` | 둘 다 `true` (정본 §2.1) | 서브픽셀 지터 방지 |
| 위치 좌표 | 물리는 실수, **렌더 직전 `Math.round()`** | 대각 이동 시 떨림 방지 |

### 1.4 아웃라인 정책

구입 에셋은 아웃라인 유무가 제각각이다(적 16×16은 부분 아웃라인, 보스는 노 아웃라인).
**원본을 수정하지 않는다.** 대신 우리가 그리는 레이어에만 아래 규칙을 적용한다.

| 대상 | 아웃라인 |
|---|---|
| 구입 스프라이트(적/플레이어/보스/이펙트) | **손대지 않음** |
| 적 강조(엘리트/보스 소환체) | 런타임 1px 외곽선 셰이더 대신 **`#D6203A` 그림자 스프라이트를 1px 오프셋으로 뒤에 깔기** (셰이더 금지 — 정본 §3.1) |
| UI(카드/버튼/배지/게이지) | **1px `#0B0710` 아웃라인 필수.** 어두운 배경 위에서도 형태가 끊기지 않게 |
| 아이콘(Raven) | 원본 그대로. 카드 위에 올릴 때만 `#0B0710` 1px 아웃라인 프레임 안에 배치 |
| 텍스트 | 아웃라인 대신 **`#0B0710` 그림자 1px (offsetX 0, offsetY 1)** |

### 1.5 조명 표현 — 가산 블렌드 스프라이트

셰이더/라이팅 파이프라인은 정본 §3.1에서 금지. **가산 블렌드 스프라이트만으로 두 광원을 표현한다.**

| 광원 | 구현 | 색 | 블렌드 |
|---|---|---|---|
| 성촉/횃불(청록) | 반경 40px 원형 그라디언트 스프라이트 1장(코드 생성 또는 32×32 PNG) | `#2FBFA8` → 투명 | `Phaser.BlendModes.ADD`, alpha 0.35, 스케일 ±6% 사인 펄스(주기 1.4s) |
| 플레이어 주변(심홍) | 반경 28px 동일 스프라이트 | `#8E1220` → 투명 | `ADD`, alpha 0.22 |
| 각성 오라 | 태그 오라색, 반경 36px | 태그별 | `ADD`, alpha 0.30, 주기 0.9s |
| 05:00 구간 화면 붉어짐 | 전체 화면 사각형 1장 | `#4A0A14` | `Phaser.BlendModes.MULTIPLY` 대신 **`ADD` alpha 0→0.18 로 4:30~6:00 선형 램프** |

> **광원 스프라이트는 딱 1종만 만든다.** 색은 `setTint`로 바꾼다. 텍스처 1장 = 드로우콜 절약.

### 1.6 가독성 규칙 (양보 불가)

150체가 동시에 화면에 뜨는 게임이다. **"적이 배경에 묻힌다"는 즉시 사망 사유**다.

| # | 규칙 | 수치 |
|---|---|---|
| R1 | 적 실루엣과 그 바로 아래 바닥 타일의 **상대 명도차(WCAG relative luminance) ≥ 0.18** | 미달 시 해당 바닥 타일을 `#241E2E`로 어둡게 교체 |
| R2 | 바닥 타일 팔레트는 **명도 0.03 ~ 0.16 구간에만** 존재 | 밝은 바닥 금지 |
| R3 | 적은 항상 바닥보다 **밝게**. 어두운 적(예: 진홍 임프)은 `setTint(0xFF9080)` 로 +12% 밝힘 | |
| R4 | **적 발밑 그림자 필수** — 8×3 타원, `#000000` alpha 0.35. 이게 없으면 부유해 보이고 위치 판독이 안 됨 | |
| R5 | BLIND 비네트 적용 시에도 **비네트 최대 어둠 alpha 0.88 상한** (완전 흑막 금지) | 정본 §4 BLIND 하한 vision 90px |
| R6 | 투사체/장판은 항상 적보다 **위 레이어(depth)**, 플레이어는 그보다 **더 위** | depth: floor 0 / deco 10 / enemy 20 / player 30 / projectile 40 / fx 50 / hud 100 |
| R7 | 데미지 숫자는 `BONE #D8CFC0`, 치명타만 `GOLD #E8B44C` | 색을 더 늘리지 않는다 |

---

## 2. ★ 에셋 매핑 표 (이 문서의 핵심)

> **컬럼 정의**
> - **원본 경로**: 저장소 루트 기준. **전부 실존 확인 완료 ✅**
> - **실측 크기**: PNG 헤더 실측치 ✅
> - **프레임 분할**: 알파 채널 경계 실측 또는 격자 점유 분석 결과
> - **텍스처 키 / 애니 키**: Phaser 3.90 `this.load.spritesheet(key, ...)` / `this.anims.create({key})`
> - **배치 위치**: `FE/public/assets/` 이하. 파일명은 §4.3 정규화 규칙 적용 후
> - **우선순위**: MUST(없으면 게임이 안 됨) / SHOULD / COULD

### 2.1 플레이어 — 에일라

✅ **프레임 분할 실측 완료.** 768×80 시트에서 알파가 완전히 빈 열이
`56–132 / 153–228 / 249–324 / 345–420 / 440–516 / 536–612 / 632–708` 에 나타나며
**모두 96의 배수 경계(96·192·288·384·480·576·672)를 감싼다.**
→ **프레임은 96×80, 8프레임이 확정.** (128×80·6프레임 가설은 경계가 맞지 않아 기각.)
16장 모두 동일하게 96×80×8이다.

| 게임 요소 | 원본 경로 (asset/ 기준) | 실측 크기 | 프레임 분할 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|
| 플레이어 IDLE ×4방향 | `character/FREE_Adventurer 2D Pixel Art/Sprites/IDLE/idle_{up,down,left,right}.png` | 768×80 ✅ | **96×80, 8프레임** ✅ | `player-idle-{up\|down\|left\|right}` | `player.idle.{dir}` (8fps, loop) | `assets/player/player-idle-{dir}.png` | **MUST** |
| 플레이어 RUN ×4방향 | `character/FREE_Adventurer 2D Pixel Art/Sprites/RUN/run_{up,down,left,right}.png` | 768×80 ✅ | 96×80, 8프레임 ✅ | `player-run-{dir}` | `player.run.{dir}` (12fps, loop) | `assets/player/player-run-{dir}.png` | **MUST** |
| 플레이어 ATTACK1 ×4방향 | `character/FREE_Adventurer 2D Pixel Art/Sprites/ATTACK 1/attack1_{up,down,left,right}.png` | 768×80 ✅ | 96×80, 8프레임 ✅ | `player-atk1-{dir}` | `player.atk1.{dir}` (16fps, once) | `assets/player/player-atk1-{dir}.png` | **MUST** |
| 플레이어 ATTACK2 ×4방향 | `character/FREE_Adventurer 2D Pixel Art/Sprites/ATTACK 2/attack2_{up,down,left,right}.png` | 768×80 ✅ | 96×80, 8프레임 ✅ | `player-atk2-{dir}` | `player.atk2.{dir}` (16fps, once) | `assets/player/player-atk2-{dir}.png` | SHOULD |
| 플레이어 피격 | — **원본 없음** | — | — | — | `setTintFill(0xFFFFFF)` 60ms (§7.1) | — | **MUST** (코드) |
| 플레이어 사망 | — **원본 없음** | — | — | — | idle 프레임 고정 + alpha 1→0, 회전 −20°, 0.6s | — | **MUST** (코드) |
| 그림자 메아리(W6) | 위 스프라이트 재사용 | — | — | 동일 | `setTint(0x4A0A14)`, alpha 0.5 | — | COULD |

> **바디 오프셋 실측:** idle_down 기준 유효 픽셀은 프레임 내 `x 37–55 / y 24–57`.
> 물리 바디는 `setSize(14, 12)` + `setOffset(41, 44)`(발 밑) 권장. ❓ **TASK AT-01**: 4방향 각각 재실측.

### 2.2 적 E1~E8 · 엘리트 EL1~EL2

✅ **전 몬스터 스프라이트 실측 완료.** DeepDiveGameStudio Basic 티어 135장 전부가
**64×16 = 16×16 프레임 4장(idle 루프)** 이다 (Holy 팩 일부만 64×18).
`.gif` 미리보기와 `.aseprite` 원본이 동봉되어 있다.

> ⚠️ **`Basic Undead 1x.png` (88×54), `Basic Undead 2x.png`, `Basic Undead 4x.png` 는
> 팩 전체를 한 장에 늘어놓은 "상점 미리보기 시트"다. 게임에 로드하면 안 된다.** ✅ 확인
> (경로: `monsters/basic asset pack (8)/basic asset pack/Basic Undead Sprites/`)

| # | 게임 요소 | 원본 경로 (asset/ 기준) | 실측 | 프레임 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|---|
| E1 | 흡혈박쥐 | `monsters/basic asset pack (8)/basic asset pack/Basic Undead Animations/Vampire Bat/VampireBat.png` | 64×16 ✅ | 16×16 ×4 | `enemies`(합본) f0–3 | `enemy.e1` (10fps) | `assets/enemies/enemies.png` | **MUST** |
| E2 | 썩은 비틀거림 | `…/Basic Undead Animations/Mutilated Stumbler/MutilatedStumbler.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f4–7 | `enemy.e2` (6fps) | 동일 | **MUST** |
| E3 | 기어오는 손 | `…/Basic Undead Animations/Skittering Hand/SkitteringHand.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f8–11 | `enemy.e3` (14fps) | 동일 | **MUST** |
| E4 | 낡은 해골 | `…/Basic Undead Animations/Decrepit Bones/DecrepitBones.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f12–15 | `enemy.e4` (8fps) | 동일 | **MUST** |
| E5 | 무덤 망령 | `…/Basic Undead Animations/Grave Revenant/GraveRevenant.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f16–19 | `enemy.e5` (8fps) | 동일 | **MUST** |
| E6 | 부서진 궁수 | `…/Basic Undead Animations/Brittle Archer/BrittleArcher.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f20–23 | `enemy.e6` (8fps) | 동일 | SHOULD |
| E7 | 역병 박쥐 떼 | `monsters/basic asset pack (6)/basic asset pack/Basic Vermin Animations/Plague Bat/PlagueBat.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f24–27 | `enemy.e7` (12fps) | 동일 | SHOULD |
| E8 | 진홍 임프 | `monsters/basic asset pack (9)/basic asset pack/Basic Demon Animations/crimson imp/CrimsonImp.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f28–31 | `enemy.e8` (10fps) | 동일 | SHOULD |
| EL1 | 시체 포식자(엘리트) | `…/Basic Undead Animations/Carcass Feeder/CarcassFeeder.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f32–35 | `enemy.el1` (8fps) | 동일 | **MUST** |
| EL2 | 타락한 흑기사(엘리트) | `monsters/basic asset pack (9)/basic asset pack/Basic Demon Animations/Depraved Blackguard/DepravedBlackguard.png` | 64×16 ✅ | 16×16 ×4 | `enemies` f36–39 | `enemy.el2` (6fps) | 동일 | **MUST** |

> ★ **핵심 최적화 (반드시 할 것):** 10종이 **전부 동일한 64×16 레이아웃**이다.
> 세로로 이어 붙이면 **64×160 단일 시트 = 16×16 프레임 40장**이 되고,
> `this.load.spritesheet('enemies', 'assets/enemies/enemies.png', {frameWidth:16, frameHeight:16})`
> 한 줄로 전 적을 로드할 수 있다. 원본 10장 합계 **약 5.5KB** → 합본 후 약 **3KB**.
> 드로우콜도 1개로 수렴한다. 파이프라인 스크립트는 §4.2.
>
> ⚠️ **엘리트는 별도 스프라이트가 아니다.** 정본 §7.2대로 Carcass Feeder / Depraved Blackguard를 쓰되,
> **`setScale`은 금지**(도트 깨짐). 대신 §1.4의 "1px 오프셋 붉은 그림자 스프라이트" + 발밑 링으로 구분한다.

### 2.3 보스 — 여명의 처형인

✅ **시트 레이아웃을 격자 점유 분석 + 육안 확인으로 완전히 해독했다.**

`Bringer-of-Death-SpritSheet.png` = **1120×744**, 프레임 **140×93**, **8열 × 8행 = 64칸**.
`Individual Sprite/` 하위 폴더의 파일 개수(Idle 8 / Walk 8 / Attack 10 / Hurt 3 / Death 10 / Cast 9 / Spell 16)
합이 **정확히 64**이고, 좌→우·상→하 선형 배치임을 시트 육안 확인으로 검증했다.

| 애니메이션 | 프레임 인덱스 (0-based) | 개수 | fps | 반복 |
|---|---|---|---|---|
| `boss.idle` | 0 – 7 | 8 | 8 | loop |
| `boss.walk` | 8 – 15 | 8 | 10 | loop |
| `boss.attack` (낫 휘두르기) | 16 – 25 | 10 | 14 | once |
| `boss.hurt` | 26 – 28 | 3 | 12 | once |
| `boss.death` | 29 – 38 | 10 | 10 | once |
| `boss.cast` (사령탄 시전) | 39 – 47 | 9 | 12 | once |
| `boss.spell` (소환 포탈) | 48 – 63 | 16 | 12 | once |

| 게임 요소 | 원본 경로 (asset/ 기준) | 실측 | 프레임 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|
| 보스 전 애니 | `bosses/Bringer-Of-Death/Bringer-Of-Death/SpriteSheet/Bringer-of-Death-SpritSheet.png` | 1120×744 ✅ (52KB) | **140×93, 8×8=64** ✅ | `boss` | 위 표 7종 | `assets/boss/bringer.png` | **MUST** |
| 보스(이펙트 없는 버전) | `…/SpriteSheet/Bringer-of-Death-SpritSheet_no-Effect.png` | 1120×744 ✅ | 동일 | `boss-clean` | 백업용 | (미사용) | COULD |
| 보스 개별 프레임 | `…/Individual Sprite/{Attack,Cast,Death,Hurt,Idle,Spell,Walk}/*.png` | 각 140×93 ✅ | 1프레임/파일 | — | 시트 해독 실패 시 폴백 | (미사용) | 폴백 |
| 보스 B 「봉인묘의 간수」 | `bosses/NightBorne/NightBorne.png` | 1840×400 ✅ (30KB) | **80×80, 23×5=115** ✅ / idle 0–8, run 23–28, attack 46–57, hurt 69–73, death 92–114 | `boss2` | `boss2.{idle,run,attack,hurt,death}` | `assets/boss/nightborne.png` | COULD (정본 §5.4 컷 1순위) |
| (미사용 보스) 네크로맨서 | `bosses/Necromancer_creativekind-Sheet.png` | 2720×896 ✅ | 160×128, 17×7 ✅ (행별 8/8/13/13/17/5/9) | — | — | (미사용) | — |
| (미사용) Evil Wizard 2 | `bosses/EVil Wizard 2/EVil Wizard 2/Sprites/*.png` | Idle·Run·Atk1·Atk2 2000×250 / Death 1750×250 / Fall·Jump 500×250 / Take hit 750×250 ✅ | 250×250 🔶 | — | — | (미사용) | — |
| (미사용) Undead executioner | `bosses/Undead executioner/Undead executioner puppet/png/*.png` | idle 500×100, attacking 600×300, death 1000×200, skill1 600×200, summon 400×200 외 ✅ | 100×100 🔶 ❓ | — | — | (미사용) | — |
| (미사용) Mecha-stone Golem | `bosses/Mecha-stone Golem 0.1/Mecha-stone Golem 0.1/PNG sheet/Character_sheet.png` | 1000×1000 ✅ | 100×100, 10×10 🔶 | — | — | (미사용) | — |
| (미사용) Samurai / MainCharacter | `bosses/FREE_Samurai…/Sprites/*.png` (96px 높이), `bosses/MainCharacter(FreePack)/…/Idle.png` (1920×128) ✅ | — | — | — | — | (미사용) | — |

> **판단:** 7일 스코프에서 보스는 **Bringer-of-Death 1종만** 쓴다. 나머지 7종 보스 팩은 **`FE/public/`에 복사하지 않는다**
> (용량 + 라이선스 리스크. `17-LICENSES-AND-CREDITS.md` 참조).

### 2.4 무기 W1~W6 이펙트

✅ **이펙트 팩의 구조를 완전히 해독했다. 이것이 이 조사의 가장 큰 소득이다.**

`asset/effect/Free/Part 16` ~ `Part 36` (21개 파트, 각 PNG 12장 + `Preview NN Free.gif` 1장, 총 273파일 66MB).

- **프레임은 전부 64×64다.** 알파 빈 열/행 경계가 모두 64의 배수에 정확히 떨어진다 ✅
- **높이는 전 파일 576px = 9행 고정.** 그리고 **9개 행의 알파 점유 패턴이 완전히 동일**하다 ✅
- 행별 최빈색을 뽑아보면 row0 `#AE2D48`(심홍) / row1 `#1F0090`(남색) / row2 `#133EBA`(청) /
  row3 `#115339`(녹) / row4 `#5D2C28`(갈) / row5 `#2F2F2F`(회) / row6 `#3A294C`(자) /
  row7 `#1C1525`(암흑) / row8 `#240F3E`(보라) ✅
- → **결론: 세로 9행 = 동일 애니메이션의 9가지 컬러 배리언트. 가로 열 = 실제 프레임.**
  **프레임 수 = 이미지 폭 ÷ 64.**

> ★ **BLOODSWORN은 row 0(심홍 `#AE2D48`)만 쓴다.** 게임 시그니처 색과 정확히 일치한다.
> 시트에서 **y=0~63 한 줄만 잘라내면 파일 크기가 약 1/9로 줄어든다** (예: 190KB → 약 21KB).
> 이것이 §4의 파이프라인에서 이펙트 용량을 66MB → 0.15MB로 줄이는 핵심이다.

**파트별 프레임 수 (폭÷64)** ✅: P16=8 / P17=10·11 / P18=11 / P19=12 / P20=12 / P21=12 / P22=12 /
P23=7·8 / P24=8·9 / P25=9·10 / P26=10(1271만 12) / P27=11 / P28=12 / P29=12·13 / P30=13 /
P31=13·14 / P32=14(1594만 15) / P33=14 / P34=14 / P35=15 / P36=15·16·17·18

**육안 확인한 내용** (각 파트 첫 파일 + Part 16·25 전량, row0 기준) ✅:

| 파트 | 대표 파일 | 내용 (육안 확인) |
|---|---|---|
| 16 | `766.png` (512×576, 8f) | 방사형 폭발/불꽃 퍼프 12종 |
| 17 | `825.png` (640×576, 10f) | 나선형으로 퍼지는 초승달 껍질 |
| 20 | `975.png` (768×576, 12f) | 세로 기둥 → 좌우 확산 (낙하 착탄형) |
| 22 | `1053.png` (768×576, 12f) | 엉킨 덩굴/전격형 촉수 |
| 23 | `1101.png` (448×576, **7f**) | 작은 초승달 스와이프 |
| **25** | **`1224.png` (576×576, 9f)** | **대각선 검격(블레이드 슬래시).** W1에 최적 ★ |
| 25 | `1234.png` / `1244.png` (640×576, 10f) | 지면 밀착 확산 (장판형) |
| 27 | `1326.png` (704×576, 11f) | 방향성 원뿔 폭발 |
| 28 | `1350.png` (768×576, 12f) | 긴 수평 원뿔/빔 |
| 32 | `1572.png` (896×576, 14f) | 링/구체 펄스 |
| **35** | **`1712.png` (960×576, 15f)** | **확장하는 입자 링.** 각성 충격파에 최적 ★ |
| 36 | `1781.png` (1152×576, 18f) | 대형 방사 소용돌이 |

> ⚠️ **정본 `03-GDD-CORE.md` §6.2의 이펙트 배정을 정정한다.**
> - "Part 16~18 슬래시" → 실제 Part 16은 **방사형 폭발**이다. **슬래시는 Part 25/1224**가 정답.
> - "Part 30~33 번개" → 실제 Part 30~33은 소용돌이/링/방사 버스트다. **번개형에 가장 가까운 것은 Part 22/1053**(엉킨 전격 촉수).
> → 정본 갱신 권고. 아래 표는 **육안 확인 결과 기준**으로 재배정한 것이다.

| 게임 요소 | 원본 경로 (asset/ 기준) | 실측 | 프레임 분할 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|
| **W1 피의 송곳니 참격** | `effect/Free/Part 25/1224.png` | 576×576 ✅ | **64×64 ×9프레임** (row0만 사용) ✅ | `fx-slash` | `fx.slash` (24fps, once) | `assets/fx/fx-slash.png` (576×64) | **MUST** |
| **W2 화염탄 투사체** | `projectile/All_Fire_Bullet_Pixel_16x16_00.png` | 640×400 ✅ | 16×16, 40×25=1000칸 🔶 (파일명 근거 + 육안) | `fx-bullet` | `fx.bullet` (16fps, loop) | `assets/fx/fx-bullet.png` (크롭본) | **MUST** ❓TASK AT-02 |
| **W2 착탄 폭발** | `effect/Free/Part 16/766.png` | 512×576 ✅ | 64×64 ×8 (row0) ✅ | `fx-burst` | `fx.burst` (24fps, once) | `assets/fx/fx-burst.png` (512×64) | **MUST** |
| **W3 뼈 회오리** | Raven 아이콘 시트 내 "뼈" 아이콘 1칸 | 16×16 | 정지 이미지 + 코드 회전 | `icons` (§2.6) | 코드 `angle += dt*180` | `assets/ui/icons.png` | **MUST** ❓TASK AT-05 |
| **W4 성수 낙하 장판** | `effect/Free/Part 25/1234.png` **또는** `Part 25/1244.png` | 각 640×576 ✅ | 64×64 ×10 (row0) ✅ | `fx-pool` | `fx.pool` (12fps, once→마지막 프레임 유지) | `assets/fx/fx-pool.png` (640×64) | **MUST** ❓TASK AT-03 (2종 중 택1) |
| **W4 낙하 예고** | `effect/Free/Part 20/975.png` | 768×576 ✅ | 64×64 ×12 (row0) ✅ | `fx-drop` | `fx.drop` (20fps, once) | `assets/fx/fx-drop.png` (768×64) | SHOULD |
| **W5 사슬 종 연쇄** | `effect/Free/Part 22/1053.png` | 768×576 ✅ | 64×64 ×12 (row0) ✅ | `fx-chain` | `fx.chain` (24fps, once) | `assets/fx/fx-chain.png` (768×64) | SHOULD |
| **W6 그림자 메아리** | 플레이어 스프라이트 재사용 (§2.1) | — | — | `player-*` | `setTint(0x4A0A14)` alpha 0.5 | — | COULD |
| **각성 충격파** | `effect/Free/Part 35/1712.png` | 960×576 ✅ | 64×64 ×15 (row0) ✅ | `fx-shock` | `fx.shock` (20fps, once) | `assets/fx/fx-shock.png` (960×64) | **MUST** |
| **보스 등장 정화** | `effect/Free/Part 36/1781.png` | 1152×576 ✅ | 64×64 ×18 (row0) ✅ | `fx-purge` | `fx.purge` (18fps, once) | `assets/fx/fx-purge.png` (1152×64) | **MUST** |
| **레벨업 링** | `effect/Free/Part 32/1572.png` | 896×576 ✅ | 64×64 ×14 (row0) ✅ | `fx-ring` | `fx.ring` (24fps, once) | `assets/fx/fx-ring.png` (896×64) | SHOULD |

> ❓ **TASK AT-04**: 파트당 12장 중 **첫 1장만** 육안 확인했다(Part 16·25는 12장 전량 확인).
> 나머지 파트의 2~12번째 파일은 미확인이다. 상단 표의 선정으로 Day 3까지 진행하되,
> **Day 5에 `Preview NN Free.gif` 21장을 한 번에 열어 더 나은 후보가 있는지 30분 안에 재검토**할 것.

### 2.5 드롭 & 오브젝트

| 게임 요소 | 원본 경로 (asset/ 기준) | 실측 | 프레임 분할 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|
| EXP 오브 T1 (청록, 1) | **원본 없음 → 코드 생성 권장** (`Graphics` 4px 원 `#2FBFA8` + ADD 글로우) | — | — | `orb1` (RenderTexture) | 코드 스케일 펄스 | 런타임 생성 | **MUST** |
| EXP 오브 T2 (파랑, 5) | 동일, `#4E7FA8` 5px | — | — | `orb2` | 동일 | 런타임 | **MUST** |
| EXP 오브 T3 (보라, 20) | 동일, `#8B54C6` 6px | — | — | `orb3` | 동일 | 런타임 | **MUST** |
| 골드 | Raven 시트 "동전" 아이콘 1칸 | 16×16 | 정지 | `icons` | 상하 2px 보빙(0.8s) | `assets/ui/icons.png` | **MUST** ❓TASK AT-05 |
| 회복 아이템 | Raven 시트 "붉은 포션" 아이콘 1칸 | 16×16 | 정지 | `icons` | 동일 | 동일 | **MUST** ❓TASK AT-05 |
| **보물상자** | `tilemap/decorative.png` — **상자 스프라이트 4종 실재 확인 ✅** (원본 좌표 대략 `x 128–225 / y 70–115` 구간, 닫힘/열림 변형 포함) | 시트 256×256 ✅ | ❓ 정확 rect 미측정 | `chest` | `chest.open` (프레임 시퀀스) | `assets/props/chest.png` | **MUST** ❓TASK AT-06 |
| (미사용) 아이템 아이콘 | `item/pixel items0.png` ~ `pixel items6.png` | 각 256×256 ✅ | **32×32, 8×8 = 64칸/장, 7장 = 448종** 🔶 (육안: 검·반지·지팡이·완드) | — | — | (미사용) | COULD |

> **EXP 오브를 코드로 그리는 이유:** 화면에 최대 200개가 동시에 존재한다(정본 §5.2).
> 16×16 아이콘 텍스처를 200장 띄우는 것보다 4px 원 RenderTexture 3장이 압도적으로 싸고,
> 색이 팔레트에 정확히 맞는다. **에셋 탐색 시간 0.**

### 2.6 UI 아이콘 40개 — Raven Fantasy 인덱스 방식

✅ **`icons/Free - Raven Fantasy Icons/Full Spritesheet/16x16.png` = 256 × 2192 (347KB)** 실측.
16px 격자 → **16열 × 137행 = 2,192칸**. 육안 확인 결과 상단 18행에만 해도
방패·보석·물약·성배·검·랜턴·두루마리·해골·뼈·열쇠·주괴·고기·동전(`$`) 등이 존재한다.
32×32 버전(512×4384)·64×64 버전(1024×8768)·RPG Maker용 IconSet(512×4384)·
개별 파일 **6,576장**(`Separated Files/{16x16,32x32,64x64}/fa*.png`)도 함께 있다.

**★ 인덱스 지정 방식 (이 방식으로 확정한다)**

```js
// FE/src/game/data/icons.js
export const ICON_COLS = 16;
export const ICON_SIZE = 16;
// index → 시트 내 좌표
export const iconRect = (i) => ({
  x: (i % ICON_COLS) * ICON_SIZE,
  y: Math.floor(i / ICON_COLS) * ICON_SIZE,
  w: ICON_SIZE, h: ICON_SIZE,
});
// 개별 파일과의 대응: Separated Files/16x16/fa{N}.png 의 N == index + 1 로 추정 🔶 (TASK AT-05에서 검증)
```

Phaser 로드는 `this.load.spritesheet('icons', 'assets/ui/icons.png', {frameWidth:16, frameHeight:16})`
한 줄이면 되고, 카드에서는 `frame: BLESSING_ICON[id]` 로 참조한다.
데이터는 `data/blessings.json` / `tolls.json` / `awakenings.json`(정본 §10)에
**`"icon": <정수 인덱스>` 필드 하나만** 추가한다. 코드 수정 없이 밸런싱·아이콘 교체가 가능해진다.

**❓ TASK AT-05 — 아이콘 40개 인덱스 선정 (담당: 아트, 예상 60~90분, Day 2 또는 Day 5)**

*왜 지금 확정하지 않는가:* 2,192칸을 화면에서 한 칸씩 대조해 40개를 고르는 작업은
실물을 확대해 보며 해야 하는 육안 작업이다. **근거 없이 인덱스 숫자를 지어내면
전부 엉뚱한 아이콘이 붙는 최악의 결과**가 나오므로 여기서는 절차와 기준만 확정한다.

*절차:*
1. `icons/Free - Raven Fantasy Icons/Full Spritesheet/64x64.png` 를 이미지 뷰어로 연다(64px라 육안 판별이 쉽다).
   좌표 → 인덱스 변환은 `index = floor(y/64)*16 + floor(x/64)` 로 동일하다.
2. 아래 40개 슬롯을 채운다. 각 슬롯당 **후보 2개**를 적어 두고 1개를 선택한다.
3. 결과를 `FE/src/game/data/icons.js` 의 `BLESSING_ICON` / `TOLL_ICON` / `AWAKEN_ICON` / `SANCTUM_ICON` 상수에 기록한다.
4. 선정 후 §4.2의 크롭 스크립트로 **40칸만 뽑아 16×3 격자(256×48, 약 3KB)** 로 재포장한다.
   → 347KB 시트를 배포에 넣지 않아도 되고, **라이선스 리스크도 크게 줄어든다**(§17 참조).

*선정 기준 (우선순위 순):*
| # | 기준 |
|---|---|
| S1 | **16×16에서 실루엣만으로 구분 가능**할 것. 디테일이 뭉치는 아이콘은 탈락 |
| S2 | 팔레트 §1.1과 **색상 계열이 충돌하지 않을 것** (형광 청록/네온 그린 회피) |
| S3 | 같은 카테고리(무기/스탯/대가/각성)끼리 **모티프 계열을 통일** — 예: 무기 축복은 전부 "무기 실루엣", 스탯 축복은 전부 "신체/부적" |
| S4 | 대가 6종은 §1.2의 상징 방향과 최대한 일치. 일치하는 게 없으면 **생성 목록(§3)으로 넘긴다** |
| S5 | 각성 6종 인장은 Raven에 적합한 것이 없을 확률이 높다 → **§3의 Codex 생성 대상 1순위** |

*채워야 할 40슬롯:*

| 카테고리 | 개수 | ID (정본 대응) |
|---|---|---|
| 축복 — 무기 획득/강화 | 10 | `bls_w1`~`bls_w5`, `bls_w1_x`~`bls_w5_x` (04-PACT §7.1) |
| 축복 — 스탯 | 12 | `bls_hp`, `bls_dmg`, `bls_spd`, `bls_as`, `bls_crit`, `bls_critm`, `bls_proj`, `bls_range`, `bls_ls`, `bls_magnet`, `bls_area`, `bls_dmg_big` (04-PACT §7.2) |
| 대가 태그 | 6 | `FRAIL`, `SLOW`, `MYOPIA`, `GREED`, `BLIND`, `HUNGER` (04-PACT §4) |
| 각성 인장 | 6 | 불사의 껍질 / 중력의 군주 / 접촉의 광기 / 탐욕의 왕관 / 어둠의 눈 / 진조의 갈증 (04-PACT §5.3) |
| 성소 업그레이드 | 6 | 강인함 / 예리함 / 신속 / 탐욕 / 각성 촉진 / 재계약 (03-GDD §9.1) |
| **합계** | **40** | |

> ⚠️ **라이선스 경고:** 이 아이콘 팩은 **무료(Free) 티어**다. 제작자 약관상 무료 티어는
> **"무료 배포 + 인앱결제/유료광고 없음" 프로젝트에만** 허용된다.
> **Play 스토어든 App Store든** 광고나 IAP를 넣을 계획이라면 **이 매핑 전체가 무효**가 된다.
> 제작자 약관은 배포 채널이 아니라 **수익화 여부**를 조건으로 걸기 때문에, 스토어를 늘려도 조건은 같다.
> 반드시 `17-LICENSES-AND-CREDITS.md` §1을 먼저 읽을 것. **최우선 리스크다.**

### 2.7 타일맵 & 배경 오브젝트

✅ Szadi art 팩. `public-license.txt` 원문 확인 완료(§17).

| 게임 요소 | 원본 경로 (asset/ 기준) | 실측 | 프레임 분할 | 텍스처 키 | 애니 키 | 배치 위치 | 우선 |
|---|---|---|---|---|---|---|---|
| 메인 타일셋 | `tilemap/mainlevbuild.png` | 1024×640 ✅ (93KB) | 16×16 → 64×40 슬롯 🔶 | `tiles-main` | — | `assets/tiles/tiles-main.png` | **MUST** ❓TASK AT-07 |
| 장식 타일셋 | `tilemap/decorative.png` | 256×256 ✅ (17KB) | 16×16 → 16×16 슬롯 🔶 | `tiles-deco` | — | `assets/tiles/tiles-deco.png` | **MUST** |
| 촛불 A | `tilemap/candleA_01.png` ~ `candleA_04.png` | **7×14 / 7×15 / 7×16 / 7×14** ✅ (프레임마다 크기 다름!) | 개별 파일 4장 | `candle-a` | `deco.candleA` (8fps, loop) | `assets/props/candle-a.png` (16×16 정렬 후) | **MUST** |
| 촛불 B | `tilemap/candleB_01.png` ~ `candleB_04.png` | **13×16 / 13×14 / 13×14 / 13×15** ✅ | 개별 4장 | `candle-b` | `deco.candleB` (8fps, loop) | `assets/props/candle-b.png` | SHOULD |
| 횃불 | `tilemap/torch_1.png` ~ `torch_4.png` | **16×16 / 16×15 / 16×15 / 16×16** ✅ | 개별 4장 | `torch` | `deco.torch` (10fps, loop) | `assets/props/torch.png` | **MUST** |
| 가시 함정 | `tilemap/spike_0.png` ~ `spike_4.png` | **13×12 / 13×12 / 13×12 / 13×13 / 13×14** ✅ | 개별 5장 | `spike` | `deco.spike` (12fps, once) | `assets/props/spike.png` | COULD |
| PSD 원본 | `tilemap/PSD/*.psd`, `tilemap/PSD/Anim/*.psd` | — | — | — | — | **복사 금지** (`.gitignore`에 `psd` 있음) | — |

> ★ **함정 발견 — 반드시 처리할 것.**
> 촛불/횃불/가시의 프레임 PNG는 **프레임마다 픽셀 크기가 다르다** (예: candleA는 14/15/16/14px 높이).
> 그대로 스프라이트시트로 이어 붙이면 **불꽃이 위아래로 튄다.**
> → **바닥 기준 정렬(bottom-align)** 로 16×16 캔버스에 패딩해 합쳐야 한다.
> 파이프라인 스크립트에서 `padY = 16 - h` (위쪽 패딩), `padX = floor((16 - w)/2)` 로 처리한다.

> ✅ **TASK AT-07 — 해결됨 (2026-08-11). 아래 1차 판단은 틀렸다.**
> **원작 `szadiart.itch.io/rogue-fantasy-catacombs`를 확인한 결과 이 타일셋은 공식적으로 탑다운 전용이다**(공식 태그 `Top-Down`).
> 입면도로 보였던 것은 탑다운 픽셀 던전의 **표준 관례인 벽면(wall face) 표현**이었다.
> 원작자 레퍼런스 맵에서 읽어낸 조립 규칙 — 바닥은 평면 석재 / 벽은 **3타일 높이 벽돌 밴드** / 그 너머는 검정(void) /
> 벽면에 해골 알코브와 납골 격자를 박고 / **횃불을 벽면을 따라 다수 배치**한다(분위기의 절반이 광원이다).
> 구현: `FE/tools/build-map.mjs`. 아래는 정정 전 기록이다 —
> `mainlevbuild.png` 를 육안 확인한 결과, **아치·문·계단·벽이 "정면(elevation) 뷰"로 그려진
> 플랫포머형 던전 세트**다. 우리 게임은 톱다운이다.
> - 우측 하단의 **어두운 정사각 바닥 타일 블록은 톱다운 바닥으로 그대로 사용 가능** ✅
> - 벽은 "정면 벽 밴드(높이 2~3타일)" 로 세워 상단 경계에만 쓰는 하이브리드 배치가 필요
> - Tiled에서 타일 크기를 16으로 놓고 실제 정렬이 맞는지(오프셋 0인지) **반드시 확인**할 것
> 미확인 상태로 맵을 그리기 시작하면 Day 3에 전부 다시 그려야 한다.

### 2.8 HUD · 커서 · 조이스틱

| 게임 요소 | 원본 | 방침 | 텍스처 키 | 우선 |
|---|---|---|---|---|
| 플로팅 조이스틱 (베이스+노브) | **원본 없음** | `Graphics`로 원 2개 (베이스 r=48 `#6E6478` alpha 0.30 / 노브 r=18 `#D8CFC0` alpha 0.45) → `generateTexture()` 1회 | `joy-base`, `joy-knob` | **MUST** |
| 대시 버튼 | **원본 없음** | `Graphics` 원 r=26 + Raven "번개/발자국" 아이콘 오버레이. 히트박스는 시각의 1.5배(정본 §3.3) | `btn-dash` | **MUST** |
| 일시정지 버튼 | **원본 없음** | `Graphics` 사각 2개 | `btn-pause` | **MUST** |
| HP / EXP 게이지 | **원본 없음** | `Graphics` 9-slice 없이 단순 사각. 트랙 `#3A3345`, HP `#8E1220`, EXP `#2FBFA8` | 런타임 | **MUST** |
| 인간성 심장 5개 | **원본 없음** | 폰트 글리프 `♥` (U+2665) **사용 가능 ✅** — 검증 완료 (§8) | 텍스트 | **MUST** |
| 마우스 커서 | 개발 중 PC 브라우저 확인 전용 (웹 배포 채널 없음) | CSS `cursor: crosshair`. 픽셀 커서 이미지는 만들지 않음 | — | COULD |

> ⚠️ **정본 §3.1 HUD 목업에 쓰인 `⚔ ⚡ ⏸ ☠ ▓ ░ ✦ ✖ ⬢` 기호는
> 현재 폰트에 글리프가 **없다** (§8에서 실측 검증). 그대로 렌더하면 두부(□)가 뜬다.**
> → 이 기호들은 전부 **Raven 아이콘 또는 `Graphics` 도형으로 대체**한다. §8.3의 대체표 참조.

---

## 3. 부족한 에셋 목록 (Codex 이미지 생성 필요)

보유 에셋으로 **커버 불가능**한 것만 추렸다. 실제 프롬프트는 `15-IMAGE-PROMPTS-FOR-CODEX.md`에서 작성한다.
여기서는 **무엇이 왜 필요한지 + 요구 규격**만 정의한다.

| # | 항목 | 규격 | 왜 보유 에셋으로 안 되는가 | 우선 | 사용처 |
|---|---|---|---|---|---|
| G1 | **녹턴 초상화** | 512×512 PNG (표시 시 96×96 축소 또는 우측 패널 160×160) | 정본 §5.2가 명시적으로 "이미지 생성으로 제작"이라 지정. 보유 팩에 초상화가 하나도 없음 | **MUST** | PACT 카드 화면 좌측, 타이틀 |
| G2 | **계약서 카드 프레임** | 3종(Common/Rare/Epic), 각 200×280 PNG, 9-slice 가능하도록 모서리 여백 24px | 양피지/인장 모티프(정본 §7)가 보유 팩에 전무. Raven은 아이콘만 있음 | **MUST** | PACT 카드 UI |
| G3 | **각성 인장 6종** | 각 128×128 PNG, 투명 배경, 단색 실루엣 + 금빛 림 | Raven 2,192칸에 "각성 인장" 성격의 상징이 있을 가능성이 낮음. 정본 §5.2가 "중앙에 대형 타이포 + 인장"을 요구 | **MUST** | 각성 연출, 도감 |
| G4 | **타이틀 로고** | 1024×384 PNG (BLOODSWORN + 피의 서약) | 로고는 반드시 신규 | **MUST** | 타이틀 |
| G5 | **앱 아이콘** | 512×512 (Play 스토어) + adaptive icon foreground/background 각 432×432 **+ iOS 1024×1024(알파 없음)** | Android·iOS 양쪽 필수 제출물 | **MUST** | Play 스토어, App Store, 런처 |
| G6 | **스플래시 / 타이틀 배경** | 1280×720 (16:9), 640×360로 축소 사용 | 사슬에 묶인 무덤 + 청록 성촉 구도. 타일셋 조합으로는 표현 불가 | SHOULD | 타이틀, 부팅 |
| G7 | **Play 피처 그래픽** | 1024×500 PNG | Play 콘솔 필수. **App Store에는 대응 항목이 없다** | **MUST** | Play 스토어 |
| G8 | **스토어 스크린샷 프레임** | 1920×1080 템플릿 ×4 (문구 오버레이용) | 스토어 등록물 | SHOULD | Play 스토어 |
| G9 | **대가 태그 배지 6종** | 각 32×32 PNG | §1.2 상징 방향에 딱 맞는 Raven 아이콘이 없으면 생성. **TASK AT-05 결과에 따라 결정** | SHOULD (조건부) | 카드 대가 영역, HUD |
| G10 | **엔딩 일러스트 3종** | 640×360 | 정본 §6이 "전문 텍스트 1화면 + 페이드"만 요구 → **텍스트만으로 충분. 만들지 않는다** | **컷** | — |
| G11 | **iOS 런치스크린** | **2732 × 2732 정사각 PNG ×3** (1x/2x/3x, 파일명 `splash-2732x2732.png` / `-1` / `-2`) | Capacitor iOS 스캐폴드의 `Splash.imageset/Contents.json`이 이 3개 파일명을 고정으로 참조한다(실측 확인). **Android처럼 가로/세로·밀도별로 나뉘지 않는다** | SHOULD | iOS 부팅 |

> **총 생성 필요: MUST 5종 + SHOULD 4종 + 조건부 1종.**
> G1~G5는 없으면 스토어 등록조차 안 되거나 게임의 핵심 화면이 비어 보인다.
> G10은 명시적으로 스코프에서 **자른다**.

**★ iOS 추가로 생성 항목이 늘지 않는다 — G5·G11은 전부 후처리 파생이다**

| 항목 | 조달 방법 | 신규 생성 |
|---|---|---|
| iOS 앱 아이콘 1024 | **G5의 1024 원본에서 알파 채널만 제거** (`-alpha remove -alpha off`) | **없음** |
| iOS 런치스크린 2732 정사각 ×3 | **G6 스플래시를 2732 정사각 캔버스 중앙에 패딩** 후 3개 파일명으로 복사 | **없음** |

> ⚠ **iOS 아이콘에 알파 채널이 있으면 App Store Connect가 업로드를 거부한다.**
> Android 아이콘은 반대로 알파가 **있어야** 하므로, 같은 그림에서 **후처리만 갈라진다.**
> 정확한 명령은 `15-IMAGE-PROMPTS-FOR-CODEX.md` §4.7에 있다.
>
> ⚠ **App Store 스크린샷(G8의 iOS 대응물)은 이번 주 대상이 아니다.**
> 내부 TestFlight 배포에는 스크린샷이 필요 없으므로 **Day 7 목표에 걸리지 않는다.**
> 규격만 적어 둔다 — 6.9인치 가로 **2868 × 1320**, **1픽셀만 틀려도 거부**.
> 필수 최소 장수와 iPad 스크린샷 필요 여부는 ⚠ 확인 필요(2026-08-10 기준 미확인).
>
> iOS 런치스크린은 **화면 비율에 맞춰 중앙이 크롭**되므로, G6의 핵심 요소가 중앙에 있어야 한다.
> 살아남지 못하면 **단색 `#0B0710` 1장으로 대체한다** — 요구 사항은 "흰 플래시가 없을 것"뿐이다.

---

## 4. 에셋 가공 파이프라인

### 4.1 목표

| 항목 | 현재 | 목표 |
|---|---|---|
| 원본 `asset/` | **7,846 파일 / 128MB** ✅ | 그대로 둔다 (git 커밋은 하지 않음 권장) |
| `FE/public/assets/` | **현재 비어 있음** (`FE/public/`에는 `vite.svg` 1개뿐) ✅ | **이미지 ≤ 0.6MB / 오디오 ≤ 4.5MB / 폰트 0.1MB → 합계 ≤ 5.2MB** |
| APK 최종 크기 | — | **≤ 25MB** (Play 권장 범위, WebView 런타임 제외) |

**용량 산정 근거 (실측 파일 크기 기반)** ✅

| 그룹 | 원본 | 가공 후 예상 | 근거 |
|---|---|---|---|
| 플레이어 16장 | 약 48KB (16 × 3.0KB) | 48KB | 그대로 복사 |
| 적 10종 | 5.5KB | **3KB** | 64×160 합본 1장으로 병합 |
| 보스 1종 | 52KB | 52KB | 그대로 |
| 이펙트 8종 | 원본 8장 합계 약 **1.1MB** | **약 130KB** | **row 0만 크롭 → 1/9** ★ |
| 투사체 | 48KB | 약 20KB | 필요 행만 크롭 |
| 아이콘 | 347KB (전체 시트) | **약 4KB** | **40칸만 뽑아 256×48 재포장** ★ |
| 타일 2장 | 110KB | 110KB | 그대로 |
| 프롭(촛불/횃불/가시/상자) | 약 6KB | 8KB | 16×16 패딩 정렬 후 합본 |
| 생성 에셋(G1~G8) | — | 약 200KB | PNG-8 또는 WebP |
| **이미지 소계** | **약 1.7MB** | **약 575KB** | |
| BGM | **27.5MB / 21곡 / 256kbps** ✅ | **약 4.2MB / 13곡** | 중복 2곡 제거 + 96kbps OGG/M4A 재인코딩 |
| SFX | **0개** ⚠️ | 약 60KB | §6 참조 (절차적 생성이면 0KB) |
| 폰트 | 98KB | 98KB | 그대로 |
| **합계** | | **약 4.9MB** | 목표 달성 |

> ⚠️ **`asset/effect` 66MB, `asset/icons` 24MB, `asset/bgm` 28MB — 이 셋이 전체의 92%다.**
> 이 셋을 그대로 `FE/public/`에 복사하면 **빌드가 사실상 불가능**하다. 반드시 §4.2를 거친다.

### 4.2 가공 절차 (Day 1 후반 ~ Day 2 오전, 예상 3시간)

가공 스크립트는 `FE/tools/build-assets.mjs` 1개 파일로 만든다. **Node + `sharp`** 를 devDependency로 추가한다
(`sharp`는 크롭/합성/리사이즈/PNG 최적화를 전부 커버한다).

```
FE/tools/build-assets.mjs   ← 유일한 가공 진입점
  npm run assets            ← package.json scripts에 추가
```

**단계**

| # | 단계 | 입력 | 출력 | 비고 |
|---|---|---|---|---|
| P1 | **적 합본** | 10종 `*.png` (64×16) | `assets/enemies/enemies.png` (64×160) | 세로 concat. 순서는 §2.2 표의 E1→EL2 고정 |
| P2 | **이펙트 row0 크롭** | 8개 이펙트 PNG | `assets/fx/fx-*.png` (W×64) | `extract({left:0, top:0, width:W, height:64})` — **용량 1/9** |
| P3 | **아이콘 40칸 재포장** | `16x16.png` (256×2192) + TASK AT-05 결과 인덱스 배열 | `assets/ui/icons.png` (256×48, 16×3) | 인덱스 배열 순서대로 재배치. **새 인덱스 = 배열 위치** |
| P4 | **프롭 bottom-align 합본** | candleA×4, candleB×4, torch×4, spike×5 | `assets/props/*.png` (16×16 프레임) | **바닥 정렬 패딩** (§2.7 경고) |
| P5 | **플레이어/보스/타일 복사** | 원본 | `assets/player/`, `assets/boss/`, `assets/tiles/` | 이름만 정규화 |
| P6 | **투사체 크롭** | `All_Fire_Bullet_..._00.png` | `assets/fx/fx-bullet.png` | TASK AT-02에서 결정한 행만 |
| P7 | **PNG 최적화** | 위 전부 | 동일 경로 | `sharp().png({palette:true, compressionLevel:9})` — 픽셀아트는 팔레트 PNG-8이 무손실이면서 훨씬 작다 |
| P8 | **오디오 트랜스코드** | 선정된 BGM 13곡 | `assets/audio/bgm/*.ogg` + `*.m4a` | `ffmpeg -b:a 96k`. **OGG + M4A 둘 다** 내보낸다(Android WebView/iOS Safari 호환) |
| P9 | **매니페스트 출력** | 위 전부 | `FE/src/game/data/assetManifest.json` | `PreloadScene`이 이걸 읽어 루프 로드. 파일 추가 시 코드 수정 불필요 |

> **아틀라스로 굽는 것 vs 개별 로드 — 결정**
>
> | 대상 | 방식 | 이유 |
> |---|---|---|
> | 적 10종 | **합본 스프라이트시트 1장** | 전부 동일 격자(16×16). 아틀라스 JSON 없이 `spritesheet()`로 끝. **최우선 최적화** |
> | 아이콘 40개 | **합본 스프라이트시트 1장** | 동일 격자(16×16) |
> | 프롭 4종 | 종류별 스프라이트시트 | 격자는 같지만 애니 길이가 달라 시트를 나누는 게 안전 |
> | 플레이어 16장 | **개별 로드** | 각 시트가 96×80×8로 규칙적. 16장 로드는 부담 없고, 아틀라스로 묶으면 프레임 이름 관리 비용만 늘어난다 |
> | 이펙트 8장 | **개별 로드** | 프레임 폭은 같지만(64) 길이가 제각각(8~18). 개별 `spritesheet()`가 명확 |
> | 보스 | **개별 로드** | 1장뿐 |
> | 타일 2장 | **개별 로드** | Tiled가 타일셋 이미지를 직접 참조 |
>
> ★ **TexturePacker 등 외부 아틀라스 툴은 도입하지 않는다.** 7일 스코프에서 툴 세팅 시간 대비 이득이 없고,
> 위 구성이면 총 텍스처 수가 **약 35장**이라 드로우콜 문제가 발생하지 않는다.

### 4.3 ★ 파일명 정규화 규칙 (양보 불가)

**현재 원본 경로에는 WebView 에셋 로드에서 위험한 요소가 전부 들어 있다** (Android는 `https://localhost`, iOS는 `capacitor://localhost` 로 서빙되며 **둘 다 파일명 대소문자를 구분한다**)**:**

| 위험 요소 | 실제 예시 (모두 실존 ✅) | 왜 위험한가 |
|---|---|---|
| **공백** | `Free - Raven Fantasy Icons/`, `Part 16/`, `Vampire Bat/` | URL에서 `%20`으로 인코딩됨. Capacitor `file://` 스킴에서 간헐 실패 사례 다수 |
| **괄호** | `basic asset pack (8)/`, `MainCharacter(FreePack)/`, `soundreality-...-471495 (1).mp3` | `(` `)` 는 CSS `url()`·일부 CDN에서 파싱 오류 |
| **대소문자 혼재** | `Basic Asset Pack` vs `basic asset pack`, `EVil Wizard 2` | Windows(대소문자 무시)에서 개발 → **Android/Linux(대소문자 구분)에서 404**. ★ 가장 흔한 배포 사고 |
| **경로 중첩 중복** | `Bringer-Of-Death/Bringer-Of-Death/`, `basic asset pack (8)/basic asset pack/` | 경로 길이 낭비, 오타 유발 |
| **비ASCII 상위 경로** | 저장소가 `…/바탕 화면/…` 아래에 있음 | 빌드 툴체인에 따라 문제. **`FE/public/` 내부만이라도 반드시 ASCII 유지** |
| **연속 점** | `NightBorne_death..gif` ✅ | 확장자 파싱 오류 |

**규칙 (예외 없음)**

```
1. 전부 소문자 (lowercase)
2. 구분자는 하이픈 `-` 만. 공백·언더스코어·괄호·점(확장자 제외) 전부 하이픈으로 치환
3. ASCII [a-z0-9-] 와 확장자 앞의 점 1개만 허용
4. 디렉터리 depth 3 이내: assets/<category>/<file>
5. 카테고리는 아래 8개로 고정
6. 이름은 "역할" 기준. 원본 제작자의 이름을 그대로 쓰지 않는다 (역할이 바뀌면 파일명이 거짓말이 된다)
```

**최종 디렉터리 구조**

```
FE/public/assets/
├── player/    player-idle-down.png, player-run-left.png, player-atk1-up.png, ...   (16장)
├── enemies/   enemies.png                                                          (1장, 40프레임)
├── boss/      bringer.png  [, nightborne.png]                                      (1~2장)
├── fx/        fx-slash.png, fx-burst.png, fx-pool.png, fx-chain.png,
│              fx-shock.png, fx-purge.png, fx-ring.png, fx-drop.png, fx-bullet.png  (9장)
├── tiles/     tiles-main.png, tiles-deco.png, stage1.json(Tiled)                   (3장)
├── props/     candle-a.png, candle-b.png, torch.png, spike.png, chest.png          (5장)
├── ui/        icons.png, nocturne.png, card-frame-common.png, card-frame-rare.png,
│              card-frame-epic.png, seal-frail.png … seal-hunger.png, logo.png      (생성물 포함)
├── audio/
│   ├── bgm/   bed-ambient.ogg/.m4a, perc-118.ogg, perc-130.ogg, perc-132.ogg, ...
│   └── sfx/   (§6 — 절차적 생성이면 비어 있음)
└── fonts/     base-font.woff2
```

**리네이밍 대응표 (샘플, 전체는 `build-assets.mjs`의 MANIFEST 상수에 기록)**

| 원본 | 배포 |
|---|---|
| `asset/character/FREE_Adventurer 2D Pixel Art/Sprites/IDLE/idle_down.png` | `assets/player/player-idle-down.png` |
| `asset/monsters/basic asset pack (8)/basic asset pack/Basic Undead Animations/Vampire Bat/VampireBat.png` | (합본 `assets/enemies/enemies.png` 프레임 0–3) |
| `asset/bosses/Bringer-Of-Death/Bringer-Of-Death/SpriteSheet/Bringer-of-Death-SpritSheet.png` | `assets/boss/bringer.png` |
| `asset/effect/Free/Part 25/1224.png` | `assets/fx/fx-slash.png` (row0 크롭) |
| `asset/icons/Free - Raven Fantasy Icons/Full Spritesheet/16x16.png` | `assets/ui/icons.png` (40칸 재포장) |
| `asset/tilemap/mainlevbuild.png` | `assets/tiles/tiles-main.png` |
| `asset/fonts/base_font.woff2` | `assets/fonts/base-font.woff2` |
| `asset/bgm/5xbeatz-percussion-loop-118-bpm-free-385692.mp3` | `assets/audio/bgm/perc-118.ogg` / `.m4a` |

### 4.4 절대 복사하지 않는 것 (블랙리스트)

| 대상 | 이유 |
|---|---|
| `asset/**/*.aseprite`, `*.ase` | 편집 원본. 런타임 불필요 |
| `asset/tilemap/PSD/**` | 편집 원본 (`.gitignore`에 `psd` 이미 존재 ✅) |
| `asset/**/*.gif` (Preview, VampireBat.gif 등) | 상점 미리보기. 게임에 불필요 |
| `asset/monsters/**/Basic * Sprites/*.png` | **팩 전체 미리보기 시트** (`Basic Undead 1x.png` 88×54 등). 게임용 아님 ✅ |
| `asset/npcs/**` (267파일 5MB) | 게임에 NPC 없음(정본). **전량 제외** |
| `asset/item/**` (7장) | Raven 아이콘으로 대체됨. 제외 |
| `asset/icons/**/Separated Files/**` (6,576장) | 개별 파일 불필요. 시트만 씀 |
| `asset/icons/**/32x32.png`, `64x64.png`, `RPG Maker MV and MZ/IconSet.png` | 16px만 사용 |
| 미사용 보스 7종 (`EVil Wizard 2`, `FREE_Samurai…`, `MainCharacter(FreePack)`, `Mecha-stone Golem`, `Necromancer_…`, `Undead executioner`) | 미사용 + 라이선스 리스크(§17) |
| 미사용 몬스터 팩 7종 (Animal/Holy/Monster/Humanoid/Humanoid II/Dragon/Magical) | 미사용 |
| `asset/effect/Free/Part {17,18,19,21,23,24,26,27,28,29,30,31,33,34}` | 미선정 파트 |
| `asset/projectile/desktop.ini` | Windows 시스템 파일 |
| **중복 BGM 2곡** | `ncprime-cinematic-background-293547.mp3` (= `291979`), `soundreality-cinematic-percussion-471495 (1).mp3` (= `471495`) — **md5 동일 확인 ✅** |

---

## 5. 오디오 디자인 — BGM 배정

### 5.1 보유 BGM 실측 (21곡, 27.5MB, 전부 256kbps) ✅

| 파일명 | 길이 | 크기 | 성격 |
|---|---|---|---|
| `universfield-horror-background-atmosphere-025-499631.mp3` | **2:41** | 5.0MB | 호러 앰비언스(최장) |
| `ncprime-noncopyright-music-pianos-295174.mp3` | 1:32 | 2.9MB | 피아노 |
| `universfield-atmospheric-cinematic-soundscape-152493.mp3` | 1:31 | 2.9MB | 시네마틱 앰비언스 |
| `universfield-dark-horror-soundscape-345814.mp3` | 1:09 | 2.2MB | 다크 호러 |
| `audioknap-drums-only-448491.mp3` | 1:04 | 2.0MB | 드럼 온리 |
| `soundreality-cinematic-music-487645.mp3` | 0:38 | 1.2MB | 시네마틱 |
| `niteshnaagodiya-bongo-and-drum-instrumental-music-21295.mp3` | 0:37 | 1.2MB | 봉고+드럼 |
| `11325622-epic-strings-intro-239971.mp3` | 0:36 | 1.1MB | 에픽 스트링 인트로 |
| `simplesound-dark-horror-opener-443328.mp3` | 0:34 | 1.0MB | 호러 오프너 |
| `5xbeatz-percussion-loop-118-bpm-free-385692.mp3` | 0:33 | 1.0MB | **퍼커션 루프 118BPM** |
| `grand_project-deep-epic-cinematic-when-time-collapses_outro-501526.mp3` | 0:33 | 1.0MB | 에픽 아웃트로 |
| `5xbeatz-percussion-loop-130bpm-387865.mp3` | 0:31 | 1.0MB | **퍼커션 루프 130BPM** |
| `5xbeatz-percussion-loop-132bpm-387866.mp3` | 0:31 | 1.0MB | **퍼커션 루프 132BPM** |
| `soundreality-cinematic-drums-percussion-474175.mp3` | 0:29 | 0.9MB | 시네마틱 드럼 |
| `soundreality-cinematic-percussion-kick-474176.mp3` | 0:29 | 0.9MB | 퍼커션 킥 |
| `soundreality-cinematic-percussion-471495.mp3` | 0:15 | 0.5MB | 퍼커션 스팅 |
| `soundreality-cinematic-percussion-471495 (1).mp3` | 0:15 | 0.5MB | **← 위와 md5 동일. 중복** ✅ |
| `universfield-paranormal-horror-cinematic-498207.mp3` | 0:15 | 0.5MB | 초자연 스팅 |
| `ncprime-cinematic-background-291979.mp3` | 0:14 | 0.5MB | 짧은 시네마틱 |
| `ncprime-cinematic-background-293547.mp3` | 0:14 | 0.5MB | **← 위와 md5 동일. 중복** ✅ |
| `dragon-studio-slow-cinematic-clock-ticking-405471.mp3` | 0:08 | 0.25MB | 시계 초침 |

> **유니크 19곡, 총 재생 시간 약 15분.** 대부분이 30초 내외 → **전부 루프 전제**로 설계해야 한다.

### 5.2 ★ 레이어드 배정 (정본 §4.5 + §7 "심장 박동처럼 밀도가 오른다")

정본은 BGM 티어를 "앰비언스 → 퍼커션 진입 → 풀 퍼커션 → 시네마틱 고조 → 보스"로 규정한다.
곡을 통째로 갈아 끼우면 이 "누적감"이 안 산다. **베드(bed) 1개를 계속 깔고, 퍼커션 레이어를 갈아 끼운다.**

| 구간 | 인게임 시각 | BED (계속 재생) | LAYER (교체) | 추가 |
|---|---|---|---|---|
| 0:00–1:30 | 23:00 | `universfield-horror-background-atmosphere-025-499631.mp3` (2:41 루프) | — (무음) | — |
| 1:30–3:00 | 01:00 | 동일 (계속) | `5xbeatz-percussion-loop-118-bpm-free-385692.mp3` (0:33 루프) | — |
| 3:00–4:30 | 03:00 | 동일 (계속) | `5xbeatz-percussion-loop-130bpm-387865.mp3` (0:31 루프) | `soundreality-cinematic-percussion-kick-474176.mp3` (0:29 루프) 레이어 추가 |
| 4:30–6:00 | 05:00 | 동일 (계속) | `5xbeatz-percussion-loop-132bpm-387866.mp3` (0:31 루프) | `11325622-epic-strings-intro-239971.mp3` (0:36 루프) 스트링 추가 |
| 6:00– | 보스 | **BED 페이드아웃** | `simplesound-dark-horror-opener-443328.mp3` (0:34, 1회) → `audioknap-drums-only-448491.mp3` (1:04 루프) | — |

> ⚠️ **BPM이 118/130/132로 서로 다르다 ✅.** 두 퍼커션 루프를 동시에 겹치면 박자가 어긋난다.
> → **퍼커션 레이어는 항상 1개만 활성.** 교체 시 크로스페이드한다.
> 3:00 구간의 `kick`과 4:30 구간의 `strings`는 박자 종속성이 낮은 소재이므로 겹쳐도 안전하다 🔶
> (❓ **TASK AT-08**: 3:00·4:30 구간 레이어 조합을 실제로 들어보고 어긋나면 겹치기를 취소하고 단일 레이어로.)

### 5.3 화면별 배정

| 화면 | 곡 | 재생 |
|---|---|---|
| 타이틀 | `universfield-atmospheric-cinematic-soundscape-152493.mp3` (1:31) | 루프, vol 0.50 |
| 성소(Sanctum) | `ncprime-noncopyright-music-pianos-295174.mp3` (1:32) | 루프, vol 0.45 |
| 결과 화면 — 승리 | `grand_project-deep-epic-cinematic-when-time-collapses_outro-501526.mp3` (0:33) | 1회 → 정적 |
| 결과 화면 — 패배 | `universfield-dark-horror-soundscape-345814.mp3` (1:09) | 루프, vol 0.40 |
| 결과 공통 백업 | `ncprime-cinematic-background-291979.mp3` (0:14) | 루프 |
| **스팅 — 각성** ★ | `universfield-paranormal-horror-cinematic-498207.mp3` 앞 **0~2.5초** 컷 | 1회, **SFX 버스**로 재생 (vol 0.9) |
| **스팅 — 보스 등장** | `soundreality-cinematic-percussion-471495.mp3` 앞 **0~3초** 컷 | 1회, SFX 버스 |
| 스팅 — 카운트다운(선택) | `dragon-studio-slow-cinematic-clock-ticking-405471.mp3` (0:08) | 5:30~6:00 구간 저볼륨 오버레이 |
| **미사용/예비** | `soundreality-cinematic-music-487645.mp3`, `niteshnaagodiya-bongo-…-21295.mp3`, `soundreality-cinematic-drums-percussion-474175.mp3` | 배포 제외 |

> **배포 대상 13곡** (유니크 19곡 중). §4.4 블랙리스트에 따라 나머지 6곡은 `FE/public/`에 복사하지 않는다.

### 5.4 크로스페이드 & 볼륨 기준값

```js
// FE/src/game/audio/AudioDirector.js  — 규격
const MIX = {
  masterBgm : 0.60,   // 정본 §13 기본값
  masterSfx : 0.80,   // 정본 §13 기본값

  bed       : 0.55,   // 앰비언스 베드
  perc1     : 0.45,   // 01:00 118BPM
  perc2     : 0.60,   // 03:00 130BPM
  perc2Kick : 0.35,   // 03:00 킥 레이어
  perc3     : 0.70,   // 05:00 132BPM
  strings   : 0.50,   // 05:00 스트링
  bossIntro : 0.85,
  bossLoop  : 0.75,
  title     : 0.50,
  sanctum   : 0.45,
  resultWin : 0.70,
  resultLose: 0.40,
};

const FADE = {
  phaseChange : 1200,  // ms, equal-power 크로스페이드
  bossEnter   :  600,  // BED 페이드아웃은 짧고 극적으로
  sceneChange :  400,
  duckOnCard  :  250,  // PACT 카드 열릴 때
};

const DUCK = {
  // PACT 카드가 열리면(scene.pause) BGM을 -6dB(×0.50)로 낮춘다.
  // 정본 §1: 카드 선택은 3~6초. 이 동안 녹턴 대사와 UI SFX가 들려야 한다.
  cardOpen : 0.50,
  // 각성 연출 1.5초 동안은 BGM ×0.30 (스팅이 주인공)
  awakening: 0.30,
};
```

**크로스페이드 규칙**

| # | 규칙 |
|---|---|
| A1 | 페이즈 전환은 **equal-power 크로스페이드** (`sin/cos` 커브). 선형 페이드는 중간에 볼륨이 파인다 |
| A2 | BED는 **런 전체에서 한 번도 stop하지 않는다.** 보스 진입 시에만 600ms 페이드아웃 |
| A3 | 퍼커션 레이어는 **`seek(0)`으로 재시작하지 않고**, 새 레이어를 `play()` 후 겹쳐 페이드 |
| A4 | 모든 루프는 `loop: true`. 파일이 0:29~2:41로 짧으므로 **이음매 클릭 방지**를 위해 트랜스코드 시 앞뒤 5ms 페이드를 넣는다 |
| A5 | 스팅은 BGM 버스가 아니라 **SFX 버스**로 재생 (BGM 볼륨 옵션과 분리) |
| A6 | 앱 백그라운드 진입 시 전체 `pauseOnBlur` (Phaser 기본 `pauseOnBlur:true` 유지) |
| A7 | Android WebView 자동재생 정책 — **첫 터치 이벤트 전까지 오디오를 시작하지 않는다.** 타이틀의 "탭하여 시작"에서 `sound.unlock()` |

---

## 6. ★ SFX 부재 대응 — 최우선 공백

### 6.1 사실 확인

✅ **`asset/` 전체 7,846 파일 중 효과음(SFX) 파일은 단 1개도 없다.**
오디오는 `asset/bgm/`의 mp3 21개가 전부이며, 이들은 전부 BGM/앰비언스/퍼커션 루프다.

이것은 **치명적 공백**이다. 정본 `01-CONCEPT-AND-STORY.md` §8은 플레이어 경험 목표 2번으로
*"저주가 터졌다! — 각성 순간의 역전 쾌감. 화면 연출 **+ 사운드 스팅**으로 반드시 보상"* 을 명시한다.
SFX 없이 출시하면 **게임의 핵심 필러 하나가 통째로 비어 있는 상태**로 나간다.
또한 정본 §13은 "SFX 볼륨 0.8" 옵션을 이미 규정하고 있어, SFX가 없으면 **존재하지 않는 것을 조절하는 옵션**이 남는다.

### 6.2 해결책 — 우선순위

| 순위 | 방안 | 소요 | 리스크 | 판정 |
|---|---|---|---|---|
| **1순위** | **(b) WebAudio 절차적 SFX** — 코드로 합성 | **2~3시간** | 라이선스 0, 용량 0, 로딩 0 | ★ **7일 스코프에 이것이 정답. Day 4에 구현** |
| 2순위 | **(a) CC0 무료 SFX 확보** | 3~5시간 (탐색+정리+트랜스코드) | 라이선스 개별 확인 필요, 용량 +60KB | 절차적 결과가 빈약한 3~4종만 보강 |
| 3순위 | (c) 유료 SFX 팩 구매 | $10~30 + 2시간 | 예산 | **하지 않음** |

### 6.3 (a) 무료 CC0 SFX 확보처 — 웹 확인 결과

| 출처 | URL | 라이선스 | 확인 내용 | 주의 |
|---|---|---|---|---|
| **Kenney** | https://kenney.nl/assets/interface-sounds , https://kenney.nl/assets/ui-audio , https://kenney.nl/assets/digital-audio | **CC0 (퍼블릭 도메인)** | Kenney의 **모든** 에셋은 CC0. 상업 게임에서도 **크레딧 불필요** | ★ **가장 안전.** UI 탭/클릭/레벨업 계열은 여기서 즉시 조달 가능 |
| **Freesound** | https://freesound.org | **사운드마다 다름.** CC0 필터 필요 | 70만+ 사운드. **라이선스가 파일 단위로 다름** | ⚠️ **반드시 `License: Creative Commons 0` 필터를 걸고, 다운로드한 각 파일의 URL·업로더·라이선스를 §17의 에셋 대장에 기록**할 것 |
| **Sonniss GDC Game Audio Bundle** | https://gdc.sonniss.com/ | 독자 라이선스 — **로열티 프리, 상업 사용 가능, 크레딧 불필요, 프로젝트 수 무제한** | 매년 GDC 시즌 무료 배포. 7GB+ | ⚠️ 용량이 매우 큼(수 GB). **7일 스코프에서는 다운로드 시간만으로 손해.** 2순위 안에서도 후순위 |
| (참고) OpenGameArt | https://opengameart.org | 작품마다 CC0/CC-BY/GPL 혼재 | | ⚠️ CC-BY가 많아 크레딧 의무 발생 |

> **권고 조달 범위(2순위 실행 시):** Kenney `Interface Sounds` + `UI Audio` 2팩만 받아
> **UI 탭 / 카드 선택 / 레벨업 / 골드 획득** 4종만 교체한다. 나머지 8종은 절차적 생성으로 충분하다.
> Kenney는 CC0이므로 **§17 크레딧 화면에 "필수는 아니나 표기"** 로 넣는다.

### 6.4 (b) ★ 절차적 SFX — 7일 스코프의 정답

**왜 이게 최선인가**
- 라이선스 리스크 **0** (우리가 만든 코드가 만든 소리)
- 다운로드/디코딩 용량 **0** — 모바일 초기 로딩이 빨라진다
- **피치·길이를 런타임에 흔들 수 있다.** 초당 수십 번 나는 타격음이 완전히 같으면 귀에 거슬리는데,
  피치를 ±3반음 랜덤화하면 이 문제가 사라진다. 샘플 방식으로는 이걸 하려면 파일을 여러 개 준비해야 한다
- 게임의 톤(고딕·의식적·저역 중심)에 맞춰 **파라미터를 직접 튜닝**할 수 있다

**구현 규격** — `FE/src/game/audio/Sfx.js`

```js
// BLOODSWORN 절차적 SFX 합성기 (WebAudio)
// Phaser의 sound.context를 그대로 빌려 쓴다 (컨텍스트 2개를 만들지 않는다).
export class Sfx {
  constructor(phaserSound) {
    this.ctx = phaserSound.context;          // Phaser.Sound.WebAudioSoundManager
    this.bus = this.ctx.createGain();        // SFX 마스터 버스
    this.bus.gain.value = 0.8;               // 정본 §13 기본값
    this.bus.connect(this.ctx.destination);
    this._noise = this._makeNoiseBuffer(1.0);
  }
  setVolume(v) { this.bus.gain.value = v; }

  _makeNoiseBuffer(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 톤 1발: 주파수 f0 → f1로 글라이드하며 감쇠 */
  _tone({ type = 'square', f0, f1 = f0, dur = 0.1, gain = 0.3, delay = 0, detune = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);      // 4ms 어택
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);       // 지수 감쇠
    osc.connect(g).connect(this.bus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** 노이즈 1발: 밴드패스로 음색 결정 */
  _noiseHit({ freq = 1200, q = 1.2, dur = 0.08, gain = 0.3, delay = 0, type = 'bandpass' }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this._noise;
    const flt = this.ctx.createBiquadFilter(); flt.type = type;
    flt.frequency.setValueAtTime(freq, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.35), t + dur);
    flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(this.bus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ── 12종 ─────────────────────────────────────────────
  hitEnemy()  { const d = (Math.random()*2-1)*120;               // 피치 랜덤 ±120cent
                this._noiseHit({ freq: 900, q: 0.9, dur: 0.045, gain: 0.22 });
                this._tone({ type:'square', f0: 220, f1: 90, dur: 0.05, gain: 0.12, detune: d }); }
  kill()      { this._noiseHit({ freq: 2200, q: 0.6, dur: 0.09, gain: 0.20 });
                this._tone({ type:'sawtooth', f0: 320, f1: 60, dur: 0.14, gain: 0.18 }); }
  playerHurt(){ this._tone({ type:'sine', f0: 140, f1: 45, dur: 0.22, gain: 0.42 });
                this._noiseHit({ freq: 500, q: 0.8, dur: 0.13, gain: 0.24 }); }
  levelUp()   { [523.25, 659.25, 783.99].forEach((f,i) =>       // C5-E5-G5
                  this._tone({ type:'triangle', f0: f, f1: f, dur: 0.16, gain: 0.22, delay: i*0.075 })); }
  cardSelect(){ this._noiseHit({ freq: 3200, q: 0.5, dur: 0.10, gain: 0.14 });   // 양피지 스크래치
                this._tone({ type:'sine', f0: 180, f1: 150, dur: 0.09, gain: 0.28, delay: 0.06 }); } // 도장
  awakening() { // ★ 낮은 종 + 심장박동 (정본 §5.2)
                this._tone({ type:'sine', f0: 55,  f1: 52,  dur: 1.60, gain: 0.50 });   // 종 기음
                this._tone({ type:'sine', f0: 82.5,f1: 78,  dur: 1.40, gain: 0.22 });   // 3배음
                this._tone({ type:'sine', f0: 165, f1: 156, dur: 0.90, gain: 0.14 });
                this._noiseHit({ freq: 4000, q: 0.4, dur: 0.35, gain: 0.18 });          // 종 어택
                [0.00, 0.28].forEach(d =>                                               // 심장 2박
                  this._tone({ type:'sine', f0: 70, f1: 32, dur: 0.20, gain: 0.45, delay: 0.55 + d })); }
  dash()      { this._noiseHit({ freq: 5000, q: 0.4, dur: 0.16, gain: 0.22, type:'highpass' }); }
  bossAppear(){ this._tone({ type:'sawtooth', f0: 38, f1: 30, dur: 1.20, gain: 0.55 });
                this._tone({ type:'square',   f0: 76, f1: 60, dur: 1.00, gain: 0.18 });
                this._noiseHit({ freq: 220, q: 1.4, dur: 1.10, gain: 0.28, type:'lowpass' }); }
  death()     { this._tone({ type:'sine', f0: 300, f1: 22, dur: 1.50, gain: 0.45 });
                this._noiseHit({ freq: 700, q: 0.5, dur: 0.9, gain: 0.16, type:'lowpass' }); }
  uiTap()     { this._tone({ type:'square', f0: 900, f1: 700, dur: 0.03, gain: 0.16 }); }
  pickupExp() { const semi = (Math.floor(Math.random()*7) - 3);   // ±3반음
                const f = 880 * Math.pow(2, semi/12);
                this._tone({ type:'triangle', f0: f, f1: f*1.5, dur: 0.055, gain: 0.13 }); }
  pickupGold(){ this._tone({ type:'triangle', f0: 1046, f1: 1046, dur: 0.07, gain: 0.16 });
                this._tone({ type:'triangle', f0: 1568, f1: 1568, dur: 0.09, gain: 0.12, delay: 0.045 }); }
}
```

**동시 발음 제한 (반드시 구현)** — 150체가 죽는 게임이다. 그대로 두면 오디오가 뭉개진다.

```js
// 같은 SFX가 60ms 안에 재호출되면 무시한다. 특히 hitEnemy / pickupExp.
const THROTTLE = { hitEnemy: 60, kill: 45, pickupExp: 40, uiTap: 80 };
// 프레임당 SFX 트리거 상한 6개.
```

### 6.5 (c) 필요 SFX 최소 12종 — 명세

| # | 키 | 트리거 | 길이 | 음향 특성 | 우선 |
|---|---|---|---|---|---|
| 1 | `hitEnemy` | 적 피격 | 45ms | 900Hz 밴드패스 노이즈 + 220→90Hz 스퀘어. **피치 ±120cent 랜덤**. 매우 짧고 건조하게 | **MUST** |
| 2 | `kill` | 적 처치 | 140ms | 2.2kHz 노이즈 스플랫 + 320→60Hz 톱니 하강. "뼈가 부서지는" 질감 | **MUST** |
| 3 | `playerHurt` | 플레이어 피격 | 220ms | 140→45Hz 사인(저역 임팩트) + 500Hz 노이즈. **적 피격보다 확실히 저역**이어야 구분됨 | **MUST** |
| 4 | `levelUp` | 레벨업 | 400ms | C5–E5–G5 삼각파 아르페지오, 75ms 간격. 밝지만 화려하지 않게 | **MUST** |
| 5 | `cardSelect` | PACT 카드 탭 | 150ms | 3.2kHz 노이즈(양피지 스크래치) → 180Hz 사인(인장 찍기). **정본 §7 "계약서" 모티프** | **MUST** |
| 6 | **`awakening`** ★ | 각성 발동 | **1.6s** | **55Hz 사인 종 기음 + 3배음 + 심장 2박(70→32Hz, 0.55s/0.83s).** 정본 §5.2가 "낮은 종소리 + 심장박동 스팅"을 명시 | **MUST** |
| 7 | `dash` | 대시 | 160ms | 5kHz 하이패스 노이즈 스윕. 공기 가르는 소리 | **MUST** |
| 8 | `bossAppear` | 보스 등장 | 1.2s | 38→30Hz 톱니(서브 브라스) + 220Hz 로우패스 노이즈 룸블. 화면 붉은 플래시와 동기 | **MUST** |
| 9 | `death` | 플레이어 사망 | 1.5s | 300→22Hz 사인 글리산도 + 로우패스 노이즈 페이드. 끝에 완전 무음 0.4s | **MUST** |
| 10 | `uiTap` | 버튼/메뉴 탭 | 30ms | 900→700Hz 스퀘어. 아주 짧게 | **MUST** |
| 11 | `pickupExp` | EXP 오브 흡수 | 55ms | 880Hz 기준 **±3반음 랜덤** 삼각파 상승. 연속 획득 시 멜로디처럼 들려야 함 | **MUST** |
| 12 | `pickupGold` | 골드/회복 획득 | 120ms | C6 + G6 2음 삼각파(45ms 간격). 동전 딸랑 | **MUST** |

**확장 (여유 시)**

| # | 키 | 트리거 | 특성 |
|---|---|---|---|
| 13 | `weaponFire` | 화염탄 발사 | 60ms, 1.4kHz 밴드패스 짧은 훅 |
| 14 | `chestOpen` | 보물상자 | 300ms, 나무 삐걱 + 금속 |
| 15 | `humanityLoss` | 인간성 감소 | 250ms, 심장 1박 + 저역 드론. **인간성 20% 하락 시에만** |
| 16 | `telegraph` | 보스 패턴 예고 | 400ms, 1kHz 사인 2펄스. 정본 §7.3 "0.6초 이상 예고"의 청각 채널 |

> ❓ **TASK AT-09 (Day 4, 60분)**: 위 12종을 실기(Android 실기 + 이어폰 + 스피커)에서 들어보고
> `gain` 값을 재조정한다. 특히 6번 `awakening`은 게임의 대표 순간이므로 **20분 이상 튜닝**할 것.

---

## 7. VFX 가이드

### 7.1 피격 표현

| 요소 | 규격 |
|---|---|
| **피격 플래시** | `sprite.setTintFill(0xFFFFFF)` → **60ms 후** `clearTint()`. `setTint`가 아니라 **`setTintFill`** (실루엣 전체가 흰색이 되어야 150체 중에서도 보인다) |
| 플레이어 피격 플래시 | `setTintFill(0xD6203A)` 100ms + 카메라 흔들림 (표 7.3) |
| **데미지 숫자** | `BONE #D8CFC0` / 치명타 `GOLD #E8B44C`. 위로 18px 이동, 0.5s, ease-out, alpha 1→0. **동시 표시 상한 20개** — 초과 시 오래된 것부터 제거. 저사양 모드에서 OFF (정본 §13) |
| **넉백** | 일반 적 **8px / 80ms / ease-out** · 엘리트 **4px** · 보스 **0px**. 넉백 중에도 AI는 계속 동작(스턴 아님) |
| 처치 연출 | `kill` SFX + `setTintFill(0xD6203A)` 40ms → alpha 1→0 & scaleY 1→0.6, 120ms 후 풀 반환 |
| 피 파티클 | 처치당 3개, `#8E1220`, 2×2px, 수명 0.35s, 중력 있음. **저사양 모드에서 0개** |

### 7.2 히트스톱 사용 기준

**히트스톱은 강력하지만 남용하면 게임이 끊겨 보인다.** 아래 4가지 외에는 쓰지 않는다.

| 이벤트 | 정지 시간 | `timeScale` | 비고 |
|---|---|---|---|
| **각성 발동** | **200ms** | 0 | 정본 §5.2 ①에 명시된 필수 연출 |
| **보스 처치** | 300ms | 0 | 승리의 무게 |
| 보스 낫 착탄(플레이어 피격) | 80ms | 0.15 | 완전 정지가 아니라 슬로우 |
| 치명타 | **30ms** | 0.3 | **저사양 모드에서 OFF.** 일반 타격에는 절대 넣지 않는다 |

> ⚠️ **일반 적 피격에는 히트스톱 금지.** 초당 20~40회 타격이 발생하는 게임이다.

### 7.3 화면 흔들림 강도표

`camera.shake(duration, intensity)` — intensity는 뷰포트 비율이다(640×360 기준 0.01 ≈ 6.4px).
**정본 §13의 "화면 흔들림 OFF" 옵션이 켜지면 아래 전부 0으로 만든다.**

> ★ **화면을 흔드는 통로는 `FxSystem.shake(kind)` 하나뿐이다.**
> 어떤 시스템도 `cameras.main.shake()` 를 직접 부르지 않는다 — 직접 부르면 흔들림 OFF 옵션과
> 자동 품질 강등(§7.4 / 13-QA UI-03·UI-04)을 통째로 지나친다. 아래 **키** 열이 코드의 `SHAKE` 표
> 키와 1:1로 대응한다. 새 연출은 여기에 한 줄을 먼저 추가한 뒤 그 이름으로 부른다.

| 이벤트 | 키 (`FxSystem.SHAKE`) | duration | intensity | 화면 이동량(≈) |
|---|---|---|---|---|
| 대시 | `dash` | 60ms | 0.002 | 1.3px |
| 적 처치(엘리트) | `killElite` | 120ms | 0.003 | 1.9px |
| 플레이어 피격 | `playerHurt` | 120ms | 0.004 | 2.6px |
| 성수 낙하 착탄 | `zoneImpact` | 100ms | 0.004 | 2.6px |
| 낙석 착탄 (stage4 「붕괴」) | `rockfall` | 120ms | 0.005 | 3.2px |
| 엘리트 등장 | `eliteSpawn` | 300ms | 0.006 | 3.8px |
| 보스 페이즈 전환 | `bossPhase` | 300ms | 0.006 | 3.8px |
| 보스 돌진 개시 | `bossDashStart` | 160ms | 0.006 | 3.8px |
| 보스 광폭화 | `bossEnrage` | 320ms | 0.007 | 4.5px |
| 보스 낫 착탄 | `bossHit` | 200ms | 0.008 | 5.1px |
| 적 자폭 | `selfDestruct` | 220ms | 0.008 | 5.1px |
| 보스 돌진 명중 | `bossDashHit` | 280ms | 0.010 | 6.4px |
| 플레이어 사망 | `death` | 400ms | 0.010 | 6.4px |
| 보스 처치 | `bossDefeat` | 500ms | 0.010 | 6.4px |
| 보스 등장 | `bossAppear` | 800ms | 0.012 | 7.7px |
| **각성** ★ | `awaken` | **500ms** | **0.015** | 9.6px |

> **상한 0.015를 넘기지 않는다.** 모바일 가로 화면에서 그 이상은 멀미를 유발한다(정본 §13이 명시적으로 대응을 요구).

**낙석 0.005의 근거** — 낙석은 stage4에서 7.5초마다 최대 4개가 동시에 떨어져 한 런에 40회 이상
반복된다. 일회성 사건인 엘리트 등장(0.006)보다 세면 화면이 상시로 떠 있는 것처럼 읽힌다.
반대로 성수 낙하(0.004)와 같게 두면 "돌"의 무게가 물방울과 구분되지 않는다. 그 사이인 0.005,
길이는 낙하물 계열(100~120ms)을 따라 120ms — 같은 파도의 낙석 4개가 이어져도 뭉개지지 않는다.
상한 0.015의 1/3이다.

**드리프트 교정 기록** — 각 시스템이 이 표를 두고 자기 숫자를 하드코딩한 결과 두 곳이 어긋나 있었다.
`엘리트 등장` 은 코드가 180ms/0.005, `보스 낫 착탄` 은 250ms/0.008 이었다. 둘 다 이 표 쪽으로 맞췄다
(낫 착탄은 코드 주석까지 "09-ART 낫 착탄 200ms 0.008" 이라고 적혀 있었다).

### 7.4 파티클 상한

| 항목 | 기본 | 저사양 모드 |
|---|---|---|
| 동시 파티클 총량 | **300** | **150** (정본 §13 "파티클 50% 감소") |
| 동시 이미터 수 | 8 | 4 |
| 각성 오라 | 이미터 **1개 재사용** (태그 색만 `setTint` 교체) | 1개, 방출률 50% |
| 피 파티클 | 처치당 3 | 0 |
| EXP 오브 트레일 | 없음 | 없음 |
| 이펙트 스프라이트(fx-*) 동시 재생 | 24 | 12 |

> **오브젝트 풀 필수.** 이펙트 스프라이트는 `Group`에서 꺼내 쓰고 `onComplete`에서 반환한다.
> `add.sprite()`를 매번 호출하면 6분 런에서 GC 스파이크가 난다.

### 7.5 ★ 각성 연출 — 프레임 단위 타임라인

정본 `04-PACT-SYSTEM.md` §5.2는 6단계를 규정하고 *"이 연출에 하루의 1/4를 써도 아깝지 않다.
이게 게임의 대표 스크린샷이 된다"* 고 못 박았다. 아래가 그 구현 규격이다. **총 1500ms.**

| 프레임 (60fps) | 시각 | 동작 |
|---|---|---|
| **f0** | 0ms | `scene.physics.pause()`, `time.timeScale = 0`. **`Sfx.awakening()` 재생**. BGM 덕킹 ×0.30 (250ms) |
| f0 – f12 | 0–200ms | 풀스크린 사각(`#D6203A`) alpha **0 → 0.85** (ease-out). **정본 ②의 "심홍 플래시"** |
| f12 – f21 | 200–350ms | **흑백 반전 0.15s** — 풀스크린 사각을 `#D8CFC0`, `BlendModes.DIFFERENCE`, alpha 1.0으로 교체 (셰이더 불필요) |
| f21 – f27 | 350–450ms | 오버레이 alpha 0.85 → 0.15. 동시에 **각성 이름 대형 타이포**(§8, 32px, `GOLD`) scale 1.6→1.0 / alpha 0→1, **인장 아이콘**(G3) 중앙 상단 scale 2.0→1.0 |
| f27 – f60 | 450–1000ms | 타이포·인장 유지. 인장 `angle` 0→5° 진자. `camera.shake(500, 0.015)` |
| **f60** | **1000ms** | `time.timeScale = 1`, `physics.resume()`. **`fx-shock`(Part 35, 15프레임) 플레이어 중심 재생, scale 1.5**. 화면 내 **모든 적 넉백 24px + 2초 스턴** (정본 ⑤). **HP 30% 회복** (정본 §9 S6) |
| f60 – f90 | 1000–1500ms | 타이포 alpha 1→0, 오버레이 alpha 0.15→0, 인장 scale 1.0→0.6 & alpha→0 |
| **f90+** | 1500ms~ | **플레이어 오라 이미터 ON** — 태그별 오라색(§1.2), 방출률 12/s, 수명 0.6s, `ADD` 블렌드. 런 종료까지 상시 (정본 ⑥) |

**동시 진행 UI**
- `HudScene`의 태그 카운터가 `●●○ → ●●●`로 바뀌며 f21에 `GOLD` 1회 플래시
- React 레이어는 **관여하지 않는다** (게임이 pause 상태가 아니라 timeScale 0이므로 Phaser 안에서 전부 처리)
- 각성 도감 등록 이벤트는 f90에 `EventBus.emit('awakening:unlocked', tag)`

**"각성 임박" 하이라이트** (정본 §6 5번) — 각성 연출과 별개
- 선택 시 3중첩이 완성되는 카드의 테두리를 `GOLD #E8B44C`로 **맥동**: alpha 0.5↔1.0, 주기 0.7s, `yoyo`
- 문구 "이 계약으로 각성한다"를 카드 하단에 `GOLD`로 표시

---

## 8. 폰트 & 텍스트 렌더링

### 8.1 ★ 폰트 정체 규명 — 실측 결과

`base_font.woff2`(98,252 B)를 **직접 파싱해 정체를 확정했다.**
(WOFF2 헤더 → 테이블 디렉터리 → brotli 해제 → `name` / `cmap` 테이블 파싱)

| 항목 | 값 | 출처 |
|---|---|---|
| **폰트 이름** | **Mulmaru Mono (물마루 Mono)** | `name` ID 1 / 4 ✅ |
| 버전 | 1.0 | `name` ID 5 ✅ |
| 제작자 | **Mushsooni** | `name` ID 0 ✅ |
| 저장소 | **https://github.com/mushsooni/mulmaru** | `name` ID 0 ✅ |
| **라이선스** | **SIL Open Font License 1.1** | `name` ID 13 ✅ **폰트 파일 자체에 명시** |
| 스타일 | Regular 1종 | `name` ID 2 ✅ |
| **가변 폰트 여부** | **아님** — `fvar` 테이블 **없음** ✅ | 테이블 목록: `FFTM GDEF OS/2 cmap gasp glyf loca head hhea hmtx maxp name post` |
| 자족(自足) | **고정폭(Mono)** | 이름 및 `hmtx` |
| 원본 sfnt 크기 | 1,583,396 B (woff2 98KB로 압축) | 헤더 `totalSfntSize` ✅ |
| **총 커버 코드포인트** | **11,965** | `cmap` format 4 파싱 ✅ |

**글리프 커버리지 실측** ✅

| 범위 | 커버 | 개수 |
|---|---|---|
| **한글 완성형 AC00–D7A3** | ✅ **전부** | **11,172** |
| 한글 호환 자모 3130–318F | ✅ | 51 |
| 한글 조합형 자모 1100–11FF | ❌ 없음 | 0 |
| ASCII 0020–007E | ✅ | 95 |
| 라틴 확장 00A1–00FF | ✅ 부분 | |
| 그리스 0391–03C9 / 키릴 0410–044F | ✅ | |
| 일본어 히라가나 3041–3094 / 가타카나 30A1–30F6 | ✅ | |
| **한자(CJK)** | ❌ **7자뿐** (中体文日本简语) | **7** |

### 8.2 ★ 치명적 발견 두 가지

**① 정본에 쓰인 한자가 폰트에 없다.**

| 문자 | 코드포인트 | 폰트 커버 | 등장 위치 |
|---|---|---|---|
| 血 | U+8840 | ❌ **없음** | **W1 무기명 「피의 송곳니」** (정본 §6.2) |
| 刃 | U+5203 | ❌ **없음** | 동상 |
| 封 印 墓 | U+5C01 / U+5370 / U+5893 | ❌ 없음 | 「봉인묘」 (정본 §4.1) |
| 聖 燭 | U+8056 / U+71ED | ❌ 없음 | 「성촉」 (정본 §4.1) |
| 契 約 · 覺 醒 · 代 價 · 祝 福 | — | ❌ 전부 없음 | 문서 표기 |

→ **그대로 렌더하면 두부(□)가 뜬다.** 게임의 시작 무기 이름이 `□□ (Bloodfang)`으로 보인다.

**대응 (택1, 권고순)**
| # | 방안 | 판정 |
|---|---|---|
| **A** | **인게임 표기를 한글로 통일** — `피의 송곳니` → **「혈인(피의 송곳니)」이 아니라 「피의 검격」 또는 「혈인」**. 정본 §7 문체가 "짧고 의식적, 12자 이내"이므로 한글 표기가 오히려 톤에 맞다 | ★ **권고.** 비용 0, 리스크 0 |
| B | 한자 부분만 **이미지 스프라이트**로 제작 (Codex 생성 목록에 추가) | 무기 아이콘에 곁들일 때만 |
| C | 한자 지원 폰트를 추가 로드 | ❌ 용량 폭증. **하지 않음** |

> ❓ **TASK AT-10 (Day 1, 15분)**: `03-GDD-CORE.md` §6.2, `04-PACT-SYSTEM.md` §7.1, `01-CONCEPT-AND-STORY.md` §4.1의
> 한자 표기를 인게임 문자열에서 어떻게 쓸지 확정하고 `data/*.json`의 `name` 필드에 반영한다.
> **한자를 그대로 두면 Day 3에 UI가 두부로 도배된 채 발견된다.**

**② 정본 HUD 목업의 기호도 대부분 없다.**

| 기호 | 코드포인트 | 커버 | 대체 |
|---|---|---|---|
| ★ | U+2605 | ✅ 있음 | 그대로 사용 |
| ♥ | U+2665 | ✅ 있음 | **인간성 심장 5개에 그대로 사용** |
| ● ○ | U+25CF / U+25CB | ✅ 있음 | **태그 중첩 표시 `●●○`에 그대로 사용** |
| ▓ ░ | U+2593 / U+2591 | ❌ 없음 | **`Graphics` 사각형 게이지로 대체** |
| ☠ | U+2620 | ❌ 없음 | **Raven 해골 아이콘**(TASK AT-05)으로 대체 |
| ✦ | U+2726 | ❌ 없음 | `★`(U+2605)로 대체 |
| ✖ | U+2716 | ❌ 없음 | `×`(U+00D7, ✅ 있음)로 대체 |
| ⚔ ⚡ | U+2694 / U+26A1 | ❌ 없음 | **Raven 아이콘**으로 대체 |
| ⬢ | U+2B22 | ❌ 없음 | `Graphics` 육각형 또는 각성 인장(G3)으로 대체 |
| ⏸ | U+23F8 | ❌ 없음 | `Graphics` 세로 사각 2개로 대체 |
| ： (전각 콜론) | U+FF1A | ❌ 없음 | 반각 `:` 사용 |

> ❓ **TASK AT-11**: 정본 `03-GDD-CORE.md` §3.1의 HUD 목업에 쓰인 기호를 위 대체표대로 치환한 뒤 정본에 반영.

**③ `FE/src/index.css`의 선언이 사실과 다르다.**

```css
/* 현재 (FE/src/index.css) — 실물과 불일치 */
@font-face {
    font-family: "base_font";
    font-weight: 100 900;   /* ← 가변 폰트 전제. 그러나 fvar 테이블이 없다 ✅ */
    /* Variable font */     /* ← 주석도 사실이 아님 */
    ...
}
```

→ **수정 권고:** `font-weight: 400;` 로 고정. `font-synthesis: none;`은 이미 선언되어 있으므로(확인 ✅)
합성 볼드가 발생하지 않는다 — 즉 **현재 상태에서는 굵은 글씨가 아예 나오지 않는다.**
굵기가 필요하면 **크기(px)와 색(`GOLD`)으로 위계를 만든다.** 이것이 픽셀 폰트의 정석이기도 하다.

### 8.3 사용처 & 렌더링 규격

Mulmaru는 제작자 안내상 **12px(9pt) 또는 그 정수배에서 가장 선명**하다.
게임 논리 해상도가 640×360이므로 아래로 고정한다.

| 용도 | 크기 | 색 | 비고 |
|---|---|---|---|
| 각성 이름 대형 타이포 | **24px** | `GOLD #E8B44C` | 그림자 `#0B0710` offsetY 2 |
| 카드 축복 제목 | 12px | `BONE #D8CFC0` | |
| 카드 대가 문구 | 12px | `BLOOD #8E1220` | 정본 §7 "대가 항목은 붉은 잉크" |
| 녹턴 대사 | 12px | `STONE_LIGHT #6E6478` | 이탤릭 없음(폰트에 없음) → **양쪽 따옴표로 구분** |
| HUD 타이머/레벨/킬수 | 12px | `BONE` | 고정폭이라 숫자가 흔들리지 않음 ★ |
| 데미지 숫자 | 12px | `BONE` / crit `GOLD` | |
| 버튼 라벨 | 12px | `BONE` | |
| 본문 최소 | **12px 미만 금지** | | 12px 아래로 내려가면 한글이 뭉갠다 |

**안티앨리어싱 문제 — 반드시 처리**

픽셀 폰트를 브라우저가 그대로 그리면 서브픽셀 안티앨리어싱이 붙어 **도트가 흐려진다.**

```css
/* FE/src/index.css 에 추가 */
:root { --px-font: "base_font", monospace; }

.pixel-text, canvas + * , .hud, .card {
  font-family: var(--px-font);
  font-size: 12px;               /* 또는 24px */
  line-height: 1.5;              /* 12px → 18px, 정수 */
  -webkit-font-smoothing: none;  /* ★ 안티앨리어싱 끄기 */
  font-smooth: never;
  text-rendering: geometricPrecision;
  letter-spacing: 0;             /* 고정폭이므로 0 유지 */
}
```

> ⚠️ 현재 `index.css`에는 `-webkit-font-smoothing: antialiased`가 들어 있다 ✅ (확인).
> **픽셀 폰트에는 정반대 설정**이다. `none`으로 바꿔야 한다.
> 또한 **DOM 텍스트 크기는 논리 px가 아니라 CSS px**다. Phaser 캔버스가 `FIT`으로 스케일되므로
> React 레이어의 폰트 크기는 **캔버스 스케일과 별개로 결정된다** — 이것이 다음 항목의 핵심이다.

### 8.4 Phaser BitmapText vs DOM 텍스트 — 선택 기준

정본 §10은 **"실시간 전투 = Phaser, 정지 상태 UI = React"** 를 핵심 설계로 규정한다.
텍스트도 이 경계를 그대로 따른다.

| 텍스트 | 방식 | 이유 |
|---|---|---|
| **데미지 숫자** (초당 수십 개) | **Phaser `BitmapText`** ★ | `Phaser.GameObjects.Text`는 매번 캔버스에 그려 텍스처를 새로 만든다 → 초당 수십 개면 즉사. BitmapText는 텍스처 아틀라스에서 글리프를 찍으므로 비용이 거의 0 |
| HUD 타이머/레벨/킬수 (60fps 갱신) | **Phaser `BitmapText`** | 매 프레임 갱신됨 |
| 각성 대형 타이포 (드묾, 큼) | **Phaser `Text`** | 1회성. 큰 글자라 BitmapText 아틀라스를 24px로 또 만들 필요 없음 |
| PACT 카드 (제목/효과/대가/녹턴 대사) | **React DOM** | 게임이 정지 상태. 레이아웃·줄바꿈·스크롤을 CSS가 공짜로 해준다. 정본 §10이 명시 |
| 타이틀/성소/결과/옵션 | **React DOM** | 동일 |
| 툴팁/도감 | **React DOM** | 동일 |

**BitmapText용 비트맵 폰트 생성 — ❓ TASK AT-12 (Day 2, 45분)**

Phaser BitmapText는 `.fnt` + PNG 아틀라스가 필요하다. **woff2를 그대로 못 쓴다.**

1. 게임 내 실제로 쓰이는 글자만 뽑는다 — 숫자 `0-9`, `:`, `.`, `%`, `+`, `-`, `Lv`,
   그리고 HUD/데미지에 쓰이는 한글 20자 내외 (예: 레벨, 각성, 인간성, 초, 킬)
2. **글꼴은 Mulmaru Mono 12px**, 안티앨리어싱 OFF로 렌더
3. 도구: [SnowB Bitmap Font](https://snowb.org/) (웹, 무료) 또는 Hiero
4. 출력: `FE/public/assets/fonts/pixel12.png` + `pixel12.fnt` (예상 4KB 미만)
5. **한글 전체(11,172자)를 굽지 말 것** — 아틀라스가 수 MB가 된다. **필요 글자만.**

> 폴백: 시간이 없으면 데미지 숫자만 BitmapText로 하고(숫자 10자 + 몇 기호만 구우면 1KB),
> 나머지 HUD는 `Phaser.Text`에 **`setText` 호출을 값이 바뀔 때만** 하도록 가드를 건다.

### 8.5 다국어

정본 §13은 한국어만 MUST, 영어는 COULD(i18n 키 구조만). Mulmaru는 라틴/키릴/그리스/가나를 커버하므로
**영어 추가 시 폰트 교체가 불필요하다** ✅. 키 구조만 잡아두면 된다.

---

## 9. 미해결 TASK 목록 (전부 처리 전에는 "완료" 아님)

| ID | 내용 | 담당 | 소요 | Day | 미처리 시 결과 |
|---|---|---|---|---|---|
| **AT-01** | 플레이어 4방향 물리 바디 오프셋 재실측 | 개발 | 20분 | 2 | 히트박스가 발밑이 아니라 몸통 중앙 → 피격 판정 이상 |
| **AT-02** | `All_Fire_Bullet_..._00.png` 640×400의 실제 프레임 격자·사용할 행 확정 (파일 8장이 컬러 변형인지도 확인) | 아트 | 30분 | 2 | W2 투사체 애니가 엉뚱한 프레임 재생 |
| **AT-03** | W4 성수 장판: `Part 25/1234` vs `1244` 중 택1 | 아트 | 15분 | 3 | — |
| **AT-04** | 이펙트 21파트 × 12장 중 미확인분 재검토 (`Preview NN Free.gif` 21장 일괄 확인) | 아트 | 30분 | 5 | 더 나은 소재를 놓침 (치명적이지 않음) |
| **AT-05** ★ | **Raven 아이콘 40개 인덱스 선정** (§2.6의 절차·기준대로) | 아트 | 60–90분 | 2 또는 5 | **카드 UI 전체가 빈칸.** MUST |
| **AT-06** | `decorative.png` 내 보물상자 4종의 정확 rect 측정 | 아트 | 20분 | 3 | 상자가 잘려 보임 |
| **AT-07** ★ | **타일셋 성격 확인** — `mainlevbuild.png`가 정면뷰 플랫포머 세트임. 톱다운 배치 방식 확정 + Tiled 16px 정렬 검증 | 아트 | 60분 | 2 | **Day 3에 맵을 전부 다시 그려야 함.** MUST |
| **AT-08** | BGM 레이어 조합(3:00 kick, 4:30 strings) 실청 확인 | 오디오 | 30분 | 4 | 박자 어긋남 |
| **AT-09** | 절차적 SFX 12종 실기 볼륨/음색 튜닝 (특히 `awakening`) | 오디오 | 60분 | 4 | 각성이 밋밋함 (정본 필러 2 미달) |
| **AT-10** ★ | **한자 표기 정책 확정** (피의 송곳니 등) 후 `data/*.json` 반영 | 기획 | 15분 | 1 | **UI에 두부(□) 도배.** MUST |
| **AT-11** | 정본 HUD 목업의 미지원 기호를 §8.2 대체표대로 치환 | 기획 | 20분 | 2 | HUD 두부 |
| **AT-12** | BitmapText용 `.fnt` + PNG 생성 (필요 글자만) | 개발 | 45분 | 2 | 데미지 숫자에서 프레임 드랍 |
| **AT-13** | `index.css` 수정: `font-weight: 400`, `-webkit-font-smoothing: none` | 개발 | 5분 | 1 | 폰트가 흐림 + 굵기가 안 먹음 |
| **AT-14** | `FE/tools/build-assets.mjs` 작성 + `sharp` 추가 | 개발 | 2–3시간 | 1–2 | 128MB 원본을 수동 복사하다 시간 증발 |
| **AT-15** | BGM 13곡 96kbps OGG+M4A 트랜스코드 | 오디오 | 40분 | 2 | 배포 용량 28MB 초과 |

> **라이선스 관련 확인 항목은 `17-LICENSES-AND-CREDITS.md` §7의 `LC-xx` 로 별도 관리한다.**

---

## 10. 관련 문서

- 세계관·톤: `01-CONCEPT-AND-STORY.md` (정본)
- 화면 규격·적·스테이지: `03-GDD-CORE.md` (정본)
- PACT·각성 연출 요구사항: `04-PACT-SYSTEM.md` (정본)
- 기술 구조·EventBus: `06-TECH-DESIGN.md`
- **라이선스 판정 & 크레딧: `17-LICENSES-AND-CREDITS.md`** ← **읽기 전에 배포하지 말 것**
- 이미지 생성 프롬프트: `15-IMAGE-PROMPTS-FOR-CODEX.md` (§3의 G1~G9)
- 일정: `11-ROADMAP-7DAYS.md` / 백로그: `12-TASK-BACKLOG.md`
