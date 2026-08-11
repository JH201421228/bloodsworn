/**
 * DEBUG 플래그. URL 파라미터 / 로컬 저장으로 켠다.
 *
 * ⚠ 적용 범위: URL 파라미터는 개발 중 PC 브라우저에서만 동작한다.
 *    Capacitor 네이티브 빌드는 커스텀 스킴 루트로 서빙되어 쿼리스트링이 없다.
 *    실기기에서는 localStorage 플래그나 DebugPanel 버튼(06 13)을 쓴다.
 *
 * ★ 왜 플래그가 둘인가 (DEBUG / 오버레이)
 *   예전에는 DEBUG 하나가 "개발 도구 전부"를 의미해서, vite dev 로 띄우기만 해도
 *   좌상단 fps 오버레이가 항상 떠 있었다. 플레이 검증을 할 때 화면을 가린다.
 *   그렇다고 DEBUG 자체를 끄면 데이터 검증(validateData)·치트(BS.*)·
 *   window.__PHASER_GAME__ 까지 같이 죽는다 — 이건 개발 중 계속 필요하다.
 *   그래서 "개발 도구가 살아 있는가"(DEBUG)와 "화면에 글자를 그리는가"(오버레이)를 나눈다.
 *   오버레이는 **기본 OFF, 명시적 opt-in** 이다.
 */

/** localStorage 키. 네이티브 빌드에서 쿼리스트링을 못 쓰는 대신의 경로다 */
const OVERLAY_KEY = "bloodsworn.debugOverlay";

function readParams() {
    if (typeof window === "undefined") return new URLSearchParams();
    try {
        return new URLSearchParams(window.location.search);
    } catch {
        return new URLSearchParams();
    }
}

const params = readParams();

/** 사파리 프라이빗 모드 등에서 localStorage 접근이 던진다. 디버그 기능 때문에 게임이 죽으면 안 된다 */
function readStored() {
    try {
        return window.localStorage.getItem(OVERLAY_KEY) === "1";
    } catch {
        return false;
    }
}

function writeStored(on) {
    try {
        if (on) window.localStorage.setItem(OVERLAY_KEY, "1");
        else window.localStorage.removeItem(OVERLAY_KEY);
    } catch {
        /* 저장 실패는 이번 세션만 적용되는 것으로 족하다 */
    }
}

/**
 * 개발 도구 스위치. 치트/데이터검증/전역노출을 켠다.
 * ★ 화면 오버레이는 여기에 딸려오지 않는다 — isOverlayOn() 을 따로 본다.
 */
export const DEBUG = import.meta.env.DEV || params.get("debug") === "1";

/**
 * 오버레이 상태. 기본 OFF.
 * 켜지는 경로는 셋뿐이다: ?debug=1 / ?perf=1 / localStorage 플래그.
 * ★ import.meta.env.DEV 는 일부러 뺐다. "개발 서버로 띄웠다"는 opt-in 이 아니다.
 */
let overlayOn = params.get("debug") === "1" || params.get("perf") === "1" || readStored();

export function isOverlayOn() {
    return overlayOn;
}

/** @param {boolean} on @param {boolean} persist 다음 실행까지 유지할지 */
export function setOverlay(on, persist = true) {
    overlayOn = !!on;
    if (persist) writeStored(overlayOn);
    return overlayOn;
}

/** 런타임 토글(F9 / DebugPanel). 리로드 없이 껐다 켜려고 있다 */
export function toggleOverlay(persist = true) {
    return setOverlay(!overlayOn, persist);
}

/** ?perf=1 — 성능 오버레이 강제 표시. 하위 호환용 별칭 */
export const SHOW_PERF = params.get("perf") === "1";

/** ?seed=12345 — RNG 시드 고정. 밸런스 검증용 */
export const FIXED_SEED = (() => {
    const raw = params.get("seed");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
})();
