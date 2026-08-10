# 18. 맵 이미지 생성 프롬프트 (Codex 의뢰용)

> **문서 지위: 실행 문서(Operational).** 정본은 `01-CONCEPT-AND-STORY.md` / `03-GDD-CORE.md` / `04-PACT-SYSTEM.md`.
> 최종 수정: **2026-08-11**
>
> **이 문서는 `15-IMAGE-PROMPTS-FOR-CODEX.md`의 A-01~A-15와 별개다.**
> 스테이지 1 「봉인묘」의 맵을 **Tiled 타일맵이 아니라 통짜 이미지로** 만들기 위한 의뢰서다.

---

## 0. 왜 방식을 바꾸는가

`03-GDD-CORE.md` 8.1은 원래 Tiled 타일맵으로 맵을 제작한다고 규정했다.
실제로 시도한 결과 **타일셋 조립 품질이 요구 수준에 미치지 못했다.**

| 시도 | 방식 | 결과 |
|---|---|---|
| 1 | 바닥 텍스처 + 어두운 사각형을 랜덤 배치 | 벽과 바닥이 구분되지 않음 |
| 2 | 벽면 모듈 4x3을 가중치로 조합 | 벽이 이어지지 않고 파편처럼 흩어짐 |
| 3 | 12x5 벽 템플릿을 가로 반복 | 구조는 잡혔으나 여전히 레퍼런스 수준 미달 |

원인은 명확하다. 원본 타일셋(`szadiart/rogue-fantasy-catacombs`)은 **작가가 손으로 조립하는 것을 전제로 그려진 세트**이고,
모서리·접합부·장식 배치는 프로그램으로 자동 배치해서 나오는 품질이 아니다.

**결론: 맵 한 장을 통째로 그려서 받는다.** 배치 품질을 사람(이미지 생성) 쪽에 맡기고,
게임은 그 이미지를 배경으로 깔고 충돌만 따로 읽는다.

### 0.1 이 방식의 비용 — 받아들이고 가는 것

| 항목 | 영향 |
|---|---|
| **충돌 판정** | 이미지에는 충돌 정보가 없다 → **흑백 마스크 이미지를 한 장 더 받는다**(§2). 이게 이 문서의 핵심 요구사항이다 |
| **수정 비용** | 타일맵은 한 칸만 고칠 수 있지만 이미지는 **전체 재생성**이다. 확정 후 잘 바꾸지 않는다는 전제로 간다 |
| **스테이지 2 재활용** | ⚠ **2026-08-11 정정 — 처음 쓴 "불가능해진다"는 절반이 틀렸다.** 색조 변경 재활용은 오히려 **더 쉬워졌다**(이미지 1장에 `setTint` 한 줄. 타일맵은 타일마다 처리해야 했다). 비싸진 것은 **레이아웃이 다른 맵**뿐이다. 상세: §11 |
| **메모리** | 1600x1200 RGBA = 약 7.7MB VRAM. 정본 성능 목표(적 150체 60fps) 안에서 허용 범위지만 **저사양 기기에서 1차 감시 대상**이다 |
| **애니메이션** | 횃불·촛불은 이미지에 구워 넣으면 멈춘다 → **애니메이션 소품은 이미지에 넣지 않고 스프라이트로 얹는다**(§3) |

---

## 1. 산출물 3종

| # | 파일 | 크기 | 용도 |
|---|---|---|---|
| **M-1** | `map-crypt.png` | **1600 × 1200** | 맵 본체. 바닥·벽·장식이 전부 그려진 완성 이미지 |
| **M-2** | `map-crypt-mask.png` | **1600 × 1200** | **충돌 마스크.** M-1과 **정확히 같은 구도**. 흰색=통행 가능 / 검정=벽 |
| M-3 | `map-crypt-preview.png` | 임의 | (선택) 검수용 축소본 |

**저장 경로**
```
store/_raw/map-crypt-1600x1200.png        생성 원본
store/_raw/map-crypt-mask-1600x1200.png   마스크 원본
FE/public/assets/map/map-crypt.png        게임이 로드하는 본체
FE/public/assets/map/map-crypt-mask.png   빌드 시 충돌 격자로 변환 후 삭제 가능
```

