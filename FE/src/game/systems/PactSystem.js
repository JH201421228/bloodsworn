/**
 * PactSystem — 카드 생성 알고리즘 + 안전장치 S1~S4. (T330~T335/T350)
 *
 * 규격: 04-PACT-SYSTEM.md 3(등급) 4(대가) 6(안전장치)
 *
 * ★ 이 게임의 핵심 훅이다. 축복과 대가를 한 쌍으로 받고,
 *   같은 대가 태그가 3중첩되면 각성으로 뒤집힌다(Day 4).
 */
import tollsData from "@/data/tolls.json";
import blessingsData from "@/data/blessings.json";
import nocturneData from "@/data/nocturneLines.json";
import awakeningsData from "@/data/awakenings.json";

export const AWAKEN_STACKS = 3;
/** 각성 상한. AwakeningSystem 의 MAX_AWAKENINGS 와 같은 값이다(정본 04-PACT §5). */
const AWAKEN_CAP = 2;
const RARITIES = ["common", "rare", "epic"];

/**
 * 각성한 **뒤에도 스탯 페널티가 남는** 태그. 실제 값은 awakenings.json 이 갖는다
 * (2026-08-12 확인: FRAIL / HUNGER / BLIND 가 removePenalty:false, SLOW / MYOPIA / GREED 가 true).
 *
 * ★ 왜 이 집합이 필요한가 — pickToll 의 폴백 후보가 정확히 이것이다.
 *   removePenalty:true 인 태그는 각성이 그 대가의 모디파이어를 통째로 걷어냈으므로
 *   (AwakeningSystem.trigger 의 stats.removeBySrc("toll:" + tag)) 다시 쌓아도 **아프지 않다**.
 *   이름만 대가인 공짜 축복이라 폴백에서도 뺀다.
 * ★ 표를 코드에 손으로 적지 않는다. 밸런싱은 JSON 에서 한다는 규약(awakenings.json 머리 주석)이
 *   여기서도 그대로여야, removePenalty 를 뒤집었을 때 두 곳이 어긋나지 않는다.
 */
const PENALTY_KEPT = new Set(
    awakeningsData.awakenings.filter((a) => a.tag && !a.removePenalty).map((a) => a.tag),
);

/**
 * 축복 수치 → 카드에 찍히는 문자열.
 *
 * ★ "%" 를 여기서 무조건 붙이면 안 된다. blessings.json 의 desc 는 두 가지 모양이 섞여 있다.
 *     op:"mul"  → "모든 피해 +{v}%"   (데이터가 % 를 이미 들고 있다)
 *     fmt:"pct" → "치명타 확률 +{v}"  (데이터에 % 가 없어 코드가 붙여 줘야 한다)
 *   예전 코드는 백분율이면 항상 "%" 를 붙여, mul 계열 11종이 전부 **"+20%%"** 로 찍혔다
 *   (실측 2026-08-12: bls_dmg / spd / as / range / area / exp / magnet / dash / vision /
 *    kb / iframe — PACT 카드 3장 중 대부분이 여기 걸린다).
 *   그래서 「{v} 뒤에 % 가 이미 있으면 붙이지 않는다」로 바꿨다. 데이터를 고치는 대신
 *   코드를 고친 이유는, 두 모양 중 어느 쪽이든 정상 출력이 나오게 해야 다음에 desc 를
 *   새로 쓰는 사람이 같은 함정에 다시 빠지지 않기 때문이다.
 */
function fmtValue(b, value) {
    const pct = b.op === "mul" || b.fmt === "pct";
    if (!pct) return value;
    const n = Math.round(value * 100);
    return b.desc?.includes("{v}%") ? String(n) : n + "%";
}

