# 18. 맵 에셋 생성 프롬프트 (Codex 의뢰용) — 끝없는 묘지

> **문서 지위: 실행 문서(Operational).** 정본은 `01-CONCEPT-AND-STORY.md` / `03-GDD-CORE.md` / `04-PACT-SYSTEM.md`.
> 최종 수정: **2026-08-11 (3차 개정)**
>
> 스테이지 1 「봉인묘」의 맵 에셋 의뢰서. `15-IMAGE-PROMPTS-FOR-CODEX.md`의 A-01~A-15와 별개다.

---

## 0. 왜 세 번 바뀌었는가 — 그리고 이번 방식이 무엇을 없애는가

| 차수 | 방식 | 결과 |
|---|---|---|
| 1차 | **Tiled 타일맵을 프로그램으로 조립** | 실패. 원본 세트가 손 조립을 전제로 그려져 있어 모서리·접합부 품질이 안 나온다 |
| 2차 | **맵 전체를 통짜 이미지 + 흑백 충돌 마스크** | 실패. 마스크가 좌표표를 따라 그려져 벽과 27px 어긋났다 |
| 3차 | 마스크만 재의뢰 (그림을 따라 그리도록) | **부분 실패.** 벽 대부분은 맞았지만 여전히 어긋나는 구간이 남았다 |

**세 번 모두 같은 뿌리에서 실패했다 — "벽"이라는 개념이다.**
벽이 있으면 그림과 충돌이 픽셀 단위로 일치해야 하는데, 손으로 그린 그림과 기계가 읽는 마스크를
1600×1200 전면에서 완벽히 맞추는 것이 반복적으로 실패했다.

### 4차 방식: 벽을 없앤다

**끝없는 어두운 묘지.** 벽이 없으면 맞출 것이 없다.

| 요소 | 이전 | 이번 |
|---|---|---|
| 바닥 | 1600×1200 통짜 이미지 | **이음매 없는 타일 1장을 무한 반복** |
| 벽 | 그림 + 흑백 마스크 | **없음** |
| 충돌 데이터 | 마스크에서 추출 | **없음** |
| 소품 | 그림에 그려 넣음 | **알파 있는 스프라이트를 게임이 배치** |
| 소품 위치 | 이미지에 고정 | **시드 고정 RNG로 게임이 결정** → 어긋날 수가 없다 |

**소품 좌표를 게임이 정하므로 그림과 충돌이 어긋나는 문제가 구조적으로 사라진다.**

### 0.1 게임성 검토 — 무한 맵이 성립하는가

정본 `03-GDD` 8.1은 "무한 맵 아님, 벽으로 둘러싸임"이었다. **이 항목을 뒤집는다.** 근거:

| 항목 | 판단 |
|---|---|
| 도망쳐서 회피할 수 있는가 | **불가능.** 플레이어 70px/s인데 E1 95 / E3 135 / E7 110px/s다. 적이 더 빠르다 |
| 링 스폰이 성립하는가 | 성립. 스폰은 플레이어 기준 반경 400px 원주이므로 맵 경계와 무관하다 |
| 카이팅 공간 | 오히려 개선. 벽 모서리에 몰려 죽는 사고가 사라진다 |
| 보스전(6:00) | 개활지에서 진행. 패턴이 텔레그래프 기반이라 벽이 필요 없다 |
| 성능 | **개선.** 충돌 타일맵이 통째로 사라진다 |

> ⚠ **정본 수정이 따라온다.** `03-GDD` 8.1의 "무한 맵 아님, 벽으로 둘러싸임"과
> Day 1 Go/No-Go의 **"벽에 막힌다"** 항목이 무효가 된다. 이 문서 확정 시 함께 고친다.

---

## 1. 산출물

| # | 파일 | 크기 | 용도 |
|---|---|---|---|
| **G-1** | `ground-grave.png` | **512 × 512** | ★ **이음매 없이 반복되는** 묘지 바닥 |
| G-2 | `ground-grave-b.png` | 512 × 512 | (선택) 변형 1종. 구역감을 만든다 |
| **P-1** | `props-grave.png` | 512 × 512 | 묘지 소품 시트 (알파 투명) |
| P-2 | `props-grave.json` | — | 소품 시트의 프레임 좌표 목록 |

