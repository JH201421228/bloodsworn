/**
 * uiSlice — 어떤 화면/오버레이가 떠 있는가. React 렌더 트리를 결정하는 유일한 소스.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 화면 상태 머신 10-UIUX-LANDSCAPE.md 10.4
 * ★ 화면 전환은 라우터가 아니라 이 값으로 한다(T103에서 react-router를 제거한 이유).
 *   Phaser 캔버스는 앱 수명 내내 마운트된 채이고, 화면은 그 위에 얹히는 오버레이일 뿐이다.
 *
 * ★ 스테이지 선택은 SCREENS 를 늘리지 않고 타이틀의 하위 상태(`stageSelect`)로 뒀다.
 *   전면 화면 목록을 늘리면 UiLayer(다른 작업자 소유)를 함께 고쳐야 하고, 그 패치가
 *   안 들어오는 순간 [런 시작] 이 빈 화면으로 떨어진다. 하위 상태면 TitleScreen 안에서
 *   끝나므로 이 작업만으로 완결된다. 승격이 필요하면 보고서의 UiLayer 패치를 쓴다.
 *   "닫으면 원래 자리로 돌아간다"(10-UIUX 1.1)도 modal 과 같은 이유로 그대로 성립한다.
 */

import stagesData from "@/data/stages.json";

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

    // ── 스테이지 선택 (S-1) ──
    /** 타이틀 위에 덮이는 출정지 선택. true 면 TitleScreen 이 StageSelectScreen 을 그린다. */
    stageSelect: false,
    /**
     * 마지막으로 고른 스테이지. Phaser registry 에 심는 값의 원본이고,
     * 런이 끝났을 때 "어느 스테이지를 깼는가"를 아는 유일한 근거이기도 하다.
     * ★ 세이브에는 넣지 않는다. 앱을 껐다 켜면 해금된 마지막 스테이지가 기본 선택된다.
     */
    selectedStageId: stagesData.defaultStageId ?? "stage1",
};

export const createUiSlice = (set, get) => ({
    ...UI_INIT,

    // ★ 화면을 갈아탈 때 스테이지 선택도 반드시 닫는다. 안 닫으면 결과 화면에서
    //   타이틀로 돌아왔을 때 출정지 화면이 그대로 떠 있어 "뒤로가 안 먹는다"로 보인다.
    setScreen: (screen) => set({ screen, modal: null, confirm: null, stageSelect: false }),
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

    /** 타이틀 [런 시작] → 출정지 선택. 바로 런을 시작하지 않는다. */
    openStageSelect: () => set({ screen: SCREENS.TITLE, modal: null, confirm: null, stageSelect: true }),
    closeStageSelect: () => set({ stageSelect: false }),
    setSelectedStage: (selectedStageId) => set({ selectedStageId }),

    setLoadProgress: (loadProgress) => set({ loadProgress }),
});
