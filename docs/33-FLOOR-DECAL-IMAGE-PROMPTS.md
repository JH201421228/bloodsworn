# 33 · 바닥 데칼 이미지 의뢰 (Codex 의뢰용) — 좌판·제단·조우 마커 12칸

> 대상: `FE/public/assets/decal/enc-decal-48.png`(신규) + `FE/public/assets/decal/enc-decal-72.png`(신규)
> 선행 정본: `29-ICON-IMAGE-PROMPTS`(1차 의뢰 · **여백 규칙과 검수 절차를 승계한다**)
> · `32-RUNE-AND-ENCOUNTER-ICON-PROMPTS`(2차 의뢰 · 팔레트와 배선 절차를 승계한다)
> · `30-ENCOUNTERS-AND-FIELD-EVENTS` §3.1~§3.6 · §7.3(좌판이 지금 무엇인지)
> · `09-ART-AUDIO-AND-ASSET-MAP`(팔레트 원본)
>
> ★ 이 의뢰는 `29`·`32` 와 **격자가 다르다.** 그래서 별도 문서다 — 근거는 §0.2.

---

## 0. 왜 이 의뢰를 하는가

### 0.1 지금 바닥에 그림이 하나도 없다

사용자 제보 그대로다 — *"제단이 열리거나 하는 특수한 이벤트가 발생하는 상황에서
바닥에 각 색깔별로 동그란 원이 생기는데 너무 성의없어 보인다."* 실측으로 확인했다.

| 자리 | 현재 무엇으로 그려지는가 | 코드 위치 |
|---|---|---|
| **좌판 받침 3개** | `add.circle(x, y, 16, 0xffffff, 0.2)` — **반투명 단색 원** | `EncounterSystem.js:137` · 표시는 `:529` |
| **잠긴 좌판** | 같은 원. **색만 회색, 알파만 0.26 → 0.14** | `EncounterSystem.js:528-530` |
| **「피의 제단」** | **같은 원 2개.** `altarRing`(반지름 34) + `altarFill`(반지름 1→34 로 커진다) | `EncounterSystem.js:169-170` · `:563-568` |
| **필드보스 등장 지점** | **없다.** 바닥 표시가 아예 없다 | `beginFieldBoss()` 는 적만 소환한다 |
| **조우 NPC 발밑** | **없다.** NPC 스프라이트만 서 있다 | `beginStall()` |

★ **제단은 좌판과 완전히 같은 원이다.** `mk()` 라는 같은 생성자에서 나온 같은 풀이고
(`:169` 가 `:137` 의 `mk` 를 그대로 부른다), 반지름과 색만 다르다. 즉 이 게임에서
가장 극적인 조우인 「피의 제단」과 상인 좌판이 **같은 도형**으로 그려지고 있다.

⚠ `30` §3.5 는 제단이 `StageSystem` 의 원형 기믹을 재사용한다고 적었지만 **실제로는 아니다.**
`EncounterSystem.js:128-134` 가 이유를 적어 두었다 — `obtainCircle()` 은 `sanctuary`/`rockfall`
기믹 스테이지에서만 풀이 만들어져 stage2·3·5 에서 `null` 을 돌려주기 때문에 자기 원을 따로 갖는다.
**이 문서의 규격은 정본이 아니라 코드 실측을 따른다.**

### 0.2 ★ `29`·`32` 시트에 끼워 넣을 수 없다 — 격자가 다르다

`32` §9 가 스스로 이렇게 적어 두었다.

> 격자 규격이 다른 것을 한 시트에 섞으면 `29` §0.3 이 기록한
> "격자가 어긋나면 전부 밀린다" 사고가 재발한다

바닥 데칼은 그 조건에 정확히 걸린다.

| | `29`/`32` 아이콘 | 이 의뢰의 데칼 |
|---|---|---|
| 형태 | 사각 실루엣 | **원형** |
| 칸 크기 | 32 x 32 | **48 x 48 · 72 x 72** (§2 실측) |
| 보는 각도 | 정면 | **바닥에 누운 평면** |
| 색 | 그림 안에 색이 있다 | ★ **무채색으로 그리고 코드가 tint 로 색을 준다** (§5) |
| 회전 | 없다 | **있다** — 고리가 돈다 (§3.4) |

색을 넣지 않는다는 점이 `29` 와 가장 크게 다르다. 이것을 프롬프트에 분명히 박지 않으면
색이 칠해진 시트가 오고, 그러면 tint 가 이중으로 곱해져 전부 탁해진다.

### 0.3 이 의뢰가 실패해도 게임은 안 멈춘다

`29` §0.4 · `32` §0.2 와 같은 원칙이다. **12칸 전부 폴백이 이미 동작 중이다** —
지금 화면에 나오는 그 반투명 원이 곧 폴백이다.

시트가 안 오거나 품질이 나쁘면 **`assets.json` 에서 두 줄을 빼면 전부 원으로 되돌아간다.**
코드 롤백이 필요 없다. `EncounterSystem` 은 `scene.textures.exists()` 로 갈라지고,
없으면 지금의 `add.circle` 경로를 그대로 탄다(§9.3).

### 0.4 앞선 의뢰에서 물려받은 것

- **2px 여백이 격자 어긋남을 기계로 잡는 유일한 수단이다**(`29` §2.3) → §3.3 에서 그대로 쓴다
- **정수배가 아닌 축소는 픽셀아트를 뭉갠다**(`29` §7.2) → §8 검수에서 그대로 쓴다
- **칸 순서를 바꾸면 전부 틀어진다**(`29` §2.4) → §4 매니페스트가 절대 기준이다
- **폴백 코드를 지우지 않는다**(`29` §9) → §9.3

---

## 1. 산출물

| # | 파일 | 규격 | 담는 것 |
|---|---|---|---|
| 1 | `enc-decal-48.png` | **288 x 48**, RGBA, 배경 완전 투명 | 좌판 받침 · 잠긴 좌판 · 조우 마커 (6칸) |
| 2 | `enc-decal-72.png` | **576 x 72**, RGBA, 배경 완전 투명 | 「피의 제단」 마법진 (8칸) |
| 3 | (선택) `enc-decal-48@2x.png` | 576 x 96 | 있으면 정수배 축소로 검수에 쓴다 |
| 4 | (선택) `enc-decal-72@2x.png` | 1152 x 144 | 위와 같다 |

**용량**: RGBA8888 기준 288x48 = 55KB, 576x72 = 166KB → 합계 **221KB**.
현재 GPU 예산은 15.65MB 다(`assets.json` `_comment` 실측). 1.4% 를 더한다.

---

## 2. ★ 실측 — 규격이 어디서 나왔는가

**추정한 값이 하나도 없다.** 아래 표의 모든 숫자는 코드나 데이터에서 읽은 것이다.
크기가 틀리면 받은 그림을 못 쓰기 때문에 이 절이 이 문서에서 가장 중요하다.

### 2.1 좌판 받침 — 지금 원반이 아이콘에 통째로 가려져 있다

| 항목 | 실측값 | 출처 |
|---|---|---|
| 원 반지름 | **16 논리px** (지름 32) | `EncounterSystem.js:137` `add.circle(x, y, 16, ...)` |
| 위에 얹히는 아이콘 | **32 x 32**, `setScale(1)` | `items.json` 프레임 71개 전부 `w:32 h:32` · `EncounterSystem.js:534` |
| 좌판 사이 간격 | **46px** (중심 대 중심) | `encounters.json` `spawn.pedestalGap: 46` |
| 밟기 판정 반지름 | 14px (그림과 무관) | `encounters.json` `spawn.pickRadius: 14` |
| 깊이 | 원 `DEPTH.ORB`(20) / 아이콘 21 / 글자 22 | `EncounterSystem.js:137,151,156` |