> ⚠ **M-2가 없으면 게임을 만들 수 없다.** 벽에 막히지 않으면 Day 1 Go/No-Go가 실패한다.
> M-1만 받고 마스크를 손으로 그리는 것은 1600x1200에서 현실적이지 않다.

---

## 2. ★ 충돌 마스크 규격 (M-2) — 가장 중요

> ⚠ **2026-08-11 개정 — 1차 마스크가 왜 틀렸는가**
>
> 1차 의뢰에서 마스크는 **§4 좌표표와 픽셀 단위로 정확히 일치**하게 나왔다(x=96, y=128에서 정확히 흰색 시작).
> 규격대로였지만 **쓸 수 없었다.** 그림의 벽이 좌표표 경계보다 **약 27px(1.7타일) 안쪽까지** 그려졌기 때문이다.
> 결과: 플레이어가 납골 벽감 한가운데까지 걸어 들어간다.
>
> **원인은 이 문서다.** §4를 "통행 가능 영역"이라고만 주고 **벽을 그 바깥에 그리라고 명시하지 않았으며**,
> 마스크를 **완성된 그림이 아니라 좌표표에서 뽑아도 되는 것처럼** 읽히게 썼다.
>
> **개정 원칙 두 가지**
> 1. **마스크는 좌표표가 아니라 완성된 그림에서 뽑는다.** 좌표표는 구도 지시용이지 마스크의 근거가 아니다.
> 2. **마스크는 본체와 분리해 2단계로 의뢰한다.** 본체를 먼저 확정하고, 그 이미지를 첨부해 마스크만 따로 받는다.

### 2.1 판정 규칙 — 기준은 "플레이어의 발이 여기 닿아도 되는가"

| 대상 | 색 | 근거 |
|---|---|---|
| 눈에 보이는 바닥면(석재 타일) | **흰색** | |
| **바닥에 놓인 석관·항아리·유골·잔해·상자** | **흰색** | ★ 아래 설명 |
| 바닥 문양(금속 격자·핏자국·이끼·균열) | **흰색** | 그림일 뿐 통행을 막지 않는다 |
| **벽 — 상단 갓돌부터 하단 갓돌까지 전부** | **검정** | 벽 그림 위에 플레이어가 서면 안 된다 |
| 벽에 붙은 것(벽감·창살문·횃불 브래킷) | **검정** | 벽의 일부다 |
| 기둥·독립 구조물 | **검정** | |
| 아치 통로 안쪽의 검은 부분 | **검정** | 지나갈 수 없는 어둠이다 |
| 맵 바깥 여백 | **검정** | |

> ★ **왜 석관과 항아리가 통행 가능인가 — 1차 규격에서 뒤집힌 항목**
> `06-TECH-DESIGN.md` 998행: **"적 ↔ 벽 타일레이어 — 쓰지 않는다. 적은 벽을 통과한다.
> 150체 타일 충돌은 예산 밖."**
> 즉 **적은 장애물을 통과하는데 플레이어만 막힌다.** 이 비대칭 때문에 작은 장애물은
> 전술적 이득이 0이고 플레이어에게만 손해다. 카이팅 중 석관에 걸려 멈추면 그대로 포위당한다.
> 서바이버즈류에서 **걸림(snagging)은 가장 나쁜 조작감**이고, 이 장르의 맵이 개활지인 이유가 이것이다.
> **막는 것은 방의 경계를 이루는 큰 벽뿐이다.**

**벽의 검정 범위:** 벽은 위에서 아래로 [상단 갓돌 → 벽돌 몸통 → 하단 갓돌] 순서로 그려져 있다.
**하단 갓돌까지 전부 검정**이고, 그 바로 아래 첫 바닥 픽셀부터 흰색이다.

### 2.2 기술 규격

