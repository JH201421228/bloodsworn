/**
 * runSlice — 한 런 동안의 "정지 시점" 상태. 런 시작 시 resetRun()으로 초기화한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4
 *
 * ★ T112 — 여기에 들어올 수 있는 값의 유일한 기준: "게임이 정지된 순간에만 바뀌는가?"
 *   HP / EXP / 남은 시간 / 처치수는 60fps로 바뀐다 → 절대 여기 넣지 않는다. HudScene이 직접 그린다.
 *   bossHp만 예외적으로 들어오되 200ms 스로틀로만 갱신한다(HP바 폭이 React 책임이라서다).
 */
import { TOLL_TAGS } from "@/game/constants";

const emptyTagCounts = () => Object.fromEntries(TOLL_TAGS.map((t) => [t, 0]));

const RUN_INIT = {
    level: 1,
    humanity: 100,
    tagCounts: emptyTagCounts(),
    awakenings: [], // [{ tag, awakeningId, name, atLevel }]
    ownedBlessings: {}, // { [blessingId]: level }
    rerollLeft: 2,
    bossHp: null, // { hp, maxHp, phase } — 200ms 스로틀로만 갱신
    lastResult: null, // RunStats
};

export const createRunSlice = (set) => ({
    ...RUN_INIT,

    resetRun: (rerollLeft = RUN_INIT.rerollLeft) =>
        set({ ...RUN_INIT, tagCounts: emptyTagCounts(), rerollLeft }),

    applyPactResult: (p) =>
        set({
            level: p.level,
            humanity: p.humanity,
            tagCounts: p.tagCounts,
            ownedBlessings: p.ownedBlessings,
        }),

    pushAwakening: (a) => set((s) => ({ awakenings: [...s.awakenings, a] })),

    consumeReroll: () => set((s) => ({ rerollLeft: Math.max(0, s.rerollLeft - 1) })),

    setBossHp: (bossHp) => set({ bossHp }),

    setResult: (lastResult) => set({ lastResult }),
});
