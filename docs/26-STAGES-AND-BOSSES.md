# 26. 스테이지 & 보스 — 구현 실태 기록

> **문서 지위: 실태 기록(AS-BUILT).** 설계 정본은 `01-CONCEPT-AND-STORY.md` / `03-GDD-CORE.md` / `04-PACT-SYSTEM.md`.
> 관련: [05. 전투·밸런스](./05-COMBAT-AND-BALANCE.md) · [16. 리스크](./16-RISKS-AND-SCOPE-CUTS.md) · [17. 라이선스](./17-LICENSES-AND-CREDITS.md) · [18. 맵 이미지 프롬프트](./18-MAP-IMAGE-PROMPT.md)
> 최종 수정: **2026-08-11 (신규)** / 근거: 코드·데이터 직접 조회

---

## 0. 이 문서가 무엇이고, 무엇이 아닌가

**이건 설계서가 아니라 실태 기록이다.** 여기 적힌 수치는 전부 아래 4개 파일을 직접 읽어 옮긴 것이고,
새로 설계한 값은 한 줄도 없다.

| 출처 | 역할 |
|---|---|
| `FE/src/data/stages.json` | 스테이지 5종 정의 (길이·계열 믹스·곡선·기믹·보스·해금) |
| `FE/src/data/boss.json` | 보스 6종 정의 (HP·패턴·페이즈) |
| `FE/src/game/systems/StageSystem.js` | 스테이지 적재·해금 판정·기믹 실행 (400행) |
| `FE/src/game/systems/BossSystem.js` | 보스 등장·패턴 스케줄러·텔레그래프 (824행) |

문서 관리 규칙 2번(`README.md`)이 정한 대로 **JSON 이 "현재값"이고 문서는 "의도"다.**
그래서 이 문서는 두 가지를 나눠 적는다.

- **데이터가 적어 놓은 값** — 작성자가 의도한 것
- **코드가 실제로 읽는 값** — 게임에서 일어나는 것

> 🚨 **둘이 어긋나는 곳이 12군데 있다.** 전부 §8에 모았다.
> 이 문서를 쓴 가장 큰 이유가 그것이다. 어긋남 대부분은 "JSON 에 파라미터를 적었는데
> 그 키를 읽는 코드가 없다" 는 형태라서, **에러도 경고도 나지 않고 조용히 기본값으로 굴러간다.**

---

## 1. 스테이지 5종 — 한 장 요약

| id | 이름 | 부제 | 길이 | 구간 | 적 계열(초반 → 후반) | 환경 기믹 | 보스 | 해금 | 클리어 골드 |
|---|---|---|---|---|---|---|---|---|---|
| `stage1` | **봉인묘** | 23:00 — 자정 전 | **360s** | 12 × 30s | (계열 미사용, `phases.json` 의 E1~E8 직접 가중치) | 성수 웅덩이 `sanctuary` | BOSS1 | 항상 | 200 |
| `stage2` | **잿빛 성당** | 향로가 꺼지지 않는 곳 | **300s** | 12 × 25s | humanoid·holy·undead → +magical·humanoid2 | 향로 연기 `haze` | BOSS2 | stage1 보스 격파 | 240 |
| `stage3` | **역병 늪** | 발이 빠지는 물 | **420s** | 12 × 35s | vermin·animal·monster → +undead·demon | 수렁 `mire` | BOSS3 | stage2 보스 격파 | 300 |
| `stage4` | **무너진 첨탑** | 위에서 내려온다 | **330s** | 11 × 30s | magical·humanoid2·undead → +dragon·demon | 붕괴 `rockfall` | BOSS4 | stage3 격파 **AND** 각성 누적 3회 | 340 |
| `stage5` | **지옥문** | 불이 지나가는 길 | **450s** | 15 × 30s | demon·monster·vermin → +dragon·undead | 화염 돌풍 `emberwind` | BOSS5 | stage4 보스 격파 | 420 |

- **BOSS6 「봉인묘의 간수」는 어느 스테이지에도 배정되어 있지 않다.** `boss.json` 에는 있지만
  `stages.json` 의 어떤 `bossId` 도 이를 가리키지 않는다 → **현재 게임에서 등장 불가.** (§8-1)
- 해금 판정은 `StageSystem.evalUnlock()` 이 하고 `always` / `bossDefeated` / `awakenCount` / `all` / `any`
  5종을 지원한다. 세이브의 `clears[stageId] > 0` 과 `awakenCount` 만 본다.
- **stage4 만 해금 조건이 2중(`all`)이다.** 보스 격파 + 각성 3회.
  진행도가 아니라 **"PACT 를 실제로 굴려 봤는가"** 를 묻는 유일한 관문이다.

---

## 2. 설계 원칙 — 「맵이 다른 것이 아니라 규칙이 다른 것」

`StageSystem.js` 파일 머리에 이 원칙이 주석으로 박혀 있다.

> ★ 스테이지는 "맵이 다른 것"이 아니라 **규칙이 다른 것**이어야 한다.
> 배경만 바꾸면 두 번째 스테이지에서 바로 질린다.

**이 원칙은 미학이 아니라 제약에서 나왔다.** 현재 프로젝트에 존재하는 바닥 텍스처는
`FE/public/assets/map/ground-grave.png` **단 1장**이다. stage2~5 는 전용 배경이 없어
stage1 텍스처에 tint 만 얹어 굴린다(§7). 즉 **배경으로 차별화하는 선택지가 물리적으로 없었고,
그 상태에서도 5개 스테이지가 서로 다르게 느껴져야 했다.**

### 2.1 다섯 축이 실제로 얼마나 벌어져 있는가

| 축 | stage1 | stage2 | stage3 | stage4 | stage5 | 폭 |
|---|---|---|---|---|---|---|
| **길이** `runSec` | 360 | **300** | **420** | 330 | **450** | 300~450s (1.5배) |
| **구간 길이** `segmentSec` | 30 | **25** | **35** | 30 | 30 | 25~35s |
| **동시 상한** `capTo` | 150 | 120 | 110 | **90** | **150** | 90~150 (1.67배) |
| **스폰 간격 하한** `intervalTo` | 0.22 | 0.24 | **0.30** | 0.30 | **0.18** | 0.18~0.30s |
| **HP 계수** `hpK` | (0.33) | 0.40 | **0.30** | **0.48** | 0.34 | 0.30~0.48 |
| **HP 지수** `hpExp` | (1.55) | 1.50 | **1.60** | **1.48** | 1.52 | 1.48~1.60 |
| **계열 수(후반)** | — | 4 | 4 | 4 | 4 | — |
| **기믹 성격** | 이롭다 | 시야 | 이동 | 바닥 | 위치 | 전부 다른 축 |
| **보스전 중 기믹** | `off` | `reduced` | `on` | `on` | `reduced` | — |

읽는 법:

- **stage2 는 짧고 가파르다.** 300초에 12구간이라 구간이 25초. 시야가 조여드니
  동시 상한을 120으로 낮췄다 — `_note` 에 "안 보이는 곳에서 맞았다를 막는다" 고 적혀 있다.
- **stage3 은 길고 완만하다.** 420초, 구간 35초, 상한 110, 간격 하한 0.30.
  늪에 묶이면 회피가 어려워지므로 **물량을 의도적으로 줄였다.** 대신 `hpExp` 를 1.60 으로
  전 스테이지 중 가장 높게 잡아 **후반이 급격히 무거워지게** 했다.
- **stage4 는 물량이 아니라 개체 강도다.** 상한 90(최저), `hpK` 0.48(최고).
  근거가 `_note` 에 있다 — **"화면에 적이 적어야 낙석 예고 원이 읽힌다."**
  즉 상한을 낮춘 것은 난이도 조절이 아니라 **가독성 확보**다.
- **stage5 는 정면 물량이다.** 450초, 상한 150, 간격 하한 0.18(최저).
  돌풍이 주기적으로 지나가 "서 있으면 죽는다"를 만든다 — 카이팅이 아니라 계속 도는 스테이지.

### 2.2 원칙을 지키는 데 실패한 지점

정직하게 적는다.

| 항목 | 상태 |
|---|---|
| 길이·곡선·계열 믹스·해금 | 🟩 실제로 다 다르다 |
| 환경 기믹 5종 | 🟨 **개념은 5종, 실제로 완전히 작동하는 것은 2종**(sanctuary, haze). §4 참조 |
| 보스 6종 | 🟥 **패턴 테이블이 6종 전부 바이트 단위로 동일하다.** HP·이속·히트박스·스프라이트만 다르다. §5.3 |
| 배경 | 🟥 전용 텍스처 0장. tint 만 다르다. §7 |

> **"규칙이 다르다"가 현재 실제로 성립하는 축은 웨이브 곡선과 적 계열 조합, 두 개뿐이다.**
> 기믹과 보스는 아직 "다르게 설계됐지만 다르게 구현되지 않았다."

---

## 3. 웨이브 곡선 — 파라미터의 의미와 실측 결과

### 3.1 8개 파라미터

`stages.json` → `waves.curve` 는 8개 값으로 12~15개 구간을 생성한다.
구간을 손으로 나열하지 않는 이유는 단순하다 — **스테이지가 5개면 60~75줄을 손으로 관리해야 하고,
그중 한 줄만 오타가 나도 "3분쯤에 갑자기 쉬워진다"가 되는데 아무도 눈치채지 못한다.**

| 키 | 뜻 | 왜 이 축이 필요한가 |
|---|---|---|
| `hpK` | HP 배율 계수 | **얼마나 빨리 무거워지는가.** 전체 난이도의 기울기 |
| `hpExp` | HP 배율 지수 | **언제 무거워지는가.** 1.5 미만이면 초반부터, 1.6이면 후반에 몰린다 |
| `dmgK` / `dmgExp` | 접촉 피해 배율 | HP 와 분리한 이유는 §3.3 |
| `intervalFrom` → `intervalTo` | 스폰 간격 (초) | 선형 보간. **압박의 리듬** |
| `capFrom` → `capTo` | 동시 생존 상한 | 선형 보간. **화면 밀도 = 가독성 예산** |

### 3.2 왜 HP 는 선형이 아니라 지수인가

`StageSystem.buildSegments()` 주석의 근거를 그대로 옮긴다.

