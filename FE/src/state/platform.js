/**
 * ★ 광고가 뜨면 안드로이드에서 WebView 가 백그라운드로 간다. 그대로 두면
 *   "앱이 백그라운드로 갔다"고 판단해 엉뚱한 일시정지 모달이 뜨고, 광고를 닫아도 남는다.
 *   광고 표시 구간에만 이 플래그를 세워 그 판정을 건너뛴다.
 */
let adInFlight = false;
export function setAdInFlight(v) { adInFlight = Boolean(v); }
export function isAdInFlight() { return adInFlight; }

/**
 * platform — Capacitor 네이티브 연동. 안드로이드 뒤로가기(T632)와 백그라운드 자동 일시정지(T633).
 *
 * ★ `@capacitor/app` 을 정적 import 하지 않는다. 아직 설치되어 있지 않아 번들러가 즉시 깨진다.
 *   네이티브에서는 패키지 없이도 브리지가 `window.Capacitor.Plugins.App` 을 주입하므로
 *   전역을 먼저 본다 — 설치 후에도 이 파일을 고칠 필요가 없다. (설치 명령은 보고서 참조)
 * ★ 실패는 전부 무시한다. 웹 브라우저에서는 이 기능이 없는 게 정상이다.
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { useStore } from "./store";
import { SCREENS, MODALS } from "./uiSlice";

const APP_MODULE = "@capacitor/app";

async function getCapApp() {
    const injected = globalThis.Capacitor?.Plugins?.App;
    if (injected) return injected;
    try {
        const m = await import(/* @vite-ignore */ APP_MODULE);
        return m?.App ?? null;
    } catch {
        return null;
    }
}

/**
 * 안드로이드 back 1회의 의미를 결정한다. 규격: 10-UIUX-LANDSCAPE.md 1.1 / 10.4 — "항상 한 단계 뒤로".
 * @returns {boolean} true면 앱을 종료해도 되는 지점(타이틀)
 */
export function handleBack() {
    const s = useStore.getState();

    // ★ PACT 카드가 떠 있으면 back을 무시한다(10-UIUX 10.4).
    //   선택을 강제하는 화면이라서다. 막다른 길은 아니다 — "거절한다" 버튼이 있다.
    if (s.pact.open) return false;

    if (s.modal === MODALS.CONFIRM) {
        s.closeConfirm();
        return false;
    }
    if (s.modal === MODALS.OPTIONS || s.modal === MODALS.CREDITS) {
        // 일시정지 위에 얹힌 옵션이면 일시정지로 돌아간다(오버레이는 스택이다).
        s.setModal(s.screen === SCREENS.PLAYING ? MODALS.PAUSE : null);
        return false;
    }
    if (s.modal === MODALS.PAUSE) {
        EventBus.emit(EVENTS.CMD_RESUME);
        s.setModal(null);
        return false;
    }

    switch (s.screen) {
        case SCREENS.SANCTUM:
        case SCREENS.RESULT:
            s.setScreen(SCREENS.TITLE);
            return false;
        case SCREENS.PLAYING:
            EventBus.emit(EVENTS.CMD_PAUSE);
            s.setModal(MODALS.PAUSE);
            return false;
        case SCREENS.TITLE:
            return true; // 종료 확인은 호출부가 띄운다
        default:
            return false;
    }
}

/** 앱이 백그라운드로 갔다. 런 중이면 무조건 멈춘다 — 안 멈추면 돌아왔을 때 죽어 있다(T633). */
export function handleBackground() {
    // 광고 표시 중은 백그라운드가 아니다. 그대로 두면 광고를 닫아도 일시정지 모달이 남는다.
    if (adInFlight) return;
    const s = useStore.getState();
    if (s.screen !== SCREENS.PLAYING || s.pact.open || s.modal) return;
    EventBus.emit(EVENTS.CMD_PAUSE);
    s.setModal(MODALS.PAUSE);
}

/**
 * 부팅 시 1회. 반환값을 useEffect cleanup 으로 넘긴다.
 * ★ 비동기로 리스너를 붙이므로, 붙기 전에 언마운트되면 즉시 떼도록 cancelled 플래그를 둔다.
 */
export function installPlatform() {
    let cancelled = false;
    const handles = [];

    // 웹 폴백. 개발 중 탭을 옮겨도 런이 진행되면 밸런스 감각이 오염된다.
    const onVisibility = () => {
        if (document.visibilityState === "hidden") handleBackground();
    };
    document.addEventListener("visibilitychange", onVisibility);

    getCapApp().then((App) => {
        if (!App || cancelled) return;

        App.addListener("backButton", () => {
            if (!handleBack()) return;
            const s = useStore.getState();
            s.openConfirm({
                title: "게임을 종료할까",
                body: "저장된 진행도는 남는다.",
                confirmLabel: "종료",
                danger: true,
                onConfirm: () => App.exitApp?.(),
            });
        }).then((h) => (cancelled ? h.remove?.() : handles.push(h)));

        App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) handleBackground();
        }).then((h) => (cancelled ? h.remove?.() : handles.push(h)));
    });

    return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisibility);
        handles.forEach((h) => h?.remove?.());
        handles.length = 0;
    };
}
