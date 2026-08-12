# 32 · 룬·조우·성소 아이콘 이미지 의뢰 (Codex 의뢰용) — 38종

> 대상: `FE/public/assets/icons/runes.png`(신규) + `FE/src/data/rune-icon-frames.json`(신규)
> 선행 정본: `29-ICON-IMAGE-PROMPTS`(1차 의뢰 · **격자 규격을 그대로 승계한다**)
> · `30-ENCOUNTERS-AND-FIELD-EVENTS`(조우 7종) · `31-RUNE-EVOLUTION-TREE`(룬 24종)
> · `09-ART-AUDIO-AND-ASSET-MAP`(팔레트)

---

## 0. 왜 이 의뢰를 하는가

### 0.1 지금 이 자리에 그림이 없다

| 자리 | 현재 상태 | 근거 |
|---|---|---|
| **룬 24종** | 유니코드 글리프 (`⬢ ✦ ◈ ▲`) | `31` §6.3 — 아트 없이 출발하려고 일부러 둔 폴백 |
| **보물상자** | **11x9 노란 사각형** | `SpawnSystem.js:145` `scene.add.rectangle(..., 0xd9b45a)` |
| **조우 방향 표시** | 없음 | `30` §4.3 이 요구한다 |
| **성소 업그레이드 6종** | **컬러 이모지** (`🛡 ⚔ 👟 ⬤ ✦ 📜`) | `sanctum.json` |

컬러 이모지는 **기기마다 다른 그림이 나온다.** 삼성·구글·애플이 각자 다른 서체를 쓰므로
같은 게임이 폰마다 다르게 보인다. 그리고 이 게임의 팔레트(피·재·검정)와 정반대인
알록달록한 그림이 성소 화면 한복판에 6개 박혀 있다.

### 0.2 이 의뢰가 실패해도 게임은 안 멈춘다

1차 의뢰(`29`)와 같은 원칙이다. **38종 전부 폴백이 이미 동작 중이다.**
- 룬 → 유니코드 글리프
- 상자 → 노란 사각형 (보기 싫지만 동작한다)
- 조우 화살표 → 도형 삼각형
- 성소 → 이모지

시트가 안 오거나 품질이 나쁘면 **`runes.png` 를 매니페스트에서 빼면 전부 폴백으로 되돌아간다.**
코드 롤백이 필요 없다. 이것이 이 프로젝트가 아트를 붙이는 방식이다.

### 0.3 1차 의뢰에서 물려받은 것

`29` §0.3 의 실패 목록을 그대로 승계한다. 특히:
- **격자가 어긋나면 71칸이 전부 밀린다.** → `29` §2.3 의 「2px 여백」 규칙을 그대로 쓴다
- **정수배가 아닌 축소는 픽셀아트를 뭉갠다** → `29` §7.2 의 검수 절차를 그대로 쓴다
- **셀 순서를 바꾸면 전부 틀어진다** → §3 의 매니페스트가 절대 기준이다

---

## 1. 산출물

| # | 파일 | 규격 |
|---|---|---|
| 1 | `runes.png` | **384 x 128**, RGBA, 배경 완전 투명 |
| 2 | (선택) `runes@2x.png` | 768 x 256 — 있으면 정수배 축소로 검수에 쓴다 |

**1장만 받는다.** 이유는 `29` §2.1 과 같다 — 텍스처 바인드 1회로 고정된다.
지금 GPU 예산은 15.65MB 이고(`assets.json` 실측) 이 시트는 **192KB(RGBA8888 기준)** 를 더한다.

---

## 2. 격자 규격 — `29` 를 그대로 승계한다

```
384 x 128  =  12열 x 4행  =  48칸,  칸 하나 32 x 32
```

| 항목 | 값 | 왜 |
|---|---|---|
| 칸 크기 | **32 x 32** | `29` 와 동일. 검수 스크립트를 그대로 재사용한다 |
| 열 | **12** | `29` 와 동일 |
| 행 | **4** | 38종 → 48칸. 남는 10칸은 예비다 |
| 칸 안쪽 여백 | **사방 2px 비움** → 실제 그림은 **28 x 28** | ★ `29` §2.3. 격자 어긋남을 기계가 잡아내는 유일한 수단이다 |
| 배경 | **완전 투명 (alpha 0)** | 시트 네 모서리와 빈 칸은 반드시 alpha 0 |

★ **2px 여백이 검수의 전부다.** 그림이 칸 경계에 닿으면 격자가 1px 밀렸는지 그림이 큰 건지
구분할 수 없다. 여백이 있으면 스크립트가 "경계 2px 안에 불투명 픽셀이 있다 = 실패"로
기계 판정할 수 있다. `29` §7.4 의 스크립트를 인자만 바꿔 그대로 돌린다.