> ★ hpMult 를 선형이 아니라 지수(hpExp)로 올리는 이유: 플레이어 DPS 는 무기 레벨과
> 축복이 곱연산으로 쌓여 지수적으로 오른다. 적 HP 가 선형이면 후반이 무의미해진다.

`05-COMBAT` §6 의 DPS 역산이 이걸 뒷받침한다. 6:00 시점 실효 DPS 152 는
`무기합 94.63 × 공속 1.16 × 피해 1.16 × 치명 1.065 × 각성 1.25 × 성소 1.12 × 가동률 0.80`
으로, **곱해지는 항이 6개다.** 항이 곱으로 쌓이면 결과는 지수적으로 자란다.
적 HP 를 선형으로 올리면 4분 이후 모든 적이 한 방에 녹아 **웨이브가 배경 애니메이션이 된다.**

`05-COMBAT` §4.4 의 실측 기대 DPS 곡선이 그 지수성을 보여준다.

| 시각 | 1:30 | 3:00 | 4:30 | 6:00 |
|---|---|---|---|---|
| 기대 플레이어 DPS | 약 60 | 약 110 | 약 175 | **152 실효 / 190 명목** |

1:30 → 4:30 사이 3분 동안 DPS 가 2.9배가 된다. 같은 구간의 정본 hpMult 는 1.6 → 4.5 로 2.8배다.
**두 곡선을 나란히 두는 것이 곡선 설계의 전부다.**

### 3.3 dmg 를 hp 와 분리한 이유

HP 배율은 **"얼마나 오래 걸리는가"** 를, dmg 배율은 **"실수 한 번의 값이 얼마인가"** 를 정한다.
둘을 하나로 묶으면 후반에 적 HP 를 5.6배로 올릴 때 접촉 피해도 5.6배가 되어
**한 번 스치면 즉사**한다. 정본은 dmg 를 6분에 **2.10배**까지만 올린다.
`dmgExp`(1.25~1.35)가 `hpExp`(1.48~1.60)보다 항상 낮은 것이 이 분리의 실체다.

### 3.4 🚨 실측 — 코드의 공식이 데이터의 공식과 다르다

`stages.json` 머리주석이 선언한 공식:

```
hpMult(t)  = 1.00 + (t/60)^hpExp  * hpK
dmgMult(t) = 1.00 + (t/60)^dmgExp * dmgK
```

`StageSystem.buildSegments()` 가 실제로 계산하는 것:

```js
hpMult:  1 + (c.hpK  ?? 0.4)  * Math.pow(i, c.hpExp  ?? 1.5),   // i = 구간 인덱스
dmgMult: 1 + (c.dmgK ?? 0.12) * Math.pow(i, c.dmgExp ?? 1.3),
```

**`t/60` 이 아니라 구간 인덱스 `i` 다.** 두 값이 같아지는 것은 `segmentSec === 60` 일 때뿐인데,
실제 `segmentSec` 는 25 / 30 / 35 다. 즉 **모든 스테이지에서 지수의 밑이 2~2.4배 크게 들어간다.**

마지막 구간에서 어떤 차이가 되는지 계산했다.

| 스테이지 | 마지막 구간 | 데이터 공식이 의도한 hpMult | 코드가 만드는 hpMult | 배수 |
|---|---|---|---|---|
| stage1 | t=330 (`phases.json` 직접값) | **5.64** | **5.64** (영향 없음) | 1.00 |
| stage2 | i=11, t=275 | 4.92 | **15.59** | **3.2배** |
| stage3 | i=11, t=385 | 6.87 | **14.91** | **2.2배** |
| stage4 | i=10, t=300 | 6.20 | **15.50** | **2.5배** |
| stage5 | i=14, t=420 | 7.55 | **19.77** | **2.6배** |

dmgMult 도 같은 방식으로 어긋난다(stage5 마지막 구간 **4.71**, 정본 6:00 값은 2.10).

**stage1 만 영향이 없다.** `waves.inherit: "phases"` 라서 곡선을 생성하지 않고
7일 프로토타입에서 실측·튜닝이 끝난 `phases.json` 의 12구간 테이블을 그대로 쓰기 때문이다.
그 판단 자체는 옳다 — `stages.json` 주석이 근거를 적어 뒀다.

> 곡선 공식으로 다시 유도하면 소수점에서 미세하게 어긋나고,
> 그 어긋남이 "왜 갑자기 어려워졌지"로 돌아온다. 원본을 그대로 쓴다.

> ⚠ **그러나 그 이유 때문에 stage1 만 안전지대에 들어가 있고, 나머지 4개는 검증된 적이 없다.**
> stage2~5 의 후반 적 HP 는 정본 곡선의 2.2~3.2배다. 이게 의도인지 사고인지
> **판정할 근거가 코드에도 문서에도 없다.** §8-2 와 `16` 문서 §6 의 밸런싱 리스크로 넘긴다.

### 3.5 계열 믹스 → 적 ID 가중치

`mix` 는 적 ID 가 아니라 **계열(family) 가중치**다. 적이 150종이므로 스테이지마다 ID 를
손으로 나열하면 적 하나를 추가할 때 5곳을 고쳐야 한다.

`StageSystem.weightsAt()` 이 계열 비율을 그 계열의 적 수로 **나눠서** 배분한다.

```js
const each = share / pool.length;
for (const e of pool) out[e.id] = (out[e.id] ?? 0) + each;
```

나누지 않으면 종이 많은 계열이 비율과 무관하게 훨씬 자주 나온다.
**"언데드 20%"는 언데드 계열 전체가 20% 라는 뜻이어야 한다.**

`mix` 는 시각 오름차순 밴드표이고 `pickBand()` 가 **해당 시각 이하의 마지막 밴드**를 고른다.
보간하지 않는다 — 밴드가 바뀌는 순간 적 구성이 계단식으로 갈아탄다.
스테이지마다 밴드가 3개(t=0 / 중반 / 후반)라 **런 하나에 적 구성이 두 번 바뀐다.**

---

## 4. 환경 기믹 5종

### 4.0 기믹의 판정 기준

`StageSystem.js` 주석이 기준을 명시한다.

> ★ 기믹은 화면을 어지럽히는 것이 아니라 **플레이어의 선택을 바꾸는 것**이어야 한다.
> 시야가 좁아지면 안전거리를 다시 잡아야 하고, 늪이 느리게 하면 대시를 아껴야 한다.

공통 규칙:

- 기믹 오브젝트 동시 상한은 코드 상수 `MAX_GIMMICK = 8`. **"넘치면 화면이 읽히지 않고 프레임도 흔들린다."**
- `duringBoss` 로 보스전 중 강도를 정한다. `gimmickScale()` 이 `off → 0` / `reduced → 0.5` / 그 외 `1` 을 돌려준다.
- **`duringBoss` 를 반드시 존중해야 하는 이유는 연출이 아니라 T525 다.**
  보스전에서 시야를 조이면 0.6s 텔레그래프가 안 보인다 → 난이도가 아니라 **불공정**이 된다.
- 스탯을 건드리는 기믹은 값을 직접 쓰지 않고 `StatSystem` 의 `toll` 경로로 넣는다.
  BLIND 대가·밤눈 축복과 **같은 축에서 계산돼야 하한(시야 90px / 이속 32px/s)이 한 번만 적용**된다.
  기믹 모디파이어는 전부 `"stage:gimmick"` src 로 붙어 `removeBySrc` 한 번에 걷힌다.

### 4.1 요약표

| 기믹 | 스테이지 | 성격 | 보스전 중 | 배선 상태 |
|---|---|---|---|---|
| `sanctuary` 성수 웅덩이 | stage1 | **이롭다** — 밟으면 회복 | `off` (완전 정지) | 🟩 **완전** — 9개 파라미터 전부 코드가 읽는다 |
| `haze` 향로 연기 | stage2 | 시야 축소 | `reduced` (절반) | 🟩 **거의 완전** — `bands` 만 미사용 |
| `mire` 수렁 | stage3 | 이동속도 감소 | `on` (그대로) | 🟥 **파탄** — 8개 중 5개가 죽은 키. §4.4 |
| `rockfall` 붕괴 | stage4 | 바닥 점유 + 피해 | `on` | 🟨 **부분** — `windup`·`countFrom/To`·`maxActive` 미배선 |
| `emberwind` 화염 돌풍 | stage5 | 위치 강제 | `reduced` | 🟥 **전면 불일치** — 8개 파라미터 **전부** 미배선, **피해 0**. §4.6 |

> **5종 중 데이터대로 도는 것은 2종이다.** 나머지 3종은 코드가 자기 기본값으로 굴러가고 있고,
> 그중 2종은 `_note` 가 설명하는 동작과 **완전히 다른 것**을 한다.
> `stages.json` 에 적힌 `_note` 는 현 시점에서 **설계 의도의 기록이지 동작 설명이 아니다.**

### 4.2 `sanctuary` — 성수 웅덩이 (stage1)

| 파라미터 | 값 | 코드가 읽는가 | 의미 |
|---|---|---|---|
| `every` | 60 | ✅ | 생성 주기 (초). `scale` 로 나눠 보스전 중 정지 |
| `firstAt` | 45 | ✅ | 첫 생성 시각 |
| `radius` | 30 | ✅ | 웅덩이 반경 (px) |
| `ringMin` / `ringMax` | 120 / 220 | ✅ | 플레이어 기준 생성 도넛 |
| `duration` | 12 | ✅ | 지속 (초) |
| `tickInterval` | 1 | ✅ | 회복 간격 (초) |
| `heal` | 6 | ✅ | 1틱 회복량 |
| `maxActive` | 2 | ✅ | 동시 개수 |

**5종 중 유일하게 플레이어에게 이로운 기믹이다.** 그래서 `duringBoss: "off"` 다 —
보스전에 회복 웅덩이가 남아 있으면 `05-COMBAT` §6 의 HP 11,000 역산(실효 DPS 152 × 72초)이
성립하지 않는다. **역산의 전제가 "회복이 없다"이므로 기믹을 끄는 것은 연출이 아니라 밸런스 계약이다.**