★ **여기서 나온 발견 하나.** 원반 지름이 32 인데 그 위에 얹는 아이템 아이콘도 32 다.
아이콘 그림은 칸 안 28x28 이므로(`29` §2.3) **원반은 사방 2px 만 삐져나온다.**
지금 좌판 원이 유난히 초라해 보이는 이유가 알파 0.26 때문만이 아니라 **거의 보이지 않기 때문**이다.

→ **원반을 키운다. 상한은 46이다** — `pedestalGap` 이 46이므로 지름이 46을 넘으면 옆 좌판과 겹친다.
그래서 그림 영역을 **44 x 44** 로 잡는다(사방 1px 씩 숨 쉴 틈). 32짜리 아이콘 둘레에
**6px 폭의 돌 테가 남는다** — 이 폭이 이 의뢰의 실제 표현 공간 전부다.

### 2.2 「피의 제단」 — 68px, 그리고 이 숫자를 바꾸면 안 된다

| 항목 | 실측값 | 출처 |
|---|---|---|
| 반지름 | **34 논리px** (지름 68) | `encounters.json` `enc_altar.radius: 34` |
| 채널링 시간 | **3초** | `enc_altar.channelSec: 3` |
| 채움 원 | 반지름 1 → 34 로 커진다 | `EncounterSystem.js:668` |
| 바탕색 | `0xa21f2d`, 알파 0.3 | `enc_altar.color: 10620973`, `alpha: 0.3` |
| 테두리 | `0xc4182b`, 1px, 알파 0.9 | `EncounterSystem.js:565` |
| 체류 | 30초. 마지막 6초는 **점멸이 아니라 서서히 옅어진다** | `enc_altar.stay: 30`, `blinkLast: 6` · `:632-637` |

★ **반지름 34는 그림 크기가 아니라 판정 반지름이다.** `tickAltar()` 가 이 값으로
"안에 서 있는가"를 판정한다(`:664`). 그래서 **마법진의 바깥 끝은 정확히 지름 68이어야 한다.**
더 크게 그리면 "그림 위에 서 있는데 안 차오른다"가 되고, 더 작게 그리면
"그림 밖인데 차오른다"가 된다. 둘 다 플레이어에게는 버그로 읽힌다.

→ 칸 안쪽 그림 영역을 **68 x 68** 로 못 박는다. 여백 2px 를 더해 **칸 72 x 72**.

### 2.3 필드보스 — 바닥 표시가 아예 없다

`beginFieldBoss()` 는 `spawn.spawnElite()` 로 적 하나를 소환할 뿐이고 바닥에는 아무것도 안 그린다.
지금 플레이어가 필드보스를 알아보는 단서는 화면 밖 화살표의 해골 글리프
(`KIND_MARK.fieldboss`) 하나뿐이다. 화면 안에 들어오면 **그냥 조금 큰 적**이다.

| 항목 | 실측값 | 출처 |
|---|---|---|
| 스프라이트 원본 | 16 x 16 | `assets.json` `monsters` `frameWidth/Height: 16` |
| 배율 | **2.1** (10종 전부 동일) | `enemies.json` `tier:"miniboss"` 10종 `scale: 2.1` |
| 화면 크기 | **33.6 x 33.6 논리px** | 16 x 2.1 |
| 추적 반경 | 140px (밖에서는 안 쫓아온다) | `encounters.json` `fieldboss.leashRadius` |

→ 33.6px 짜리 적을 감싸려면 **44 지름**이면 충분하고 남는다. 좌판과 같은 48 칸에 들어간다.
같은 격자에 담을 수 있다는 것이 이 마커를 시트 A 에 넣는 근거다.

### 2.4 화면에서 실제로 보이는 크기 — 이것이 디테일 상한이다

| 대상 | 논리px | 640x360 화면에서 차지하는 비율 |
|---|---|---|
| 좌판 받침 | **44** | 가로의 6.9% |
| 제단 | **68** | 가로의 10.6% |
| 필드보스 마커 | **44** | 가로의 6.9% |

★ **좌판은 44px 다. 작다.** 이 크기에서 1px 선 하나는 화면 실물에서 머리카락 한 올이다.
게다가 데칼은 **알파 0.3 안팎으로 깔린다**(§5.2). 밝기가 3분의 1이 되면 대비가 무너져
세밀한 선은 그냥 사라진다. **44px 에서 사라질 선은 노이즈만 된다 — 그리지 마라.**

---

## 3. ★ 시트 배치 규격 — 이 문서에서 두 번째로 중요한 절

### 3.1 시트 A — `enc-decal-48.png`

```
288 x 48  =  6열 x 1행  =  6칸,  칸 하나 48 x 48
```

| 항목 | 값 | 왜 |
|---|---|---|
| 칸 크기 | **48 x 48** | §2.1. 그림 44 + 사방 여백 2 = 48 |
| 안전 영역 | 중앙 **44 x 44** | `pedestalGap` 46 상한에서 나온 값 |
| 강제 여백 | 바깥 **2px 완전 투명** | ★ 격자 어긋남 자동 검사(§3.3) |
| 열 | 6 | 좌판 2 + 마커 3 + 예비 1 |
| 행 | 1 | 6칸이면 한 줄이 가장 안전하다. 행이 늘면 세로 정렬 사고가 하나 더 생긴다 |

### 3.2 시트 B — `enc-decal-72.png`

```
576 x 72  =  8열 x 1행  =  8칸,  칸 하나 72 x 72
```

| 항목 | 값 | 왜 |
|---|---|---|
| 칸 크기 | **72 x 72** | §2.2. 그림 68 + 사방 여백 2 = 72 |
| 안전 영역 | 중앙 **68 x 68** | ★ 제단 판정 지름과 **정확히** 같다. 바꾸면 판정과 그림이 어긋난다 |
| 강제 여백 | 바깥 **2px 완전 투명** | §3.3 |
| 열 | 8 | 고리 1 + 문양 1 + 채움 1 + 발동 섬광 4 + 예비 1 |

★ 시트 B 의 여백 검사는 **시트 A 보다 훨씬 날카롭다.** 마법진 고리의 바깥 끝이
안전 영역 경계(68)에 정확히 닿게 그리므로, 그림이 1px 만 밀려도 여백을 침범한다.
이 시트에서는 2px 여백이 장식이 아니라 실질적인 자다.

### 3.3 ★ 칸 안쪽 규칙 — 격자 어긋남을 기계가 잡게 만든다

`29` §2.3 을 그대로 승계한다. 값만 칸 크기에 맞춰 바꿨다.

| 규칙 | 시트 A | 시트 B | 왜 |
|---|---|---|---|
| 안전 영역 | 중앙 44 x 44 | 중앙 68 x 68 | 그림은 여기 안에만 |
| 강제 여백 | 바깥 2px alpha 0 | 바깥 2px alpha 0 | 밀리면 이 띠를 침범한다 → §8 이 즉시 잡는다 |
| 거터 | **두지 않는다** | **두지 않는다** | 칸 사이 간격을 두면 48·72 배수 좌표가 깨진다. 여백은 칸 *안쪽*에 있다 |
| 격자선 | **그리지 않는다** | **그리지 않는다** | 안내선을 그려 보내면 그게 그대로 이미지에 남는다 |
| 배경 | 완전 투명 | 완전 투명 | 바닥 타일 위에 얹힌다 |

> **왜 2px 인가 — 칸이 커졌는데도 그대로인 이유.**
> 여백은 "허용 오차"이지 "비율"이 아니다. 검사가 잡아야 하는 것은 *격자가 몇 px 밀렸는가*이고
> 그 오차는 칸 크기와 무관하게 1~3px 로 들어온다. 여백을 4px 로 늘리면 3px 밀린 시트가
> 통과해 버린다. **`29` 와 같은 2px 이어야 같은 민감도를 갖는다.**

### 3.4 ★ 회전 프레임 — 중심이 어긋나면 돌 때 흔들린다

이 의뢰에만 있는 규칙이다. `29`·`32` 의 아이콘은 회전하지 않지만 **여기는 돈다.**