| 규칙 | 값 |
|---|---|
| 색 | **순백 `#FFFFFF` 과 순흑 `#000000` 두 가지만.** 중간색·안티에일리어싱 금지 |
| 크기 | M-1과 **완전히 동일**하게 1600 × 1200 |
| 정렬 | 경계를 **16px 격자**에 맞춘다. 애매하면 **벽 쪽으로 반올림**한다(플레이어가 벽에 겹치는 것보다 낫다) |
| 알파 | 불투명. 투명 픽셀 없음 |

### 2.3 ★ 마스크 단독 재의뢰 프롬프트 (그대로 복사 + 완성된 맵 이미지 첨부)

```
=== COLLISION MASK FOR AN EXISTING MAP IMAGE ===

I am attaching a finished top-down pixel-art crypt map, 1600 x 1200 pixels.
DO NOT redraw, restyle, or regenerate the map. The artwork is final.

TASK
Produce ONE new image, exactly 1600 x 1200 pixels, that is a COLLISION MASK of the
attached image. It must be derived from what is actually drawn in the attached picture —
not from any coordinate list, not from an idealised floor plan.

Think of it as tracing: lay the attached image underneath, and paint over it.

TWO COLOURS ONLY
  #FFFFFF pure white  = the player character may stand on this pixel
  #000000 pure black  = the player cannot enter this pixel
No grey. No anti-aliasing. No gradients. No texture. Exactly two unique RGB values.

WHITE — paint these white
  - Every visible stone floor surface
  - Sarcophagi, coffins, urns, pots, crates, skeletal remains and rubble that SIT ON the floor
  - Floor decoration: metal floor grates, blood stains, moss patches, cracks, floor medallions
  (These are walkable on purpose. Enemies in this game pass through obstacles, so any small
   obstacle would only block the player and would feel bad. Only room walls block movement.)

BLACK — paint these black
  - The wall bands that enclose each room, over their FULL height:
    from the light stone coping ledge on top, through the brick body with burial niches,
    down to and including the light stone coping ledge at the bottom.
    White begins at the first floor pixel BELOW the lower coping ledge.
  - Anything mounted on a wall: burial niche grids, barred cell doors, torch brackets
  - Free-standing pillars and structures
  - The dark interior of archways and doorways
  - All area outside the map

GEOMETRY
  - Snap every boundary to the 16-pixel grid.
  - When a boundary falls between grid lines, round TOWARD THE WALL, so that the white
    region is slightly smaller rather than overlapping the wall art.
  - Do not invent walls that are not in the attached image.
  - Do not remove walls that are in the attached image.
  - Every white region must stay connected to its neighbours exactly as the corridors in
    the attached image connect them. Do not seal any room.

OUTPUT
  A single PNG, 1600 x 1200, two colours, no transparency.
```

## 3. 애니메이션 소품은 이미지에 넣지 않는다

아래는 **M-1에 그리지 말 것.** 게임이 스프라이트로 얹는다(이미 보유).

| 소품 | 이유 |
|---|---|
| 횃불 불꽃 (`torch`) | 4프레임 애니메이션. 구워 넣으면 멈춘다 |
| 촛불 (`candle-a` / `candle-b`) | 동일 |
| 가시 함정 (`spike`) | 동일 |

**단, 횃불이 걸리는 "벽걸이 브래킷"과 촛대 받침은 M-1에 그려 넣는다.**
불꽃만 빠진 상태로 그리면 게임이 그 위에 불꽃을 얹는다.
브래킷 위치를 **§5의 좌표 목록으로 받아야** 스프라이트를 정확히 얹을 수 있다.

---

## 4. 맵 구조 — 반드시 이 구조를 지킬 것

게임성 제약에서 나온 구조다. 예쁘게 바꾸더라도 **아래 치수는 바꾸지 않는다.**

