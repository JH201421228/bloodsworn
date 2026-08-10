# 17. 라이선스 검증 & 크레딧

> **문서 지위: 실행 문서(하위) — 그러나 배포 게이트다.**
> 이 문서의 §5 판정에서 **🟥 항목이 하나라도 남아 있으면 Play 스토어에도 App Store에도 올리지 않는다.**
> 최종 수정: 2026-08-10 / 조사자: 에셋 관리
> 에셋 매핑은 `09-ART-AUDIO-AND-ASSET-MAP.md`.
>
> ★ **배포 대상이 Android + iOS 동시로 바뀌었다(2026-08-10 확정). 이 문서의 판정은 하나도 바뀌지 않는다.**
> 라이선스 의무는 **저작권자와 우리 사이의 계약**이지 스토어와의 관계가 아니기 때문이다.
> 스토어가 하나 늘어난다고 조건이 완화되지도, 새로 생기지도 않는다. **바뀌는 것은 게이트를 통과해야 할 문이 2개라는 점뿐이다.** → §4.4

---

## 0. 조사 범위와 방법

- 대상: `asset/` 전체 **7,846 파일 / 128MB** (bgm 21 / bosses 162 / character 18 / effect 273 / fonts 1 / icons 6,581 / item 7 / monsters 481 / npcs 267 / projectile 9 / tilemap 26)
- 방법:
  1. `find`로 `.txt` `.ini` `.md` `.json` `.url` `.pdf` `.html` **전수 검색** → 발견된 **9개 파일 전부 읽음** ✅
  2. PNG 메타데이터(`tEXt`/`iTXt`/`zTXt`) 스캔 → 저작자 정보 **없음** (Adobe XMP 흔적만) ✅
  3. **`base_font.woff2`를 직접 파싱**(brotli 해제 → `name` 테이블) → 폰트 정체와 라이선스를 **파일 자체에서** 확인 ✅
  4. `md5sum` 중복 검출
  5. WebSearch / WebFetch로 제작자 판매 페이지의 약관 확인

**발견된 라이선스/안내 텍스트 파일 — 이것이 전부다 (9개)** ✅

```
asset/bosses/Bringer-Of-Death/Bringer-Of-Death/Contact.txt
asset/bosses/Bringer-Of-Death/Bringer-Of-Death/License.txt
asset/bosses/EVil Wizard 2/EVil Wizard 2/License.txt
asset/bosses/FREE_Samurai 2D Pixel Art v1.2/FREE_Samurai 2D Pixel Art v1.2/License.txt
asset/bosses/MainCharacter(FreePack)/MainCharacter(FreePack)/License.txt
asset/character/FREE_Adventurer 2D Pixel Art/License.txt
asset/icons/Special Note to the Dev.txt          ← 라이선스가 아니다 (감사 인사문)
asset/projectile/desktop.ini                     ← Windows 시스템 파일
asset/tilemap/public-license.txt
```

> ⚠️ 즉 **실질적인 라이선스 원문은 6개 팩에만 존재**한다.
> `monsters`(9팩 481파일) · `effect`(273파일) · `item` · `projectile` · `npcs` · `bgm` 에는
> **라이선스 파일이 단 한 개도 동봉되어 있지 않다.** 이들은 전부 §1의 "출처 확인 필요"로 분류했다.

**표기 규약**

| 표기 | 뜻 |
|---|---|
| ✅ | 동봉 파일 원문 또는 파일 내부 메타데이터로 **직접 확인** |
| 🌐 | 제작자 판매 페이지(웹)에서 확인. 페이지는 변경될 수 있으므로 **다운로드 시점 약관과 다를 수 있음** |
| 🔶 | 근거 있는 추정 |
| ❓ | 미확인 |
| 🟩 사용 가능 / 🟨 조건부 / 🟥 **확인 필요·사용 보류** | 판정 |

---

## 1. 라이선스 전수 조사 결과표

### 1-A. 원문이 동봉된 팩 (6개) — 직접 확인 ✅

---

#### ① Bringer of Death — **보스 (MUST)**