코드는 스프라이트 하나의 `rotation` 만 매 프레임 조금씩 올린다. Phaser 의 회전 원점은
`setOrigin(0.5, 0.5)` 기준 **칸의 정확한 기하학적 중심**이다. 시트 A 는 칸 안 (23.5, 23.5),
시트 B 는 (35.5, 35.5) 가 그 지점이다(0-based 화소 좌표계).

**회전하는 칸의 그림은 그 점을 중심으로 대칭이어야 한다.** 한쪽으로 1px 치우치면
한 바퀴 돌 때마다 지름 2px 의 원을 그리며 흔들린다 — 마법진이 "떨리는" 것으로 보인다.

| 칸 | 회전 | 검사 |
|---|---|---|
| A-02 `ped_halo` | 느린 회전 | V-8 |
| A-03 `mark_boss` | 느린 역회전 | V-8 |
| B-00 `altar_ring` | **회전. 이 의뢰의 핵심 연출** | V-8 · V-9 |

→ §8 의 **V-8(중심 정렬)** · **V-9(반경 프로파일)** 가 이것을 기계로 잡는다.

### 3.5 왜 두 장인가 — 배치가 안 끊긴다는 근거

`29` §2.1 은 "텍스처 바인드 1회로 고정된다"는 이유로 한 장을 고집했다.
여기서 두 장으로 나눠도 그 이유가 훼손되지 않는다. **두 시트는 절대 같은 화면에 안 뜬다.**

- 조우는 한 번에 하나다 — `this.act` 가 단수이고 창 5개가 서로 겹치지 않는다(`30` §4.1)
- 그리고 「피의 제단」은 **`pedestals: 0`** 이다(`encounters.json`). 제단이 뜬 순간
  좌판은 0개이고, 좌판이 있는 조우에는 제단이 없다
- `beginStall()` 이 `def.kind === "altar"` 에서 `showAltar()` 로 갈라져 나가 좌판을 아예 안 만든다

즉 어느 프레임에도 두 텍스처가 동시에 배치에 들어가지 않는다. 텍스처 유닛(실측 16칸)을
동시에 2칸 쓰는 순간이 없다. **한 장으로 억지로 합치면 오히려 손해다** — 72 칸에 44 그림을
넣으면 좌판 스프라이트가 72x72 쿼드가 되어 필요 없는 투명 화소를 매 프레임 칠한다.

---

## 4. ★ 칸 순서 매니페스트 (절대 기준 — 바꾸지 않는다)

행 우선(row-major), 0-based 프레임 인덱스. Phaser `spritesheet` 로더가 이 순서로 센다.
칸 하나만 밀려도 뒤가 전부 어긋나고 부분 수정이 불가능하다.

### 4.1 시트 A — `enc-decal-48.png` (6칸, 칸 48x48, 그림 44x44)

| 칸 | 이름 | 어디에 쓰나 | 그릴 것 | 회전 | 코드가 주는 tint |
|---|---|---|---|---|---|
| **00** | `ped_base` | 좌판 받침 (상인·마녀·예언자·수상한 자) | 낮은 **돌 원반**을 바로 위에서 내려다본 모습. 바깥 2px 테두리 테, 그 안쪽에 1px 어두운 홈, 가운데는 거의 비어 있다(아이콘이 덮는다). 테를 따라 **8방향 눈금**(짧은 룬 새김) | X | 등급색 5종 |
| **01** | `ped_locked` | **잠긴 좌판** (체력이 가격 이하) | 00 과 **같은 지름·같은 실루엣**. 다른 점은 형태로만 — 원반에 **갈라진 금 2줄**, 테 위를 가로지르는 **굵은 빗장 하나**, 눈금은 8개 중 3개가 부서져 있다. ★ 색이 아니라 **형태로 "못 산다"가 읽혀야 한다** | X | `#4a4650` |
| **02** | `ped_halo` | 살 수 있는 좌판 강조 | 원반 **바깥에 겹쳐 도는 얇은 고리**. 지름 44 를 꽉 채우는 1px 파선 고리 + 등간격 짧은 빗금 12개. 안쪽은 완전히 비어 있다(원반이 비쳐야 한다) | O 느리게 | 등급색 5종 |
| **03** | `mark_boss` | **필드보스 지점** (§2.3 — 지금 표시가 없다) | 톱니처럼 안쪽으로 뾰족한 이빨 8개가 달린 **이중 위험 고리**. 좌판의 매끈한 원과 한눈에 구분돼야 한다. 안쪽은 비어 있다(적이 그 위에 선다) | O 느린 역회전 | 핏빛 |
| **04** | `mark_npc` | 조우 NPC 발밑 | **아주 옅은 얕은 원**. 테두리 없이 안쪽만 채운 원반, 가장자리 1~2px 만 조금 진하다. 발밑 그림자와 "여기가 조우 지점"을 겸한다 | X | 종류색 |
| **05** | — | **예비. 완전히 비운다 (alpha 0)** | | | |

### 4.2 시트 B — `enc-decal-72.png` (8칸, 칸 72x72, 그림 68x68)

| 칸 | 이름 | 어디에 쓰나 | 그릴 것 | 회전 |
|---|---|---|---|---|
| **00** | `altar_ring` | 「피의 제단」 바깥 고리 | ★ **이 시트의 주인공.** 지름 68을 정확히 채우는 이중 고리. 두 선 사이 폭 6px 띠 안에 **룬 12개**가 등간격으로 새겨져 있다. 룬은 글자가 아니라 **쐐기·삼각·빗금 같은 기호**여야 한다(§7 네거티브). 고리 바깥으로는 아무것도 나가지 않는다 | O **회전한다** |
| **01** | `altar_sigil` | 고리 안쪽 정지 문양 | 고리 안에 놓이는 **기하 문양** — 지름 44 안에 들어가는 오각 별 하나와 그것을 감싸는 얇은 원. 선은 1px, 교차점에만 2x2 점을 찍는다. 00 과 겹쳐 그려지므로 **바깥 12px 은 비워야 한다** | X (안 돈다 — 도는 고리와 대비된다) |
| **02** | `altar_fill` | **채널링 차오름** (3초) | 중심에서 바깥으로 차오르는 **피 웅덩이 원반**. 지름 68 꽉. 가장자리는 흐리지 않고 **딱 떨어지는 픽셀 테두리**여야 한다 — 코드가 이 한 장을 배율 0 → 1 로 키우므로, 흐린 가장자리는 커지면서 뭉개진다. 안쪽에 동심원 파문 2~3줄 | X (배율만 바뀐다) |
| **03** | `altar_flash_0` | 발동 섬광 1/4 | 고리 위치에서 시작하는 얇고 밝은 링 | 재생 |
| **04** | `altar_flash_1` | 2/4 | 링이 두꺼워지고 안쪽으로 빛살 8개가 뻗는다 | 재생 |
| **05** | `altar_flash_2` | 3/4 | 링이 바깥으로 퍼지며 옅어지고 중심이 가장 밝다 | 재생 |
| **06** | `altar_flash_3` | 4/4 | 흩어지는 파편 몇 점만 남는다 | 재생 |
| **07** | — | **예비. 완전히 비운다 (alpha 0)** | | |

### 4.3 애니메이션 재생 규칙 (프레임 수와 규칙을 못 박는다)

| 이름 | 칸 | 프레임 수 | 초당 | 반복 | 언제 |
|---|---|---|---|---|---|
| `enc_altar_flash` | B-03 ~ B-06 | **4** | **16** | **repeat: 0** (한 번만) | `grantAltar()` 성공 순간. 총 250ms |

**회전은 애니메이션이 아니다.** 프레임을 늘리지 않고 코드가 `rotation` 값 하나만 더한다.