산수: 12초 지속 × 1초 틱 × 6 = 웅덩이 하나당 최대 72 회복. 60초 주기, 동시 2개.
6분 런 전체에서 최대 5~6개가 생성되므로 **상한 약 400 회복** — 플레이어 최대 HP 를 감안하면
"한 번의 실수를 되돌릴 수 있다" 수준이고, 파밍이 성립하지 않게 도넛(120~220px) 밖에 생성한다.

### 4.3 `haze` — 향로 연기 (stage2)

| 파라미터 | 값 | 코드 | 의미 |
|---|---|---|---|
| `period` | 24 | ✅ | 1주기 (초) |
| `closeSec` / `holdSec` / `openSec` | 6 / 6 / 4 | ✅ | 조임 6s → 유지 6s → 열림 4s → **여유 8s** |
| `visionFrom` → `visionTo` | 320 → 150 | ✅ | 시야 반경 (px). 최대 **-53%** |
| `bandWidth` | 18 | ✅ | 화면 가장자리 어둠 띠 두께 |
| `color` | `0x0B0710` | ✅ | 18 문서 팔레트의 Deepest shadow 와 같은 색 |
| `bands` | 14 | ❌ **미사용** | 코드는 사각형 4개(상·하·좌·우)만 그린다 |

구현이 잘 된 지점이 하나 있다. **시야를 직접 쓰지 않고 `stats.add("vision", "toll", 1-mul, "stage:gimmick")`
로 넣는다.** 그래서 BLIND 대가를 이미 들고 있는 플레이어에게 연기가 이중으로 적용되지 않고,
하한 90px 이 한 번만 걸린다. 값이 0.01 이상 변할 때만 모디파이어를 갈아끼워 매 프레임 재계산도 피한다.

`duringBoss: "reduced"` → 보스전 중에는 조임이 절반(320 → 235px)이다.
`_note` 가 근거를 적었다: **"0.6s 텔레그래프가 안 보이면 T525 위반이다."**

### 4.4 🟥 `mire` — 수렁 (stage3)

**여기가 가장 심하게 어긋난 곳이다.**

| 파라미터 | 데이터 값 | 코드가 읽는 키 | 실제 사용값 | 결과 |
|---|---|---|---|---|
| `chunk` | 256 | — | — | ❌ 죽은 키 |
| `radius` | **2** | `p.radius ?? 44` | **2** | 🚨 **반경 2px 웅덩이** |
| `perChunk` | 1.4 | — | — | ❌ 죽은 키 |
| `minR` / `maxR` | 34 / 62 | `p.ringMin ?? 80` / `p.ringMax ?? 260` | **80 / 260** | ❌ 이름이 다르다 |
| `slow` | 0.35 | `p.slowMult ?? 0.6` | **0.6** | ❌ 이름이 다르다. 실제 감속 **-40%** |
| `color` | `0x2F4A2A` | ✅ | `0x2F4A2A` | 🟩 |
| `alpha` | 0.42 | 코드 하드코딩 0.3 | 0.3 | ❌ |
| — | — | `p.every ?? 8` | **8초** | 데이터에 없음 |
| — | — | `p.maxActive ?? 5` | **5개** | 데이터에 없음 |
| — | — | `p.duration ?? 14` | **14초** | 데이터에 없음 |

세 가지가 동시에 깨져 있다.

1. **`radius: 2` 는 픽셀 반경으로 읽힌다.** `dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius`
   → 웅덩이 중심에서 2px 안에 들어가야 감속이 걸린다. **사실상 절대 밟히지 않는다.**
   데이터 작성자는 이 값을 "청크당 격자 반경"(청크 좌표계)으로 의도한 것으로 보이지만,
   코드는 화면 픽셀로 쓴다. 그 청크 배치 로직 자체가 존재하지 않으므로 의도를 되살릴 코드가 없다.
2. **`_note` 가 설명하는 "청크 시드 고정 배치"가 구현되어 있지 않다.**
   실제 코드는 플레이어 주변 도넛에 **매번 무작위**로 생성한다.
   `_note` 는 이렇게 적혀 있다 — "같은 자리는 언제 와도 같은 수렁이다 — **외워서 대응할 수 있어야 불공정이 아니다.**"
   **그 공정성 근거가 코드에서 성립하지 않는다.** 무작위 배치는 외울 수 없다.
   다만 감속이 실질적으로 발동하지 않으므로 **지금은 불공정이 표면화되지 않았을 뿐이다.**
3. **`gimMire` 가 감속 계수를 `g.visionMul` 필드에 저장한다.** 이름이 vision 이지만 실제로는
   `moveSpeed` 모디파이어의 캐시로 쓰인다. 동작 버그는 아니지만(한 런에 기믹은 하나뿐이므로)
   **다음 사람이 반드시 한 번 오해할 이름이다.**

> **판정: stage3 의 정체성이 코드에 존재하지 않는다.** stage3 은 현재 "긴 스테이지"일 뿐
> "늪 스테이지"가 아니다. 고치는 방법은 두 가지 — 코드를 데이터에 맞추거나(청크 배치 구현),
> 데이터를 코드에 맞추거나(`radius: 44`, `ringMin/ringMax`, `slowMult: 0.65`). **후자가 30분이다.**

### 4.5 `rockfall` — 붕괴 (stage4)

| 파라미터 | 데이터 값 | 코드 | 실제 사용값 |
|---|---|---|---|
| `every` | 7.5 | ✅ | 7.5초 (`scale` 로 나눔) |
| `firstAt` | 12 | ✅ | 12초 |
| `countFrom` / `countTo` | 1 / 4 | ❌ | 코드는 **틱당 항상 1개**만 만든다 |
| `windup` | **0.95** | ❌ | 코드는 `p.telegraph` 를 읽는다 → 없으므로 **기본 0.8s** |
| `radius` | 34 | ✅ | 34px |
| `damage` | 14 | ✅ | 14 |
| `spread` | 180 | ✅ | 플레이어 기준 반경 180px 안 무작위 |
| `maxActive` | 6 | ❌ | 코드는 상수 `MAX_GIMMICK`(8)을 쓴다 |

`countFrom → countTo` 가 죽어 있으므로 **후반에도 낙석이 늘어나지 않는다.**
stage4 의 `_note` 는 "낙석이 바닥을 계속 뺏으므로"라고 썼지만, 7.5초에 1개 · 반경 34px 로는
바닥을 뺏지 못한다. **stage4 의 압박은 현재 낙석이 아니라 `hpK` 0.48 이 전부다.**

#### ★ 4.5.1 예고 0.6초 하한 — 왜 코드가 데이터를 무시하고 끌어올리는가

`StageSystem.gimRockfall()` 에 하드 플로어가 있다.

```js
// ★ 0.6 미만으로 내려갈 수 없다. 데이터가 더 짧게 적어도 여기서 끌어올린다.
warn.__warn = Math.max(0.6, p.telegraph ?? 0.8);
```

`BossSystem` 에도 같은 상수가 있고(`MIN_TELEGRAPH = 0.6`), 그쪽은 생성자에서 데이터를 검사해
위반 시 `console.error` 를 찍고 강제로 끌어올린다.

**근거는 T525 다.** `12-TASK-BACKLOG.md:255` 의 태스크이고, 정본 근거는 `03-GDD-CORE.md` §7.3 이다.

> **텔레그래프 필수:** 모든 패턴은 0.6초 이상 예고(붉은 인디케이터). 모바일 화면에서 반응 가능해야 함.

`05-COMBAT` §6.2 가 그 숫자의 출처를 적었다.

> **예비동작은 전부 0.60s 이상** — 정본 §7.3의 절대 규칙.
> **640×360 모바일 화면에서 붉은 인디케이터를 인지하고 조이스틱을 꺾는 데 필요한 최소 시간.**

**왜 이것이 "난이도"가 아니라 "불공정"의 경계인가.**
0.6초는 임의의 숫자가 아니라 **인지 → 판단 → 엄지 이동 → 캐릭터 반응**이라는 4단 체인의 합이다.
데스크톱 마우스나 패드와 달리 플로팅 조이스틱은 **엄지가 이미 놓인 위치에서 방향을 다시 만들어야 하고**,
그 물리적 지연은 플레이어가 아무리 숙련돼도 줄어들지 않는다.
따라서 0.6초 미만의 예고는 **"어려운 패턴"이 아니라 "입력 장치로 대응할 수 없는 패턴"** 이다.
어려운 패턴은 플레이어가 학습하면 넘어서지만, 대응 불가능한 패턴은 **학습해도 넘어설 수 없고
플레이어는 그것을 자기 실력이 아니라 게임의 결함으로 정확히 인식한다.**

**이 하한이 데이터가 아니라 코드에 있는 이유:**
밸런싱은 JSON 만 고쳐서 한다는 것이 이 프로젝트의 규칙이다(`boss.json` 머리주석).
그런데 밸런싱 중 "조금 더 어렵게"를 반복하다 보면 예고 시간이 가장 먼저 깎인다 — 효과가 즉각적이기 때문이다.
**그래서 0.6초만은 JSON 이 못 넘는 곳에 둔다.** 데이터가 틀렸다고 게임을 죽이지는 않되,
조용히 넘어가면 **불공정한 빌드가 배포된다.**

**낙석이 0.8s(데이터 의도는 0.95s)로 하한보다 긴 이유**는 `_note` 에 있다.

> 낙석은 보스 패턴과 달리 예고가 화면 여기저기서 동시에 뜨므로 읽는 데 시간이 더 든다.

보스 패턴의 예고는 **보스 몸에서 뻗어 나오므로 시선이 이미 거기 있다.**
낙석은 시선이 없는 곳에 뜨므로 **"예고를 찾는 시간"이 0.6초 예산 밖에서 추가로 든다.**
0.6초는 하한이지 목표가 아니다.

> 🚨 **다만 현재 데이터의 `windup: 0.95` 는 코드가 읽지 않는다.** 실제 예고는 0.8s 다.
> T525 는 위반하지 않지만 **작성자가 의도한 여유 0.15s 가 사라졌다.** 키 이름을 맞춰야 한다(§8-6).

### 4.6 🟥 `emberwind` — 화염 돌풍 (stage5)

**데이터와 코드가 서로 다른 기믹을 말하고 있다.**

