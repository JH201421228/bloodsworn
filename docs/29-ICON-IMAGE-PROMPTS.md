# 29. 아이템 아이콘 이미지 의뢰 (Codex 의뢰용) — 66종 + 등급 후광 5종

> **문서 지위: 실행 문서(Operational).** 정본은 `01-CONCEPT-AND-STORY.md` / `09-ART-AUDIO-AND-ASSET-MAP.md` / `23-ITEM-SYSTEM.md`.
> 최종 수정: **2026-08-11 (1차 작성)**
>
> 형식 정본: `15-IMAGE-PROMPTS-FOR-CODEX.md` (의뢰서 구조) / `18-MAP-IMAGE-PROMPT.md` (실패 이력 관리).
> 이 문서는 A-01~A-15 와 별개의 의뢰 묶음이다. 항목 번호는 **I-01 ~ I-71** 을 쓴다.

---

## 0. 왜 이 의뢰를 하는가

### 0.1 지금 아이콘은 "그림"이 아니라 "도형"이다

현재 66종은 `FE/tools/gen-item-icons.mjs` 가 ImageMagick 도형(사각형·원·다각형·굵은 선)을
조합해 **절차적으로** 굽는다. 그 선택에는 그때의 정당한 이유가 있었고, 그 이유는 지금도 유효하다.

| 절차 생성이 준 것 | 값 |
|---|---|
| 라이선스 리스크 | **0.** 외부 에셋 의존이 없다 (Raven Fantasy 무료판은 수익화 프로젝트에 못 쓴다) |
| 비용 | **0** |
| 재생성 | 명령 한 줄. 팔레트를 바꾸면 66장이 한꺼번에 따라온다 |
| 구분 가능성 | 충분하다. 물약/검/왕관은 0.5초 안에 갈린다 |

**그런데 톤이 안 맞는다.** 정본 `01-CONCEPT` §2 의 아트 방향은 "16-bit 픽셀아트, 고딕 다크 판타지"이고
§7 의 시그니처는 "심홍·청록 두 광원의 대비"다. 도형 조합에는 **광원이 없다.** 면은 평평하고,
그림자가 없고, 재질(뼈·녹슨 쇠·양피지·유리)이 색으로만 구분된다.
게임의 다른 모든 것 — 적 스프라이트, 보스, 이펙트, 앞으로 들어올 맵(`18` 문서) — 은 손으로 그린
픽셀아트다. **아이템 아이콘만 벡터 클립아트처럼 보인다.** 그것이 이 의뢰의 유일한 동기다.

### 0.2 무엇을 바꾸고 무엇을 안 바꾸는가

바꾸는 것은 **픽셀뿐**이다. 아래는 전부 그대로 둔다.

| 그대로 두는 것 | 이유 |
|---|---|
| 프레임 이름(= 아이콘 키) 66 + 5 | `ItemSystem.js:395` 가 `s.setTexture("items", b.icon)` 로 **키를 그대로** 프레임 이름에 쓴다 |
| `items.json` 아틀라스 형식 | `PreloadScene.js:59` 가 `this.load.atlas(...)` 로 읽는 Phaser 아틀라스 규격 |
| 시트 크기 384×192 / 12열 6행 | `src/ui/inventory/itemFrames.json` 의 `_meta.sheet` 가 이 값으로 **하드코딩**되어 있다 |
| 칸 순서 | 같은 파일에 좌표가 박혀 있다. 한 칸만 밀려도 **크래시가 아니라 "엉뚱한 아이콘이 조용히 뜨는"** 형태로 나타난다 (`itemAtlas.js` 주석 원문) |
| `gen-item-icons.mjs` | **삭제하지 않는다.** §9 폴백 원칙 |

> ★ **이 제약이 이 문서 전체의 설계를 결정했다.**
> Codex 가 **정확히 384×192, 12×6, 정해진 순서**로 한 장을 내주면
> `FE/public/assets/items/items.png` 를 덮어쓰는 것만으로 끝난다.
> `items.json` 도, `itemFrames.json` 도, 게임 코드도 **한 줄도 안 고친다.**
> 다른 배치를 고르면 그 순간 JSON 2개 재생성 + 검증이 따라붙는다. 그래서 다른 배치를 고르지 않는다.

### 0.3 앞선 의뢰들에서 물려받은 실패 (반복하지 않는다)

`18` 문서는 맵 에셋을 **네 번** 다시 의뢰한 기록이다. 그 실패의 원인은 전부 같은 종류였다.

| 물려받은 실패 | 이 문서의 대응 |
|---|---|
| **격자가 어긋난다** (마스크가 벽과 27px 밀림) | §2.3 **칸마다 2px 투명 여백**을 강제하고, §7.4 에서 그 여백을 **기계로 검사**한다 |
| **정수배 축소를 건너뛰어 인장이 192×192 로 나왔다** | §7.2 **모든 리사이즈 직후 `identify` 로 치수를 확인**하고, 정수배가 아니면 즉시 반려 |
| **개별 파일로 받아 수령·검수·재의뢰가 N배가 됐다** | §2.1 **한 장으로만 받는다.** 71장이면 재의뢰가 71배다 |
| **배경이 검정으로 와서 알파가 없었다** | §7.3 알파 채널 존재 + 네 모서리 alpha 0 을 기계로 확인 |
| **색이 팔레트를 벗어났다** | §3 팔레트를 16진수로 못 박고, §7.5 로 고유색을 뽑아 대조 |

### 0.4 이 의뢰가 실패해도 게임은 안 멈춘다

절차 생성기가 남아 있는 한 아이콘은 **항상** 존재한다. 그래서 이 의뢰는 **MUST 가 아니라 SHOULD** 다.
Day 7 스코프가 흔들리면 이 항목을 통째로 자른다. §9 를 그 전제 위에 썼다.

---

## 1. 산출물

| # | 파일 | 크기 | 비고 |
|---|---|---|---|
| **S-1** | `items-sheet.png` | **384 × 192** (또는 정수배 마스터) | ★ 이 의뢰의 전부. 71칸 + 빈칸 1 |
| S-2 | (선택) 마스터 원본 | **3072 × 1536** = 정확히 8배 | 있으면 §7.2 로 우리가 축소한다 |

**저장 경로**
```
store/_raw/items-sheet-3072x1536.png     ← 마스터 원본(받은 그대로, 절대 덮어쓰지 않는다)
FE/public/assets/items/items.png         ← 최종 384x192. 여기만 게임이 읽는다
```

`FE/public/assets/items/items.json` 과 `FE/src/ui/inventory/itemFrames.json` 은 **건드리지 않는다.**
이미 맞는 값이 들어 있다. 건드려야 한다면 그건 배치가 틀렸다는 뜻이다.

---

## 2. ★ 시트 배치 규격 — 이 문서에서 가장 중요한 절

### 2.1 왜 한 장인가

71장을 개별 파일로 받으면 **수령·검수·재의뢰가 71배**가 된다.
`18` 문서가 4차까지 간 이유의 절반이 "받은 것을 하나씩 확인하는 비용"이었다.
한 장이면 치수 확인 1회, 알파 확인 1회, 격자 확인 1회, 팔레트 확인 1회로 끝난다.
그리고 **한 장이면 71개 아이콘의 톤이 서로 맞는다.** 따로 받으면 12번째와 60번째의 명도가 어긋난다.

### 2.2 왜 12열 × 6행 / 384 × 192 인가

| 후보 | 판정 |
|---|---|
| **12 × 6 = 72칸 (384×192)** | ★ **채택.** 현재 시트와 **완전히 동일**하다 → JSON·코드 변경 0 |
| 9 × 8 = 72칸 (288×256) | 기각. 정사각에 가까워 생성기가 다루기 쉽지만 `itemFrames.json` 을 통째로 다시 만들어야 한다 |
| 8 × 9 = 72칸 (256×288) | 기각. 같은 이유 |
| 6 × 12 = 72칸 (192×384) | 기각. 세로로 긴 시트는 생성기가 칸을 균등하게 못 나눈다(경험칙) |

72칸 중 **71칸을 쓰고 마지막 1칸(6행 12열)은 완전 투명으로 비운다.**
비는 칸을 없애려고 열 수를 바꾸면 위 표의 이유로 손해가 더 크다.

```
시트 전체        384 x 192 px
칸               32 x 32 px, 여백/거터 없이 딱 붙어 있음
열 x 행          12 x 6 = 72칸
칸 (c,r) 좌상단  x = (c-1)*32 , y = (r-1)*32     (c,r 은 1부터)
채우는 칸        1 ~ 71 (좌→우, 위→아래)
빈 칸            72번(6행 12열) — 완전 투명
```

### 2.3 ★ 칸 안쪽 규칙 — 격자 어긋남을 기계가 잡게 만든다

`18` 문서의 최대 실패는 "격자가 어긋났다"였다. 눈으로는 잘 안 보인다.
그래서 **어긋나면 기계가 반드시 잡도록** 규칙을 하나 넣는다.

| 규칙 | 값 | 왜 |
|---|---|---|
| **안전 영역** | 각 칸의 **중앙 28 × 28** 안에만 그린다 | |
| **강제 여백** | 각 칸의 **바깥 2px 테두리는 완전 투명(alpha 0)** | 그림이 밀리면 이 띠를 침범한다 → §7.4 가 즉시 잡는다 |
| 거터 | 칸과 칸 사이에 **추가 간격을 두지 않는다** | 간격을 두면 32 배수 좌표가 깨진다. 여백은 칸 *안쪽*에 있다 |
| 격자선 | **그리지 않는다** | 안내선을 그려 보내면 그게 그대로 이미지에 남는다 |
| 배경 | **완전 투명.** 검정도 흰색도 아니다 | 카드/토스트 배경 위에 얹힌다 |

> 이 2px 여백은 미관 규칙이 아니라 **자동 검수 장치**다. 28×28 안에 그리면 32px 격자에서
> 최대 2px 오차까지는 그림이 안 잘리고, 3px 이상 밀리면 §7.4 검사가 실패한다.

### 2.4 ★ 칸 순서 (절대 바꾸지 않는다)

이 순서는 `FE/src/data/items.json` 의 `bases` 등장 순서 + `rarities` 순서에서 **기계적으로** 나온 것이고,
`FE/src/ui/inventory/itemFrames.json` 에 좌표로 굳어 있다.

