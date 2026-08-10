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

export const AWAKEN_STACKS = 3;
const RARITIES = ["common", "rare", "epic"];

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
                humanityCost: noToll ? 0 : this.cfg.humanityCost[rarity],
            };

            if (!noToll) {
                const toll = this.pickToll(rng, usedTags);
                if (toll) {
                    usedTags.add(toll.tag);
                    card.toll = this.describeToll(toll, rarity);
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
    pickToll(rng, usedTags) {
        const pool = this.tolls.filter((t) => !this.awakened.has(t.tag) && !usedTags.has(t.tag));
        if (!pool.length) return null;
        return pool[(rng() * pool.length) | 0];
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
            desc: b.desc ? b.desc.replace("{v}", (b.op === "mul" || b.fmt === "pct") ? Math.round(value * 100) + "%" : value) : "",
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
            triggersAwakening: cur < AWAKEN_STACKS && after >= AWAKEN_STACKS,
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