### 2.1 실제 표시 크기

룬 아이콘은 **좌판 위 20 논리px**, 성소 카드에서 **24 논리px**, 조우 화살표는 **16 논리px** 로 표시된다.
32px 로 그리지만 화면에서는 그보다 작다. → **디테일을 넣지 마라.** 20px 에서 사라지는 선은
안 그리느니만 못하다. 실루엣과 색 대비만으로 읽혀야 한다.

---

## 3. ★ 칸 순서 (절대 바꾸지 않는다)

행 우선(row-major), 0-based 프레임 인덱스. Phaser `spritesheet` 로더가 이 순서로 센다.

### 3.1 룬 24종 — 칸 00~23

무기별로 6칸씩 연속이다. 순서는 **T1a, T1b, T2a, T2b, T3a, T3b**.

| 칸 | id | 이름 | 그릴 것 |
|---|---|---|---|
| 00 | `rn_w1_maw` | 벌어진 아가리 | 크게 벌어진 송곳니 턱, 위아래로 벌어진 각도가 강조된 실루엣 |
| 01 | `rn_w1_reach` | 긴 이빨 | 길고 가는 송곳니 한 쌍, 세로로 뻗은 형태 |
| 02 | `rn_w1_riposte` | 되받아치기 | 서로 교차하는 짧은 칼자국 2개, 되받는 방향의 화살 꼬리 |
| 03 | `rn_w1_drain` | 피 빨기 | 아래로 떨어지는 핏방울을 빨아들이는 소용돌이 |
| 04 | `rn_w1_circle` | 선혈의 원 | ★ 진화. 완전한 붉은 원환, 안쪽에 방사형 칼자국 |
| 05 | `rn_w1_wave` | 참격 파동 | ★ 진화. 앞으로 퍼지는 초승달 참격 3겹 |
| 06 | `rn_w2_twin` | 쌍포 | 나란한 불꽃 탄환 2발 |
| 07 | `rn_w2_pierce` | 꿰뚫는 불 | 판을 관통한 불꽃 화살, 뒤쪽에 뚫린 구멍 |
| 08 | `rn_w2_burst` | 작렬 | 중심에서 터지는 불꽃, 파편이 사방으로 |
| 09 | `rn_w2_seek` | 불의 눈 | 불꽃 안의 눈동자, 곡선 궤적 하나 |
| 10 | `rn_w2_meteor` | 유성우 | ★ 진화. 비스듬히 떨어지는 유성 3발, 꼬리 |
| 11 | `rn_w2_chain` | 연쇄 화염 | ★ 진화. 점 3개를 잇는 갈지자 불꽃 사슬 |
| 12 | `rn_w3_more` | 더 많은 뼈 | 부챗살로 놓인 뼈 조각 4개 |
| 13 | `rn_w3_wide` | 넓은 궤도 | 큰 원 궤도 위의 뼈 하나, 궤도선 점선 |
| 14 | `rn_w3_counter` | 역회전 | 서로 반대로 도는 원 2겹, 화살표 방향이 반대 |
| 15 | `rn_w3_shard` | 뼈 파편 | 쪼개진 뼈 파편이 흩어지는 순간 |
| 16 | `rn_w3_grinder` | 분쇄기 | ★ 진화. 톱니처럼 뼈가 박힌 원, 팽창을 뜻하는 이중 외곽선 |
| 17 | `rn_w3_launch` | 뼈 사출 | ★ 진화. 궤도에서 튀어나가는 뼈 창 하나, 뒤에 궤도 호 |
| 18 | `rn_w4_more` | 넘치는 성수 | 성수 방울 3개가 떨어지는 모습 |
| 19 | `rn_w4_wide` | 퍼지는 성수 | 넓게 번지는 원형 웅덩이, 동심원 파문 |
| 20 | `rn_w4_linger` | 마르지 않음 | 모래시계 위에 얹힌 성수 방울 |
| 21 | `rn_w4_cleanse` | 정화 | 사슬에 묶인 발, 끊어지는 고리 (둔화를 뜻한다) |
| 22 | `rn_w4_sanctuary` | 성역 | ★ 진화. 사람을 감싸는 빛의 원, 중앙에 작은 인영 |
| 23 | `rn_w4_smite` | 낙뢰 | ★ 진화. 웅덩이 중심에 내리꽂히는 번개 |

★ **T3(진화) 6칸 — 04, 05, 10, 11, 16, 17, 22, 23 — 은 나머지보다 확실히 화려해야 한다.**
정확히는 8칸이다(무기 4종 x 2). 런에서 1~2개만 보는 것이라 "이건 특별하다"가 즉시 읽혀야 한다.
**외곽에 옅은 후광(halo)을 넣어라.** T1/T2 에는 후광을 넣지 마라 — 그 대비가 등급 표시다.

