/**
 * DEBUG 플래그. URL 파라미터로 켠다.
 *
 * ⚠ 적용 범위: URL 파라미터는 개발 중 PC 브라우저에서만 동작한다.
 *    Capacitor 네이티브 빌드는 커스텀 스킴 루트로 서빙되어 쿼리스트링이 없다.
 *    실기기에서는 DebugPanel의 버튼(06 13)을 쓴다.
 */

function readParams() {
    if (typeof window === "undefined") return new URLSearchParams();
    try {
        return new URLSearchParams(window.location.search);
    } catch {
        return new URLSearchParams();
    }
}

const params = readParams();

/** 개발 빌드이거나 ?debug=1 이면 true */
export const DEBUG = import.meta.env.DEV || params.get("debug") === "1";

/** ?perf=1 — 성능 오버레이 강제 표시 */
export const SHOW_PERF = DEBUG && params.get("perf") === "1";

/** ?seed=12345 — RNG 시드 고정. 밸런스 검증용 */
export const FIXED_SEED = (() => {
    const raw = params.get("seed");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
})();