export class PactSystem {
    constructor(stats) {
        this.stats = stats;
        this.tolls = tollsData.tolls;
        this.blessings = blessingsData.blessings;
        this.cfg = tollsData;

        /** 축복 보유 레벨 */
        this.owned = {};
        /** 대가 태그 중첩 수 */
        this.tagCounts = Object.fromEntries(this.tolls.map((t) => [t.tag, 0]));
        /** 각성한 태그 — S2: 재출현 금지 */
        this.awakened = new Set();
        this.humanity = 100;
        this.rerollLeft = 2;
        /**
         * 각성 필요 중첩. 성소 「각성 촉진」이 낮춘다(3 -> 최저 2.6).
         * ★ 상수를 바꾸지 않고 인스턴스에 두는 이유: AWAKEN_STACKS 는 다른 모듈도 import 하는
         *   전역이라 바꾸면 그 런에만 적용되어야 할 것이 프로세스 전체에 남는다.
         */
        this.awakenStacksOverride = AWAKEN_STACKS;
        this.prevLine = null;  // 직전 녹턴 대사 — 연속 중복을 막는다
        this.lastLine = null;
    }

    /**
     * 등급 추첨. luck 은 common 가중치를 rare/epic 쪽으로 옮긴다.
     * 가중치를 더하는 대신 옮기는 이유: 더하면 총합이 커져 luck 이 커질수록
     * 체감 증가폭이 줄어든다(수확체감). 옮기면 선형으로 오른다.
     */
    rollRarity(rng) {
        const w = this.cfg.rarityWeights;
        const luck = Math.min(0.5, this.stats?.get("luck") ?? 0);
        const shift = w.common * luck;
        const cw = { common: w.common - shift, rare: w.rare + shift * 0.7, epic: w.epic + shift * 0.3 };
        const total = cw.common + cw.rare + cw.epic;
        let r = rng() * total;
        for (const k of RARITIES) { if (r < cw[k]) return k; r -= cw[k]; }
        return "common";
    }

    /** 아직 만렙이 아닌 축복만 후보가 된다 */
    candidates() {
        return this.blessings.filter((b) => (this.owned[b.id] ?? 0) < b.maxLevel);
    }

    /**
     * 카드 3장 생성.
     * @param {number} level 현재 레벨
     * @param {() => number} rng
     */
    generate(level, rng = Math.random) {
        const cards = [];
        const usedBlessings = new Set();
        const usedTags = new Set();

        // S4 — Lv1~3 레벨업은 대가가 없다. 첫 경험이 벌로 시작하면 안 된다
        const noToll = level <= 3;

        for (let i = 0; i < 3; i++) {
            // S3 — 마지막 장까지 Common이 하나도 없으면 강제로 Common
            const forceCommon = i === 2 && !cards.some((c) => c.rarity === "common");
            const rarity = forceCommon ? "common" : this.rollRarity(rng);

            const pool = this.candidates().filter((b) => !usedBlessings.has(b.id));
            // S5(폴백) — 후보가 0개면 "피의 결정"을 준다. 빈 화면이 뜨면 안 된다
            const bls = pool.length ? pool[(rng() * pool.length) | 0] : blessingsData.fallback;
            usedBlessings.add(bls.id);

            const card = {
                index: i,
                rarity,
                blessing: this.describeBlessing(bls, rarity),
                toll: null,
                humanityCost: 0, // 대가가 실제로 붙을 때만 아래에서 매긴다
            };

            if (!noToll) {
                // 상한 초과(각성을 찍는 대가)는 마지막 장에만 허용한다. S3 가 마지막 장에서
                // Common 을 보장하는 것과 같은 자리다 — 3장이 전부 초과 선택지가 되는 것을 막되,
                // "인간성을 태워서라도 태그를 정리한다"는 플레이는 살려 둔다.
                const toll = this.pickToll(rng, usedTags, rarity, i === 2);
                if (toll) {
                    usedTags.add(toll.tag);
                    card.toll = this.describeToll(toll, rarity);
                    // 인간성은 "대가를 받았기 때문에" 준다. 후보 고갈로 대가가 안 붙었는데도
                    // 값을 매기면 플레이어는 아무것도 안 잃고 인간성만 잃는다.
                    card.humanityCost = this.cfg.humanityCost[rarity];
                }
            }
            cards.push(card);
        }
        this.lastLine = this.pickNocturneLine(level, cards, rng);
        return cards;
    }

