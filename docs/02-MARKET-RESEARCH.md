# 02. 시장 조사 & 레퍼런스 분석

> **문서 지위: 참고(REFERENCE).** 정본은 `01-CONCEPT-AND-STORY.md`, `03-GDD-CORE.md`, `04-PACT-SYSTEM.md`.
> 충돌 시 정본이 우선한다. 이 문서는 **판단 근거를 제공할 뿐 규격을 정의하지 않는다.**
> 관련 문서: [01. 컨셉&스토리](./01-CONCEPT-AND-STORY.md) · [03. GDD 코어](./03-GDD-CORE.md) · [04. PACT 시스템](./04-PACT-SYSTEM.md) · [16. 리스크 & 스코프 컷](./16-RISKS-AND-SCOPE-CUTS.md)
> 조사일: 2026-08-10 / 조사자: 1인 개발(솔로)

---

## 0. 이 문서를 3분 안에 읽는 법 (Executive Summary)

| # | 결론 | 근거 위치 |
|---|---|---|
| 1 | 장르 원조는 **한국 모바일 게임 `Magic Survival`(2019, LEME)**. Vampire Survivors는 대중화시킨 쪽이다. 우리는 "원조의 고향"으로 돌아가는 셈. | §1 |
| 2 | Steam은 **2026년 5월 "Bullet Heaven"을 공식 태그로 채택**했다. 장르가 제도화 단계에 진입 = 신규 진입 시 차별화 압력 최대. | §1.3 |
| 3 | **Vampire Survivors는 Phaser로 만들어졌다.** 우리 스택 선택은 검증된 경로다. | §6.2 |
| 4 | 모바일 서바이버즈의 사실상 표준은 **세로 + 원스틱 플로팅 조이스틱 + 5~10분 런 + 에너지 F2P**. 우리의 **가로 + 6분 + 무과금**은 3개 중 2개가 역행이다. 트레이드오프 §3.4 필독. | §3 |
| 5 | **"대가/저주" 훅은 100% 신규가 아니다.** 가장 가까운 선행작은 **Curse of the Dead Gods**(부패도 누적 → 장단점 동시 보유 저주)와 **Vampire Survivors의 Curse 스탯**(페널티를 자발적으로 쌓아 보상 증대). 우리의 진짜 차별점은 **"같은 태그 3중첩 시 저주가 정반대 능력으로 뒤집힌다"는 이산적(discrete) 역전 이벤트**뿐이다. §4.4 결론 필독. | §4 |
| 6 | **배포 채널이 바뀌었다(2026-08-10): itch.io 전면 제외 → iOS 추가.** 이번 주 목표는 **Play 내부테스트 + TestFlight 내부테스트 동시 업로드**다. 이 문서의 초판 전략 문장(웹 빌드 무료 배포)은 §3.5에서 정정했다. **§7의 출처 URL은 조사 근거이므로 보존한다.** | §3.5 |
| 7 | 7일 안에 "게임이 된다"는 판정선은 **5개 시스템**(자동공격 / 웨이브 스포너 / EXP 오브 → 레벨업 / 드래프트 풀 / 강화 진화)이다. 이걸 Day 3까지 못 만들면 스코프 컷. | §6 |

---

## 1. 서바이버즈류(Survivors-like) 장르 정의와 계보

### 1.1 장르 정의