### 3.2 보물상자 2종 — 칸 24~25

| 칸 | id | 그릴 것 |
|---|---|---|
| 24 | `chest_closed` | 닫힌 궤. 검은 무쇠 띠 + 낡은 나무. 자물쇠에 봉인 문양. **바닥에 놓인 것**처럼 살짝 아래로 |
| 25 | `chest_open` | 열린 궤. 뚜껑이 뒤로 젖혀지고 안에서 붉은 빛이 새어 나온다 |

★ 이 두 칸이 **가장 급하다.** 지금 화면에 노란 사각형으로 나온다.
★ 상자는 바닥에 놓이므로 **위에서 살짝 내려다본 각도**여야 다른 바닥 오브젝트와 어울린다.

### 3.3 조우 방향 표시 6종 — 칸 26~31

화면 밖 조우의 방향을 알리는 가장자리 마커다(`30` §4.3). **16 논리px 로 표시된다** —
극단적으로 단순해야 한다. 실루엣 하나로 구분되어야 한다.

| 칸 | id | 그릴 것 |
|---|---|---|
| 26 | `enc_merchant` | 동전 주머니 |
| 27 | `enc_witch` | 뾰족한 마녀 모자 |
| 28 | `enc_seer` | 눈을 가린 띠 |
| 29 | `enc_shady` | 물음표가 새겨진 두건 |
| 30 | `enc_altar` | 제단 — 세 단짜리 계단 위의 그릇 |
| 31 | `enc_fieldboss` | 뿔 달린 해골 |

### 3.4 성소 업그레이드 6종 — 칸 32~37

**컬러 이모지를 대체한다.** 성소 화면에서 24 논리px 로 표시된다.

| 칸 | id | 이름 | 현재 이모지 | 그릴 것 |
|---|---|---|---|---|
| 32 | `meta_tough` | 강인함 | 🛡 | 무쇠 방패. 가운데 세로 이음매, 못 4개 |
| 33 | `meta_sharp` | 예리함 | ⚔ | 교차한 검 2자루, 날에 붉은 반사광 |
| 34 | `meta_swift` | 신속 | 👟 | 날개 달린 발, 뒤에 속도선 2줄 |
| 35 | `meta_greed` | 탐욕 | ⬤ | 쌓인 금화 더미 (3~4닢) |
| 36 | `meta_awaken_boost` | 각성 촉진 | ✦ | 육각 인장 안의 눈. `seal-*.png` 계열과 어울리게 |
| 37 | `meta_recontract` | 재계약 | 📜 | 밀랍 봉인이 깨진 두루마리 |

### 3.5 예비 — 칸 38~47

**완전히 비운다 (alpha 0).** 검수 스크립트가 이 10칸이 진짜 비었는지 검사한다.

---

## 4. 팔레트

`29` §3.2 의 확정 팔레트를 **그대로** 쓴다. 새 색을 만들지 마라 — 아이템 아이콘 71종과
같은 화면에 나오므로 색이 어긋나면 붙여넣은 것처럼 보인다.

| 역할 | HEX | 쓰는 곳 |
|---|---|---|
| 피 (주) | `#8B1A1A` | 룬 W1 계열, 진화 후광, 상자 내부 빛 |
| 피 (밝음) | `#C0392B` | 강조, 반사광 |
| 불 | `#E2703A` | 룬 W2 계열 |
| 뼈 / 재 | `#D8D3C6` | 룬 W3 계열, 해골 |
| 성수 (창백한 청) | `#7FA8B0` | 룬 W4 계열 |
| 무쇠 | `#4A4A4A` | 상자 띠, 방패, 검 |
| 낡은 나무 | `#6B4A2F` | 상자 몸통 |
| 금 | `#C9A227` | 금화, 봉인 |
| 외곽선 | `#1A1216` | ★ 모든 아이콘의 외곽선 |

★ **외곽선은 검정이 아니라 `#1A1216`(아주 어두운 자주)** 이다. 순검정은 이 게임의
어두운 배경 위에서 형태가 사라진다.

---

## 5. ★ 영어 프롬프트 전문 (그대로 복사)

### 5.0 전달 방법

`29` §5.0 과 동일하다. **§5.1 본문 + §5.2 CELL MANIFEST 를 이어서 한 번에** 전달한다.
매니페스트를 빼면 칸 순서가 반드시 틀어진다.

### 5.1 프롬프트 본문