```
행1  01 potion_s     02 potion_m     03 potion_l     04 heart        05 herb         06 bomb
     07 cross        08 magnet       09 zzz          10 lightning    11 shield       12 clover
행2  13 flask_blue   14 flask_pink   15 flask_green  16 gem_teal     17 coin         18 pouch
     19 fang_01      20 fang_02      21 fang_03      22 fang_04      23 fang_05      24 fang_06
행3  25 fang_07      26 fang_08      27 fang_09      28 fang_10      29 hide_01      30 hide_02
     31 hide_03      32 hide_04      33 hide_05      34 hide_06      35 hide_07      36 hide_08
행4  37 hide_09      38 hide_10      39 charm_01     40 charm_02     41 charm_03     42 charm_04
     43 charm_05     44 charm_06     45 charm_07     46 charm_08     47 charm_09     48 charm_10
행5  49 crown_gold   50 crown_iron   51 crown_red    52 gear_iron    53 gear_gold    54 shard_ice
     55 crystal      56 hourglass    57 glove        58 boot         59 book         60 burst_amber
행6  61 burst_void   62 wing         63 pendant      64 spark        65 dice         66 phoenix
     67 HALO common  68 HALO uncommon 69 HALO rare   70 HALO epic    71 HALO legendary  72 (빈칸)
```

> ⚠ **67번 `halo_common` 은 게임에서 절대 화면에 안 나온다.** (`ItemIcon.jsx:9` 가 common 을 건너뛴다)
> 그래도 **반드시 그려야 한다.** 빼면 68~71 이 한 칸씩 당겨져 **모든 등급 후광이 한 단계씩 어긋난다.**
> 이것이 "칸을 비우지 말고 순서를 지켜라"의 실제 비용이다.

### 2.5 실제 표시 크기 — 32px 를 믿지 마라

| 쓰이는 곳 | 실제 크기 | 근거 |
|---|---|---|
| 장비 슬롯 | **16 논리px** | `EquipSlots.jsx:43` `size={16}` |
| 유물 슬롯 / 전리품 요약 | **14 논리px** | `EquipSlots.jsx:75`, `RunLootSummary.jsx:32` |
| 획득 토스트 | 14~20 논리px | `ItemToasts.jsx:51` |
| 바닥에 떨어진 드롭 | **32px 등배** (`setScale(1)`, `ItemSystem.js:396`) | 여기서만 원본 크기로 보인다 |

**UI 에서는 사실상 절반으로 줄어든다.** 그래서 32×32 를 세밀하게 채우면 손해다.
**실루엣이 전부다.** 아래 §5 프롬프트에 "16×16 로 줄여도 무엇인지 읽혀야 한다"를 못 박은 이유가 이것이다.

---

## 3. 팔레트 — 어느 팔레트를 믿을 것인가

### 3.1 ★ 저장소 안에 팔레트가 세 벌 있다 (실측)

이걸 먼저 정리하지 않으면 아이콘만 색이 따로 논다.

| 출처 | 예: 피 본체 | 예: 등급 Rare | 상태 |
|---|---|---|---|
| `docs/09-ART` §1.1 코어 16색 | `#8E1220` | `#2FBFA8` | 문서상의 원안 |
| **`FE/src/index.css` :root** | **`#8b0f1d`** | **`#35c9b4`** | ★ **실제로 화면에 나오는 값** |
| `FE/tools/gen-item-icons.mjs` `P` | `#8e1220` | `#35c9b4` | 09-ART 와 index.css 를 섞어 쓰고 있다 |

**index.css 를 따른다.** 이유는 하나다 —
`FE/src/data/items.json` 의 `rarities[].color` 가 `#7b7488 / #c7c2ce / #35c9b4 / #c4182b / #c9a227`,
즉 **index.css 값 그대로**이고, 등급 후광 5종은 바로 그 색으로 칠해져야 UI 의 등급 테두리와 일치한다.
09-ART 값을 쓰면 후광만 미묘하게 다른 청록/심홍이 되어 **색맹 대응 설계가 깨진다**(§4.7).

> ⚠ 부수 과제: `gen-item-icons.mjs` 의 `blood: "#8e1220"` 는 index.css 의 `#8b0f1d` 와 다르다.
> 이 의뢰와 별개로 **09-ART §1.1 을 index.css 실측값으로 갱신**하는 것이 맞다. 이 문서는 그 판단을 기록만 한다.

### 3.2 확정 팔레트 (프롬프트에 그대로 박는다)

| 역할 | HEX | 아이콘에서의 용도 |
|---|---|---|
| VOID | `#0b0710` | 1px 외곽선(가장 어두운 물체), 구멍 |
| STONE-1 | `#16121c` | 외곽선 기본값, 깊은 그림자 |
| STONE-2 | `#2a2533` | 어두운 금속·가죽 암부 |
| STONE-3 | `#4a4454` | 철 본체 |
| STONE-4 | `#7b7488` | 철 명부, **Common 등급색** |
| BONE | `#c7c2ce` | 뼈·은·유리 하이라이트, **Uncommon 등급색** |
| BLOOD | `#8b0f1d` | 피 본체 |
| BLOOD-LIGHT | `#c4182b` | 피 명부, **Epic 등급색** |
| BLOOD-GLOW | `#ff3b4a` | 발광 강조(아주 조금만) |
| CANDLE | `#1e7e74` | 청록 암부 |
| CANDLE-LIGHT | `#35c9b4` | 청록 본체, **Rare 등급색** |
| CANDLE-GLOW | `#8ff0dc` | 청록 발광 |
| GOLD | `#c9a227` | 금·놋쇠, **Legendary 등급색** |
| PARCHMENT | `#c9b792` | 양피지·가죽 명부·나무 |
| ASH | `#9a94a3` | 회백, 중립 |

**보조 3색만 추가 허용** — 66종을 이 15색으로만 구분하면 호박·서리·자수정이 뭉개진다.

| 보조 | HEX | 쓰는 곳 |
|---|---|---|
| EMBER | `#e07b39` | 호박 구슬, 호박 불꽃, 잿불의 새, 발화석 |
| RIME | `#8ecbe8` | 서리 파편, 창백한 청옥 |
| VIOLET | `#a86ede` | 자수정 성물, 심연의 결정, 공허의 꽃 |

> 이 세 색은 이미 `gen-item-icons.mjs` 의 `amber / ice / violet` 로 게임에 나와 있다. 새 색이 아니다.
> **총 18색 + 투명. 그 밖의 색은 금지.**

---

## 4. 무엇을 그리는가 — 71칸 명세

### 4.0 읽는 법 / 두 가지 함정

- **`형태 지시`는 "도형"이 아니라 "그림"으로 썼다.** 현재 생성기 주석의 실루엣 설계를 근거로 삼되,
  "마름모 + 하이라이트" 가 아니라 "무엇을 그린 것인지"로 다시 기술했다.
- ★ **함정 1 — 키 이름을 믿지 마라.** 아이콘 키는 그냥 식별자다. 실제로 어긋난 것이 7개 있다.

  | 키 | 키가 말하는 것 | **아이템 이름(정답)** |
  |---|---|---|
  | `itm_cross` | 십자가 | **성수병** — 십자 모양 유리병 |
  | `itm_magnet` | 자석 | **혼의 나침반** — 놋쇠 나침반 |
  | `itm_zzz` | 수면 | **망각의 종** — 금 간 종 |
  | `itm_lightning` | 번개 | **번개의 재** — 재 무더기에서 튀는 불꽃 |
  | `itm_flask_blue` | 파란 물약 | **박쥐의 깃** — 박쥐 날개 깃 |
  | `itm_flask_pink` | 분홍 물약 | **격노의 정수** |
  | `itm_flask_green` | 초록 물약 | **야안의 즙** |

  **한국어 이름이 정답이다.** U 자 자석과 만화 폭탄은 이 게임의 톤이 아니다 — 이 의뢰의 핵심 개선점이다.
- ★ **함정 2 — 같은 카테고리는 실루엣이 서로 달라야 한다.** 송곳니 10종이 전부 "직검"이면
  플레이어는 구분을 못 한다. 아래 표는 검/단검/낫/도/세검으로 **실루엣을 미리 갈라 놨다.**

### 4.1 소모품 16종 (칸 01~16)

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 01 | `itm_potion_s` | 작은 피 물약 | Small Blood Vial | 목이 짧은 작은 유리병. 뼈 마개, 철 목테. 어두운 피가 **바닥 40%**만 고여 있다 | BLOOD |
| 02 | `itm_potion_m` | 피 물약 | Blood Vial | 같은 병이 한 치수 크고 피가 **70%**. 유리에 세로 하이라이트 1px | BLOOD |
| 03 | `itm_potion_l` | 큰 피 물약 | Great Blood Flask | 배가 불룩한 플라스크가 **가득**. 수면이 목까지 차 밝은 선혈(BLOOD-LIGHT)로 번진다 | BLOOD-LIGHT |
| 04 | `itm_heart` | 뛰는 심장 | Beating Heart | 아직 뛰는 심장. 잘린 대동맥 두 가닥이 위로 솟고 **핏방울 1개**가 떨어진다. 해부학적 묘사 금지 — 문장(紋章)처럼 | BLOOD |
| 05 | `itm_herb` | 무덤 이끼 | Grave Moss | 깨진 묘비 조각 위에 낀 이끼 덩어리. 이끼는 회녹색, 돌은 STONE | ASH+CANDLE |
| 06 | `itm_bomb` | 발화석 | Firestone | 주먹만 한 검은 돌이 쪼개져 **틈에서 잉걸불**이 샌다. **도화선 금지**(만화 폭탄이 된다) | EMBER |
| 07 | `itm_cross` | 성수병 | Holy Water Vial | **십자 모양 유리병.** 안에 청록 물이 반쯤. 목에 은 사슬 한 바퀴 | CANDLE-LIGHT |
| 08 | `itm_magnet` | 혼의 나침반 | Soul Compass | 뚜껑이 열린 놋쇠 나침반. 바늘이 비스듬히 서고 문자반에서 **청록 실안개**가 피어오른다. **U자 자석 금지** | GOLD+CANDLE |
| 09 | `itm_zzz` | 망각의 종 | Bell of Oblivion | 금 간 청동 손종. 추가 없다(그래서 소리가 없다). 입술에 녹청 | GOLD+CANDLE |
| 10 | `itm_lightning` | 번개의 재 | Ash of Lightning | 회색 재 무더기에서 **꺾인 번개 한 줄기**가 튀어 오른다. 재가 아래, 불꽃이 위 | ASH+GOLD |
| 11 | `itm_shield` | 성갑의 조각 | Shard of Holy Plate | 방패/흉갑의 **깨진 조각**. 한쪽은 매끈한 곡면과 청록 각인, 반대쪽은 찢긴 단면 | STONE+CANDLE |
| 12 | `itm_clover` | 네 잎의 밤 | Four-Leaf Night | 네 잎 클로버. 잎은 거의 검고 **잎맥만 청록으로 빛난다** | CANDLE |
| 13 | `itm_flask_blue` | 박쥐의 깃 | Bat's Pinion | **깃털이 아니라 박쥐 날개 깃.** 가죽 막에 뼈대 3줄, 끝이 갈고리. 창백한 푸른 림라이트 | RIME |
| 14 | `itm_flask_pink` | 격노의 정수 | Essence of Wrath | 뭉툭한 유리병 속에서 심홍 액체가 **끓어 넘친다.** 목에서 붉은 김이 두 가닥 | BLOOD-LIGHT |
| 15 | `itm_flask_green` | 야안의 즙 | Nightsight Sap | 뿔로 만든 작은 병. 검녹색 수액. 병 옆면에 **눈 모양 각인** 하나 | CANDLE |
| 16 | `itm_gem_teal` | 혼의 조각 | Soul Shard | 청록 결정 파편 1개. 안쪽에서 빛나고 아래 모서리가 부서져 있다 | CANDLE-LIGHT |