| 대상 | 각속도 | 방향 | 근거 |
|---|---|---|---|
| B-00 `altar_ring` | **-0.15 rad/s** (약 42초에 한 바퀴) | 시계 반대 | 이보다 빠르면 눈이 따라가 전투를 방해한다 |
| B-00 채널링 중 | **-0.60 rad/s** 까지 선형 가속 | 시계 반대 | ★ **"차오른다"를 고리가 함께 말한다.** 채움 원반(B-02)이 커지는 것과 같은 진행도로 빨라진다 |
| A-02 `ped_halo` | +0.25 rad/s | 시계 | |
| A-03 `mark_boss` | -0.35 rad/s | 시계 반대 | 좌판 후광과 반대로 돌아 종류가 구분된다 |

★ **채널링 표현은 세 가지가 동시에 말한다** — 원반이 커지고(B-02 배율), 고리가 빨라지고(B-00),
다 차면 섬광이 터진다(B-03~06). 셋 중 프레임을 쓰는 것은 마지막 하나뿐이다.

---

## 5. ★ 팔레트 — 색을 칠하지 마라. 무채색으로 그린다

**이 절이 `29`·`32` 와 가장 다른 곳이다. 프롬프트에서 가장 강하게 강조해야 한다.**

### 5.1 왜 무채색인가

지금 코드가 좌판 색을 **tint 로** 주고 있다(`EncounterSystem.js:528`).
등급 5종 · 룬 등급 3종 · 「수상한 자」 보라 · 「눈먼 예언자」 청록 · 잠김 회색이
전부 같은 도형에 색만 달리 입힌 것이다. 시트가 색을 갖고 오면 그 위에 tint 가
**곱해져** 전부 탁해진다.

이 프로젝트에는 이미 선례가 있다 — `tools/build-ui.mjs` 의 게이지 칩이 흑백으로 구워져 있고
주석이 이렇게 적혀 있다: *"칩이 흑백인 이유가 그것이다 — 색은 코드가 tint 로 정한다."*

**규칙: 모든 화소가 R = G = B 여야 한다.** 색조가 0 이어야 tint 결과가 예측 가능하다.

> ⚠ 그래서 `32` §4 의 외곽선 `#1A1216`(어두운 자주)을 여기서는 쓰지 않는다.
> 자주 기운은 tint 곱셈에서 어차피 사라지고, 남은 만큼은 등급색을 오염시킨다.
> 이 시트의 외곽선은 **무채색 `#1E1E1E`** 다. 44px 화면에서 둘의 차이는 보이지 않는다.

### 5.2 ★ 알파 사다리 — 밝기가 아니라 알파가 형태를 만든다

바닥 데칼은 반드시 옅어야 한다. 그런데 전체를 옅게 하면 테두리까지 사라진다.
그래서 **밝기가 아니라 알파로 층을 나눈다.** 지금 코드가 하는 일과 같다 —
채움 알파 0.26 / 테두리 알파 0.9 로 이미 두 층이다(`:529-530`). 그것을 그림 안에 굽는다.

| 층 | 값 (R=G=B) | 알파 | 화면에서 무엇이 되나 |
|---|---|---|---|
| 바깥 그림자 테 (1px) | `#141414` | **200** | 바닥 타일에서 데칼을 떼어 놓는다 |
| 테두리 고리 (2px) | `#FFFFFF` | **230** | tint 색이 가장 진하게 나오는 곳 = 등급색을 읽는 자리 |
| 룬 눈금 · 문양 선 | `#FFFFFF` | **200** | |
| 원반 속 (면) | `#FFFFFF` | **70** | 현행 `fillAlpha 0.26` 과 같은 급이다 |
| 홈 · 균열 · 음영 | `#6E6E6E` | **110** | 돌의 질감 |
| 안전 영역 밖 | — | **0** | |

★ **알파 230 을 넘는 화소는 테두리 고리에만 둔다.** 바닥 전체가 불투명해지면
그 위를 지나는 적과 투사체가 안 보이고, 그건 전투를 가리는 것이다.
데칼은 `DEPTH.ORB`(20) 라서 적(30)·플레이어(40)·투사체(50) 보다 **아래**에 깔린다.

### 5.3 코드가 실제로 곱하는 tint 값 (그림을 그릴 때 머릿속에 둘 것)

| 자리 | tint | 출처 |
|---|---|---|
| 좌판 common | `#7b7488` | `EncounterSystem.js:79` `RARITY_COLOR` |
| 좌판 uncommon | `#c7c2ce` | 〃 |
| 좌판 rare | `#35c9b4` | 〃 |
| 좌판 epic | `#c4182b` | 〃 |
| 좌판 legendary | `#c9a227` | 〃 |
| **잠긴 좌판** | `#4a4650` | `:82` `LOCKED_COLOR` |
| 「수상한 자」 | `#6b3fa0` | `:487` |
| 「눈먼 예언자」 | `#35c9b4` | `:476` |
| 「피의 제단」 바탕 | `#a21f2d` | `encounters.json` `enc_altar.color` |
| 「피의 제단」 테두리 | `#c4182b` | `:565` |
| 필드보스 마커 | `#8B1A1A` | 새로 지정 (`09` 피 본체) |

**어두운 tint 가 걸리는 칸이 있다는 점에 주의하라.** 잠김(`#4a4650`)은 밝기가 30% 밖에
안 된다. 그래서 A-01 은 **색이 아니라 형태로** 잠김을 말해야 한다 — 그림이 어두워져도
갈라진 금과 빗장의 실루엣은 남는다.

---

## 6. ★ 영어 프롬프트 전문 (그대로 복사)

### 6.0 전달 방법

```
1. 시트는 두 장이지만 프롬프트도 두 개다. 절대 한 번에 두 장을 요구하지 마라 —
   격자가 다르므로 한 대화에서 섞이면 칸 크기가 반드시 오염된다.
2. 먼저 §6.1(시트 A) 본문 + CELL MANIFEST 를 통째로 붙이고 결과를 §8 로 검수한다.
3. 통과한 뒤에 §6.2(시트 B) 를 새 대화에서 붙인다.
4. 네거티브 프롬프트를 따로 받는 도구라면 §7 을 함께 준다.
5. 받은 파일은 store/_raw/ 에 그대로 저장한다. 원본을 덮어쓰지 않는다.
6. 실패하면 한 번에 하나씩만 바꿔 재의뢰한다(`29` §10 규약).
```

> `15` 문서의 「공통 스타일 가이드 블록」을 앞에 붙이지 **않는다.** `29` §5.0 과 같은 이유다 —
> 그 블록은 "고해상도로 크게 그려라"를 요구하는데 이 의뢰는 정확한 픽셀 격자가 목적이다.

### 6.1 시트 A 프롬프트 — `enc-decal-48.png`