    /**
     * 녹턴 대사 1줄. (T343 / 정본 01 §5.2, 표시 규칙 10-UIUX §532)
     *
     * ★ 직전과 같은 대사를 금지한다. 12개짜리 풀에서 랜덤을 그냥 뽑으면
     *   두 번 연속 같은 줄이 나올 확률이 8%라, 10회 레벨업이면 거의 매 판 한 번은 겹친다.
     *   그 순간 화자가 "랜덤 문자열 생성기"로 보인다.
     */
    pickNocturneLine(level, cards, rng = Math.random) {
        // Lv1~3 은 대가가 없는 구간(S4). '공짜'를 명시해야 Lv4의 첫 대가가
        // 배신이 아니라 예고된 일이 된다.
        if (level <= 3) return nocturneData.first;

        const imminent = cards.some((c) => c.toll?.triggersAwakening);
        const pool = (imminent ? nocturneData.awaken : nocturneData.pool)
            .filter((l) => l !== this.prevLine);
        const line = pool.length ? pool[(rng() * pool.length) | 0] : nocturneData.pool[0];
        this.prevLine = line;
        return line;
    }

    /** S2 — 각성한 태그는 다시 나오지 않는다. 뒤집은 저주가 또 오면 각성의 의미가 사라진다 */
    /**
     * 대가 태그 추첨. 정본 04-PACT §6.3 의 가중치 보정 3가지를 반영한다.
     *
     * ★ 각성한 태그는 가중치 0 (중복 각성 방지, S2)
     * ★ 각성 상한(2개)에 도달했으면 2중첩 태그를 x0.2 로 낮춘다.
     *   상한 상태에서 3중첩을 찍으면 각성 대신 인간성 −10 만 맞는다(04-PACT §5.4). 그 카드가
     *   자주 나오면 플레이어는 "왜 손해만 보는 선택지를 주지" 라고 느낀다.
     *   0 이 아니라 0.2 인 이유는, 인간성을 태워서라도 태그를 정리하고 싶은
     *   플레이가 존재하기 때문이다 — 막지 않고 드물게만 만든다.
     * ★ 하한(floor)에 닿은 태그는 x0.3. 더 깎여도 수치가 안 변하는 대가는
     *   "공짜 축복"이 되어 선택의 무게가 사라진다.
     * ★ 후보가 **완전히 비면** 폴백으로 이미 각성한 태그를 더 깊게 판다(deepen 주석).
     *   null 은 그 폴백까지 비었을 때만 나온다.
     */
    pickToll(rng, usedTags, rarity = "common", allowOverflow = false) {
        const atCap = this.awakened.size >= AWAKEN_CAP;
        // ★ "3중첩 직전"은 중첩 수가 아니라 "이 카드가 3을 찍게 만드는가"로 판정해야 한다.
        //   2중첩만 보면, 1중첩 태그가 Epic 카드(+2중첩)로 한 번에 3을 찍는 경로가 그물을
        //   그대로 빠져나간다. 실측에서 런당 각성이 상한 2를 크게 넘어 평균 5회가 나왔고,
        //   초과분마다 인간성이 깎여 그게 사실상 기본값이 되어 있었다.
        const addStacks = this.cfg.rarityStacks[rarity] ?? 1;
        const pool = [];
        const weights = [];
        let total = 0;
        /**
         * ★ 폴백 후보 (2026-08-12) — 본 후보(pool)가 **완전히 비었을 때만** 쓴다.
         *
         *   위 규칙대로 각성 2개가 영구 제외되고 남은 4태그가 전부 2중첩에 닿으면 후보가 0이 된다.
         *   그 자체는 의도된 동작이지만("녹턴이 더 가져갈 게 없다"), 실측은 그 상태가 후반의
         *   기본값임을 보여줬다 — 800런 x2 에서 Lv16 21% / Lv20 54% / Lv28~30 66% 의 카드가
         *   **대가 없이** 나왔다. 대가 없는 축복이 후반의 3분의 2가 되면 PACT 가 아니다.
         *
         *   그래서 **이미 각성한 태그를 더 깊게 판다**. 두 조건을 모두 만족하는 것만 쓴다:
         *     ① PENALTY_KEPT — 각성 후에도 페널티가 남는 태그(FRAIL/HUNGER/BLIND).
         *        removePenalty:true 인 태그는 모디파이어가 이미 제거됐으므로 더 쌓아도 안 아프다.
         *     ② !isSaturated — 하한/상한에 닿지 않았다. 닿은 뒤에는 수치가 안 변해 역시 가짜 비용이다.
         *   ★ 상한이 깨지지 않는 이유: AwakeningSystem.trigger 가 첫 줄에서 this.has(tag) 로 막는다.
         *     같은 태그는 두 번 각성하지 않으므로 MAX_AWAKENINGS 검사에 아예 닿지 않고,
         *     따라서 overflow() 의 인간성 감소도 발생하지 않는다. describeToll 쪽도 마찬가지다 —
         *     cur 이 이미 3 이상이라 triggersAwakening 이 false 로 굳는다.
         */
        const deepen = [];
        for (const t of this.tolls) {
            if (usedTags.has(t.tag)) continue;
            if (this.awakened.has(t.tag)) {
                if (PENALTY_KEPT.has(t.tag) && !this.isSaturated(t)) deepen.push(t);
                continue;
            }
            let w = 1;
            const cur = this.tagCounts[t.tag] ?? 0;
            // ★ 정본 §6.3 은 x0.2 로 "낮추라"고 하지만, 실측에서 그것으로는 못 막는다.
            //   상한 도달 시 남은 태그가 4개인데 카드는 3장이라 가중치를 아무리 낮춰도
            //   3장이 전부 채워진다(풀 크기 ≈ 뽑는 수). 800런 시뮬 결과 상한 초과가
            //   런당 2.6~3.1회 발생해 인간성 −52~62 가 추가되고, 그 결과
            //   「완전 흡혈귀화」가 무작위 96.6% / 욕심 100% 로 터졌다.
            //   P2 특수 상태가 기본값이 되고 엔딩 3분기가 진조 하나로 붕괴한다.
            //   그래서 후보에서 통째로 뺀다 — 남는 게 없으면 그 카드는 대가가 없다.
            //   녹턴이 그 방향으로는 더 가져갈 게 없다는 뜻이라 서사와도 맞는다.
            const willOverflow = atCap && cur + addStacks >= this.awakenStacksOverride;
            if (willOverflow && !allowOverflow) continue;
            if (willOverflow) w *= 0.2; // 정본 §6.3 — 남겨두되 드물게
            if (this.isAtFloor(t)) w *= 0.3;
            pool.push(t); weights.push(w); total += w;
        }
        if (!pool.length) {
            // 폴백조차 비었으면 그때는 정말로 가져갈 것이 없다. 대가 없는 카드가 그 자리에 남는다.
            if (!deepen.length) return null;
            return deepen[(rng() * deepen.length) | 0];
        }
        let r = rng() * total;
        for (let i = 0; i < pool.length; i++) { if (r < weights[i]) return pool[i]; r -= weights[i]; }
        return pool[pool.length - 1];
    }

