/**
 * 수익화 — 보상형 광고 + IAP 하이브리드. (6개월 확장 / M-1)
 *
 * ★ 광고와 결제는 게임 로직이 절대 직접 알면 안 된다. 이 모듈이 유일한 창구다.
 *   플러그인이 없는 웹/개발 환경에서도 게임은 완전히 정상 동작해야 하고,
 *   광고 실패가 게임 진행을 막아서는 안 된다 — 실패는 "보상 없음"이지 "진행 불가"가 아니다.
 *
 * ★ 보상형 광고 원칙 (라이브옵스 기본): 유저가 스스로 누른 것만 보상형으로 띄운다.
 *   강제 전면광고는 리텐션을 직접 깎으므로 런 사이 자연 정지 지점에서만, 빈도 상한을 둔다.
 *
 * ── 통합 계약 ──
 *   await initMonetization(opts)
 *   isAdReady(placement) : boolean
 *   showRewarded(placement) : Promise<{ rewarded: boolean, reason?: string }>
 *   getProducts() : Promise<Product[]>
 *   purchase(sku) : Promise<{ ok: boolean, receipt?, reason? }>
 *   restorePurchases() : Promise<string[]>
 *   hasEntitlement(key) : boolean      // "removeAds" 등
 */
export async function initMonetization(_opts = {}) { return { ready: false, reason: "stub" }; }
export function isAdReady(_placement) { return false; }
export async function showRewarded(_placement) { return { rewarded: false, reason: "stub" }; }
export async function getProducts() { return []; }
export async function purchase(_sku) { return { ok: false, reason: "stub" }; }
export async function restorePurchases() { return []; }
export function hasEntitlement(_key) { return false; }