```text
Create ONE transparent PNG sprite sheet of top-down floor decals for a dark
gothic vampire roguelite mobile game. These are flat markings painted on the
ground, seen from directly above, NOT objects standing upright.

CANVAS AND GRID (absolute requirements)
- Output size: exactly 288 x 48 pixels. RGBA with a fully transparent background.
- Grid: exactly 6 columns x 1 row = 6 cells. Each cell is exactly 48 x 48 px.
- Cell N occupies x = N*48 .. N*48+47, y = 0 .. 47, with N 0-based, left to right.
- INSIDE EACH CELL, leave a 2 px fully transparent margin on all four sides.
  All artwork must fit inside the inner 44 x 44 px area. This margin is how grid
  alignment is machine-verified; art touching a cell edge is a hard failure.
- Cell 5 (the last one) must be COMPLETELY EMPTY (alpha 0).
- The four corners of the whole sheet must be alpha 0.

*** MOST IMPORTANT RULE: GRAYSCALE ONLY ***
- Every single pixel must be pure grayscale: RED = GREEN = BLUE, always.
- Do NOT use any hue. No red, no blue, no gold, no purple, nothing.
- The game engine applies color at runtime with a multiply tint. Any hue baked
  into this sheet gets multiplied a second time and turns muddy.
- Shape and form come from the ALPHA channel and from grayscale value only.

ALPHA LADDER (this is how the decal reads on a dark floor)
- outer shadow rim, 1 px      : value #141414, alpha 200
- main border ring, 2 px      : value #FFFFFF, alpha 230   <- the strongest line
- rune notches and sigil lines: value #FFFFFF, alpha 200
- disc interior fill          : value #FFFFFF, alpha  70   <- must stay faint
- grooves, cracks, shading    : value #6E6E6E, alpha 110
- everything outside the art  : alpha 0
Never exceed alpha 230 anywhere except the border ring. These decals lie under
enemies and projectiles and must not hide the fight.

ART STYLE
- True pixel art. Hard 1 px edges. NO anti-aliasing, NO gradients, NO blur,
  NO soft glow, NO feathered alpha, NO drop shadow.
- Strictly TOP-DOWN orthographic. A perfect circle, not an ellipse, not a
  perspective disc. No thickness, no side walls, no 3/4 view.
- Outline value #1E1E1E (neutral dark gray, NOT pure black, and NOT tinted).
- Weathered carved stone. Chipped, worn, ancient. Nothing clean or new.
- These render at 44 logical pixels on a phone and at roughly 30 percent opacity.
  Detail finer than 2 px disappears completely. Draw the silhouette and the ring;
  omit everything else.

CENTERING (critical - some cells rotate at runtime)
- Cells 2 and 3 are rotated by the engine around the exact geometric center of
  their cell. Their artwork must be perfectly centered and radially symmetric.
  A 1 px offset makes the decal visibly wobble when it spins.
- For every circular cell, the number of transparent pixels above, below, left
  and right of the artwork must be identical.

Draw exactly the 6 cells listed in the CELL MANIFEST below, in that exact order.
Do not reorder, do not skip, do not add extra cells.
```

**CELL MANIFEST — 시트 A (§6.1 바로 뒤에 이어 붙인다. 6줄 전부)**

```text
CELL MANIFEST (sheet A, 48x48 cells, artwork inside inner 44x44)

0  ped_base
   A low round stone pedestal seen from directly above. A 2 px border ring at
   the very edge of the 44 px area, a 1 px dark groove just inside it, and a
   nearly empty center (a game icon is drawn on top of it). Eight short carved
   rune notches evenly spaced around the ring, at 0/45/90/135/180/225/270/315
   degrees. Worn stone, a few small chips on the rim.

1  ped_locked
   The SAME silhouette and the SAME diameter as cell 0, but broken. Two jagged
   cracks split the disc. One thick bar lies across the ring like a bolt or a
   latch. Three of the eight rune notches are shattered and incomplete. The
   interior fill is fainter than cell 0. This must read as "you cannot buy this"
   from SHAPE ALONE, because the engine tints this cell a very dark gray.

2  ped_halo
   A thin rotating outer ring only, no disc. A 1 px dashed circle filling the
   full 44 px width, plus twelve short radial ticks evenly spaced around it.
   The entire inside is empty (alpha 0) so the pedestal underneath shows through.
   Must be perfectly centered and 12-fold rotationally symmetric.

3  mark_boss
   A double danger ring with eight inward-pointing sharp teeth between the two
   circles, like a bear trap seen from above. Clearly more aggressive and more
   angular than the smooth pedestal rings. The inside is empty; a large enemy
   stands on top of it. Perfectly centered, 8-fold rotationally symmetric.

4  mark_npc
   A very faint shallow pool of a circle. No border ring at all. Just a filled
   disc at alpha 60 with the outer 2 px slightly darker, edges slightly irregular
   like a scuffed patch of ground. This sits under a standing character and
   doubles as a soft ground shadow.

5  (EMPTY)
   Completely empty. Alpha 0 across the whole cell.
```

### 6.2 시트 B 프롬프트 — `enc-decal-72.png`

```text
Create ONE transparent PNG sprite sheet of a top-down magic circle for a dark
gothic vampire roguelite mobile game. This is a blood ritual sigil painted flat
on the ground, seen from directly above.

CANVAS AND GRID (absolute requirements)
- Output size: exactly 576 x 72 pixels. RGBA with a fully transparent background.
- Grid: exactly 8 columns x 1 row = 8 cells. Each cell is exactly 72 x 72 px.
- Cell N occupies x = N*72 .. N*72+71, y = 0 .. 71, with N 0-based, left to right.
- INSIDE EACH CELL, leave a 2 px fully transparent margin on all four sides.
  All artwork must fit inside the inner 68 x 68 px area.
- Cell 7 (the last one) must be COMPLETELY EMPTY (alpha 0).
- The four corners of the whole sheet must be alpha 0.

*** THE 68 PX DIAMETER IS A GAME RULE, NOT A DRAWING CHOICE ***
- The game checks whether the player is standing within a radius of 34 logical
  pixels, i.e. a 68 px diameter, to charge the ritual.
- The outer edge of the magic circle in cell 0 must land exactly on that 68 px
  diameter. Drawing it larger means the player stands on the art and nothing
  happens. Drawing it smaller means it charges while they look outside it.
  Both read as a bug.

*** MOST IMPORTANT STYLE RULE: GRAYSCALE ONLY ***
- Every single pixel must be pure grayscale: RED = GREEN = BLUE, always.
- Do NOT use red or any other hue, even though this is a blood altar. The engine
  multiplies a deep red tint over it at runtime. Baked-in red turns brown.
- Shape and form come from the ALPHA channel and from grayscale value only.

ALPHA LADDER
- outer shadow rim, 1 px      : value #141414, alpha 200
- main ring lines, 2 px       : value #FFFFFF, alpha 230   <- strongest lines
- runes and sigil lines       : value #FFFFFF, alpha 200
- interior fill               : value #FFFFFF, alpha  70   <- must stay faint
- grooves and shading         : value #6E6E6E, alpha 110
- everything outside the art  : alpha 0

ART STYLE
- True pixel art. Hard 1 px edges. NO anti-aliasing, NO gradients, NO blur,
  NO soft glow, NO feathered alpha, NO drop shadow.
- Strictly TOP-DOWN orthographic. Perfect circles, never ellipses. No perspective,
  no thickness, no 3/4 view.
- Outline value #1E1E1E (neutral dark gray, NOT pure black).
- Occult, carved, weathered. Ancient stone and dried blood, not neon and not
  glowing fantasy VFX.
- Displayed at 68 logical pixels on a phone at roughly 30 percent opacity.
  Anything finer than 2 px vanishes.

CENTERING AND ROTATION (critical)
- Cell 0 is continuously rotated by the engine around the exact geometric center
  of its cell. It must be perfectly centered and 12-fold rotationally symmetric.
  A 1 px offset makes the whole magic circle wobble as it turns.
- Measured from the center of cell 0, the distance to the outermost opaque pixel
  must be 34 px in EVERY direction, within 1 px.
- Cells 1 to 6 must also be centered on the exact cell center.

Draw exactly the 8 cells listed in the CELL MANIFEST below, in that exact order.
Do not reorder, do not skip, do not add extra cells.
```

**CELL MANIFEST — 시트 B (§6.2 바로 뒤에 이어 붙인다. 8줄 전부)**