### 4.2 통화 2종 (칸 17~18)

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 17 | `itm_coin` | 핏값 동전 | Blood-Price Coin | 닳은 은화 1개. **송곳니 달린 옆얼굴**이 양각되고 음각 홈에 마른 피가 끼어 있다 | BONE+BLOOD |
| 18 | `itm_pouch` | 도굴꾼 주머니 | Graverobber's Pouch | 입을 조인 가죽 주머니. 묶은 끈이 늘어지고 **금화 2~3개가 삐져나온다** | PARCHMENT+GOLD |

### 4.3 장비 — 송곳니 10종 (칸 19~28) · 공격 슬롯

> **실루엣 분배 원칙:** 직검 3 / 단검 3 / 낫 2 / 도 1 / 세검 1. 전부 **날 끝이 위**를 향하고
> 손잡이가 아래에 오도록 세로로 세운다. 그래야 16px 로 줄여도 "무기"로 읽힌다.

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 19 | `itm_fang_01` | 부러진 송곳니 | Broken Fang | **진짜 송곳니**를 손잡이 삼아 끈으로 감은 찌르개. 끝이 부러져 뭉툭 | BONE |
| 20 | `itm_fang_02` | 사냥꾼의 단검 | Hunter's Dagger | 짧고 곧은 단검. 일자 코등이, 가죽 감은 손잡이 | STONE-4 |
| 21 | `itm_fang_03` | 녹슨 낫 | Rusted Sickle | 크게 휜 낫. 날에 붉은 녹이 얼룩덜룩, 나무 자루 | EMBER+PARCH |
| 22 | `itm_fang_04` | 이빨 박힌 검 | Tooth-Studded Sword | 넓은 직검의 날에 **이빨을 박아 톱니**로 만들었다. 날이 고르지 않다 | PARCHMENT+BONE |
| 23 | `itm_fang_05` | 성당 기사의 검 | Cathedral Knight's Sword | 긴 직검. 십자형 자루, 혈조에 **청록 각인**. 가장 정갈한 형태 | BONE+CANDLE |
| 24 | `itm_fang_06` | 피에 젖은 도 | Blood-Soaked Saber | 외날 곡도. 날 아래쪽 1/3이 피에 젖어 있고 끝에서 방울이 맺힌다 | BLOOD |
| 25 | `itm_fang_07` | 초승달 낫 | Crescent Scythe | 짧은 자루 위에 **초승달 그 자체**인 창백한 날. 자루는 검다 | BONE |
| 26 | `itm_fang_08` | 순교자의 검 | Martyr's Sword | 직검의 날 한가운데를 **대못이 관통**했다. 손잡이는 천으로 감겼고 금 손잡이머리 | STONE+GOLD |
| 27 | `itm_fang_09` | 자정의 세검 | Midnight Rapier | 아주 가는 찌르기 검. **바구니형 휘어진 호신구**, 날은 거의 검고 푸른 림라이트 | STONE-2+RIME |
| 28 | `itm_fang_10` | 은도금 단검 | Silvered Dagger | 잎사귀 모양 은 단검. **강한 반사 하이라이트 2점** — 이 칸만 유일하게 번쩍인다 | BONE |

### 4.4 장비 — 가죽 10종 (칸 29~38) · 생존 슬롯

> **실루엣 분배:** 몸통 갑옷 6 / 예복 1 / 투구·면갑 2 / 방패 1.
> 몸통 6개가 다 같아 보이면 실패다. 어깨선·목선·표면 재질로 갈랐다.

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 29 | `itm_hide_01` | 낡은 가죽 갑옷 | Worn Leather Cuirass | 기운 자국이 있는 갈색 가죽 조끼. 어깨가 둥글고 끈으로 여몄다 | PARCHMENT |
| 30 | `itm_hide_02` | 이끼 낀 흉갑 | Moss-Grown Breastplate | 철 흉갑에 **이끼가 번졌다.** 어깨는 각지고 아래로 이끼가 흘러내린다 | STONE+CANDLE |
| 31 | `itm_hide_03` | 사제의 제의 | Priest's Vestment | 창백한 긴 예복. 목에서 아래로 **청록 영대(stole) 두 줄** | BONE+CANDLE |
| 32 | `itm_hide_04` | 금박 흉갑 | Gilded Breastplate | 매끈한 흉갑에 금 테두리와 금 리벳. 가슴 한가운데 금 문양 1개 | GOLD |
| 33 | `itm_hide_05` | 관지기의 갑옷 | Coffinkeeper's Armor | 검은 철판. 표면이 **관 뚜껑처럼 세로 널판 + 못머리 행렬** | STONE-2 |
| 34 | `itm_hide_06` | 사슬 갑옷 | Chain Hauberk | 사슬 갑옷. 표면 전체가 **고리 텍스처 디더링**, 아랫단이 물결친다 | STONE-4 |
| 35 | `itm_hide_07` | 뼈 갑주 | Bone Harness | **갈비뼈를 그대로 두른** 갑주. 척추가 가운데를 지난다 | BONE |
| 36 | `itm_hide_08` | 철 투구 | Iron Helm | 통짜 투구. 정면 **十자 시야 틈**, 안은 완전한 어둠(VOID) | STONE-3 |
| 37 | `itm_hide_09` | 처형인의 면갑 | Executioner's Visor | 눈구멍 없는 두건형 철가면. **가로 틈 하나**뿐. 이마에 낙인 | STONE-2+BLOOD |
| 38 | `itm_hide_10` | 파수병의 방패 | Sentry's Shield | 하단이 뾰족한 히터 실드. 철제 보스(가운데 돌기), 가장자리에 찌그러진 자국 | STONE-3+BONE |

### 4.5 장비 — 부적 10종 (칸 39~48) · 운영 슬롯

> 현재 생성기는 이 10개 중 8개를 **똑같은 마름모 보석**으로 뽑는다. 색만 다르다.
> **이 카테고리가 이번 의뢰의 개선 폭이 가장 크다.** 보석/구슬/성물/반지/목걸이로 실루엣을 나눴다.

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 39 | `itm_charm_01` | 붉은 성물 | Red Reliquary | 손바닥만 한 **성물함.** 금 발톱 물림쇠에 심홍 유리, 뚜껑에 작은 십자 | BLOOD+GOLD |
| 40 | `itm_charm_02` | 호박 구슬 | Amber Bead | 둥근 호박 구슬. **안에 벌레 한 마리**가 갇혀 실루엣으로 보인다 | EMBER |
| 41 | `itm_charm_03` | 창백한 청옥 | Pale Sapphire | 각진 컷의 창백한 푸른 보석. 면마다 명도가 다르다 | RIME |
| 42 | `itm_charm_04` | 이끼 구슬 | Moss Bead | 돌 구슬을 **이끼가 감고 있다.** 넝쿨 한 가닥이 빠져나온다 | CANDLE |
| 43 | `itm_charm_05` | 자수정 성물 | Amethyst Reliquary | 은 발톱에 물린 **길쭉한 자수정 육각기둥** | VIOLET+BONE |
| 44 | `itm_charm_06` | 백야의 구슬 | White-Night Orb | 매끄러운 유백색 구. 안쪽에서 흰빛이 비쳐 아래가 밝다 | BONE |
| 45 | `itm_charm_07` | 소용돌이 구슬 | Whirl Orb | 투명 유리 구슬 안에 **나선 무늬**가 감겨 있다 | CANDLE-LIGHT |
| 46 | `itm_charm_08` | 녹빛 소용돌이 | Verdigris Whirl | 구슬이 아니라 **녹청 낀 구리 원반**에 새긴 나선. 납작하다 | CANDLE |
| 47 | `itm_charm_09` | 봉인된 반지 | Sealed Ring | 인장 반지. ★ **가운데가 실제로 뚫려** 있어야 반지로 읽힌다. 반지 위에 붉은 밀랍 인장 | GOLD+BLOOD |
| 48 | `itm_charm_10` | 유해의 목걸이 | Necklace of Remains | 가죽끈에 **손가락뼈를 꿴 목걸이.** 아래에 이빨 하나가 매달렸다 | BONE+PARCH |

### 4.6 유물 18종 (칸 49~66)

> 유물은 등급이 대부분 epic/legendary 다. **다른 카테고리보다 한 단계 화려해도 된다** —
> 단, 화려함은 형태로 내고 색으로 내지 않는다.