```text
Create ONE transparent PNG sprite sheet of 32x32 pixel-art icons for a dark
gothic vampire roguelite mobile game.

CANVAS AND GRID (absolute requirements)
- Output size: exactly 384 x 128 pixels. RGBA with a fully transparent background.
- Grid: exactly 12 columns x 4 rows = 48 cells. Each cell is exactly 32 x 32 px.
- Cell (col, row) occupies x = col*32 .. col*32+31, y = row*32 .. row*32+31,
  with col and row both 0-based, filled in ROW-MAJOR order (left to right,
  then top to bottom).
- INSIDE EACH CELL, leave a 2 px fully transparent margin on all four sides.
  All artwork must fit inside the inner 28 x 28 px area. This margin is how the
  grid alignment is machine-verified; art touching a cell edge is a hard failure.
- Cells 38 through 47 (the last 10) must be COMPLETELY EMPTY (alpha 0).
- The four corners of the whole sheet must be alpha 0.

ART STYLE
- True pixel art. Hard 1 px edges. NO anti-aliasing, NO gradients, NO blur,
  NO soft shadows, NO drop shadows outside the silhouette.
- Limited palette, flat color fills with at most 2 shading steps per material.
- Every icon has a 1 px outline in #1A1216 (very dark plum, NOT pure black).
- Readable as a SILHOUETTE first. These icons are displayed at 12 to 24 px on a
  phone, far smaller than 32 px. Omit fine detail; it disappears and only adds noise.
- Front-facing or slight top-down 3/4 view. Consistent light source from the
  upper left across all icons.

PALETTE (use these, do not invent new hues)
- blood dark      #8B1A1A
- blood bright    #C0392B
- fire            #E2703A
- bone / ash      #D8D3C6
- holy water pale #7FA8B0
- iron            #4A4A4A
- old wood        #6B4A2F
- gold            #C9A227
- outline         #1A1216

TIER EMPHASIS (important)
- Cells 4, 5, 10, 11, 16, 17, 22, 23 are "evolution" runes. These EIGHT cells,
  and only these, get a faint 1-2 px outer glow / halo in the icon's own hue,
  still inside the 28x28 inner area. All other cells have NO glow. This contrast
  is how the player reads rarity, so it must be obvious but must not bleed into
  the 2 px margin.

MOOD
Grim, weathered, occult. Iron, bone, dried blood, candle light. Nothing cute,
nothing shiny-clean, no modern or sci-fi shapes, no text or letters anywhere.

Draw exactly the 48 cells listed in the CELL MANIFEST below, in that exact order.
Do not reorder, do not skip, do not add extra icons.
```

### 5.2 CELL MANIFEST (§5.1 바로 뒤에 이어 붙인다 — 48줄 전부)

```text
CELL MANIFEST (index: col,row - subject)

00: 0,0 - wide-open fanged jaw, upper and lower fangs spread apart, blood dark
01: 1,0 - a pair of long slender fangs pointing down, blood dark
02: 2,0 - two short crossed slash marks with a curved return arrow, blood bright
03: 3,0 - falling blood droplets pulled into a small spiral, blood dark
04: 4,0 - a complete blood-red ring with radial slash marks inside, faint halo
05: 5,0 - three nested crescent slash waves spreading forward, faint halo
06: 6,0 - two small fireball projectiles side by side, fire
07: 7,0 - a fire arrow piercing through a plate, hole visible behind, fire
08: 8,0 - a fire burst exploding outward with scattered shards, fire
09: 9,0 - an eye inside a flame with one curved trajectory line, fire
10: 10,0 - three meteors falling diagonally with tails, fire, faint halo
11: 11,0 - a zigzag chain of flame linking three points, fire, faint halo
12: 0,1 - four bone shards arranged like a fan, bone
13: 1,1 - a single bone on a large dotted orbit circle, bone
14: 2,1 - two concentric rings with arrows pointing opposite ways, bone
15: 3,1 - a bone splitting into scattered fragments, bone
16: 4,1 - a ring studded with bone teeth like a sawblade, double outline, faint halo
17: 5,1 - a bone spear launching off an orbit arc, bone, faint halo
18: 6,1 - three falling droplets of pale holy water
19: 7,1 - a spreading circular puddle with concentric ripples, holy water pale
20: 8,1 - an hourglass with a holy water droplet resting on top
21: 9,1 - a shackled foot with one chain link breaking, iron and holy water pale
22: 10,1 - a ring of pale light enclosing a tiny human figure, faint halo
23: 11,1 - a lightning bolt striking down into a pale puddle, faint halo
24: 0,2 - a closed treasure chest, old wood body with iron bands, sealed lock,
          slight top-down view, resting on the ground
25: 1,2 - the same chest open, lid tilted back, red light spilling out
26: 2,2 - a small coin pouch, old wood and gold
27: 3,2 - a pointed witch hat, blood dark and iron
28: 4,2 - a blindfold band across empty space, bone colored cloth
29: 5,2 - a hood with a question mark carved on it, iron
30: 6,2 - a three-step stone altar with a bowl on top, iron
31: 7,2 - a horned skull, bone
32: 8,2 - an iron shield with a vertical seam and four rivets
33: 9,2 - two crossed swords with blood-bright highlights on the blades
34: 10,2 - a winged boot with two speed lines behind it
35: 11,2 - a stack of three or four gold coins
36: 0,3 - a hexagonal sigil with an eye at its center, blood dark
37: 1,3 - a scroll with a broken wax seal, old wood and gold
38: 2,3 - EMPTY (fully transparent)
39: 3,3 - EMPTY (fully transparent)
40: 4,3 - EMPTY (fully transparent)
41: 5,3 - EMPTY (fully transparent)
42: 6,3 - EMPTY (fully transparent)
43: 7,3 - EMPTY (fully transparent)
44: 8,3 - EMPTY (fully transparent)
45: 9,3 - EMPTY (fully transparent)
46: 10,3 - EMPTY (fully transparent)
47: 11,3 - EMPTY (fully transparent)
```

