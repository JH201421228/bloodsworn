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
    /**
     * 무기별 룬 슬롯 조망 (31 §6.2). [{ weaponId, name, level, t1, t2, t3 }]
     * ★ T112 기준을 통과하는 이유: 룬은 조우에서만, 무기 레벨은 레벨업에서만 바뀐다 —
     *   둘 다 게임이 멈춰 있거나 수십 초에 한 번인 사건이다. DPS·쿨다운은 여기 절대 안 들어온다.
     */
    runes: [],
    rerollLeft: 2,
    /** T511 완전 흡혈귀화. 인간성 0에서 켜지고 런이 끝날 때까지 꺼지지 않는다(단방향). */
    ascended: false,
    bossHp: null, // { hp, maxHp, phase } — 200ms 스로틀로만 갱신
    lastResult: null, // RunStats
};

export const createRunSlice = (set) => ({
    ...RUN_INIT,

    /**
     * ★ lastResult 는 일부러 남긴다. 결과 화면에서 [다시 하기]를 누르면 런이 먼저 시작되고
     *   결과 화면이 언마운트되는데, 그 사이 lastResult 가 null 이 되면 한 프레임 동안
     *   빈 결과 화면이 깜빡인다. 다음 RUN_ENDED 가 어차피 덮어쓴다.
     */
    resetRun: (rerollLeft = RUN_INIT.rerollLeft) => {
        const { lastResult: _keep, ...rest } = RUN_INIT;
        set({ ...rest, tagCounts: emptyTagCounts(), rerollLeft });
    },

    applyPactResult: (p) =>
        set((s) => ({
            level: p.level,
            humanity: p.humanity,
            tagCounts: p.tagCounts,
            ownedBlessings: p.ownedBlessings,
            // 인간성은 회복 수단이 없다(04-PACT 8). 0을 한 번 찍으면 그대로 흡혈귀화다.
            ascended: s.ascended || p.humanity <= 0,
        })),

    setHumanity: (humanity) =>
        set((s) => ({ humanity, ascended: s.ascended || humanity <= 0 })),

    setAscended: () => set({ humanity: 0, ascended: true }),

    pushAwakening: (a) => set((s) => ({ awakenings: [...s.awakenings, a] })),

    consumeReroll: () => set((s) => ({ rerollLeft: Math.max(0, s.rerollLeft - 1) })),

    setRerollLeft: (rerollLeft) => set({ rerollLeft }),

    setRunes: (runes) => set({ runes }),

    setBossHp: (bossHp) => set({ bossHp }),

    setResult: (lastResult) => set({ lastResult }),
});