    /** 해당 대가의 스탯이 이미 하한에 닿았는가 — 더 깎아도 수치가 변하지 않는다 */
    isAtFloor(t) {
        if (!this.stats) return false;
        const cur = this.stats.get(t.stat);
        const floor = this.stats.floorOf?.(t.stat);
        if (floor == null || cur == null) return false;
        // 하한까지 1% 이내면 사실상 도달로 본다. 부동소수 오차로 영원히 false 가 되는 것을 막는다.
        return cur <= floor * 1.01;
    }

    /**
     * 더 쌓아도 수치가 **실제로** 변하지 않는가. 폴백 후보를 거르는 기준이다.
     * ★ isAtFloor 와 따로 두는 이유: StatSystem.floorOf 는 cap 형(HUNGER 의 drain)에 대해
     *   null 을 돌려주므로 isAtFloor 가 영원히 false 다. 갈증은 하한이 아니라 **상한**(4.0/초)에
     *   막히는데, 그 지점을 넘긴 뒤로도 계속 폴백에 남으면 무한 공짜 대가가 된다.
     *   상한 값의 출처는 tolls.json 의 floor/floorType 이다(StatSystem.FLOORS 와 같은 표).
     */
    isSaturated(t) {
        if (!this.stats) return false;
        if (t.floorType === "cap") {
            const cur = this.stats.get(t.stat);
            return cur != null && cur >= t.floor * 0.99;
        }
        return this.isAtFloor(t);
    }