---

## 6. 네거티브 프롬프트

`29` §6 을 그대로 쓴다. 요지만 다시 적는다.

```text
NOT allowed: anti-aliasing, gradients, gaussian blur, soft or glowing edges
outside the described halo, drop shadows, text, letters, numbers, watermarks,
signatures, borders or frames around cells, visible grid lines, background color
of any kind, 3D rendering, vector-smooth curves, cute or chibi styling, modern
or sci-fi objects, photorealism, JPEG artifacts.
Do NOT resize, crop, or pad the canvas. Do NOT change the cell order.
```

---

## 7. 수령 검수 — 눈으로 보기 전에 기계로 본다

`29` §7 의 스크립트를 **인자만 바꿔** 그대로 돌린다. 규격이 같기 때문에 재작성이 필요 없다.

| # | 검사 | 통과 조건 |
|---|---|---|
| V-1 | 치수·채널 | 정확히 384x128, RGBA |
| V-2 | 정수배 축소 | `@2x` 를 받았다면 768x256 → 정확히 1/2 축소 후 재측정 |
| V-3 | 투명 배경 | 시트 네 모서리 alpha 0 |
| V-4 | ★ 격자 정렬 | **모든 칸의 바깥 2px 테두리에 불투명 픽셀 0개** |
| V-5 | 빈 칸 | 칸 38~47 이 완전히 alpha 0 |
| V-6 | 팔레트 | 고유 색 수가 24 이하. 초과 시 안티에일리어싱을 의심한다 |
| V-7 | 후광 대비 | 칸 4·5·10·11·16·17·22·23 의 불투명 픽셀 수가 같은 무기의 T1/T2 보다 많다 |

★ **V-4 가 이 검수의 핵심이다.** 하나라도 걸리면 시트 전체를 다시 받는다.
칸 하나만 밀려도 그 뒤 47칸이 전부 어긋나기 때문에 부분 수정이 불가능하다.

---

## 8. 수령 후 배선

1. `FE/public/assets/icons/runes.png` 에 놓는다
2. `FE/public/assets.json` 에 spritesheet 로 등록 (frameWidth/frameHeight 32)
   — ★ **`PreloadScene.js` 는 고치지 않는다.** 이 프로젝트 규약이다
3. `runes.json` 의 각 룬 `icon` 필드에 프레임 번호를 채운다 (지금은 `null`)
4. `sanctum.json` 의 `icon` 을 이모지에서 프레임 번호로 바꾸고, `SanctumScreen.jsx` 가
   이모지 대신 스프라이트를 그리게 한다
5. `SpawnSystem.js:145` 의 `add.rectangle` 을 `add.sprite(..., "runes", 24)` 로 교체
6. **글리프 폴백 코드를 지우지 마라.** 프레임이 없으면 글리프로 떨어지는 경로를 남긴다 —
   §0.2 의 롤백 가능성이 여기서 나온다

---

## 9. 이 의뢰에 넣지 않은 것

| 대상 | 왜 뺐나 |
|---|---|
| 대시 버튼 | 아이콘이 아니라 **버튼**이다. 72x72 히트박스에 맞는 별도 규격이 필요하고 눌림 상태가 필요하다 |
| 근접 공격(W1) 참격 이펙트 | 아이콘이 아니라 **애니메이션 시트**다. 방향성 있는 4~6프레임이 필요하다 |
| HP/EXP 바 채움 | 9-slice 늘임이 필요해 32x32 격자에 안 맞는다 |
| 보스 HP 바 | 위와 같다 |

→ 위 4건은 **별도 의뢰서**로 분리한다. 격자 규격이 다른 것을 한 시트에 섞으면
`29` §0.3 이 기록한 "격자가 어긋나면 전부 밀린다" 사고가 재발한다.

---

## 10. 관련 문서