| 데이터가 정의한 것 | 코드가 실행하는 것 |
|---|---|
| `windup: 1.1` — 1.1초 예고선 | 예고 **없음** |
| `halfWidth: 28` — 두께 56px 불길 띠 | 띠 **없음**. 화면 가로 전체에 2px 선 6줄을 흘린다(장식) |
| `speed: 240` — 띠가 화면을 가로지르는 속도 | 없음 |
| `damage: 16` / `tickInterval: 0.5` | 🚨 **피해 판정 자체가 없다. 데미지 0.** |
| `every: 11` / `firstAt: 18` | `p.period ?? 18` 주기, `p.blowSec ?? 8` 동안 지속 |
| — | `p.push ?? 26` — 플레이어 좌표를 초당 26px 로 **직접 밀어낸다** |
| `color: 0xFF6A2A` | ✅ 이 키만 맞는다 |

즉 현재 stage5 의 기믹은 **"불길 띠를 피하는 것"이 아니라 "18초마다 8초 동안 캐릭터가 슬쩍 밀리는 것"** 이다.

두 가지를 따로 기록한다.

1. **밀어내기 구현이 물리를 우회한다.** `pl.x += Math.cos(a) * push * dt` 로
   플레이어 좌표를 직접 쓴다. 조이스틱 입력·대시와 같은 경로를 타지 않으므로
   **속도 하한(32px/s)·넉백 감쇠·충돌 어느 것도 적용되지 않는다.** 지금은 26px/s 라 눈에 띄지 않지만,
   값을 올리는 순간 벽 없는 무한 맵에서 예측 불가능한 이동이 된다.
2. **`_note` 의 설계 근거는 훌륭한데 구현이 없다.**
   > 띠 두께 56px 은 대시(쿨 3.0s) 없이도 **걸어서** 빠져나올 수 있는 폭이다 — 대시 의존은 T525 정신에 어긋난다.

   이건 §4.5.1 의 T525 논리를 공간 축으로 옮긴 정확한 추론이다.
   **쿨다운 3초짜리 자원을 회피의 전제로 삼으면, 그 자원이 없는 순간의 패턴은 대응 불가능하다.**
   피해 판정과 함께 구현할 때 이 56px 근거를 반드시 유지해야 한다.

> **판정: stage5 의 정체성도 코드에 존재하지 않는다.** stage5 는 현재 "가장 긴 물량 스테이지"일 뿐이다.
> mire 와 달리 여기는 **피해 판정 자체가 없어 데이터를 코드에 맞추는 방식으로는 해결되지 않는다.**
> 새로 짜야 한다(추정 4~6h).

---

## 5. 보스 6종

### 5.1 스탯 표

| id | `boss.json` 이름 | 스테이지 | HP | 접촉피해 | 이속 | 히트박스 | 등장 시각 | 목표 전투 | 역산 기대 DPS | 클리어 골드 |
|---|---|---|---|---|---|---|---|---|---|---|
| **BOSS1** | 여명의 처형인 | stage1 | **11,000** | 26 | 46 | 56 × 80 | 360s | **76s** | 152 | 200 |
| **BOSS2** | 잿빛 성가대장 | stage2 | **14,800** | 24 | 52 | 60 × 80 | 300s | **72s** | 205 | 240 |
| **BOSS3** | 역병의 어미 | stage3 | **19,500** | 28 | 40 | 35 × 54 | 420s | **78s** | 250 | 300 |
| **BOSS4** | 첨탑의 파수꾼 | stage4 | **22,200** | 30 | 44 | 42 × 75 | 330s | **74s** | 300 | 340 |
| **BOSS5** | 지옥문의 간수 | stage5 | **29,500** | 32 | 48 | 66 × 53 | 450s | **82s** | 360 | 420 |
| **BOSS6** | 봉인묘의 간수 | **없음** | **35,700** | 34 | 50 | 83 × 80 | 360s | **85s** | 420 | 200 |

전 보스 공통: `tier: "boss"` / `ai: "chase"` / `expValue: 0` / `goldValue: 0` /
`knockbackResist: 1`(넉백 면역) / `phaseInvuln: 1.2` / `purgeMinionsOnSpawn: true` / `stopSpawning: true`.

**히트박스는 캔버스 크기가 아니라 실측값이다.** `boss-atlas.json` 머리주석:

> hitbox 는 **idle 프레임 알파 bbox 중앙값 × 정규화 배율(실측)** 이다. 캔버스 크기가 아니다.

이게 왜 중요한지는 `03-GDD` §7.3 이 경고해 둔 그대로다 — 보스 시트는 여백이 큰 캔버스라
프레임 크기를 그대로 히트박스로 쓰면 **머리 위 허공에서 맞는다.**
`BossSystem.spawn()` 은 여기서 한 걸음 더 간다.

```js
// 히트박스 56x80을 원으로 근사할 때 긴 변(80)을 쓰면 머리 위 허공에서 맞는다.
// 짧은 변 기준 반경 28이 "보이는 몸통"과 가장 가깝다.
b.radius = d.hitbox.w / 2;
```

⚠ **BOSS5 만 가로가 세로보다 크다(66 × 53).** `hitbox.w / 2 = 33` 이 짧은 변이 아니라 긴 변의 절반이다.
**BOSS5 에 한해 이 규칙이 반대로 작동해 히트박스가 실제 몸통보다 넓다.** (§8-9)

### 5.2 HP 역산 — 근거와 그 근거의 한계

`boss.json` 머리주석: **"baseHp 는 목표 전투 시간 × 그 시점 기대 DPS 로 역산했다."**
각 보스의 `_designNote` 에 산출식이 그대로 들어 있다.

```
BOSS1  목표 전투 76초. 기대 DPS 152 x 76s = 약 11600.   패턴 축: 낫·사령탄
BOSS2  목표 전투 72초. 기대 DPS 205 x 72s = 약 14800.   패턴 축: 성가·추적탄
BOSS3  목표 전투 78초. 기대 DPS 250 x 78s = 약 19500.   패턴 축: 독장판·소환
BOSS4  목표 전투 74초. 기대 DPS 300 x 74s = 약 22200.   패턴 축: 돌진·낙석
BOSS5  목표 전투 82초. 기대 DPS 360 x 82s = 약 29500.   패턴 축: 화염·광폭화
BOSS6  목표 전투 85초. 기대 DPS 420 x 85s = 약 35700.   패턴 축: 전방위·분열
```

**목표 전투 시간 60~90초의 근거**(`05-COMBAT` §6.4 / `03-GDD` §7.3):
60초 미만이면 3페이즈 구조가 화면에 다 나오기 전에 끝나고,
90초를 넘으면 6분 런의 4분의 1이 보스전이 되어 **"서바이버즈"가 아니라 "보스 러시"가 된다.**

#### ★ 여기서 정직해야 할 부분

**BOSS1 의 152 만 실제로 역산된 숫자다.** `05-COMBAT` §6 Step 2~4 에 전 과정이 있다.

```
무기 4종 단일대상 소계 94.63
  × attackSpeed 1.16 × damageMult 1.16 × critFactor 1.065
  × awakenFactor 1.25 × 성소 예리함 1.12          = 명목 189.85
  × 전투 가동률 0.80 (회피·재배치·페이즈 무적 2.4s) = 실효 151.9
목표 전투시간 중앙값 72초 → 152 × 72 = 10,944 → 11,000
```

**BOSS2~6 의 205 / 250 / 300 / 360 / 420 은 어디서 나왔는지 문서에도 코드에도 근거가 없다.**
BOSS1 대비 1.35 / 1.64 / 1.97 / 2.37 / 2.76 배인데, 이 증가율을 정당화하는
"스테이지 N 시점의 플레이어 빌드" 모델이 존재하지 않는다.

이 게임에는 런 간 영구 성장이 **성소(sanctum) 하나뿐**이고 그 상한은 정해져 있다
(`05-COMBAT`: 성소 만렙까지 10,930 골드, 클리어당 1,318 골드 → 9~11회 클리어).
성소 만렙 플레이어의 실효 DPS 는 `05-COMBAT` §6.5 기준 상위 10% 에서 **약 240** 이다.
**즉 BOSS4(300) · BOSS5(360) · BOSS6(420)이 전제하는 DPS 는 현재 성장 곡선의 상한을 넘는다.**

> **판정: BOSS2~6 의 HP 는 역산이 아니라 "그럴듯한 등비수열"이다.**
> 장비 시스템(`23-ITEM-SYSTEM.md`, 아이템 66종 + 접두 16 + 접미 16)이 DPS 를 얼마나 올리는지
> 측정되면 그 값으로 다시 역산해야 한다. **지금 값을 신뢰하면 stage4 부터 클리어 불가능일 수 있고,
> 그것을 확인한 사람이 아직 없다.** → `16` 문서 §6

### 5.3 🚨 패턴 — 6종이 전부 동일하다

`boss.json` 의 `patterns` 배열을 6종 전부 직렬화해 비교한 결과 **바이트 단위로 동일하다.**

| 페이즈 | 패턴 | 타입 | 피해 | 쿨다운 | 예고 |
|---|---|---|---|---|---|
| P1 | `scythe` 낫 | cone (130° / r96 / 넉백 60) | 26 | 3.2s | 0.8s |
| P1 | `soulbolt` 사령탄 | projectile (3발 / 확산 30° / 150px/s / 사거리 400) | 18 | 4.5s | 0.6s |
| P2 | `scythe` | 동일 | 26 | **2.8s** | 0.8s |
| P2 | `soulbolt` | **5발 / 확산 50°** | 18 | 4.5s | 0.6s |
| P2 | `summon` 소환 | E4 낡은 해골 6체 / 링 r120 / `hpMultOverride: 1` | — | 12s | 1.0s |
| P3 | `scythe` | 동일 | 26 | **1.68s** | 0.8s |
| P3 | `soulbolt` | 5발 / 170px/s | 18 | **4.0s** | 0.6s |
| P3 | `summon` | 동일 | — | **9s** | 1.0s |
| P3 | `bloodpool` 붉은 장판 | ground_aoe (r70 / 지속 6s / 1s 틱 / 최대 4 / 1회 2장 / 산포 70~150) | 12 | 5s | 0.6s |

페이즈 임계는 전 보스 동일 — **P1 100~66% / P2 66~33% / P3 33~0%**, P3 에서 `moveSpeedMult: 1.4`.