    describeBlessing(b, rarity) {
        const lv = this.owned[b.id] ?? 0;
        const tier = { common: 0, rare: 1, epic: 2 }[rarity];
        const value = Array.isArray(b.value) ? b.value[tier] : null;
        return {
            id: b.id, name: b.name, op: b.op, stat: b.stat, target: b.target,
            value, tier,
            level: lv + 1,
            maxLevel: b.maxLevel,
            desc: b.desc ? b.desc.replace("{v}", fmtValue(b, value)) : "",
        };
    }

    describeToll(t, rarity) {
        const mult = this.cfg.rarityMult[rarity];
        const stacks = this.cfg.rarityStacks[rarity];
        const cur = this.tagCounts[t.tag] ?? 0;
        const after = cur + stacks;
        const amount = t.rate * mult;
        return {
            tag: t.tag, name: t.name, stat: t.stat, stacks,
            amount,
            stacksBefore: cur,
            stacksAfter: after,
            /** T342 — 이 카드를 고르면 각성하는가 */
            triggersAwakening: cur < this.awakenStacksOverride && after >= this.awakenStacksOverride,
            desc: t.desc.replace("{v}", t.stat === "drain" ? amount.toFixed(1) : Math.round(amount * 100)),
            feel: t.feel,
        };
    }

    /** 카드 선택 적용 (T350) */
    choose(card) {
        const b = card.blessing;
        this.owned[b.id] = b.level;

        if (b.op === "add") this.stats.add(b.stat, "add", b.value, "bls:" + b.id);
        else if (b.op === "mul") this.stats.add(b.stat, "mul", b.value, "bls:" + b.id);
        // op === "weapon" 은 무기 획득/레벨업. 스탯이 아니므로 StatSystem 을 거치지 않고
        // choose() 의 반환값으로 CombatSystem 에 넘긴다.
        const weapon = b.op === "weapon" ? { target: b.target, level: b.level } : null;

        if (card.toll) {
            const t = card.toll;
            this.tagCounts[t.tag] = t.stacksAfter;
            this.humanity = Math.max(0, this.humanity - card.humanityCost);
            for (let i = 0; i < t.stacks; i++) {
                const op = t.stat === "drain" ? "tollAdd" : "toll";
                this.stats.add(t.stat, op, t.amount, "toll:" + t.tag);
            }
        }
        return {
            awakened: card.toll?.triggersAwakening ? card.toll.tag : null,
            humanity: this.humanity,
            tagCounts: { ...this.tagCounts },
            weapon,
        };
    }

    consumeReroll() {
        if (this.rerollLeft <= 0) return false;
        this.rerollLeft--;
        return true;
    }
}