- `29-ICON-IMAGE-PROMPTS` — 1차 의뢰. **격자·팔레트·검수 절차의 원본**
- `31-RUNE-EVOLUTION-TREE` — 룬 24종의 효과와 글리프 폴백
- `30-ENCOUNTERS-AND-FIELD-EVENTS` §7 — 상자·조우 아트의 현재 상태와 라이선스 제약
- `09-ART-AUDIO-AND-ASSET-MAP` — 팔레트 원본

---

## 11. ★ 3차 의뢰 후보 — 2026-08-12 「도형/글리프 전수조사」에서 새로 나온 것

> 이 절은 **의뢰서가 아니라 대기열**이다. 여기 적힌 것은 아직 그리지 않는다.
> 2026-08-12 사용자 제보("디자인 아트를 사용하지 않는 요소를 찾아라")로 `src/**` 전역을
> 훑고, **실행 중인 게임에서 폴백 분기가 어느 쪽으로 가는지 직접 읽어** 확정한 목록이다.
>
> ★ 전수조사의 결론부터: **「아트가 있는데 도형으로 그려지는 것」은 0건이었다.**
> `runes`·`enc-decal-48`·`enc-decal-72`·`items`·`hud`·`npcs`·`proj-*` 가 전부 로드돼
> 있고, 관련 폴백 플래그(`chestArt` `hasRuneTex` `hasPedTex` `hasAltarTex` `hasItemAtlas`
> `hasNpcTex` `orbArt` `orbitArt` `zoneArt`)가 **런타임에서 전부 true** 로 측정됐다.
> 「봉인된 궤」도 포함이다 — 실행 중 궤 오브젝트는 `Sprite:runes` 프레임 24 다(§3.2 대로).
> 즉 아래 3건은 **아트가 애초에 없어서** 도형·글리프인 것이고, 그래서 의뢰 대상이다.

| # | 대상 | 지금 무엇으로 그려지는가 | 코드 위치 | 격자 |
|---|---|---|---|---|
| A | **대시 버튼 아이콘** | 유니코드 글리프 `≫` (monospace 16px) 하나 | `HudScene.js` `this.txtDash` | 버튼 규격 |
| B | **보스 원거리 실탄 「혼탄」** | 반지름 4~9 의 **단색 원** (핏빛). 폴백 분기조차 없다 | `BossSystem.js` `BOLT_R` | 투사체 |
| C | **적 궁수(E6) 화살** | **7x2 단색 사각형** | `EnemyProjectileSystem.js` | 투사체 |

### 11.1 A — 대시 버튼 아이콘

§9 가 이미 "대시 버튼은 아이콘이 아니라 **버튼**이라 별도 의뢰"로 미뤄 둔 항목인데,
그 뒤로 버튼 **판**만 왔고(`hud-atlas` 의 `btn-normal`/`btn-pressed`) **아이콘은 안 왔다**.
실측: `public/img/ui/hud-atlas.json` 의 프레임은 8개
(`joy-base` `joy-knob` `bar-hp` `bar-exp` `btn-normal` `btn-pressed` `bar-fill` `px`) 뿐이고
대시 아이콘 프레임은 없다. 그래서 **"이 버튼이 무엇인지"를 말하는 유일한 수단이 글리프 한 글자**다.

- 넣을 곳: 이 시트의 **예비 칸 38** (`ui_dash`). 32x32 격자에 맞고, 표시는 `MARK_SCALE` 처럼
  1/2 축소하면 16px 이라 56x32 판 위에 그대로 얹힌다 — 정수배 축소라 §2.1 규칙을 안 깬다.
- 그릴 것: 오른쪽으로 뻗는 **잔상 3줄**(길이 다른 갈매기 3개). 방향이 즉시 읽혀야 하고
  판(어두운 금속) 위에 얹히므로 밝은 양피지색 단색이어야 한다.
- ⚠ **칸 0~37 은 절대 건드리지 않는다.** 이미 수령한 `runes.png` 를 덮어쓰지 말고,
  다시 의뢰할 때 §5.2 CELL MANIFEST 의 38번 줄만 EMPTY → `ui_dash` 로 바꾼다.

### 11.2 B·C — 투사체 2종은 이 시트에 넣지 않는다

§9 의 규칙("격자 규격이 다른 것을 한 시트에 섞으면 전부 밀린다") 그대로다.
플레이어 투사체는 이미 14~24px 전용 시트 10장(`proj-*.png`)으로 따로 관리되고 있고,
B·C 는 그 형제다. **`proj-*` 규격을 잇는 별도 의뢰서**로 분리해야 한다.