| 칸 | 키 | 한국어 | English name | 형태 지시 | 주색 |
|---|---|---|---|---|---|
| 49 | `itm_relic_crown_gold` | 탐욕의 왕관 | Crown of Greed | 뾰족탑 5개짜리 금관. 보석이 **과하게** 박혔고 뿔 사이에 금화가 걸려 있다 | GOLD |
| 50 | `itm_relic_crown_iron` | 무쇠 왕관 | Iron Crown | 장식 없는 무거운 철 테. 리벳 4개, 표면이 두들겨 맞은 자국 | STONE-3 |
| 51 | `itm_relic_crown_red` | 핏빛 왕관 | Crown of Blood | **가시로 엮은 관.** 가시 끝마다 핏방울이 맺혀 있다 | BLOOD |
| 52 | `itm_relic_gear_iron` | 녹슨 톱니 | Rusted Cog | 톱니바퀴. ★ **가운데 구멍이 뚫려** 있고 **톱니 하나가 빠져** 있다 | EMBER+STONE |
| 53 | `itm_relic_gear_gold` | 황금 톱니 | Golden Cog | 같은 톱니바퀴가 금이고 톱니가 온전하다. 52번과 **형태를 맞춰** 짝으로 읽히게 | GOLD |
| 54 | `itm_relic_shard_ice` | 서리 파편 | Frost Shard | 뾰족한 얼음 조각. 표면에 흰 서리 결정 몇 점 | RIME |
| 55 | `itm_relic_crystal` | 심연의 결정 | Abyss Crystal | 검보라 결정 **덩어리**(단일 파편이 아니라 3개가 뭉친 군집). 54번과 실루엣을 갈라라 | VIOLET |
| 56 | `itm_relic_hourglass` | 멈춘 모래시계 | Stopped Hourglass | 금 테두리 모래시계. ★ **모래알이 잘록한 목에서 공중에 멈춰** 있다 | GOLD+PARCH |
| 57 | `itm_relic_glove` | 도굴꾼의 장갑 | Graverobber's Glove | 손가락 끝이 잘린 가죽 장갑. 손등에 흙, 손바닥에 금화 1개 | PARCHMENT |
| 58 | `itm_relic_boot` | 밤의 장화 | Boot of Night | 목 긴 검은 승마 장화. 버클 2개, 뒤축 박차에 청록 반짝임 1점 | STONE-2+CANDLE |
| 59 | `itm_relic_book` | 금서 | Forbidden Book | 두꺼운 책. 핏빛 표지, 금 잠금쇠, **사슬로 한 바퀴 묶여** 있다 | BLOOD+GOLD |
| 60 | `itm_relic_burst_amber` | 호박 불꽃 | Amber Flame | 사방으로 터지는 잉걸불 화염. 중심이 밝고 끝이 흩어진다 | EMBER |
| 61 | `itm_relic_burst_void` | 공허의 꽃 | Void Flower | 검은 꽃 한 송이. 꽃잎 5장이 벌어지고 **꽃심에서만 보랏빛**이 샌다 | VIOLET |
| 62 | `itm_relic_wing` | 찢긴 날개 | Torn Wing | **한쪽** 박쥐 날개. 막에 구멍이 세 군데 뚫렸고 아래가 너덜하다 | STONE-4 |
| 63 | `itm_relic_pendant` | 은빛 유물 | Silver Relic | 은 사슬에 매달린 물방울형 은 펜던트. 가운데 청록 돌 | BONE+CANDLE |
| 64 | `itm_relic_spark` | 여명의 불티 | Dawn Ember | 밝은 금빛 불티 하나. **4갈래 별빛 섬광**이 십자로 뻗는다 | GOLD |
| 65 | `itm_relic_dice` | 저주받은 주사위 | Cursed Die | 뼈 주사위 하나. **눈이 작은 해골**이고 한 모서리가 깨졌다 | BONE+VOID |
| 66 | `itm_relic_phoenix` | 잿불의 새 | Ember Bird | 재와 불티로 이루어진 작은 새가 위로 솟는다. 날개 끝이 재로 흩어진다 | EMBER |

### 4.7 ★ 등급 후광 5종 (칸 67~71) — 아이콘이 아니다

후광은 **아이콘 뒤에 깔리는 빛**이다. 그림이 아니라 "부드러운 원형 얼룩" 하나다.
`ItemIcon.jsx:12` 가 같은 32×32 자리에 후광을 먼저 깔고 그 위에 아이콘을 겹친다.

**왜 색만으로 등급을 구분하지 않는가** — `10-UIUX` §9.1 색맹 대응 때문이다.
색을 못 가리는 플레이어도 **후광이 크고 밝아지는 것**으로 등급을 읽어야 한다.
그래서 등급이 오를 때마다 **반경 +1px, 알파 +0.07** 이 반드시 지켜져야 한다.
이 값은 `gen-item-icons.mjs` 237~245행의 현행값이며 **그대로 재현**해야 폴백과 섞어 써도 티가 안 난다.

| 칸 | 키 | 등급 | 색(HEX) | 반경 | 최대 알파 |
|---|---|---|---|---|---|
| 67 | `itm_halo_common` | 흔함 | `#7b7488` | 12 px | 0.18 |
| 68 | `itm_halo_uncommon` | 드묾 | `#c7c2ce` | 13 px | 0.25 |
| 69 | `itm_halo_rare` | 희귀 | `#35c9b4` | 14 px | 0.32 |
| 70 | `itm_halo_epic` | 정수 | `#c4182b` | 15 px | 0.39 |
| 71 | `itm_halo_legendary` | 전설 | `#c9a227` | 16 px | 0.46 |

| 후광 규칙 | 값 | 왜 |
|---|---|---|
| 중심 | 칸의 정확한 중앙 (칸 내부 좌표 16,16) | 어긋나면 아이콘이 후광 밖으로 나간다 |
| 형태 | 완전한 원. 가장자리는 부드럽게(가우시안 blur 0x2 상당) 사라진다 | 유일하게 안티에일리어싱이 허용되는 칸 |
| **RGB** | **단일 색. 색 그라디언트 금지** | 변하는 것은 **알파뿐**이다. RGB 가 흔들리면 §7.5 고유색 검사가 폭발한다 |
| 2px 여백 규칙 | ★ **이 5칸만 예외** | 반경 16 은 칸을 꽉 채운다. §7.4 검사에서 이 5칸을 제외한다 |
| 네 모서리 픽셀 | alpha 0 | 원이 사각형으로 잘리지 않았다는 증거 |
| 안쪽에 무늬 | **금지** | 별·문양·테두리를 넣으면 아이콘과 싸운다 |

> 67번(common)은 게임이 안 그린다(§2.4). **그래도 그린다.** 빼면 좌표가 밀린다.

---

## 5. ★ 영어 프롬프트 전문

### 5.0 전달 방법

```
1. §5.1 을 복사해 붙인다.
2. 바로 뒤에 §5.2 「CELL MANIFEST」를 통째로 붙인다. (72줄. 한 줄도 빼지 마라)
3. 네거티브 프롬프트를 따로 받는 도구라면 §6 을 함께 준다.
4. 받은 파일은 store/_raw/ 에 그대로 저장하고 §7 검수를 돌린다.
5. 실패하면 §10 의 조정 포인트를 순서대로, 한 번에 하나씩만 바꾼다.
```

> §5.1 은 `15` 문서의 「공통 스타일 가이드 블록」을 앞에 붙이지 **않는다.**
> 그 블록은 "고해상도로 크게 그려라"를 요구하는데, 이 의뢰는 **정확한 픽셀 격자**가 목적이라
> 두 지시가 충돌한다. 필요한 스타일 규정은 아래에 다시 써 넣었다.

### 5.1 프롬프트 본문 (그대로 복사)