**저장 경로**
```
store/_raw/                          생성 원본
FE/public/assets/map/ground-grave.png
FE/public/assets/map/props-grave.png
FE/public/assets/map/props-grave.json
```

**충돌 마스크는 더 이상 필요 없다.** 만들지 않는다.

---

## 2. ★ G-1 이음매 없는 바닥 — 이 문서에서 가장 중요한 요구사항

512×512 타일 하나를 가로세로로 무한 반복해 바닥 전체를 만든다.
**이음매가 보이면 화면 전체에 격자무늬가 생겨 못 쓴다.**

| 규칙 | 값 |
|---|---|
| 크기 | **정확히 512 × 512** |
| 반복 | **상하좌우 완전 이음매 없음(seamless / tileable)**. 왼쪽 끝 픽셀과 오른쪽 끝 픽셀이 이어져야 한다 |
| 알파 | **불투명.** 투명 픽셀 없음 |
| 밝기 | **어둡게.** 이 위에 적·플레이어·투사체가 올라간다. 바닥이 밝으면 캐릭터가 안 보인다 |
| 대비 | **낮게.** 강한 무늬는 반복이 눈에 띄고 시각적 노이즈가 된다 |
| 눈에 띄는 특징 | **금지.** 큰 균열·해골·특이한 얼룩은 반복될 때 즉시 격자로 읽힌다. 그런 것은 소품(P-1)으로 뺀다 |

> **검수 방법(내가 자동으로 한다):** 이미지를 2×2로 이어 붙여 경계선이 보이는지 본다.
> 좌우 끝 열과 상하 끝 행의 픽셀 차이도 수치로 잰다.

---

## 3. P-1 소품 시트

512×512 한 장에 소품들을 격자로 배치하고, 각 소품의 위치를 P-2 좌표 목록으로 함께 받는다.

| 소품 | 대략 크기 | 개수 | 비고 |
|---|---|---|---|
| 묘비 (여러 형태) | 24×32 안팎 | 6~8 | 기울어진 것, 깨진 것 섞어서 |
| 석조 십자가 | 24×40 | 3~4 | |
| 작은 석관 | 48×32 | 2~3 | 위에서 본 모습 |
| 마른 나무 / 그루터기 | 40×48 | 2~3 | |
| 뼈 무더기 · 두개골 | 16×16 | 4~6 | 바닥에 흩어놓는 용도 |
| 부서진 담장 조각 | 48×16 | 2~3 | **이어지지 않는 짧은 조각만.** 벽을 만들지 않는다 |
| 꺼진 촛대 / 등불 | 16×24 | 2~3 | 불꽃은 그리지 않는다(게임이 얹는다) |
| 안개 얼룩 | 64×64 | 2 | 반투명. 바닥에 깔아 깊이를 만든다 |

| 규칙 | 값 |
|---|---|
| 배경 | **완전 투명**(알파 0). 배경색을 칠하지 않는다 |
| 시점 | **위에서 내려다본 탑다운.** 단 묘비·십자가처럼 서 있는 것은 앞면이 살짝 보이는 2.5D 표현 허용 |
| 그림자 | 각 소품 발밑에 **타원형 어두운 그림자**를 넣는다. 없으면 바닥에 떠 보인다 |
| 정렬 | 각 소품이 **서로 겹치지 않게** 충분히 띄워 배치 |
| 격자 | 16px 격자에 맞추면 좋지만 필수는 아니다(좌표를 받으므로) |

---

## 4. 게임 쪽 구현 (참고 — 왜 이 규격인가)

- 바닥은 Phaser `TileSprite`로 깐다. 512×512 한 장이 화면 밖까지 무한 반복된다. **월드 경계 없음.**
- 소품은 **시드 고정 RNG**로 배치한다. 같은 시드면 같은 배치가 나오므로 밸런스 검증이 재현 가능하다.
- 소품 밀도는 코드 상수로 조절한다. 이미지를 다시 받지 않아도 "묘비를 더/덜"이 가능하다.
- **소품에 충돌을 걸지 않는다.** 근거: `06-TECH-DESIGN.md` 998행 "적 벽 타일레이어 충돌은 쓰지 않는다.
  적은 벽을 통과한다." 적이 통과하는데 플레이어만 막히면 소품은 전술적 이득 0에 카이팅 걸림만 만든다.

---

## 5. ★ G-1 영어 프롬프트 (그대로 복사)