```
1600 x 1200 (16px 격자 = 100 x 75 칸)

┌──────────────────────────────────────────────────┐
│                    검은 여백                       │
│   ┌────────────┐              ┌────────────┐     │
│   │            │   ┌──────┐   │            │     │
│   │   홀 NW    │═══│ 회랑 │═══│   홀 NE    │     │
│   │  544x384   │   └──┬───┘   │  544x384   │     │
│   └─────┬──────┘      ║       └──────┬─────┘     │
│         ║          ┌──┴───┐          ║           │
│      ┌──╨───┐      │ 성소  │      ┌──╨───┐       │
│      │ 회랑 │══════│288x192│══════│ 회랑 │       │
│      └──╥───┘      └──┬───┘      └──╥───┘       │
│         ║          ┌──┴───┐          ║           │
│   ┌─────┴──────┐   │ 회랑 │   ┌─────┴──────┐    │
│   │   홀 SW    │═══└──────┘═══│   홀 SE    │     │
│   │  544x368   │              │  544x368   │     │
│   └────────────┘              └────────────┘     │
└──────────────────────────────────────────────────┘
```

**정확한 픽셀 좌표 (좌상단 기준, 통행 가능 영역)**

| 영역 | x | y | 폭 | 높이 |
|---|---|---|---|---|
| 홀 NW | 96 | 128 | 544 | 384 |
| 홀 NE | 960 | 128 | 544 | 384 |
| 홀 SW | 96 | 736 | 544 | 368 |
| 홀 SE | 960 | 736 | 544 | 368 |
| 중앙 성소 | 656 | 512 | 288 | 192 |
| 회랑 상 (NW↔NE) | 640 | 224 | 320 | 192 |
| 회랑 하 (SW↔SE) | 640 | 816 | 320 | 192 |
| 회랑 좌 (NW↔SW) | 272 | 512 | 192 | 224 |
| 회랑 우 (NE↔SE) | 1136 | 512 | 192 | 224 |
| 성소↔회랑상 연결 | 720 | 400 | 160 | 128 |
| 성소↔회랑하 연결 | 720 | 688 | 160 | 144 |
| 성소↔회랑좌 연결 | 448 | 560 | 224 | 96 |
| 성소↔회랑우 연결 | 928 | 560 | 224 | 96 |

> ⚠ **★ 1차에서 빠져 사고가 난 지시 — 반드시 지킬 것**
> **이 사각형은 "플레이어가 실제로 걸어다니는 바닥"이다. 벽은 이 사각형 바깥에 그린다.**
> 벽 그림이 사각형 안쪽을 침범하면 플레이어가 벽 속으로 걸어 들어간다.
> 1차 의뢰에서 벽이 약 27px(1.7타일) 안쪽까지 그려져 마스크를 다시 만들어야 했다.
> 벽의 **하단 갓돌까지 전부** 사각형 바깥이어야 하고, 사각형의 첫 픽셀부터 바닥이어야 한다.
>
> **이 사각형들의 합집합이 흰색(통행 가능)이고 나머지는 전부 검정이다.**
> 홀 안에 기둥을 세우는 것은 자유이나, **한 변이 96px을 넘는 기둥은 놓지 않는다**(적 무리에 갇힌다).
> 기둥을 세우면 그 자리는 마스크에서 검정이 된다.

**플레이어 스폰: (800, 608)** — 성소 중앙. 이 지점 반경 **144px 안에는 아무 구조물도 놓지 않는다.**

---

## 5. 함께 받아야 하는 좌표 목록

이미지만 받으면 스프라이트를 얹을 수 없다. **아래를 텍스트로 함께 요청한다.**

```
1) 벽걸이 횃불 브래킷 좌표 목록  — "torch: x,y" 형식. 불꽃이 붙을 지점(브래킷 상단 중앙)
2) 촛대 좌표 목록                — "candle: x,y"
3) 실제로 그린 기둥/구조물의 사각형 목록 — "solid: x,y,w,h" (마스크 검증용 대조 자료)
```

받은 목록은 `FE/public/assets/map/map-objects.json` 으로 옮긴다.

---

## 6. ★ 영어 프롬프트 전문 (그대로 복사)