```
=== BLOODSWORN — ITEM ICON SHEET (71 icons, one sheet) ===

Produce ONE image file: a pixel-art item icon sheet.

--------------------------------------------------------------------
1. EXACT GEOMETRY — this is the hardest requirement in this brief
--------------------------------------------------------------------
Final deliverable: exactly 384 x 192 pixels (landscape, 2:1 aspect).
  Grid            : 12 columns x 6 rows = 72 cells
  Cell            : exactly 32 x 32 pixels, cells touch with NO gutter
  Cell (c,r) origin: x = (c-1)*32, y = (r-1)*32   (c and r start at 1)
  Fill order      : left to right, then top to bottom, cells 1..71
  Cell 72         : bottom-right cell, LEFT COMPLETELY EMPTY (transparent)

If your pipeline cannot render clean pixels at 384x192, render at EXACTLY
3072 x 1536 (an exact 8x scale, every art pixel = one 8x8 block of identical
colour) and deliver that. Do NOT deliver any other size. Non-integer multiples
such as 1000x500 or 1920x960 are rejected on sight, because downscaling them
destroys the pixel grid.

SAFE AREA INSIDE EACH CELL (cells 1-66 and 72):
  Draw only inside the centred 28 x 28 region of each cell.
  The outer 2-pixel ring of every one of those cells must be FULLY
  TRANSPARENT (alpha 0). This margin is checked automatically; if artwork
  bleeds into it, the sheet is rejected.
  Cells 67-71 (the rarity halos) are exempt from this margin rule.

Do NOT draw grid lines, guides, borders, frames, cell numbers, labels,
captions, or a background plate. Background is fully transparent everywhere.

--------------------------------------------------------------------
2. PIXEL ART RULES
--------------------------------------------------------------------
16-bit gothic dark-fantasy pixel art, in the spirit of late-SNES / early-PC
dungeon crawler inventory icons.
  - Every pixel placed on purpose. Hand-placed sprite look.
  - NO anti-aliasing anywhere except cells 67-71 (halos).
  - NO gradients, no airbrush, no soft shading. Use limited-palette
    dithering (ordered/Bayer) if you need a transition.
  - Alpha is strictly binary (0 or 255) in cells 1-66 and 72. No feathered
    edges, no semi-transparent halo around a sprite.
  - Selective 1px outline: the outer silhouette of each icon gets a hard 1px
    outline darker than its fill (#16121c for stone/metal/leather, #4a0710
    for blood-red objects, #0e3b3a for teal objects). Interior detail is done
    with colour shift, not outlines. NEVER pure black #000000.
  - Lighting is consistent across all 71 icons: a cold key light from the
    UPPER LEFT, and a weak warm crimson bounce from the LOWER RIGHT.
  - Each icon is a single object, centred in its cell, standing upright.
    No scene, no ground, no cast shadow on the ground, no pedestal.

--------------------------------------------------------------------
3. READABILITY — the reason this brief exists
--------------------------------------------------------------------
These icons are displayed in the game at 14 to 16 pixels, not 32.
SILHOUETTE IS EVERYTHING.
  - Each icon must still be identifiable when scaled down to 16x16.
  - Prefer 3 to 5 tones per object. Do not fill 32x32 with fine detail.
  - Objects in the same category MUST have distinct silhouettes. Ten swords
    that share one outline are a failure even if their colours differ.
  - Fill 22 to 28 pixels of the cell's height. Do not draw tiny objects
    floating in a large empty cell, and do not touch the safe-area border.

--------------------------------------------------------------------
4. STRICT PALETTE — use these hex values and nothing else
--------------------------------------------------------------------
  Void / darkest        #0b0710
  Stone shadow          #16121c
  Stone dark            #2a2533
  Stone body            #4a4454
  Stone light           #7b7488
  Bone / silver / glass #c7c2ce
  Blood body            #8b0f1d
  Blood light           #c4182b
  Blood glow            #ff3b4a
  Teal shadow           #1e7e74
  Teal body             #35c9b4
  Teal glow             #8ff0dc
  Gold / brass          #c9a227
  Parchment / leather   #c9b792
  Ash / neutral grey    #9a94a3
Three accent colours, used ONLY where the cell list below asks for them:
  Ember orange          #e07b39
  Rime pale blue        #8ecbe8
  Violet                #a86ede
Blood outline variant #4a0710 and teal outline variant #0e3b3a are allowed
for 1px outlines only.
TOTAL: 20 colours plus transparency. Any other colour is a defect.
No orange except #e07b39, no purple except #a86ede, no green at all other
than the teals listed.

--------------------------------------------------------------------
5. THE RARITY HALOS — cells 67 to 71 are NOT icons
--------------------------------------------------------------------
Each of these five cells contains ONE soft round glow and nothing else.
They are drawn BEHIND the item icons at runtime, so they must be clean.

  cell 67  colour #7b7488  radius 12 px  peak alpha 0.18
  cell 68  colour #c7c2ce  radius 13 px  peak alpha 0.25
  cell 69  colour #35c9b4  radius 14 px  peak alpha 0.32
  cell 70  colour #c4182b  radius 15 px  peak alpha 0.39
  cell 71  colour #c9a227  radius 16 px  peak alpha 0.46

  - Centre each glow exactly at (16,16) inside its own cell.
  - Perfectly circular. Alpha falls off smoothly to 0 at the stated radius,
    equivalent to a gaussian blur of sigma 2. This is the ONLY place in the
    sheet where soft edges are allowed.
  - The RGB colour is CONSTANT across the whole glow. Only ALPHA varies.
    Do not blend two colours, do not add a bright core of a different hue.
  - The four corner pixels of each of these cells must be alpha 0.
  - No ring, no star, no sparkle, no pattern inside the glow.
  - The size and brightness ladder above is a colour-blind accessibility
    requirement: each tier is one pixel wider and 0.07 alpha brighter than
    the previous one. Keep the steps exact and monotonic.

--------------------------------------------------------------------
6. WHAT GOES IN EACH CELL
--------------------------------------------------------------------
The CELL MANIFEST follows this brief. It lists all 72 cells in order as:

  cell number | row,column | icon name | what to draw

Follow it exactly and in order. Do not reorder, do not skip, do not merge,
do not add extra icons. If a description seems to duplicate another entry,
it does not — read the "what to draw" text, which always states how that
icon differs from its neighbours.

--------------------------------------------------------------------
7. DELIVERABLE
--------------------------------------------------------------------
One PNG with an alpha channel, 384x192 (or exactly 3072x1536).
No text, no watermark, no signature, no border, no background.
Also reply in text with the sheet's exact pixel dimensions, so it can be
verified before it is used.
```

### 5.2 CELL MANIFEST (§5.1 바로 뒤에 이어 붙인다 — 72줄 전부)

```
=== CELL MANIFEST — 72 cells, in this exact order ===
format: cell | row,col | frame name | what to draw

01 | 1,1  | itm_potion_s   | Small Blood Vial. Short-necked glass vial, bone stopper, iron collar. Dark blood fills only the bottom 40%.
02 | 1,2  | itm_potion_m   | Blood Vial. Same vial one size larger, blood at 70%. One 1px vertical glass highlight.
03 | 1,3  | itm_potion_l   | Great Blood Flask. Round-bellied flask, completely full, surface up in the neck, brighter #c4182b.
04 | 1,4  | itm_heart      | Beating Heart. Heraldic, symbolic heart, two cut arteries rising, one fat blood droplet falling. Not anatomical.
05 | 1,5  | itm_herb       | Grave Moss. A clump of moss growing on a broken headstone chip. Grey stone below, cold green moss above.
06 | 1,6  | itm_bomb       | Firestone. A fist-sized black stone split open, ember light #e07b39 leaking from the cracks. NO fuse, NO cartoon bomb.
07 | 1,7  | itm_cross      | Holy Water Vial. A CROSS-SHAPED glass bottle half full of teal water, a thin silver chain around its neck.
08 | 1,8  | itm_magnet     | Soul Compass. An open brass compass, needle tilted, a thin teal wisp curling off the dial. NOT a horseshoe magnet.
09 | 1,9  | itm_zzz        | Bell of Oblivion. A cracked bronze hand bell with NO clapper, verdigris on the lip.
10 | 1,10 | itm_lightning  | Ash of Lightning. A small grey heap of ash with one jagged gold lightning spark leaping upward out of it.
11 | 1,11 | itm_shield     | Shard of Holy Plate. A broken fragment of armour plate: one smooth curved edge with teal engraving, one torn jagged edge.
12 | 1,12 | itm_clover     | Four-Leaf Night. A four-leaf clover with almost black leaves; only the veins glow teal.
13 | 2,1  | itm_flask_blue | Bat's Pinion. A single bat wing-finger: leathery membrane, three bone struts, hooked tip, pale blue #8ecbe8 rim light. NOT a bottle.
14 | 2,2  | itm_flask_pink | Essence of Wrath. A squat glass bottle of crimson liquid boiling over, two thin red vapour trails from the neck.
15 | 2,3  | itm_flask_green| Nightsight Sap. A small horn bottle of dark green sap with a single engraved EYE on its side.
16 | 2,4  | itm_gem_teal   | Soul Shard. One teal crystal splinter, lit from within, its lower corner broken off.
17 | 2,5  | itm_coin       | Blood-Price Coin. A worn silver coin stamped with a fanged profile; dried blood sits in the engraved recesses.
18 | 2,6  | itm_pouch      | Graverobber's Pouch. A drawstring leather pouch, cord hanging loose, two or three gold coins spilling out of the mouth.
19 | 2,7  | itm_fang_01    | Broken Fang. A real animal fang bound with cord as a improvised stabbing tool; the tip is snapped blunt. Bone white.
20 | 2,8  | itm_fang_02    | Hunter's Dagger. A short straight dagger, plain straight crossguard, leather-wrapped grip, plain steel.
21 | 2,9  | itm_fang_03    | Rusted Sickle. A strongly curved sickle blade with blotchy red-brown rust, wooden handle.
22 | 2,10 | itm_fang_04    | Tooth-Studded Sword. A broad straight blade with real teeth hammered along one edge, making it uneven and serrated.
23 | 2,11 | itm_fang_05    | Cathedral Knight's Sword. A long straight arming sword, cruciform hilt, teal engraving in the fuller. The cleanest, most formal weapon here.
24 | 2,12 | itm_fang_06    | Blood-Soaked Saber. A single-edged curved saber; the lower third of the blade is wet with blood and a droplet hangs from the tip.
25 | 3,1  | itm_fang_07    | Crescent Scythe. A short haft topped by a blade that IS a crescent moon, pale bone-white; the haft is near black.
26 | 3,2  | itm_fang_08    | Martyr's Sword. A straight sword with a large iron nail driven through the middle of the blade; cloth-wrapped grip, gold pommel.
27 | 3,3  | itm_fang_09    | Midnight Rapier. A very thin thrusting sword with a swept basket guard; the blade is nearly black with a cold blue rim light.
28 | 3,4  | itm_fang_10    | Silvered Dagger. A leaf-shaped silver dagger. The only weapon on the sheet with two strong specular highlights.
29 | 3,5  | itm_hide_01    | Worn Leather Cuirass. A patched brown leather vest, rounded shoulders, laced closed down the front.
30 | 3,6  | itm_hide_02    | Moss-Grown Breastplate. An iron breastplate with moss spreading across it; angular shoulders, moss running down.
31 | 3,7  | itm_hide_03    | Priest's Vestment. A pale full-length robe with two teal stole bands hanging from the collar.
32 | 3,8  | itm_hide_04    | Gilded Breastplate. A smooth breastplate with gold trim and gold rivets, one gold emblem at the centre of the chest.
33 | 3,9  | itm_hide_05    | Coffinkeeper's Armor. Black iron plate whose surface reads as coffin-lid planks with a row of nail heads.
34 | 3,10 | itm_hide_06    | Chain Hauberk. A mail shirt; the whole surface is ring-mail dither texture and the hem is wavy.
35 | 3,11 | itm_hide_07    | Bone Harness. Armour made from a ribcage worn over the torso, spine running down the centre. Bone white.
36 | 3,12 | itm_hide_08    | Iron Helm. A one-piece great helm with a cross-shaped vision slit; the inside of the slit is pure void black.
37 | 4,1  | itm_hide_09    | Executioner's Visor. A hooded iron mask with NO eye holes, only one horizontal slit, and a small brand mark on the forehead.
38 | 4,2  | itm_hide_10    | Sentry's Shield. A heater shield with a pointed bottom, an iron central boss, and dents along the rim.
39 | 4,3  | itm_charm_01   | Red Reliquary. A small reliquary casket: crimson glass held in gold claw settings, a tiny cross on the lid.
40 | 4,4  | itm_charm_02   | Amber Bead. A round amber bead with a single insect trapped inside, visible as a dark silhouette.
41 | 4,5  | itm_charm_03   | Pale Sapphire. A faceted pale-blue gemstone; each facet is a different brightness step.
42 | 4,6  | itm_charm_04   | Moss Bead. A stone bead wrapped in moss, with one tendril escaping to the side.
43 | 4,7  | itm_charm_05   | Amethyst Reliquary. A tall violet hexagonal crystal held in a silver claw mount.
44 | 4,8  | itm_charm_06   | White-Night Orb. A smooth milk-white sphere lit from inside so its lower half glows.
45 | 4,9  | itm_charm_07   | Whirl Orb. A clear glass marble with a spiral ribbon coiled inside it.
46 | 4,10 | itm_charm_08   | Verdigris Whirl. NOT a sphere: a flat copper disc, green with verdigris, with a spiral engraved into its face.
47 | 4,11 | itm_charm_09   | Sealed Ring. A signet ring. The centre must be an ACTUAL HOLE so it reads as a ring. A red wax seal sits on the bezel.
48 | 4,12 | itm_charm_10   | Necklace of Remains. A leather cord strung with finger bones, with a single tooth hanging as the pendant.
49 | 5,1  | itm_relic_crown_gold | Crown of Greed. A five-spired gold crown, overloaded with gems, with coins caught between the spires.
50 | 5,2  | itm_relic_crown_iron | Iron Crown. A heavy plain iron circlet, four rivets, hammered dents. No gems at all.
51 | 5,3  | itm_relic_crown_red  | Crown of Blood. A crown woven from thorns, a blood droplet forming at the tip of each thorn.
52 | 5,4  | itm_relic_gear_iron  | Rusted Cog. A gear wheel with an ACTUAL HOLE at its centre and exactly one tooth missing. Rust brown over grey iron.
53 | 5,5  | itm_relic_gear_gold  | Golden Cog. The same gear geometry as cell 52 but gold and with every tooth intact. These two must read as a pair.
54 | 5,6  | itm_relic_shard_ice  | Frost Shard. A single sharp shard of ice, pale blue #8ecbe8, with a few white frost crystals on its surface.
55 | 5,7  | itm_relic_crystal    | Abyss Crystal. A CLUSTER of three dark violet crystals growing from one base. Silhouette must differ clearly from cell 54.
56 | 5,8  | itm_relic_hourglass  | Stopped Hourglass. A gold-framed hourglass whose falling sand grains are frozen in mid-air at the waist.
57 | 5,9  | itm_relic_glove      | Graverobber's Glove. A fingerless leather glove, dirt on the back of the hand, one gold coin held in the palm.
58 | 5,10 | itm_relic_boot       | Boot of Night. A tall black riding boot with two buckles and one small teal glint on the heel spur.
59 | 5,11 | itm_relic_book       | Forbidden Book. A thick tome with a blood-red cover and a gold clasp, wrapped once around with a chain.
60 | 5,12 | itm_relic_burst_amber| Amber Flame. A burst of ember-orange fire radiating outward, bright at the core, breaking apart at the edges.
61 | 6,1  | itm_relic_burst_void | Void Flower. A single black flower with five open petals; violet light escapes only from its centre.
62 | 6,2  | itm_relic_wing       | Torn Wing. ONE bat wing, three holes punched through the membrane, ragged along the lower edge.
63 | 6,3  | itm_relic_pendant    | Silver Relic. A teardrop silver pendant on a silver chain, with a teal stone at its centre.
64 | 6,4  | itm_relic_spark      | Dawn Ember. One bright gold ember with a four-pointed star flare radiating in a cross.
65 | 6,5  | itm_relic_dice       | Cursed Die. A single bone die whose pips are tiny skulls, with one corner chipped away.
66 | 6,6  | itm_relic_phoenix    | Ember Bird. A small bird made of ash and embers rising upward, its wingtips dissolving into ash flecks.
67 | 6,7  | itm_halo_common      | HALO ONLY. Soft round glow, colour #7b7488, radius 12 px, peak alpha 0.18, centred at (16,16). No shape inside.
68 | 6,8  | itm_halo_uncommon    | HALO ONLY. Soft round glow, colour #c7c2ce, radius 13 px, peak alpha 0.25, centred at (16,16). No shape inside.
69 | 6,9  | itm_halo_rare        | HALO ONLY. Soft round glow, colour #35c9b4, radius 14 px, peak alpha 0.32, centred at (16,16). No shape inside.
70 | 6,10 | itm_halo_epic        | HALO ONLY. Soft round glow, colour #c4182b, radius 15 px, peak alpha 0.39, centred at (16,16). No shape inside.
71 | 6,11 | itm_halo_legendary   | HALO ONLY. Soft round glow, colour #c9a227, radius 16 px, peak alpha 0.46, centred at (16,16). No shape inside.
72 | 6,12 | (empty)              | LEAVE THIS CELL COMPLETELY EMPTY AND TRANSPARENT. Do not draw a filler icon here.

=== END CELL MANIFEST ===
```