```
=== SEAMLESS TILEABLE GRAVEYARD GROUND ===

Produce ONE image, exactly 512 x 512 pixels.

CRITICAL REQUIREMENT — SEAMLESS TILING
This image will be repeated edge to edge, infinitely, in both directions.
The right edge must continue perfectly into the left edge, and the bottom edge into the top.
There must be NO visible seam and NO visible repetition pattern when tiled.
Treat this as a true seamless texture, not a standalone picture.

SUBJECT
The ground of an old, unlit graveyard at night, seen from directly above (top-down).
Packed dark earth and patchy dead grass, with scattered flat stone slabs partly sunk
into the soil, thin cracks, small pebbles, and dry roots. Damp, cold, forgotten.

ART STYLE
16-bit top-down pixel art. Chunky deliberate pixels on a 16x16 grid alignment.
No anti-aliasing. Hand-placed pixel look, not a filtered photograph.

PALETTE — keep it dark and low contrast
  Deepest shadow   #0B0710
  Soil shadow      #16121C
  Soil body        #2A2533
  Soil light       #3A3345
  Dead grass dark  #1E2A22
  Dead grass light #2E3A2C
  Stone slab       #4A4454
  Stone slab light #5A5464
Overall value must stay DARK. Characters, enemies and projectiles will be drawn on top of
this and must remain clearly readable, so the ground must never compete with them.

WHAT TO AVOID (these ruin a tiling texture)
  - No large distinctive features: no big cracks, no skulls, no bones, no gravestones,
    no puddles, no single bright spot. Anything eye-catching becomes an obvious grid
    when the tile repeats. Those elements belong in the separate prop sheet.
  - No strong directional lighting. Light must read as flat ambient.
  - No vignette, no gradient across the image, no border, no frame.
  - No text, no watermark, no signature, no grid lines.

TECHNICAL
Exactly 512 x 512 pixels. Fully opaque, no transparency.
No blur, no depth of field, no glow, no 3D render, no photorealism.
```

---

## 6. ★ P-1 영어 프롬프트 (그대로 복사)

```
=== GRAVEYARD PROP SHEET (transparent background) ===

Produce ONE image, exactly 512 x 512 pixels, with a FULLY TRANSPARENT background.

Lay out a set of separate graveyard props on this sheet, spaced apart so that no two
props touch or overlap. Do not draw a background, a frame, or a grid.

PROPS TO INCLUDE (approximate pixel sizes)
  6-8 gravestones, 24x32 each — varied shapes, some tilted, some cracked or broken
  3-4 stone crosses, 24x40
  2-3 small stone sarcophagi seen from above, 48x32
  2-3 dead bare trees or stumps, 40x48
  4-6 small bone piles and skulls, 16x16
  2-3 short broken fence or low wall fragments, 48x16 — SHORT pieces only, they must not
      read as a continuous wall
  2-3 unlit candle holders or lanterns, 16x24 — draw the holder only, NO flame
  2 soft fog patches, 64x64, semi-transparent

VIEW
Top-down. Objects that stand upright (gravestones, crosses, trees) may show a little of
their front face, as is normal in top-down pixel games. Objects that lie flat
(sarcophagi, bones, fog) are seen straight from above.

SHADOWS
Give every standing prop a soft dark elliptical shadow at its base, otherwise it will
look like it is floating above the ground.

ART STYLE AND PALETTE
16-bit top-down pixel art, gothic graveyard at night. No anti-aliasing.
  Stone shadow #16121C   Stone body #2A2533   Stone light #4A4454   Stone rim #7B7488
  Bone / pale stone #C7C2CE   Dead wood #2A2018   Moss #1E2A22
  Cold accent (metal, lantern glass) #1E7E74
Keep everything dark and desaturated so it sits on a dark ground without glowing.

TECHNICAL
Exactly 512 x 512 pixels. Background fully transparent (alpha 0), not black, not white.
No text, no watermark, no frame, no grid lines, no drop shadow outside the sprite.

ALSO RETURN AS TEXT
For every prop you drew, one line:
  name, x, y, w, h
using pixel coordinates on the 512x512 sheet, where x,y is the top-left corner of the
prop's bounding box.
```

---

## 7. 네거티브 프롬프트 (공통)