| 대상 | 제안 규격 | 근거 |
|---|---|---|
| B 「혼탄」 | 16x16, 4프레임(맥동) | `boss.json` 의 `boltRadius` 가 4~9 → 지름 8~18. 16px 칸이면 배율 1 로 덮는다 |
| C 궁수 화살 | 14x14 단일 프레임(회전은 코드가 한다) | `proj-dart-*.png` 와 같은 칸 크기 — 같은 "날아가는 뾰족한 것"이라 규격을 맞추는 게 맞다 |

★ B 를 우선한다. 보스전은 런의 결말이고, 그 화면에서 유일하게 도형인 것이 보스의 공격이다.

---

## 12. ★ 3차 수령 결과 — §11 의 A·B·C 를 받아 배선했다 (2026-08-13)

§11 은 대기열이었다. 그 셋(+ `33` §9 의 궤 표식)이 왔고 배선까지 끝났다. 아래는 **다음 의뢰를
같은 사고 없이 받기 위한 기록**이다.

### 12.1 수령본은 대상당 3벌로 온다 — 무엇이 최종본인가

```
FE/public/assets/generated/
  ui-dash-source.png   1254x1254 RGB(알파 없음)  배경 = 크로마키 초록 rgb(46,240,47)   ← 원본
  ui-dash-alpha.png    1254x1254 RGBA           배경만 지운 것                        ← 중간본
  ui-dash-32.png       32x32     팔레트+tRNS    게임 격자로 축소한 것                  ← 최종본 후보
```

넷 다 같은 구조다. **판정: 숫자가 붙은 것이 최종본이다.** `-source` 는 알파가 아예 없어
쓸 수 없고, `-alpha` 는 게임 격자가 아니다.

`bolt-f0~f3.png` 는 **`boss-soul-bolt-4x16.png` 를 4칸으로 자른 낱장**이다. 추측이 아니라
실측이다 — 네 낱장의 불투명 화소 수(5 / 52 / 66 / 16)와 bbox 가 4x16 시트의 칸 0~3 과
**정확히 일치**한다. 즉 시트가 정본이고 낱장은 그 사본이다. 배선에는 시트만 쓴다.

### 12.2 수령 검수 결과 — 4개 중 2개가 파손이었다

§7 의 절차(치수 · RGBA · 모서리 알파 · 칸 여백 · 중심 정렬)를 그대로 돌린 결과다.