**그래서 `_designNote` 의 "패턴 축"은 전부 거짓이다.**
BOSS3 은 "독장판·소환"이 아니라 낫을 휘두르고, BOSS5 는 "화염·광폭화"가 아니라 사령탄을 쏜다.
6개 보스가 **HP·이동속도·히트박스·스프라이트만 다른 같은 보스**다.

> 이건 버그가 아니라 **미완성이 문서에 완성으로 기록된 것**이다.
> `_designNote` 는 지금 시점에서 "TODO 목록"으로 읽어야 한다.

### 5.4 패턴 스케줄러 — 왜 채널이 두 개인가

`BossSystem.updatePatterns()` 는 **메인 채널**(낫/사령탄/소환)과 **장판 채널**을 분리한다.
근거가 코드 주석에 정량으로 적혀 있다.

- 메인 채널 셋은 **예고가 전부 보스 몸에서 뻗어 나오는 도형**이라 겹치면 640×360 에서 읽을 수 없다.
  → **0.6s 텔레그래프가 장식이 된다(T525).** 그래서 한 번에 하나만 시전한다.
- 장판은 **보스가 아니라 월드 좌표에 그려지는 독립된 원**이라 시각적으로 겹치지 않는다.
  그리고 메인에 넣으면 P3 점유율이 1.05 를 넘어(오버서브스크립션) 26초 동안 2회밖에 못 나온다.

**경직 `RECOVER = 0.15` 의 근거도 산수다.**

```
P3 메인 채널 점유율
  낫    (0.80+0.15)/1.68
+ 사령탄 (0.60+0.15)/4.00
+ 소환  (1.00+0.15)/9.00   = 0.88
```

0.25 로 잡으면 0.98 이 되어 채널이 포화하고 **쿨이 긴 소환이 사실상 발동하지 못한다(실측 2회 / 기대 5회).**

**대기 패턴의 쿨다운은 마이너스로 내려가고 상한이 `-cooldown` 이다.**
가장 오래 기다린 것이 다음 차례를 갖되, 빚의 상한 때문에 **쿨이 긴 패턴이 항상 먼저 선택된다.**
소환(-9.0)이 낫(-1.68)을 이긴다 — 우선순위를 별도 필드로 두지 않고 스케줄러 규칙으로 보장한 것이다.

### 5.5 공정성 규칙 3가지 (전부 T525 파생)

1. **조준은 예고 시작 순간에 고정한다.** `startCast()` 가 `aim.x/y/ang` 을 스냅샷한다.
   > 예고 내내 플레이어를 따라다니는 조준은 0.6초를 줘도 피할 수 없다 — 텔레그래프가 장식이 된다.
2. **예고는 처음부터 최종 범위 전체를 윤곽선으로 보여주고, 채움만 짙어진다.**
   범위가 커지는 연출은 t=0.3 시점에 최종 범위를 알 수 없어 **실질 반응 시간이 0.6s 보다 짧아진다.**
   **윤곽 = 어디가 위험한가(즉시) / 농도 = 언제 터지는가(점증).** 두 정보를 분리해야 0.6초가 온전히 쓰인다.
3. **장판을 플레이어 발밑에 깔지 않는다.**
   반경 70px 원 밖으로 나가려면 70px 인데, 예고 0.6s 동안 이동 가능 거리는 70px/s × 0.6 = **42px** 뿐이다.
   대시(쿨 3.0s) 없이는 회피 불가 → **T525 위반.** 그래서 도넛(70~150px)에 흩뿌린다.
   §4.6 의 "띠 두께 56px" 근거와 정확히 같은 계산이다.

그 밖의 구조적 결정:

- **보스는 특별한 개체가 아니라 `spawn.enemies` 에 든 평범한 적이다.** 무기 4종의 충돌 코드가 0줄이 된다.
  보스 전용 히트박스를 만들면 무기가 늘 때마다 여기도 고쳐야 하고 **"W3만 보스에 안 맞는다"가 반드시 한 번 난다.**
- **페이즈 무적은 "무적 적" 개념을 만들지 않고 매 프레임 HP 를 되돌려 구현한다.**
  적 150체 루프에 분기를 늘리지 않기 위해서다. 한 프레임에 3,630(P3 임계 전량)을 넣을 빌드는 없다.
- **페이즈 전환 시 모든 타이머를 쿨다운만큼 되돌린다.** 안 하면 P3 진입 직후 낫→사령탄→장판이
  연달아 터져 "페이즈 전환에서 죽었다"가 된다. **숨 쉴 틈을 데이터가 아니라 전환 규칙으로 보장한다.**
- **리쉬(leash).** 플레이어 70px/s > 보스 46px/s 라 도망만 치면 `despawnFar(900px)` 에 걸려
  보스가 통째로 사라진다. 420px 초과 시 속도 3배, 340px 미만에서 해제(히스테리시스).
  가로 반폭 320px 이므로 **화면 밖에서만 가속한다** — 플레이어가 보는 전투 속도는 정본 그대로다.

### 5.6 스프라이트 · 지연 애니메이션 등록 · 라이선스

`boss-atlas.json` 은 `FE/tools/build-bosses.mjs` 의 생성물이다(손으로 고치지 말 것).
각 보스는 균일 격자 시트 1장이고 `frameWidth`/`frameHeight`/`columns` 로 좌표가 산술로 나온다.

| 시트 키 | 아틀라스 이름 | 프레임 | 시트 규격 | 배율 | 애니 | 🚨 라이선스 게이트 |
|---|---|---|---|---|---|---|
| `boss` (BOSS1) | — (아틀라스에 항목 없음) | — | `boss-executioner.png` | — | `boss.*` | 🟩 Bringer of Death (Clembod) — 상업 가능 |
| `boss2` | **재의 집행자** | 60 | 138×110 ×8열 | 1.333 | idle/walk/attack/cast/spell/death | 🟥 **blocked** — Undead executioner, 동봉 근거 없음 |
| `boss3` | **늪의 낭인** | 37 | 160×62 | 1.684 | — | 🟩 **clear** — xzany, 상업 가능 / 재판매 금지 / NFT 금지 |
| `boss4` | **첨탑의 마도사** | 42 | 160×138 | 0.748 | — | 🟩 **clear** — Evil Wizard 2, **CC0** |
| `boss5` | **나이트본** | 55 | 160×156 | 1.882 | — | 🟥 **blocked** — NightBorne, LC-07 **컷 후보 1순위** |
| `boss6` | **석조 수호자** | 56 | 160×160 | 1.739 | — | 🟥 **blocked** — Mecha-stone Golem |
| `boss7` | 무명 | 10 | 160×58 | 0.936 | — | 🟨 **conditional** — KBPixelArt, "Purchasers" 문언 |