```
=== BLOODSWORN — STAGE 1 CRYPT MAP (single large image) ===

TASK
Produce TWO images of the SAME scene at EXACTLY 1600 x 1200 pixels:
  (A) "map-crypt.png"      — the finished top-down crypt map artwork
  (B) "map-crypt-mask.png" — a pure black-and-white collision mask of the same scene

ART STYLE
16-bit top-down pixel art, gothic dark fantasy catacombs. Late-SNES dungeon look.
Chunky deliberate pixels on a strict 16x16 pixel grid. No anti-aliasing anywhere.
Reference style: a stone catacomb with brick burial walls, columbarium niche grids,
skeletal remains in wall alcoves, hanging chains and cobwebs, iron-barred cell doors,
stone sarcophagi, clay urns, and metal floor grates.

TOP-DOWN WALL CONVENTION (important)
This is a top-down view, but walls are drawn with a VISIBLE FRONT FACE, as in classic
top-down pixel dungeons. A wall run reads vertically as:
  1) a light stone coping ledge on top
  2) three rows of dark brick body containing recessed burial niches, separated by
     lighter stone pilasters at regular intervals
  3) a light stone coping ledge at the bottom where it meets the floor
Beyond the outer walls the image is PURE BLACK (#000000) — the unlit void.

STRICT PALETTE (use these and near neighbours only)
  Void / beyond walls : #0B0710 to #000000
  Stone shadow        : #16121C
  Stone body          : #2A2533
  Stone light         : #4A4454
  Stone rim           : #7B7488
  Bone / pale stone   : #C7C2CE
  Blood shadow        : #4A0710
  Blood body          : #8B0F1D
  Candle shadow       : #0E3B3A
  Candle body         : #1E7E74
  Candle light        : #35C9B4
  Gold                : #C9A227
Floor stone should read as a desaturated green-grey. Brick walls read as dark warm brown.
Keep the whole image LOW-KEY and dark — this is an unlit tomb.

LAYOUT — follow these rectangles exactly (x, y, width, height in pixels)
Walkable floor areas:
  Hall NW            96,  128, 544, 384
  Hall NE           960,  128, 544, 384
  Hall SW            96,  736, 544, 368
  Hall SE           960,  736, 544, 368
  Central sanctum   656,  512, 288, 192
  Corridor top      640,  224, 320, 192
  Corridor bottom   640,  816, 320, 192
  Corridor left     272,  512, 192, 224
  Corridor right   1136,  512, 192, 224
  Link top          720,  400, 160, 128
  Link bottom       720,  688, 160, 144
  Link left         448,  560, 224,  96
  Link right        928,  560, 224,  96
Everything OUTSIDE the union of those rectangles is wall or black void.
Surround every walkable area with the wall construction described above.

DECORATION (draw these INTO image A)
- Columbarium niche grids covering large stretches of wall face
- Skeletal remains lying in recessed wall alcoves, with hanging chains and cobwebs
- Iron-barred cell doors set into some wall sections
- Empty wall-mounted torch BRACKETS (metal sconces) — DRAW THE BRACKET BUT NOT THE FLAME
- Empty candle holders — DRAW THE HOLDER BUT NOT THE FLAME
- Stone sarcophagi and clay urns standing on the floor
- Metal floor grates set flush into the floor, one near the centre of each hall
- Moss and rubble creeping along the base of walls
- Give each of the four halls a slightly different floor tone so they read as different rooms

CONSTRAINTS
- Player spawn is at (800, 608). Leave a clear radius of 144 px around it — no obstacles.
- Do not place any solid obstacle wider or taller than 96 px inside a hall.
- Keep corridors completely clear of obstacles.
- Every walkable rectangle must connect to its neighbours — no sealed rooms.

WALL PLACEMENT (critical)
The rectangles listed above are the FLOOR the player actually walks on.
Draw every wall OUTSIDE those rectangles. A wall must never intrude into a listed rectangle,
including its lower stone coping ledge. The first pixel of each rectangle is already floor.

IMAGE B — COLLISION MASK
Derive it from what you actually DREW in image A, not from the rectangle list.
Same 1600x1200 canvas, rendered as a hard two-colour mask:
  PURE WHITE #FFFFFF = the player may stand here
      - all visible stone floor
      - sarcophagi, urns, crates, bones and rubble RESTING ON the floor
      - floor decoration: grates, blood stains, moss, cracks, medallions
        (these are deliberately walkable: enemies in this game pass through obstacles,
         so a small obstacle would block only the player and would feel bad)
  PURE BLACK #000000 = the player cannot enter
      - the wall bands over their full height, from the upper coping ledge through the
        brick body down to and including the lower coping ledge
      - anything mounted on a wall: niche grids, barred doors, torch brackets
      - free-standing pillars, the dark interior of archways, and all area outside the map
No grey, no anti-aliasing, no gradients, no texture. Exactly two unique RGB values.
Snap all boundaries to the 16-pixel grid; when in doubt round TOWARD the wall so the white
region is slightly smaller rather than overlapping wall art.

TECHNICAL
- Exactly 1600 x 1200 pixels. Not 1599, not 1601.
- Pixel grid strictly axis-aligned, 16x16 cells.
- No text, no letters, no numbers, no watermark, no signature, no UI, no grid lines drawn.
- No blur, no depth of field, no lens flare, no glow bloom, no 3D render, no photorealism.

ALSO RETURN AS TEXT
  torch:  x,y   for every torch bracket you drew (point where the flame should sit)
  candle: x,y   for every candle holder you drew
  solid:  x,y,w,h  for every solid prop or pillar you drew inside a hall
```

