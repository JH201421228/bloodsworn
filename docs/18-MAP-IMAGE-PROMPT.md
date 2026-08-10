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
| **스테이지 2 재활용** | 정본 8.2의 "같은 타일셋 + 색조 변경으로 재활용"이 **불가능해진다.** 스테이지 2는 이미 컷 후보 2순위이므로 감수한다 |
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

M-1과 **픽셀 단위로 같은 구도**여야 한다. 같은 장면을 두 가지로 렌더한다고 생각하면 된다.

| 규칙 | 값 |
|---|---|
| 통행 가능(바닥) | **순백 `#FFFFFF`** |
| 통행 불가(벽·기둥·구조물·맵 밖) | **순흑 `#000000`** |
| 중간색 | **금지.** 안티에일리어싱 없이 두 색만 쓴다 |
| 정렬 | 경계는 **16px 격자**에 맞춘다 (게임이 16px 단위로 읽는다) |
| 알파 | 불투명. 투명 픽셀 없음 |

**판정 기준:** 플레이어가 **서 있을 수 있으면 흰색**이다.
벽의 그림자·바닥에 그려진 장식·바닥 문양은 **흰색**(통행 가능)이다.
기둥·벽·석관처럼 **몸이 통과할 수 없는 것만 검정**이다.

---

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

IMAGE B — COLLISION MASK
Same composition, same 1600x1200 canvas, but rendered as a hard two-colour mask:
  PURE WHITE #FFFFFF = the player can stand here (all floor, including areas that merely
                        have decoration painted on them, and the base of walls that is floor)
  PURE BLACK #000000 = the player cannot pass (walls, pillars, sarcophagi, urns, and all
                        area outside the map)
No grey, no anti-aliasing, no gradients, no texture. Only two colours.
All boundaries must land on the 16-pixel grid.
The white regions must exactly match the walkable rectangles listed above, minus any solid
props you drew inside the halls.

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

**M-2 (충돌 마스크)**
- [ ] 정확히 1600 × 1200 px, M-1과 같은 구도
- [ ] **흰색과 검정 두 색만** 쓰였다 (중간색 0개)
- [ ] 경계가 16px 격자에 맞는다
- [ ] 흰색 영역이 §4의 13개 사각형과 일치한다
- [ ] 마스크를 M-1 위에 반투명으로 겹쳤을 때 벽 위치가 어긋나지 않는다 ← **가장 중요**

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

## 11. 관련 문서

- `15-IMAGE-PROMPTS-FOR-CODEX.md` — A-01~A-15 (아이콘·UI·인장 등). 공통 스타일 블록은 그쪽 1.3
- `03-GDD-CORE.md` 8.1 — 맵 규격. **제작 방식이 Tiled에서 이미지로 바뀐 것을 이 문서가 대체한다**
- `09-ART-AUDIO-AND-ASSET-MAP.md` AT-07 — 타일셋 성격 조사 기록
