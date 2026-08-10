/**
 * 수익화 — 보상형 광고 + IAP 하이브리드. (6개월 확장 / M-1)
 *
 * ★ 광고와 결제는 게임 로직이 절대 직접 알면 안 된다. 이 모듈이 유일한 창구다.
 *   플러그인이 없는 웹/개발 환경에서도 게임은 완전히 정상 동작해야 하고,
 *   광고 실패가 게임 진행을 막아서는 안 된다 — 실패는 "보상 없음"이지 "진행 불가"가 아니다.
 *
 * ★ 보상형 광고 원칙 (라이브옵스 기본): 유저가 스스로 누른 것만 보상형으로 띄운다.
 *   강제 전면광고 자리는 이 코드에 존재하지 않는다. 설계 근거는 docs/20-MONETIZATION.md.
 *
 * ★ 결제 지급은 **게임이 확인해 줘야 끝난다**(2단계 지급). opts.onGrant 가 true 를 돌려줘야
 *   원장에서 지워진다. 골드를 더하기 전에 ack 하면 그 결제는 영영 증발한다.
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
import shop from "@/data/shop.json";
import { initEntitlements, hasEntitlement, getPendingGrants, ackGrant } from "./entitlements";
import { initRemoteConfig, cfg, onConfigUpdate, remoteConfigMeta } from "./remoteConfig";
import { initAds, isAdReady as adsReady, showRewarded as adsShow, preloadRewarded, resetRunAdCounters, adDebugState } from "./ads";
import { initIap, getProducts as iapGetProducts, getProductsSync, purchase as iapPurchase, restorePurchases as iapRestore, refreshProducts, iapProvider, registerIapAdapter } from "./iap";
import { getConsentState, resetConsent } from "./consent";
import { track, ANALYTICS_EVENTS } from "@/analytics";

export { hasEntitlement, resetRunAdCounters, registerIapAdapter, getConsentState, refreshProducts, getProductsSync };
export { cfg as remoteValue, onConfigUpdate };

/** 광고 배치 정의(보상·상한·문구). UI 가 이 배열을 그대로 그린다 — 수치를 화면에 하드코딩하지 않는다. */
export const AD_PLACEMENTS = shop.adPlacements;
export function getAdPlacement(id) {
    return AD_PLACEMENTS.find((p) => p.id === id) ?? null;
}

let onGrant = null;
let ready = false;

/**
 * pending 원장을 게임으로 흘린다. 부팅 직후와 구매 직후에 부른다.
 * ★ onGrant 가 true 를 반환해야 ack 한다. 예외를 던지거나 false 면 다음 기회에 다시 온다.
 */
export async function drainGrants() {
    if (!onGrant) return 0;
    let n = 0;
    for (const g of getPendingGrants()) {
        try {
            const ok = await onGrant(g);
            if (ok) {
                ackGrant(g.id);
                n++;
            }
        } catch (e) {
            console.warn("[mon] 지급 반영 실패 — 다음 부팅에 재시도한다", e);
        }
    }
    return n;
}

/**
 * 부팅 시 1회. **절대 던지지 않는다.**
 * @param {{
 *   rewardedUnitId?:string, rewardedUnitIdIos?:string, testMode?:boolean, devFakeAds?:boolean,
 *   revenueCatApiKey?:string, devFakeIap?:boolean,
 *   remoteConfigUrl?:string,
 *   onGrant?:(grant:{id:string,type:"gold"|"entitlement"|"cosmetic",amount?:number,key?:string,sku:string})=>boolean|Promise<boolean>
 * }} opts
 */
export async function initMonetization(opts = {}) {
    onGrant = typeof opts.onGrant === "function" ? opts.onGrant : null;
    try {
        await initEntitlements();
        // 원격 설정이 먼저다 — 광고 상한과 상점 노출이 전부 여기서 나온다. 네트워크는 기다리지 않는다.
        await initRemoteConfig({ url: opts.remoteConfigUrl });

        // 광고와 결제는 서로를 기다릴 이유가 없다. 한쪽이 실패해도 다른 쪽은 살아야 한다.
        const [ads, iap] = await Promise.all([
            initAds(opts).catch((e) => ({ provider: "none", reason: String(e?.message ?? e) })),
            initIap(opts).catch((e) => ({ provider: "none", reason: String(e?.message ?? e) })),
        ]);

        await drainGrants(); // 지난 세션에 못 준 보상부터 갚는다
        ready = true;
        return { ready: true, ads: ads.provider, iap: iap.provider, config: remoteConfigMeta().source };
    } catch (e) {
        // 여기까지 오면 수익화는 통째로 꺼지지만 게임은 정상이다. 그게 이 설계의 목적이다.
        console.warn("[mon] 초기화 실패 — 수익화 없이 계속한다", e);
        return { ready: false, reason: String(e?.message ?? e) };
    }
}

export function isMonetizationReady() {
    return ready;
}

/** 버튼을 활성화해도 되는가. 상한까지 함께 본다. */
export function isAdReady(placement) {
    return adsReady(placement);
}

/**
 * 보상형 광고. @returns {Promise<{rewarded:boolean, reason?:string}>} — 절대 reject 하지 않는다.
 * ★ 호출부는 rewarded===true 일 때만 보상을 준다. false 는 그냥 "아무 일도 없었다"로 처리한다.
 */
export async function showRewarded(placement) {
    track(ANALYTICS_EVENTS.AD_REQUEST, { placement });
    const res = await adsShow(placement);
    track(ANALYTICS_EVENTS.AD_REWARDED, { placement, rewarded: res.rewarded, reason: res.reason ?? "ok" });
    return res;
}

export async function getProducts() {
    return iapGetProducts();
}

export async function purchase(sku) {
    const res = await iapPurchase(sku);
    track(ANALYTICS_EVENTS.IAP_PURCHASE, { sku, ok: res.ok, reason: res.reason ?? "ok", provider: iapProvider() });
    if (res.ok) await drainGrants();
    return res;
}

export async function restorePurchases() {
    const keys = await iapRestore();
    await drainGrants();
    return keys;
}

/** 설정 화면의 "광고 동의 다시 설정"(EEA 필수). */
export async function resetAdConsent() {
    return resetConsent(globalThis.Capacitor?.Plugins?.AdMob ?? null);
}

/** 런 시작 훅. 런 스코프 광고 상한을 초기화하고 다음 광고를 미리 채운다. */
export function onRunStart() {
    resetRunAdCounters();
    preloadRewarded();
}

/** 디버그 오버레이용. 프로덕션 UI 에서 부르지 말 것. */
export function monetizationDebugState() {
    return { ready, ads: adDebugState(), iap: iapProvider(), config: remoteConfigMeta() };
}
