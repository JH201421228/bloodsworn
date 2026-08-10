# 15. 이미지 생성 프롬프트 (Codex 의뢰용)

> **문서 지위: 실행 문서(Operational).** 정본은 `01-CONCEPT-AND-STORY.md` / `03-GDD-CORE.md` / `04-PACT-SYSTEM.md`.
> 이 문서의 모든 프롬프트는 위 3개 정본의 세계관·팔레트·명칭을 따른다. 충돌 시 정본이 우선한다.
>
> 최종 수정: **2026-08-10** / 1인 개발 / Day 1 = 2026-08-10, Day 7 = 2026-08-16
> 배포 규격 근거: `14-BUILD-AND-DEPLOY.md` §8 (Play / App Store 자산 규격, 2026-08-10 확인)
> **배포 대상: Android + iOS 동시.** iOS 자산은 **새로 생성하지 않는다** — A-01 산출물을 후처리(§4.7)해서 만든다.

---

## 0. 이 문서의 사용법

이 문서는 **개발자가 Codex에게 그대로 복사해 붙여넣기 위한 프롬프트 모음집**이다.

```
[사용 순서]
1. §1 「공통 스타일 가이드 블록」을 복사한다.
2. §2에서 만들 항목의 「영어 프롬프트 전문」을 복사해 1번 뒤에 붙인다.
3. 「네거티브 프롬프트」를 함께 전달한다.
4. 결과물을 「수용 기준」 체크리스트로 검수한다.
5. 실패하면 「재시도 조정 포인트」의 순서대로 한 번에 하나씩만 바꾼다.
6. 통과하면 §4 「후처리 워크플로」를 거쳐 지정 경로에 저장한다.
```

### 0.1 이 문서가 다루는 범위

**보유 에셋으로 커버 불가능한 것만** 다룬다.
정본 `01-CONCEPT-AND-STORY.md` §3에 따르면 인게임 스프라이트(캐릭터/적/보스/이펙트/타일/아이콘)는
`asset/` 아래의 기존 에셋(Raven Fantasy 아이콘 6,500여 개 포함)으로 전량 충당된다.

| 구분 | 조달 방법 |
|---|---|
| 캐릭터·적·보스 스프라이트 | ✅ 보유 (`asset/character/`, `asset/monsters/`, `asset/bosses/`) |
| 이펙트·투사체·타일맵 | ✅ 보유 (`asset/effect/`, `asset/projectile/`, `asset/tilemap/`) |
| 축복/대가 카드 **아이콘** | ✅ 보유 (`asset/icons/` Raven Fantasy) |
| BGM/SFX | ✅ 보유 (`asset/bgm/`) |
| **스토어 자산 (아이콘/피처그래픽/스크린샷 오버레이)** | ❌ **생성 필요** ← 이 문서 |
| **iOS 스토어 자산 (앱 아이콘 1024 무알파)** | ♻ **A-01 후처리로 조달** — 신규 생성 없음 (§4.7) |
| **브랜드 (로고 타이포)** | ❌ **생성 필요** ← 이 문서 |
| **PACT UI (카드 프레임/각성 인장/녹턴 초상)** | ❌ **생성 필요** ← 이 문서 |
| **화면 배경 (타이틀/성소/결과/스플래시)** | ❌ **생성 필요** ← 이 문서 |
| **UI 셸 (버튼/패널/바 프레임/조이스틱)** | ❌ **생성 필요** ← 이 문서 |

> **생성 항목이 15건(A-01 ~ A-15)이다. 7일 스코프에서 이 이상 늘리지 않는다.**
> 항목을 추가하고 싶어지면 먼저 `asset/` 을 다시 뒤진다. 대부분 이미 있다.
>
> ⚠ **iOS를 배포 대상에 추가했지만 생성 항목은 오히려 줄었다(16 → 15).**
> itch.io 커버(구 A-16)가 배포 채널 제외로 사라졌고, iOS 앱 아이콘은 **A-01의 후처리 산출물**이기 때문이다.
> **iOS 때문에 새 프롬프트를 만들지 않는다.** 이것이 이 문서의 iOS 대응 원칙이다.

### 0.2 저장 경로 규약

| 용도 | 경로 | 이유 |
|---|---|---|
| **런타임 로드 에셋** (Phaser `load.image`) | `FE/public/img/...` | Vite가 해시 없이 그대로 복사. 런타임 경로가 안정적 |
| **Android 런처/스플래시** | `FE/android/app/src/main/res/...` | 네이티브 리소스. `cap sync` 대상 아님 → 직접 교체 |
| **iOS 아이콘/스플래시** | `FE/ios/App/App/Assets.xcassets/...` | 같은 이유로 네이티브 리소스. **파일명이 `Contents.json`에 고정**되어 있어 이름을 바꾸면 빌드가 깨진다 |
| **스토어 제출물** | `store/play/...`, `store/appstore/...` | 빌드에 포함되지 않음. Play Console / App Store Connect 업로드용 |
| **원본(고해상도 생성물)** | `store/_raw/...` | 후처리 전 원본 보관. 재작업 시 필요 |

```
PJT20260810/
├─ FE/public/img/          ← 런타임 에셋 (게임이 로드)
│   ├─ ui/
│   ├─ seal/
│   ├─ bg/
│   └─ portrait/
├─ FE/android/app/src/main/res/   ← Android 네이티브 (아이콘/스플래시)
├─ FE/ios/App/App/Assets.xcassets/   ← iOS 네이티브
│   ├─ AppIcon.appiconset/     ← AppIcon-512@2x.png (1024×1024, 1장)
│   └─ Splash.imageset/        ← splash-2732x2732.png / -1 / -2 (정사각 3장)
└─ store/
    ├─ _raw/               ← 생성 원본 (1024~1920px)
    ├─ play/               ← Play 제출물
    └─ appstore/           ← App Store Connect 제출물
```

> **iOS 네이티브 리소스 실측**(`Contents.json` 직접 확인, 2026-08-10)
>
> | 위치 | 요구 파일 | 규격 |
> |---|---|---|
> | `AppIcon.appiconset/` | `AppIcon-512@2x.png` **1장** | **1024 × 1024, 알파 채널 없음** (§4.7) |
> | `Splash.imageset/` | `splash-2732x2732.png`(3x) / `-1.png`(2x) / `-2.png`(1x) | **2732 × 2732 정사각** ×3. 방향 무관하게 중앙 크롭됨 |
>
> Android는 밀도별로 아이콘을 5벌 만들지만 **iOS는 1024 한 장이 전부다.** Xcode가 나머지를 파생시킨다.
> 스플래시는 **가로/세로 구분이 없는 정사각 1종**이라 A-04(가로 스플래시)를 그대로 쓸 수 없다 → §4.7 참조.

---

## 1. 공통 스타일 가이드 블록

### 1.1 한국어 설명 — 왜 이 지시문인가

| 지시 | 이유 (정본 근거) |
|---|---|
| 16-bit 픽셀아트 | `01-CONCEPT` §2 "아트: 16-bit 픽셀아트, 고딕 다크 판타지" |
| 심홍 + 청록 이중 광원 | `01-CONCEPT` §7 "두 광원(붉은/청록)의 대비가 시그니처" |
| 무채색 석조 배경 | 같은 곳. 채도는 두 광원만 가진다 |
| 배경색 `#0B0710` | `03-GDD-CORE` §2.1 레터박스 배경색. 전 자산이 이 색 위에 얹힌다 |
| 양피지/인장 모티프 | `01-CONCEPT` §7 "UI는 양피지/인장(seal) 모티프. 카드는 계약서처럼" |
| 금지: 코믹, 밝은 채도, 과한 파티클 | `01-CONCEPT` §7 「금지」 항목 그대로 |
| 안티에일리어싱 금지 | 픽셀아트는 경계가 딱 떨어져야 한다. `03-GDD-CORE` §2.1 `pixelArt:true`, `roundPixels:true` |
| 텍스트 금지 (지정 시 제외) | 이미지 생성기는 글자를 거의 항상 깨뜨린다. 텍스트는 게임 내 폰트로 렌더한다 |

### 1.2 확정 팔레트 (HEX)

**이 팔레트 밖의 색은 쓰지 않는다.** 프롬프트에 그대로 박아 넣는다.

| 역할 | 이름 | HEX | 용도 |
|---|---|---|---|
| **VOID** | 공허 | `#0B0710` | 배경 최심부, 레터박스 (정본 확정값) |
| STONE-1 | 석조 암부 | `#16121C` | 벽 그림자 |
| STONE-2 | 석조 중간 | `#2A2533` | 벽 본체 |
| STONE-3 | 석조 명부 | `#4A4454` | 벽 하이라이트 |
| STONE-4 | 석조 최명부 | `#7B7488` | 모서리, 림라이트 |
| BONE | 골백 | `#C7C2CE` | 뼈, 은, 밝은 금속 |
| **BLOOD-1** | 응혈 | `#4A0710` | 피 암부 |
| **BLOOD-2** | 심홍 | `#8B0F1D` | 피 본체 · **Epic 등급색** |
| **BLOOD-3** | 선혈 | `#C4182B` | 피 명부 |
| **BLOOD-4** | 혈광 | `#FF3B4A` | 발광, 각성 플래시 |
| **TEAL-1** | 성촉 암부 | `#0E3B3A` | 청록 그림자 |
| **TEAL-2** | 성촉 | `#1E7E74` | 청록 본체 · **Rare 등급색** |
| **TEAL-3** | 성촉 명부 | `#35C9B4` | 촛불 코어 |
| **TEAL-4** | 성광 | `#8FF0DC` | 발광 하이라이트 |
| GOLD-1 | 금 암부 | `#7A5C12` | 인장 테두리 그림자 |
| GOLD-2 | 금 | `#C9A227` | 각성 임박 테두리 |
| GOLD-3 | 금 명부 | `#F2D57A` | 금 하이라이트 |
| PARCH-1 | 양피지 암부 | `#8A7A57` | 계약서 그림자 |
| PARCH-2 | 양피지 | `#C9B792` | 계약서 본체 |
| PARCH-3 | 양피지 명부 | `#E8DCC0` | 계약서 하이라이트 |
| GREY | 회백 | `#9A94A3` | **Common 등급색** |

> 등급색은 정본 `04-PACT-SYSTEM.md` §3의 「Common 회백 / Rare 청록 / Epic 심홍」을 그대로 HEX화한 것이다.

### 1.3 ★ 공통 스타일 블록 — 영어 프롬프트 원문

**모든 프롬프트 앞에 이 블록을 그대로 붙인다.**

```
=== BLOODSWORN — GLOBAL STYLE GUIDE (prepend to every prompt) ===

ART STYLE:
16-bit pixel art, gothic dark fantasy, inspired by late-era SNES / early PC
dungeon-crawler UI and Castlevania-style occult ornamentation. Hand-crafted
sprite look: chunky, deliberate pixels with visible square edges. Every pixel
placed on purpose. Limited-palette dithering only — no gradients, no soft
airbrush shading.

STRICT PALETTE (use these HEX values and near-neighbours only):
  Void / deepest background : #0B0710
  Stone shadow              : #16121C
  Stone body                : #2A2533
  Stone light               : #4A4454
  Stone rim                 : #7B7488
  Bone / pale metal         : #C7C2CE
  Blood shadow              : #4A0710
  Blood body (CRIMSON)      : #8B0F1D
  Blood light               : #C4182B
  Blood glow                : #FF3B4A
  Candle shadow             : #0E3B3A
  Candle body (TEAL)        : #1E7E74
  Candle light              : #35C9B4
  Candle glow               : #8FF0DC
  Gold shadow               : #7A5C12
  Gold body                 : #C9A227
  Gold light                : #F2D57A
  Parchment shadow          : #8A7A57
  Parchment body            : #C9B792
  Parchment light           : #E8DCC0
  Neutral grey              : #9A94A3
Total distinct colours in the final image must not exceed 32.

LIGHTING — THE SIGNATURE RULE:
Exactly two light sources, always in opposition.
  1) CRIMSON (#C4182B / #FF3B4A) — warm, low, unstable, blood-lit. Comes from
     below or from the right. This is the vampire's light.
  2) TEAL (#35C9B4 / #8FF0DC) — cold, sacred candle-flame. Comes from above or
     from the left. This is the seal's light.
Everything untouched by either light falls to desaturated stone greys.
Rim-light key silhouettes so they read against #0B0710. Cast shadows are solid
#0B0710 or #16121C — never a soft blur.

OUTLINE POLICY:
Selective 1px outline. Silhouette-defining outer edges get a hard 1px outline in
a colour darker than the fill (#16121C for stone, #4A0710 for blood, #0E3B3A for
teal). Interior detail lines use colour-shift, not black. NEVER use pure black
(#000000) outlines. Never anti-alias the outline.

MOOD:
Ritualistic, solemn, oppressive. Silence before violence. Reverence for something
that should not be revered. Absolutely no whimsy, no cute, no comedy, no camp.

FORBIDDEN (hard constraints):
no text, no letters, no numbers, no runes that resemble real characters, no
watermark, no signature, no logo, no UI mockup chrome, no blur, no depth-of-field,
no bokeh, no motion blur, no anti-aliasing, no soft gradients, no airbrush,
no lens flare, no JPEG artifacts, no 3D render, no photorealism, no vector art,
no flat modern minimalism, no bright saturated colours outside the palette,
no orange, no purple, no green other than the specified teal, no cheerful
lighting, no white background unless explicitly requested, no drop shadows
outside the sprite, no bevel-emboss effects, no chromatic aberration.

TECHNICAL:
Render at high resolution but with LARGE, CLEARLY VISIBLE, SQUARE pixel blocks —
the image must survive a nearest-neighbour downscale to its target pixel size
without losing legibility. Think of it as a small sprite photographed large,
not a painting made blocky. Pixel grid must be perfectly axis-aligned and
uniform across the whole image.

=== END GLOBAL STYLE GUIDE ===
```

### 1.4 공통 네거티브 프롬프트

네거티브 프롬프트를 따로 받는 도구라면 이걸 쓴다.

```
text, letters, words, numbers, typography, watermark, signature, logo, caption,
UI mockup, browser chrome, blur, motion blur, depth of field, bokeh,
anti-aliasing, smooth gradient, airbrush, soft shading, lens flare, glow bloom,
3d render, cgi, photorealistic, photograph, vector, flat design, material design,
minimalism, cute, chibi, cartoon, comic, anime, kawaii, mascot, cheerful,
bright saturated colors, neon, orange, purple, lime green, yellow highlight,
white background, drop shadow, bevel, emboss, chromatic aberration,
jpeg artifacts, noise, grain, low contrast, washed out, muddy,
inconsistent pixel size, mixed pixel scale, non-square pixels,
extra limbs, deformed hands, distorted face, asymmetrical when symmetry required
```

---

## 2. 생성 목록과 프롬프트

### 우선순위 정의

| 등급 | 의미 |
|---|---|
| **MUST** | 없으면 **출시 불가**. Play 등록정보를 저장할 수 없거나 게임이 성립하지 않음 |
| **SHOULD** | 없으면 품질이 크게 떨어지지만 임시 대체 가능 |
| **COULD** | 시간이 남을 때만. 잘라도 무방 |

### 전체 인덱스

| # | 항목 | 우선순위 | 필요 시점 |
|---|---|---|---|
| A-01 | 앱 아이콘 (Play 512×512 / **iOS 1024 파생**) | **MUST** | Day 7 |
| A-02 | Android 적응형 아이콘 (전경/배경) | **MUST** | Day 4 |
| A-03 | 피처 그래픽 1024×500 | **MUST** | Day 7 |
| A-04 | 스플래시 화면 (가로, 다밀도) | SHOULD | Day 5 |
| A-05 | 게임 로고 타이포그래피 | **MUST** | Day 4 |
| A-06 | 타이틀 화면 배경 | **MUST** | Day 5 |
| A-07 | 녹턴 초상화 | **MUST** | Day 4 |
| A-08 | 계약서 카드 프레임 3종 | **MUST** | Day 3 |
| A-09 | 각성 인장 6종 | **MUST** | Day 4 |
| A-10 | 완전 흡혈귀화 인장 | SHOULD | Day 5 |
| A-11 | 결과 화면 배경 2종 | SHOULD | Day 5 |
| A-12 | 성소(Sanctum) 배경 | SHOULD | Day 5 |
| A-13 | UI 요소 세트 | **MUST** | Day 3 |
| A-14 | 가상 조이스틱 | **MUST** | Day 2 |
| A-15 | 스크린샷 오버레이 템플릿 | SHOULD | Day 6 |

> **A-16(itch.io 커버 630×500)은 삭제되었다.** itch.io가 배포 채널에서 전면 제외되어(2026-08-10 확정)
> 이 자산을 쓸 곳이 없어졌다. 인덱스·프롬프트·배치 스크립트·의뢰 일정·체크리스트에서 전부 제거했다.
> **630×500 규격을 다시 만들지 말 것.**

---

### A-01. 앱 아이콘 (Play 스토어용)

