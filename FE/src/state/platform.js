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
 * ★ `@capacitor/app` 7.x 와 `@capacitor/toast` 7.x 를 쓴다. **동적 import 지만 `@vite-ignore` 는 붙이지 않는다** —
 *   붙이면 Vite 가 지정자를 그대로 남겨 WebView 가 "@capacitor/app" 을 URL 로 해석하고 404 가 난다.
 *   그러면 리스너가 영영 안 붙어 **뒤로가기가 안드로이드 기본 동작(=즉시 종료)으로 떨어진다.**
 *   실제로 이 프로젝트가 그 상태였다. 플러그인 미설치 시절의 흔적이었다.
 * ★ 실패는 전부 무시한다. 웹 브라우저에서는 이 기능이 없는 게 정상이다.
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { useStore } from "./store";
import { SCREENS, MODALS } from "./uiSlice";

/**
 * ★★ 플러그인 핸들은 반드시 `{ plugin }` 으로 감싸 돌려준다. 그대로 return 하지 마라. ★★
 *   Capacitor 플러그인은 Proxy 라서 `then` 접근까지 네이티브 호출로 바꾼다 → 자바스크립트가
 *   thenable 로 착각한다 → async 함수가 그대로 return 하면 Promise 해결 절차가 `App.then()` 을
 *   호출하고 네이티브가 거부해 **함수 전체가 reject 된다.** 한 겹 감싸는 것이 유일한 해법이다.
 */
async function getCapApp() {
    if (!isNative()) return null;
    try {
        const m = await import("@capacitor/app");
        if (m?.App) return { plugin: m.App };
    } catch {
        /* 아래 전역 폴백 */
    }
    const injected = globalThis.Capacitor?.Plugins?.App;
    return injected ? { plugin: injected } : null;
}

/** 네이티브 토스트. 안드로이드 사용자가 이미 아는 그 문구·그 모양이라 새 UI 컴포넌트가 필요 없다. */
async function showToast(text) {
    if (!isNative()) return;
    try {
        const m = await import("@capacitor/toast");
        const Toast = m?.Toast ?? globalThis.Capacitor?.Plugins?.Toast;
        // duration "short" 가 안드로이드 Toast.LENGTH_SHORT(약 2초)다 — 아래 판정 시간과 맞춘다.
        await Toast?.show?.({ text, duration: "short", position: "bottom" });
    } catch {
        /* 토스트가 없다고 종료 흐름이 막히면 안 된다. 조용히 넘어간다 */
    }
}

function isNative() {
    try {
        return Boolean(globalThis.Capacitor?.isNativePlatform?.());
    } catch {
        return false;
    }
}

function isAndroid() {
    try {
        return globalThis.Capacitor?.getPlatform?.() === "android";
    } catch {
        return false;
    }
}

/**
 * 「한 번 더 누르면 종료」 판정 시간.
 *
 * ★ 2초인 이유: 안드로이드 `Toast.LENGTH_SHORT` 가 약 2초라, **문구가 화면에 떠 있는 동안만
 *   두 번째 누름이 먹는다**는 규칙이 눈에 보이는 것과 정확히 일치한다. 토스트가 사라졌는데도
 *   종료가 되면 유저는 "안 눌렀는데 꺼졌다"고 느낀다. 반대로 더 짧으면(1초) 누르려다 놓친다.
 *   안드로이드 앱 전반이 쓰는 관례값이기도 하다.
 */
const EXIT_CONFIRM_WINDOW_MS = 2000;
let lastExitPressAt = 0;

/**
 * 안드로이드 back 1회의 의미를 결정한다. 규격: 10-UIUX-LANDSCAPE.md 1.1 / 10.4 — "항상 한 단계 뒤로".
 * @returns {boolean} true면 앱을 종료해도 되는 지점(타이틀)
 */