---

## 7. 네거티브 프롬프트

```
side view, platformer, side-scrolling, isometric, perspective, vanishing point,
3d render, cgi, photorealistic, blur, motion blur, depth of field, bokeh,
anti-aliasing, smooth gradient, airbrush, soft shading, glow bloom, lens flare,
text, letters, numbers, watermark, signature, logo, ui, hud, minimap, grid lines,
bright saturated colors, neon, orange, purple, lime green, cheerful lighting,
white background, cartoon, chibi, cute, modern, sci-fi, wood cabin, forest, outdoor,
grey placeholder blocks, unfinished areas, sealed rooms, maze, narrow corridors
```

---

## 8. 수용 기준 체크리스트

**M-1 (맵 본체)**
- [ ] 정확히 1600 × 1200 px
- [ ] 위에서 내려다본 시점이다 (측면뷰·아이소메트릭이 아니다)
- [ ] §4 표의 13개 사각형이 전부 통행 가능한 바닥으로 그려져 있고 서로 이어진다
- [ ] 스폰 (800, 608) 반경 144px에 구조물이 없다
- [ ] 홀 안 구조물 중 한 변이 96px을 넘는 것이 없다
- [ ] 회랑에 구조물이 없다
- [ ] 벽에 상단·하단 갓돌이 있어 "이어진 벽"으로 읽힌다
- [ ] 횃불 브래킷과 촛대가 그려져 있고 **불꽃은 없다**
- [ ] 팔레트 밖의 색(주황·보라·노랑·형광)이 없다
- [ ] 텍스트·워터마크·격자선이 없다
- [ ] 픽셀 격자가 균일하다 (한 부분만 뭉개지지 않음)

**M-2 (충돌 마스크)** — 2026-08-11 개정
- [ ] 정확히 1600 × 1200 px, M-1과 같은 구도
- [ ] **흰색과 검정 두 색만** 쓰였다 (중간색 0개) — `magick mask.png -format "%k" info:` 가 **2**
- [ ] 경계가 16px 격자에 맞는다
- [ ] ⛔ **흰색 영역이 §4 사각형과 "일치"하는지 보지 않는다.** 1차 실패가 바로 이 검사를 통과했다.
      **그림 위에 겹쳐서 벽과 맞는지**를 본다
- [ ] **벽 그림 전체(상단 갓돌~하단 갓돌)가 검정**이다. 흰색은 하단 갓돌 아래 첫 바닥 픽셀부터 시작한다 ← **가장 중요**
- [ ] **석관·항아리·유골·바닥 격자·핏자국이 흰색**이다 (통행 가능이어야 한다 — §2.1 근거)
- [ ] 아치 통로 안쪽의 검은 부분이 검정이다
- [ ] 방이 봉인되지 않았다 — 회랑이 그림과 같은 위치에서 이어진다

**좌표 목록**
- [ ] torch / candle / solid 좌표가 텍스트로 함께 왔다