```text
CELL MANIFEST (sheet B, 72x72 cells, artwork inside inner 68x68)

0  altar_ring
   The main rotating outer ring. Two concentric 2 px circles: the outer one
   exactly 68 px across (touching the inner safe area on all four sides), the
   inner one 56 px across. In the 6 px band between them, twelve carved rune
   marks evenly spaced at 30 degree intervals. The runes are ABSTRACT CARVED
   MARKS - wedges, triangles, crossed strokes, chevrons. They are NOT letters
   of any alphabet and NOT numbers. Nothing extends outside the outer circle.
   The center of the cell is empty; cells 1 and 2 are drawn on top of it.

1  altar_sigil
   The static inner sigil, drawn inside a 44 px circle centered in the cell.
   A five-pointed star of 1 px lines inscribed in a thin 1 px circle, with a
   2x2 pixel dot at each of the five points and at each line crossing. The outer
   12 px of the cell must be completely empty, because cell 0 occupies that band.
   This one does NOT rotate, so it must contrast with the turning ring.

2  altar_fill
   The charging pool. A filled disc exactly 68 px across, alpha 70, with two or
   three concentric ripple rings at alpha 110 inside it. The outer edge must be
   a HARD pixel edge with no fade whatsoever: the engine scales this single
   image from 0 to full size over three seconds, and any soft edge smears as it
   grows. Think of a pool of blood rising to fill a carved basin.

3  altar_flash_0
   Activation flash, frame 1 of 4. A single thin bright ring at the 68 px
   diameter, alpha 230, nothing else.

4  altar_flash_1
   Frame 2 of 4. The ring is now 4 px thick, and eight straight light rays
   stab inward from the ring toward the center, stopping short of it.

5  altar_flash_2
   Frame 3 of 4. The ring has expanded to the edge and thinned to 1 px at
   alpha 120, the inward rays have reached the center, and the center is the
   brightest point in the cell.

6  altar_flash_3
   Frame 4 of 4. Almost gone. Only six to eight scattered 1x1 and 2x2 fragments
   remain, spread between the center and the ring, at alpha 90.

7  (EMPTY)
   Completely empty. Alpha 0 across the whole cell.
```

---

## 7. 네거티브 프롬프트

`29` §6 을 바탕에 깔고 **이 의뢰 고유의 실패 모드**를 앞쪽에 더했다.
1~3행(색·시점·중심)이 여기서 실제로 사고를 내는 항목이다.

```text
any color at all, colored pixels, red, crimson, blood red, blue, gold, purple,
green, tinted artwork, hue, saturation, colorized, sepia, warm tone, cool tone,
perspective view, 3/4 view, isometric, side view, tilted disc, ellipse,
oval instead of circle, thickness, extruded rim, standing object, pillar,
altar table, statue, prop seen from the side,
off-center artwork, asymmetric ring, artwork shifted in the cell,
grid lines, guide lines, cell borders, frame around each cell, uneven spacing,
misaligned grid, cropped art, art touching the cell edge,
white background, black background, checkerboard background, background plate,
semi-transparent edges, feathered alpha, soft glow bleeding into transparency,
outer glow, neon, bloom, lens flare, godrays, particle spray,
smooth gradient, airbrush, soft shading, blur, motion blur, depth of field,
mixed pixel scale, non-square pixels, blurry pixels, resampled pixels,
text, letters, runes that are real alphabets, latin letters, cyrillic, hebrew,
arabic, chinese characters, japanese characters, korean characters, numbers,
labels, captions, watermark, signature, logo,
3d render, cgi, photorealistic, photograph, clay render, marble render,
vector art, flat design, material design, sticker outline, glossy highlight,
bevel, emboss, chrome effect,
cute, chibi, cartoon, comic, anime, kawaii, mascot, cheerful, bright pastel,
rainbow, sci-fi, technological, circuit pattern, hologram,
extra cells beyond the manifest, missing cells, reordered cells
```

★ **`chinese characters` 를 명시적으로 금지한 이유**: 마법진 룬으로 한자를 그려 넣는 것이
이미지 생성 모델의 흔한 기본 반응이다. 이 프로젝트는 한자를 쓰지 않는다.

---

## 8. 수령 검수 절차 — 눈으로 보기 전에 기계로 본다

ImageMagick 경로는 실측 확인됐다: `C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe`
아래는 **Git Bash** 기준이다. V-1 부터 순서대로 돌리고 하나라도 실패하면 재의뢰한다.

```bash
MG="/c/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe"
ROOT="/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
RAW_A="$ROOT/store/_raw/enc-decal-48-raw.png"    # 받은 그대로. 절대 덮어쓰지 않는다
RAW_B="$ROOT/store/_raw/enc-decal-72-raw.png"
WRK_A="$ROOT/store/_raw/enc-decal-48-work.png"
WRK_B="$ROOT/store/_raw/enc-decal-72-work.png"
```

### 8.1 검사 목록

| # | 검사 | 통과 조건 | 도구 |
|---|---|---|---|
| V-1 | 치수·채널 | A = 288x48, B = 576x72, `ch=srgba`, `alpha=True` | `identify` |
| V-2 | 정수배 축소 | `@2x` 를 받았다면 `-filter point` 로 축소한 뒤 **다시 잰다** | `identify` |
| V-3 | 투명 배경 | 시트 네 모서리 alpha 0 | `identify` |
| V-4 | ★ 격자 정렬 | **모든 칸의 바깥 2px 테두리에 불투명 화소 0개** | Node |
| V-5 | 빈 칸 | A-05 · B-07 이 완전히 alpha 0 | Node |
| V-6 | ★ 무채색 | **모든 화소가 R = G = B**. 하나라도 어긋나면 반려 | Node |
| V-7 | 알파 상한 | 알파 230 초과 화소가 전체 불투명 화소의 3% 미만 | Node |
| V-8 | ★ 중심 정렬 | 회전 칸(A-02, A-03, B-00)의 불투명 bbox 여백이 상=하, 좌=우 (오차 0) | Node |
| V-9 | ★ 반경 프로파일 | B-00 의 중심에서 최외곽 불투명 화소까지 거리가 **모든 각도에서 32.5 ~ 35** | Node |
| V-10 | 실제 크기 판독 | 어두운 바닥 위 알파 30% 에서 좌판/잠김/제단이 서로 구분된다 | 눈 |

### 8.2 V-1 ~ V-3 — ImageMagick

```bash
"$MG" identify -format "%f  %w x %h  ch=%[channels]  alpha=%A\n" "$RAW_A" "$RAW_B"
```
기대: `288 x 48` / `576 x 72`, 둘 다 `ch=srgba`, `alpha=True`.
`ch=srgb`(알파 없음)면 **즉시 반려** — 배경이 불투명하게 왔다는 뜻이다.

`@2x` 를 받았다면 (`576 x 96` / `1152 x 144`):
```bash
"$MG" "$RAW_A" -filter point -resize 288x48! "$WRK_A"
"$MG" identify -format "축소결과 %w x %h  (288 x 48 이어야 한다)\n" "$WRK_A"
```
`-filter point` 는 **양보 불가**다. 빼면 보간이 걸려 픽셀이 뭉개진다(`29` §7.2 사고 이력).
등배로 왔으면 그냥 복사한다: `cp "$RAW_A" "$WRK_A"`.

### 8.3 V-4 ~ V-9 — Node 로 생 RGBA 를 직접 읽는다

> ⚠ **`29` §7.4 의 `-crop` 타일링 방식을 여기서는 쓰지 않는다.**
> 이 저장소에서 `magick -crop` 으로 격자를 자를 때 오프셋이 캔버스 메타로 남아
> 결과가 어긋나는 문제가 확인됐다(`build-ui.mjs:105` 주석의 `+repage` 사고와 같은 뿌리).
> **원형 데칼은 중심 좌표가 곧 판정이라 1px 오차도 치명적이다.** 그래서 ImageMagick 은
> 디코딩에만 쓰고, 판정은 전부 Node 가 생 RGBA 바이트로 한다.

먼저 PNG 를 생 RGBA 로 푼다(ImageMagick 은 디코더로만 쓴다 — `-crop` 없음).

```bash
"$MG" "$WRK_A" -depth 8 RGBA:"$ROOT/store/_raw/a.raw"
"$MG" "$WRK_B" -depth 8 RGBA:"$ROOT/store/_raw/b.raw"
```

그 다음 아래를 `store/_raw/check-decal.mjs` 로 저장하고 `node check-decal.mjs` 로 돌린다.
**저장소에 커밋하지 않는다** — 수령 시점에만 쓰는 일회용 검수 도구다.

