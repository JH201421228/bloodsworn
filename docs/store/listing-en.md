# Store listing — English (T713)

> # 🚨 출시 전 반드시 고쳐야 한다 — 지금 문안은 허위 기재다
>
> 이 문서는 **광고 0 · 결제 0 · 수집 0** 을 전제로 쓰였다.
> 그 뒤 수익화 방향이 **보상형 광고 + IAP 하이브리드**로 확정됐고(`docs/20-MONETIZATION.md`),
> AdMob·분석 SDK 가 붙는다. 아래 문구는 **SDK 가 들어가는 순간 거짓이 된다.**
>
> | 지금 문안 | 실제 | 위험 |
> |---|---|---|
> | "완전 무료 / No ads" | 보상형 광고 있음 | 데이터 안전 양식 불일치 → **앱 삭제 사유** |
> | "인앱 결제 없음 / No in-app purchases" | IAP 6종 | 동일 |
> | "개인정보 일절 수집 안 함" | 광고 ID·익명 UUID·크래시 로그 | 동일 (반려 최다 원인) |
>
> **교체 문안과 데이터 안전 양식 매핑은 `docs/28-ASO-AND-ORGANIC.md` §1 에 있다.**
> 대상 연령도 13세 → **18세** 로 바꿔야 한다(`docs/27-COMPLIANCE-AND-SOFTLAUNCH.md` §4 —
> 아동 연령대를 하나라도 고르면 Families 정책이 전면 적용된다).
>
> 수익화를 하지 않기로 되돌린다면 이 경고는 무효다. 그 경우 무료 에셋 라이선스도 전부 되살아난다.



> 규격 근거: `14-BUILD-AND-DEPLOY.md` §8.4.
> Day 7 에는 **필요 없다** — Play 기본 언어는 한국어이고, 내부 TestFlight 은 등록정보 자체를 요구하지 않는다.
> 영어권 노출을 늘리려면 Play Console 의 "번역 추가"에서 이 문안을 붙여넣는다.

---

## App name (30 chars)

```
BLOODSWORN
```

> 영문 등록정보에서는 부제를 뺀다. `BLOODSWORN: 피의 서약` 은 영어권 이용자에게
> 깨진 글자로 보일 위험이 있고, 30자 제한 안에서 브랜드만 남기는 편이 검색에 유리하다.

---

## Short description (80 chars)

```
Survive six minutes. Every blessing has a toll. Endure three and the toll turns.
```

---

## Full description (4000 chars)

```
■ Survive until dawn. Pay the toll later.

Beneath Carnac Abbey lies the Sealed Tomb, where Nocturne — the first vampire —
has been chained for a thousand years. Only the votive candles hold the seal.
And the candles refill the moment dawn's light touches them.

So there is only one thing to do: survive for six minutes.


■ Every blessing has a toll

Each level-up gives you a Blessing and a Toll, together.
Take the damage, lose your sight. Take the speed, give up your health.
There is no "just good" choice in this game. Every level-up is a dilemma.


■ Endure a curse three times and it fights for you

When three Tolls of the same kind stack, an Awakening triggers —
and the curse that was eating you inverts into a power.

Endure Frailty three times and you grow stronger the more you are hit.
Endure Darkness three times and you begin to see in the dark.

Do you stack curses on purpose to chase an Awakening, or play it safe?
That decision is your build, and it is different every run.


■ Six minutes is enough

A run is exactly six minutes — one stop on the commute, the end of a lunch break.
Death restarts you in under three seconds, and the permanent upgrades you bank
in the Sanctum carry into the next run.


■ You might like this if

· You enjoyed Vampire Survivors or Brotato
· You want a roguelite you can finish in one sitting, many times over
· You like choices that actually make you think about your build


■ Features

· Landscape only. One thumb on the stick, one dash button. Attacks are automatic.
· 16-bit gothic dark fantasy pixel art
· Blessings and Tolls combine into a different build every run
· 6 Awakenings · 4 weapons · permanent Sanctum upgrades
· 3 endings

· Completely free. No ads. No in-app purchases.
· No internet connection required. No account required.
· Collects no personal data whatsoever.
```

> ★ The last three lines must stay factually identical to the Korean listing,
>   the Play Data safety declaration, and `privacy/index.html`.
>   Divergence between them is the single most common rejection cause.