```
seam, visible tile edge, repeating pattern, grid lines, border, frame, vignette,
gradient background, spotlight, strong directional light,
side view, isometric, perspective, vanishing point, 3d render, cgi, photorealistic,
blur, motion blur, depth of field, glow bloom, lens flare, anti-aliasing, smooth shading,
text, letters, numbers, watermark, signature, logo, ui, hud,
bright saturated colors, neon, orange, purple, lime green, cheerful, daylight, sunny,
white background, black background (for the prop sheet), cute, cartoon, chibi
```

---

## 8. 수용 기준

**G-1 바닥**
- [ ] 정확히 512 × 512, 불투명
- [ ] ★ **2×2로 이어 붙였을 때 이음매가 보이지 않는다** ← 자동 검증한다
- [ ] 반복했을 때 눈에 띄는 격자무늬가 생기지 않는다 (큰 특징이 없다)
- [ ] 충분히 어둡다 — 이 위의 캐릭터가 또렷하게 읽힌다
- [ ] 팔레트 밖의 색이 없다. 텍스트·워터마크·테두리 없음

**P-1 소품**
- [ ] 정확히 512 × 512, **배경 알파 0** (검정이나 흰색이 아니다)
- [ ] 소품끼리 겹치지 않는다
- [ ] 서 있는 소품에 발밑 그림자가 있다
- [ ] 촛대에 불꽃이 없다
- [ ] 담장 조각이 짧다 (벽으로 읽히지 않는다)
- [ ] 좌표 목록이 텍스트로 함께 왔다

---

## 9. 재시도 조정 포인트 (한 번에 하나씩만)

1. 이음매가 보임 → `"This must be a SEAMLESS TILEABLE texture. Wrap the pattern so the right edge continues into the left edge and the bottom into the top."` 를 맨 앞으로 옮긴다
2. 반복이 격자로 보임 → `"Remove all large or distinctive features. Keep the texture uniform and quiet."`
3. 너무 밝음 → `"Much darker. Unlit graveyard at night. Characters must read clearly on top."`
4. 소품 배경이 검정 → `"The background must be alpha 0 transparent, not black."`
5. 소품이 측면뷰 → `"Top-down view. The camera looks straight down."`
6. 담장이 길게 이어짐 → `"Fence pieces must be short isolated fragments, never a continuous wall."`

---

## 10. 수령 후 내가 하는 작업

1. `magick identify` 로 크기·알파 확인
2. **이음매 자동 검증** — 2×2 타일링 후 경계 열/행의 픽셀 차이를 수치로 측정
3. 소품 시트를 좌표 목록대로 잘라 개별 프레임으로 등록
4. `GameScene`을 **TileSprite 무한 바닥 + 시드 고정 소품 배치**로 교체
5. 충돌 타일맵 제거 (더 이상 필요 없다)
6. 정본 `03-GDD` 8.1의 "무한 맵 아님, 벽으로 둘러싸임"과 Day 1 Go/No-Go의 "벽에 막힌다" 수정
7. 헤드리스로 전체 조망 + 인게임 + 150체 스트레스 재확인

---

## 11. 관련 문서

- `15-IMAGE-PROMPTS-FOR-CODEX.md` — A-01~A-15 (아이콘·UI·인장)
- `03-GDD-CORE.md` 8.1 — 맵 규격. **이 문서가 제작 방식을 대체하며, 무한 맵 여부도 뒤집는다**
- `06-TECH-DESIGN.md` 5.2 — 적은 벽을 통과한다(소품에 충돌을 걸지 않는 근거)

---

## 12. ★ stage2~5 의 의뢰서는 이 문서에 없다 — `26` §7 이 갖는다 (2026-08-13)

> 이 절은 의뢰서가 아니라 **길잡이와 사실 기록**이다. 같은 표를 두 문서에 적으면
> 반드시 한쪽만 고치게 된다(§10 이 `props-grave.json` 좌표로 이미 겪은 종류의 사고다).

### 12.1 이 문서의 범위

이 문서는 **stage1 「봉인묘」 한 곳의 의뢰서**다. §1 의 산출물 4개(G-1·G-2·P-1·P-2)가 전부이고,
`ground-grave.png` · `props-grave.png` · `props-grave.json` 로 **수령이 끝났다.**