```js
import { readFileSync } from "node:fs";

/**
 * @param {string} raw  RGBA 생바이트 파일
 * @param {number} W    시트 너비   @param {number} H 시트 높이
 * @param {number} C    칸 크기     @param {number} M 강제 여백
 * @param {number[]} empty 비어야 하는 칸  @param {number[]} spin 회전하는 칸
 */
function check(raw, W, H, C, M, empty, spin) {
    const b = readFileSync(raw);
    const A = (x, y) => b[(y * W + x) * 4 + 3];
    const RGB = (x, y) => { const i = (y * W + x) * 4; return [b[i], b[i + 1], b[i + 2]]; };
    const cols = W / C, fail = [];

    // V-6 무채색 · V-7 알파 상한
    let hue = 0, hot = 0, opaque = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const a = A(x, y); if (!a) continue;
        opaque++;
        const [r, g, bl] = RGB(x, y);
        if (r !== g || g !== bl) hue++;
        if (a > 230) hot++;
    }
    if (hue) fail.push(`V-6 무채색 위반: 색조가 있는 화소 ${hue}개`);
    if (hot / opaque > 0.03) fail.push(`V-7 알파 230 초과가 ${(hot / opaque * 100).toFixed(1)}%`);

    for (let c = 0; c < cols; c++) {
        const ox = c * C;
        // V-4 여백 침범
        let leak = 0;
        for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
            const edge = x < M || y < M || x >= C - M || y >= C - M;
            if (edge && A(ox + x, y)) leak++;
        }
        if (leak) fail.push(`V-4 칸 ${c}: 여백 침범 화소 ${leak}개`);

        // 불투명 bbox
        let x0 = C, y0 = C, x1 = -1, y1 = -1, n = 0;
        for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
            if (!A(ox + x, y)) continue;
            n++;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        // V-5 빈 칸
        if (empty.includes(c)) { if (n) fail.push(`V-5 칸 ${c}: 비어야 하는데 화소 ${n}개`); continue; }
        if (!n) { fail.push(`칸 ${c}: 완전히 비어 있다`); continue; }

        // V-8 중심 정렬 — 회전 칸만
        if (spin.includes(c)) {
            const l = x0, r = C - 1 - x1, t = y0, bm = C - 1 - y1;
            if (l !== r || t !== bm) fail.push(`V-8 칸 ${c}: 여백 좌${l} 우${r} 상${t} 하${bm} — 회전 시 흔들린다`);
        }
    }

    // V-9 반경 프로파일 — 시트 B 의 칸 0 만
    if (C === 72) {
        const cx = 35.5, cy = 35.5;   // 0-based 화소 좌표계에서의 칸 중심
        let min = 99, max = 0;
        for (let deg = 0; deg < 360; deg++) {
            const a = deg * Math.PI / 180;
            let hit = 0;
            for (let r = 34; r >= 1; r -= 0.5) {
                const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
                if (x < 0 || y < 0 || x >= C || y >= C) continue;
                if (A(x, y)) { hit = r; break; }
            }
            if (hit < min) min = hit;
            if (hit > max) max = hit;
        }
        // ★ 하한이 34-1 이 아니라 32.5 인 이유: 광선 표본을 Math.round 로 화소에 붙이므로
        //   대각선 방향에서 최대 0.7px 바깥을 짚어 한 칸을 흘린다. 게다가 칸 안에서 낼 수 있는
        //   최대 반지름 자체가 33.5 다(중심 35.5, 안전 영역 2..69). 그림 지시는 "34px, 오차 1px"
        //   그대로 두고, **측정 쪽에만** 반올림 여유를 준다.
        if (min < 32.5 || max > 35) fail.push(`V-9 칸 0: 최외곽 반경 ${min}~${max} (32.5~35 여야 한다)`);
        else console.log(`   V-9 통과: 반경 ${min}~${max}`);
    }
    return fail;
}

const R = "C:/Users/741u7/OneDrive/바탕 화면/PJT20260810/store/_raw";
const show = (n, f) => console.log(n + "\n" + (f.length ? f.map((s) => "   x " + s).join("\n") : "   o 전부 통과"));
show("시트 A:", check(`${R}/a.raw`, 288, 48, 48, 2, [5], [2, 3]));
show("시트 B:", check(`${R}/b.raw`, 576, 72, 72, 2, [7], [0]));
```

★ **V-9 가 이 의뢰에만 있는 검사다.** 마법진의 바깥 끝이 정확히 반지름 34 여야
판정과 그림이 일치한다(§2.2). 각도 360개를 전부 재므로 한쪽만 찌그러진 원도 잡힌다.
V-8 은 "치우쳤는가"를, V-9 는 "둥근가"를 본다 — 둘 다 통과해야 회전이 안 떨린다.

### 8.4 V-10 — 눈으로 보는 두 장

```bash
# (1) 8배 확대 — 정렬과 픽셀 경계를 눈으로
"$MG" "$WRK_A" -filter point -resize 800% "$ROOT/store/_raw/decal-a-8x.png"
"$MG" "$WRK_B" -filter point -resize 800% "$ROOT/store/_raw/decal-b-8x.png"

# (2) ★ 실제 상황 시뮬레이션 — 어두운 무덤 바닥 위에 옅게 얹는다
"$MG" -size 288x48 xc:"#241c22" \( "$WRK_A" -alpha set -channel A -evaluate multiply 0.35 +channel \) \
      -compose Over -composite -filter point -resize 400% "$ROOT/store/_raw/decal-a-onfloor.png"
```

(2) 가 이 의뢰의 **진짜 합격 판정**이다. 데칼은 어두운 바닥 위에 옅게 깔린다.
여기서 **잠긴 좌판(A-01)이 멀쩡한 좌판(A-00)과 구분되지 않으면**, 8배 확대에서
아무리 예뻐도 실패다 — `30` §5 가 요구하는 "못 산다가 읽힌다"가 성립하지 않는다.

### 8.5 수용 기준 체크리스트

- [ ] A 정확히 288 x 48 · B 정확히 576 x 72 (정수배 마스터면 축소 후 **재측정 완료**)
- [ ] 둘 다 알파 채널 있음. 네 모서리 alpha 0
- [ ] V-4 여백 침범 0개 (두 시트 전부)
- [ ] A-05 · B-07 완전 공백
- [ ] **V-6 색조 화소 0개** — 이 의뢰에서 가장 놓치기 쉬운 항목이다
- [ ] V-8 회전 칸 3개의 여백이 상=하, 좌=우
- [ ] V-9 B-00 최외곽 반경 32.5 ~ 35 (측정 여유 근거는 §8.3 스크립트 주석)
- [ ] 칸 순서가 §4 매니페스트와 정확히 일치
- [ ] 어두운 바닥 위 알파 35% 에서 A-00 과 A-01 이 **형태로** 구분된다
- [ ] 안티에일리어싱 없음. 반투명으로 번진 가장자리 없음
- [ ] 텍스트·글자·한자·워터마크·격자선 없음

---

## 9. 수령 후 배선

### 9.1 파일을 놓는다

```bash
mkdir -p "$ROOT/FE/public/assets/decal"
cp "$WRK_A" "$ROOT/FE/public/assets/decal/enc-decal-48.png"
cp "$WRK_B" "$ROOT/FE/public/assets/decal/enc-decal-72.png"
```

### 9.2 매니페스트에 두 줄을 넣는다 — 그리고 그것으로 끝이다

`FE/public/assets.json` 의 `spritesheets[]` 에:

```json
{ "key": "enc-decal-48", "url": "assets/decal/enc-decal-48.png", "frameWidth": 48, "frameHeight": 48 },
{ "key": "enc-decal-72", "url": "assets/decal/enc-decal-72.png", "frameWidth": 72, "frameHeight": 72 }
```

★ **`PreloadScene.js` 는 고치지 않는다.** 이 프로젝트 규약이다(`assets.json` 머리 주석 ·
`32` §8). `PreloadScene` 은 `spritesheets[]` 를 루프해서 로드할 뿐이다.

발동 섬광 애니는 `FE/src/game/anims/registerAnims.js` 에 한 줄을 더한다
— §4.3 의 재생 규칙 그대로 4프레임 · 16fps · `repeat: 0`, 키는 `enc_altar_flash`.

