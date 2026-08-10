/**
 * metaSlice — 런을 넘어 유지되는 영구 진행도. 세이브 대상은 이 슬라이스와 settings 뿐이다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 세이브 스키마는 08-DATA-SCHEMA.md 4
 */
import sanctumData from "@/data/sanctum.json";
import { defaultSave } from "@/save/save";

/** 성소 6종. 데이터가 정본이고 UI는 이 배열을 그대로 그린다(수치를 화면에 하드코딩하지 않는다). */
export const SANCTUM_UPGRADES = sanctumData.upgrades;

const META_INIT = {
    gold: 0,
    upgrades: {}, // { [metaUpgradeId]: level }
    unlocked: [], // ["stage2", "char2", ...]
    codex: [], // 발동 경험한 각성 id 목록
    stats: defaultSave().stats, // 누적 통계 (08-DATA-SCHEMA 4.3)
};

/** 다음 단계 비용. 만렙이면 null — UI가 "MAX"로 그린다. */
export function nextCost(def, level) {
    if (!def || level >= def.maxLevel) return null;
    return def.costs[level];
}

export const createMetaSlice = (set) => ({
    ...META_INIT,

    addGold: (n) => set((s) => ({ gold: Math.max(0, s.gold + n) })),

    /** 성소 구매. 골드 차감과 레벨 증가를 한 번의 set으로 묶어 중간 상태가 렌더되지 않게 한다. */
    buyUpgrade: (id, cost) =>
        set((s) => {
            const def = SANCTUM_UPGRADES.find((u) => u.id === id);
            const level = s.upgrades[id] ?? 0;
            // ★ 상한 검사를 스토어에서 한다. 버튼 disabled 만 믿으면 연타 한 번에 6단계가 된다.
            if (!def || level >= def.maxLevel || s.gold < cost) return s;
            return {
                gold: s.gold - cost,
                upgrades: { ...s.upgrades, [id]: level + 1 },
            };
        }),

    unlock: (key) =>
        set((s) => (s.unlocked.includes(key) ? s : { unlocked: [...s.unlocked, key] })),

    addCodex: (awakeningId) =>
        set((s) => (s.codex.includes(awakeningId) ? s : { codex: [...s.codex, awakeningId] })),

    /**
     * 누적 통계 가산. { runs: 1, totalKills: 412 } 처럼 "증분"을 준다.
     * bestTimeSec 처럼 최대값이어야 하는 항목은 여기 넣지 말고 setStatMax 를 쓴다.
     */
    bumpStats: (patch) =>
        set((s) => {
            const stats = { ...s.stats };
            for (const [k, v] of Object.entries(patch)) stats[k] = (stats[k] ?? 0) + v;
            return { stats };
        }),

    setStatMax: (key, value) =>
        set((s) => ((s.stats[key] ?? 0) >= value ? s : { stats: { ...s.stats, [key]: value } })),

    /** 세이브에서 읽어온 값으로 덮어쓴다. 부팅 시 1회. */
    hydrate: (save) =>
        set({
            gold: save?.gold ?? META_INIT.gold,
            upgrades: save?.sanctum ? { ...save.sanctum } : { ...META_INIT.upgrades },
            unlocked: save?.unlocks
                ? Object.keys(save.unlocks).filter((k) => save.unlocks[k] === true)
                : [],
            codex: save?.unlocks?.awakenCodex ? [...save.unlocks.awakenCodex] : [],
            stats: { ...META_INIT.stats, ...(save?.stats ?? {}) },
        }),
});