| 항목 | 내용 |
|---|---|
| 정식 분류 | 슈팅(Shoot 'em up)의 하위 장르. 위키피디아 표제어는 **"Vampire Survivors–like"** |
| 통칭 | Survivors-like / **Bullet Heaven** / Reverse Bullet Hell / Horde Survival / 뱀서류 |
| 핵심 정의 | "플레이어가 캐릭터를 **이동시키는 것만으로** 연속되는 적 웨이브에 대응하고, 반복 런을 통해 로그라이크식 성장을 누적한다" |
| Steam 공식 태그 | **"Bullet Heaven"** (2026년 5월 확정). 450명 이상의 개발자 연대 + 8,000건 이상 공개 투표로 결정 |

### 1.2 계보 (타임라인)

```
2018~2019  Magic Survival (LEME, 한국, Android)  ← 진짜 원조. 1인 개발.
              │  · 세로 모바일 · 이동만으로 플레이 · 자동 마법 발사
              │  · Vampire Survivors 개발자가 직접 영감원으로 언급
              ▼
2021.12    Vampire Survivors 얼리액세스 (poncle / Luca Galante, 1인, Phaser 제작)
2022.03.31 Vampire Survivors 1.0 정식 출시 ($4.99)  ← 대중화 폭발점
              │
              ├─ 2022  Brotato / 20 Minutes Till Dawn / HoloCure / Soulstone Survivors(EA)
              ├─ 2022.08 Survivor.io (Habby) ← 모바일 F2P 대형화
              ├─ 2022.12.08 Vampire Survivors 모바일 무료 출시 (iOS/Android)
              ├─ 2023  Halls of Torment(EA) / Death Must Die(EA)
              ├─ 2024  Deep Rock Galactic: Survivor(EA) / Halls of Torment 1.0
              ├─ 2025  Soulstone Survivors 1.0 / Megabonk(3D 변형, 2주 100만 장)
              ▼
2026.05    Steam "Bullet Heaven" 태그 공식화 = 장르 제도화 완료
```

> 개발 기간 참고: Vampire Survivors는 **2020년 개발 착수 → 2022년 3월 1.0**, 약 2년. 1인.
> 우리는 7일이다. **동일 규모를 목표하는 것 자체가 리스크**다. → `16-RISKS-AND-SCOPE-CUTS.md` §4 "절대 방어선" 참조.

### 1.3 왜 장르가 폭발했는가 — 구조적 분석

| 요인 | 메커니즘 | BLOODSWORN 적용 |
|---|---|---|
| **인지 부하 최소화** | 공격이 전자동 → 플레이어가 관리할 채널이 "위치" 하나뿐. 조준·타이밍·콤보가 전부 제거됨. 결과: **한 손 플레이 가능** → 모바일/이중작업 친화 | 정본 §3.2 "공격 전자동" 유지. 대시조차 "있으면 좋은 것" 수준으로 설계됨 (GDD §3.3) |
| **짧은 런 = 낮은 진입 비용** | 실패 비용이 15~30분이 아니라 "이번 판만". 실패가 처벌이 아니라 **재시도 초대장**이 됨 | 우리는 **6분**. 장르 내 최단급 (§2 비교표) |
| **도파민 루프의 3중 중첩** | ① 처치 피드백(초 단위) ② EXP 오브 흡수(수 초 단위) ③ 레벨업 드래프트(10~20초 단위). **세 주기가 서로 다른 리듬으로 계속 겹친다** | 정본 GDD §1: 첫 레벨업 15초 이내, 런당 18~22회 레벨업 = 평균 16~20초마다 드래프트 |
| **시각적 인플레이션** | 후반부에 화면이 이펙트로 가득 차는 "감각 과부하 보상". 스킬 트리의 시각화 그 자체 | 정본 GDD §11: 4:30 구간 동시 적 ~130체. 각성 오라 파티클 |
| **개발 원가 대비 콘텐츠 체감** | 무기 N × 패시브 M의 조합으로 "매판 다름"을 만든다. 신규 아트 없이 다양성 증식 | 정본 PACT §7: 축복 22종 × 태그 6종 = **132조합**. 아트 추가 0 |
| **1인 개발 친화 구조** | 레벨 디자인·내러티브·컷신이 필요 없다. 시스템만 있으면 게임이 성립 | 정본 §3.1 "의도적으로 하지 않는 것" 목록과 정확히 일치 |

### 1.4 장르의 구조적 약점 (= 우리의 기회)

| 약점 | 설명 | BLOODSWORN의 대응 |
|---|---|---|
| **레벨업 선택의 긴장감 부재** | 모든 카드가 "이득"이라 선택이 딜레마가 아니라 **최적해 검색**이 된다. 3장 중 최선을 고르면 끝 | ★ PACT: 모든 카드에 대가가 붙어 **손익 계산**이 된다 (정본 PACT §2) |
| **중반 이후 무입력 관성** | 빌드가 완성되면 남은 시간은 "구경". 20~30분 런에서 특히 심함 | 6분 런 + 6:00 보스로 **관성 구간 자체를 삭제** |
| **차별화 고갈** | 2022~2026 사이 수백 종이 출시되어 "무기 다르게 하기" 수준의 차별화는 무효 | 차별화를 **아트/무기가 아니라 선택 구조**에 둠 |

---

## 2. 주요 경쟁작 심층 분석

### 2.1 기본 제원 비교

| # | 게임 | 출시 | 플랫폼 | 런 길이 | 조작 | 레벨업 선택 구조 | 메타 진행 | 가격/BM |
|---|---|---|---|---|---|---|---|---|
| C1 | **Vampire Survivors** | EA 2021.12 / 1.0 2022.03.31 / 모바일 2022.12.08 | PC·콘솔·모바일 | 30분(기본) | 이동만 (완전 자동공격) | 3~4장 드래프트, **전부 순수 이득** | 골드 → 영구 파워업, 캐릭터/무기 해금 | Steam **$4.99** / **모바일 완전 무료 + 선택적 광고(부활·골드)** |
| C2 | **Brotato** | 2022 (EA) / 1.0 2023 | PC·콘솔·모바일 | 웨이브당 20~90초, 총 20웨이브 | 이동 + (수동 조준 옵션) | **웨이브 사이 상점**에서 아이템 구매 | 캐릭터 해금, 난이도 계단 | 유료 (저가) + 모바일 이식 |
| C3 | **20 Minutes Till Dawn** | 2022 (EA) / 1.0 2023 | PC·모바일 | **Standard 20분 / Quickplay 10분 / Endless 무제한** | 이동 + 마우스 조준(수동 사격) | 레벨업 시 카드 드래프트 + 시너지 | 캐릭터·무기·룬 해금 | 유료 |
| C4 | **Halls of Torment** | EA 2023.05 / 1.0 2024.09.24 / 모바일 2024(Erabit) | PC·모바일 | **30분** | 이동만 (자동공격) | 레벨업 드래프트 + **장비 슬롯(디아블로식)** | 도전과제식 영구 언락, 장비 파밍 | 유료 |
| C5 | **Death Must Die** | EA 2023.11.15 | PC | 스테이지 단위 (약 15~25분 추정) | 이동 + 회피 | **신(神) 축복 드래프트** — 신마다 색깔이 다른 축복 풀 | 캐릭터·신 해금, 재화 강화 | 유료 |
| C6 | **Soulstone Survivors** | EA 2022.11.07 / 1.0 2025.06.17 | PC·PS5·XSX | 15~25분 (도전과제 기준) | 이동 + 스킬 수동 사용 | 레벨업 드래프트 + **거대 스킬트리** | 방대한 스킬트리·저주 난이도 스택 | 유료 |
| C7 | **HoloCure – Save the Fans!** | 2022 | PC(무료) | 20분 | 이동만 | 레벨업 드래프트 + 무기 진화(콜라보) | 골드 → 상점, 캐릭터 해금 | **완전 무료(프리웨어)** |
| C8 | **Magic Survival** | 2018~2019 | Android (모바일 전용) | 무제한 생존형 (스테이지 단위) | **이동만 · 세로 · 한 손** | 레벨업 시 마법/특성 드래프트 | 특성 트리, 재화 강화 | 무료 + 광고/IAP |
| C9 | **Survivor.io** | 2022.08 (Habby) | 모바일 (iOS/Android) | **5~10분** | **세로 · 원스틱 플로팅 조이스틱 · 한 손** | 레벨업 드래프트 + **장비 합성/승급(가차형)** | 장비 강화·에볼루션·시즌패스 | **F2P** — 에너지 제한 + IAP. 2개월 만에 3,700만 DL / $75M, 2024년 중반 누적 **$5억+**, 이후에도 월 $5~6M |
| C10 | **Deep Rock Galactic: Survivor** | EA 2024.02 | PC | 스테이지 단위 (수 분 × 다층) | 이동 + 채굴 상호작용 | 레벨업 드래프트 + **무기 오버클럭/광물 자원** | 계급·장비 해금 | **$12.99** |
| (참고) | **Archero** (인접 장르) | 2019 (Habby) | 모바일 | 방 단위 (수십 초~) | **세로 · 한 손 · "멈추면 자동 발사"** | 방 클리어 시 3택 강화 | 장비·탤런트 영구 강화 | F2P — 에너지(1칸 12분, 최대 20), 광고 리워드, IAP |

### 2.2 훔칠 것 / 피할 것

| # | 게임 | ✅ 훔칠 것 (BLOODSWORN에 적용) | ❌ 피할 것 |
|---|---|---|---|
| C1 | Vampire Survivors | ① **Curse 스탯 = 페널티를 자발적으로 쌓아 보상을 늘리는 구조**(우리 훅의 직계 선조, §4 참조) ② 후반 시각적 과포화 = 스크린샷 파워 ③ 모바일 무료화로 도달률 극대화 | ① 30분 런(모바일 세션 부적합) ② 순수 이득 드래프트(선택 긴장감 0) ③ 무기 진화 레시피 암기 요구(초심자 진입장벽) |
| C2 | Brotato | ① **아이템 대부분이 "무엇을 올리고 무엇을 내린다"는 트레이드오프**(예: Mastery = 근접 +6 / 원거리 −3) ② 희귀도가 높을수록 **보너스도 페널티도 커진다** → 우리 PACT 등급 연동(정본 §3)과 동일 철학 ③ **Curse 스탯**: 적이 강해지는 대신 재화·아이템 등급 상승 | ① 웨이브 사이 상점 = 흐름 단절, 6분 런에 부적합 ② 스탯 20종 이상의 정보 과부하 |
| C3 | 20 Minutes Till Dawn | ① **Quickplay 10분 모드의 존재** = 짧은 런 수요 실증 ② 카드 시너지 텍스트가 짧고 선언적 | ① 수동 조준 → 한 손 플레이 불가. 우리는 채택 금지(정본 GDD §3.3) |
| C4 | Halls of Torment | ① 캐릭터별 시작 능력이 곧 빌드 방향 제시 ② 도전과제 기반 언락이 "다음 런의 이유"를 계속 공급 | ① 30분 런 + 장비 슬롯 관리 = 세션 길이 폭증 ② 모바일 이식이 퍼블리셔(Erabit) 손을 거쳤다 = **PC 설계를 모바일에 그대로 옮기는 건 비용이 크다**는 증거 |
| C5 | Death Must Die | ① **"제안자가 인격을 가진다"** — 신이 축복을 준다는 연출. 우리의 **녹턴 화자 구조와 동일 축**(정본 §5.2) ② 드래프트에 캐릭터 대사를 얹어 서사 밀도를 공짜로 올림 | ① 신 4~5명 × 축복 풀 = 데이터 볼륨 과다. 7일에 불가 ② 축복이 순수 이득 위주 |
| C6 | Soulstone Survivors | ① **저주(난이도 스택)를 플레이어가 자발적으로 켜서 보상을 늘리는 구조** — Hades Heat와 같은 계열 | ① 거대 스킬트리 = 7일 스코프 즉사. **절대 금지** ② 스킬 수동 사용(쿨다운 관리) → 인지부하 증가 |
| C7 | HoloCure | ① 완전 무료로 배포해 커뮤니티 확산 → **무과금·무광고 무료 배포 전략의 근거** ② 캐릭터 팬덤이 곧 마케팅 | ① 우리는 IP 팬덤이 없다. 팬덤 대신 **훅(PACT) 자체가 화제성**이어야 함 |
| C8 | Magic Survival | ① **모바일 네이티브 설계의 원형**: 이동만, 한 손, 짧은 세션 ② 1인 개발로 성립한 최소 구성의 증거 | ① 세로 고정 → 우리는 가로 선택(§3.4 트레이드오프 참조) ② 정보 UI가 조밀해 소형 화면에서 판독성 낮음 |
| C9 | Survivor.io | ① **플로팅 조이스틱 + 한 손 플레이가 스토어 마케팅 문구로 쓰일 만큼 핵심 셀링포인트**("Clear the map with one-hand controls") ② **5~10분 런** = 모바일 세션 길이의 실증적 정답 ③ 사망 → 재시작 마찰 최소화 | ① **에너지 시스템**(플레이 시간 제한) — 우리는 무과금이므로 채택 금지 ② 장비 가차/승급 = 파워 게이팅. 7일에 불가하고 브랜드에도 안 맞음 ③ 과금 유도형 부활 |
| C10 | DRG: Survivor | ① 스테이지를 짧게 쪼개고 **층(depth) 단위로 긴장을 재설정** → 우리의 90초 페이즈 구조(정본 §4.5)와 동일 발상 ② 자원 채집이 이동 동선에 의미를 부여 | ① IP 의존 ② 다층 스테이지 = 7일 스코프 초과 |

### 2.3 포지셔닝 공백 (Gap Analysis)

| 축 | 시장 현황 | 공백 |
|---|---|---|
| 런 길이 | PC계열 20~30분 / 모바일 F2P 5~10분 | **6분 + 확정 보스 엔딩**을 가진 프리미엄 감성 무료작이 드묾 |
| 화면 방향 | 모바일 서바이버즈는 **세로가 사실상 표준** | 가로 = 소수. 시야 우위를 셀링포인트로 쓸 수 있음(§3.4) |
| 선택 구조 | 거의 전부 "순수 이득 드래프트" | **모든 선택이 손익 계산인 게임**은 서바이버즈류에 사실상 없음 ← **여기가 우리 자리** |
| 수익모델 | F2P 가차 or 유료 | **완전 무과금 · 광고 없음**은 모바일에서 강한 신뢰 신호 |

---

## 3. 모바일 서바이버즈 특화 분석

### 3.1 세로 vs 가로 채택 현황

| 게임 | 방향 | 근거/비고 |
|---|---|---|
| Magic Survival | **세로** | 모바일 전용 설계. 한 손 조작 전제 |
| Survivor.io | **세로** | "한 손 조작"을 스토어 전면에 내세움 |
| Archero | **세로** | 한 손 조작 전제. 이동/발사 배타 구조 |
| Vampire Survivors 모바일 | **가로 지원**(PC 이식) | PC 원본을 이식한 케이스 |
| Halls of Torment 모바일 | **가로 중심**(PC 이식) | 동일 |
| Brotato 모바일 | **가로 중심**(PC 이식) | 동일 |

> **패턴이 명확하다:** *모바일 네이티브로 설계된 것 = 세로 / PC에서 이식된 것 = 가로.*
> BLOODSWORN은 "모바일 네이티브인데 가로"라는 **소수 포지션**을 의도적으로 선택했다.

### 3.2 터치 조작 관행 — 왜 플로팅 조이스틱이 사실상 표준인가

| 이유 | 설명 |
|---|---|
| **엄지 위치 개인차 흡수** | 고정 조이스틱은 손 크기·그립·기기 크기에 따라 도달성이 달라진다. 플로팅은 "닿은 곳이 원점"이라 항상 최적 위치 |
| **화면 가림 최소화** | 고정 UI는 항상 그 자리를 가린다. 플로팅은 손가락을 뗀 순간 사라져 시야를 돌려준다 |
| **오조작 복구** | 드래그 중 원점이 손가락을 따라오게 하면(추종형) 엄지 이탈로 인한 방향 폭주가 줄어든다 |
| **장르 요구와 일치** | 서바이버즈류의 유일한 조작 채널이 이동이다. 이동 정밀도 = 게임 난이도의 전부. 조작 손실이 곧 재미 손실 |
| **마케팅 언어화 가능** | Survivor.io는 "one-hand controls"를 스토어 카피로 사용 = 사용자에게 인지되는 가치 |

**BLOODSWORN 적용 (정본 GDD §3.2 준수):**
- 좌측 화면 절반 터치 = 플로팅 조이스틱, 최대 반경 48px(논리), 데드존 8px
- 우측 대시 버튼 히트박스 = 시각 크기의 1.5배
- **원칙: 대시 없이도 클리어 가능해야 한다** — 한 손 플레이 보장

### 3.3 모바일 F2P 수익화 구조 (참고용, 우리는 채택 안 함)

| 게임 | 구조 | 성과 |
|---|---|---|
| Survivor.io | 에너지 제한(약 1시간 분량) + 장비 강화 IAP + 시즌패스. 고래·캐주얼 병행 하이브리드 | 출시 2개월 3,700만 DL / $75M → 2024년 중반 누적 $5억+, 이후 월 $5~6M 유지 |
| Archero | 에너지(1칸 12분 회복, 최대 20) + 소프트/하드 통화 이중 구조 + **리워드 광고 유도(강제 아님)** | Habby의 F2P 설계 원형 |
| Vampire Survivors 모바일 | **완전 무료, IAP 없음.** 광고는 부활·골드 보너스용 **선택적 시청**만 | 출시 1개월여 만에 300만 DL, 주당 40만 DL 수준 |

> **읽는 법:** Vampire Survivors 모바일 사례는 **"무과금이라도 도달률은 나온다"**는 실증이다.
> 다만 그 도달률은 **PC에서 이미 검증된 브랜드**가 있었기 때문이다. 우리는 그 브랜드가 없다. → 기대치를 낮게 잡을 것.

### 3.4 우리의 선택: 가로 + 6분 + 무과금 — 트레이드오프 분석

| 선택 | 얻는 것 | 잃는 것 | 완화책 |
|---|---|---|---|
| **가로(Landscape)** | ① 640×360 16:9로 **좌우 시야 확보** → 링 스폰 회피 판단이 쉬워짐 ② 상단 HUD를 좌우로 펼칠 수 있어 정보 밀도 확보 ③ **Android와 iOS에 레이아웃 1벌로 공용** (Capacitor 단일 WebView) = 7일 개발에서 결정적 이득 | ① **한 손 플레이 난이도 상승** (가로는 양손 그립이 자연스러움) ② 세로 전용 유저의 "출퇴근 한 손" 시나리오 일부 상실 ③ 스토어 스크린샷이 세로 목록에서 작게 보임 | 조이스틱을 좌하단에 두고 **대시를 완전 선택 사항**으로 유지 → 실질 한 손 플레이 가능(정본 GDD §3.3). 20:9 기기는 세이프 인셋 기준 배치 |
| **6분 런** | ① 장르 최단급 = **명확한 차별화 문구**("6분") ② 대가 누적 서사가 기승전결로 완결됨(정본 §3) ③ 실패 재시도 마찰 최소 ④ **7일 개발에서 콘텐츠 요구량이 1/5** | ① "얕다"는 인상 리스크 ② 빌드 완성 전 런이 끝나는 좌절 가능성 ③ 세션당 플레이 시간이 짧아 리텐션 지표에 불리(F2P였다면 치명적) | 레벨업 18~22회를 6분에 욱여넣어 **밀도로 승부**(정본 GDD §1). 각성 2회 보장 리듬(정본 PACT §3) |
| **무과금 · 광고 없음** | ① 신뢰 신호. 리뷰 평점 방어 ② 에너지/가차 시스템 구현 비용 0 = **7일 스코프에서 사실상 필수 선택** ③ 심사·정책 리스크 축소 | ① 수익 0 ② 유저 획득 예산 0 → **오가닉 발견에 100% 의존** | 훅(PACT) 자체를 화제 소재로. **양 스토어(Play·App Store)에 동시 존재해 검색 도달면을 2배로** 확보 |

> **종합 판정:** 세 선택 중 **가로만이 유일하게 "역행"이며 나머지 둘은 7일 제약의 필연**이다.
> 가로 선택의 정당화는 **"Android와 iOS가 레이아웃을 공유해 개발 시간을 벌었다"**는 실용적 근거가 가장 강하다.
> ⚠ 다만 이 근거는 **원래 웹/PC 빌드를 전제로 세워진 것**이었다. itch.io 웹 배포가 빠지면서
> "가로여서 얻는 이득"은 **줄었다.** 그래도 결론은 유지되는데, 가로 세로 전환 비용(전 화면 재작업)이
> 여전히 압도적으로 크고, 6분 런에서 좌우 시야 우위는 itch.io와 무관하게 남아 있기 때문이다.
> 만약 Day 5 시점에 한 손 조작 테스트가 실패하면, **세로 전환이 아니라 대시 제거**로 대응한다 (세로 전환은 전 화면 재작업 = 스코프 즉사).

### 3.5 배포 채널 재편 — itch.io 철회, App Store 추가 (2026-08-10 확정)

이 문서의 초판은 **"Play + itch.io 웹 빌드"** 2채널을 전제로 시장 서술을 썼다.
2026-08-10에 사용자가 **itch.io를 배포 채널에서 전면 제외**하고 **iOS를 Android와 동시에** 내는 것으로 확정했다.
위 §3.4의 전략 문장은 그에 맞게 고쳤다. **다만 §7의 리서치 출처 URL은 조사 근거이므로 그대로 둔다.**

| 축 | Play (Android) | App Store (iOS) |
|---|---|---|
| 이번 주(Day 7 = 08-16) 목표 | **내부테스트 트랙 업로드** | **TestFlight 내부테스트 업로드** |
| 정식 공개 | Day 7 이후 별도 일정 | Day 7 이후 별도 일정 |
| 이번 주 목표에 걸리는 심사 | 내부테스트 트랙은 전체 심사 대상 아님 | **내부 TestFlight은 심사 없음** — 관문은 빌드 처리 성공 + 수출 규정 응답뿐 |
| 스토어 등록물(설명·스크린샷) | 등록정보 저장에 필요 | **내부 TestFlight에는 불필요** — App Store 정식 제출 때만 |
| 예상 연령 등급 | IARC: **ESRB Teen / PEGI 12 / GRAC 12+ 또는 15+** | **13+** (2025년 개편 체계 4+/9+/13+/16+/18+. 12+·17+ 폐지) |
| 등급 근거 | 서바이버즈는 정의상 폭력 표현이 **빈번**하다 | 9+ = "가끔의 만화적·판타지 폭력" / 13+ = "**빈번한**" → 우리는 13+ |

> **등급은 올릴 수는 있어도 내릴 수 없다. 축소 신고는 양 스토어 모두 삭제·정지 사유다.**
> 13+는 상업적으로 손해가 없다 — 이 장르의 주 이용층(§5.1 페르소나 A·B 모두 20대 이상)과 어긋나지 않는다.

**★ 시장 관점에서 이 교체가 의미하는 것 — 손익을 정직하게 적는다**

| | 잃은 것 (itch.io) | 얻은 것 (App Store) |
|---|---|---|
| 마찰 | **0.** 심사도 계정도 서명도 없이 즉시 공개 가능했다 | **높다.** Apple 계정·서명·CI·빌드 처리를 전부 통과해야 한다 |
| 도달 성격 | 웹에서 **설치 없이 바로 플레이** → 체험 마찰 최소 | 설치 필요. 단 **스토어 검색 도달면이 2배** |
| 폴백 가치 | "Play가 막혀도 뭔가는 출시된다"는 보험 | 배포 경로는 여전히 2개라 보험 구조 자체는 유지 |

> ★ **정직한 결론: "마찰 없는 최후 폴백"이 사라졌다.** 배포 경로 수는 2개로 같지만
> 성격이 다르다 — itch.io는 마찰 0이었고 TestFlight은 마찰이 높다. **이건 실제 리스크 증가이며 숨기지 않는다.**
> 상세 리스크 판정은 `16-RISKS-AND-SCOPE-CUTS.md` R08/R16.
>
> 반대로 **마케팅 측면에서는 순이득**이다. §5.1 페르소나 A는 "출퇴근 6분"이 핵심인데,
> 그 시나리오는 **웹 브라우저가 아니라 설치된 앱**에서 성립한다. 웹 빌드는 애초에 이 페르소나를 겨냥하지 않았다.
> 즉 **잃은 것은 "체험 유도 채널"이고 얻은 것은 "주 타겟이 실제로 있는 채널"**이다.

> ⚠ iOS 사용자층의 서바이버즈류 소비 규모·ARPU 등 **정량 비교는 이 조사에 포함되지 않았다** — 확인 필요(2026-08-10 기준 미확인).
> 우리는 무과금이라 수익 지표가 의사결정에 들어오지 않으므로 이번 주에 조사하지 않는다.

---

## 4. "대가/저주" 메커니즘 선행 사례 조사

> **이 절의 목적은 자기 위안이 아니라 냉정한 검증이다.** 유사 선행작이 있으면 명시한다.

### 4.1 선행 사례 표

| # | 게임 | 메커니즘 | 대가의 형태 | 대가가 힘으로 바뀌는가? | 우리와의 거리 | 검증 |
|---|---|---|---|---|---|---|
| R1 | **Curse of the Dead Gods** (2021) | 부패(Corruption) 게이지가 100 찰 때마다 **저주 1개 획득**. 최대 5중첩. 5번째 저주는 HP가 1까지 계속 감소 | 저주마다 **장점과 단점이 동시에** 붙은 "원숭이 손" 구조 (예: 회피가 무형화되지만 퍼펙트 회피의 스태미나 회복 상실) | **부분적으로 그렇다.** 단, 처음부터 장단점 동시 보유 — 나중에 뒤집히는 게 아님 | **가장 가까움 (★★★★☆)** | 확인됨 |
| R2 | **Vampire Survivors** — Curse 스탯 | Curse% 만큼 적 웨이브의 **빈도·수·속도·체력**이 증가. 상한 없음 | 순수 난이도 상승 | **간접적으로.** 적이 많아져 EXP/골드 수급이 폭증 → 고Curse 빌드가 런당 100레벨 이상 도달 | **매우 가까움 (★★★★☆)** — "페널티를 일부러 쌓는다"는 심리가 동일 | 확인됨 |
| R3 | **Hades** — Pact of Punishment / Heat | 런 시작 전 조건(Condition)을 켜서 Heat를 올림. Extreme Measures 등 | 난이도 상승 | 아니오. **보상(재화)만 증가** | 중간 (★★★☆☆). 단 **"Pact"라는 명칭이 겹친다** → §4.3 주의 | 확인됨 |
| R4 | **Brotato** | 아이템 대부분이 스탯 트레이드오프(Mastery: 근접+6/원거리−3). 희귀도↑ = 보너스↑ **& 페널티↑**. 별도 **Curse 스탯**: 적 강화 대신 재화·아이템 등급 상승 | 스탯 감소 + 적 강화 | 아니오. 트레이드오프는 **정적**이며 뒤집히지 않음 | 가까움 (★★★★☆) — **등급↑=대가↑ 규칙이 우리 정본 PACT §3과 동일** | 확인됨 |
| R5 | **Risk of Rain 2** | ① **아티팩트**(런 전체 규칙 변경, 예: Sacrifice = 상자 제거 대신 적이 아이템 드롭) ② 양날 아이템(Light Flux Pauldron: 쿨다운 절반 **& 공속 절반**, Stone Flux Pauldron: HP +100% **& 이동속도 절반**) | 규칙 변경 / 스탯 반감 | 아니오. 정적 트레이드오프 | 중간 (★★★☆☆) | 확인됨 |
| R6 | **Nova Drift** | 레벨업 시 mod 드래프트. 다수가 양날 (예: **Dying Star** — 지속 자해 피해 대신 근접 적에게 화상) | 자해·스탯 손실 | 아니오 | 가까움 (★★★★☆) — **레벨업 드래프트에 양날을 넣는 구조가 동일** | 확인됨 |
| R7 | **The Binding of Isaac** | 양날 아이템 다수. 특정 아이템은 **체력 반칸 이하일 때 데미지 +1.5 / 속도 +0.3** 같은 "저체력 보상" | HP·속도·눈물 등 | **부분적으로.** "약해진 상태 자체가 조건이 되어 강해진다" | 가까움 (★★★★☆) — **우리 FRAIL 각성(「불사의 껍질」)과 발상이 같다** | 확인됨 |
| R8 | **Slay the Spire** | **Curse 카드 타입** — 덱에 섞이는 순수 방해 카드. 일부 카드는 저주를 대가로 강력한 이득 제공 | 덱 오염 | 대체로 아니오 (일부 시너지 카드 존재) | 중간 (★★★☆☆) | 일반 지식 기반 — **미검증(추정)** |
| R9 | **Death Must Die** | 신들이 축복을 제공. `Cursed`는 주로 **적에게 거는 상태이상**(HP 비율 지속 감소) | 플레이어 대가 구조는 조사 범위에서 확인 안 됨 | — | 멂 (★☆☆☆☆) — **"저주 시스템"은 플레이어 페널티가 아님. 오해 주의** | 확인됨(반증) |
| R10 | **Cult of the Lamb** | 플리스(Fleece)/교리 선택으로 런 규칙 변경 (예: 최대 HP 1로 시작하는 대신 다른 이득) | 규칙 제약 | 아니오 | 멂 (★★☆☆☆) | 일반 지식 기반 — **미검증(추정)** |
| R11 | **Inscryption** | 코스트로 **영구적 신체·카드 희생**(눈, 이빨, 카드 제물) | 영구 손실 | 아니오 | 멂 (★★☆☆☆). 단 **"대가의 정서적 무게"** 연출은 참고 가치 큼 | 일반 지식 기반 — **미검증(추정)** |
| R12 | **Peglin** | Cruciball — 난이도 등급을 올려 보상/해금 획득 | 난이도 상승 | 아니오 | 멂 (★★☆☆☆) | 일반 지식 기반 — **미검증(추정)** |

### 4.2 선행 사례가 도달한 지점 (요약)

선행작들은 다음 **네 가지 형태** 중 하나에 머물러 있다.

| 형태 | 대표작 | 특징 |
|---|---|---|
| **A. 정적 트레이드오프** | Brotato, RoR2, Nova Drift | 한 번 선택하면 장단점이 고정. 시간이 흘러도 변하지 않음 |
| **B. 난이도 베팅** | Hades Heat, VS Curse, Soulstone, Peglin | 페널티를 켜고 **외부 보상**(재화·해금)을 받음. 인게임 능력으로 전환되지 않음 |
| **C. 동시 장단점 저주** | Curse of the Dead Gods | 저주가 처음부터 장점+단점을 함께 가짐. 누적되지만 **질적 전환은 없음** |
| **D. 상태 조건부 보상** | Binding of Isaac 저체력 보상 | "약해진 상태"가 조건이 되어 다른 능력이 켜짐. 다만 **저주를 모으는 행위가 아니라 우연한 상태** |

### 4.3 냉정한 결론 — 우리 훅은 얼마나 새로운가

**❌ 새롭지 않은 부분 (정직하게 인정할 것)**

1. "레벨업 선택에 대가를 붙인다" — **Nova Drift, Brotato가 이미 함.** 완전히 기존 것.
2. "페널티를 일부러 쌓아 이득을 얻는다" — **Vampire Survivors의 Curse 스탯이 이미 대중화시킴.** 이건 오히려 이 장르 유저에게 **친숙한 문법**이다.
3. "저주가 누적되며 게이지가 찬다" — **Curse of the Dead Gods가 이미 함.**
4. "약해진 상태가 힘의 조건이 된다" — **Binding of Isaac이 이미 함.**
5. **명칭 리스크:** Hades의 최상위 난이도 시스템 이름이 **"Pact of Punishment"**다. 우리 게임의 핵심 시스템 명칭이 **"THE PACT"**다. 로그라이트 코어 유저는 이를 즉시 연상한다.

**✅ 진짜로 남는 차별점 (딱 하나, 그러나 충분히 날카롭다)**

> **"대가가 같은 계열로 정확히 3중첩되면, 그 저주가 즉시·자동으로 정반대의 강력한 능력으로 질적 전환된다."**

이 한 문장 안에 선행작이 도달하지 못한 요소가 **3개** 있다.

| 요소 | 선행작이 안 한 이유/상태 | 우리 구현 (정본 PACT §5) |
|---|---|---|
| **① 이산적 역전 이벤트 (discrete flip)** | 선행작은 전부 **연속적 스케일링**(Curse% 올리면 보상% 오름). "임계점을 넘는 순간 규칙이 바뀐다"는 이벤트가 없음 | 3중첩 도달 즉시 각성 발동. 히트스톱 + 심홍 플래시 + 전체 적 넉백/스턴 = **명백한 사건** |
| **② 태그 단위 누적 = 빌드 정체성의 이동** | 선행작에서 빌드 정체성은 "어떤 무기/아이템을 모았는가". 페널티는 배경 조건 | 정본 §8 Pillars 4: **"빌드 = 어떤 저주를 감당하기로 했는가"**. 대가 태그 6종이 곧 6가지 빌드 축 |
| **③ 역전 후에도 페널티를 일부 유지 (선택적)** | 선행작의 페널티는 제거되거나 유지되거나 둘 중 하나로 단순 | FRAIL/BLIND/HUNGER는 **페널티를 유지한 채** 보상이 얹힘 → 각성 후에도 긴장이 살아있음 (정본 PACT §5.3) |

**⚠️ 차별화 각도 제안 (마케팅·설계 양쪽)**

| # | 제안 | 실행 |
|---|---|---|
| D1 | **"Curse 스탯의 후계자"로 포지셔닝하라, "새 발명"이라 하지 말 것.** 유저는 VS Curse를 안다. "그걸 6개 계열로 쪼개고, 3개 모으면 터지게 했다"가 훨씬 잘 전달되고 반박 불가능 | 스토어 문구/피치에 반영 |
| D2 | **각성 순간을 게임의 얼굴로 만들어라.** 차별점이 "이벤트"라면 그 이벤트가 스크린샷·GIF가 되어야 한다 | 정본 PACT §5.2 연출에 하루의 1/4 투입 (정본이 이미 명시) |
| D3 | **명칭 혼동 대비.** "THE PACT"는 유지하되, 대외 카피에서는 항상 **"축복+대가 계약(Blessing & Toll)"**과 함께 노출해 Hades 연상을 덮는다 | 스토어 설명 첫 문장에 "Toll" 병기 |
| D4 | **"저주를 몰아주는 플레이"를 튜토리얼 없이 학습시켜라.** 정본 PACT §6 "각성 임박 하이라이트"(맥동하는 금빛 테두리 + "이 계약으로 각성한다")가 유일한 교사다. **이 UI는 절대 컷 금지** | `16-RISKS...` 컷 사다리에서 방어 대상 |
| D5 | **선행작과 정면 비교를 두려워 말 것.** 스토어 설명란에 "if you liked stacking Curse in Vampire Survivors—this game is about that, and only that" 류의 문장이 오히려 발견성을 높인다 | 배포 문구. ⚠ 단 **App Store는 타사 앱·상표 언급에 Play보다 민감**할 수 있다 → 확인 필요(2026-08-10 기준 미확인). 안전하게 가려면 장르 서술("bullet heaven")로 바꿔 쓴다 |

---

## 5. 타겟 유저 & 포지셔닝

### 5.1 페르소나

#### 페르소나 A — 「출퇴근 6분」 (주 타겟)

| 항목 | 내용 |
|---|---|
| 프로필 | 28세, 직장인, 안드로이드 **또는 아이폰**(양 스토어 동시 배포이므로 기기를 가리지 않는다). 지하철 6~12분 구간에서 게임 |
| 경험 | Vampire Survivors 모바일 20시간, Survivor.io 3개월 후 에너지·과금에 지쳐 이탈 |
| 니즈 | **한 정거장 안에 끝나는 완결된 런.** 광고·에너지·과금 없음. 저장/이어하기 고민 없음 |
| 판단 기준 | "이거 켜면 몇 분 걸려?" → **"6분, 보스까지"** 한 문장에 설득됨 |
| 이탈 트리거 | 로딩 15초 초과 / 첫 판에서 조작이 안 먹힘 / 광고 강제 |
| 이 페르소나가 요구하는 것 | 앱 실행 → 런 시작까지 **3탭 이내**, 사망 → 재시작 **3초 이내**(정본 GDD §12) |

#### 페르소나 B — 「빌드 실험가」 (전환·화제성 담당)

| 항목 | 내용 |
|---|---|
| 프로필 | 22세, 대학생. Steam 로그라이트 200시간 이상 (Hades, StS, Brotato, RoR2) |
| 경험 | 서바이버즈류를 "생각 없는 장르"로 낮게 봄. 단 **Brotato의 트레이드오프 아이템은 인정** |
| 니즈 | **선택이 실제로 어려운 게임.** 최적해가 자명하면 5분 만에 흥미 상실 |
| 판단 기준 | "레벨업이 딜레마인가?" → PACT 첫 카드 화면에서 즉시 판정 |
| 이탈 트리거 | 대가가 무의미하게 약함 / 각성이 6분 안에 안 터짐 / 카드 3장이 매번 비슷함 |
| 이 페르소나가 요구하는 것 | 정본 PACT §3 "Epic = 2중첩" 규칙과 §9 안전장치가 **정확히 작동**할 것. 이 페르소나가 SNS 확산을 만든다 |

### 5.2 포지셔닝 맵

**축:** X = 런 길이 (짧음 ← → 김) / Y = 선택의 리스크 (순수 이득 ↓ ← → ↑ 손익 딜레마)

```
   선택의 리스크 (높음 = 모든 선택이 딜레마)
        ▲
        │
        │                    ★ BLOODSWORN
        │                   (6분 · 전 선택 딜레마)
        │                                      ○ Curse of the Dead Gods
   높음 │                                        (던전형 · 저주 누적)
        │          ○ Brotato
        │        (웨이브 · 트레이드오프 아이템)
        │                          ○ Nova Drift        ○ Risk of Rain 2
        │                                                 (양날 아이템)
        ├──────────────────────────────────────────────────────────►
        │  ○ Survivor.io                    ○ Vampire Survivors
   낮음 │  (5~10분 · 순수 이득 + 가차)      (30분 · 순수 이득)
        │  ○ Magic Survival                 ○ Halls of Torment (30분)
        │  ○ Archero                        ○ Soulstone Survivors
        │                                   ○ HoloCure / 20MTD
        │
        짧음 ◄──────────── 런 길이 ────────────► 김
```

> **읽는 법:** 좌상단(짧은 런 × 높은 리스크) 사분면이 **거의 비어 있다.**
> Survivor.io·Magic Survival·Archero가 좌하단을 점유하고, 리스크 있는 선택 구조는 전부 우측(긴 런)에 몰려 있다.
> **BLOODSWORN의 자리는 좌상단이며, 그 자리에 정면 경쟁자가 없다.** ← 이 문서의 가장 중요한 한 장.

### 5.3 한 줄 피치

> **메인 (스토어용):**
> **"6분. 매 레벨업마다 축복과 저주를 함께 받는다. 같은 저주를 세 번 견디면, 저주가 너를 위해 싸운다."**

| 용도 | 문구 |
|---|---|
| 스토어 짧은 설명 | 6분 만에 끝나는 가로형 서바이버즈. 모든 강화에는 대가가 따르고, 대가는 결국 무기가 된다. |
| 장르 유저용 (D1 각도) | "Vampire Survivors에서 Curse를 일부러 쌓아본 적 있다면 — 이 게임은 **그것만** 다룬다." |
| 한 문장 태그라인 (정본 §2.1) | **"새벽까지 버텨라. 대가는 나중에 치른다."** |

---

## 6. 7일 개발 벤치마크 — "최소 재미 구성"

### 6.1 소규모/단기 제작 사례

| 사례 | 기간 | 산출물 | 시사점 |
|---|---|---|---|
| Linux Game Jam 2023 출품작 (Unity) | **1주** | 이동, 무기, 경험치, 적 스포너, 충돌까지 갖춘 뱀서류 클론 완성 | **1주에 코어 루프는 완성 가능하다**는 실증 |
| GMTK Game Jam 2023 「Vampire: No Survivors」 | **48시간** | 장르 변형 프로토타입 | 48시간에도 "핵심 아이디어 1개"는 전달 가능 |
| Vampire Survivors 본편 | **약 2년** (2020 착수 → 2022.03 1.0) | 상용 완성작 | **7일로 완성작을 목표하면 실패한다.** 우리는 "완성작"이 아니라 **"훅이 작동하는 최소 완제품"**을 만든다 |
| Godot `SurvivorsStarterKit` 등 템플릿 | — | 스펠 4종 + 적 5종 기본 구성 | 업계 통념: **보일러플레이트(스포너·오브·레벨업 UI)에 첫 주를 다 쓰고 디자인에 못 가는 것이 최대 함정** |

> ⚠️ **우리에게 가장 위험한 문장:** *"첫 주를 보일러플레이트에 다 쓰고 재미 설계에 도달하지 못한다."*
> 우리는 첫 주가 **전부**다. → 보일러플레이트를 Day 1~2에 끝내고 **Day 3부터 PACT**에 들어가야 한다(정본 PACT §11과 일치).

### 6.2 스택 검증

| 항목 | 사실 | 의미 |
|---|---|---|
| Vampire Survivors의 엔진 | **Phaser로 제작됨** | 우리 스택(Phaser 3.90)이 이 장르에 부적합할 이유가 없다. **"엔진 때문에 안 된다"는 변명은 성립하지 않는다** |
| Phaser 공식 자료 | Phaser 공식 뉴스에 "Create a game like Vampire Survivors" 튜토리얼 시리즈 존재 | 막혔을 때 참조할 1차 자료가 있다 |
| 대량 스프라이트 | 오브젝트 풀링 + 텍스처 아틀라스가 표준 해법. 아틀라스는 개별 이미지 대비 로드 3.2배 빠름 사례 보고 | 정본 GDD §7.1 "적 150체 상한 + 풀 반환" 설계가 정석 |
| 모바일 WebView | 메모리 초과 시 iOS WebView는 종료, Android WebView는 크래시 | 텍스처 메모리 예산 관리 필수 → `16-RISKS...` R01/R11 |

### 6.3 "게임이 된다" 판정 체크리스트

> 업계 통설(§6.1 자료)에서 도출한 **5대 필수 시스템**. 이게 다 되면 그때부터 "게임"이다.

#### 🟥 Tier 0 — 이게 없으면 게임이 아니다 (Day 2 종료까지 필수)

| ✔ | 항목 | 판정 기준 | 정본 근거 |
|---|---|---|---|
| ☐ | **① 자동공격 무기** | 입력 없이 적이 죽는다. 최소 1종 | GDD §6.2 W1 피의 송곳니 |
| ☐ | **② 시간에 따라 격화되는 웨이브 스포너** | 화면 밖 링 스폰, 시간이 지날수록 밀도 증가 | GDD §7.1, §11 |
| ☐ | **③ EXP 오브 → 레벨업** | 적 처치 → 오브 드롭 → 자석 흡수 → 레벨업 트리거 | GDD §5 |
| ☐ | **④ 레벨업 드래프트 (3택)** | 게임 정지 + 카드 3장 + 선택 반영 | PACT §1 |
| ☐ | **⑤ 강화·진화 보상** | 같은 걸 고르면 눈에 띄게 세진다 (무기 Lv1→5) | GDD §6.1 |

#### 🟧 Tier 1 — 이게 있어야 "우리 게임"이다 (Day 4 종료까지)

| ✔ | 항목 | 판정 기준 | 정본 근거 |
|---|---|---|---|
| ☐ | **대가(Toll) 부과** | 카드 선택 시 저주가 실제로 스탯에 적용된다 | PACT §4 |
| ☐ | **태그 카운터 UI** | 카드에 `●●○` 중첩 표시가 보인다 | PACT §1 |
| ☐ | **각성 최소 1종 발동** | 3중첩 → 실제로 능력이 뒤집힌다 | PACT §11 "최소 생존선" |
| ☐ | **각성 연출** | 플래시 + 타이포 + 충격파 | PACT §5.2 |
| ☐ | **6:00 보스 + 승패 화면** | 런이 **끝난다**. 무한 루프가 아니다 | GDD §7.3, §12 |

#### 🟨 Tier 2 — 있으면 "완제품"으로 보인다 (Day 5~6)

| ✔ | 항목 | 정본 근거 |
|---|---|---|
| ☐ | 각성 6종 전부 | PACT §5.3 |
| ☐ | 인간성 + 완전 흡혈귀화 | PACT §5.4 |
| ☐ | 리롤 / 스킵 | PACT §6.1, §6.2 |
| ☐ | 성소(메타 진행) + localStorage 저장 | GDD §9 |
| ☐ | 사운드(BGM 티어 + 각성 스팅) | 01 §4.5 |
| ☐ | 엔딩 4종 텍스트 분기 | 01 §6 |

#### 🟩 Tier 3 — 잘라도 아무도 모른다

| ✔ | 항목 |
|---|---|
| ☐ | 스테이지 2, 보스 B, 캐릭터 2, W6 그림자 메아리, 각성 도감, 함정, 영어 i18n |

> **7일 개발자를 위한 한 줄:** Tier 0은 **재미가 아니라 존재 조건**이다. Tier 1이 재미다.
> **Tier 0에 4일을 쓰면 게임은 재미없는 채로 출시된다.** Tier 0은 Day 2까지, 무조건.

---

## 7. 참고 자료 링크 목록

### 7.1 장르 정의 / 계보
- Vampire Survivors–like (Wikipedia, 장르 정의·계보·Steam "Bullet Heaven" 태그 공식화) — https://en.wikipedia.org/wiki/Vampire_Survivors%E2%80%93like
- Vampire Survivors (Wikipedia, 개발 이력·출시일) — https://en.wikipedia.org/wiki/Vampire_Survivors
- Magic Survival — 장르의 탄생 (TapTap 리뷰) — https://www.taptap.io/post/1741711
- Magic Survival (IGDB, 2019) — https://www.igdb.com/games/magic-survival
- LEME (Magic Survival Wiki, 개발사 정보) — https://magic-survival-rpg.fandom.com/wiki/LEME
- 매직 서바이벌 (나무위키) — https://en.namu.wiki/w/%EB%A7%A4%EC%A7%81%EC%84%9C%EB%B0%94%EC%9D%B4%EB%B2%8C
- Vampire Survivors development sounds like an open-source fueled fever dream (Game Developer) — https://www.gamedeveloper.com/design/vampire-survivors-development-sounds-like-an-open-source-fueled-fever-dream

### 7.2 경쟁작
- Halls of Torment (Wikipedia) — https://en.wikipedia.org/wiki/Halls_of_Torment
- Halls of Torment 모바일 이식 (TouchArcade) — https://toucharcade.com/2024/08/05/halls-of-torment-mobile-release-date-price-iphone-android/
- 20 Minutes Till Dawn (Wikipedia, 모드별 런 길이) — https://en.wikipedia.org/wiki/20_Minutes_Till_Dawn
- Death Must Die (Steam / 소개 기사) — https://www.pcgamer.com/this-indie-fuses-the-structure-of-hades-with-the-horde-smashing-action-of-vampire-survivors/
- Death Must Die 축복 시스템 (TheGamer) — https://www.thegamer.com/death-must-die-best-blessings/
- Soulstone Survivors 1.0 릴리스 (Steam News) — https://store.steampowered.com/news/app/2066020/view/809072587205252561
- Deep Rock Galactic: Survivor (Steam 번들 페이지, 가격) — https://store.steampowered.com/bundle/48008
- Vampire Survivors 모바일 무료 출시 (TouchArcade) — https://toucharcade.com/2022/12/08/vampire-survivors-mobile-free-download-ios-android-controller-support-iphone-ipad-poncle/
- Vampire Survivors 모바일 무료 출시 (Engadget) — https://www.engadget.com/vampire-survivors-ios-android-mobile-free-005055880.html
- Vampire Survivors 모바일 300만 다운로드 (Game World Observer) — https://gameworldobserver.com/2023/01/17/vampire-survivors-mobile-3-million-downloads-appmagic

### 7.3 모바일 F2P / 수익화
- Survivor.io 2개월 $75M / 3,700만 DL (Mobilegamer.biz) — https://mobilegamer.biz/two-months-in-survivor-io-passes-75m-from-37m-downloads/
- Survivor.io 3년차 월 $5M (Gamesforum) — https://www.gf.symphonyonline.co.uk/news/how-survivor.io-continues-to-pull-in-5-million-a-month-three-years-later
- Survivor.io 게임 리포트 (한 손 조작·세션 설계) — https://www.mobilegamereport.com/games/survivor-io
- Archero 수익화 해부 (Udonis) — https://www.blog.udonis.co/mobile-marketing/mobile-games/archero-monetization
- Finding The Fun: Archero Part 3 – Monetization (Game Developer) — https://www.gamedeveloper.com/design/finding-the-fun-archero-part-3---monetization

### 7.4 "대가/저주" 선행 사례
- Curse of the Dead Gods — Corruption (공식 위키) — https://curseofthedeadgods.fandom.com/wiki/Corruption
- Curse of the Dead Gods — Curses (공식 위키) — https://curseofthedeadgods.fandom.com/wiki/Curses
- Curse of the Dead Gods — 저주 가이드 (Prima Games) — https://primagames.com/gaming/curse-of-the-dead-gods-corruption-curses-guide
- Vampire Survivors — Curse 스탯 (공식 위키) — https://vampire.survivors.wiki/w/Curse
- Vampire Survivors — Curse 리스크/리워드 해설 (Rogue Ranker) — https://rogueranker.com/vampire-survivors-curse/
- Hades — Pact of Punishment (Hades Wiki) — https://hades.fandom.com/wiki/Pact_of_Punishment
- Hades — Heat & Pact of Punishment 해설 (RPG Site) — https://www.rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards
- Brotato — Curse 스탯 (Brotato Wiki) — https://brotato.wiki.spellsandguns.com/Curse
- Risk of Rain 2 — Artifacts (Wiki) — https://riskofrain2.wiki.gg/wiki/Artifacts
- Nova Drift (Steam 공식 페이지) — https://store.steampowered.com/app/858210/Nova_Drift/
- Nova Drift (TV Tropes, 양날 mod 예시) — https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NovaDrift
- Stats-Tradeoff Equipment (TV Tropes, 장르 전반 트레이드오프 사례 색인) — https://tvtropes.org/pmwiki/pmwiki.php/Main/StatsTradeoffEquipment
- The Binding of Isaac 전체 아이템 목록 (Platinum God) — https://tboi.com/all-items

### 7.5 기술 / 개발 벤치마크
- Create a game like Vampire Survivors (Phaser 공식 튜토리얼) — https://phaser.io/news/2024/12/create-a-game-like-vampire-survivors
- Phaser Performance Optimization Guide (오브젝트 풀링·아틀라스) — https://generalistprogrammer.com/tutorials/phaser-performance-optimization-guide
- Object Pooling Sprites in a Phaser Game — https://www.thepolyglotdeveloper.com/2020/09/object-pooling-sprites-phaser-game-performance-gains/
- How I optimized my Phaser 3 action game (2025) — https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b
- Linux Game Jam 2023 — 1주 만에 만든 뱀서류 클론 devlog — https://itch.io/jam/linux-game-jam2023/topic/2895259/devlog-a-vampire-survivors-clone
- GMTK Game Jam 2023 — Vampire: No Survivors — https://itch.io/jam/gmtk-2023/rate/2153689
- 서바이버즈류 5대 필수 시스템 정리 — https://www.summerengine.com/blog/make-a-game-like-vampire-survivors

### 7.6 배포 (→ `16-RISKS-AND-SCOPE-CUTS.md`에서 사용)
- App testing requirements for new personal developer accounts (Play Console 공식) — https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Google Play 12 테스터 요건 FAQ (2026) — https://20apptester.com/2026/06/03/google-play-closed-testing-12-testers-faq/
- Autoplay guide for media and Web Audio APIs (MDN) — https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- Intent to Ship: Autoplay Policy for Web Audio (Chromium blink-dev) — https://groups.google.com/a/chromium.org/g/blink-dev/c/5Y1BqbGauEs/m/geloU475BwAJ

---

## 8. 이 문서의 신뢰도 고지

| 구분 | 내용 |
|---|---|
| **확인됨** | §1 계보, §2.1 출시일·가격·런 길이(20MTD·Halls of Torment·Survivor.io), §3.3 수익화 수치, §4 R1~R7·R9, §6.1~6.2 |
| **추정 (미검증)** | §4 R8(Slay the Spire 저주 카드), R10(Cult of the Lamb), R11(Inscryption), R12(Peglin) — 일반 지식 기반이며 1차 출처 미확인. **설계 근거로 쓰지 말 것** |
| **추정 (수치)** | §2.1 Death Must Die 런 길이 "15~25분", §5.2 포지셔닝 맵의 좌표는 상대적 인상이며 정량 측정치가 아님 |
| **의도적 미조사** | 각 게임의 정확한 DAU/리텐션 — 무과금 개인 출시에 의사결정 가치가 낮아 생략 |
