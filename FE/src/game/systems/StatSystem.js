/**
 * StatSystem — 모디파이어 배열 + dirty flag. (T310/T311)
 *
 * 규격: 06-TECH-DESIGN.md 6 / 04-PACT-SYSTEM 4
 *
 * ★ 계산 순서를 고정한다: 기본값 → 가산 → 곱연산 → 대가 → 각성 → 하한(floor)
 *   순서가 뒤집히면 밸런스가 붕괴한다. 예를 들어 대가를 가산 이전에 적용하면
 *   같은 "maxHp −12%"가 훨씬 크게 깎여 FRAIL이 즉사기가 된다.
 *
 * ★ dirty flag — 스탯은 레벨업(정지 시점)에만 바뀐다.
 *   매 프레임 재계산하면 낭비다. 바뀔 때만 다시 굴린다.
 */
const BASE = {
    maxHp: 100,      // 정본 03-GDD 4
    moveSpeed: 70,
    damage: 1,       // 배율
    haste: 1,        // 공격 속도 배율
    range: 1,        // 사거리 배율
    area: 1,         // 범위 배율
    expMult: 1,
    magnet: 1,
    regen: 0,        // 초당 HP 회복
    drain: 0,        // 초당 HP 감소 (HUNGER)
    vision: 360,     // px
    dashCd: 1,       // 배율
    knockback: 1,
};

/** 안전장치 S1 — 모든 대가에 하한이 있어야 한다 (04-PACT 4) */
const FLOORS = {
    maxHp: { type: "abs", v: 25 },
    moveSpeed: { type: "abs", v: 32 },
    range: { type: "mult", v: 0.35 },
    expMult: { type: "mult", v: 0.40 },
    vision: { type: "abs", v: 90 },
    drain: { type: "cap", v: 4.0 },
};

export class StatSystem {
    constructor() {
        /** @type {{stat:string, op:string, value:number, src:string}[]} */
        this.mods = [];
        this.dirty = true;
        this.cache = { ...BASE };
    }

    add(stat, op, value, src) {
        this.mods.push({ stat, op, value, src });
        this.dirty = true;
    }

    /** 각성으로 태그가 뒤집히면 해당 대가 모디파이어를 제거한다 */
    removeBySrc(src) {
        const before = this.mods.length;
        this.mods = this.mods.filter((m) => m.src !== src);
        if (this.mods.length !== before) this.dirty = true;
    }

    get(stat) {
        if (this.dirty) this.recalc();
        return this.cache[stat];
    }

    get all() {
        if (this.dirty) this.recalc();
        return this.cache;
    }

    recalc() {
        const out = { ...BASE };

        // 1) 가산
        for (const m of this.mods) if (m.op === "add") out[m.stat] = (out[m.stat] ?? 0) + m.value;
        // 2) 곱연산 (축복)
        for (const m of this.mods) if (m.op === "mul") out[m.stat] = (out[m.stat] ?? 1) * (1 + m.value);
        // 3) 대가 (곱연산 감소)
        for (const m of this.mods) if (m.op === "toll") out[m.stat] = (out[m.stat] ?? 1) * (1 - m.value);
        // 3-b) 대가 중 가산형 (HUNGER 드레인)
        for (const m of this.mods) if (m.op === "tollAdd") out[m.stat] = (out[m.stat] ?? 0) + m.value;
        // 4) 각성 (대가를 뒤집은 보정)
        for (const m of this.mods) if (m.op === "awaken") out[m.stat] = (out[m.stat] ?? 1) * (1 + m.value);

        // 5) 하한 — 반드시 마지막. 게임이 성립 불가능해지는 것을 막는다
        for (const stat in FLOORS) {
            const f = FLOORS[stat];
            if (f.type === "abs") out[stat] = Math.max(f.v, out[stat]);
            else if (f.type === "mult") out[stat] = Math.max(f.v, out[stat]);
            else if (f.type === "cap") out[stat] = Math.min(f.v, out[stat]);
        }

        this.cache = out;
        this.dirty = false;
        return out;
    }
}

export { BASE as BASE_STATS, FLOORS as STAT_FLOORS };