| 항목 | 값 |
|---|---|
| **용도** | Google Play 스토어 등록정보의 앱 아이콘 |
| **필요 크기** | **512 × 512 px** (생성은 1024×1024 → 512로 다운스케일) |
| **포맷** | 32비트 PNG (알파 포함), 1024 KB 이하 |
| **저장 경로** | `store/play/icon-512.png` / 원본 `store/_raw/icon-1024.png` |
| **iOS 파생** | `FE/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024, **알파 제거**) + `store/appstore/icon-1024.png` |
| **우선순위** | **MUST** |

> ⚠ Play 아이콘은 **정사각 전체가 보이며, 모서리는 스토어가 자동으로 둥글게 마스킹**한다.
> 따라서 **모서리 12%에 핵심 요소를 두면 안 된다.**
>
> ★ **iOS는 같은 원본을 쓰되 알파 채널이 있으면 업로드가 거부된다.** 프롬프트는 그대로 두고
> **후처리에서만 갈라진다**(§4.7). 이 항목의 생성 원본 `icon-1024.png` 하나가 Play 512와 iOS 1024를 모두 먹인다.
> iOS 모서리도 시스템이 스퀘어클로 마스킹하므로 **모서리 12% 규칙은 양 플랫폼 공통**이다.

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — APP ICON, single square emblem:

A heraldic seal viewed head-on, perfectly centred, perfectly symmetric on the
vertical axis. Square canvas 1024x1024.

Composition, back to front:
 1. Background: a rounded-square field of dark cathedral stone (#16121C to
    #2A2533), lit from the upper-left by a faint teal wash (#0E3B3A) and from
    the lower-right by a faint crimson wash (#4A0710). Subtle 1px-block
    dithering between the two washes. No visible bricks, no busy texture.
 2. Midground: a broken iron chain link, thick and heavy, rendered in stone
    greys (#4A4454 highlights, #16121C shadow), arcing across the lower third
    of the icon like a torn collar. One link is snapped open, its break edge
    catching crimson light (#C4182B).
 3. Foreground hero element: a stylised anatomical HEART, chunky and geometric,
    rendered in blood tones (#4A0710 shadow / #8B0F1D body / #C4182B light /
    #FF3B4A rim). Two thin BONE-WHITE (#C7C2CE) fangs pierce the heart from
    above, crossing in an X. From the two puncture points, two single fat
    droplets of blood fall.
 4. Behind the heart, a small TEAL candle flame (#35C9B4 core, #8FF0DC tip)
    burns, its light spilling around the heart's silhouette as a teal rim-light.
    The flame is mostly hidden by the heart — only the aura escapes.

Silhouette requirement: the heart + fangs shape must be instantly readable as a
black-and-white silhouette at 48x48 pixels.

Safety margin: keep ALL critical shapes inside the central 76% of the canvas.
The outer 12% on every side is decorative field only (it will be cropped by
rounded-corner masking).

Colour count: maximum 24 distinct colours.
No text of any kind.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + circle badge, app store frame, rounded corner outline drawn
into the image, glossy highlight, sticker outline, white border, gradient
background, realistic anatomy, gore detail, dripping mess, multiple hearts,
crowded composition, tiny details, thin lines under 3px
```

**수용 기준 체크리스트**
- [ ] 정확히 정사각. 알파 채널 있음(배경 투명이 아니라 **불투명 채워짐** — 아이콘은 배경이 있어야 함)
- [ ] 48×48로 축소했을 때 심장+송곳니가 무엇인지 알아볼 수 있다
- [ ] 팔레트 밖의 색(주황/보라/노랑)이 없다
- [ ] 모서리 12% 안에 핵심 요소가 없다
- [ ] 텍스트/워터마크 없음
- [ ] 픽셀 격자가 균일하다 (한 부분만 고해상도로 뭉개지지 않음)
- [ ] 청록·심홍 두 광원이 모두 보인다
- [ ] 512×512 PNG로 저장 시 1024 KB 이하

**재시도 조정 포인트** (한 번에 하나씩만)
1. 실루엣이 안 읽힘 → `"Simplify: remove the chain entirely. Heart and two fangs only."`
2. 너무 복잡함 → `"Reduce to maximum 16 colours. Remove the candle flame, keep only teal rim-light."`
3. 픽셀이 안 보임 → `"Make each pixel block at least 16x16 screen pixels. Extreme chunky pixel art."`
4. 색이 튐 → 팔레트 목록을 프롬프트 **맨 끝에 한 번 더** 반복해 붙인다
5. 대칭이 깨짐 → `"Perfectly mirror-symmetric about the vertical centre axis."`
6. 심장이 리얼함 → `"Iconographic, heraldic heart — a symbol, not an organ."`

---

### A-02. Android 적응형 아이콘 (전경/배경 분리)

| 항목 | 값 |
|---|---|
| **용도** | Android 8.0+ 런처 아이콘 (`mipmap-anydpi-v26/ic_launcher.xml` 이 참조) |
| **필요 크기** | 전경·배경 각각 **108 dp 정사각**. 실제 PNG는 밀도별로 아래 표 |
| **저장 경로** | `FE/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` 외 |
| **우선순위** | **MUST** (Day 4 — 폰 런처에서 앱을 찾으려면 필요) |

**현재 스캐폴드에 존재하는 파일 크기 (실측, 이 크기 그대로 교체)**

| 밀도 | `ic_launcher_foreground.png` | `ic_launcher.png` / `ic_launcher_round.png` |
|---|---|---|
| mdpi | 108 × 108 | 48 × 48 |
| hdpi | 162 × 162 | 72 × 72 |
| xhdpi | 216 × 216 | 96 × 96 |
| xxhdpi | 324 × 324 | 144 × 144 |
| xxxhdpi | **432 × 432** | 192 × 192 |

배경은 현재 `drawable/ic_launcher_background.xml` (벡터) + `values/ic_launcher_background.xml` (색) 로 되어 있다.
→ **가장 간단한 방법: 배경 XML의 색만 `#0B0710` 으로 바꾸고, 전경 PNG만 생성한다.**

**⚠ 적응형 아이콘 안전 영역 규칙 (Android 표준)**
```
108dp 전체 캔버스
 └ 중앙 72dp 만 항상 보인다 (바깥 18dp는 런처 마스크/시차 효과로 잘림)
   └ 원형 마스크를 감안하면 핵심 요소는 중앙 66dp 지름 원 안에

→ 432px 캔버스 기준: 핵심 요소를 중앙 264px(약 61%) 원 안에 넣는다.
```

**영어 프롬프트 전문 — 전경(foreground)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — ANDROID ADAPTIVE ICON FOREGROUND LAYER:

Square canvas 1024x1024 with a FULLY TRANSPARENT background (alpha 0).
Only the emblem is drawn; there is no background plate, no field, no frame.

