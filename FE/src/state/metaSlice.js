/**
 * metaSlice — 런을 넘어 유지되는 영구 진행도. 세이브 대상은 이 슬라이스와 settings 뿐이다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 세이브 스키마는 08-DATA-SCHEMA.md 4
 */
import sanctumData from "@/data/sanctum.json";
import { defaultSave, emptyStageClears } from "@/save/save";

/** 성소 6종. 데이터가 정본이고 UI는 이 배열을 그대로 그린다(수치를 화면에 하드코딩하지 않는다). */
export const SANCTUM_UPGRADES = sanctumData.upgrades;

const META_INIT = {
    gold: 0,
    upgrades: {}, // { [metaUpgradeId]: level }
    unlocked: [], // ["stage2", "char2", ...]
    codex: [], // 발동 경험한 각성 id 목록
    stats: defaultSave().stats, // 누적 통계 (08-DATA-SCHEMA 4.3)
};

/**
 * 스토어의 stats → StageSystem.isUnlocked(id, save) 가 먹는 진행도 객체.
 *
 * ★ 계약은 `{ clears: { stage1: 횟수 }, awakenCount: n }` 하나뿐이다. 해금 판정 로직은
 *   StageSystem.evalUnlock 에만 있고 여기서 다시 구현하지 않는다 — 두 벌이 되면
 *   화면에는 열렸는데 게임은 안 열리는(또는 그 반대) 사고가 난다.
 * ★ awakenCount 를 위해 필드를 새로 만들지 않는다. 이미 누적 중인 stats.totalAwakenings 가
 *   "각성을 몇 번 발동했는가" 와 정확히 같은 값이라, 새 필드를 만들면 두 숫자가 갈라진다.
 */
export function unlockProgress(stats) {
    return {
        clears: { ...(stats?.stageClears ?? {}) },
        awakenCount: stats?.totalAwakenings ?? 0,
    };
}

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

    /**
     * 스테이지 클리어 1회 기록. 해금의 유일한 입력이다.
     * ★ bumpStats 를 쓰지 않는 이유: bumpStats 는 값을 숫자로 더하는데 stageClears 는 맵이다.
     *   patch 로 넘기면 객체 + 객체 = "[object Object][object Object]" 가 되어 조용히 망가진다.
     */
    recordStageClear: (stageId) =>
        set((s) => {
            if (!stageId) return s;
            const prev = s.stats.stageClears ?? {};
            return {
                stats: {
                    ...s.stats,
                    stageClears: { ...prev, [stageId]: (prev[stageId] ?? 0) + 1 },
                },
            };
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
            // ★ 얕은 병합이라 stageClears 는 세이브 쪽 객체가 통째로 들어온다.
            //   save.js 의 normalize 가 이미 기본 키(전 스테이지 0)를 채워 두었고
            //   구버전 세이브의 스테이지1 클리어도 거기서 접어 준다. 여기서는 방어만 한다.
            stats: {
                ...META_INIT.stats,
                ...(save?.stats ?? {}),
                stageClears: { ...emptyStageClears(), ...(save?.stats?.stageClears ?? {}) },
            },
        }),
});