### 9.3 ★ 폴백 코드를 지우지 마라

`FE/src/game/systems/EncounterSystem.js` 는 텍스처 유무로 갈라진다.

- `buildObjects()` 가 **생성자에서** `scene.textures.exists("enc-decal-48")` 를 보고
  스프라이트를 만들지 `add.circle` 을 만들지 정한다
- **런 중에는 아무것도 새로 만들지 않는다**(`06-TECH` §5.1 / 검증 E-8). 지금 `mk()` 가
  생성자에서 풀을 만드는 구조 그대로여야 한다
- `showSlot()` · `showAltar()` 는 스프라이트면 `setFrame`+`setTint`, 원이면 `setFillStyle`

**이 갈래를 지우면 §0.3 의 롤백 가능성이 사라진다.** `assets.json` 에서 두 줄을 빼는 것만으로
지금의 원으로 되돌아갈 수 있어야 한다. 그것이 이 프로젝트가 아트를 붙이는 방식이다
(`29` §9.1 · `32` §0.2 가 같은 것을 못 박았다).

⚠ 데칼 스프라이트의 깊이는 반드시 `DEPTH.ORB`(20) 이하다. 적(30)·플레이어(40)·
투사체(50) 보다 위로 올라가면 바닥 장식이 전투를 가린다(§5.2).

### 9.4 확인

```bash
cd "$ROOT/FE" && npm run validate      # 매니페스트·데이터 정합성
cd "$ROOT/FE" && npx eslint src tools
cd "$ROOT/FE" && npm run build
```

그 다음 `?debug=1` 로 띄워 눈으로 본다. 치트 목록은 `src/game/debugCheats.js` 가 정본이다.

```js
BS.enc('merchant')   // 좌판 3칸 — ped_base 등급색 3종
BS.enc('witch')      // 좌판 3칸 — 룬 등급색
BS.enc('shady')      // 좌판 2칸 — 보라
BS.enc('seer')       // 좌판 1칸 — 무료(청록)
BS.enc('altar')      // 마법진. 안에 3초 서 있으면 채널링 -> 섬광
BS.enc('fieldboss')  // mark_boss 가 적 발밑에 붙는지
BS.enc('chest')
BS.encState()        // 현재 조우 상태
```

★ **잠긴 좌판은 체력을 가격 이하로 낮춰야 보인다.** 가격은 최대 체력 비율이므로
(`30` §2.1) `BS` 로 체력을 12% 아래로 떨어뜨린 뒤 상인을 부르면 3칸 전부 잠긴다.

---

## 10. 이 의뢰에 넣지 않은 것

| 대상 | 왜 뺐나 |
|---|---|
| 「봉인된 궤」 상자 | `32` C-1 이 이미 의뢰했다. 게다가 상자는 바닥 데칼이 아니라 **서 있는 물체**라 시점이 다르다 |
| 조우 방향 화살표 6종 | `32` C-4. 32x32 아이콘 격자이고 `setScrollFactor(0)` 인 HUD 요소다 |
| 룬 아이콘 24종 | `32` §3.1 |
| `StageSystem` 의 기믹 원 (성수·낙석) | **다른 시스템의 소유다.** 수명과 풀 관리가 완전히 다르다. 같은 시트에 넣으면 `EncounterSystem` 이 `StageSystem` 의 텍스처에 의존하게 된다 — `EncounterSystem.js:128-134` 가 정확히 그 결합을 피하려고 자기 원을 따로 가졌다 |
| 좌판 위 가격 글자 | 폰트다. 아트가 아니다 |
| 「피의 제단」 3D 조형물 | 이 게임은 위에서 내려다보는 화면이고 제단은 **바닥 판정 영역**이다. 서 있는 조형물을 그리면 68px 판정 원과 실루엣이 어긋난다(§2.2) |

→ 위는 전부 **별도 의뢰서**로 남긴다. 격자가 다른 것을 한 시트에 섞으면
`29` §0.3 이 기록한 "격자가 어긋나면 전부 밀린다" 사고가 재발한다.

---

## 11. 관련 문서

- `29-ICON-IMAGE-PROMPTS` — 1차 의뢰. **여백 규칙·검수 절차의 원본**
- `32-RUNE-AND-ENCOUNTER-ICON-PROMPTS` — 2차 의뢰. 팔레트와 배선 절차의 원본
- `30-ENCOUNTERS-AND-FIELD-EVENTS` — §3.1~§3.6 조우 7종 · §5 잠긴 좌판 · §7.3 좌판의 현재 상태
- `09-ART-AUDIO-AND-ASSET-MAP` — §1.1 팔레트 원본 · §1.4 아웃라인 정책 · §1.6 가독성 규칙
- `06-TECH-DESIGN` §5.1 — 런 중 `new` 금지. §9.3 의 풀 구조가 여기서 나온다

---

## 9. ★ 추가 후보 — 「봉인된 궤」 발밑 표식 (칸 05, 2026-08-12)

> 이 절은 **의뢰서가 아니라 대기열**이다. 아직 그리지 않는다.
> `enc-decal-48.png` 는 이미 수령했다 — **절대 덮어쓰지 않는다.**

2026-08-12 전수조사에서 확인한 비대칭이다. 조우 6종 중 **「봉인된 궤」만 바닥 표식이 없다.**

| 조우 | 바닥에 무엇이 깔리나 | 칸 |
|---|---|---|
| 상인 · 마녀 · 예언자 · 수상한 자 | 좌판 받침 3개 + 후광, NPC 발밑 표식 | 00 · 02 · 04 |
| 「피의 제단」 | 마법진(시트 B 전체) | B 00~06 |
| 필드보스 | 위험 고리 | 03 |
| **「봉인된 궤」** | **없다.** `beginChest()` 는 궤 스프라이트만 떨군다 | — |

궤 자체는 아트다(`runes` 시트 칸 24/25 · `32` §3.2, 런타임 실측 확인). 문제는 **자리**다 —
묘지 바닥에는 관·비석·해골 소품이 깔려 있어서, 32x32 궤 하나만 놓이면 소품과 구분되지 않는다.
지금은 코드가 궤를 **맥동**시켜(`updateChests`) 그 구분을 대신하고 있는데, 이건 형태가 아니라
움직임으로 때우는 것이다. 다른 조우 5종은 전부 바닥이 먼저 "여기다"를 말한다.

- 넣을 곳: 시트 A **예비 칸 05** (`mark_chest`). 시트 크기·열 수는 그대로다(6칸).
- 그릴 것: 04 `mark_npc` 의 옅은 원반과 **한눈에 구분되는 각진 표식** — 궤가 놓였던 자리를
  나타내는 **사각 봉인 판** 느낌. 모서리 4곳에 짧은 못 자국, 판 위를 가로지르는 **끊어진 봉인 띠**
  (§4.1 01 `ped_locked` 의 빗장과는 반대로 **이미 풀린** 형태여야 한다 — 궤는 밟으면 열린다).
  안쪽 중앙 20x20 은 비운다(궤가 그 위에 선다).
- 회전: X. 궤는 맥동만 한다 — 바닥까지 돌면 소품 사이에서 눈이 피로해진다.
- tint: 없음(무채색 그대로). §5.1 원칙 유지.
- ⚠ 다시 의뢰할 때 **칸 00~04 는 손대지 않는다.** §6.1 프롬프트의 칸 05 문장만
  "EMPTY" → `mark_chest` 로 바꾸고, §3.3 여백 규칙과 검수(V-*)는 그대로 승계한다.
- 배선(수령 후): `EncounterSystem.buildObjects()` 에 `this.chestMark` 를 하나 더 만들고
  `beginChest()` 에서 위치를 잡는다. **`hasPedTex` 가 false 면 만들지 않는다** —
  원으로 대신하지 않는 것이 이 문서의 규약이다(§4.1 03·04 와 같다).
