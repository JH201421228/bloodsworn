/**
 * 분석 — 소프트런치 지표 수집. (6개월 확장 / A-1)
 *
 * ★ 1000만 사용자를 목표로 하면 "재미있다"는 감이 아니라 **숫자**가 방향을 정한다.
 *   최소한 D1/D7 리텐션, 런 길이 분포, 이탈 지점(어느 페이즈에서 그만두는가),
 *   각 빌드의 클리어율, ARPDAU 는 있어야 무엇을 고칠지 알 수 있다.
 *
 * ★ 개인정보: 식별자는 기기 로컬에서 생성한 익명 UUID 하나만 쓴다.
 *   이름·이메일·연락처·정확한 위치를 절대 보내지 않는다. 개인정보 처리방침이
 *   "수집 없음"에서 바뀌므로 방침 문서도 함께 고쳐야 한다.
 *
 * ── 통합 계약 ──
 *   await initAnalytics(opts)
 *   track(event, props)     : 이벤트 1건. 실패해도 절대 던지지 않는다
 *   setUserProp(k, v)
 *   flush()
 *   EVENTS                  : 이벤트 이름 상수(오타 방지)
 */
export const ANALYTICS_EVENTS = {
    RUN_START: "run_start",
    RUN_END: "run_end",
    LEVEL_UP: "level_up",
    PACT_CHOICE: "pact_choice",
    AWAKENING: "awakening",
    BOSS_ENGAGE: "boss_engage",
    BOSS_CLEAR: "boss_clear",
    ITEM_DROP: "item_drop",
    STAGE_UNLOCK: "stage_unlock",
    AD_REQUEST: "ad_request",
    AD_REWARDED: "ad_rewarded",
    IAP_PURCHASE: "iap_purchase",
    SESSION_START: "session_start",
};
export async function initAnalytics(_opts = {}) { return { ready: false }; }
export function track(_event, _props) {}
export function setUserProp(_k, _v) {}
export async function flush() {}