| 대상 | 치수 | 결함 | 판정 |
|---|---|---|---|
| `ui-dash-32` | 32x32 ✅ | **크로마키 초록 2화소 잔류**(19,15)(19,20). 여백 L6 R4 로 1px 치우침 | 정정 후 사용 |
| `boss-soul-bolt-4x16` | 64x16 ✅ | 초록 8화소 잔류. **★ 4프레임 크기가 2x3 / 9x9 / 11x9 / 4x6** — 마스터의 덩어리는 261 / 374 / 514 / 334 이라 **커야 할 4번째가 첫 번째보다 작아졌다.** 맥동 순서가 뒤집혔다 | **재단 다시** |
| `enemy-arrow-14` | 14x14 ✅ | **★ 불투명 화소 4개. bbox 4x1.** 그림이 아니다 | **재단 다시** |
| `mark-chest-48` | 48x48 ✅ | 없음. 무채색 2계조(#4E4E4E / #9D9D9D) · 여백 L7 R7 T8 B8 대칭 | 그대로 사용 |

★ **두 파손의 원인은 하나다 — 축소 대상이 「그림」이 아니라 「캔버스 전체」였다.**
화살 마스터는 1774x887 캔버스 안에 그림이 581x161 로 들어 있다. 캔버스째 14x14 로 줄이면
그림은 4x1 이 된다. **`-alpha` 안의 그림 자체는 멀쩡했다.**

> ⚠ **다음 의뢰의 §7 검수에 한 줄을 추가해야 한다** — *"축소본의 불투명 bbox 가
> 칸의 절반보다 작으면 즉시 반려한다."* 치수(V-1)와 모서리 알파(V-3)만 보면 이 둘은 **통과한다.**
> 이번에 걸린 것은 칸 여백(V-4)을 실제로 재 봤기 때문이다.

### 12.3 재단 — `tools/bake-art34.mjs`

그리지 않는다. 자른다. 새 형태를 만드는 코드는 한 줄도 없다.

| 하는 일 | 왜 |
|---|---|
| 크로마키 초록 화소를 **이웃 색으로 덮는다** | 전부 형태 **안쪽**에 있다. 투명으로 지우면 구멍이 뚫린다 |
| 「혼탄」·화살을 **`-alpha` 마스터에서 다시 재단** | §12.2 의 파손 복구. 세로 열 프로파일로 덩어리를 직접 찾아 자른다 — 폭을 n등분하면 등분선이 덩어리를 스치는 사고가 그대로 재발한다 |
| 4프레임에 **공통 배율 하나**를 쓴다 | 프레임마다 칸을 꽉 채우면 넷이 같은 크기가 되어 맥동이 사라진다. 결과: 7 / 10 / 13 / 9 px |
| 알파를 0 아니면 255 로 자른다 | `proj-*.png` 10장이 전부 그렇다(실측: 반투명 화소 0). 회전할 때 가장자리가 안 번진다 |
| 칸마다 중심 재정렬 | 맥동은 제자리에서 부푸는 것이다. 중심이 흔들리면 「튄다」로 읽힌다(`33` §3.4 와 같은 이유) |

⚠ **`public/assets/generated/**` 에는 한 바이트도 쓰지 않는다.** 사용자 수령본이고,
이 저장소에서 빌드 스크립트가 수령본을 덮어쓴 사고가 두 번 났다(`131d554` · `6889771`).
`assertNotReceipt()` 가 출력 경로를 물리적으로 막는다. `build:all-assets` 에도 넣지 않았다.

### 12.4 배선과 폴백 — 매니페스트 4줄이 전부다

| 대상 | 키 / 파일 | 쓰는 곳 | ⚠ 줄을 빼면 |
|---|---|---|---|
| A 대시 아이콘 | `ui-dash` · `assets/icons/ui-dash.png` | `HudScene.dashMark` | 글리프 `≫` 로 |
| B 「혼탄」 | `proj-soul-bolt` · `assets/projectile/proj-soul-bolt.png` (16x16 x 4) | `BossSystem.boltArt` | 반지름 4~9 단색 원으로 |
| C 궁수 화살 | `proj-arrow-bone` · `assets/projectile/proj-arrow-bone.png` | `EnemyProjectileSystem.hasArrowTex` | 7x2 단색 사각형으로 |
| D 궤 표식 | `mark-chest` · `assets/decal/mark-chest-48.png` | `EncounterSystem.chestMark` | 표식이 아예 안 만들어진다(`33` §9 규약) |

★ **B 는 폴백 분기를 새로 만들었다.** §11 표가 적은 대로 이전에는 분기 자체가 없었다.
이제 생성자에서 `textures.exists` 를 한 번 보고 스프라이트/원 중 하나로 풀을 채운다 —
매 프레임 확인하지 않는 것이 이 저장소의 규약이다(`EncounterSystem.buildObjects` 와 같다).

★ **tint 구조는 그대로다.** 두 갈래 모두 색은 `boss.json` 의 `w.color` 하나에서 나온다 —
스프라이트면 `setTint`, 원이면 `setFillStyle`. 시트가 핏빛으로 구워져 있어도 tint 를 곱해야
패턴별 색 구분이 산다.

### 12.5 ⚠ §11.1 의 전제가 틀렸다 — 대시 버튼 판은 어두운 금속이 아니다

§11.1 은 *"판(어두운 금속) 위에 얹히므로 밝은 양피지색 단색이어야 한다"* 고 적었다.
실측은 반대다 — `hud-atlas` 의 `btn-normal` 은 **어두운 금속 테 안에 양피지 판**이고,
판 얼굴이 rgb(230,215,178) 이다. 양피지색 아이콘을 얹으면 **아무것도 안 보인다**
(헤드리스 8배 확대에서 아이콘이 통째로 사라졌다).

그래서 두 가지를 바꿨다.

1. tint 를 어두운 잉크 `#1A1216`(§4 외곽선 색)으로 내렸다. **그림은 그대로 흰색/양피지
   단색으로 굽고 색은 tint 가 정한다는 구조는 유지된다** — 곱하는 값만 반대편으로 갔다.
2. **글리프 폴백의 색도 같이 내렸다.** 글리프는 `#c9b792` 였다 — 즉 **아트가 오기 전부터
   대시 버튼의 글리프는 안 보이고 있었다.** §11 전수조사가 "글리프 하나"라고 적은 그 글리프가
   실은 화면에서 읽히지 않는 상태였다. 폴백을 지우지 않고 색만 고쳤다.
3. 배율은 **0.5 가 아니라 1** 이다. §11.1 은 "1/2 축소하면 16px"을 예상했는데, 수령본은
   32x32 칸 안에 그림이 **22x13** 로 들어와 여백이 크다. 1:1 로 놓아도 표식은 22x13 이고
   판 얼굴(44x20)에 정확히 들어간다. 0.5 로 줄이면 **1px 갈매기 획이 최근접 표본화에 솎여
   세 줄이 점 몇 개로 흩어진다**(실측). 정수배 축소가 안전한 것은 획이 2px 이상일 때다.

> **다음 의뢰에 반영할 것:** 아이콘이 어디에 얹히는지 **실측 색**을 프롬프트에 적는다.
> "어두운 금속 위"는 추측이었고, 그 한 줄이 그림 전체의 밝기를 결정한다.