The emblem: the same heraldic device as the BLOODSWORN app icon —
a chunky geometric anatomical HEART in blood tones (#4A0710 / #8B0F1D /
#C4182B / #FF3B4A rim) pierced by two crossing BONE-WHITE (#C7C2CE) fangs
forming an X, with a teal (#35C9B4) glow escaping from behind the heart's
silhouette as a rim-light.

CRITICAL SIZING RULE:
All essential shapes must fit inside a centred circle of 620px diameter
(i.e. ~61% of the 1024px canvas). Everything outside that circle will be
cropped by the launcher mask. Do not let the fangs, droplets, or glow extend
beyond it. Leave the outer ~20% of the canvas completely empty and transparent.

The emblem is bolder and simpler than the store icon: thicker forms, fewer
interior details, higher contrast, because it will be displayed as small as
48x48 pixels on a launcher.

Transparent PNG with clean hard alpha edges — no semi-transparent halo, no
feathered alpha, no glow bleeding into transparency. Alpha must be strictly
binary (0 or 255) at the sprite boundary.

Maximum 16 distinct colours.
No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + background plate, colored background, square frame, circle
frame, badge, checkerboard pattern, semi-transparent edges, feathered alpha,
soft glow into transparency, drop shadow, elements touching canvas edge
```

**수용 기준**
- [ ] 배경이 **완전 투명**(체커보드 패턴이 그려져 있으면 안 됨)
- [ ] 핵심 요소가 중앙 61% 원 안에 전부 들어옴 → **원형 마스크 시뮬레이션으로 확인** (§4.5)
- [ ] 알파 경계가 이진(반투명 후광 없음)
- [ ] 48×48 축소 시 형태가 읽힘
- [ ] 5개 밀도 전부로 export 완료

**재시도 조정 포인트**
1. 요소가 잘림 → `"Shrink the emblem to 50% of canvas width, centred."`
2. 반투명 후광 → `"Hard binary alpha only. No glow, no soft edge, no antialiasing on the alpha channel."`
3. 배경이 생김 → `"TRANSPARENT background. Output PNG with alpha channel. Nothing but the emblem."`
4. 너무 디테일함 → `"Simplify for 48x48 display: 4 tones per colour ramp maximum."`

**적용 명령 (ImageMagick, Git Bash)**
```bash
RES="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/FE/android/app/src/main/res"
SRC="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store/_raw/icon-fg-1024.png"

for pair in "mdpi:108" "hdpi:162" "xhdpi:216" "xxhdpi:324" "xxxhdpi:432"; do
  d="${pair%%:*}"; s="${pair##*:}"
  magick "$SRC" -filter point -resize "${s}x${s}" \
    "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# 레거시 런처용 합성 아이콘 (배경색 + 전경 축소 합성)
for pair in "mdpi:48" "hdpi:72" "xhdpi:96" "xxhdpi:144" "xxxhdpi:192"; do
  d="${pair%%:*}"; s="${pair##*:}"
  magick -size "${s}x${s}" "xc:#0B0710" \
    \( "$SRC" -filter point -resize "$((s*61/100))x$((s*61/100))" \) \
    -gravity center -composite \
    "$RES/mipmap-$d/ic_launcher.png"
  magick "$RES/mipmap-$d/ic_launcher.png" \
    \( -size "${s}x${s}" xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),0" \) \
    -alpha set -compose DstIn -composite \
    "$RES/mipmap-$d/ic_launcher_round.png"
done
```
`FE/android/app/src/main/res/values/ic_launcher_background.xml` 도 바꾼다:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B0710</color>
</resources>
```
> ⚠ `drawable/ic_launcher_background.xml` 이 벡터 드로어블이라면 위 색 리소스를 참조하지 않을 수 있다.
> 그 경우 `mipmap-anydpi-v26/ic_launcher.xml` 의 `<background>` 를
> `android:drawable="@color/ic_launcher_background"` 로 바꾸는 편이 확실하다.

---

### A-03. 피처 그래픽 (1024 × 500)

| 항목 | 값 |
|---|---|
| **용도** | Play 스토어 상단 배너. 스토어 등록정보 필수 자산 |
| **필요 크기** | **1024 × 500 px** (생성은 2048×1000 → 다운스케일) |
| **포맷** | **JPEG 또는 24비트 PNG — 알파 채널 금지** |
| **저장 경로** | `store/play/feature-1024x500.png` |
| **우선순위** | **MUST** |

> ⚠ **피처 그래픽 중앙에는 Play가 재생 버튼/기기 프레임을 겹칠 수 있다.**
> 핵심 요소를 정중앙에 두지 말고 **좌측 1/3에 로고, 우측 2/3에 장면**으로 배치한다.

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — WIDE STORE BANNER, 2048x1000 (2:1 landscape, will be scaled to 1024x500):

A single wide cinematic pixel-art scene: the interior of a sealed crypt at the
moment the seal breaks.

LAYOUT (left to right):
 - LEFT THIRD: negative space. Deep void (#0B0710) fading up into stone shadow
   (#16121C). Deliberately kept empty and dark — a logo will be composited here
   later. Only a faint teal glow bleeds in from the right edge of this zone.
 - CENTRE: a lone armoured knight seen from behind in three-quarter view,
   small in frame (occupying about 22% of the image height), standing before a
   tall guttering TEAL candle on a stone pedestal. The knight is a dark
   silhouette rimmed in teal (#35C9B4) on her left side and in crimson
   (#C4182B) on her right. Her sword is planted point-down in the flagstones.
   She is not heroic; she is exhausted and barely upright.
 - RIGHT THIRD: an immense broken IRON CHAIN, thick as a man's arm, hanging
   from darkness above and snapped mid-length. Crimson light (#8B0F1D /
   #C4182B) pours upward from below the break, silhouetting a mass of clawing
   undead hands and hunched shapes crowding in from the right edge — read as
   silhouette only, no individual monster detail.

ATMOSPHERE:
Two opposed light sources define the whole frame: cold teal from the candle on
the left-of-centre, hot crimson from the breach on the right. Where they meet,
a vertical band of neutral stone grey. Floating dust motes as single lit pixels,
sparse. Deep vignette to #0B0710 on all four edges.

COMPOSITION RULES:
 - Horizon / floor line at roughly 72% down the frame.
 - Keep the CENTRAL 30% of the frame free of critical detail (a store UI element
   may overlay it).
 - The image must still read at 1024x500 and as a 400px-wide thumbnail.

Maximum 32 distinct colours. Strong pixel-art dithering for the light falloff.
No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + large character portrait, close-up face, centered subject,
title screen layout, empty right side, symmetrical composition, daylight,
outdoor scene, forest, sky, clouds, modern architecture, readable monster
anatomy, gore, dismemberment, blood splatter on camera
```

**수용 기준**
- [ ] 정확히 2:1 비율, 알파 채널 **없음**
- [ ] 좌측 1/3이 로고를 얹을 만큼 비어 있고 어둡다
- [ ] 중앙 30%에 핵심 요소가 없다
- [ ] 청록/심홍 두 광원이 좌우로 명확히 분리되어 대비를 이룬다
- [ ] 400px 폭 썸네일로 줄여도 "촛불 앞의 기사 + 부서진 사슬"이 읽힌다
- [ ] 텍스트 없음 (로고는 §A-05를 후합성)

**재시도 조정 포인트**
1. 중앙이 복잡 → `"Move the knight left, to 38% from the left edge. Empty the centre."`
2. 두 광원이 안 갈림 → `"Increase separation: pure teal only on the left half, pure crimson only on the right half. A hard neutral seam in the middle."`
3. 기사가 너무 큼 → `"The knight occupies only 18% of image height. This is an environment shot, not a character shot."`
4. 좌측이 안 비어 있음 → `"The leftmost 33% is pure void #0B0710 with nothing in it."`
5. 몹이 너무 자세함 → `"Undead are pure black silhouettes with crimson rim-light only. Zero interior detail."`

---

### A-04. 스플래시 화면 (가로, 다밀도)

| 항목 | 값 |
|---|---|
| **용도** | Android 앱 시작 시 WebView 로딩 전 표시 |
| **필요 크기** | 밀도별 (현 스캐폴드 실측값 그대로) |
| **저장 경로** | `FE/android/app/src/main/res/drawable-land-*/splash.png` |
| **우선순위** | SHOULD |

**교체 대상 파일 (실측)**

| 리소스 폴더 | 크기 |
|---|---|
| `drawable/` (기본) | 480 × 320 |
| `drawable-land-mdpi/` | 480 × 320 |
| `drawable-land-hdpi/` | 800 × 480 |
| `drawable-land-xhdpi/` | 1280 × 720 |
| `drawable-land-xxhdpi/` | 1600 × 960 |
| `drawable-land-xxxhdpi/` | **1920 × 1280** |
| `drawable-port-*/` | (세로 5종) — **가로 고정 앱이므로 `#0B0710` 단색으로 채워두면 충분** |

> ⚠ 가로 밀도들의 비율이 제각각이다 (3:2, 5:3, 16:9, 5:3, 3:2).
> **따라서 스플래시는 "중앙 정렬 + 사방 여백" 구도여야 한다.** 가장자리까지 차는 장면을 그리면 밀도마다 잘린다.
> 스플래시 표시 방식은 `styles.xml` 의 `android:background="@drawable/splash"` 이며, 기본은 늘려서 채운다.

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — LANDSCAPE SPLASH / LOADING SCREEN, 1920x1280:

An almost-empty ceremonial image. This is shown for under two seconds, so it
must be instantly legible and utterly still.

 - Background: a flat field of void #0B0710 filling the entire canvas edge to
   edge. Absolutely uniform at the borders — no vignette artefacts, no visible
   frame, no texture at the edges.
 - Dead centre: a single tall TEAL candle (#1E7E74 body, #35C9B4 flame core,
   #8FF0DC flame tip) standing upright, its flame perfectly vertical and still.
   The candle occupies about 26% of the image height, centred both horizontally
   and vertically.
 - The flame casts a soft circular pool of teal light on the darkness around it,
   rendered as 4 concentric dithered rings of #0E3B3A stepping outward, fading
   to void by 34% of the image width. Ordered/Bayer dithering only — hard
   pixel steps, no smooth falloff.
 - Beneath the candle, a low stone pedestal in two tones (#2A2533 body,
   #16121C shadow), very simple, only 3 pixel-rows tall in sprite terms.
 - Behind and around, in near-void tones only barely distinguishable from the
   background (#16121C), the suggestion of hanging chains and crypt arches.
   These must be almost invisible — atmosphere, not subject.
 - A single small crimson (#8B0F1D) glint at the extreme lower-right, tiny,
   like an eye. Nothing else is crimson.

CRITICAL COMPOSITION RULE:
All meaningful content lives inside the central 50% of the canvas
(both axes). The outer band is pure #0B0710 so the image can be cropped or
stretched to 3:2, 5:3, and 16:9 without losing anything.

Maximum 16 distinct colours. No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + loading bar, progress bar, spinner, percentage, busy
composition, full-bleed scene, characters, monsters, action, multiple candles,
bright scene, edge decoration, border frame, corner ornament
```

**수용 기준**
- [ ] 사방 25% 테두리가 순수 `#0B0710` 단색이다 → 어떤 비율로 잘라도 안전
- [ ] 촛불이 정확히 중앙
- [ ] 디더링이 부드러운 그라디언트가 아니라 계단식 픽셀이다
- [ ] 5개 밀도 전부로 export 완료
- [ ] 실기기에서 앱 실행 시 흰 플래시 없이 이 화면이 뜬다

**재시도 조정 포인트**
1. 가장자리가 안 비어 있음 → `"Outer 30% margin on all sides is pure flat #0B0710. Nothing there."`
2. 그라디언트가 부드러움 → `"Bayer 4x4 ordered dithering only. Visible dither dots. No smooth gradient."`
3. 너무 밝음 → `"Overall image is 85% near-black. The candle is the only light."`

**적용 명령**
```bash
RES="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/FE/android/app/src/main/res"
SRC="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store/_raw/splash-1920x1280.png"

# 가로 밀도 — 중앙 크롭 후 리사이즈 (^ 는 fill, 그 뒤 gravity center extent로 크롭)
declare -A LAND=( [mdpi]=480x320 [hdpi]=800x480 [xhdpi]=1280x720 [xxhdpi]=1600x960 [xxxhdpi]=1920x1280 )
for d in "${!LAND[@]}"; do
  magick "$SRC" -filter point -resize "${LAND[$d]}^" \
    -gravity center -extent "${LAND[$d]}" "$RES/drawable-land-$d/splash.png"
done
magick "$SRC" -filter point -resize "480x320^" -gravity center -extent 480x320 "$RES/drawable/splash.png"

# 세로 밀도 — 가로 고정 앱이므로 단색으로 대체
declare -A PORT=( [mdpi]=320x480 [hdpi]=480x800 [xhdpi]=720x1280 [xxhdpi]=960x1600 [xxxhdpi]=1280x1920 )
for d in "${!PORT[@]}"; do
  magick -size "${PORT[$d]}" "xc:#0B0710" "$RES/drawable-port-$d/splash.png"
done
```

---

### A-05. 게임 로고 타이포그래피

| 항목 | 값 |
|---|---|
| **용도** | 타이틀 화면 / 피처 그래픽 합성 / 스크린샷 오버레이 |
| **필요 크기** | **2048 × 768** 생성 → 게임용 `512 × 192`, 배너용 `760 × 285` 등으로 다운스케일 |
| **저장 경로** | `FE/public/img/ui/logo.png` (게임용) / `store/_raw/logo-2048.png` (원본) |
| **우선순위** | **MUST** |

> 🔴 **이 항목만은 "텍스트 금지" 규칙의 예외다.** 그리고 **이미지 생성기가 가장 자주 실패하는 항목**이기도 하다.
> 영문 `BLOODSWORN` 9글자는 성공 가능성이 있지만, **한글 「피의 서약」은 거의 확실히 깨진다.**
>
> **권장 전략 (2단계):**
> 1. Codex에는 **영문 `BLOODSWORN` 로고와 장식 프레임만** 의뢰한다.
> 2. 한글 「피의 서약」은 **한글 픽셀 폰트로 게임/이미지 편집기에서 직접 얹는다.**
>    (예: 둥근모꼴, DungGeunMo, Galmuri 등 픽셀 한글 폰트 — 라이선스 확인 필요)
> 만약 Codex가 한글을 정확히 그려내면 그건 보너스다. 기대하지 말 것.

**영어 프롬프트 전문 (1차 — 영문 로고)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — GAME LOGO WORDMARK, 2048x768, FULLY TRANSPARENT BACKGROUND:

This is one of the very few images where TEXT IS REQUIRED AND MUST BE EXACT.

Render exactly this single word, spelled precisely, all uppercase, one line:

    BLOODSWORN

Ten letters: B L O O D S W O R N. No other word. No subtitle. No tagline.
Do not invent extra letters. Do not repeat letters. Verify the spelling.

LETTERFORM DESIGN:
Heavy condensed gothic blackletter-influenced pixel type — but built on a strict
pixel grid, not a smooth font. Think of a 16-bit RPG title logo carved from
iron. Tall, narrow capitals with:
 - thick vertical stems (at least 6 pixel-units wide in sprite terms)
 - sharp angular serifs that taper to points, like fang tips
 - the two O's in BLOOD are slightly wider and rounder than the rest, reading
   almost as heavy iron rings
 - the letters sit tightly kerned, nearly touching, forming one solid mass

COLOUR TREATMENT (top-to-bottom ramp on each letter):
 - top edge / bevel highlight : bone #C7C2CE
 - upper body                 : neutral grey #9A94A3
 - lower body                 : stone #4A4454
 - bottom edge                : stone shadow #16121C
 - hard 1px outline all around: #0B0710

BLOOD OVERLAY:
Blood (#8B0F1D body, #C4182B highlight) wells up from the BOTTOM of the letters
and climbs about 35% of their height, with an uneven dithered boundary — as if
the metal is being submerged. Three or four single fat droplets hang from the
lowest points of the letters, each a clean 3-4 pixel shape, mid-fall.

TEAL ACCENT:
A cold teal (#35C9B4) rim-light on the LEFT edge of every letter, one pixel
wide. This is the only teal in the image and it must be present.

FRAMING ORNAMENT:
A thin horizontal ornamental rule above and below the word, made of a simple
chain-link motif in stone grey, tapering to nothing at both ends. The rules do
not touch the letters. Leave a clear empty band of at least 100 transparent
pixels below the lower rule (Korean subtitle text will be composited there
later — leave it EMPTY).

Background: fully transparent (alpha 0). Hard binary alpha at all edges.
Maximum 20 distinct colours.
```

**네거티브 프롬프트 (로고 전용 — 매우 중요)**
```
[COMMON NEGATIVE minus "text, letters, words, typography"] +
misspelled text, extra letters, missing letters, duplicated letters, gibberish
text, random glyphs, fake runes, secondary text, subtitle, tagline, byline,
copyright notice, studio name, "the", lowercase letters, mixed case, script
font, handwriting, smooth vector font, sans-serif, arial, helvetica, modern
font, calligraphy brush, 3d extrusion, chrome effect, gold effect, neon glow,
outer glow, background plate, solid background, colored backdrop
```

**수용 기준**
- [ ] **철자가 정확히 `BLOODSWORN`** — 한 글자씩 소리 내어 확인할 것
- [ ] 배경 완전 투명
- [ ] 하단에 한글을 얹을 빈 밴드가 100px 이상 확보됨
- [ ] 왼쪽 림라이트가 청록으로 들어가 있다
- [ ] 512×192로 줄여도 글자가 뭉개지지 않고 읽힌다
- [ ] 부제/태그라인 등 추가 텍스트가 없다

**재시도 조정 포인트**
1. **철자가 틀림** (가장 흔함) → `"The word is exactly ten letters: B-L-O-O-D-S-W-O-R-N. Spell it letter by letter. Nothing else on the canvas."`
2. 추가 텍스트가 생김 → `"ONE WORD ONLY. Delete every other text element. No subtitle, no tagline, no small print."`
3. 글자가 흐릿함 → `"Chunky pixel letterforms with visible square pixels, minimum 12 screen pixels per sprite pixel."`
4. 폰트가 현대적 → `"Blackletter / gothic / medieval iron plate style. Not a modern typeface."`
5. 3회 이상 실패 시 → **포기하고 픽셀 폰트로 직접 조판한다.** 로고 하나에 하루를 쓰지 않는다.
   Codex에는 대신 `"ornamental frame only, no text, leave the centre empty"` 로 **장식 프레임만** 받고 글자는 직접 넣는다.

**한글 병기 합성 명령 (ImageMagick)**
```bash
# 픽셀 한글 폰트(예: DungGeunMo.ttf)를 시스템에 설치한 뒤
magick "store/_raw/logo-2048.png" \
  -gravity south -font "DungGeunMo" -pointsize 120 \
  -fill "#C9B792" -stroke "#0B0710" -strokewidth 4 \
  -annotate +0+60 "피 의  서 약" \
  -filter point -resize 512x \
  "FE/public/img/ui/logo.png"
```
> `-filter point` 는 **모든 픽셀아트 리사이즈에서 필수**다. 빼면 흐려진다. (§4.2)

---

### A-06. 타이틀 화면 배경

| 항목 | 값 |
|---|---|
| **용도** | React 타이틀 화면 배경 (정본 `03-GDD-CORE.md` §10 React 레이어) |
| **필요 크기** | **논리 640 × 360.** 생성은 1920×1080 → 정수배 1/3 다운스케일 |
| **저장 경로** | `FE/public/img/bg/title.png` (640×360) / 원본 `store/_raw/bg-title-1920.png` |
| **우선순위** | **MUST** |

> **왜 1920×1080인가:** 640×360의 정확한 3배다. 정수배 다운스케일만이 픽셀을 깨끗하게 유지한다.
> 1600×900(2.5배) 같은 크기로 생성하면 다운스케일에서 픽셀이 뭉개진다. **반드시 1920×1080.**

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — TITLE SCREEN BACKGROUND, 1920x1080 (16:9, will be downscaled x1/3 to 640x360):

The Sealed Tomb beneath Carnac Abbey, seen as a wide, still, symmetrical
establishing shot. A place of vigil.

 - Deep background: a vast vaulted crypt receding into blackness. Gothic ribbed
   arches in stone tones (#16121C in shadow, #2A2533 lit, #4A4454 on edges)
   recede in one-point perspective toward a vanishing point at the exact
   horizontal centre, about 55% down the frame.
 - Vanishing point: a massive stone SARCOPHAGUS wrapped in enormous iron chains,
   half swallowed by darkness. Between the chains, a single thin seam of crimson
   light (#C4182B) leaks out, as if something inside is awake. This is the only
   crimson light source and it is small.
 - Foreground left and right: two tall TEAL sacred candles (#1E7E74 wax,
   #35C9B4 flame, #8FF0DC tip) on stone pedestals, framing the shot like
   proscenium pillars. They are the dominant light. Their glow is rendered as
   concentric dithered rings of #0E3B3A.
 - Floor: worn stone flagstones in receding perspective, with faint teal
   reflections beneath the candles and a faint crimson reflection along the
   centre line leading to the sarcophagus.
 - Ceiling: lost in void #0B0710. Hanging chains descend from it and disappear
   upward out of frame.
 - Air: sparse single-pixel dust motes lit teal, drifting.

COMPOSITION FOR UI:
 - Keep the UPPER-CENTRE 45% width x 30% height region visually quiet and dark
   (the logo will sit there).
 - Keep the LOWER-CENTRE 40% width x 35% height region visually quiet and dark
   (menu buttons will sit there).
 - The interesting detail lives in the left and right thirds and along the
   centre seam.
 - Overall the image must read as at least 70% near-black. This is a menu
   backdrop, not a hero illustration — it must never compete with UI text.

Perfect bilateral symmetry about the vertical centre axis, broken only by small
asymmetric details (a fallen candle, a cracked flagstone) so it does not look
mechanical.

Maximum 32 distinct colours. Heavy ordered dithering in all light falloff.
No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + characters, people, monsters, action, bright scene,
daylight, windows with light, outdoor, sky, colourful stained glass, busy
foreground, high contrast centre, competing focal points, asymmetric layout,
fisheye, dutch angle
```

**수용 기준**
- [ ] 정확히 16:9 (1920×1080)
- [ ] 상단 중앙·하단 중앙이 어둡고 조용하다 (로고/버튼이 얹힐 자리)
- [ ] 전체적으로 70% 이상이 near-black — UI 텍스트가 읽힐 것
- [ ] 좌우 대칭이되 완전 기계적이지는 않다
- [ ] 청록(촛불) 2 + 심홍(석관 틈) 1 광원 구성이 지켜짐
- [ ] 1/3 다운스케일 후에도 아치 구조가 읽힌다

**재시도 조정 포인트**
1. 중앙이 밝아 UI가 안 읽힘 → `"Darken the central column by 40%. The candles on the left and right are the only bright areas."`
2. 원근이 없음 → `"Strict one-point perspective. All arch lines converge on a single vanishing point at the horizontal centre."`
3. 심홍이 너무 많음 → `"The crimson leak is a single thin seam, less than 2% of the image area."`
4. 640×360으로 줄이면 뭉개짐 → `"Larger, simpler pixel blocks. Fewer, bolder shapes. This will be viewed at 640x360."`

---

### A-07. 녹턴 초상화

| 항목 | 값 |
|---|---|
| **용도** | PACT 카드 화면의 화자 초상 (정본 `01-CONCEPT` §5.2 "초상화 1장만 필요") |
| **필요 크기** | **논리 128 × 160 (반신).** 생성은 768×960 → 1/6 다운스케일 (정수배) |
| **저장 경로** | `FE/public/img/portrait/nocturne.png` |
| **우선순위** | **MUST** |

> 정본 캐릭터 규정: 태초의 흡혈귀. **적이 아니라 동업자.** 대사 톤은 "정중하고 다정하며 소름끼침".
> 천 년째 사슬에 묶여 있다. **위협적이지 않게, 편안하게, 그래서 더 무섭게.**

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — CHARACTER PORTRAIT, 768x960 (4:5 portrait), FULLY TRANSPARENT BACKGROUND:

NOCTURNE — the first vampire. Bust / half-body, facing three-quarters toward
the viewer's left, head slightly tilted, chin a fraction lowered so the eyes
look up at you. Waist up, cut off cleanly at the bottom edge.

He is NOT a snarling monster. He is a courteous, exhausted, deeply amused
aristocrat who has been chained in a tomb for a thousand years and finds the
situation mildly funny. Read him as a business partner, not a boss fight.

FACE:
 - Gaunt, high-cheekboned, ageless. Skin in cold bone tones (#C7C2CE highlight,
   #9A94A3 midtone, #4A4454 shadow) — corpse-pale, not grey-green.
 - Eyes: two small but unmistakable points of crimson (#FF3B4A core,
   #C4182B halo). Half-lidded. This is the focal point of the whole image and
   must survive downscaling — make the eyes at least 3x3 sprite pixels each.
 - Mouth: closed, one corner lifted a few pixels. A private smile. Fangs are
   NOT visible; the restraint is the point.
 - Hair: long, straight, black-void (#0B0710 with #16121C strands), falling past
   the shoulders, partly across one side of the face.

BODY:
 - High-collared ecclesiastical/aristocratic coat in near-black (#16121C body,
   #2A2533 folds), with tarnished silver clasps (#9A94A3) and thin blood-red
   piping (#8B0F1D) along the collar edge.
 - Around the neck and one wrist: heavy iron manacles (#4A4454 / #16121C) with
   a few links of chain trailing off and fading into transparency at the image
   edge. He wears them like jewellery.
 - Posture relaxed, one shoulder lower. Not tense.

LIGHTING:
Lit from BELOW-RIGHT by crimson (#8B0F1D rim along the right jawline, right
shoulder, right chain links) and from ABOVE-LEFT by weak teal (#1E7E74 rim on
the left cheekbone, left shoulder, hair edge). Between the two rims the form
falls to near-void — the silhouette is carried entirely by rim-light.

Background: FULLY TRANSPARENT (alpha 0), hard binary alpha edges. No backdrop,
no vignette, no glow bleeding into transparency.

Maximum 24 distinct colours. No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + snarling, open mouth, visible fangs, bared teeth, angry
expression, aggressive pose, bat wings, cape flourish, dracula cliche, red
cloak, monster face, gore, blood on face, muscular, heroic pose, anime style,
bishonen, handsome idol, glowing aura, background, backdrop, frame, border,
full body, legs, hands raised, dynamic action pose
```

**수용 기준**
- [ ] 배경 완전 투명
- [ ] 128×160으로 줄여도 **붉은 눈 두 점**이 명확히 보인다 (이게 캐릭터의 전부다)
- [ ] 이빨을 드러내고 있지 않다 — 정중하고 나른한 인상
- [ ] 사슬/족쇄가 보인다 (봉인된 존재라는 정보)
- [ ] 청록·심홍 양쪽 림라이트가 다 있다
- [ ] 카드 화면 좌측에 배치했을 때 카드 3장을 가리지 않는 폭이다

**재시도 조정 포인트**
1. 너무 공격적 → `"Calm, amused, half-lidded. He is bored and polite. Absolutely no snarl."`
2. 눈이 안 보임 → `"The two crimson eyes are the single most important element. Make them larger and brighter than anything else."`
3. 배경이 생김 → `"Transparent PNG. Only the character. No backdrop of any kind."`
4. 드라큘라 클리셰 → `"No cape, no widow's peak, no high vampire collar flare. Think of a chained cardinal, not Dracula."`
5. 축소 시 얼굴이 뭉개짐 → `"Design for 128x160 final size. Bold, simple facial features. Fewer tones on the face."`

---

### A-08. 계약서 카드 프레임 3종 (Common / Rare / Epic)

| 항목 | 값 |
|---|---|
| **용도** | PACT 카드 3장의 프레임 (정본 `04-PACT-SYSTEM.md` §1, §3) |
| **필요 크기** | **논리 160 × 240 (2:3).** 생성은 640×960 → 1/4 다운스케일 |
| **저장 경로** | `FE/public/img/ui/card-common.png` / `card-rare.png` / `card-epic.png` |
| **우선순위** | **MUST** |

> **9-slice 요건:** 카드 내용의 길이가 다르므로 세로로 늘어날 수 있어야 한다.
> → **테두리 장식은 상하좌우 가장자리 32px(논리 8px) 안에만** 두고, 중앙은 **균일한 양피지 텍스처**로 채운다.
> 코너 장식은 코너에만, 변 장식은 **반복 가능한 패턴**으로.

**영어 프롬프트 전문 (템플릿 — `{{RARITY}}` 부분만 바꿔 3회 생성)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — CONTRACT CARD FRAME, 640x960 (2:3 portrait), 9-SLICE READY:

An empty medieval CONTRACT / indenture, presented as a game card frame.
The card is a sheet of aged parchment sealed with wax and bound in metal.
It is a legal document, not a fantasy trading card.

STRUCTURE (this is a UI frame — the interior must stay EMPTY):
 - Interior fill: aged parchment. Base #C9B792, with sparse mottling in #8A7A57
   and highlights in #E8DCC0. The mottling must be a UNIFORM, TILEABLE, LOW-
   CONTRAST texture across the entire interior — no focal stains, no large
   blotches, no illustration, no writing. It will be tiled/stretched vertically.
 - Border: a metal frame occupying only the outer 5% of the card on every side.
   Thin, flat, made of hammered {{METAL}}. Simple repeating motif along the
   straight edges so it can tile vertically.
 - Corners: four small identical corner ornaments, mirror-symmetric, each fitting
   inside a 90x90 pixel corner box. Do not let corner ornaments extend along the
   edges beyond that box.
 - Bottom centre: a WAX SEAL in {{SEAL_COLOUR}}, a circle roughly 110px across,
   pressed with an abstract sigil (a chain link crossed by a fang). It overlaps
   the bottom border and hangs slightly below the frame line.
 - Top centre: a small notch/tab in the frame where a rarity gem sits — a single
   faceted gem in {{GEM_COLOUR}}, about 44px across, with a hard 2-tone facet
   cut, no gradient.
 - Parchment edges: very slightly torn/uneven where the parchment meets the
   metal frame, in #8A7A57.

{{RARITY_TREATMENT}}

CRITICAL 9-SLICE CONSTRAINTS:
 - Everything decorative lives in the outer 5% margin or in the four 90x90 corner
   boxes. The central region (inset 60px from every side) contains ONLY the flat
   tileable parchment texture.
 - The left and right borders must be identical mirror images.
 - The straight sections of the top and bottom borders must be horizontally
   tileable.

Background OUTSIDE the card: fully transparent (alpha 0). The card has slightly
rounded corners with hard, binary alpha — no soft shadow, no glow.

No text. No writing on the parchment. No illustration inside the card.
Maximum 24 distinct colours.
```

**등급별 치환값**

| 토큰 | Common | Rare | Epic |
|---|---|---|---|
| `{{METAL}}` | `dull pewter (#4A4454 body, #7B7488 highlight, #16121C shadow)` | `tarnished silver with teal patina (#4A4454 body, #C7C2CE highlight, #1E7E74 patina in the recesses)` | `blackened iron with crimson inlay (#16121C body, #4A4454 highlight, #8B0F1D inlay lines)` |
| `{{SEAL_COLOUR}}` | `dull grey-brown wax (#8A7A57 body, #9A94A3 highlight)` | `deep teal wax (#0E3B3A body, #1E7E74 highlight)` | `dark crimson wax (#4A0710 body, #8B0F1D highlight, #C4182B rim)` |
| `{{GEM_COLOUR}}` | `neutral grey #9A94A3 with #C7C2CE facet` | `teal #1E7E74 with #35C9B4 facet` | `crimson #8B0F1D with #C4182B facet` |
| `{{RARITY_TREATMENT}}` | `RARITY: COMMON — plain, worn, unremarkable. No ornament beyond the four corner pieces. The parchment is the most yellowed and stained of the three. Nothing glows.` | `RARITY: RARE — one extra thin teal (#1E7E74) inner rule line running just inside the metal frame, 3px wide, unbroken. Faint teal (#0E3B3A) glow in the metal recesses only. The parchment is cleaner and paler.` | `RARITY: EPIC — the metal frame is thicker and heavier. A crimson (#8B0F1D) inner rule line just inside the frame. Thin hairline cracks run through the metal, glowing crimson (#C4182B) from within, as if the frame is barely containing something. Two small chain fragments hang from the bottom corners. The parchment is the palest and is faintly stained crimson at the very bottom edge, seeping upward about 6% of the card height.` |

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + written text, calligraphy, handwriting, signature lines,
illustration inside the card, character art, item art, icon in the centre,
large central ornament, asymmetric border, ornate filigree covering the whole
card, playing card suit symbols, trading card layout, stat boxes, mana cost,
rounded modern card, glassmorphism, drop shadow outside the card, background
plate
```

**수용 기준**
- [ ] 3종이 **같은 프레임 구조**를 공유하고 금속/밀랍/보석 색만 다르다 (일관성)
- [ ] 카드 내부 중앙에 그림·글씨가 전혀 없다 (텍스트는 게임이 렌더)
- [ ] 좌우 테두리가 완전 대칭 → 9-slice 가능
- [ ] 코너 장식이 코너 박스를 벗어나지 않음
- [ ] 배경 투명, 알파 경계가 이진
- [ ] 160×240으로 줄여도 등급이 색으로 구분된다
- [ ] Epic이 확실히 "더 위험해 보인다" (정본: 강한 축복 = 무거운 대가)

**재시도 조정 포인트**
1. 내부에 그림이 생김 → `"The interior is EMPTY parchment texture only. This is a UI frame, not an illustration."`
2. 9-slice 불가 → `"All ornament must live within 5% of the outer edge. The centre 90% is flat tileable texture."`
3. 3종이 서로 안 닮음 → 첫 성공본(Common)을 레퍼런스 이미지로 첨부하고 `"Same frame geometry, different metal and seal colour only."`
4. 등급 구분이 약함 → `"Epic must be visibly heavier and more dangerous. Increase frame thickness by 50% and add the glowing cracks."`
5. 밀랍 인장이 너무 큼 → `"Wax seal diameter is 15% of card width, no more."`

---

### A-09. 각성 인장 6종

| 항목 | 값 |
|---|---|
| **용도** | 각성 발동 연출의 중앙 인장 + 각성 도감 + 플레이어 오라 색 기준 (정본 `04-PACT-SYSTEM.md` §5.2-③) |
| **필요 크기** | **128 × 128 px** 각각. 생성은 1024×1024 → 1/8 다운스케일 |
| **저장 경로** | `FE/public/img/seal/seal-frail.png` 등 6개 |
| **우선순위** | **MUST** |

> 정본 §5.2: 각성 연출은 **"이 연출에 하루의 1/4를 써도 아깝지 않다. 이게 게임의 대표 스크린샷이 된다."**
> → 인장 6종은 이 프로젝트에서 **아이콘 다음으로 중요한 생성물**이다.

> ⚠ **1차 수령 시 실제로 있었던 문제 (2026-08-10 기록).**
> 수령한 원본이 **파일명이 주장하는 해상도가 아니었다** — `seals-2048x1536.png`의 실제 크기는 **1448×1086**,
> `seal-ascension-1024.png`는 **1254×1254**였다. 3×2 격자 셀이 483×543이 되어 **128로 나누어떨어지지 않는다.**
> 그 결과 1차 산출물이 192×192로 나왔고, 192 → 128은 ÷1.5 비정수라 §3.1이 경고한 "가짜 픽셀아트"가 된다.
>
> **재의뢰할 때 반드시 명시할 것 3가지**
> 1. **캔버스 크기를 숫자로 못박는다** — "1024×1024 exactly. Do not crop, do not pad, do not resize."
> 2. **세트는 시트가 아니라 낱장으로 받는다.** 시트로 받으면 격자 정렬 오차가 전량에 퍼진다(§4.6은 링/심볼 분리 합성을 권하지만, 그건 낱장 전제다).
> 3. **수령 즉시 `magick identify`로 실제 해상도를 확인한다.** 파일명을 믿지 않는다. §6.1 진행표에 이 확인 칸을 둔 이유다.

**6종 공통 프레임 규격 (반드시 통일)**
```
128x128 캔버스 (생성 1024x1024)
 ├ 외곽 원형 링 : 지름 92% — 6종 전부 동일한 기하학 구조
 ├ 링 내부 심볼 : 지름 62% 안에 — 태그마다 다름
 ├ 테두리 색    : 태그별 강조색
 └ 배경         : 완전 투명
```

**공통 프롬프트 헤더 (6종 전부 앞에 붙임)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — AWAKENING SIGIL, 1024x1024 square, FULLY TRANSPARENT BACKGROUND:

This is one of SIX matching sigils for a set. They must look like siblings.

MANDATORY SHARED STRUCTURE (identical across all six — do not vary):
 - An outer RING: a heavy circular band, outer diameter 92% of the canvas,
   band thickness 7% of the canvas. Forged iron (#2A2533 body, #4A4454
   highlight, #16121C shadow) with a hard 1px outline in #0B0710.
 - On the ring, at the four cardinal points (12, 3, 6, 9 o'clock), four small
   identical rivets/studs in bone (#C7C2CE).
 - Just inside the ring, a thin inner rule line 2px wide in the SIGIL ACCENT
   COLOUR specified below, unbroken, concentric.
 - The interior of the ring is EMPTY TRANSPARENT except for the central symbol.
 - The central symbol fits inside a circle of 62% canvas diameter, centred.
 - The symbol is rendered in the SIGIL ACCENT COLOUR ramp, with a 1px darker
   outline, and glows outward with 2 dithered rings of the accent colour at low
   alpha — hard dither steps, never a smooth glow.

Bilateral symmetry about the vertical axis unless the symbol description says
otherwise. Emblematic and flat — this is a stamped seal, not a scene.
Maximum 16 distinct colours per sigil.
No text. Transparent background with hard binary alpha.

--- SIGIL-SPECIFIC ---
```

#### A-09-1. FRAIL 「불사의 껍질」 (Husk Eternal)

정본 인용: *"부서지기 쉬운 것은, 부서지지 않는 법을 배운다."* / 효과: 치명타 시 회복, 사망 시 1회 부활.

```
SIGIL ACCENT COLOUR: bone white — #C7C2CE body, #9A94A3 shadow, #E8DCC0 highlight.
Secondary accent: crimson #8B0F1D (used only in the cracks).

CENTRAL SYMBOL — "HUSK ETERNAL":
An empty CHITINOUS SHELL / carapace, shaped like a hollow ribcage seen from the
front, or an eggshell that something has already left. Six curved rib-staves
sweep up and inward from a narrow base, meeting at a point at the top —
symmetric, three per side.

The shell is visibly BROKEN: two or three clean fracture lines run across it.
But the fractures are FILLED and SEALED with a thin crimson (#8B0F1D, #C4182B
at the brightest points) line, like blood that hardened into a weld — the
kintsugi principle, mended stronger than whole.

The shell is HOLLOW: through the gaps between the ribs you see only
transparency. Nothing lives inside. That emptiness is the point.

At the very bottom centre, a single small drop of crimson has not yet dried.
```

#### A-09-2. SLOW 「중력의 군주」 (Lord of Weight)

정본 인용: *"움직이지 않는 자가, 세상을 멈춘다."* / 효과: 자신의 둔족 제거, 주변 적 −40% 속도.

```
SIGIL ACCENT COLOUR: stone grey — #4A4454 body, #16121C shadow, #7B7488 highlight.
Secondary accent: teal #1E7E74 (used only in the shockwave rings).

CENTRAL SYMBOL — "LORD OF WEIGHT":
A heavy IRON PLUMB WEIGHT — a tapered teardrop/cone of solid iron, point down —
suspended from a single short chain of three thick links that rises to the top
of the symbol area. The weight is massive, blunt, and absolutely still.

Beneath and around the weight's point, THREE concentric elliptical RIPPLE RINGS
spread outward across the ground plane in teal (#1E7E74, fading to #0E3B3A),
drawn in hard dithered dashes, as if the world's surface has been dented by the
weight's presence. The rings are perspective ellipses, wider than they are tall.

The weight itself does not move and casts no motion lines. Everything else
bends around it.
```

#### A-09-3. MYOPIA 「접촉의 광기」 (Touch Madness)

정본 인용: *"멀리 볼 수 없다면, 끌어안는 수밖에."* / 효과: 근접 데미지 ×2.0, 가까울수록 공속 증가.

```
SIGIL ACCENT COLOUR: crimson — #8B0F1D body, #4A0710 shadow, #C4182B highlight.
Secondary accent: bone #C7C2CE (used only in the lens fragments).

CENTRAL SYMBOL — "TOUCH MADNESS":
TWO HUMAN HANDS, palms forward, fingers spread, reaching toward the viewer from
the lower left and lower right, wrists crossing at the bottom centre in an X.
The hands are gaunt and long-fingered, rendered in crimson tones. They are not
grasping at each other — they are grasping at YOU. They are too close.

Between and behind the crossed wrists, a SHATTERED LENS — a circular monocle or
spectacle glass, cracked into five or six large angular shards in bone white
(#C7C2CE), the shards spreading slightly apart. Through the gaps between shards,
only transparency. The lens is broken because it was never going to help.

The fingertips of both hands reach past the inner rule line, almost touching the
outer ring. Nothing else in the six sigils touches the ring — this one does.
```

#### A-09-4. GREED 「탐욕의 왕관」 (Crown of Avarice)

정본 인용: *"덜 받는 자가, 결국 전부 가진다."* / 효과: 경험치 폭주, 자석 ×4, 골드 ×2, 오브 관통.

```
SIGIL ACCENT COLOUR: gold — #C9A227 body, #7A5C12 shadow, #F2D57A highlight.
Secondary accent: teal #35C9B4 (used only for the experience orbs).

CENTRAL SYMBOL — "CROWN OF AVARICE":
A heavy medieval CROWN seen straight on, front view — a wide gold band with five
tall triangular points rising from it, the centre point tallest. The band is
plain and thick; the points are sharp, more like teeth than finials.

The crown is EMPTY — there is no head inside it, and through the arch of the
band you see only transparency.

Rising from the crown's band and drifting up between the points: five or six
small TEAL experience orbs (#35C9B4 core, #8FF0DC highlight), each a simple
faceted diamond 5% of the canvas across, being pulled INTO the crown rather than
away from it — a faint dotted teal trail behind each shows the direction of pull,
converging inward and downward toward the crown's centre.

The crown is greedy. The orbs have no choice.
```

#### A-09-5. BLIND 「어둠의 눈」 (Eye of Nyx)

정본 인용: *"눈을 감아라. 이제 다른 것으로 본다."* / 효과: 시야 밖 적 붉은 실루엣 표시, 시야 밖 데미지 ×1.8.

```
SIGIL ACCENT COLOUR: void-violet-black — #0B0710 body, #16121C shadow,
                     #2A2533 highlight (an almost invisible symbol).
Secondary accent: crimson #FF3B4A (the eye) and bone #C7C2CE (the blindfold).

CENTRAL SYMBOL — "EYE OF NYX":
A frontal, symmetric human FACE reduced to its barest components — no features
except what follows.

Across where the eyes would be: a BLINDFOLD, a single horizontal band of torn
cloth in bone white (#C7C2CE body, #9A94A3 shadow), its ends fraying and
trailing off to the left and right, ending before the ring. It is tied tight.
Behind the blindfold, no eyes are visible at all.

Directly ABOVE the blindfold, centred on the forehead, a THIRD EYE is open. It
is almond-shaped, and it is the brightest thing in the entire sigil set:
crimson iris (#C4182B) with a #FF3B4A pupil-glow at its centre, and a bone-white
(#C7C2CE) sclera reduced to a thin sliver at each corner. Its gaze is level and
unblinking.

Radiating outward from the third eye, six thin straight sight-lines in dashed
crimson pixels extend toward the outer ring but stop short of it, at even
angular intervals — vision going where vision should not reach.

The rest of the face is drawn in tones so close to the void that it is barely
present. The blindfold and the third eye carry the whole symbol.
```

#### A-09-6. HUNGER 「진조의 갈증」 (True Thirst)

정본 인용: *"굶주림은 멈추지 않는다. 그러니 멈추지 마라."* / 효과: 처치당 +4 HP, 처치 시 피 폭발.

```
SIGIL ACCENT COLOUR: crimson — #8B0F1D body, #4A0710 shadow, #FF3B4A highlight.
Secondary accent: bone #C7C2CE (the fangs and the chalice rim).

CENTRAL SYMBOL — "TRUE THIRST":
A CHALICE — a wide, shallow, footed goblet of tarnished bone-white metal
(#C7C2CE rim and stem highlights, #9A94A3 body, #4A4454 shadow), seen straight
on, perfectly symmetric.

The chalice is EMPTY. Its bowl is drawn as an open crescent with transparency
inside. Not a drop remains.

Piercing DOWN into the bowl from above, two long curved FANGS in bone white,
angled inward toward each other in a narrow V, their tips almost meeting just
above the chalice's rim. They are drinking from a cup that has nothing left.

From each fang tip, one single crimson (#C4182B) droplet is falling into the
empty bowl — the last two drops in the world.

Beneath the chalice's foot, a small crimson (#8B0F1D) splash-burst radiates
outward in six short dithered spikes, uneven in length — a kill detonating.

The composition reads top to bottom: fangs, drops, empty cup, burst.
```

**네거티브 프롬프트 (인장 6종 공통)**
```
[COMMON NEGATIVE] + background, backdrop, circle plate behind the symbol,
scene, landscape, character, full body, multiple symbols in one image, badge
with ribbon, medal, achievement icon, modern flat icon, material icon, emoji,
clipart, glossy button, sticker, sword and shield cliche, generic fantasy rune,
zodiac symbol, alchemy symbol, pentagram, occult star, mismatched ring geometry,
varying ring thickness between sigils
```

**수용 기준 (6종 전부에 적용)**
- [ ] **6개의 외곽 링이 완전히 동일**한 기하 구조 (두께·리벳 위치·지름) — 나란히 놓고 확인
- [ ] 배경 완전 투명
- [ ] 128×128로 줄여도 심볼이 무엇인지 구분된다
- [ ] 태그별 강조색이 §1.2 팔레트 안에 있다
- [ ] 링 내부가 채워져 있지 않다(투명)
- [ ] 각 인장이 정본의 각성 이름/인용문과 개념적으로 맞는다
  - FRAIL=깨졌다 봉합된 빈 껍질 / SLOW=추와 파문 / MYOPIA=손과 깨진 렌즈 /
    GREED=빈 왕관과 빨려드는 오브 / BLIND=안대와 제3의 눈 / HUNGER=빈 성배와 송곳니
- [ ] 6개를 한 줄로 놓았을 때 세트로 보인다

**재시도 조정 포인트**
1. **6개가 세트로 안 보임** (최다 문제) → 첫 성공본을 **레퍼런스 이미지로 첨부**하고
   `"Reuse the EXACT outer ring from the reference image. Only replace the central symbol."`
   → 또는 **링을 별도로 1개만 생성해두고, 심볼만 투명 배경으로 6개 받아 합성**한다 (§4.6). **이 방법이 훨씬 확실하다.**
2. 심볼이 링을 넘음 → `"The symbol fits strictly inside a 62% diameter circle."`
3. 128px에서 안 읽힘 → `"Design for 128x128 final. Two shapes maximum. Bold silhouette."`
4. 글로우가 부드러움 → `"Glow is exactly 2 dithered rings with hard pixel steps."`
5. BLIND가 너무 어두워 안 보임 → `"Raise the face tones one step to #2A2533. The third eye must be the brightest element in the entire set."`

---

### A-10. 완전 흡혈귀화 인장 (최종 각성)

| 항목 | 값 |
|---|---|
| **용도** | 인간성 0 도달 시 최종 각성 연출 (정본 `04-PACT-SYSTEM.md` §5.4) |
| **필요 크기** | **192 × 192 px** (일반 인장보다 1.5배 크게) / 생성 1536×1536 → 1/8 |
| **저장 경로** | `FE/public/img/seal/seal-ascension.png` |
| **우선순위** | SHOULD |

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — FINAL AWAKENING SIGIL "ASCENSION", 1536x1536, TRANSPARENT BACKGROUND:

This is the seventh and final sigil. It must be recognisably part of the set of
six awakening sigils, but visibly SUPERIOR to all of them — larger, heavier,
and wrong.

SHARED STRUCTURE (matching the set of six):
Same outer iron ring geometry: outer diameter 92% of canvas, band thickness 7%,
four bone rivets at the cardinal points. Same inner rule line.

HOW IT DIFFERS — the sigil has been CORRUPTED:
 - The iron ring is no longer clean. It is BROKEN at the 12 o'clock position:
   a jagged gap where the band has snapped, the two broken ends pulled slightly
   apart and bent outward. Crimson (#C4182B) light floods out of the break.
 - A SECOND ring has grown outside the first — a thin, irregular, organic ring
   of crimson (#8B0F1D) that was not forged but grew, like a vein wrapped around
   the iron. It follows the ring unevenly and pulses brighter (#FF3B4A) at three
   points.
 - The four bone rivets have been replaced by four small FANGS pointing inward.
 - The inner rule line is crimson (#C4182B) and is doubled.

CENTRAL SYMBOL — "ASCENSION":
A human HEART, anatomical but geometric, in full crimson ramp (#4A0710 /
#8B0F1D / #C4182B / #FF3B4A rim). It fills 58% of the canvas diameter — larger
than any symbol in the set of six.

From the heart, instead of arteries, EIGHT LENGTHS OF BROKEN IRON CHAIN erupt
outward in radial symmetry, each snapped at its far end, the broken links
splayed. The chains are stone grey (#4A4454, #16121C) and their broken ends
catch crimson light. They reach the inner rule line but do not cross the ring.

Behind the heart, spread symmetrically, TWO BAT WINGS made not of membrane but
of the same broken chain, drawn as spare geometric arcs, fading into
transparency at the tips. They are barely there — a suggestion.

At the exact centre of the heart, a single point of TEAL (#8FF0DC) light,
tiny — no more than 4 sprite pixels. The last of the candle. The last of her.

Overall the sigil reads as: something escaped, and it is wearing a heart.

Maximum 20 distinct colours. No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + realistic anatomy, medical illustration, gore, viscera,
dripping blood pool, demon face, skull, horns, pentagram, generic evil symbol,
background, scene, character, feathered wings, dragon wings, membrane wings
```

**수용 기준**
- [ ] 6종 인장과 링 구조를 공유하되 **부서져 있다**
- [ ] 심장 중앙의 청록 점 4px이 존재한다 (정본의 "인간성"의 잔재)
- [ ] 192×192로 줄여도 "심장 + 사슬"이 읽힌다
- [ ] 6종 옆에 놓았을 때 "얘가 최종"임이 즉시 보인다
- [ ] 배경 투명

**재시도 조정 포인트**
1. 6종과 안 어울림 → 인장 1개를 레퍼런스로 첨부 + `"Same ring, but shattered at the top."`
2. 그로테스크함 → `"Heraldic and geometric, not anatomical. A symbol of a heart, not a real one."`
3. 청록 점이 사라짐 → `"A single 4-pixel teal dot at the exact centre. It must be present. It is the whole point."`

---

### A-11. 결과 화면 배경 2종 (승리 / 패배)

| 항목 | 값 |
|---|---|
| **용도** | 런 종료 화면 배경 (정본 `01-CONCEPT` §6 엔딩) |
| **필요 크기** | 논리 **640 × 360** / 생성 1920×1080 → 1/3 |
| **저장 경로** | `FE/public/img/bg/result-win.png` / `result-lose.png` |
| **우선순위** | SHOULD |

> 정본 §6: 엔딩은 **"전문 텍스트 1화면 + 페이드"** 로만 구현한다. 배경은 **텍스트가 읽히는 어두운 판**이어야 한다.
> 엔딩 A/B/C는 배경을 공유하고 **텍스트로만 구분**한다 (7일 스코프).

**영어 프롬프트 전문 — 승리 (result-win)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — VICTORY / DAWN RESULT SCREEN BACKGROUND, 1920x1080 (16:9):

The moment after. Dawn has reached the sealed tomb and nothing is moving.

 - The composition is a wide, low, horizontal band: the crypt floor occupies the
   bottom 30% in stone tones (#16121C, #2A2533), the rest is receding darkness.
 - Across the upper-left, a single shaft of DAWN LIGHT enters through an unseen
   opening high above and falls diagonally to the floor. The shaft is rendered
   in TEAL (#1E7E74 core, #35C9B4 brightest edge, #0E3B3A falloff) — this is
   sacred light, not sunlight, and it must not be yellow or white. The shaft is
   drawn as hard dithered diagonal bands, never a soft gradient.
 - Where the shaft strikes the floor, a bright teal pool with dust motes rising
   through it as single lit pixels.
 - In the mid-distance, right of centre, the SACRED CANDLE stands relit, its
   teal flame tall and steady. Beside it, a knight's sword is planted upright in
   the flagstones, unattended, rimmed in teal.
 - The entire right half fades to near-void #0B0710.
 - A very faint residual crimson (#4A0710) stain lingers on the floor beneath
   the sword — barely visible. The cost was real.

CRITICAL UI CONSTRAINT:
The CENTRAL 70% width x 60% height of the frame must be dark and visually
uniform (values between #0B0710 and #16121C only) so that white result text and
statistics remain legible on top of it. All the interesting imagery lives at the
left edge, the bottom edge, and the mid-right.

Overall the image reads as at least 75% near-black.
Maximum 24 distinct colours. No text.
```

**영어 프롬프트 전문 — 패배 (result-lose)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — DEFEAT RESULT SCREEN BACKGROUND, 1920x1080 (16:9):

The moment after. The candle went out and something is pleased about it.

 - Same crypt geometry as the victory screen — same floor line at 30%, same
   receding darkness — so the two screens read as a matched pair.
 - There is no dawn shaft. The upper-left where the light should be is pure
   void #0B0710.
 - Left of centre, the SACRED CANDLE lies FALLEN on the flagstones, its wick
   extinguished, a thin thread of grey smoke (#4A4454, dithered, rising in three
   short broken segments) drifting up and fading out. No teal light remains
   anywhere in the image except a single dying #0E3B3A ember at the wick.
 - Filling the right half and the upper edge, deep CRIMSON light (#4A0710
   spreading to #8B0F1D) floods in from off-frame, casting the arches into
   silhouette. It is rising, not falling — the light comes from below the frame.
 - Silhouetted against that crimson, along the top edge, a row of hunched
   undead shapes stands perfectly still, watching. Pure #0B0710 silhouettes with
   a #C4182B rim. No individual detail. They are not attacking; they are
   waiting.
 - On the floor, centre-left, a knight's sword lies broken in two pieces.

CRITICAL UI CONSTRAINT:
The CENTRAL 70% width x 60% height must be dark and visually uniform
(#0B0710 to #16121C only) for legible overlaid text. Imagery lives at the edges.

Overall the image reads as at least 75% near-black.
Maximum 24 distinct colours. No text.
```

**네거티브 프롬프트 (2종 공통)**
```
[COMMON NEGATIVE] + game over text, victory text, banner, ribbon, trophy, star
rating, score display, UI panel, bright centre, high contrast centre, character
close-up, gore, corpse detail, dismemberment, yellow sunlight, warm daylight,
blue sky, orange sunset
```

**수용 기준**
- [ ] 두 장의 **크립트 기하 구조가 동일**하다 (한 쌍으로 읽힘)
- [ ] 중앙 70%×60%가 어둡고 균일 → 결과 텍스트가 읽힌다
- [ ] 승리는 청록이 지배, 패배는 심홍이 지배 (정본의 두 광원 대비가 승패로 매핑됨)
- [ ] 승리 화면의 새벽빛이 **노란색이 아니라 청록**이다
- [ ] 640×360으로 줄여도 구도가 읽힌다

**재시도 조정 포인트**
1. 중앙이 밝음 → `"Flatten the central 70%x60% to a uniform #0B0710. Move all imagery to the edges."`
2. 새벽빛이 노랑 → `"The dawn light is TEAL #35C9B4. There is no yellow, no white, no warm light in this world."`
3. 두 장이 안 맞음 → 승리본을 레퍼런스로 첨부 + `"Same room, same camera, same floor line. Only the lighting and props change."`

---

### A-12. 성소(Sanctum) 화면 배경

| 항목 | 값 |
|---|---|
| **용도** | 메타 진행 화면 배경 (정본 `03-GDD-CORE.md` §9) |
| **필요 크기** | 논리 **640 × 360** / 생성 1920×1080 → 1/3 |
| **저장 경로** | `FE/public/img/bg/sanctum.png` |
| **우선순위** | SHOULD |

> 성소는 **런 사이의 안전한 장소**다. 유일하게 조금 따뜻해도 되는 화면.
> 다만 정본의 "밝은 채도 금지"는 유지 — 따뜻함은 **청록의 양이 늘어나는 것**으로 표현한다.

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — SANCTUM (permanent upgrade shrine) BACKGROUND, 1920x1080 (16:9):

A small consecrated side-chapel within the abbey — the one room in this world
that is not actively trying to kill you. It should feel like exhaling.

 - A modest stone chamber, symmetric, viewed straight on. Lower ceiling than
   the crypt: an arched vault fills the upper third, its ribs in #2A2533 with
   #4A4454 edges.
 - Centre back wall: a SHRINE ALCOVE, a tall pointed niche in the stone. Inside
   it, SIX TEAL VOTIVE CANDLES of different heights stand in a row on a stone
   shelf (#1E7E74 wax, #35C9B4 flames). Six, because there are six upgrades —
   but do not draw any indicator, number, or slot UI. They are just candles.
 - The candles cast overlapping pools of teal light on the alcove's back wall,
   rendered as layered dithered rings.
 - Flanking the alcove, two stone pillars with simple carved chain-motif reliefs.
 - Floor: worn flagstones, teal reflections beneath the alcove, receding in
   gentle perspective toward the viewer.
 - Foreground bottom edge: the top of a low stone rail or prayer bench,
   silhouetted, spanning the full width — it frames the shot and gives depth.
 - Upper corners and outer edges: fall to void #0B0710.
 - The single crimson element in the whole image: a small dried crimson (#4A0710)
   handprint on the left pillar, at about chest height, easily missed.

CRITICAL UI CONSTRAINT:
The central 76% width x 62% height must be quiet and dark enough (#0B0710 to
#2A2533) for a grid of six upgrade cards to sit legibly on top. The alcove's
teal glow may show through but must not exceed #1E7E74 in that region.

Overall: at least 70% near-black, but noticeably more teal in total area than
any other background in the game.
Maximum 28 distinct colours. No text.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + shop UI, item slots, inventory grid, price tags, coins,
merchant character, npc, warm firelight, orange candles, cozy tavern, wood,
plants, colorful banners, bright interior, cathedral stained glass, gold
treasure pile
```

**수용 기준**
- [ ] 촛불이 정확히 6개 (업그레이드 6종과 은유적으로 대응)
- [ ] 중앙 76%×62%가 업그레이드 카드를 얹을 만큼 조용하다
- [ ] 청록 면적이 다른 배경보다 확실히 많다 (안전한 장소의 표현)
- [ ] 좌측 기둥의 붉은 손자국이 있다 (작은 서사 디테일)
- [ ] 640×360으로 줄여도 알코브 구조가 읽힌다

**재시도 조정 포인트**
1. 너무 밝음 → `"Reduce total luminance by 30%. The candles glow but the room stays dark."`
2. 촛불 개수 틀림 → `"Exactly six candles in a single row. Count them."`
3. 중앙이 복잡 → `"The alcove sits in the upper-centre. The central lower area is empty flagstone."`

---

### A-13. UI 요소 세트

| 항목 | 값 |
|---|---|
| **용도** | 버튼 / 패널 / HP·EXP 바 프레임 / 인간성 심장 아이콘 |
| **필요 크기** | 아래 개별 표 참조 |
| **저장 경로** | `FE/public/img/ui/` |
| **우선순위** | **MUST** |

> **한 장의 시트로 받는다.** 6~7장을 따로 생성하면 스타일이 갈린다.
> **하나의 이미지에 모든 UI 부품을 배치**해 받고, 후처리에서 잘라 쓴다.

**개별 규격**

| 부품 | 논리 크기 | 9-slice | 파일명 |
|---|---|---|---|
| 버튼 (기본/눌림) | 96 × 28 | ✅ 좌우 12px 고정 | `btn-normal.png` / `btn-pressed.png` |
| 패널 프레임 | 240 × 160 | ✅ 사방 16px 고정 | `panel.png` |
| HP 바 프레임 | 120 × 12 | ✅ 좌우 6px | `bar-hp-frame.png` |
| EXP 바 프레임 | 200 × 8 | ✅ 좌우 4px | `bar-exp-frame.png` |
| 인간성 심장 (온전) | 16 × 16 | — | `heart-full.png` |
| 인간성 심장 (소실) | 16 × 16 | — | `heart-empty.png` |

**영어 프롬프트 전문 (시트 1장으로 요청)**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — UI COMPONENT SHEET, 1536x1024, TRANSPARENT BACKGROUND:

A single sprite sheet containing SIX separate UI pieces for a gothic pixel-art
game, arranged in a clean grid with generous empty transparent space between
them. Each piece is a standalone element with hard binary alpha edges. Do not
draw a background, a frame, or labels around the sheet.

MATERIAL LANGUAGE (shared by every piece — this is what makes them a set):
Every element is made of two materials only:
  (a) blackened wrought IRON — #16121C body, #2A2533 mid, #4A4454 highlight,
      #7B7488 top rim. Flat, hammered, slightly irregular.
  (b) aged PARCHMENT — #8A7A57 shadow, #C9B792 body, #E8DCC0 highlight.
Iron forms the frames; parchment forms the fills. Nothing is glossy.
Every piece has a hard 1px #0B0710 outline on its outer silhouette.

LAYOUT AND PIECES:

 [Row 1, left]  BUTTON — NORMAL STATE
   A horizontal rectangle, aspect ratio 96:28, with slightly chamfered corners.
   Iron frame 3 sprite-pixels thick; interior filled with parchment. A small
   iron rivet in each of the four corners. The top edge catches a #7B7488 rim
   highlight; the bottom edge is #0B0710. Interior is EMPTY parchment — no text,
   no icon, no symbol.
   9-SLICE: the left and right 12 sprite-pixels contain the corners and rivets;
   the middle is uniform and horizontally tileable.

 [Row 1, right] BUTTON — PRESSED STATE
   Identical geometry to the normal button, but: the highlight and shadow are
   INVERTED (top edge dark #0B0710, bottom edge #4A4454), the parchment interior
   is one shade darker (#8A7A57), and the whole piece reads as recessed. Same
   outer dimensions exactly.

 [Row 2, full width] PANEL FRAME
   A larger rectangle, aspect ratio 240:160, same material language. Iron frame
   4 sprite-pixels thick with a small ornamental corner piece at each of the
   four corners (a simple chain-link motif, mirror-symmetric, confined to a
   16x16 sprite-pixel corner box). Interior filled with flat uniform parchment.
   A thin #8A7A57 inner rule line inset 2 pixels from the frame.
   9-SLICE: all ornament within 16 sprite-pixels of the edge; centre is flat and
   tileable in both axes.

 [Row 3, left]  HP BAR FRAME
   A long thin horizontal capsule, aspect ratio 120:12. Iron frame 2 sprite-
   pixels thick. The interior is EMPTY and fully TRANSPARENT (the game will
   draw the crimson fill itself) — do not fill it. At the left end, a tiny
   iron cap; at the right end, a matching cap. Horizontally tileable middle.

 [Row 3, right] EXP BAR FRAME
   A shorter, thinner horizontal capsule, aspect ratio 200:8. Same construction
   as the HP frame but thinner and with a TEAL (#1E7E74) hairline running along
   the inside of the top edge. Interior EMPTY and TRANSPARENT.

 [Row 4, left]  HUMANITY HEART — INTACT
   A small, chunky, heraldic heart shape, symmetric, designed to read at 16x16
   sprite pixels. Rendered in the crimson ramp: #4A0710 outline, #8B0F1D body,
   #C4182B upper-left highlight, a single #FF3B4A specular pixel. It looks warm
   and whole and slightly beating.

 [Row 4, right] HUMANITY HEART — LOST
   The exact same silhouette as the intact heart — identical outline, identical
   size, so the two can swap in place with no shift. But the interior is
   rendered in dead stone tones: #0B0710 outline, #16121C body, #2A2533 dull
   highlight, no specular. A hairline crack in #4A4454 runs from the top notch
   down to the lower-right, and the lowest point of the heart is chipped away.
   It is the same heart, emptied.

Every piece must be separated by at least 60 pixels of pure transparency.
Maximum 24 distinct colours across the entire sheet.
No text anywhere.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + text on buttons, icons inside buttons, labels, arrows,
checkmarks, glossy plastic, glassmorphism, neumorphism, modern flat UI, material
design, rounded modern corners, gradient fill, drop shadow, outer glow, sheet
background, grid lines, ruler marks, annotation, filled progress bars, colored
bar fill, different heart silhouettes between states, pieces touching each other
```

**수용 기준**
- [ ] 6개 부품이 서로 겹치지 않고 여백으로 분리됨 → 자르기 쉬움
- [ ] **두 심장의 실루엣이 완전히 동일** (겹쳐 놓고 확인. 다르면 UI에서 튄다)
- [ ] HP/EXP 바 내부가 **투명** (채워져 있으면 게임에서 바를 그릴 수 없다)
- [ ] 버튼 normal/pressed의 외곽 크기가 동일
- [ ] 코너 장식이 9-slice 고정 영역을 넘지 않음
- [ ] 전 부품이 같은 재질 언어(철+양피지)를 공유
- [ ] 버튼 안에 글자가 없다

**재시도 조정 포인트**
1. 심장 실루엣 불일치 → `"The two hearts share the EXACT same outline path. Only the interior colours differ."`
2. 바가 채워져 있음 → `"HP and EXP bar interiors are 100% transparent. Frame only. The game draws the fill."`
3. 부품이 붙어 있음 → `"Separate every piece by at least 80px of transparency. This is a cut-up sheet."`
4. 현대적 UI → `"Wrought iron and parchment only. Medieval. Nothing rounded, nothing glossy."`

---

### A-14. 가상 조이스틱 그래픽

| 항목 | 값 |
|---|---|
| **용도** | 좌하단 플로팅 조이스틱 (정본 `03-GDD-CORE.md` §3.2 — 최대 반경 48px, 데드존 8px, 반투명 30%) |
| **필요 크기** | 베이스 **96 × 96**, 노브 **44 × 44** / 생성 각 768×768, 352×352 |
| **저장 경로** | `FE/public/img/ui/joystick-base.png` / `joystick-knob.png` |
| **우선순위** | **MUST** |

> 정본 §3.3: **"손가락이 화면을 가리지 않도록"**, **반투명 30%**.
> → 조이스틱은 **극도로 단순하고 얇아야** 한다. 화려하면 게임을 가린다.
> 반투명은 **게임 코드에서 alpha로 적용**하므로 이미지는 불투명하게 만든다.

**영어 프롬프트 전문 — 베이스**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — VIRTUAL JOYSTICK BASE RING, 768x768, TRANSPARENT BACKGROUND:

An extremely minimal circular touch-control base for a mobile game HUD. This
element sits ON TOP of live gameplay and must obscure as little as possible.
Restraint is the entire brief.

 - A single thin CIRCULAR RING, outer diameter 88% of the canvas, band thickness
   only 4% of the canvas. Rendered as forged iron: #4A4454 body with a #7B7488
   highlight along the upper-left arc and #16121C along the lower-right arc.
   Hard 1px #0B0710 outline on both the inner and outer edge of the band.
 - The interior of the ring is COMPLETELY TRANSPARENT. Nothing inside. No fill,
   no grid, no crosshair, no directional arrows.
 - On the ring, at the four cardinal points (12, 3, 6, 9 o'clock), four tiny
   notches — each a 2-sprite-pixel inward tick in bone (#C7C2CE). These are the
   only ornament.
 - A second, much fainter ring sits concentric INSIDE the first at 34% diameter,
   drawn as a dotted/dashed line of single #4A4454 pixels with wide gaps. This
   marks the dead zone. It must be barely visible.
 - Nothing else. No glow, no shadow, no backing plate.

The whole element must read clearly as a ring even when drawn at 30% opacity
over a busy combat scene.

Maximum 8 distinct colours. No text.
```

**영어 프롬프트 전문 — 노브**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — VIRTUAL JOYSTICK KNOB, 352x352, TRANSPARENT BACKGROUND:

The thumb-stick cap that rides inside the joystick base ring. It must be
readable at a glance while a thumb partly covers it.

 - A single solid CIRCLE, diameter 84% of the canvas.
 - Construction, outside in:
     · Hard 1px #0B0710 outline.
     · A 3-sprite-pixel iron rim: #7B7488 along the upper-left arc,
       #4A4454 at the sides, #16121C along the lower-right arc. This rim alone
       gives the knob its dimensionality — do not use a gradient.
     · Interior fill: flat #2A2533.
     · Centred inside, a small solid CRIMSON dot (#8B0F1D body, #C4182B
       upper-left highlight, one #FF3B4A specular pixel), diameter 34% of the
       knob. This is the only warm colour and it is what the eye tracks.
 - No directional arrows, no ridges, no texture, no concentric grooves.
 - No glow, no outer shadow, no motion trail.

Perfectly circular and symmetric. Maximum 8 distinct colours. No text.
```

**네거티브 프롬프트 (2종 공통)**
```
[COMMON NEGATIVE] + directional arrows, d-pad, cross shape, WASD keys,
crosshair, compass rose, gamepad, analog stick 3d render, glossy dome,
rubber texture, concentric grooves, tick marks around the circle, degree
markings, glow, outer shadow, backing plate, filled interior, opaque center,
neon, sci-fi HUD, futuristic
```

**수용 기준**
- [ ] 베이스 내부가 **완전 투명** (게임 화면이 비쳐야 함)
- [ ] 베이스 링 두께가 캔버스의 4% 이하 — 얇다
- [ ] 노브 중앙의 붉은 점이 명확 (엄지에 가려도 가장자리가 보임)
- [ ] 방향 화살표가 없다
- [ ] 30% 알파를 적용해도 링이 읽힌다 → **실제로 alpha 0.3으로 합성해 확인할 것**
- [ ] 노브가 베이스 반경 48px 안에서 움직일 때 시각적으로 어색하지 않은 비율

**재시도 조정 포인트**
1. 너무 두껍고 화려함 → `"Thinner. A hairline ring. This must not compete with the game."`
2. 내부가 채워짐 → `"The ring's interior is 100% transparent. It is a ring, not a disc."`
3. 화살표가 생김 → `"No arrows. No directional indicators of any kind. A plain ring and a plain knob."`
4. 30%에서 안 보임 → `"Increase the ring's contrast: #7B7488 highlight against a #0B0710 outline. Value contrast, not thickness."`

---

### A-15. 스토어 스크린샷용 오버레이 프레임

| 항목 | 값 |
|---|---|
| **용도** | 스크린샷 위에 카피를 얹기 위한 템플릿 (`14-BUILD-AND-DEPLOY.md` §8.1의 8장 구성안) |
| **필요 크기** | **1920 × 1080** (Play 스크린샷과 동일) |
| **저장 경로** | `store/_raw/overlay-caption.png` |
| **우선순위** | SHOULD |
| **적용 대상** | **Play 전용.** App Store 스크린샷(2868×1320)은 비율이 달라 그대로 못 쓴다 → §4.7 (c) |

> **텍스트는 이 이미지에 넣지 않는다.** 카피는 §8.1 표에 정해져 있고, 8장마다 다르다.
> → **텍스트를 얹을 "띠(배너)"만 생성**하고, 문구는 이미지 편집기/ImageMagick으로 넣는다.
>
> ⚠ **iOS 스크린샷은 이번 주 대상이 아니다.** 내부 TestFlight에는 스크린샷이 필요 없으므로
> 이 오버레이를 App Store 비율로 다시 만드는 작업은 **Day 7 이후**로 미룬다. (§4.7 (c))

**영어 프롬프트 전문**
```
[PREPEND GLOBAL STYLE GUIDE]

SUBJECT — SCREENSHOT CAPTION OVERLAY TEMPLATE, 1920x1080, MOSTLY TRANSPARENT:

A transparent overlay layer that will be composited on top of gameplay
screenshots for a store listing. It contains NO text — only the decorative
banner that text will later be typed onto.

 - The canvas is 100% transparent except for the elements below.
 - BOTTOM BANNER: spanning the full width, occupying from 76% to 93% of the
   canvas height. It is a horizontal band of aged PARCHMENT (#C9B792 body,
   #8A7A57 mottling, #E8DCC0 highlight along the top edge) with slightly torn,
   uneven top and bottom edges — as if a strip was ripped from a contract.
   The parchment is opaque in its centre and its left and right ends taper and
   fade to full transparency over the outermost 8% of the width.
 - Along the top edge of the banner, a thin iron rule (#4A4454 with a #7B7488
   highlight, 4 pixels tall) running the full banner width, with a small
   chain-link ornament at the exact horizontal centre.
 - Along the bottom edge, a matching but thinner iron rule.
 - At the far left of the banner, inset 5% from the edge, a small WAX SEAL in
   crimson (#4A0710 body, #8B0F1D mid, #C4182B rim), about 90px across, pressed
   with an abstract chain-and-fang sigil. It overlaps the banner's top rule.
 - TOP VIGNETTE: a soft-stepped dithered darkening band across the top 12% of
   the canvas, going from #0B0710 at 55% alpha down to fully transparent —
   drawn as 6 discrete dither steps, never a smooth gradient.
 - CORNER MARKS: four small iron corner brackets, one in each corner of the
   canvas, inset 3%, each fitting in a 96x96 box. Simple right-angle brackets,
   2 pixels thick.
 - Absolutely nothing in the central region (12% to 76% of canvas height) —
   pure transparency, because that is where the gameplay must show through.

No text. Hard binary alpha at all sprite edges; the only partial alpha is in the
top vignette's dither steps and the banner's tapering ends.
Maximum 20 distinct colours.
```

**네거티브 프롬프트**
```
[COMMON NEGATIVE] + text, caption, placeholder text, lorem ipsum, sample text,
device frame, phone mockup, app store badge, arrows pointing at features,
callout bubbles, numbered markers, opaque background, full-screen tint,
content in the centre, gameplay imagery
```

**수용 기준**
- [ ] 중앙 12~76% 구간이 완전 투명 (게임 화면이 보여야 함)
- [ ] 하단 배너에 24pt 이상 글자를 2줄 얹을 공간이 있다
- [ ] 배너 좌우 끝이 자연스럽게 투명으로 페이드
- [ ] 텍스트가 하나도 없다
- [ ] 실제 스크린샷 위에 합성해봤을 때 게임이 안 가려진다

**합성 명령 예시 (ImageMagick)**
```bash
STORE="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store"
magick "$STORE/_raw/shot-01-pact.png" \
       "$STORE/_raw/overlay-caption.png" -composite \
  -gravity south -font "DungGeunMo" -pointsize 54 \
  -fill "#4A0710" -annotate +40+120 "모든 축복에는 대가가 따른다" \
  "$STORE/play/screenshot-01.png"
```

---

> **A-16(itch.io 커버 630×500)이 있던 자리다. 삭제되었다.**
> itch.io를 배포 채널에서 전면 제외(2026-08-10 확정)했으므로 이 자산은 쓸 곳이 없다.
> 프롬프트를 복원하지 말 것. **§2의 마지막 항목은 A-15다.**

---

## 3. 프롬프트 작성 원칙 (픽셀아트 실전 주의점)

### 3.1 가장 큰 함정 — "가짜 픽셀아트"

이미지 생성기는 **진짜 픽셀아트를 만들지 않는다.** "픽셀아트처럼 보이는 고해상도 일러스트"를 만든다.

```
생성기가 실제로 내놓는 것:
  1024×1024 이미지에, 픽셀처럼 보이는 사각형 패턴이 그려져 있음
  └ 문제 ①: 사각형 크기가 균일하지 않다 (한쪽은 8px, 다른 쪽은 11px)
  └ 문제 ②: 사각형 경계가 안티에일리어싱되어 있다 (경계에 중간색 픽셀)
  └ 문제 ③: 색이 수백~수천 개다 (진짜 픽셀아트는 16~32개)
  └ 문제 ④: 격자가 이미지 전체에서 정렬되어 있지 않다

→ 그대로 게임에 넣으면 pixelArt:true 렌더링에서 지저분하게 뭉개진다.
→ 반드시 §4의 후처리(다운스케일 + 색상 양자화)를 거쳐야 한다.
```

### 3.2 프롬프트로 완화하는 방법

| 기법 | 프롬프트 문구 | 효과 |
|---|---|---|
| 픽셀 크기 명시 | `"each pixel block is at least 12x12 screen pixels"` | 격자가 커져 다운스케일 손실 감소 |
| 색 수 상한 | `"maximum 24 distinct colours"` | 양자화 후 손실 감소 |
| 목표 크기 언급 | `"this will be viewed at 128x128"` | 생성기가 형태를 단순화 |
| 격자 정렬 요구 | `"pixel grid perfectly axis-aligned and uniform"` | 격자 왜곡 감소 |
| 안티에일리어싱 금지 | `"no anti-aliasing, hard pixel edges"` | 경계 중간색 감소 |
| 디더링 명시 | `"Bayer ordered dithering, visible dither dots"` | 그라디언트가 픽셀 계단으로 |
| 부정 예시 | `"not a painting made blocky — a small sprite photographed large"` | 개념 자체를 교정 |

> **가장 효과가 큰 것은 「목표 크기 언급」과 「색 수 상한」이다.** 이 둘은 항상 넣는다.

### 3.3 투명 배경 확보

| 방법 | 신뢰도 | 비고 |
|---|---|---|
| 프롬프트에 `"fully transparent background, alpha 0"` | 중 | 도구에 따라 무시됨 |
| `"hard binary alpha, no feathered edges"` 추가 | 중 | 반투명 후광 감소 |
| **단색 배경(마젠타 `#FF00FF`)으로 받아 후처리에서 제거** | **높음** | **권장.** §4.3 |
| 배경 제거 도구 사용 | 중 | 픽셀아트 경계를 뭉갤 수 있음 |

**권장 방식 — 마젠타 키잉**
```
프롬프트에 추가:
"Place the subject on a flat, uniform pure magenta background (#FF00FF).
 The magenta must be a single exact colour with no gradient, no shading,
 and no magenta anywhere on the subject itself. It will be keyed out."
```
후처리:
```bash
magick input.png -fuzz 8% -transparent "#FF00FF" -alpha set output.png
```
> **주의: 팔레트에 마젠타 계열이 없어야 한다.** BLOODSWORN 팔레트는 심홍(`#8B0F1D`)이라 `#FF00FF` 와 충분히 멀다. 안전.

### 3.4 일관된 스타일 유지

7일 프로젝트에서 **15개 자산의 스타일이 제각각이면 게임이 아마추어처럼 보인다.**

| 전략 | 방법 |
|---|---|
| **1. 공통 스타일 블록 고정** | §1.3을 **한 글자도 바꾸지 않고** 매번 앞에 붙인다 |
| **2. 시드 고정** | 도구가 seed를 지원하면 **첫 성공 결과의 seed를 기록**하고 이후 전부 같은 seed로 시작 |
| **3. 레퍼런스 이미지 첨부** | 첫 성공작(권장: **각성 인장 FRAIL** 또는 **카드 프레임 Common**)을 이후 모든 요청에 첨부하고 `"Match the art style, palette, outline weight, and dithering density of the reference image exactly."` |
| **4. 세트는 한 번에** | 6종 인장, UI 6부품처럼 **세트인 것은 한 이미지에 몰아서** 생성 → 스타일이 자동으로 통일됨 |
| **5. 부품 재사용** | 인장 6종은 **링 1개 + 심볼 6개**로 나눠 받아 합성하는 것이 가장 확실 (§4.6) |
| **6. 팔레트 강제** | 후처리에서 **모든 이미지를 동일한 팔레트 파일로 양자화**한다 (§4.4). 이것만으로도 통일감이 크게 오른다 |

> **①과 ⑥은 필수. ②③은 도구가 지원하면. ④⑤는 세트 항목에만.**

### 3.5 실패를 빨리 인정하는 기준

```
같은 항목에 3회 재시도했는데 수용 기준을 못 넘으면 → 접근을 바꾼다.

  로고 텍스트 실패      → 픽셀 폰트로 직접 조판 (A-05 참조)
  인장 세트 불일치      → 링/심볼 분리 생성 후 합성 (§4.6)
  카드 프레임 9-slice   → 단색 사각형 + 코너 장식만 받아 직접 조립
  배경 구도 실패        → 기존 타일셋(asset/tilemap/)으로 Tiled에서 조립
  초상화 실패           → 실루엣 + 붉은 눈 두 점만으로 극단 단순화

7일 프로젝트에서 이미지 한 장에 1시간 이상 쓰면 그 시간은 회수되지 않는다.
```

---

## 4. 후처리 워크플로

### 4.0 전체 흐름

```
[Codex 생성물]  1024~1920px, 색 수백 개, 안티에일리어싱 있음
      │
      ├─(1)─▶ 원본 보관         store/_raw/ 에 그대로 저장 (재작업 대비)
      │
      ├─(2)─▶ 배경 키잉         마젠타 → 투명 (필요 시)
      │
      ├─(3)─▶ 정수배 다운스케일  -filter point 로 목표 크기까지 (반드시 정수 배율)
      │
      ├─(4)─▶ 색상 양자화        공용 팔레트로 강제 매핑 (색 수 → 24~32)
      │
      ├─(5)─▶ 알파 정리          반투명 픽셀 제거 → 이진 알파
      │
      ├─(6)─▶ 크기별 export      밀도별/용도별로 저장
      │         │
      │         └─▶ FE/public/img/  또는  FE/android/.../res/  또는  store/play/
      │
      └─(7)─▶ iOS 분기          알파 채널 제거 + 정사각 패딩  ← §4.7 (iOS에만 있는 단계)
                │
                └─▶ FE/ios/App/App/Assets.xcassets/  또는  store/appstore/
```

> **(7)은 iOS에만 있다.** (1)~(6)까지는 Android와 완전히 같은 파이프라인을 타고,
> **마지막에만 갈라진다.** 그래서 iOS 추가에 드는 이미지 비용이 명령 몇 줄로 끝난다.

### 4.1 무료 도구

| 도구 | 용도 | 비고 |
|---|---|---|
| **ImageMagick** | 배치 처리 전량 (리사이즈/양자화/알파/합성) | **가장 중요.** CLI로 자동화 가능. `winget install ImageMagick.ImageMagick` |
| **Piskel** (piskelapp.com) | 픽셀 단위 수정, 애니메이션 프레임 | 브라우저에서 바로. 설치 불필요. Aseprite 무료 대안 |
| **GIMP** | 레이어 작업, 인덱스 팔레트 변환, 정밀 알파 편집 | `Image > Mode > Indexed` 로 팔레트 양자화 |
| **LibreSprite** | Aseprite의 오픈소스 포크 | Aseprite와 UI가 거의 같다 |
| **Krita** | 픽셀 브러시 + 팔레트 도킹 | 무겁지만 강력 |
| **Lospec Palette List** | 팔레트 참고/추출 | 우리는 자체 팔레트를 쓰므로 참고용 |

> **7일 스코프 권장 조합: ImageMagick(배치) + Piskel(픽셀 수정) 2개면 충분하다.**
> Aseprite($20)를 살 여유가 있으면 사는 게 시간을 아낀다. 없으면 위 조합으로 충분히 된다.

### 4.2 (3) 정수배 다운스케일 — 가장 중요한 단계

```bash
# ❌ 절대 금지 — 기본 필터는 흐리게 만든다
magick in.png -resize 128x128 out.png

# ✅ 반드시 -filter point (nearest neighbour)
magick in.png -filter point -resize 128x128 out.png

# ✅ 더 안전한 형태 — 보간을 완전히 끔
magick in.png -interpolate Nearest -filter point -define filter:blur=0 \
       -resize 128x128 out.png
```

**정수 배율 표 (반드시 이 조합만 사용)**

| 목표 | 생성 크기 | 배율 |
|---|---|---|
| 640 × 360 (배경) | 1920 × 1080 | ÷3 |
| 128 × 128 (인장) | 1024 × 1024 | ÷8 |
| 192 × 192 (최종 인장) | 1536 × 1536 | ÷8 |
| 160 × 240 (카드) | 640 × 960 | ÷4 |
| 128 × 160 (초상) | 768 × 960 | ÷6 |
| 512 × 512 (Play 아이콘) | 1024 × 1024 | ÷2 |
| **1024 × 1024 (iOS 아이콘)** | 1024 × 1024 | **÷1 (리사이즈 없음)** |
| 96 × 96 (조이스틱 베이스) | 768 × 768 | ÷8 |

> **비정수 배율(예: 1600→640, ÷2.5)은 픽셀을 반드시 깨뜨린다.**
> 생성 크기를 목표의 정수배로 요청하는 것이 후처리 품질의 8할이다.

### 4.3 (2) 배경 키잉 + (5) 알파 정리

```bash
# 마젠타 배경 제거
magick in.png -fuzz 10% -transparent "#FF00FF" -alpha set keyed.png

# 반투명 픽셀 제거 → 이진 알파 (임계값 50%)
magick keyed.png -channel A -threshold 50% +channel binary.png

# 키잉 후 남는 마젠타 프린지(경계의 보라 테두리) 제거
magick keyed.png -alpha set -channel A -morphology EdgeIn Diamond +channel \
       -fill none -opaque "#FF00FF" cleaned.png

# 한 번에 (권장 파이프라인)
magick in.png \
  -fuzz 10% -transparent "#FF00FF" \
  -filter point -resize 128x128 \
  -channel A -threshold 50% +channel \
  out.png
```
> **순서 주의: 키잉 → 다운스케일 → 알파 임계값.**
> 다운스케일을 먼저 하면 마젠타가 주변 색과 섞여 제거가 어려워진다.

### 4.4 (4) 색상 양자화 — 팔레트 통일

**① 팔레트 이미지를 한 번 만든다** (전 자산이 이 파일 하나를 공유)

```bash
STORE="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store"
mkdir -p "$STORE/_palette"

magick -size 21x1 xc:none \
  -fill "#0B0710" -draw "point 0,0"  -fill "#16121C" -draw "point 1,0" \
  -fill "#2A2533" -draw "point 2,0"  -fill "#4A4454" -draw "point 3,0" \
  -fill "#7B7488" -draw "point 4,0"  -fill "#C7C2CE" -draw "point 5,0" \
  -fill "#4A0710" -draw "point 6,0"  -fill "#8B0F1D" -draw "point 7,0" \
  -fill "#C4182B" -draw "point 8,0"  -fill "#FF3B4A" -draw "point 9,0" \
  -fill "#0E3B3A" -draw "point 10,0" -fill "#1E7E74" -draw "point 11,0" \
  -fill "#35C9B4" -draw "point 12,0" -fill "#8FF0DC" -draw "point 13,0" \
  -fill "#7A5C12" -draw "point 14,0" -fill "#C9A227" -draw "point 15,0" \
  -fill "#F2D57A" -draw "point 16,0" -fill "#8A7A57" -draw "point 17,0" \
  -fill "#C9B792" -draw "point 18,0" -fill "#E8DCC0" -draw "point 19,0" \
  -fill "#9A94A3" -draw "point 20,0" \
  "$STORE/_palette/bloodsworn-palette.png"
```

**② 모든 생성물을 이 팔레트로 강제 매핑**

```bash
PAL="$STORE/_palette/bloodsworn-palette.png"

# 디더링 없이 (선명한 픽셀아트에 적합 — 기본 선택)
magick in.png -dither None -remap "$PAL" out.png

# 디더링 있게 (그라디언트가 많은 배경에 적합)
magick in.png -dither FloydSteinberg -remap "$PAL" out.png

# 색 수 확인 (양자화 후 21 이하여야 함)
magick identify -format "%k unique colours\n" out.png
```

> **`-remap` 이 이 문서 전체에서 스타일 통일에 가장 강력한 한 방이다.**
> 15개 자산이 서로 다른 날 생성되어도, 전부 같은 21색으로 매핑되면 한 세트로 보인다.
> ⚠ 단, 투명 배경 이미지는 `-remap` 이 알파를 깨뜨릴 수 있다 → **알파 채널을 분리해 처리**한다:
> ```bash
> magick in.png -alpha extract alpha.png
> magick in.png -alpha off -dither None -remap "$PAL" rgb.png
> magick rgb.png alpha.png -alpha off -compose CopyOpacity -composite out.png
> ```

### 4.5 검수 스크립트 (적응형 아이콘 마스크 시뮬레이션)

```bash
# 원형 마스크를 씌워 잘리는 부분을 미리 확인
SRC="store/_raw/icon-fg-1024.png"
magick "$SRC" \
  \( -size 1024x1024 xc:black -fill white -draw "circle 512,512 512,190" \) \
  -alpha off -compose CopyOpacity -composite \
  -background "#0B0710" -flatten \
  store/_check/icon-circle-preview.png

# 스퀘어클(둥근 사각) 마스크
magick "$SRC" \
  \( -size 1024x1024 xc:black -fill white \
     -draw "roundrectangle 96,96 928,928 200,200" \) \
  -alpha off -compose CopyOpacity -composite \
  -background "#0B0710" -flatten \
  store/_check/icon-squircle-preview.png
```

**축소 미리보기 (썸네일에서 읽히는지 확인 — 모든 자산에 적용)**
```bash
# 48px / 128px / 256px 미리보기를 한 장에 나열
magick montage \
  \( in.png -filter point -resize 48x48 \) \
  \( in.png -filter point -resize 128x128 \) \
  \( in.png -filter point -resize 256x256 \) \
  -tile 3x1 -geometry +12+12 -background "#0B0710" preview.png
```

### 4.6 세트 자산 합성 (각성 인장 권장 워크플로)

**링 1개 + 심볼 6개로 나눠 받아 합성하면 6종의 일관성이 100% 보장된다.**

```bash
IMG="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/FE/public/img/seal"
RAW="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store/_raw/seal"
PAL="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/store/_palette/bloodsworn-palette.png"
mkdir -p "$IMG"

for tag in frail slow myopia greed blind hunger; do
  magick "$RAW/ring-1024.png" \
    \( "$RAW/symbol-$tag-1024.png" -filter point -resize 635x635 \) \
    -gravity center -compose Over -composite \
    -filter point -resize 128x128 \
    -channel A -threshold 50% +channel \
    "$IMG/seal-$tag.png"
done

# 6개를 한 줄로 나열해 세트 일관성 눈으로 검수
magick montage "$IMG"/seal-*.png -tile 6x1 -geometry +8+8 \
  -background "#0B0710" "$RAW/_seal-set-check.png"
```
> `635` = 1024 × 62% (인장 심볼 안전 지름).

### 4.7 ★ iOS 자산 후처리 — 새로 만들지 않고 A-01/A-04를 변환한다

> **이 절이 iOS 대응의 전부다.** iOS 때문에 추가되는 **생성 항목은 0건**이고, 추가되는 것은 **후처리 단계 3개**뿐이다.
> 근거: iOS가 요구하는 스토어 자산은 아이콘 1장(1024)이며, 그 그림은 Play 아이콘과 **완전히 같은 그림**이어도 된다.
> 다른 것은 **파일 규격뿐**이므로 프롬프트가 아니라 ImageMagick으로 해결한다.

#### (a) iOS 앱 아이콘 — **알파 채널 제거가 핵심**

| 항목 | Android (Play) | iOS (App Store) |
|---|---|---|
| 크기 | 512 × 512 | **1024 × 1024** |
| 알파 채널 | **있어야 함** (32비트 PNG) | **있으면 거부된다** ← 정반대 |
| 모서리 처리 | 스토어가 자동 마스킹 | 시스템이 자동 마스킹 (모서리 12% 규칙 동일) |
| 파일 수 | 512 1장 + 적응형 전경 5밀도 | **1024 1장** (나머지는 Xcode가 파생) |
| 배치 위치 | `store/play/icon-512.png` + `res/mipmap-*/` | `FE/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |

> ⚠ **알파 채널이 있으면 App Store Connect가 업로드를 거부한다.** 이것이 iOS 아이콘에서 유일하게 위험한 지점이다.
> "투명한 픽셀이 하나도 없어도" **알파 채널이 존재하기만 하면** 거부되는 사례가 있으므로,
> `-alpha remove` 로 합성하고 **`-alpha off` 로 채널 자체를 떼어낸다.** 둘 다 해야 한다.

```bash
ROOT="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
RAW="$ROOT/store/_raw"
ICONSET="$ROOT/FE/ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ROOT/store/appstore"

# A-01 원본(1024×1024)에서 알파를 제거한다. 리사이즈 없음(÷1).
#  -background : 투명 픽셀이 있었다면 이 색으로 메운다 (정본 레터박스색 VOID)
#  -alpha remove : 투명 픽셀을 배경색과 합성
#  -alpha off    : 알파 채널 자체를 결과 파일에서 제거   ← 이게 없으면 거부된다
magick "$RAW/icon-1024.png" \
  -background "#0B0710" -alpha remove -alpha off \
  -strip -colorspace sRGB \
  "$ROOT/store/appstore/icon-1024.png"

# 아이콘셋에 배치 (파일명은 Contents.json에 고정되어 있다. 바꾸지 말 것)
cp "$ROOT/store/appstore/icon-1024.png" "$ICONSET/AppIcon-512@2x.png"
```

**검증 — 올리기 전에 반드시 이 두 줄을 돌린다**
```bash
# 1) 알파 채널이 정말 없는가  → False 여야 한다
magick identify -format "alpha=%A  %wx%h  %[colorspace]\n" "$ICONSET/AppIcon-512@2x.png"

# 2) 크기가 정확히 1024×1024 인가 → 1024x1024 여야 한다
magick identify -format "%wx%h\n" "$ICONSET/AppIcon-512@2x.png"
```
> `alpha=True` 가 나오면 **업로드하지 말고 다시 처리한다.** CI를 한 바퀴 돌리고 거부당하면 왕복 시간이 통째로 날아간다.
> `-strip` 은 색 프로파일·메타데이터를 떼어 "알 수 없는 색 프로파일" 계열의 거부 사유를 함께 예방한다.

#### (b) iOS 런치스크린(스플래시) — A-04를 정사각으로 패딩

Capacitor iOS 스캐폴드는 **정사각 2732×2732 3장**(1x/2x/3x)을 요구한다(`Splash.imageset/Contents.json` 실측).
Android처럼 가로/세로 밀도별로 나뉘지 않으며, **표시될 때 화면 비율에 맞춰 중앙이 크롭**된다.

```bash
SPLASH="$ROOT/FE/ios/App/App/Assets.xcassets/Splash.imageset"

# A-04 원본(1920×1280)을 리사이즈 없이 2732 정사각 캔버스 중앙에 얹는다.
# 비정수 배율을 피하려고 확대하지 않는다(§4.2). 남는 여백은 VOID로 채운다.
magick "$RAW/splash-1920x1280.png" \
  -background "#0B0710" -gravity center -extent 2732x2732 \
  -alpha remove -alpha off \
  "$SPLASH/splash-2732x2732.png"
cp "$SPLASH/splash-2732x2732.png" "$SPLASH/splash-2732x2732-1.png"
cp "$SPLASH/splash-2732x2732.png" "$SPLASH/splash-2732x2732-2.png"
```
> **중앙 크롭을 전제로 구도를 판단할 것.** 가로 화면에서는 정사각의 위아래가 잘려 나간다.
> A-04의 핵심 요소가 중앙 세로 47%(= 1280/2732) 안에 들어 있어야 살아남는다.
> 들어 있지 않다면 **단색 `#0B0710` 스플래시로 대체**한다 — 정본이 요구하는 것은 "흰 플래시가 없을 것"뿐이다.

#### (c) App Store 스크린샷 — **Day 7 경로에 없다. 우선순위를 내린다**

> ★ **내부 TestFlight 배포에는 스크린샷이 필요 없다.** (`14-BUILD-AND-DEPLOY.md` §7.5 / 내부 TestFlight 필수 항목)
> 따라서 **Day 7(2026-08-16) 목표에 스크린샷은 걸리지 않는다.** App Store 정식 제출 때 처음 필요해진다.
> **이 문서에서 iOS 스크린샷의 우선순위는 「Day 7 이후」다.** Day 7에 이 작업을 하지 말 것.

규격만 미리 기록해 둔다 (실제 촬영은 Day 7 이후):

| 항목 | 값 |
|---|---|
| 리드 사이즈 (2026) | 6.9인치 — 세로 1320×2868 / **가로 2868 × 1320** ← 우리는 가로 고정이므로 **2868 × 1320** |
| 6.9인치 계열 허용 세로 | 1260×2736 / 1290×2796 / 1320×2868 (가로는 치수를 뒤집는다) |
| 정밀도 | **1픽셀만 틀려도 App Store Connect가 거부한다** |
| 필수 최소 장수 | ⚠ 확인 필요(2026-08-10 기준 미확인) |
| iPhone 전용 앱에서 iPad 스크린샷 필요 여부 | ⚠ 확인 필요(2026-08-10 기준 미확인) |

> **A-15(스크린샷 오버레이)는 Play용 1920×1080 기준으로 만들어져 있다.** 2868×1320은 비율이 다르므로
> (1920:1080 = 1.778 / 2868:1320 = 2.173) **오버레이를 그대로 늘려 쓸 수 없다.**
> Day 7 이후에 iOS 스크린샷을 만들 때는 오버레이를 **재생성하지 말고**, 하단 배너를 ImageMagick으로 다시 조판한다.
> 1픽셀 오차가 거부 사유이므로 **마지막에 반드시 `-extent 2868x1320` 로 크기를 강제**할 것.

---

### 4.8 최종 배치 스크립트

`store/postprocess.sh` 로 저장해두면 재생성 시 한 번에 처리된다.

```bash
#!/usr/bin/env bash
# store/postprocess.sh — 모든 생성물을 게임/스토어 경로로 후처리 배치
set -euo pipefail
ROOT="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
RAW="$ROOT/store/_raw"
PUB="$ROOT/FE/public/img"
PAL="$ROOT/store/_palette/bloodsworn-palette.png"
ICONSET="$ROOT/FE/ios/App/App/Assets.xcassets/AppIcon.appiconset"
SPLASH="$ROOT/FE/ios/App/App/Assets.xcassets/Splash.imageset"
mkdir -p "$PUB"/{ui,seal,bg,portrait} "$ROOT/store/play" "$ROOT/store/appstore"

pixdown () {   # $1=src $2=WxH $3=dst
  magick "$1" -filter point -resize "$2" \
    -channel A -threshold 50% +channel "$3"
  echo "  -> $3  ($(magick identify -format '%wx%h %k colours' "$3"))"
}

echo "[1/5] 배경"
pixdown "$RAW/bg-title-1920.png"   640x360 "$PUB/bg/title.png"
pixdown "$RAW/bg-sanctum-1920.png" 640x360 "$PUB/bg/sanctum.png"
pixdown "$RAW/bg-win-1920.png"     640x360 "$PUB/bg/result-win.png"
pixdown "$RAW/bg-lose-1920.png"    640x360 "$PUB/bg/result-lose.png"

echo "[2/5] 카드 프레임"
for r in common rare epic; do
  pixdown "$RAW/card-$r-640x960.png" 160x240 "$PUB/ui/card-$r.png"
done

echo "[3/5] 초상 / 조이스틱"
pixdown "$RAW/nocturne-768x960.png" 128x160 "$PUB/portrait/nocturne.png"
pixdown "$RAW/joystick-base-768.png"  96x96 "$PUB/ui/joystick-base.png"
pixdown "$RAW/joystick-knob-352.png"  44x44 "$PUB/ui/joystick-knob.png"

echo "[4/6] 스토어 (Play)"
magick "$RAW/icon-1024.png"  -filter point -resize 512x512  "$ROOT/store/play/icon-512.png"
magick "$RAW/feature-2048x1000.png" -filter point -resize 1024x500 -alpha remove -alpha off \
       "$ROOT/store/play/feature-1024x500.png"

echo "[5/6] 스토어 (iOS) — 알파 제거. 같은 원본에서 파생 (§4.7)"
magick "$RAW/icon-1024.png" -background "#0B0710" -alpha remove -alpha off \
       -strip -colorspace sRGB "$ROOT/store/appstore/icon-1024.png"
cp "$ROOT/store/appstore/icon-1024.png" "$ICONSET/AppIcon-512@2x.png"
magick "$RAW/splash-1920x1280.png" -background "#0B0710" -gravity center -extent 2732x2732 \
       -alpha remove -alpha off "$SPLASH/splash-2732x2732.png"
cp "$SPLASH/splash-2732x2732.png" "$SPLASH/splash-2732x2732-1.png"
cp "$SPLASH/splash-2732x2732.png" "$SPLASH/splash-2732x2732-2.png"
# 알파가 남아 있으면 즉시 중단한다 (업로드 거부 사유)
magick identify -format "%A" "$ICONSET/AppIcon-512@2x.png" | grep -qi '^false$' \
  || { echo "  !! iOS 아이콘에 알파 채널이 남아 있다. 업로드 금지."; exit 1; }
echo "  -> iOS 아이콘 알파 없음 확인"

echo "[6/6] 색 수 검증"
find "$PUB" -name '*.png' -exec magick identify -format '%f: %k colours\n' {} \;
echo "완료."
```

---

## 5. 의뢰 순서 & 일정 (역산)

### 5.1 하드 데드라인 역산

```
Day 7 (08-16) 14:40  Play 스토어 등록정보 입력
   └ 필요: 아이콘 512 / 피처그래픽 1024x500 / 스크린샷
      └ 스크린샷은 Day 7 오전 10:30에 게임에서 촬영
         └ 촬영하려면 게임 UI가 완성되어 있어야 함
            └ UI 에셋(카드 프레임/인장/버튼)이 Day 5까지 코드에 들어가 있어야 함
               └ 따라서 UI 에셋 수령 마감 = Day 4 종료

Day 4 (08-13)  런처 아이콘 교체 (mipmap-*)
   └ 적응형 아이콘 전경 수령 마감 = Day 3 종료

┌──────────────────────────────────────────────────────────────┐
│  ★ 최종 결론 — 의뢰 마감 (이 날짜를 넘기면 Day 7이 위험)      │
│                                                              │
│    · 앱 아이콘 / 적응형 전경 ······ Day 2 (08-11) 까지 의뢰   │
│    · 피처 그래픽 / 로고 ··········· Day 2 (08-11) 까지 의뢰   │
│    · 카드 프레임 / UI 세트 / 조이스틱 · Day 2 (08-11) 까지 의뢰│
│    · 각성 인장 7종 / 녹턴 초상 ···· Day 3 (08-12) 까지 의뢰   │
│    · 배경 4종 / 스플래시 ·········· Day 4 (08-13) 까지 의뢰   │
│    · 스크린샷 오버레이 ············ Day 5 (08-14) 까지 의뢰   │
│                                                              │
│    · Day 6 (08-15) = 재시도 전용일. 신규 의뢰 금지.          │
│    · Day 7 (08-16) = 이미지 의뢰 절대 금지. 후처리만.        │
└──────────────────────────────────────────────────────────────┘
```

**iOS는 이 역산에 새 마감을 추가하지 않는다.**

```
Day 7 (08-16)  TestFlight 내부테스트 업로드
   └ 필요한 이미지: iOS 앱 아이콘 1024 (무알파) 1장뿐
      └ 그 1장은 A-01 원본에서 §4.7 명령 한 줄로 나온다 (생성 의뢰 아님)
         └ 따라서 iOS의 실질 이미지 마감 = A-01 마감 = Day 2 (08-11)

App Store 스크린샷 = Day 7 이후. 내부 TestFlight에는 필요 없다.
   └ 이번 주 일정에 넣지 않는다. 넣으면 Day 7이 무너진다.
```

> **핵심 원리: 「의뢰 → 수령 → 검수 → 재시도」에 최소 1일 버퍼를 둔다.**
> 재시도가 2회 필요한 항목이 반드시 나온다(경험상 로고와 인장 세트).
> Day 6을 통째로 재시도 버퍼로 비워두는 것이 이 일정의 안전장치다.

### 5.2 일자별 의뢰 배치

| Day | 날짜 | 의뢰 배치 | 항목 | 이유 |
|---|---|---|---|---|
| **Day 1** | 08-10 | **배치 A** | A-01 앱 아이콘 · A-02 적응형 전경 · A-03 피처 그래픽 · A-05 로고 | **배포 필수물 + 재시도 리스크 최상.** 가장 먼저, 가장 오래 시간을 준다. 특히 로고는 3회 이상 재시도를 각오 |
| **Day 2** | 08-11 | **배치 B** | A-08 카드 프레임 3종 · A-13 UI 세트 · A-14 조이스틱 | **Day 3에 PACT 카드 UI를 구현**(정본 §11 P0)하므로 그 전에 손에 있어야 한다 |
| **Day 3** | 08-12 | **배치 C** | A-09 각성 인장 6종 · A-07 녹턴 초상 | **Day 4에 각성 연출 구현**(정본 §11 P1). 인장은 링/심볼 분리 요청(§4.6) |
| **Day 4** | 08-13 | **배치 D** | A-06 타이틀 배경 · A-12 성소 배경 · A-11 결과 배경 2종 · A-04 스플래시 · A-10 최종 인장 | 배경은 없어도 단색으로 대체 가능해 후순위 |
| **Day 5** | 08-14 | **배치 E** | A-15 스크린샷 오버레이 **(1건뿐)** | Day 7 배포 직전에 쓰는 것. itch 커버가 빠져 배치 E는 1건으로 줄었다 |
| **Day 6** | 08-15 | **재시도 전용** | (신규 없음) | 수용 기준 미달 항목 전량 재의뢰 + 후처리 완료 |
| **Day 7** | 08-16 | **의뢰 금지** | — | §4.8 배치 스크립트 실행 + Play 스크린샷 합성 + **iOS 아이콘 알파 제거 검증(§4.7 a)** |

> **배치 E가 1건으로 줄어든 것은 여유가 생긴 것이 아니다.** 그 시간은 iOS 파이프라인 관통에 쓰인다.
> 이미지 쪽에서 iOS에 필요한 것은 §4.7의 후처리 명령뿐이며, **Day 5에 미리 한 번 돌려보는 것을 권장**한다.
> 알파 제거 실패는 Day 7 업로드 당일에 발견하면 CI 왕복 시간을 통째로 잃는다.

### 5.3 각 배치의 "임시 대체안" (수령 실패 시)

> **모든 항목에 폴백을 준비한다.** 이미지가 없어서 출시가 막히는 상황을 만들지 않는다.

| 항목 | 임시 대체안 (10분 이내 제작) |
|---|---|
| 앱 아이콘 | `#0B0710` 배경 + 흰 사각형 심장 실루엣. ImageMagick으로 즉석 생성 |
| 적응형 전경 | 위 아이콘을 61% 축소해 투명 배경에 배치 |
| 피처 그래픽 | `#0B0710` 단색 + 로고(또는 텍스트) 좌측 배치. **단색도 규격만 맞으면 통과된다** |
| 로고 | 픽셀 한글/영문 폰트로 직접 조판 (§A-05 하단) |
| 카드 프레임 | CSS/Canvas로 사각 테두리 + 등급색 1px 라인. 실제로 충분히 봐줄 만하다 |
| 각성 인장 | `asset/icons/` 의 Raven Fantasy 아이콘 6개를 골라 원형 테두리만 합성 |
| 녹턴 초상 | **생략하고 대사 텍스트만 표시.** 카드 UI는 초상 없이도 성립한다 |
| 배경 4종 | `#0B0710` 단색 + 비네트. 정본의 "텍스트 1화면 + 페이드"에 부합 |
| 스플래시 | `#0B0710` 단색 |
| UI 세트 | CSS 박스 + 테두리 |
| 조이스틱 | Phaser `Graphics` 로 원 2개 그리기 (**오히려 이게 더 가볍다**) |
| 오버레이 | ImageMagick으로 반투명 검은 띠 생성 |
| **iOS 아이콘** | A-01이 실패했으면 **임시 아이콘(§5.3 하단 명령)에 `-alpha remove -alpha off` 만 얹는다.** 별도 제작 없음 |
| **iOS 스플래시** | `magick -size 2732x2732 "xc:#0B0710"` 로 단색 1장. 3개 파일명으로 복사 |

```bash
# 임시 아이콘 30초 제작 예시
magick -size 1024x1024 "xc:#0B0710" \
  -fill "#8B0F1D" -stroke "#C4182B" -strokewidth 12 \
  -draw "path 'M 512,760 L 300,530 A 130,130 0 1,1 512,360 A 130,130 0 1,1 724,530 Z'" \
  store/play/icon-512-temp.png
magick store/play/icon-512-temp.png -filter point -resize 512x512 store/play/icon-512.png
```

---

## 6. 체크리스트 (전체 생성물)

### 6.1 생성 & 후처리 진행표

| # | 항목 | 우선 | 의뢰 | 수령 | 검수 통과 | 후처리 | 경로 배치 |
|---|---|---|---|---|---|---|---|
| A-01 | 앱 아이콘 512×512 (Play) | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `store/play/icon-512.png` |
| A-01b | **iOS 앱 아이콘 1024×1024 (무알파)** — A-01 후처리 | MUST | — | — | — | ☐ | ☐ `.../AppIcon.appiconset/AppIcon-512@2x.png` |
| A-02 | 적응형 아이콘 전경 (5밀도) | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `res/mipmap-*/ic_launcher_foreground.png` |
| A-02b | 적응형 배경색 `#0B0710` | MUST | — | — | — | — | ☐ `res/values/ic_launcher_background.xml` |
| A-02c | 레거시 아이콘 (5밀도 ×2) | MUST | — | — | — | ☐ | ☐ `res/mipmap-*/ic_launcher(_round).png` |
| A-03 | 피처 그래픽 1024×500 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `store/play/feature-1024x500.png` |
| A-04 | 스플래시 (가로 5밀도) | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `res/drawable-land-*/splash.png` |
| A-04b | 스플래시 세로 5밀도 (단색) | SHOULD | — | — | — | ☐ | ☐ `res/drawable-port-*/splash.png` |
| A-04c | **iOS 스플래시 2732×2732 ×3** — A-04 후처리 | SHOULD | — | — | — | ☐ | ☐ `.../Splash.imageset/splash-2732x2732*.png` |
| A-05 | 로고 (영문) | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `store/_raw/logo-2048.png` |
| A-05b | 로고 한글 병기 합성 | MUST | — | — | ☐ | ☐ | ☐ `FE/public/img/ui/logo.png` |
| A-06 | 타이틀 배경 640×360 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/bg/title.png` |
| A-07 | 녹턴 초상 128×160 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/portrait/nocturne.png` |
| A-08a | 카드 프레임 Common | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/ui/card-common.png` |
| A-08b | 카드 프레임 Rare | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/ui/card-rare.png` |
| A-08c | 카드 프레임 Epic | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/ui/card-epic.png` |
| A-09-0 | 인장 공용 링 (분리 생성) | MUST | ☐ | ☐ | ☐ | — | ☐ `store/_raw/seal/ring-1024.png` |
| A-09-1 | 인장 FRAIL 허약 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/seal/seal-frail.png` |
| A-09-2 | 인장 SLOW 둔족 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-slow.png` |
| A-09-3 | 인장 MYOPIA 근시 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-myopia.png` |
| A-09-4 | 인장 GREED 탐욕 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-greed.png` |
| A-09-5 | 인장 BLIND 암야 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-blind.png` |
| A-09-6 | 인장 HUNGER 갈증 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-hunger.png` |
| A-10 | 완전 흡혈귀화 인장 192×192 | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `.../seal-ascension.png` |
| A-11a | 결과 배경 승리 | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/bg/result-win.png` |
| A-11b | 결과 배경 패배 | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/bg/result-lose.png` |
| A-12 | 성소 배경 | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/bg/sanctum.png` |
| A-13a | 버튼 normal / pressed | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `FE/public/img/ui/btn-*.png` |
| A-13b | 패널 프레임 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../panel.png` |
| A-13c | HP / EXP 바 프레임 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../bar-*-frame.png` |
| A-13d | 인간성 심장 2상태 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../heart-full.png`, `heart-empty.png` |
| A-14a | 조이스틱 베이스 96×96 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../joystick-base.png` |
| A-14b | 조이스틱 노브 44×44 | MUST | ☐ | ☐ | ☐ | ☐ | ☐ `.../joystick-knob.png` |
| A-15 | 스크린샷 오버레이 | SHOULD | ☐ | ☐ | ☐ | ☐ | ☐ `store/_raw/overlay-caption.png` |

**합계: 생성 의뢰 19건 / 파생 산출물 포함 35개 파일 그룹**
(itch 커버 삭제로 −1, iOS 파생 A-01b·A-04c 추가로 +2. **iOS는 의뢰를 늘리지 않고 파생만 늘렸다.**)

### 6.2 전역 품질 게이트 (전 자산 공통, 후처리 후 1회)

- [ ] 모든 PNG가 `bloodsworn-palette.png` 로 remap되어 색 수 ≤ 32
- [ ] 투명 배경 자산의 알파가 이진(반투명 픽셀 0개)
- [ ] 모든 다운스케일이 `-filter point` 정수 배율로 수행됨
- [ ] 파일명이 전부 **소문자 + 하이픈** (`14-BUILD-AND-DEPLOY.md` §12-C: Android WebView는 대소문자 구분)
- [ ] 파일명에 한글·공백 없음
- [ ] `FE/public/img/` 아래 자산 총합 ≤ 3 MB
- [ ] 15개 자산을 한 화면에 늘어놓고 봤을 때 **한 게임의 것으로 보인다**
- [ ] `store/_raw/` 에 원본이 전부 보관되어 있다 (재작업 대비)

### 6.3 배포 직전 최종 확인 (Day 7)

**Android (Play 내부테스트)**

- [ ] Play 아이콘: 512×512, 32비트 PNG(알파), ≤ 1024 KB
- [ ] 피처 그래픽: 1024×500, **알파 채널 없음** (`-alpha remove -alpha off` 적용 확인)
- [ ] 스크린샷: 1920×1080 이상, 최소 2장(목표 4~8장), 알파 없음
- [ ] 런처 아이콘이 실기기에서 BLOODSWORN으로 보인다
- [ ] 스플래시가 실기기에서 흰 플래시 없이 뜬다

**iOS (TestFlight 내부테스트)**

- [ ] iOS 아이콘: **정확히 1024×1024**
- [ ] iOS 아이콘: **알파 채널 없음** — `magick identify -format "%A"` 결과가 `False`
- [ ] iOS 아이콘 파일명이 `AppIcon-512@2x.png` 그대로다 (`Contents.json`이 이 이름을 가리킨다)
- [ ] iOS 스플래시 3장이 전부 2732×2732 정사각이다
- [ ] **스크린샷은 확인 대상이 아니다** — 내부 TestFlight에는 필요 없다. Day 7에 만들지 말 것

> ⚠ Android는 알파가 **있어야** 하고 iOS는 알파가 **없어야** 한다. 같은 원본에서 갈라지므로
> **두 파일을 서로 바꿔 올리는 사고**가 이 단계의 가장 흔한 실수다. 크기(512 / 1024)로 구분하면 확실하다.

---

## 7. 관련 문서

| 문서 | 연결점 |
|---|---|
| `01-CONCEPT-AND-STORY.md` | 정본 — 아트 톤(§7), 캐릭터(§5), 세계관(§4). 모든 프롬프트의 근거 |
| `03-GDD-CORE.md` | 정본 — 논리 해상도 640×360(§2.1), UI 레이아웃(§3.1), 조이스틱 규격(§3.2) |
| `04-PACT-SYSTEM.md` | 정본 — 등급 색(§3), 대가 6종(§4), 각성 6종 이름·인용문(§5.3), 최종 각성(§5.4) |
| `14-BUILD-AND-DEPLOY.md` | 스토어 자산 규격(§8), 스크린샷 8장 구성안(§8.1), App Store Connect 절차(§7.5), Day 7 타임라인(§13) |
| `11-ROADMAP-7DAYS.md` | 7일 일정 — 이 문서 §5의 의뢰 배치는 그 일정에 종속된다 |
| `09-ART-AUDIO-AND-ASSET-MAP.md` | 부족 에셋 목록(§3) — 이 문서의 A-xx 항목이 거기 G-xx와 대응한다 |
