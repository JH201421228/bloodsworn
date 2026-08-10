/**
 * uiSlice — 어떤 화면/오버레이가 떠 있는가. React 렌더 트리를 결정하는 유일한 소스.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 화면 상태 머신 10-UIUX-LANDSCAPE.md 10.4
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

/**
 * modal 은 screen 위에 겹치는 한 겹이다. 옵션/크레딧을 screen 으로 만들지 않은 이유:
 * 10-UIUX 1.1 이 "닫으면 원래 있던 곳으로 돌아간다"를 요구하는데, modal 이면 복귀 대상을
 * 따로 기억할 필요가 없다. 타이틀에서 열든 일시정지에서 열든 닫으면 그 자리다.
 */
export const MODALS = {
    OPTIONS: "options",
    CREDITS: "credits",
    PAUSE: "pause",
    CONFIRM: "confirm",
};

const UI_INIT = {
    screen: SCREENS.LOADING,
    modal: null, // null | "options" | "credits" | "pause" | "confirm"
    /** modal="confirm" 일 때의 내용. { title, body, confirmLabel, danger, onConfirm } */
    confirm: null,
    pact: { open: false, cards: [], nocturneLine: null, canSkip: true },
    awakeningBanner: null, // { name, tag } — 표시 중에만 non-null
    loadProgress: 0, // 0..1
};

export const createUiSlice = (set, get) => ({
    ...UI_INIT,

    setScreen: (screen) => set({ screen, modal: null, confirm: null }),
    setModal: (modal) => set({ modal, confirm: modal === MODALS.CONFIRM ? get().confirm : null }),

    /** 확인 다이얼로그. 포기·세이브 삭제처럼 되돌릴 수 없는 조작에만 쓴다(10-UIUX 2.7 / 2.10). */
    openConfirm: (confirm) => set({ modal: MODALS.CONFIRM, confirm }),
    closeConfirm: () => set({ modal: null, confirm: null }),

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