stage2~5(잿빛 성당 · 역병 늪 · 무너진 첨탑 · 지옥문)의 의뢰서는
**`26-STAGES-AND-BOSSES.md` §7** 이 갖는다. 이 문서의 서식(§1 산출물표 → §2·§3 규격표 →
§5·§6 영어 프롬프트 → §7 네거티브 → §8 수용 기준 → §10 수령 후 작업)을 §7.2~§7.9 가
그대로 승계해 이미 완성돼 있다. 여기에 다시 쓰지 않는다.

### 12.2 사실 확정 — 아트가 「어딘가에 있는데 안 구워진 것」이 아니다

2026-08-13 전수 조사 결과다. 절차 생성으로 흉내내지 않기로 한 판단의 근거이기도 하다.

| 확인한 곳 | 결과 |
|---|---|
| `FE/public/assets/map/` | `ground-grave.png` · `props-grave.png` · `props-grave.json` **3개뿐** |
| `asset/tilemap/` | 촛대·횃불·가시·`mainlevbuild.png` 뿐. 바닥 원본 **0건** (`asset/map/` 은 폴더 자체가 없다) |
| `store/_raw/` | 맵 관련 4개 전부 **폐기된 2·3차 방식**(통짜 이미지 + 흑백 충돌 마스크)의 산출물 |
| 저장소 전체 파일명 | `*cathedral*` `*mire*` `*spire*` `*hellgate*` **0건** |
| `FE/tools/build-assets.mjs` | 맵 처리부가 **없다.** `buildTiles()` 는 정의만 있고 호출되지 않으며, 244행이 참조하는 `build-map.mjs` 는 **존재하지 않는 파일**이다 |
| `ground-grave.png` 를 굽는 코드 | **없다.** 이 파일은 §10 절차대로 수령 후 손으로 놓은 것이다 |

→ **원본이 없다.** 파이프라인이 안 굽는 것이 아니라 그릴 것을 아직 안 받았다.
그래서 답은 「굽기」가 아니라 「의뢰」이고, 의뢰서는 §12.1 대로 이미 있다.

⚠ **절차 생성으로 4장을 만들지 않는다.** `tools/build-decals.mjs` 가 데칼에 대해 그것을 한 것은
원·고리·등간격 눈금이 **기하학**이라 좌표 계산으로 정확히 나오기 때문이다(`33` §0.3).
바닥 타일은 반대다 — 이 문서 §0 이 세 번 실패하며 얻은 결론이 "이음매와 반복 인지"이고,
그건 손맛의 영역이다. 절차 생성 타일을 넣으면 **6개 스테이지가 같아 보이는 문제가
"6개 스테이지가 전부 기계 무늬로 보이는 문제"로 바뀔 뿐**이다. 지금의 tint 폴백은
적어도 **정상적인 묘지 바닥**이다.

### 12.3 지금의 폴백은 의도된 것이다 — 그것을 알리는 자리

- 코드: `StageSystem.applyGround()` 가 `textures.exists()` 로 확인한 뒤 내려간다.
  `GroundSystem.setTheme()` 이 한 번 더 확인한다(이중 방어라 초록 체크무늬가 안 뜬다).
- 데이터: `stages.json` 의 `fallbackTexture` / `fallbackProps` 가 **명시적으로** `grave` 를 가리킨다.
- 표시: `npm run validate` 의 **경고 8건**(stage2~5 x texture/props)이 이 미수령을 화면에 남긴다.
  2026-08-13 에 문구를 "없음"에서 **"미수령 — … + tint 로 내려간다 (의뢰서 docs/26 §7)"** 로
  바꿨다. 오타로 읽히던 것을 **일감으로** 읽히게 한 것이고, **위반으로 올리지 않았다** —
  폴백이 실제로 동작해 화면이 안 깨지기 때문이다. `--strict` 를 붙이면 그때 exit 1 이 된다.
- 매니페스트: `FE/public/assets.json` 머리 주석에 같은 내용을 한 문단으로 적었다.

### 12.4 관련 문서

- `26-STAGES-AND-BOSSES.md` §7 — **stage2~5 의뢰서 본문**(§7.1 폴백 실태 · §7.4 스테이지별 팔레트 · §7.5 프롬프트 템플릿 · §7.9 수령 후 작업 · §7.10 수령 전 막힌 곳)
- `16-RISKS-AND-SCOPE-CUTS.md` §5 — stage2~5 배경이 **P1 이지 P0 이 아닌** 근거