---

## 6. 네거티브 프롬프트

`15` 문서의 공통 네거티브에 **이 의뢰 고유의 실패 모드**를 더했다.
앞쪽 세 줄(격자/알파/스케일)이 이 의뢰에서 실제로 사고를 내는 항목이다.

```
grid lines, guide lines, cell borders, frame around each icon, drop shadow
outside the sprite, icons overlapping cell boundaries, uneven spacing,
misaligned grid, cropped icons, icons touching the cell edge,
white background, black background, checkerboard background, background plate,
semi-transparent edges, feathered alpha, soft glow bleeding into transparency,
mixed pixel scale, non-square pixels, blurry pixels, resampled pixels,
inconsistent pixel size between cells,
text, letters, numbers, labels, captions, item names, watermark, signature,
logo, ui mockup, inventory window, tooltip,
3d render, cgi, isometric render, photorealistic, photograph, clay render,
vector art, flat design, material design, sticker outline, glossy highlight,
bevel, emboss, chrome effect, outer glow, neon, lens flare, bloom,
smooth gradient, airbrush, soft shading, blur, motion blur, depth of field,
jpeg artifacts, noise, grain,
cute, chibi, cartoon, comic, anime, kawaii, mascot, cheerful, bright pastel,
bright saturated colors, rainbow, orange (other than #e07b39),
purple (other than #a86ede), lime green, yellow highlight,
identical silhouettes across a category, ten identical swords,
eight identical gemstones, duplicated icons, filler icons,
extra icons beyond 71, missing cells, reordered cells
```

---

## 7. 수령 검수 절차 — 눈으로 보기 전에 기계로 본다

ImageMagick 경로는 실측 확인됐다: `C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe`
아래는 **Git Bash** 기준이다. 순서대로 돌리고, 하나라도 실패하면 §10 으로 간다.

```bash
MG="/c/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe"
ROOT="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
RAW="$ROOT/store/_raw/items-sheet-raw.png"      # 받은 그대로. 절대 덮어쓰지 않는다
OUT="$ROOT/FE/public/assets/items/items.png"    # 최종 목적지
WORK="$ROOT/store/_raw/items-work.png"
```

### 7.1 치수와 채널

```bash
"$MG" identify -format "%w x %h  ch=%[channels]  alpha=%A  colors=%k\n" "$RAW"
```
기대: `384 x 192` 또는 `3072 x 1536`, `ch=srgba`, `alpha=True`.
`ch=srgb`(알파 없음)면 **즉시 반려** — 배경이 불투명하게 왔다는 뜻이다.

### 7.2 ★ 정수배 축소 (과거 사고 지점)

> **사고 이력:** 이전 의뢰에서 **정수배 축소를 건너뛰어 인장이 192×192 로 나온 적**이 있다.
> 크기가 "그럴듯해" 보여서 그대로 커밋됐고, 나중에 흐릿한 것을 눈으로 발견했다.
> **리사이즈 뒤에는 반드시 `identify` 로 다시 잰다.** 이 검사는 생략 대상이 아니다.

```bash
W=$("$MG" identify -format "%w" "$RAW"); H=$("$MG" identify -format "%h" "$RAW")
if [ "$W" -eq 384 ] && [ "$H" -eq 192 ]; then
  cp "$RAW" "$WORK"; echo "OK: 등배. 축소 불필요"
elif [ $((W % 384)) -eq 0 ] && [ $((H % 192)) -eq 0 ] && [ $((W / 384)) -eq $((H / 192)) ]; then
  echo "정수배 $((W / 384))x 확인 -> point 축소"
  "$MG" "$RAW" -filter point -resize 384x192! "$WORK"
else
  echo "반려: ${W}x${H} 는 384x192 의 정수배가 아니다. 재의뢰."; exit 1
fi
# ★ 축소 직후 반드시 다시 잰다
"$MG" identify -format "축소결과 %w x %h  (384 x 192 여야 한다)\n" "$WORK"
```

`-filter point` 는 **양보 불가**다. 빼면 최근접 이웃이 아니라 보간이 걸려 픽셀이 뭉개진다.
`384x192!` 의 `!` 는 종횡비 무시 강제 지정이다. 위에서 정수배를 이미 확인했으므로 안전하다.

### 7.3 투명도 — 배경이 진짜 비어 있는가

```bash
# 시트 네 모서리는 반드시 alpha 0 이다 (72번 빈 칸도 여기서 같이 잡힌다)
"$MG" "$WORK" -alpha extract -format \
  "TL=%[fx:p{0,0}] TR=%[fx:p{383,0}] BL=%[fx:p{0,191}] BR=%[fx:p{383,191}]\n" info:
# 72번 칸(6행 12열, x352..383 y160..191)이 완전히 비었는지
"$MG" "$WORK" -crop 32x32+352+160 +repage -alpha extract -format "cell72_max=%[fx:maxima]\n" info:
```
기대: 모서리 4개 전부 `0`, `cell72_max=0`.
`BR` 이 0 이 아니면 **72번 칸에 채움 아이콘을 그려 보냈다는 뜻**이고, 그건 프레임 수가 72가 됐다는 신호다.

### 7.4 ★ 격자 정렬 — 2px 여백을 기계가 검사한다

`18` 문서의 최대 실패(격자 어긋남)를 눈이 아니라 명령으로 잡는 절이다.
원리: **"그려도 되는 영역"의 마스크를 만들고, 그 밖에 알파가 있으면 실패.**

