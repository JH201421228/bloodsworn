/**
 * metaSlice — 런을 넘어 유지되는 영구 진행도. 세이브 대상은 이 슬라이스뿐이다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 세이브 스키마는 08-DATA-SCHEMA.md 4
 */

const META_INIT = {
    gold: 0,
    upgrades: {}, // { [metaUpgradeId]: level }
    unlocked: [], // ["stage2", "char2", ...]
    codex: [], // 발동 경험한 각성 id 목록
};

export const createMetaSlice = (set) => ({
    ...META_INIT,

    addGold: (n) => set((s) => ({ gold: Math.max(0, s.gold + n) })),

    /** 성소 구매. 골드 차감과 레벨 증가를 한 번의 set으로 묶어 중간 상태가 렌더되지 않게 한다. */
    buyUpgrade: (id, cost) =>
        set((s) => {
            if (s.gold < cost) return s;
            return {
                gold: s.gold - cost,
                upgrades: { ...s.upgrades, [id]: (s.upgrades[id] ?? 0) + 1 },
            };
        }),

    unlock: (key) =>
        set((s) => (s.unlocked.includes(key) ? s : { unlocked: [...s.unlocked, key] })),

    addCodex: (awakeningId) =>
        set((s) => (s.codex.includes(awakeningId) ? s : { codex: [...s.codex, awakeningId] })),

    /** 세이브에서 읽어온 값으로 덮어쓴다. 부팅 시 1회. */
    hydrate: (save) =>
        set({
            gold: save?.gold ?? META_INIT.gold,
            upgrades: save?.sanctum ?? META_INIT.upgrades,
            unlocked: save?.unlocks ? Object.keys(save.unlocks).filter((k) => save.unlocks[k]) : [],
            codex: save?.unlocks?.awakenCodex ?? META_INIT.codex,
        }),
});