| 항목 | 값 |
|---|---|
| 경로 | `asset/bosses/Bringer-Of-Death/` |
| 제작자 | **Clembod** (Twitter/Instagram `@Clembod`, `Clembod@gmail.com`, https://clembod.itch.io , https://www.artstation.com/clembod) ✅ `Contact.txt` |
| 근거 파일 | `asset/bosses/Bringer-Of-Death/Bringer-Of-Death/License.txt` ✅ · `.../Contact.txt` ✅ |

**원문 인용** (`License.txt` 전문)
> ```
> You can use this asset for personal and commercial purpose,
> you can modify this object to your needs.
> Credit is not required but would be appreciated
>
> You can NOT redistribute or resell it.
> ```

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | ✅ **가능** ("personal and commercial purpose") |
| 크레딧 의무 | ✅ **없음** ("not required") — 단 "would be appreciated" → **표기 권장** |
| 개변 | ✅ 가능 ("modify this object to your needs") |
| 재배포/재판매 | ❌ **금지** ("You can NOT redistribute or resell it") |
| **판정** | 🟩 **사용 가능.** 게임의 일부로 포함하는 것은 재배포가 아니다. 크레딧 표기 권장 |

---

#### ② FREE_Adventurer 2D Pixel Art — **플레이어 (MUST)**

| 항목 | 값 |
|---|---|
| 경로 | `asset/character/FREE_Adventurer 2D Pixel Art/` |
| 제작자 | **xzany** 🌐 (https://xzany.itch.io/top-down-adventurer-character — 배포 파일명이 `FREE_Adventurer 2D Pixel Art.zip`으로 일치) |
| 근거 파일 | `asset/character/FREE_Adventurer 2D Pixel Art/License.txt` ✅ |

**원문 인용** (전문)
> ```
> ##################### LICENSE #####################
>
> - You can use this asset in any game project, personal or commercial.
> - DO NOT resell or redistribute AS A GAME ASSET, it has to be part of a project.
> - Credit is not required but it is appreciated.
> - Modify to suit your needs.
> - You are NOT allowed to turn any of my assets to an NFT.
> ```

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | ✅ **가능** ("any game project, personal or commercial") |
| 크레딧 의무 | ✅ **없음** — 권장 |
| 개변 | ✅ 가능 |
| 재배포/재판매 | ❌ **"게임 에셋으로서" 금지.** 프로젝트의 일부여야 함 → 우리 사용은 적법 |
| 추가 제한 | ❌ **NFT 전환 금지** (해당 없음) |
| **판정** | 🟩 **사용 가능** |

> ⚠️ **동일 문구의 License.txt가 `asset/bosses/FREE_Samurai 2D Pixel Art v1.2/`에도 있다** ✅
> → 같은 제작자(xzany)의 다른 팩으로 판단. **Samurai는 미사용(§4.4 블랙리스트)이므로 배포에 포함하지 않는다.**

---

#### ③ Szadi art 던전 타일셋 — **타일맵 (MUST)**

| 항목 | 값 |
|---|---|
| 경로 | `asset/tilemap/` |
| 제작자 | **Szadi art** ✅ |
| 근거 파일 | `asset/tilemap/public-license.txt` ✅ |

**원문 인용** (전문)
> ```
> Artwork created by Szadi art.
>
> License for Everyone.
>
> Public domain and free to use, personal or commercial.
> Credit is not required but appreciated. You can edit,
> but not resell the asset pack (original or changed).
> ```

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | ✅ **가능** ("Public domain and free to use, personal or commercial") |
| 크레딧 의무 | ✅ **없음** — 권장 |
| 개변 | ✅ 가능 ("You can edit") |
| 재배포/재판매 | ❌ **에셋 팩 자체의 재판매 금지** (원본/개변 불문) |
| **판정** | 🟩 **사용 가능.** 가장 관대한 조건 |

---

#### ④ Evil Wizard 2 — **미사용**

| 항목 | 값 |
|---|---|
| 경로 | `asset/bosses/EVil Wizard 2/` |
| 근거 파일 | `.../License.txt` ✅ |

**원문 인용** (전문)
> ```
> This pack - Evil Wizard 2 Asset Pack is Creative Commons Zero (CC-0).
> Can be used in commercial and non-commercial projects.
> ```

| 판정 | 🟩 **CC0 — 무제한.** 상업 사용 가능, 크레딧 불필요, 재배포 가능. **단 이번 빌드에서는 미사용** |

---

#### ⑤ FREE_Samurai 2D Pixel Art v1.2 — **미사용**

`asset/bosses/FREE_Samurai 2D Pixel Art v1.2/…/License.txt` ✅ — **②와 문구 동일**(xzany).
판정 🟩 사용 가능하나 **미사용**.

---

#### ⑥ MainCharacter (FreePack) — **미사용 / ⚠️ 가장 엄격한 조건**

| 항목 | 값 |
|---|---|
| 경로 | `asset/bosses/MainCharacter(FreePack)/` |
| 제작자 | **KBPixelArt** (`kemalbaybars@hotmail.com`) ✅ |
| 근거 파일 | `.../License.txt` ✅ |

**원문 인용** (전문)
> ```
> © 2024 KBPixelArt. All rights reserved.
> These artworks and digital assets are created by KBPixelArt and protected under intellectual property laws.
> Purchasers are granted the right to modify these assets solely for use in personal or commercial projects,
> including game development. Attribution in the credits is not mandatory, but if the creator wishes to share
> or promote the game or project, I kindly ask that they credit KBPixelArt.
>
> The resale, redistribution, or sharing of these assets or unmodified/standalone derivative works is strictly prohibited.
> The use of these assets in NFTs, AI datasets, or automated content generation systems is not permitted.
>
> For permissions or inquiries, please contact: kemalbaybars@hotmail.com
> KBPixelArt Asset License v1.0 — Last updated: 2025
> ```

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | 🟨 **"Purchasers(구매자)에게" 부여** — 무료 배포분(FreePack)에도 동일 적용되는지 **문언상 불명확** |
| 크레딧 의무 | 의무 아님. 단 **홍보 시 크레딧 요청** |
| 재배포 | ❌ 금지 |
| 추가 제한 | ❌ **NFT / AI 학습 데이터셋 / 자동 생성 시스템 사용 금지** |
| **판정** | 🟨 **조건부.** 다행히 **미사용** → §4.4 블랙리스트 유지로 리스크 0 |

---

### 1-B. 라이선스 파일이 없는 팩 — **출처 확인 필요** 🟥

> ⚠️ **아래 팩들은 동봉된 라이선스 파일이 존재하지 않는다.**
> 웹에서 제작자 페이지를 찾아 약관을 확인했으나, **이는 "현재 판매 페이지의 문구"이지
> 우리가 다운로드한 시점의 라이선스임이 증명된 것은 아니다.**
> **근거 없이 "문제없음"이라고 쓰지 않는다.** 각 항목에 확인 액션(§7 `LC-xx`)을 붙였다.

---

#### ⑦ DeepDiveGameStudio Basic Asset Pack ×9 — **적 전량 (MUST)** 🟨

| 항목 | 값 |
|---|---|
| 경로 | `asset/monsters/Basic Asset Pack/`, `Basic Asset Pack (1)~(5)`, `(7)`, `basic asset pack (6)`, `(8)`, `(9)` — **총 9팩 481파일** |
| 내용 | Undead / Demon / Vermin / Dragon / Holy / Monster / Humanoid / Humanoid II / Animal / Magical 계열 각 15종 |
| **동봉 라이선스** | ❌ **없음** ✅(전수 검색 결과) |
| 추정 제작자 | **DeepDiveGameStudio** 🌐 https://deepdivegamestudio.itch.io/ — 폴더명(`Basic <계열> Animations` / `Basic <계열> Sprites`)과 스프라이트명(Mutilated Stumbler, Carcass Feeder, Skittering Hand 등)이 해당 스튜디오의 `<계열> Asset Pack [16x16]` 시리즈와 일치. 폴더명 `Basic Asset Pack` = **무료 Basic 티어** |

**웹에서 확인한 약관 요지** 🌐 (https://deepdivegamestudio.itch.io/undead-asset-pack)
> - 상업적 사용: **허용** — *"Use in commercial and non-commercial video games and personal projects."*
> - 크레딧: **불필요** — *"Attribution is not required but appreciated!"*
> - 재배포: **금지** — *"Resell, repackage or redistribute the assets in original or modified form"* 불가
> - 추가 금지: 게임 툴 / 코드 템플릿 / NFT·크립토 프로젝트에 포함 불가
> - 티어: Basic(무료) 45 스프라이트 + idle 애니 / Supporter($2+) / Premium($4+)

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | 🌐 가능 (무료 Basic 티어 포함) |
| 크레딧 의무 | 🌐 없음 — 권장 |
| 재배포 | ❌ 금지 (게임에 포함하는 것은 재배포 아님) |
| **판정** | 🟨 **조건부 — LC-01 완료 시 🟩.** 사용 방향은 안전하나 **동봉 원문이 없다는 사실 자체가 리스크**다 |

**→ 액션 `LC-01`:** 위 10개 URL을 방문해 각 페이지의 "Licence/Terms" 섹션 전문을 **스크린샷 + 텍스트로 저장**하고
`docs/licenses/deepdive-<pack>.txt` 로 보관. 확인일자를 §6 에셋 대장에 기록.
실제 사용하는 3팩(**Undead / Vermin / Demon**)만이라도 반드시 처리한다.
URL: `undead-asset-pack` · `vermin-asset-pack` · `demon-sprite-pack` · `dragon-asset-pack` · `holyassetpack` ·
`monsterassetpack` · `humanoid-asset-pack` · `humanoid2-asset-pack` · `animalassetpack` · `magical-asset-pack`
(전부 `https://deepdivegamestudio.itch.io/` 하위)

---

#### ⑧ Raven Fantasy Icons (Free) — **UI 아이콘 40개 (MUST)** 🟥 **★ 최대 리스크**

| 항목 | 값 |
|---|---|
| 경로 | `asset/icons/Free - Raven Fantasy Icons/` (6,581 파일 / 24MB) |
| 제작자 | **Clockwork Raven Studios (Caio)** ✅ — `asset/icons/Special Note to the Dev.txt` |
| **동봉 라이선스** | ❌ **없음.** 존재하는 것은 감사 인사문뿐 ✅ |

**동봉 파일 원문 인용** (`Special Note to the Dev.txt` 발췌)
> ```
> Ho ho, the title got you, huh! :)
>
> Hello, thank you for your purchase!
>
> I'm Caio, the Clockwork Raven Studios artist, owner, ...
>
> My Patreon: https://www.patreon.com/clockworkravenstudios
>
> Regards, Caio
> ```

> ⚠️ **이 파일은 라이선스가 아니다.** "thank you for your purchase"라는 문구는 유·무료 모든 티어의
> 배포물에 동일하게 들어가는 감사문이며, **구매 사실을 증명하지 않는다.**
> 그리고 우리가 가진 폴더명은 **`Free - Raven Fantasy Icons`** — 명백히 **무료 티어**다.

**웹에서 확인한 약관 요지** 🌐 (https://clockworkraven.itch.io/raven-fantasy-icons)
> - **무료(Free) 버전: "personal use" 한정.** 제작자는 personal use를
>   *"any projects or game released for free with no microtransactions and/or paid advertisement/ad"*
>   — 즉 **무료 배포 + 인앱결제 없음 + 유료 광고 없음** 프로젝트로 정의
> - **상업적 사용은 프리미엄($35 USD~) 구매자에게만** 허용
> - 크레딧: *"Attribution is not necessary but welcome."*
> - 재배포/재판매: **금지** — 별도 제품으로 배포·판매 불가
> - 무료 버전 수록량: 약 2,000개 (전체 8,000+ 중)

| 판정 항목 | 결과 |
|---|---|
| 상업적 사용 | 🟥 **무료 티어로는 불가.** "무료 배포 + IAP 없음 + 유료 광고 없음"일 때만 허용 |
| 크레딧 의무 | 없음 — 권장 |
| 재배포 | ❌ 금지 |
| **판정** | 🟥 **확인 필요 / 사용 보류.** BLOODSWORN의 **수익화 방침이 확정되기 전에는 이 팩에 의존하는 설계를 굳히면 안 된다** |

**→ 액션 `LC-02` (최우선, Day 1):** 아래 셋 중 하나를 **즉시 결정**한다.

| 선택지 | 조건 | 비용 | 결과 |
|---|---|---|---|
| **A. 완전 무료 출시** | Play 스토어에 **광고 0 · 인앱결제 0**으로 등록. 향후에도 넣지 않음 | 0원 | 🟩 무료 티어 약관 충족. **7일 스코프에 가장 잘 맞음** ★ 권고 |
| **B. 프리미엄 구매** | https://clockworkraven.itch.io/raven-fantasy-icons 에서 $35+ 결제 | 약 $35 | 🟩 상업 사용·수익화 전면 허용. 8,000+ 아이콘 확보 |
| **C. 아이콘 자체 제작** | 40개를 Codex 생성으로 대체 (`15-IMAGE-PROMPTS-FOR-CODEX.md`) | 시간 4~6h | 🟩 리스크 0. 단 Day 5 이후 착수는 위험 |

> **권고: A.** 정본 `01-CONCEPT-AND-STORY.md` 어디에도 수익화 계획이 없고,
> 7일 1인 프로젝트의 목표는 "출시 경험"이지 "수익"이 아니다.
> **단, A를 택하면 Play 콘솔 등록 시 "이 앱에 광고 포함" = 아니오, 인앱 상품 = 없음 을 반드시 유지**해야 하며,
> **나중에 광고를 붙이는 순간 라이선스 위반이 된다.** 이 사실을 `16-RISKS-AND-SCOPE-CUTS.md`에도 기록할 것.
>
> **추가 완화 조치(A/B 무관하게 실행):** `09-…-ASSET-MAP.md` §4.2 P3대로
> **실제 사용하는 40칸만 뽑아 256×48 시트로 재포장**하고, 6,581개 원본은 배포에 포함하지 않는다.
> "필요 최소한만 사용"은 어떤 분쟁에서도 유리한 사실관계다.

---

#### ⑨ 이펙트 팩 (Part 16~36) — **VFX 전량 (MUST)** 🟥

| 항목 | 값 |
|---|---|
| 경로 | `asset/effect/Free/Part 16` ~ `Part 36` (273 파일 / **66MB**) |
| 구성 | 파트당 PNG 12장 + `Preview NN Free.gif` 1장. 프레임 64×64, 세로 9행 = 9 컬러 배리언트 ✅ |
| **동봉 라이선스** | ❌ **없음** ✅ |
| PNG 메타데이터 | 저작자 정보 **없음** ✅ |
| 추정 제작자 | 🔶 **미확정.** 유력 후보 **BDragon1727** (https://bdragon1727.itch.io/ — `64x64 Pixel Effect RPG Part N` 시리즈, `1050 RPG Effects 64x64` 컬렉션 운영). **단 해당 시리즈는 Part 1~21까지만 확인되어 우리 폴더(Part 16~36)와 범위가 어긋난다** → 다른 제작자이거나 다른 시리즈일 가능성이 있음 |

**BDragon1727 계열이라면 예상되는 조건** 🌐 (검색 결과 요지 — **우리 팩에 적용된다는 증거 없음**)
> 비상업 게임에는 무료. **상업 게임에 쓸 경우 제작자에게 임의 금액을 기여(contribute)해 달라**는 요청.
> 크레딧은 필수 아님, 권장.

| 판정 | 🟥 **확인 필요 / 사용 보류 판정.** 제작자조차 확정되지 않았다 |

**→ 액션 `LC-03` (최우선, Day 1~2):**
1. **다운로드 이력을 먼저 뒤진다.** itch.io 계정의 *My Library*(https://itch.io/my-purchases) / 브라우저 다운로드 기록 /
   원본 ZIP 파일명(`... Free.zip` 등)을 확인하면 **한 번에 특정된다.** ← 가장 빠른 경로
2. 특정되면 해당 페이지의 약관 전문을 `docs/licenses/effect-pack.txt`로 저장
3. **특정 실패 시 대체안:**
   - 대체 A: **BDragon1727의 확인된 무료 팩으로 교체** (같은 64×64 규격이라 §4의 파이프라인 그대로 사용 가능)
   - 대체 B: `asset/bosses/EVil Wizard 2/`가 **CC0**이므로 그 이펙트 프레임을 유용 (제한적)
   - 대체 C: **코드 파티클로 대체** — 참격은 `Graphics` 부채꼴 + alpha 페이드, 충격파는 확대 원. 정본 스코프상 충분히 가능
4. **결론이 나기 전에는 이펙트 8종을 `FE/public/`에 복사하지 않는다.**

---

#### ⑩ 투사체 팩 (All_Fire_Bullet_Pixel_16x16) — **W2 화염탄 (MUST)** 🟥

| 항목 | 값 |
|---|---|
| 경로 | `asset/projectile/` (PNG 8장 640×400 + `desktop.ini`) |
| **동봉 라이선스** | ❌ **없음** ✅ |
| 단서 | `desktop.ini` 내용: `LocalizedResourceName=@New_All_Fire_Bullet_Pixel_16x16,0` ✅ → 원본 폴더명이 **`New_All_Fire_Bullet_Pixel_16x16`** 이었음 |
| 추정 제작자 | 🔶 **BDragon1727** — `Fire Pixel Bullet 16x16` (https://bdragon1727.itch.io/fire-pixel-bullet-16x16) 와 명명 규칙이 매우 유사 |
| **판정** | 🟥 **확인 필요** |

**→ 액션 `LC-04`:** ⑨와 함께 처리. 대체안: **W2 투사체를 코드로 그린다** — 4px 원 `EMBER #FF6B4A` + `ADD` 글로우 + 꼬리 파티클 3개.
정본 §2.2의 화면 스케일에서 16×16 스프라이트와 시각적 차이가 거의 없다. **리스크 대비 대체 비용이 가장 낮은 항목이다.**

---

#### ⑪ 아이템 아이콘 (pixel items0~6) — **미사용** 🟥

| 항목 | 값 |
|---|---|
| 경로 | `asset/item/` (256×256 PNG 7장, 32×32 격자 = 448종 🔶) |
| **동봉 라이선스** | ❌ 없음 ✅ / 제작자 단서 **전무** (파일명 `pixel items0.png` … 검색 특정 불가) |
| **판정** | 🟥 **확인 불가. 미사용이므로 §4.4 블랙리스트 유지 → 리스크 0** |

**→ 액션 `LC-05`:** 사용하지 않는다. 사용하고 싶어지면 **출처를 먼저 특정**한다.

---

#### ⑫ Lively NPCs v3.1 — **미사용** 🟨

| 항목 | 값 |
|---|---|
| 경로 | `asset/npcs/Lively_NPCs_v3.1/` (267 파일 / 5MB) |
| **동봉 라이선스** | ❌ 없음 ✅ |
| 추정 제작자 | **chierit** 🌐 https://chierit.itch.io/lively-npcs (폴더 구성 `medieval` / `steampunk` / `elementals`, 버전 v3.x가 일치) |
| 웹 확인 요지 | 🌐 **CC-BY 4.0** — 상업 사용 가능하나 **크레딧 표기 의무 있음** |
| **판정** | 🟨 **조건부 (크레딧 의무).** 정본에 NPC가 없어 **미사용** → §4.4 블랙리스트 유지 |

**→ 액션 `LC-06`:** 사용하지 않는다. 만약 쓰게 되면 **크레딧 화면에 반드시 표기**(CC-BY는 의무).

---

#### ⑬ 미사용 보스 팩 (Necromancer / NightBorne / Undead executioner / Mecha-stone Golem) 🟥

| 팩 | 경로 | 동봉 라이선스 | 판정 |
|---|---|---|---|
| Necromancer | `asset/bosses/Necromancer_creativekind-Sheet.png` (2720×896) | ❌ 없음 ✅ | 🟥 파일명에 **`creativekind`** 포함 → 제작자 단서 🔶. **미사용** |
| NightBorne | `asset/bosses/NightBorne/` (PNG 1 + GIF 5) | ❌ 없음 ✅ | 🟥 널리 배포된 무료 에셋이나 **동봉 근거 없음**. 정본 §5.4에서 **컷 후보 1순위** |
| Undead executioner | `asset/bosses/Undead executioner/` | ❌ 없음 ✅ | 🟥 **미사용** |
| Mecha-stone Golem 0.1 | `asset/bosses/Mecha-stone Golem 0.1/` | ❌ 없음 ✅ | 🟥 **미사용** |

**→ 액션 `LC-07`:** 4팩 모두 **`FE/public/`에 복사하지 않는다.**
NightBorne을 스테이지 2 보스로 쓰고 싶다면 **먼저 출처를 특정하고 약관을 저장한 뒤** 결정한다.
정본이 이미 "컷 후보 1순위"로 지정했으므로 **자르는 것이 라이선스·일정 양쪽에서 이득**이다.

---

## 2. BGM 라이선스

### 2.1 사실

| 항목 | 값 |
|---|---|
| 경로 | `asset/bgm/` — **21 파일 / 27.5MB / 전부 256kbps MP3** ✅ |
| **동봉 라이선스** | ❌ **없음** ✅ |
| 중복 | `ncprime-cinematic-background-293547.mp3` = `291979.mp3`, `soundreality-cinematic-percussion-471495 (1).mp3` = `471495.mp3` (**md5 동일** ✅) → 유니크 19곡 |

### 2.2 출처 추정 — **Pixabay Audio** 🔶

파일명 패턴이 Pixabay 다운로드 규칙과 일치한다:

```
<업로더명>-<트랙 슬러그>-<숫자 ID>.mp3
  universfield-atmospheric-cinematic-soundscape-152493.mp3
  soundreality-cinematic-percussion-471495.mp3
  ncprime-noncopyright-music-pianos-295174.mp3
  5xbeatz-percussion-loop-118-bpm-free-385692.mp3
  grand_project-deep-epic-cinematic-when-time-collapses_outro-501526.mp3
  11325622-epic-strings-intro-239971.mp3      ← 업로더명이 숫자 ID인 케이스
```

`universfield`, `SoundReality`, `NCPrime`, `5xBeatz`, `AudioKnap`, `SimpleSound`, `Grand_Project`,
`Dragon-Studio`, `niteshnaagodiya` 는 **Pixabay에서 활동이 확인되는 업로더 계정명 형식**이다.
말미 6자리 숫자는 Pixabay의 트랙 ID 자릿수와 일치한다.

> ⚠️ **이것은 추정이다.** 파일명만으로는 출처를 증명할 수 없다.

### 2.3 Pixabay Content License 조건 (웹 확인) 🌐

https://pixabay.com/service/terms/ 및 Pixabay 공식 블로그 확인 결과:

| 항목 | 조건 |
|---|---|
| 사용권 | **철회 불가·전 세계·비독점·로열티 프리** 권리를 부여 — 다운로드·복제·수정·개작 가능 |
| **상업적 사용** | ✅ **가능** ("for commercial or non-commercial purposes") |
| **크레딧** | ✅ **불필요** ("Attribution of the … musician or Pixabay is not required but is always appreciated") |
| **재판매/단독 배포** | ❌ **금지** — 콘텐츠를 **추가 요소 없이, 실질적으로 동일한 형태로** 판매·배포하는 것 불가 (포스터·디지털 프린트·**음원 파일** 등) |
| 우리 케이스 | 게임의 BGM으로 편입 = **"고유한 창작물의 일부"** → 허용 범위 |

> ⚠️ **주의:** Pixabay는 2022년 1월에 라이선스 체계를 개편했다(그 이전은 CC0).
> 다운로드 시점이 언제냐에 따라 적용 라이선스가 다를 수 있다. 다만 **양쪽 모두 상업 사용·크레딧 불요**이므로 결론은 같다.

### 2.4 판정 & 액션

| 판정 | 🟨 **조건부 — LC-08 완료 시 🟩** |

**→ 액션 `LC-08` (Day 2, 40분):**
1. https://pixabay.com/music/search/ 에서 **실제로 배포하는 13곡**(`09-…-ASSET-MAP.md` §5)의 트랙 ID로 검색해
   페이지 존재를 확인하고 **URL + 업로더명 + 라이선스 표기**를 §6 에셋 대장에 기록
   예: `soundreality-cinematic-percussion-471495` → Pixabay 트랙 ID `471495` 조회
2. Pixabay에 없는 곡이 나오면 **그 곡만 즉시 제외**하고 다른 곡으로 대체 (19곡 중 13곡만 쓰므로 여유가 있다)
3. 확인한 라이선스 전문을 `docs/licenses/pixabay-content-license.txt`로 저장 (확인일자 명기)
4. **재인코딩(96kbps OGG/M4A)은 "수정"에 해당하나 Pixabay 라이선스가 명시적으로 허용**한다 ("modify or adapt")

---

## 3. 폰트 라이선스 — **완전 해결됨** 🟩

### 3.1 정체 규명 (파일 내부에서 직접 확인) ✅

`asset/fonts/base_font.woff2` (98,252 B)를 **직접 파싱**했다.
(WOFF2 헤더 → 테이블 디렉터리 → brotli 해제 → `name` 테이블 파싱)

| 항목 | 값 | 근거 |
|---|---|---|
| **폰트명** | **Mulmaru Mono / 물마루 Mono** | `name` ID 1·4 ✅ |
| **제작자** | **Mushsooni** | `name` ID 0 ✅ |
| **저작권** | `Copyright (c) 2025, Mushsooni (https://github.com/mushsooni/mulmaru)` | `name` ID 0 ✅ |
| **라이선스** | **SIL Open Font License, Version 1.1** | `name` ID 13 ✅ |
| 한국어 라이선스 고지 | *"이 폰트 소프트웨어는 SIL 오픈 폰트 라이선스 1.1에 따라 사용이 허가됩니다."* | `name` ID 13 (pid3, 한국어) ✅ |
| 버전 | 1.0 | `name` ID 5 ✅ |
| **Reserved Font Name** | **없음** (저작권 문자열에 "with Reserved Font Name" 문구 부재) ✅ | → 개변 시 이름 변경 의무 없음 |
| 커버 | **한글 완성형 11,172자 전량** + 라틴 + 그리스 + 키릴 + 가나. 총 11,965 코드포인트 ✅ | `cmap` 파싱 ✅ |

**원문 인용** (`name` ID 13, 발췌)
> ```
> This Font Software is licensed under the SIL Open Font License, Version 1.1.
> This license is copied below, and is also available with a FAQ at:
> http://scripts.sil.org/OFL
> ```

### 3.2 SIL OFL 1.1 의무 사항

| 항목 | 결과 |
|---|---|
| 상업적 사용 | ✅ **가능** (게임 임베딩 포함) |
| 크레딧 | 🟨 **표기 자체는 의무 아님.** 다만 **폰트 파일을 재배포할 때는 저작권 고지와 라이선스 전문을 동봉해야 함** |
| **웹 임베딩(woff2)** | ✅ 가능 — 이것이 OFL의 핵심 허용 사항 |
| 개변 | ✅ 가능 (RFN 없으므로 이름 유지 가능) |
| **금지** | ❌ **폰트 자체를 단독 판매하는 것** |
| 재배포 시 의무 | **라이선스 전문(OFL.txt)을 반드시 함께 배포** |

> ✅ **우리 케이스:** 게임 웹 자산으로 woff2를 배포하는 것은 OFL이 명시적으로 허용하는 사용이다.
> 다만 `FE/public/assets/fonts/` 옆에 **`OFL.txt`를 함께 두는 것이 안전**하다(사실상 "전문 동봉" 요건 충족).

**→ 액션 `LC-09` (Day 1, 10분):**
1. https://github.com/mushsooni/mulmaru 에서 **`OFL.txt` 원문을 받아** `FE/public/assets/fonts/OFL.txt`로 저장
2. 크레딧 화면(§5)에 Mulmaru Mono / Mushsooni / OFL 1.1 을 표기 (의무는 아니나 명확성 확보)
3. 배포하는 woff2가 **서브셋인지 원본인지** 확인 — 원본 sfnt 1.58MB가 woff2 98KB로 압축된 것이며
   한글 11,172자 전량이 살아 있으므로 **서브셋이 아니라 원본 압축본**이다 ✅ (추가 조치 불필요)

### 3.3 대체 폰트 후보 (Mulmaru를 못 쓰게 될 경우)

Mulmaru가 OFL로 확정되었으므로 **대체는 불필요**하다. 아래는 비상용 조사 결과다.

| 폰트 | 배포처 | 라이선스 | 픽셀 여부 | 한글 | 비고 |
|---|---|---|---|---|---|
| **Galmuri (갈무리) 7/9/11** | https://quiple.dev/font/galmuri | **SIL OFL 1.1** 🌐 | ✅ 픽셀 | ✅ | 닌텐도 DS 폰트에서 영감. **가장 유력한 대체.** Mulmaru가 "Galmuri11과 크기가 비슷"하다고 제작자가 언급 → 교체 시 레이아웃 충격 최소 ★ |
| **둥근모꼴+ Fixedsys** | 눈누 https://noonnu.cc/font_page/250 | **퍼블릭 도메인** 🌐 | ✅ 픽셀(비트맵 유래) | ✅ | 라이선스가 가장 자유로움 |
| **Pretendard** | https://github.com/orioncactus/pretendard | **SIL OFL** 🌐 | ❌ 픽셀 아님 | ✅ | UI용 산세리프. **픽셀 톤이 깨지므로 게임 본문에는 부적합**. React 레이어 보조용 정도 |
| (참고) NeoDunggeunmo | — | ❓ 미확인 | ✅ | ✅ | 검색으로 라이선스 확정 못함. **쓰지 않는다** |

> **비상 교체 절차:** Galmuri11 woff2로 교체 → `index.css`의 `src` 경로와 `font-family`만 수정 →
> `09-…-ASSET-MAP.md` §8.3의 12px 규칙 그대로 적용. **작업 30분 이내.**

---

## 4. 스토어 배포 리스크 판정

### 4.1 리스크 매트릭스

| # | 리스크 | 대상 | 발생 확률 | 영향 | 종합 |
|---|---|---|---|---|---|
| **R1** | **Raven 아이콘 무료 티어를 수익화 앱에 사용** — 라이선스 위반 | `icons` (MUST 경로) | **수익화 시 100%** | 🔴 제작자 신고 → **앱 내림** 가능 | 🟥 **최고** |
| **R2** | **출처 불명 이펙트 팩** — 실제 조건이 "상업 사용 시 기여 필요"이거나 더 엄격할 수 있음 | `effect` (MUST 경로) | 중 | 🔴 DMCA 신고 시 앱 내림 | 🟥 **높음** |
| **R3** | **출처 불명 투사체 팩** | `projectile` (MUST 경로) | 중 | 🟠 대체 가능 | 🟨 중 |
| **R4** | DeepDive 몬스터 팩 — 조건 자체는 안전하나 **동봉 원문 부재** | `monsters` (MUST 경로) | 낮음 | 🟠 소명 자료 부족 | 🟨 중 |
| **R5** | BGM 출처가 Pixabay가 아닐 경우 | `bgm` | 낮음 | 🔴 음원은 저작권 신고가 특히 활발 | 🟨 중 |
| **R6** | 미사용 팩(NPC/보스 7종/아이템)을 **실수로 배포에 포함** | 여러 | 중 | 🟠 불필요한 노출 | 🟨 중 |
| **R7** | 크레딧 화면 미구현 | 전체 | — | 🟠 CC-BY 계열 사용 시 즉시 위반 | 🟨 중 |
| **R8** | 폰트 | `fonts` | — | — | 🟩 **해결됨** |

### 4.2 ★ 7일 안에 안전하게 배포하기 위한 최소 조치 (6가지)

> **아래 6가지를 전부 하면 배포 가능하다. 하나라도 빠지면 배포하지 않는다.**

| # | 조치 | 소요 | 마감 |
|---|---|---|---|
| **M1** | **수익화 방침 확정 — "광고 없음 · 인앱결제 없음"으로 출시**하고 **Play 콘솔과 App Store Connect 양쪽에** 그렇게 신고한다. (또는 Raven 프리미엄 $35 구매) | 10분 | **Day 1** |
| **M2** | **크레딧 화면 구현** (§5의 문안 그대로). 타이틀 → "크레딧" 버튼 1개, React 1화면. **필수 구현** | 40분 | Day 6 |
| **M3** | **출처 불명 에셋 판정 완료** — `LC-03`(effect) / `LC-04`(projectile). 특정 실패 시 **대체안 실행**(코드 파티클) | 2h | **Day 2** |
| **M4** | **배포 화이트리스트 강제** — `FE/tools/build-assets.mjs`의 MANIFEST에 명시된 파일만 `FE/public/assets/`로 복사. `asset/` 폴더를 통째로 복사하는 명령은 금지 | (M3에 포함) | Day 2 |
| **M5** | **`docs/licenses/` 폴더에 근거 보관** — 동봉 License.txt 6개 사본 + 웹 확인 스크린샷/텍스트 + `OFL.txt`. **신고 대응 시 이것만이 방어 수단이다** | 30분 | Day 6 |
| **M6** | **에셋 대장(§6) 작성 완료** — 실제 배포하는 모든 파일의 출처·라이선스·확인일 기록 | 30분 | Day 6 |

### 4.3 출처 불명 에셋 — 대체/제외 판단 기준

```
출처가 특정되지 않은 에셋을 만나면, 순서대로 판단한다.

Q1. 다운로드 이력(itch.io My Library / 브라우저 기록 / 원본 ZIP)으로 특정 가능한가?
    YES → 약관 저장 후 사용. 끝.
    NO  → Q2

Q2. 그 에셋이 MUST 경로인가?
    NO  → 즉시 배포에서 제외한다. (npcs, item, 미사용 보스 7종이 여기)
    YES → Q3

Q3. 코드(Graphics/파티클)로 대체하는 데 2시간 이내인가?
    YES → 대체한다.  (projectile → 원+글로우, effect 일부 → 부채꼴/확대원)
    NO  → Q4

Q4. 라이선스가 확실한 무료 대체 에셋을 1시간 안에 찾을 수 있는가?
    YES → 교체한다. (CC0: Kenney / OpenGameArt CC0 필터 / itch.io "CC0" 태그)
    NO  → 그 기능을 스코프에서 자른다.  ← 마지막 수단. 정본 §3.1의 "7일 방어선" 정신
```

> **원칙: "아마 괜찮을 것"으로 출시하지 않는다.**
> 개인 개발자에게 라이선스 분쟁은 금전 손해보다 **앱이 내려가고 계정에 경고가 쌓이는 것**이 훨씬 아프다.
> 대체 비용이 2시간이라면 **무조건 대체가 이득**이다.

### 4.4 ★ Apple App Store 추가 요건 (2026-08-10 신설)

배포 대상이 **Android + iOS 동시**가 되면서 추가로 확인해야 할 것을 정리한다.
**결론부터: §1~§3의 라이선스 판정과 §5 크레딧 문안은 한 글자도 바뀌지 않는다.**

| 항목 | Play (Android) | App Store (iOS) | 판정 |
|---|---|---|---|
| **크레딧 표기 의무** (CC-BY, SIL OFL 등) | 필요 | **똑같이 필요** | 🟩 **동일.** §5 크레딧 화면 1벌로 양쪽을 모두 충족한다 |
| **OFL 원문 동봉** (LC-09) | 앱 번들에 `OFL.txt` 포함 | **똑같이 필요** | 🟩 동일. `FE/public/assets/fonts/`는 **양 플랫폼이 같은 `dist/`를 쓰므로 자동으로 함께 들어간다** |
| **Raven 무료 티어 조건** (LC-02) | "무료 배포 + IAP·유료광고 없음" | **똑같이 적용** | 🟩 동일. 제작자 약관은 **수익화 여부**를 조건으로 걸지 스토어를 가리지 않는다 |
| **수익화 신고** | Play 콘솔 | **App Store Connect** | 🟨 **신고할 곳이 2곳으로 늘었다.** 두 신고가 서로 달라지면 안 된다 (LC-12) |
| **저작권 침해 신고 창구** | Google Play 신고 | **Apple에도 별도 창구가 있다** | 🟨 **위험 표면이 2배가 된다.** 한쪽에서 내려가도 다른 쪽이 남지만, 근거 자료(M5)는 한 벌로 양쪽 방어에 쓴다 |
| **연령 등급** | IARC 설문 | **Apple 자체 설문**(2025년 개편: 4+/9+/13+/16+/18+) | 🟨 **양쪽 다 응답해야 한다.** 예상 등급과 문항 답은 `02-MARKET-RESEARCH.md` §3.5 |

**★ 이 문서 관점에서 가장 중요한 한 가지**

> **크레딧 화면(LC-11 / M2)의 우선순위는 iOS 추가로 더 올라간다.**
> 이유는 의무가 바뀌어서가 아니라 **출고 지점이 2개가 되었기 때문**이다.
> 크레딧이 빠진 빌드가 하나라도 나가면 위반이고, 이제 그 빌드가 나갈 수 있는 문이 두 개다.
> 크레딧은 **웹 코드(React 1화면)로 구현되므로 양 플랫폼이 같은 `dist/`를 공유**한다 —
> **한 번 만들면 양쪽이 동시에 해결된다.** 반대로 안 만들면 **양쪽이 동시에 위반**이다.

**iOS라서 새로 생기는 라이선스 리스크는 없다**

- 네이티브 코드를 추가하지 않는다 → 새 서드파티 라이브러리가 없다 → 새 라이선스가 없다.
- ⚠ 단 **CocoaPods로 들어오는 Capacitor iOS 런타임 자체의 라이선스 표기 의무**는 이 조사 범위 밖이다
  → ⚠ 확인 필요(2026-08-10 기준 미확인). Capacitor는 MIT 계열로 알려져 있으나 **이 문서는 직접 확인한 것만 사실로 적는다.**
  실제 `pod install`이 성공한 뒤 `ios/App/Pods/` 아래 라이선스 파일을 전수 확인하고 여기에 기록할 것.
- ⚠ **App Store Review Guidelines의 지식재산권 조항(5.2 계열)** 원문은 확인하지 않았다
  → ⚠ 확인 필요(2026-08-10 기준 미확인). 다만 **우리 조치(M1~M6)는 "권리 없는 에셋을 아예 배포하지 않는다"**이므로
  조항 문구와 무관하게 방어된다. 조항을 읽어야만 통과하는 종류의 리스크가 아니다.

---

## 5. 크레딧 화면 문안 (초안)

**구현:** React 1화면. 타이틀 화면 우하단 "CREDITS" 버튼 → 세로 스크롤. 폰트 12px, 색 `BONE #D8CFC0`,
제목만 `GOLD #E8B44C`. 스크롤 자동(20px/s) + 드래그 가능. 하단에 "닫기".

> ⚠️ **아래는 초안이다.** `LC-01`~`LC-08` 확인 결과에 따라 **항목이 추가/삭제된다.**
> 특히 🟥 판정 항목은 확인 완료 전까지 **실제 크레딧에 넣지 말 것**(사용하지 않을 수도 있으므로).

```
════════════════════════════════════════
        B L O O D S W O R N
            피 의  서 약
════════════════════════════════════════

  개발 · 기획 · 디자인
    (개발자명)

  ────────────────────────────────
  ART ASSETS
  ────────────────────────────────

  플레이어 캐릭터
    Adventurer 2D Top-Down
    by xzany
    https://xzany.itch.io/top-down-adventurer-character

  적 스프라이트
    Undead / Vermin / Demon Asset Pack [16x16]
    by DeepDiveGameStudio
    https://deepdivegamestudio.itch.io

  보스 「여명의 처형인」
    Bringer of Death
    by Clembod
    https://clembod.itch.io

  배경 타일셋
    Dungeon Tileset
    by Szadi art
    https://szadiart.itch.io

  UI 아이콘
    Raven Fantasy Icons
    by Clockwork Raven Studios (Caio)
    https://clockworkraven.itch.io/raven-fantasy-icons

  이펙트                                    ← LC-03 확인 후 확정
    (제작자명)
    (URL)

  ────────────────────────────────
  AUDIO
  ────────────────────────────────

  배경음악                                  ← LC-08 확인 후 확정
    universfield / SoundReality / NCPrime /
    5xBeatz / AudioKnap / SimpleSound /
    Grand_Project / Dragon-Studio
    via Pixabay  ·  https://pixabay.com

  효과음
    절차적 생성 (WebAudio API)
    by (개발자명)
  [ Kenney SFX 사용 시 추가 ]
    Interface Sounds / UI Audio
    by Kenney  ·  CC0
    https://kenney.nl

  ────────────────────────────────
  FONT
  ────────────────────────────────

  물마루 Mono (Mulmaru Mono)
    by Mushsooni
    SIL Open Font License 1.1
    https://github.com/mushsooni/mulmaru

  ────────────────────────────────
  ENGINE & TOOLS
  ────────────────────────────────

  Phaser 3.90        https://phaser.io
  React 19           https://react.dev
  Capacitor 7        https://capacitorjs.com
  Vite 7             https://vite.dev
  Zustand 5

  ────────────────────────────────

  모든 축복에는 대가가 따른다.

  © 2026 (개발자명 / 팀명)
  Made in 7 days.

════════════════════════════════════════
```

**표기 형식 규칙**

| 규칙 | 내용 |
|---|---|
| C1 | **`팩 이름` / `by 제작자명` / `URL`** 3줄 세트로 통일 |
| C2 | CC0/OFL 등 **라이선스명이 의무이거나 유의미할 때만** 병기 (예: Kenney CC0, Mulmaru OFL 1.1) |
| C3 | **CC-BY 계열은 크레딧이 법적 의무**다. 해당 에셋을 쓰면 **반드시** 넣는다 (현재는 Lively NPCs만 해당 → 미사용) |
| C4 | URL은 **제작자 페이지 또는 팩 페이지**. 다운로드 직링크 금지 |
| C5 | 사용하지 않은 팩은 **넣지 않는다** (허위 표기가 된다) |
| C6 | 오프라인에서도 읽히도록 **텍스트로 표시**한다. 링크는 `Browser.open()`(Capacitor)으로 열되, 텍스트도 함께 노출 |

---

## 6. 에셋 대장 (Asset Ledger)

> **앞으로 에셋을 추가할 때마다 이 표에 한 줄을 추가한다. 예외 없다.**
> 파일 위치: `docs/licenses/asset-ledger.md` (또는 이 문서의 이 절을 계속 갱신)
> 이 대장이 **분쟁 시 유일한 방어 자료**다.

### 6.1 템플릿

| # | 파일/팩 이름 | 배포 경로 (`FE/public/assets/…`) | 제작자 | 출처 URL | 라이선스 | 상업 | 크레딧 의무 | 다운로드일 | **확인일** | 근거 파일 | 사용처 | 판정 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | (팩명) | (경로) | (제작자) | (URL) | (라이선스명) | ✅/❌ | ✅/❌ | YYYY-MM-DD | YYYY-MM-DD | `docs/licenses/xxx.txt` | (게임 요소) | 🟩/🟨/🟥 |

### 6.2 현재 기록 (2026-08-10 시점)

| # | 팩 | 배포 경로 | 제작자 | 출처 URL | 라이선스 | 상업 | 크레딧 | DL일 | 확인일 | 근거 | 사용처 | 판정 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Adventurer 2D Top-Down | `player/` | xzany | https://xzany.itch.io/top-down-adventurer-character 🌐 | 독자(무료, 상업 가능) | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 `License.txt` ✅ | 플레이어 16장 | 🟩 |
| 2 | Bringer of Death | `boss/bringer.png` | Clembod | https://clembod.itch.io ✅ | 독자(무료, 상업 가능) | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 `License.txt`·`Contact.txt` ✅ | 보스 | 🟩 |
| 3 | Dungeon Tileset | `tiles/`, `props/` | Szadi art | ❓(itch.io 추정) | Public domain | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 `public-license.txt` ✅ | 타일·촛불·횃불·가시·상자 | 🟩 |
| 4 | Mulmaru Mono | `fonts/base-font.woff2` | Mushsooni | https://github.com/mushsooni/mulmaru ✅ | **SIL OFL 1.1** | ✅ | ❌(전문 동봉 필요) | ❓ | 2026-08-10 | **폰트 `name` 테이블 ✅** | 전 텍스트 | 🟩 (LC-09 후 완결) |
| 5 | Undead/Vermin/Demon Asset Pack [16x16] | `enemies/enemies.png` | DeepDiveGameStudio | https://deepdivegamestudio.itch.io 🌐 | 독자(무료 Basic, 상업 가능) | 🌐✅ | 🌐❌ | ❓ | 2026-08-10 | **동봉 없음** / 웹 🌐 | 적 E1~E8, EL1~EL2 | 🟨 **LC-01** |
| 6 | Raven Fantasy Icons (**Free**) | `ui/icons.png` | Clockwork Raven Studios | https://clockworkraven.itch.io/raven-fantasy-icons 🌐 | 독자 — **무료판은 비수익 프로젝트 한정** | 🟥 조건부 | ❌ | ❓ | 2026-08-10 | 동봉 없음(감사문뿐) / 웹 🌐 | UI 아이콘 40 | 🟥 **LC-02** |
| 7 | 이펙트 팩 (Part 16~36) | `fx/*` | **❓ 미확정** (BDragon1727 후보 🔶) | ❓ | ❓ | ❓ | ❓ | ❓ | — | **없음** | W1/W2/W4/W5, 각성 충격파 | 🟥 **LC-03** |
| 8 | Fire Bullet 16x16 | `fx/fx-bullet.png` | **❓ 미확정** (BDragon1727 후보 🔶) | ❓ | ❓ | ❓ | ❓ | ❓ | — | **없음** (`desktop.ini` 단서만) | W2 투사체 | 🟥 **LC-04** |
| 9 | BGM 13곡 | `audio/bgm/*` | universfield 외 8인 | https://pixabay.com 🔶 | **Pixabay Content License** 🌐 | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 없음 / 웹 🌐 | 전 BGM | 🟨 **LC-08** |
| 10 | (SFX) 절차적 생성 | — | 본 프로젝트 | — | 자체 제작 | ✅ | — | — | — | `FE/src/game/audio/Sfx.js` | SFX 12종 | 🟩 |
| — | *(미사용)* Lively NPCs v3.1 | — | chierit 🌐 | https://chierit.itch.io/lively-npcs | **CC-BY 4.0** 🌐 | ✅ | **✅ 의무** | ❓ | 2026-08-10 | 동봉 없음 / 웹 🌐 | **미사용** | 🟨 **LC-06** |
| — | *(미사용)* Evil Wizard 2 | — | ❓ | ❓ | **CC0** ✅ | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 `License.txt` ✅ | **미사용** | 🟩 |
| — | *(미사용)* FREE_Samurai v1.2 | — | xzany 🔶 | ❓ | 독자(②와 동일) | ✅ | ❌ | ❓ | 2026-08-10 | 동봉 `License.txt` ✅ | **미사용** | 🟩 |
| — | *(미사용)* MainCharacter(FreePack) | — | KBPixelArt | ❓ | KBPixelArt v1.0 | 🟨 | ❌ | ❓ | 2026-08-10 | 동봉 `License.txt` ✅ | **미사용** | 🟨 |
| — | *(미사용)* NightBorne / Necromancer / Undead executioner / Mecha-stone Golem | — | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ | — | **없음** | **미사용** | 🟥 **LC-07** |
| — | *(미사용)* pixel items 0~6 | — | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ | — | **없음** | **미사용** | 🟥 **LC-05** |

### 6.3 대장 기입 규칙

| # | 규칙 |
|---|---|
| L1 | **다운로드와 동시에 기록한다.** "나중에 정리"는 반드시 실패한다 |
| L2 | **출처 URL은 팩 페이지**. 다운로드 직링크는 만료된다 |
| L3 | 라이선스 원문은 **`docs/licenses/<팩슬러그>.txt` 로 사본을 남긴다.** 웹 페이지는 언제든 바뀐다 |
| L4 | "확인일"을 반드시 적는다 — **분쟁 시 "그 시점에 이런 조건이었다"는 유일한 근거**다 |
| L5 | 판정이 🟥인 항목은 **배포 매니페스트(`build-assets.mjs`)에 넣지 않는다** |
| L6 | 팩 하나에서 일부만 쓰더라도, **쓰는 파일을 명시**한다 (전부 쓴다는 오해 방지) |
| L7 | AI로 생성한 이미지(§3 G1~G9)도 대장에 기록한다 — 생성 도구·프롬프트 문서 경로·생성일 |

---

## 7. 액션 아이템 (LC 목록)

| ID | 내용 | 대상 | 소요 | 마감 | 미처리 시 |
|---|---|---|---|---|---|
| **LC-01** | DeepDiveGameStudio **Undead/Vermin/Demon 3팩**(최소)의 itch.io 약관 전문 저장 | `monsters` | 30분 | Day 2 | 소명 자료 없음 |
| **LC-02** ★ | **Raven 아이콘 — 수익화 방침 확정 (무료 출시 / $35 구매 / 자체 제작 중 택1)** | `icons` | **10분(결정)** | **Day 1** | **라이선스 위반 상태로 출시** |
| **LC-03** ★ | **이펙트 팩 출처 특정** (itch.io My Library / 원본 ZIP / 브라우저 기록). 실패 시 대체안 실행 | `effect` | 1~2h | **Day 2** | **DMCA 리스크로 MUST VFX 전량 사용 불가** |
| **LC-04** | 투사체 팩 출처 특정. 실패 시 **코드 파티클로 대체** | `projectile` | 30분 | Day 2 | W2 시각 표현 공백 |
| **LC-05** | `item` 팩 — 사용하지 않는다(블랙리스트 유지) | `item` | 0 | — | — |
| **LC-06** | Lively NPCs — 사용하지 않는다. 쓰게 되면 **CC-BY 크레딧 필수** | `npcs` | 0 | — | CC-BY 위반 |
| **LC-07** | 미사용 보스 4팩(NightBorne 포함) 배포 제외 확정 | `bosses` | 0 | Day 2 | 불필요한 노출 |
| **LC-08** | BGM 배포 13곡의 Pixabay 트랙 페이지 확인 + URL·업로더·라이선스 기록. 미발견 곡은 즉시 교체 | `bgm` | 40분 | Day 2 | 음원 저작권 신고 리스크 |
| **LC-09** | Mulmaru `OFL.txt` 원문을 `FE/public/assets/fonts/`에 동봉 + 크레딧 표기 | `fonts` | 10분 | Day 1 | OFL 전문 동봉 요건 미충족 |
| **LC-10** | `docs/licenses/` 폴더 생성 + 동봉 License.txt 6개 사본 + 웹 확인 기록 보관 | 전체 | 30분 | Day 6 | 방어 자료 없음 |
| **LC-11** | **크레딧 화면 구현** (§5 문안) | 전체 | 40분 | Day 6 | CC-BY 사용 시 즉시 위반 / 신뢰도 하락 |
| **LC-12** | Play 콘솔 데이터 세이프티·광고 신고를 LC-02 결정과 일치시키기 | 전체 | 15분 | Day 7 | 신고 불일치 |
| **LC-13** | **App Store Connect 쪽 신고를 LC-12와 일치시키기** — 수익화(광고·IAP 없음) + 연령 등급 설문. **두 스토어 신고가 서로 달라지면 안 된다** | 전체 | 15분 | **Day 1** | 신고 불일치. ⚠ 연령 등급 미응답이 TestFlight 업로드까지 막는지는 미확인이므로 **Day 1에 미리 채운다** |
| **LC-14** | `pod install` 성공 후 `FE/ios/App/Pods/` 아래 라이선스 파일 전수 확인 → §4.4에 기록 | iOS 런타임 | 20분 | Day 2 | Capacitor iOS 의존성의 표기 의무 미확인 상태로 출고 |

### 7.1 배포 게이트 체크리스트

**아래 항목이 전부 ✅가 되기 전에는 Play 스토어에도 App Store Connect에도 제출 버튼을 누르지 않는다.**
**이 게이트는 양 스토어 공통이다** — 라이선스 의무는 스토어가 아니라 저작권자에 대한 것이기 때문이다(§4.4).

```
[ ] LC-02 완료 — Raven 아이콘 수익화 방침 확정 & Play 콘솔 신고 일치
[ ] LC-03 완료 — 이펙트 팩 출처 확정 또는 대체 완료
[ ] LC-04 완료 — 투사체 출처 확정 또는 대체 완료
[ ] LC-08 완료 — BGM 13곡 Pixabay 확인 완료
[ ] LC-09 완료 — OFL.txt 동봉
[ ] LC-10 완료 — docs/licenses/ 근거 보관
[ ] LC-11 완료 — 크레딧 화면 인게임 확인
[ ] LC-13 완료 — Play 콘솔 신고와 App Store Connect 신고가 일치
[ ] FE/public/assets/ 안에 화이트리스트 외 파일이 0개  (find로 검증)
```

> **크레딧 화면(LC-11)은 실기기 확인을 양쪽에서 한다.** 같은 `dist/`를 쓰므로 내용은 동일하지만,
> iOS는 WebView 구현이 달라 **스크롤·폰트 렌더가 다르게 보일 수 있다.** 내용 위반이 아니라 판독성 문제다.
> 크레딧을 읽을 수 없으면 표기 의무를 실질적으로 못 지킨 것이므로, **TestFlight 빌드에서 눈으로 확인한다.**

---

## 8. 참고 자료 (확인에 사용한 출처)

- Pixabay Terms of Service — https://pixabay.com/service/terms/
- Pixabay License: What is allowed and what is not — https://pixabay.com/blog/posts/pixabay-license-what-is-allowed-and-what-is-not-4/
- Kenney — Interface Sounds (CC0) — https://kenney.nl/assets/interface-sounds
- Kenney — UI Audio (CC0) — https://kenney.nl/assets/ui-audio
- Kenney — Digital Audio (CC0) — https://kenney.nl/assets/digital-audio
- Freesound — https://freesound.org (라이선스는 사운드마다 다름. CC0 필터 필수)
- Sonniss #GameAudioGDC Bundle License — https://sonniss.com/gdc-bundle-license/ , https://gdc.sonniss.com/
- SIL Open Font License 공식 원문 — https://openfontlicense.org/open-font-license-official-text/
- Mulmaru (물마루) — https://github.com/mushsooni/mulmaru
- Galmuri (갈무리) — https://quiple.dev/font/galmuri
- 둥근모꼴+ Fixedsys — https://noonnu.cc/font_page/250
- Pretendard — https://noonnu.cc/font_page/694
- DeepDiveGameStudio — https://deepdivegamestudio.itch.io/undead-asset-pack
- Clockwork Raven — https://clockworkraven.itch.io/raven-fantasy-icons
- xzany — https://xzany.itch.io/top-down-adventurer-character
- Clembod — https://clembod.itch.io
- chierit (Lively NPCs) — https://chierit.itch.io/lively-npcs
- BDragon1727 — https://bdragon1727.itch.io/

---

## 9. 관련 문서

- 에셋 매핑·가공 파이프라인: `09-ART-AUDIO-AND-ASSET-MAP.md`
- 리스크·스코프 컷: `16-RISKS-AND-SCOPE-CUTS.md` (**LC-02의 수익화 방침을 여기에도 기록할 것**)
- 이미지 생성 프롬프트: `15-IMAGE-PROMPTS-FOR-CODEX.md` (Raven 대체 시 아이콘 40개가 여기로 넘어온다)
- 일정: `11-ROADMAP-7DAYS.md` — LC-02/LC-03을 **Day 1~2 필수 항목**으로 반영할 것