```bash
T="$ROOT/store/_raw/_tile32.png"; M="$ROOT/store/_raw/_mask.png"
# 1) 32x32 타일: 중앙 28x28 흰색(허용) + 바깥 2px 검정(금지)
"$MG" -size 28x28 xc:white -bordercolor black -border 2 "$T"
# 2) 시트 전체 크기로 타일링
"$MG" -size 384x192 "tile:$T" -alpha off "$M"
# 3) 후광 5칸(6행 7~11열)은 여백 규칙 예외 -> 통째로 허용 처리
"$MG" "$M" -fill white -stroke none -draw "rectangle 192,160 351,191" "$M"
# 4) 금지 영역에 알파가 있는가?  0 이어야 통과
"$MG" "$WORK" -alpha extract "$M" -negate -compose Multiply -composite \
  -format "여백침범 최대알파 = %[fx:maxima]  (0 이어야 통과)\n" info:
```
0 이 아니면 **격자가 밀렸거나 아이콘이 칸을 넘쳤다.** 어디인지 눈으로 보려면:
```bash
"$MG" "$WORK" -alpha extract "$M" -negate -compose Multiply -composite \
  -filter point -resize 800% "$ROOT/store/_raw/items-leak-8x.png"
```
흰 얼룩이 남은 칸이 범인이다.

### 7.5 팔레트 대조

```bash
"$MG" "$WORK" -depth 8 -unique-colors txt:- | tail -n +2 | awk '{print $3}' \
  | grep -v '00$' | cut -c1-7 | tr 'A-F' 'a-f' | sort -u
```
출력된 목록을 §3.2 의 18색 + 외곽선 2색(`#4a0710`, `#0e3b3a`)과 대조한다.
**개수가 25를 넘으면 반려.** 팔레트 밖 색이 하나라도 있으면 §10-4 로 재의뢰한다.
(후광은 알파만 변하고 RGB 는 고정이므로 정상 산출물이면 개수가 크게 늘지 않는다 — 늘었다면
후광에 색 그라디언트가 들어갔다는 뜻이고, 그것도 반려 사유다.)

### 7.6 후광 5칸 — 반경·알파 사다리가 지켜졌는가

```bash
for c in 7 8 9 10 11; do
  x=$(( (c-1) * 32 ))
  "$MG" "$WORK" -crop 32x32+$x+160 +repage -alpha extract \
    -format "col$c  corner=%[fx:p{0,0}]  centre=%[fx:p{16,16}]\n" info:
done
```
기대 `centre` 값: `0.18 / 0.25 / 0.32 / 0.39 / 0.46` (±0.02), **단조 증가**. `corner` 는 전부 `0`.
단조 증가가 깨지면 **색맹 대응이 무너진 것**이므로 색이 예뻐도 반려한다.

### 7.7 눈으로 보는 두 장

```bash
# (1) 8배 확대 + 32px 격자 오버레이 — 정렬을 눈으로 확인
"$MG" -size 254x254 xc:none -bordercolor "#ff00ff" -border 1 "$ROOT/store/_raw/_g.png"
"$MG" -size 3072x1536 "tile:$ROOT/store/_raw/_g.png" "$ROOT/store/_raw/_grid.png"
"$MG" "$WORK" -filter point -resize 800% "$ROOT/store/_raw/_8x.png"
"$MG" "$ROOT/store/_raw/_8x.png" "$ROOT/store/_raw/_grid.png" -composite \
      "$ROOT/store/_raw/items-check-grid.png"

# (2) ★ 실제 표시 크기 시뮬레이션 — 16px 로 줄였다가 다시 키운다
"$MG" "$WORK" -filter point -resize 50% -filter point -resize 800% \
      "$ROOT/store/_raw/items-check-16px.png"
```
(2) 가 이 의뢰의 **진짜 합격 판정**이다. §2.5 대로 게임에서는 14~16px 로 보인다.
여기서 검과 단검이 구분 안 되면, 32px 에서 아무리 예뻐도 실패다.

### 7.8 수용 기준 체크리스트

- [ ] 정확히 384 × 192 (또는 정수배 마스터 → §7.2 로 축소 후 384×192 **재측정 완료**)
- [ ] 알파 채널 있음. 네 모서리 alpha 0. 72번 칸 완전 공백
- [ ] §7.4 여백침범 최대알파 = 0 (격자 정렬 통과)
- [ ] 고유색 25개 이하, 전부 §3.2 팔레트 안
- [ ] 후광 5칸 중심 알파가 0.18→0.46 로 단조 증가, 모서리 alpha 0
- [ ] 71칸이 §2.4 순서와 **정확히** 일치 (`items-check-grid.png` 로 한 칸씩 대조)
- [ ] 16px 축소본에서 카테고리(물약/무기/갑옷/보석/유물)가 구분된다
- [ ] 같은 카테고리 안에서 실루엣이 서로 다르다 (송곳니 10, 가죽 10, 부적 10)
- [ ] 텍스트·워터마크·격자선·테두리 없음
- [ ] 안티에일리어싱이 후광 5칸 밖에는 없다

---

## 8. 적용 — 여기가 이 의뢰의 가장 짧은 절

§7 을 전부 통과했으면 **파일 하나를 덮어쓰는 것으로 끝난다.**

```bash
cp "$WORK" "$OUT"     # FE/public/assets/items/items.png
"$MG" identify "$OUT" # 384x192 최종 확인
```

**고치지 않는 파일** (§0.2 의 이유 그대로)
```
FE/public/assets/items/items.json      아틀라스 좌표 — 이미 맞다
FE/src/ui/inventory/itemFrames.json    DOM 쪽 좌표 사본 — 이미 맞다
FE/public/assets.json                  atlases[] 에 "items" 등록 — 이미 있다
FE/src/game/systems/ItemSystem.js      키를 프레임 이름으로 그대로 쓴다
```

확인:
```bash
cd "$ROOT/FE" && npm run validate      # 매니페스트/데이터 정합성 (validate.js:797)
cd "$ROOT/FE" && npm run dev           # 인벤토리·토스트·바닥 드롭을 눈으로
```
> ⚠ **아이콘이 엉뚱하게 뜨면 크래시가 아니라 조용한 오작동이다.**(`itemAtlas.js` 주석)
> 반드시 눈으로 본다. 물약을 먹었는데 왕관이 뜨면 §2.4 순서가 틀린 것이다.

---

## 9. ★ 폴백 원칙 — 절차 생성기를 지우지 않는다

### 9.1 왜 남기는가

| 이유 | 내용 |
|---|---|
| **라이선스 안전판** | 외부 에셋 의존 0 인 경로가 하나는 남아 있어야 한다 (`gen-item-icons.mjs` 헤더 주석) |
| **부분 채택** | Codex 결과가 전부 좋을 확률은 낮다. 55칸만 쓸 만하면 나머지 11칸은 절차 생성으로 메운다 |
| **후광 재현** | 반경/알파 사다리는 코드가 가장 정확하다. 후광만 절차 생성으로 덮어쓰는 선택지가 항상 있다 |
| **팔레트 일괄 변경** | 색 규정이 바뀌면 절차 쪽은 상수 한 줄로 66장이 따라온다 |
| **의뢰 실패 시** | 이 의뢰 전체를 잘라도 게임이 멈추지 않는다 (§0.4) |

**그래서 `FE/tools/gen-item-icons.mjs` 는 삭제 대상이 아니다.** 이 문서가 그 판단을 못 박는다.

### 9.2 섞어 쓰는 방법 — 칸 단위 합성

새 이미지를 **우선**하고, 채택하지 않은 칸만 절차 생성본으로 남긴다.

```bash
# 0) 절차 생성본을 먼저 만들어 백업해 둔다 (덮어쓰기 전에!)
cd "$ROOT/FE" && npm run build:items          # = node tools/gen-item-icons.mjs
cp "$ROOT/FE/public/assets/items/items.png" "$ROOT/store/_raw/items-proc.png"

# 1) 바탕 = 절차 생성본, 그 위에 Codex 시트에서 '채택한 칸만' 덮어쓴다
PROC="$ROOT/store/_raw/items-proc.png"
MERGED="$ROOT/store/_raw/items-merged.png"
ACCEPT="1 2 3 4 5 6 7 8 9 10 11 12 49 50 51 67 68 69 70 71"   # ← 채택 칸 번호
cp "$PROC" "$MERGED"
for n in $ACCEPT; do
  i=$((n-1)); x=$(( (i % 12) * 32 )); y=$(( (i / 12) * 32 ))
  "$MG" "$MERGED" \( "$WORK" -crop 32x32+$x+$y +repage \) \
        -geometry +$x+$y -compose Copy -composite "$MERGED.tmp.png"
  mv "$MERGED.tmp.png" "$MERGED"
done
cp "$MERGED" "$OUT"
```

- `-compose Copy` 가 핵심이다. 기본 `Over` 를 쓰면 **아래의 도형 아이콘이 새 그림의 빈 곳으로 비쳐 나온다.**
- 채택 칸 번호는 §2.4 의 번호를 그대로 쓴다.
- **카테고리 단위로 채택/미채택을 가르는 것을 권한다.** 소모품 16칸만 새 그림이고 무기는 도형이면
  화면에서 두 화풍이 나란히 보인다. 섞는다면 `1~18`(소모품+통화), `19~48`(장비), `49~66`(유물),
  `67~71`(후광) 단위로 끊는 편이 덜 어색하다.

### 9.3 후광만 절차로 되돌리기

Codex 후광이 §7.6 을 못 넘기면 **아이콘은 살리고 후광 5칸만** 절차 생성본으로 되돌린다.
`ACCEPT` 를 뒤집어 `67 68 69 70 71` 만 `$PROC` 쪽에서 가져오면 된다.
후광은 그림이 아니라 수치 규격이므로 **코드가 이기는 것이 정상**이다.

---

## 10. 재의뢰 조정 포인트 — 한 번에 하나씩만 바꾼다

`18` 문서가 4차까지 간 이유 중 하나는 **한 번에 여러 개를 바꿔서 무엇이 효과가 있었는지 몰랐다**는 것이다.
아래는 **실패 빈도 순**이다. 위에서부터, 하나씩.