---

## 9. 재시도 조정 포인트 (한 번에 하나씩만)

1. 측면뷰로 나옴 → `"Strictly top-down. The camera looks straight down. No horizon, no vanishing point."` 를 프롬프트 맨 앞에 추가
2. 방이 서로 안 이어짐 → §4 좌표표를 프롬프트 **맨 끝에 한 번 더** 반복해 붙인다
3. 마스크에 중간색이 섞임 → `"Image B must contain exactly two unique RGB values: 255,255,255 and 0,0,0."`
4. 마스크가 본체와 어긋남 → 본체를 먼저 확정한 뒤 **"이 이미지를 흑백 통행 마스크로 변환해줘"** 로 2단계 분리 요청
5. 너무 밝음 → `"Much darker. This is an unlit tomb lit only by scattered candles."`
6. 통로가 좁아짐 → `"Corridors must stay at least 192 px wide."`
7. 픽셀이 뭉개짐 → `"Each pixel block must be at least 4 screen pixels. Hard edges only."`

---

## 10. 수령 후 내가 하는 작업

1. `magick identify` 로 두 이미지가 정확히 1600×1200인지 확인
2. 마스크의 고유 색 수를 세어 2개인지 검증 (`magick ... -unique-colors`)
3. 마스크를 16px 격자로 축약해 **충돌 배열(100×75)** 생성 → `map-collision.json`
4. 마스크를 M-1 위에 겹친 대조 이미지를 만들어 **육안 검수**
5. §4 좌표표와 마스크가 일치하는지 프로그램으로 대조
6. `GameScene`을 타일맵 대신 **단일 이미지 + 충돌 배열** 방식으로 교체
7. 좌표 목록으로 횃불·촛불 스프라이트를 얹고 애니메이션 재생
8. 헤드리스 스크린샷으로 전체 조망 + 인게임 확인

---

## 11. 추가 맵 의뢰 조건

> 질문: "맵은 1개면 충분한가?"
> **7일 출시 기준으로는 1개가 맞다.** 다만 알고 가야 할 약점과, 늘릴 때의 조건을 여기 못박는다.

### 11.1 왜 1개인가 — 그리고 무엇이 약점인가

정본은 스테이지 2를 **컷 사다리 1순위**(`16-RISKS` §2)에 뒀고, `01-CONCEPT` §3은
"절차적 던전 생성, 다층 스테이지"를 **명시적 배제 항목**으로 적었다. 맵을 늘리는 건 원래 계획에 없다.

**그러나 실제 플레이 분량을 계산하면 약점이 드러난다.**
`README` 검산표 기준 클리어당 골드 1,318 → 성소 만렙까지 **9~11회 클리어**.
즉 플레이어는 같은 맵을 **10회 이상, 누적 한 시간 넘게** 본다.

서바이버즈류의 리플레이성 주축은 맵이 아니라 빌드(본작은 PACT)이므로 치명적이지는 않다.
**하지만 "알고 가는 약점"이지 "문제 없음"이 아니다.** 판정은 §11.4의 게이트로 한다.

### 11.2 변형 두 종류와 실제 비용

| 변형 | 방법 | 생성 의뢰 | 코드 | 언제 쓸 수 있나 |
|---|---|---|---|---|
| **색조 변형** | 같은 이미지에 `setTint` | **0회** | 한 줄 | 즉시. 런 중 페이즈 전환에도 쓴다(§11.5) |
| **레이아웃 변형** | 새 맵 이미지 + 새 마스크 + 새 좌표 목록 | **1사이클** | 매니페스트 추가 | 첫 장이 수용 기준을 통과한 뒤 |

레이아웃 변형 1개의 비용 = **의뢰 → 수령 → 규격 검증 → 마스크 대조 → 충돌 변환** 왕복 1회.
프롬프트는 이미 있으므로 **§4 좌표표만 갈아끼우면 된다.**

### 11.3 ★ 지금 의뢰에서 같이 받아둘 것 (조건부)

**조건: M-1과 M-2가 §8 수용 기준을 한 번에 통과했을 때만.**