export function handleBack() {
    const s = useStore.getState();

    // ★ PACT 카드가 떠 있으면 back을 무시한다(10-UIUX 10.4).
    //   선택을 강제하는 화면이라서다. 막다른 길은 아니다 — "거절한다" 버튼이 있다.
    if (s.pact.open) return false;

    // ★ 부활 제안도 같다. 답을 기다리는 오버레이이고 **Phaser 가 8초 타임아웃을 들고 있다** —
    //   back 으로 닫아 버리면 그 타임아웃이 끝날 때까지 씬이 멈춘 채로 남는다.
    //   무시하는 것이 안전하다. 거절하려면 화면의 「거절한다」를 누르면 된다.
    if (s.revive?.open) return false;

    if (s.modal === MODALS.CONFIRM) {
        // ★ 복귀 자리는 확인창 자신이 기억한다(uiSlice.openConfirm 의 returnTo).
        //   여기서 다시 판단하면 규칙이 두 벌이 되고, 실제로 그래서 어긋나 있었다 —
        //   옵션 위에서 연 확인창을 back 으로 닫으면 옵션이 아니라 일시정지로 갔다.
        s.closeConfirm();
        // 그래도 갈 곳이 없는데 런 중이면 일시정지로 떨어뜨린다. 메뉴만 사라지고
        // **Phaser 씬은 멈춘 채로 남으면** 화면이 얼어붙는다(에뮬레이터에서 재현했다).
        if (!useStore.getState().modal && s.screen === SCREENS.PLAYING) s.setModal(MODALS.PAUSE);
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
            // ★ 출정지 선택은 타이틀의 하위 상태다(uiSlice 주석 참조). 여기서 back 은 종료가 아니라
            //   선택 화면 닫기여야 한다. 이 분기가 없으면 **출정지에서 뒤로가기가 앱을 끈다.**
            if (s.stageSelect) {
                s.closeStageSelect();
                return false;
            }
            return true; // 종료 판정은 호출부가 한다(「한 번 더 누르면 종료」)
        default:
            return false;
    }
}

/** 앱이 백그라운드로 갔다. 런 중이면 무조건 멈춘다 — 안 멈추면 돌아왔을 때 죽어 있다(T633). */
export function handleBackground() {
    // 광고 표시 중은 백그라운드가 아니다. 그대로 두면 광고를 닫아도 일시정지 모달이 남는다.
    if (adInFlight) return;
    const s = useStore.getState();
    // ★ 부활 제안도 PACT 와 같이 "답을 기다리는" 오버레이다. 여기서 일시정지 모달을 얹으면
    //   부활 카드 위에 메뉴가 덮여, 광고를 보고 돌아왔을 때 답을 할 수 없게 된다.
    if (s.screen !== SCREENS.PLAYING || s.pact.open || s.revive?.open || s.modal) return;
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

    getCapApp().then((box) => {
        const App = box?.plugin;
        if (!App || cancelled) return;

        App.addListener("backButton", () => {
            // handleBack() 이 false 면 "한 단계 뒤로" 를 이미 처리한 것이다. 종료 판정은 타이틀에서만 온다.
            if (!handleBack()) {
                lastExitPressAt = 0; // ★ 다른 화면을 거쳤으면 연타 판정을 끊는다
                return;
            }

            // ⚠ iOS 에서는 앱을 프로그램으로 종료하면 심사에서 거부된다. 안드로이드에서만 한다.
            if (!isAndroid()) return;

            const now = Date.now();
            if (lastExitPressAt && now - lastExitPressAt <= EXIT_CONFIRM_WINDOW_MS) {
                lastExitPressAt = 0;
                App.exitApp?.();
                return;
            }
            lastExitPressAt = now;
            showToast("한 번 더 누르면 종료된다");
        }).then((h) => (cancelled ? h.remove?.() : handles.push(h)));

        App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
                lastExitPressAt = 0; // 백그라운드를 다녀오면 연타 판정을 버린다
                handleBackground();
            }
        }).then((h) => (cancelled ? h.remove?.() : handles.push(h)));
    });

    return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisibility);
        handles.forEach((h) => h?.remove?.());
        handles.length = 0;
    };
}