| # | 증상 | 조정 (프롬프트 **맨 앞**에 추가한다) |
|---|---|---|
| 1 | 격자가 어긋남 / 칸이 밀림 | `"The sheet is a strict 12x6 grid of 32x32 cells with no gutter. Cell (c,r) starts at x=(c-1)*32, y=(r-1)*32. Draw inside the centred 28x28 of each cell only."` |
| 2 | 크기가 384×192 도, 정수배도 아님 | `"Output size must be EXACTLY 384x192 or EXACTLY 3072x1536. No other size is acceptable."` |
| 3 | 배경이 검정/흰색/체커보드 | `"Background must be alpha 0 transparent, not black, not white, not a checkerboard."` |
| 4 | 팔레트를 벗어남 | 팔레트 20색 목록을 프롬프트 **맨 끝에 한 번 더** 반복해 붙인다 (`15` 문서 A-01 재시도 4번과 같은 처방) |
| 5 | 픽셀이 흐림 / 보간된 느낌 | `"Hard pixel art. Every art pixel is a solid uniform block. No anti-aliasing, no interpolation, no soft edges anywhere except cells 67-71."` |
| 6 | 같은 카테고리가 다 똑같이 생김 | `"Cells 19-28 must have TEN DIFFERENT silhouettes: straight sword, dagger, sickle, serrated blade, longsword, saber, crescent, nailed sword, rapier, leaf dagger."` (가죽·부적도 같은 방식으로) |
| 7 | 16px 로 줄이면 뭉개짐 | `"Simplify. 3 to 5 tones per object. These are read at 16x16 pixels."` |
| 8 | 후광에 무늬/그라디언트가 들어감 | `"Cells 67-71 contain ONE flat-coloured circular alpha gradient each. Single RGB value, only alpha varies. No pattern, no ring, no core."` |
| 9 | 72번 칸에 채움 아이콘이 들어감 | `"Cell 72 is intentionally empty. Leave it fully transparent."` |
| 10 | 아이콘 밑에 그림자/받침이 생김 | `"No ground, no pedestal, no cast shadow. Each icon floats alone on transparency."` |
| 11 | 자석·폭탄이 만화풍으로 나옴 | `"Cell 08 is a brass compass, not a magnet. Cell 06 is a cracked ember stone, not a bomb with a fuse."` |
| 12 | **3회 실패** | **부분 채택으로 전환한다(§9.2).** 되는 카테고리만 쓰고 나머지는 절차 생성으로 간다. 아이콘 한 장에 하루를 쓰지 않는다 |

### 10.1 실패 이력 (재의뢰할 때마다 여기에 한 줄씩 적는다)

> `18` 문서 §0 의 형식을 그대로 쓴다. **적지 않으면 다음 사람이 같은 실패를 반복한다.**

| 차수 | 날짜 | 무엇을 바꿨나 | 결과 | 남은 문제 |
|---|---|---|---|---|
| 1차 | (미의뢰) | — | — | — |
| | | | | |
| | | | | |

---

## 11. 2차 의뢰 후보 — 아이템 말고도 도형인 것들

`FE/src` 와 `FE/tools` 를 전수 조사한 결과다. **이 문서(1차)에 넣지 않는다.**
1차가 성공한 뒤에, 그때의 팔레트·화풍을 레퍼런스로 붙여서 따로 의뢰한다.
한 번에 다 의뢰하면 `18` 문서의 실패가 그대로 재현된다.

### 11.1 B군 — HUD, 화면에 상시 떠 있다 (2차 의뢰 1순위)

| # | 항목 | 현재 | 위치 | 크기 |
|---|---|---|---|---|
| B-1 | **대시 버튼** | `fillCircle(r=20)` + `strokeCircle`. **대체 아트가 아예 없다** | `HudScene.js:158-161` | 40×40 (+쿨다운 링 48) |
| B-2 | **대시 쿨다운 링** | `arc(r=24)` 3px, −90°에서 시계방향 | `HudScene.js:164-169` | 48×48 |
| B-3 | **EXP 오브** | `circle r=2` 청록 단색. 런 내내 화면에 수십 개 | `CombatSystem.js:83-87` | 4×4 (또는 8×8 스프라이트) |
| B-4 | 조이스틱 tether 선 | 1px 선. 아트가 있어도 **항상** 그려진다 | `HudScene.js:131-132` | — |
| B-5 | 보스 HP 바 + 페이즈 눈금 | `400×8` 사각형 3겹 + `2×10` 눈금 2개 | `HudScene.js:197-209` | 400×8 |
| B-6 | HP/EXP 바 **채움** | 프레임은 나인슬라이스 아트인데 **채움은 사각형** | `HudScene.js:84-91` | 120×10 / 640×4 |
| B-7 | 보물상자 | `rectangle 11×9` 금색 + 1px 테두리 | `SpawnSystem.js:69-74` | 11×9 |
| B-8 | 적 화살 | `rectangle 7×2` | `EnemyProjectileSystem.js:38-43` | 7×2 |

### 11.2 C군 — 유니코드 글리프를 아이콘 대신 쓰는 곳

이건 **이미지가 아니라 글자**다. 폰트가 바뀌면 모양이 바뀌고, 기기마다 다르게 렌더된다.

| # | 항목 | 글리프 | 위치 |
|---|---|---|---|
| C-1 | 슬롯 3종(송곳니/가죽/부적) 빈칸 표시 | `⚔ ⛨ ☾` | `itemText.js:36-38` |
| C-2 | 카테고리 표식 | `⚗ ⬤ ◈ ✦` | `itemText.js:45-50` |
| C-3 | 등급 표식(색맹 1차 채널) | `○ ◇ ◈ ◆ ★` | `itemText.js:26-32` |
| C-4 | **성소 업그레이드 노드 6종 — 실제 이모지** | `🛡 ⚔ 👟 ⬤ ✦ 📜` | `sanctum.json` 10·21·32·43·54·65 |
| C-5 | 완전 흡혈귀화 표식 | `✖` | `HumanityHearts.jsx:22` |
| C-6 | 일시정지 메뉴 3버튼 | `▶ ⚙ ✖` | `UiLayer.jsx:55-62` |
| C-7 | 스테이지 클리어/잠금 | `✔ 🔒` | `StageSelectScreen.jsx:177·186` |
| C-8 | 골드 표식 | `⬤` | Sanctum·StageSelect·Title 여러 곳 |

> ★ **C-4 가 가장 급하다.** 고딕 호러 게임 성소 화면에 컬러 이모지 `🛡 👟 📜` 가 떠 있다.
> 16×16 픽셀 아이콘 6종이면 해결된다. 2차 의뢰에 넣기 가장 좋은 항목이다.

### 11.3 D군 — 전투 이펙트 (도형이지만 급하지 않다)

전부 `fillCircle`/`fillSector`/`rectangle` 이다. **텔레그래프는 도형인 편이 오히려 읽기 쉽다** —
보스 장판·원뿔·돌진 예고(`BossSystem.js:1088-1184`), 적 조준선(`EnemyAISystem.js:112-215`),
스테이지 기믹(`StageSystem.js:301-710`), 각성 연출(`AwakeningSystem.js:245-815`).
**의뢰하지 않는 것을 권한다.** 아트로 바꾸면 가독성이 떨어지고 라이선스만 늘어난다.

**단 하나 예외:** `FE/public/assets/fx/fx-slash.png`(512×64, 8프레임)가 **매니페스트에 로드되는데
코드 어디에서도 안 쓴다.** 근접 공격은 지금 `g.slice()` 붉은 파이 조각이다(`CombatSystem.js:143-147`).
**이건 의뢰가 아니라 배선 문제다.** 이미 있는 그림을 붙이기만 하면 된다 — 2차 의뢰 전에 처리할 것.

### 11.4 E군 — 데미지 숫자 폰트

`FxSystem.js:72-125` 가 3×5 비트마스크로 `0-9!` 를 런타임에 구워 **44×6** 텍스처를 만든다.
숫자 11자뿐이라 **의뢰 대상으로는 가성비가 낮다.** 다만 고딕 세리프 숫자로 바꾸면 분위기가 사는 항목이라
2차 의뢰에 여유가 있으면 **`0-9` + `!` 를 5×7 격자, 총 77×7 한 줄 시트**로 받는 안을 제안한다.

---

## 12. 사용자가 할 일 (순서대로)

```
[1] Codex 에 의뢰
    §5.1 프롬프트 본문  +  §5.2 CELL MANIFEST 72줄  을 이어서 붙여넣는다.
    네거티브를 따로 받는 도구면 §6 도 준다.

[2] 받은 파일 저장
    store/_raw/items-sheet-raw.png     ← 받은 그대로. 절대 덮어쓰지 않는다.
    (정수배 마스터로 왔으면 파일명에 크기를 붙여 둔다: items-sheet-3072x1536.png)

[3] 검수
    §7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7 순서로 명령을 돌린다.
    §7.8 체크리스트 10항목이 전부 통과해야 다음으로 간다.

[4] 실패하면
    §10 표에서 위에서부터 하나만 골라 프롬프트 앞에 붙이고 재의뢰.
    바꾼 내용을 §10.1 실패 이력 표에 한 줄 적는다.
    3회 실패하면 §9.2 부분 채택으로 전환한다.

[5] 통과하면 적용
    cp store/_raw/items-work.png  FE/public/assets/items/items.png
    npm run validate  후  npm run dev  로 눈으로 확인.
    JSON 도 코드도 고치지 않는다.

[6] 백업
    절차 생성본을 store/_raw/items-proc.png 로 남겨 둔다 (§9.2).
    gen-item-icons.mjs 는 지우지 않는다.
```

---

## 13. 관련 문서

- `15-IMAGE-PROMPTS-FOR-CODEX.md` — A-01~A-15. **의뢰서 형식의 정본.** 팔레트 원안도 여기에 있다
- `18-MAP-IMAGE-PROMPT.md` — 맵 에셋 의뢰. **실패 이력 관리 방식**을 이 문서가 물려받았다
- `09-ART-AUDIO-AND-ASSET-MAP.md` §1.1 — 팔레트 문서 원안. **§3.1 대로 index.css 와 어긋나 있다 → 갱신 필요**
- `23-ITEM-SYSTEM.md` — 아이템 설계 정본. 아이콘 키가 데이터이지 코드가 아니라는 원칙(§7.3)
- `10-UIUX` §9.1 — 색맹 대응. 후광의 반경·알파 사다리(§4.7)의 근거
- `FE/tools/gen-item-icons.mjs` — 절차 생성기. **폴백. 지우지 않는다**
- `FE/tools/item-icon-map.json` — 구매 에셋으로 갈 때의 매핑 흔적. 이번 의뢰와 무관하지만 남겨 둔다
