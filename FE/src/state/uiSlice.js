/**
 * uiSlice — 어떤 화면/오버레이가 떠 있는가. React 렌더 트리를 결정하는 유일한 소스.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4
 * ★ 화면 전환은 라우터가 아니라 이 값으로 한다(T103에서 react-router를 제거한 이유).
 *   Phaser 캔버스는 앱 수명 내내 마운트된 채이고, 화면은 그 위에 얹히는 오버레이일 뿐이다.
 */

export const SCREENS = {
    LOADING: "loading",
    TITLE: "title",
    SANCTUM: "sanctum",
    PLAYING: "playing",
    RESULT: "result",
};

const UI_INIT = {
    screen: SCREENS.LOADING,
    modal: null, // null | "options" | "pause" | "codex"
    pact: { open: false, cards: [], nocturneLine: null, canSkip: true },
    awakeningBanner: null, // { name, tag } — 표시 중에만 non-null
    loadProgress: 0, // 0..1
};

export const createUiSlice = (set) => ({
    ...UI_INIT,

    setScreen: (screen) => set({ screen, modal: null }),
    setModal: (modal) => set({ modal }),

    openPact: (payload) =>
        set({
            pact: {
                open: true,
                cards: payload.cards ?? [],
                nocturneLine: payload.nocturneLine ?? null,
                canSkip: payload.canSkip ?? true,
            },
        }),
    closePact: () => set({ pact: { ...UI_INIT.pact } }),

    showAwakening: (banner) => set({ awakeningBanner: banner }),
    hideAwakening: () => set({ awakeningBanner: null }),

    setLoadProgress: (loadProgress) => set({ loadProgress }),
});