통과했다면 **같은 세션에서 레이아웃 변형 1~2개를 추가로 요청**한다.
프롬프트가 이미 맥락에 있어 재설명 비용이 없고, 산출물은 `store/_raw/`에 보관만 해둔다.
Day 7 이후 스테이지 2를 붙일 때 생성 왕복이 통째로 사라진다.

> ⚠ **첫 장이 재시도에 들어갔다면 변형을 요청하지 않는다.**
> 기준을 못 맞춘 상태에서 장수를 늘리면 재시도 대상만 배로 늘어난다.
> Day 6은 재시도 전용일이고 Day 7은 의뢰 금지일이다(`15-IMAGE-PROMPTS-FOR-CODEX.md` §5.1).

### 11.4 레이아웃 변형에서 바꾸는 것 / 절대 바꾸지 않는 것

**바꾸지 않는다 (바꾸면 게임이 깨지거나 코드를 고쳐야 한다)**
- 캔버스 **1600 × 1200**, 16px 격자 정렬
- 팔레트, 탑다운 벽 표현 규칙(갓돌·몸통·갓돌)
- 마스크 규격 — 두 색만, 16px 정렬
- 스폰 지점 반경 **144px** 무장애물
- 홀 한 변 **최소 320px**, 회랑 폭 **최소 192px** (적 150체 카이팅 하한)
- 홀 안 구조물 한 변 **96px 이하**

**바꾼다 — §4 좌표표뿐이다.**

| 변형안 | 구조 | 성격 |
|---|---|---|
| **A. 십자형** | 중앙 대형 홀 1개 + 4방향 짧은 팔 | 개활지 위주. 카이팅이 가장 쉽다. **밸런스 기준선으로 삼기 좋다** |
| **B. 회랑 순환형** | 가운데를 막고 도넛형 회랑 | 원형 카이팅 강제. 난이도가 올라간다. 스테이지 2 후보 |

### 11.5 런 중 색조 전환 — 거의 공짜인 변화 수단

정본 §11의 **90초 페이즈 전환**에 맞춰 맵 이미지에 tint를 건다. 생성 의뢰 0회, 코드 몇 줄이다.

| 페이즈 | 시각 | tint | 의도 |
|---|---|---|---|
| 1 | 0:00~1:30 | 없음 (`0xffffff`) | 기준 |
| 2 | 1:30~3:00 | `0xc9b8c4` | 미묘하게 차가워진다 |
| 3 | 3:00~4:30 | `0xb89aa4` | 심홍이 스며든다 |
| 4 | 4:30~6:00 | `0xa8848c` | 새벽이 가까워진다 |

> ⚠ tint는 **곱연산**이라 원본보다 밝아지지 않는다. 팔레트 밖으로 나갈 위험이 없다.
> 다만 **너무 세게 걸면 바닥과 벽의 명도차가 무너져 벽이 안 보인다** — 이건 이미 겪은 실패다.
> 값을 바꾼 뒤 반드시 스크린샷으로 벽 시인성을 재확인할 것.

### 11.6 판정 시점

| 시점 | 판정 |
|---|---|
| **Day 4 종료** | 각성 Go/No-Go 실패 → **맵 이야기는 꺼내지 않는다.** PACT 튜닝에 전부 쓴다 |
| **Day 5 종료** | 보스·루프 완결 성공 + 버퍼 남음 → §11.5 색조 전환만 붙인다 (30분) |
| **Day 6** | 재시도 전용일. **신규 맵 의뢰 금지** |
| **Day 7 이후** | 보관해 둔 레이아웃 변형으로 스테이지 2 착수 |

---

## 12. 관련 문서

- `15-IMAGE-PROMPTS-FOR-CODEX.md` — A-01~A-15 (아이콘·UI·인장 등). 공통 스타일 블록은 그쪽 1.3
- `03-GDD-CORE.md` 8.1 — 맵 규격. **제작 방식이 Tiled에서 이미지로 바뀐 것을 이 문서가 대체한다**
- `09-ART-AUDIO-AND-ASSET-MAP.md` AT-07 — 타일셋 성격 조사 기록