> 🚨 **보스 6종 중 3종(BOSS2 · BOSS5 · BOSS6)이 배포 금지 판정이다.**
> `boss-atlas.json` 머리주석: **"license.gate 가 blocked 인 항목은 배포 금지다 — 17-LICENSES 5.4 / LC-07."**
> 그런데 **PNG 는 이미 `FE/public/assets/boss/` 에 들어 있다.** LC-07 의 조치("4팩 모두 `FE/public/` 에
> 복사하지 않는다")가 **이행되지 않았고 오히려 역행했다.** → `16` 문서 §2 최우선 항목

**이름이 두 곳에서 다르다.** `boss.json` 은 「잿빛 성가대장」, `boss-atlas.json` 은 「재의 집행자」다.
게임에 표시되는 것은 `boss.json` 쪽(`BOSS_SPAWNED` 이벤트 페이로드)이다. (§8-10)

**지연 애니메이션 등록.** `BossSystem.ensureAnims()` 가 등장 직전에 한 번만 등록한다.

> 부팅 시 6종을 전부 등록하면 쓰지 않을 애니메이션 30여 개가 상주한다.
> 보스는 런당 하나뿐이라 지연 등록이 명백히 싸다.

🚨 **그런데 재생 호출은 전부 `"boss.*"` 로 하드코딩되어 있다.**
등장 시 idle 만 `this.def.sheet + ".idle"` 로 올바르게 부르고, 그 뒤는 전부 고정 문자열이다.

```js
if (this.scene.anims.exists("boss.cast"))   b.play("boss.cast", true);     // startCast
const anim = p.def.type === "cone" ? "boss.attack" : "boss.spell";         // fire
if (this.recoverT <= 0 && this.scene.anims.exists("boss.idle")) ...        // 경직 해제
this.corpse = scene.add.sprite(-999, -999, "boss", 0);                     // 시체 스프라이트
```

→ **BOSS2~6 은 시전·공격·사망 애니메이션이 한 번도 재생되지 않는다.**
`anims.exists()` 가 false 를 돌려주므로 조용히 건너뛴다. 에러도 나지 않는다.
그리고 **처치 연출의 시체는 어느 보스를 잡든 BOSS1 스프라이트로 나온다.** (§8-11)

### 5.7 `setBoss()` 의 잠복 버그

`StageSystem.load()` → `boss.setBoss(st.bossId)` 가 `this.def` 만 교체한다.
그런데 **패턴 런타임 `this.byPhase` 는 생성자에서 BOSS1 기준으로 한 번만 만들어진다.**

```js
// 생성자
this.def = this.defs.BOSS1 ?? bossData.boss;
for (const d of this.def.patterns) { ... this.byPhase[d.phase].push(...) }

// setBoss — byPhase 를 재구축하지 않는다
setBoss(bossId) { const d = this.defs[bossId]; ...; this.def = d; return true; }
```

**지금은 증상이 없다 — 6종의 `patterns` 가 전부 동일하기 때문이다(§5.3).**
그래서 §5.3 을 고치는 순간, 즉 **보스마다 다른 패턴을 넣는 그 커밋에서 이 버그가 발현한다.**
"패턴을 넣었는데 BOSS1 패턴이 나온다"로 나타나고, 데이터를 의심하느라 시간을 버리기 좋은 형태다.
**§5.3 작업 티켓에 이 한 줄을 같이 붙여 둘 것.** (§8-12)

---

## 6. ⚠ 알려진 함정 — `stageAffinity` 와 계열 믹스는 다른 파일이다

### 6.1 실제로 한 번 터졌다

`enemies.json` 의 각 적은 `stageAffinity: ["stage2","stage3", ...]` 를 들고 있고,
`stages.json` 의 `mix` 는 계열 이름으로 비율을 적는다. **두 파일은 서로를 검증하지 않는다.**

`StageSystem.weightsAt()` 의 주석이 사고 기록이다.

> ★ 안전망: `enemies.json` 의 `stageAffinity` 와 `stages.json` 의 계열 믹스는 서로 다른
> 파일이라 언제든 어긋날 수 있다. **실제로 한 번 어긋나 stage2 의 적 풀이 0 이 됐고
> 그 스테이지는 통째로 플레이 불가였다.** 소속이 하나도 없으면 계열 전체로 내려간다 —
> **"의도와 다른 적이 나오는 것"이 "적이 안 나오는 것"보다 낫다.**

안전망은 2단이다.

```js
if (!pool.length && fam0.length) { console.warn(...); pool = fam0; }   // 1단: 계열 전체로
if (!pool.length) { console.warn(...); continue; }                      // 2단: 계열 자체가 빔
```

> 🚨 **안전망은 사고를 조용하게 만들 뿐 고치지 않는다.** `console.warn` 은 실기기에서 아무도 안 본다.
> 1단이 발동하면 **"stage2 에 늪 몬스터가 나온다"** 가 되고, 이건 크래시보다 발견이 늦다.

### 6.2 현재 교차 상태 (2026-08-11 실측)

`enemies.json` 150종 중 `tier: "normal"` 이고 `swarmOnly` 가 아닌 개체만 스폰 풀에 들어간다.
계열별 풀 크기와, 각 스테이지에서 affinity 를 통과하는 수를 전부 계산했다.

| 계열 | 풀 크기 | stage1 | stage2 | stage3 | stage4 | stage5 |
|---|---|---|---|---|---|---|
| undead | 10 | 6 | **10** | **10** | **10** | **10** |
| vermin | 6 | 0 | 0 | **6** | 0 | **6** |
| animal | 12 | 0 | 0 | **12** | 0 | 0 |
| monster | 12 | 0 | 0 | **12** | 0 | **12** |
| humanoid | 12 | 0 | **12** | 0 | 0 | 0 |
| humanoid2 | 12 | 0 | **12** | 0 | **12** | 0 |
| magical | 12 | 0 | **12** | 0 | **12** | 0 |
| demon | 12 | 1 | 0 | **12** | **12** | **12** |
| dragon | 12 | 0 | 0 | 0 | **12** | **12** |
| holy | 12 | 0 | **12** | 0 | 0 | 0 |

**굵게 표시된 칸이 그 스테이지의 `mix` 가 실제로 요구하는 계열이다. 현재 전부 1 이상이다 — 어긋난 곳은 없다.**
즉 **안전망은 지금 발동하지 않는다.** 하지만 표를 보면 여유가 없다는 것도 보인다.

- `vermin` 은 15종 중 스폰 가능한 것이 **6종뿐**이다(9종이 `swarmOnly` 이거나 elite/miniboss).
  stage3·stage5 가 `vermin` 을 요구하므로, **`swarmOnly` 를 하나만 더 붙여도 편차가 크게 흔들린다.**
- `undead` 는 12종 중 2종이 `swarmOnly` 라 10종. 5개 스테이지 전부가 요구하는 유일한 계열이다.
- **stage1 은 예외다.** `waves.inherit: "phases"` 라 계열 믹스를 쓰지 않고 `phases.json` 의
  E1~E8 ID 가중치를 직접 쓴다. **stage1 의 affinity 열(undead 6 / demon 1)은 아무 효력이 없다.**
  ⚠ 그러나 **stage1 을 곡선 방식으로 전환하는 순간** 8개 계열이 0 이 되어
  §6.1 의 사고가 그대로 재현된다.

### 6.3 규칙 — 반드시 두 파일을 함께 고친다

```
[ ] stages.json 의 mix 에 계열을 추가하면
      → enemies.json 에서 그 계열의 normal 개체 중 최소 몇 종에 stageAffinity 를 추가했는가
[ ] enemies.json 에서 stageAffinity 를 빼거나 swarmOnly / tier 를 바꾸면
      → 그 계열을 mix 에 쓰는 스테이지가 몇 개인가 (위 표로 확인)
[ ] 새 스테이지를 추가하면
      → 그 stageId 를 affinity 에 가진 적이 계열마다 있는가
```

**권장: `FE/src/data/validate.js` 에 교차 검증을 추가한다(추정 1h).**
`stages[].waves.mix[].families` 의 모든 키에 대해 affinity 통과 개체 수가 0 이면 실패시킨다.
지금은 런타임 `console.warn` 이 유일한 방어선이고, **그건 방어선이 아니다.**

---

## 7. 신규 스테이지 배경 이미지 의뢰 사양 (stage2~5)

> `18-MAP-IMAGE-PROMPT.md` 의 의뢰서 형식을 그대로 따른다.
> **18 문서가 stage1 「봉인묘」의 의뢰서이고, 이 절이 그 후속 4종이다.**
> 18 문서 §0 의 4차 방식(**벽 없음 / 이음매 없는 바닥 1장 + 알파 소품 시트 1장 / 충돌 마스크 없음**)을
> 그대로 승계한다. 벽을 다시 도입하지 않는다 — 3번 실패한 방식이다.

### 7.1 현재 폴백 상태

`FE/public/assets/map/` 에 실제로 존재하는 파일은 **`ground-grave.png` / `props-grave.png` / `props-grave.json`** 뿐이다.

`StageSystem.applyGround()` 가 텍스처 존재를 확인하고 없으면 내려간다.

```js
const tex = this.scene.textures.exists(g.texture) ? g.texture : g.fallbackTexture;
```

> ★ 없는 텍스처를 그대로 요청하면 Phaser 가 **초록 체크무늬**를 그린다 —
> "미완성"이 아니라 **"고장"**으로 보인다. 반드시 존재 확인 후 내려간다.

| 스테이지 | 요청 텍스처 | 현재 실제 | tint | 현재 화면 |
|---|---|---|---|---|
| stage1 | `ground_grave` / `props_grave` | ✅ 있음 | `0xFFFFFF` | 정상 |
| stage2 | `ground_cathedral` / `props_cathedral` | ❌ → grave | `0x8AA0C0` | 묘지 + 차가운 청회색 |
| stage3 | `ground_mire` / `props_mire` | ❌ → grave | `0x6F8A5E` | 묘지 + 이끼 녹색 |
| stage4 | `ground_spire` / `props_spire` | ❌ → grave | `0xA89A86` | 묘지 + 회갈색 |
| stage5 | `ground_hellgate` / `props_hellgate` | ❌ → grave | `0xC06A4A` | 묘지 + 잿불 주황 |

**tint 폴백은 "돌아가긴 한다"는 뜻이지 "괜찮다"는 뜻이 아니다.**
같은 묘비가 5개 스테이지에 전부 서 있고 색만 바뀐다. §2 의 "규칙이 다르다" 원칙이
**시각적으로는 하나도 전달되지 않는다.** 소프트런치 스크린샷 5장이 전부 같은 그림이 된다.

⚠ **다만 이건 P1 이지 P0 이 아니다.** 리텐션 게이트(D1 ≥ 28%)를 결정하는 것은
0:00~0:30 이탈률이고, 그 구간은 **stage1 이다.** stage2~5 의 배경은
"플레이 계속한 사람이 보는 것"이라 우선순위가 뒤다. → `16` 문서 §5 컷 우선순위

### 7.2 산출물 (8개 파일)

| # | 파일 | 크기 | 용도 |
|---|---|---|---|
| **G-2** | `ground-cathedral.png` | 512 × 512 | 잿빛 성당 바닥 (이음매 없음) |
| **P-2** | `props-cathedral.png` + `.json` | 512 × 512 | 성당 소품 시트 (알파) + 좌표 |
| **G-3** | `ground-mire.png` | 512 × 512 | 역병 늪 바닥 |
| **P-3** | `props-mire.png` + `.json` | 512 × 512 | 늪 소품 |
| **G-4** | `ground-spire.png` | 512 × 512 | 무너진 첨탑 바닥 |
| **P-4** | `props-spire.png` + `.json` | 512 × 512 | 첨탑 소품 |
| **G-5** | `ground-hellgate.png` | 512 × 512 | 지옥문 바닥 |
| **P-5** | `props-hellgate.png` + `.json` | 512 × 512 | 지옥문 소품 |

저장 경로: `store/_raw/` (원본) → `FE/public/assets/map/`
텍스처 키는 `stages.json` 의 `ground.texture` / `ground.props` 와 **정확히** 일치해야 한다
(`ground_cathedral` ↔ `ground-cathedral.png`. 키는 언더스코어, 파일은 하이픈).

### 7.3 공통 규격 (18 문서 §2·§3 승계)

| 규칙 | 값 |
|---|---|
| 바닥 크기 | **정확히 512 × 512**, 완전 불투명 |
| 반복 | **상하좌우 완전 이음매 없음.** 2×2 타일링 자동 검증한다 |
| 밝기 | **어둡게.** 이 위에 적 150체·투사체가 올라간다 |
| 대비 | **낮게.** 큰 특징 금지 — 반복되면 즉시 격자로 읽힌다. 특징은 소품으로 뺀다 |
| 소품 배경 | **알파 0** (검정·흰색 아님) |
| 소품 시점 | 탑다운. 서 있는 것만 앞면 살짝 |
| 소품 그림자 | 발밑 타원 그림자 필수 |
| 소품 규칙 | ⚠ **이어지는 벽·담장을 만들지 않는다.** 짧은 조각만. 소품에 충돌을 걸지 않으므로
벽처럼 생긴 것이 있으면 플레이어가 통과할 때 고장으로 읽힌다 |

**소품에 충돌을 걸지 않는 근거**(18 문서 §4): `06-TECH-DESIGN.md` — 적은 벽을 통과한다.
적이 통과하는데 플레이어만 막히면 소품은 **전술적 이득 0 에 카이팅 걸림만** 만든다.

### 7.4 스테이지별 주제·팔레트

각 스테이지 tint 는 **폴백용**이므로 전용 텍스처가 오면 `stages.json` 의 `tint` 를 `0xFFFFFF` 로 되돌린다.
그림 자체가 색을 가져야 한다.

| 스테이지 | 바닥 주제 | 소품 주제 | 핵심 팔레트 |
|---|---|---|---|
| **stage2 잿빛 성당** | 재가 얇게 쌓인 성당 석재 바닥. 마모된 타일, 낡은 모자이크 흔적, 향로 재 | 부러진 신도석 · 쓰러진 촛대 · 향로 · 깨진 스테인드글라스 조각 · 성수반 · 무너진 기둥 밑동 | 차가운 청회색 `#8AA0C0` 계열 + 재 `#4A4454` + 그을음 `#16121C` |
| **stage3 역병 늪** | 젖은 진흙과 썩은 수초. 얕은 고인 물, 기포 자국 | 죽은 갈대 · 가라앉은 통나무 · 뼈 · 이끼 바위 · 늪 가스 얼룩 · 부서진 나룻배 | 이끼 녹색 `#2F4A2A` · `#6F8A5E` + 진흙 `#2A2018` |
| **stage4 무너진 첨탑** | 갈라진 석판과 부서진 잔해 가루. 균열, 낙석 자국 | 무너진 기둥 조각 · 부서진 계단 · 철제 난간 파편 · 돌 부스러기 더미 · 금 간 룬석 | 회갈색 `#A89A86` + 돌 `#4A4454` + 균열 그림자 `#16121C` |
| **stage5 지옥문** | 갈라진 흑요석 지면 사이로 새어 나오는 잿불. 그을린 균열 | 불 꺼진 화로 · 쇠사슬 더미 · 뒤틀린 철문 조각 · 유황 결정 · 재 무더기 | 잿불 주황 `#C06A4A` · `#FF6A2A`(균열만) + 흑요석 `#0B0710` |

⚠ **stage5 주의:** 잿불 균열은 **바닥 타일에 그리지 않는다.** 밝은 점 하나가 512 타일에 있으면
반복될 때 즉시 격자로 읽힌다(18 문서 §2 규칙). **균열은 소품 시트로 빼고 게임이 흩뿌린다.**
바닥은 균일하게 어두운 흑요석으로만 만든다.

### 7.5 ★ 바닥 영어 프롬프트 템플릿 (그대로 복사, `{{ }}` 만 교체)

```
=== SEAMLESS TILEABLE GROUND — {{STAGE NAME}} ===

Produce ONE image, exactly 512 x 512 pixels.

CRITICAL REQUIREMENT — SEAMLESS TILING
This image will be repeated edge to edge, infinitely, in both directions.
The right edge must continue perfectly into the left edge, and the bottom edge into the top.
There must be NO visible seam and NO visible repetition pattern when tiled.
Treat this as a true seamless texture, not a standalone picture.

SUBJECT
{{SUBJECT}}

ART STYLE
16-bit top-down pixel art. Chunky deliberate pixels on a 16x16 grid alignment.
No anti-aliasing. Hand-placed pixel look, not a filtered photograph.

PALETTE — keep it dark and low contrast
{{PALETTE LINES}}
Overall value must stay DARK. Characters, enemies and projectiles will be drawn on top of
this and must remain clearly readable, so the ground must never compete with them.

WHAT TO AVOID (these ruin a tiling texture)
  - No large distinctive features and no single bright spot. Anything eye-catching becomes
    an obvious grid when the tile repeats. Those elements belong in the separate prop sheet.
  - No strong directional lighting. Light must read as flat ambient.
  - No vignette, no gradient across the image, no border, no frame.
  - No text, no watermark, no signature, no grid lines.

TECHNICAL
Exactly 512 x 512 pixels. Fully opaque, no transparency.
No blur, no depth of field, no glow, no 3D render, no photorealism.
```

**`{{SUBJECT}}` 4종:**

| 스테이지 | SUBJECT |
|---|---|
| G-2 성당 | `The stone floor of a burned, abandoned cathedral, seen from directly above (top-down). Worn flagstones with faint traces of an old mosaic, a thin even layer of grey ash, soot streaks, and hairline cracks. Cold, silent, long unattended.` |
| G-3 늪 | `The ground of a plague-ridden swamp, seen from directly above (top-down). Wet dark mud, rotting waterweed, patches of shallow standing water, small gas bubbles and sunken twigs. Damp, warm, decaying.` |
| G-4 첨탑 | `The collapsed floor of a ruined stone spire, seen from directly above (top-down). Cracked flagstones, pulverized stone dust, small rubble fragments and impact scars. Dry, dusty, structurally failing.` |
| G-5 지옥문 | `The ground before an infernal gate, seen from directly above (top-down). Cooled black obsidian slabs, fine grey ash, scorch marks and dry heat-cracks. Keep every crack DARK — no glowing embers in this texture. Burnt, still, oppressive.` |

**`{{PALETTE LINES}}` 4종** (18 문서와 같은 형식 — 색상명 + 헥스):

```
G-2  Deepest shadow #0B0710 / Soot #16121C / Stone body #2A2533 / Stone light #4A4454
     Ash grey #5A5464 / Cold blue-grey #8AA0C0 / Faint mosaic teal #1E7E74
G-3  Deepest shadow #0B0710 / Mud shadow #16121C / Mud body #2A2018 / Wet mud #3A3325
     Moss dark #1E2A22 / Moss light #2F4A2A / Sickly green #6F8A5E / Still water #24302C
G-4  Deepest shadow #0B0710 / Crack shadow #16121C / Stone body #2A2533 / Stone light #4A4454
     Dust #7B7488 / Warm grey-brown #A89A86 / Pale rubble #C7C2CE
G-5  Deepest shadow #0B0710 / Obsidian #16121C / Obsidian light #2A2533 / Ash #4A4454
     Scorch brown #3A2018 / Muted ember #C06A4A   (use sparingly, never bright)
```

### 7.6 ★ 소품 시트 영어 프롬프트 템플릿

18 문서 §6 의 프롬프트를 그대로 쓰되 `PROPS TO INCLUDE` 목록만 교체한다.
**`ALSO RETURN AS TEXT` 블록(name, x, y, w, h 좌표 목록)은 반드시 유지한다** —
`GroundSystem.registerFrames()` 가 `props-*.json` 의 바운딩 박스를 Phaser 프레임으로 등록하기 때문이다.
좌표가 없으면 시트를 쓸 수 없다.

| 스테이지 | PROPS TO INCLUDE (대략 크기 / 개수) |
|---|---|
| P-2 성당 | broken pews 48x24 ×3-4 / fallen candelabra 24x40 ×2-3 / censer with chain 16x24 ×2-3 / shattered stained-glass shards 16x16 ×4-6 / stone font 32x32 ×2 / toppled column base 40x40 ×2-3 / ash piles 24x16 ×3-4 / **short** broken railing fragments 48x16 ×2 |
| P-3 늪 | dead reed clusters 24x40 ×4-6 / half-sunken log 64x24 ×2-3 / bone piles and ribcages 24x16 ×4-6 / mossy boulders 32x32 ×3-4 / bubbling gas patches 32x32 ×3 (semi-transparent) / wrecked flat-bottom boat 64x32 ×1 / rotting stump 32x32 ×2 |
| P-4 첨탑 | shattered column segments 32x48 ×3-4 / broken stair block 48x32 ×2-3 / twisted iron railing fragments 40x16 ×2-3 / rubble heaps 32x24 ×4-6 / cracked rune stone 24x32 ×2 / fallen capital (column top) 40x32 ×2 / stone dust patches 48x48 ×2 (semi-transparent) |
| P-5 지옥문 | cold iron brazier 24x40 ×2-3 / heaped chains 40x24 ×3-4 / twisted iron gate fragments 48x32 ×2-3 (**short pieces, never a continuous gate**) / sulphur crystal clusters 16x24 ×3-4 / ash mounds 32x24 ×4-6 / **glowing lava cracks 48x16 ×3-4 — these carry the only warm light in the stage** / charred skull piles 16x16 ×3 |

> ⚠ **P-5 의 `glowing lava cracks` 만 유일하게 밝게 그린다.**
> 바닥(G-5)에서 뺀 잿불을 여기로 옮긴 것이다. 게임이 시드 고정 RNG 로 흩뿌리므로
> **반복 격자가 생기지 않으면서도 "불이 지나가는 길"이 화면에 남는다.**

### 7.7 네거티브 프롬프트

18 문서 §7 을 그대로 쓴다. 스테이지별로 한 줄만 추가한다.

| 스테이지 | 추가 네거티브 |
|---|---|
| G-2 | `stained glass color, colorful light shafts, gold, candlelight glow, intact furniture` |
| G-3 | `bright green, lush vegetation, clear water, reflection, daylight` |
| G-4 | `intact wall, continuous masonry, tall structure, sky, horizon` |
| G-5 | `lava, fire, glowing crack, ember, orange light, bloom` ← **바닥 전용.** 소품 시트에는 넣지 않는다 |

### 7.8 수용 기준

**바닥 (G-2 ~ G-5 각각)**
- [ ] 정확히 512 × 512, 불투명
- [ ] ★ 2×2 로 이어 붙였을 때 이음매가 보이지 않는다 ← 자동 검증
- [ ] 반복해도 눈에 띄는 격자무늬가 생기지 않는다
- [ ] 충분히 어둡다 — 이 위의 캐릭터·투사체가 또렷하게 읽힌다
- [ ] **4장을 나란히 놓았을 때 서로 다른 장소로 읽힌다** ← 이번 의뢰의 존재 이유
- [ ] G-5 바닥에 빛나는 균열이 없다

**소품 (P-2 ~ P-5 각각)**
- [ ] 정확히 512 × 512, 배경 알파 0
- [ ] 소품끼리 겹치지 않는다 / 서 있는 소품에 발밑 그림자가 있다
- [ ] **이어지는 벽·담장·문으로 읽히는 조각이 없다**
- [ ] 좌표 목록(name, x, y, w, h)이 텍스트로 함께 왔다

### 7.9 수령 후 작업

1. `magick identify` 로 크기·알파 확인 → 2×2 이음매 자동 검증
2. `FE/public/assets/map/` 에 배치, 좌표 목록을 `props-*.json` 으로 저장
3. **`stages.json` 의 해당 스테이지 `ground.tint` 를 `16777215`(`0xFFFFFF`)로 되돌린다** ← 잊기 쉽다
4. **`FE/public/assets.json` 의 `images[]` 에 8줄을 넣는다.** ⚠ `PreloadScene.js` 는 고치지 않는다 —
   이 저장소의 규약이다(`assets.json` 머리 주석 · `32` §8 · `33` §9.2). 등록하지 않으면
   `applyGround` 가 조용히 폴백하므로 **"이미지를 넣었는데 안 바뀐다"** 가 된다

   ```json
   { "key": "ground_cathedral", "url": "assets/map/ground-cathedral.png" },
   { "key": "props_cathedral",  "url": "assets/map/props-cathedral.png"  },
   { "key": "ground_mire",      "url": "assets/map/ground-mire.png"      },
   { "key": "props_mire",       "url": "assets/map/props-mire.png"       },
   { "key": "ground_spire",     "url": "assets/map/ground-spire.png"     },
   { "key": "props_spire",      "url": "assets/map/props-spire.png"      },
   { "key": "ground_hellgate",  "url": "assets/map/ground-hellgate.png"  },
   { "key": "props_hellgate",   "url": "assets/map/props-hellgate.png"   }
   ```

   좌표 목록은 `json[]` 에 따로 4줄이 더 붙는다(`props_cathedral` 등 — `props_grave` 와 같은 모양).
5. 헤드리스로 스테이지 5종 각각 전체 조망 + 150체 스트레스 재확인
6. `npm run validate` 의 경고 8건이 **사라지는지** 확인한다. 남아 있으면 4번을 안 한 것이다

### 7.10 ★ 수령 전에 막혀 있는 곳 (2026-08-13 실측)

의뢰서는 완성돼 있다. 그런데 **그림이 와도 그대로는 §7.9 를 끝까지 돌릴 수 없다.**
막힌 곳 2개를 미리 적어 둔다 — 그림을 받고 나서 발견하면 그날 하루가 날아간다.

| # | 막힌 곳 | 무슨 일이 생기나 | 언제 고치나 |
|---|---|---|---|
| B-1 | `FE/tools/build-props.mjs` 가 `props-grave.png` **한 장을 하드코딩**한다(18~19행). 알파 연결성분으로 프레임 좌표를 뽑아 `props-grave.json` 을 만드는 스크립트인데 인자도 루프도 없다 | §7.9-2 의 "좌표 목록을 `props-*.json` 으로 저장"을 손으로 하게 된다. `props-grave.json` 은 손으로 만든 적이 없다 — 이 스크립트가 뽑았다 | 소품 시트 4장을 받는 날. 파일명을 인자로 받게 고치면 끝난다 |
| B-2 | `FE/tools/build-assets.mjs:244` 가 **존재하지 않는 `build-map.mjs`** 를 참조하는 주석을 달고 있고, 같은 파일의 `buildTiles()`(151~174행)는 정의만 있고 아무도 부르지 않는다 | 맵 파이프라인을 찾는 사람이 없는 파일을 20분 찾는다. 실제로 맵을 굽는 코드는 **저장소에 없다** — `ground-grave.png` 는 수령 후 손으로 놓았다 | 지금 당장은 아니다. 죽은 주석·죽은 함수라 동작에 영향이 없다 |

★ **stage6 은 누락이 아니다.** `stages.json:725-731` 이 의도적으로 `ground_grave` 를 쓴다
(「봉인묘 심층 — 처음 그 자리」). 의뢰 대상은 stage2~5 넷뿐이다.

★ **아트가 아예 없다는 것은 2026-08-13 에 전수 확인했다.** `asset/` · `store/_raw/` · `tools/` ·
저장소 전체 파일명에서 `cathedral` / `mire` / `spire` / `hellgate` **0건**이다.
근거표는 `18-MAP-IMAGE-PROMPT.md` §12.2 에 있다. 그래서 **절차 생성으로 흉내내지 않는다** —
같은 문서 §12.2 가 그 판단의 근거를 적었다.

---

## 8. 문서·데이터·코드 불일치 목록 (2026-08-11 실측 12건)

우선순위는 **"플레이어가 겪는 결과"** 기준이다. 파일 수정 난이도가 아니다.

| # | 항목 | 증상 | 등급 | 추정 |
|---|---|---|---|---|
| **8-1** | **BOSS6 이 어느 스테이지에도 없다** | `boss.json` 에 정의만 있고 `stages.json` 의 `bossId` 어디에도 없다. 스프라이트·아틀라스는 있다. 등장 불가 | 🟨 콘텐츠 낭비 | stage6 추가 or 삭제 |
| **8-2** | **곡선 공식이 코드와 데이터에서 다르다** (§3.4) | `Math.pow(i, exp)` vs `(t/60)^exp`. stage2~5 후반 적 HP 가 의도의 **2.2~3.2배** | 🟥 **밸런스 파탄 가능** | 판정 30분 + 재튜닝 |
| **8-3** | **mire `radius: 2`** (§4.4) | 반경 2px 웅덩이 → 감속이 사실상 발동하지 않는다. stage3 기믹 무효 | 🟥 기믹 부재 | 데이터 수정 30분 |
| **8-4** | **mire 키 이름 5개 불일치** (§4.4) | `minR/maxR/slow/chunk/perChunk` 를 읽는 코드 없음. 코드 기본값으로 굴러감 | 🟥 | 위와 동일 작업 |
| **8-5** | **mire `_note` 의 "청크 시드 고정 배치" 미구현** (§4.4) | 실제는 무작위 도넛 생성. **"외워서 대응"이라는 공정성 근거가 성립하지 않는다** | 🟨 (감속 무효라 표면화 안 됨) | 구현 3~4h or `_note` 정정 |
| **8-6** | **rockfall `windup: 0.95` 미배선** (§4.5) | 코드는 `p.telegraph` 를 읽음 → 실제 예고 0.8s. T525 는 통과하나 의도한 여유 0.15s 소실 | 🟨 | 10분 |
| **8-7** | **rockfall `countFrom/countTo` 미배선** | 후반에도 낙석이 1개씩만 떨어진다. stage4 의 "바닥을 뺏는다"가 성립 안 함 | 🟨 | 1h |
| **8-8** | **emberwind 전 파라미터 미배선 + 피해 0** (§4.6) | 데이터는 "1.1s 예고 후 불길 띠", 코드는 "26px/s 밀어내기". **피해 판정 자체가 없다** | 🟥 기믹 부재 | 신규 구현 4~6h |
| **8-9** | **BOSS5 히트박스 근사가 반대** (§5.1) | `hitbox.w/2` 규칙이 "짧은 변"을 전제하는데 BOSS5 만 가로(66) > 세로(53). 히트박스가 몸통보다 넓다 | 🟨 | 10분 |
| **8-10** | **보스 이름이 두 파일에서 다르다** (§5.6) | `boss.json` 「잿빛 성가대장」 vs `boss-atlas.json` 「재의 집행자」 외 5종 전부 | 🟨 혼선 | 30분 |
| **8-11** | **보스 애니메이션 키 하드코딩** (§5.6) | `"boss.cast"/"boss.attack"/"boss.spell"/"boss.death"` 고정. **BOSS2~6 은 시전·공격·사망 애니가 재생되지 않고, 시체는 항상 BOSS1 스프라이트** | 🟥 **연출 붕괴** | 1~2h |
| **8-12** | **`setBoss()` 가 `byPhase` 를 재구축하지 않는다** (§5.7) | 지금은 무증상(패턴 6종 동일). **보스별 패턴을 넣는 순간 발현** | 🟨 잠복 | 10분 (지금 고칠 것) |

### 8.1 추가 관찰 — 등급을 매기지 않은 것들

- **`_designNote` 의 "패턴 축" 6종이 전부 미구현**(§5.3). 불일치라기보다 **미완성**이므로 위 표에 넣지 않았다.
  다만 **문서가 이를 완료로 기술하고 있었다는 것**이 문제다. 이 문서가 그것을 정정한다.
- **BOSS2·BOSS5·BOSS6 스프라이트가 `license.gate: "blocked"` 인데 `FE/public/` 에 배포되어 있다**(§5.6).
  이건 스테이지 설계 문제가 아니라 **라이선스 사고**라 `16` 문서 §2 에서 다룬다.
- **`stages.json` 머리주석이 "스테이지 2~6" · "6 스테이지" 라고 쓰여 있지만 실제 정의는 5개다.**
  BOSS6 의 존재(8-1)와 `boss-atlas.json` 의 `stage: "stage6"` 를 보면
  **stage6 이 계획됐다가 데이터만 남고 사라진 것**으로 보인다. (추정)
- **`stages.json` 머리주석이 이 문서(`docs/26-STAGES-AND-BOSSES.md`)를 출처로 인용하고 있었다.**
  문서가 존재하기 전에 참조가 먼저 있었다. 이제 순환이 해소됐다.

---

## 9. 관련 문서

- [`03-GDD-CORE.md`](./03-GDD-CORE.md) §7.3 — 보스 페이즈·**텔레그래프 0.6초 절대 규칙** / §8 맵 규격 / §11 배율 공식
- [`05-COMBAT-AND-BALANCE.md`](./05-COMBAT-AND-BALANCE.md) §5 12구간 마스터 테이블 / §6 **BOSS HP 11,000 역산 전 과정**
- [`08-DATA-SCHEMA.md`](./08-DATA-SCHEMA.md) §3.3 — BOSS 스키마
- [`12-TASK-BACKLOG.md`](./12-TASK-BACKLOG.md) T520~T526 — 보스 구현 태스크. **T525 가 0.6초 하한의 원본 티켓**
- [`16-RISKS-AND-SCOPE-CUTS.md`](./16-RISKS-AND-SCOPE-CUTS.md) — 위 12건의 컷 판정과 보스 스프라이트 라이선스
- [`17-LICENSES-AND-CREDITS.md`](./17-LICENSES-AND-CREDITS.md) LC-07 — 미사용 보스 4팩 배포 제외
- [`18-MAP-IMAGE-PROMPT.md`](./18-MAP-IMAGE-PROMPT.md) — stage1 맵 의뢰서. **§7 이 이 문서의 형식을 승계한다**
- [`23-ITEM-SYSTEM.md`](./23-ITEM-SYSTEM.md) — 아이템 66종. **보스 HP 재역산의 입력값**
