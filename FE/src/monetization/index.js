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
import { initAds, isAdReady as adsReady, showRewarded as adsShow, preloadRewarded, resetRunAdCounters, adDebugState, onAdReadyChange } from "./ads";
import { initIap, getProducts as iapGetProducts, getProductsSync, purchase as iapPurchase, restorePurchases as iapRestore, refreshProducts, iapProvider, registerIapAdapter } from "./iap";
import { getConsentState, resetConsent } from "./consent";
import { track, ANALYTICS_EVENTS } from "@/analytics";

export { hasEntitlement, resetRunAdCounters, registerIapAdapter, getConsentState, refreshProducts, getProductsSync };
/** 광고 준비 상태 구독. UI 가 버튼을 다시 그리게 하는 유일한 통로다 — 20-MONETIZATION §10.6. */
export { onAdReadyChange };
export { cfg as remoteValue, onConfigUpdate };

/** 광고 배치 정의(보상·상한·문구). UI 가 이 배열을 그대로 그린다 — 수치를 화면에 하드코딩하지 않는다. */
export const AD_PLACEMENTS = shop.adPlacements;
export function getAdPlacement(id) {
    return AD_PLACEMENTS.find((p) => p.id === id) ?? null;
}

/**
 * 배치 정의에 **원격 설정의 현재 값**을 덮어 돌려준다. UI 와 게임 훅은 반드시 이걸 쓴다.
 *
 * ★ shop.json 의 수치는 기본값이고 remote-defaults.json 의 `ads.*` 가 최종값이다.
 *   화면에 "골드 120" 을 하드코딩하거나 shop.json 을 직접 읽으면,
 *   원격으로 amount 를 바꿨을 때 **문구와 실제 지급액이 어긋난다.** 그건 허위 표기다.
 * ★ ready/reason 을 함께 준다 — 버튼을 그릴지 말지를 호출부가 한 번의 호출로 결정하게 하기 위해서다.
 *
 * @param {"revive"|"gold_double"|"sanctum_offering"} id
 * @returns {null|{id, name, desc, where, reward, cost, requires, ready, entitled}}
 */
export function resolveAdPlacement(id) {
    const def = getAdPlacement(id);
    if (!def) return null;

    const reward = { ...def.reward };
    const cost = { ...(def.cost ?? {}) };
    const requires = { ...(def.requires ?? {}) };

    switch (id) {
        case "revive": {
            // 인간성 비용과 최소 요구치는 항상 같은 값이어야 한다 — 다르면
            // "인간성 20 인데 버튼이 보이고, 누르면 −25 라 음수가 된다" 가 난다.
            const h = cfg("ads.revive.humanityCost");
            if (Number.isFinite(h)) {
                cost.humanity = h;
                requires.minHumanity = h;
            }
            break;
        }
        case "gold_double": {
            const m = cfg("ads.goldDouble.mult");
            if (Number.isFinite(m)) reward.mult = m;
            break;
        }
        case "sanctum_offering": {
            const a = cfg("ads.sanctumOffering.amount");
            if (Number.isFinite(a)) reward.amount = a;
            break;
        }
        default:
            break;
    }

    return {
        id: def.id,
        name: def.name,
        desc: def.desc ?? "",
        where: def.where,
        reward,
        cost,
        requires,
        ready: isAdReady(id),
        entitled: hasEntitlement("removeAds"),
    };
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
    // 21-LIVEOPS §3.2: ad_request 는 placement + ready. ready=false 비율이 곧 fill 문제의 유일한 단서다.
    // ★ isAdReady 를 **호출 전에** 읽는다 — 광고를 소진한 뒤에 읽으면 항상 false 로 기록된다.
    track(ANALYTICS_EVENTS.AD_REQUEST, { placement, ready: adsReady(placement) });
    const res = await adsShow(placement);
    track(ANALYTICS_EVENTS.AD_REWARDED, {
        placement,
        rewarded: res.rewarded,
        reason: res.reason ?? "ok",
        reward_type: getAdPlacement(placement)?.reward?.type ?? "",
    });
    return res;
}

export async function getProducts() {
    return iapGetProducts();
}

export async function purchase(sku) {
    const res = await iapPurchase(sku);
    // 21-LIVEOPS §3.2: sku / price_local / currency / first_purchase.
    // ★ 취소(cancelled)도 기록한다. 취소율은 가격 저항을 읽는 유일한 신호다.
    track(ANALYTICS_EVENTS.IAP_PURCHASE, {
        sku,
        ok: res.ok,
        reason: res.reason ?? "ok",
        provider: iapProvider(),
        price_local: res.price ?? 0,
        currency: res.currency ?? "",
        first_purchase: Boolean(res.firstPurchase),
    });
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
