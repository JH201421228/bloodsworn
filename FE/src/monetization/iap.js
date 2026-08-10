/**
 * iap — 인앱 결제. (M-1)
 *
 * ★ 핵심 위험은 "결제는 됐는데 못 받았다"이다. 이게 나면 환불 요청과 별점 1점이 동시에 온다.
 *   그래서 지급은 **2단계**로 한다: 구매 성공 → entitlements.pending 에 적재(디스크) →
 *   게임이 반영한 뒤 ack. 앱이 그 사이에 죽어도 다음 부팅에 다시 흘러나온다.
 *
 * ★ **가격을 앱에 그리지 않는다.** 스토어가 준 지역화 가격 문자열(priceString)만 표시한다.
 *   shop.json 의 refPrice 는 기획용 참고값이지 표시용이 아니다 — 환율·부가세가 나라마다 다르고,
 *   틀린 가격 표시는 스토어 정책 위반이다.
 *
 * ★ **영수증 검증은 클라이언트만으로 불가능하다.** 이 파일이 신뢰하는 것은 어댑터가 준 결과뿐이고,
 *   그 어댑터가 서버 검증을 하느냐가 실제 안전선을 결정한다. 리스크·완화책은
 *   docs/22-BACKEND-AND-REMOTE-CONFIG.md §영수증 검증에 정리했다.
 *
 * ── 어댑터 계약 ──
 *   { name, init(opts), getProducts(skus), purchase(sku), restore() }
 *   purchase -> { ok, receipt?, reason?, entitlements?: string[] }
 *   restore  -> string[] (보유 entitlement 키 목록)
 */
import shop from "@/data/shop.json";
import { addPendingGrant, grantEntitlement, mergeRestored, hasEntitlement, firstLaunchAt } from "./entitlements";
import { cfg } from "./remoteConfig";

const RC_MODULE = "@revenuecat/purchases-capacitor";

const CATALOG = new Map(shop.products.map((p) => [p.sku, p]));

let adapter = null;
let productCache = [];
const extraAdapters = [];

/** 외부에서 어댑터를 끼워 넣는다(cordova-plugin-purchase 등). 이 파일을 고치지 않고 갈아끼우기 위한 구멍. */
export function registerIapAdapter(a) {
    if (a && typeof a.init === "function") extraAdapters.push(a);
}

/* ────────────────────────── RevenueCat 어댑터 ────────────────────────── */
/**
 * ★ 왜 RevenueCat 을 기본으로 두나: **서버를 세우지 않고도 서버 측 영수증 검증**을 얻는다.
 *   1인 개발이 결제 백엔드를 직접 만들고 유지하는 비용 대비 이득이 크다.
 *   entitlement("removeAds")는 RevenueCat 대시보드에서 SKU 에 연결해 둬야 한다(보고서의 계정 작업 참조).
 */
function revenueCatAdapter(Purchases) {
    return {
        name: "revenuecat",
        async init(opts) {
            await Purchases.configure({ apiKey: opts.revenueCatApiKey });
            // 부팅 시 스토어 기준으로 소유권을 한 번 맞춘다. 기기 변경/재설치 복구가 자동으로 된다.
            try {
                const { customerInfo } = await Purchases.getCustomerInfo();
                mergeRestored(Object.keys(customerInfo?.entitlements?.active ?? {}));
            } catch {
                /* 오프라인 부팅. 로컬 원장이 살아 있으므로 무해하다 */
            }
        },
        async getProducts(skus) {
            const r = await Purchases.getProducts({ productIdentifiers: skus });
            return (r?.products ?? []).map((p) => ({
                sku: p.identifier,
                priceString: p.priceString ?? "",
                price: p.price,
                currency: p.currencyCode ?? "",
                storeTitle: p.title ?? "",
            }));
        },
        async purchase(sku) {
            const r = await Purchases.getProducts({ productIdentifiers: [sku] });
            const product = r?.products?.[0];
            if (!product) return { ok: false, reason: "product_not_found" };
            const res = await Purchases.purchaseStoreProduct({ product });
            const active = Object.keys(res?.customerInfo?.entitlements?.active ?? {});
            return {
                ok: true,
                receipt: { transactionId: res?.transactionIdentifier ?? "", sku },
                entitlements: active,
            };
        },
        async restore() {
            const res = await Purchases.restorePurchases();
            return Object.keys(res?.customerInfo?.entitlements?.active ?? {});
        },
    };
}

/* ────────────────────────── 개발용 스텁 ────────────────────────── */
/** 웹에서 결제 UI/지급 흐름을 눈으로 확인하기 위한 가짜 어댑터. 프로덕션 빌드에서는 켜지지 않는다. */
function devAdapter() {
    return {
        name: "dev",
        async init() {},
        async getProducts(skus) {
            return skus.map((sku) => {
                const p = CATALOG.get(sku);
                return {
                    sku,
                    priceString: `₩${(p?.refPrice?.KRW ?? 0).toLocaleString("ko-KR")} (개발용)`,
                    price: p?.refPrice?.KRW ?? 0,
                    currency: "KRW",
                    storeTitle: p?.name ?? sku,
                };
            });
        },
        async purchase(sku) {
            await new Promise((r) => setTimeout(r, 400));
            const keys = (CATALOG.get(sku)?.grants ?? [])
                .filter((g) => g.type === "entitlement")
                .map((g) => g.key);
            return { ok: true, receipt: { transactionId: "dev-" + Date.now(), sku }, entitlements: keys };
        },
        async restore() {
            return [];
        },
    };
}

async function resolveRevenueCat() {
    const injected = globalThis.Capacitor?.Plugins?.Purchases;
    if (injected) return injected;
    try {
        const m = await import(/* @vite-ignore */ RC_MODULE);
        return m?.Purchases ?? null;
    } catch {
        return null; // 웹/미설치. 정상 경로다
    }
}

async function resolveAdapter(opts) {
    for (const a of extraAdapters) {
        try {
            await a.init(opts);
            return a;
        } catch {
            /* 다음 후보로 */
        }
    }
    if (opts.revenueCatApiKey) {
        const P = await resolveRevenueCat();
        if (P) {
            const a = revenueCatAdapter(P);
            try {
                await a.init(opts);
                return a;
            } catch (e) {
                console.info("[iap] RevenueCat 초기화 실패 — 결제 없이 계속한다", e?.message ?? e);
            }
        }
    }
    if (opts.devFakeIap ?? Boolean(import.meta.env?.DEV)) {
        const a = devAdapter();
        await a.init(opts);
        return a;
    }
    return null;
}

/** 부팅 시 1회. 절대 던지지 않는다. */
export async function initIap(opts = {}) {
    try {
        adapter = await resolveAdapter(opts);
    } catch {
        adapter = null;
    }
    if (adapter) refreshProducts().catch(() => {});
    return { provider: adapter?.name ?? "none" };
}

/** 지금 상점에 보여야 할 SKU. 원격 숨김 + 이미 소유 + 한정 창을 함께 본다. */
function visibleSkus() {
    const hidden = new Set(
        String(cfg("shop.hiddenSkus") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
    );
    const windowHours = cfg("shop.starterWindowHours") ?? 72;
    const elapsedH = (Date.now() - firstLaunchAt()) / 3600000;
    return shop.products
        .filter((p) => !hidden.has(p.sku))
        // 이미 산 비소모성 상품은 숨긴다. 안 숨기면 중복 구매 시도 → 스토어 에러 → 문의가 온다.
        .filter(
            (p) =>
                !(
                    p.kind === "nonconsumable" &&
                    p.grants.some((g) => g.type === "entitlement" && hasEntitlement(g.key))
                )
        )
        // 한정 상품의 카운트다운은 반드시 사실이어야 한다. 지나면 정말로 사라진다.
        .filter((p) => !p.window?.afterFirstLaunchHours || elapsedH <= windowHours)
        .map((p) => p.sku);
}

/** 스토어 가격을 붙인 상품 목록. 스토어가 응답하지 않으면 가격 없는 목록을 준다(상점을 못 여는 것보다 낫다). */
export async function refreshProducts() {
    const skus = visibleSkus();
    let priced = [];
    if (adapter) {
        try {
            priced = await adapter.getProducts(skus);
        } catch {
            priced = [];
        }
    }
    const byS = new Map(priced.map((p) => [p.sku, p]));
    productCache = skus.map((sku) => {
        const def = CATALOG.get(sku);
        const live = byS.get(sku);
        return {
            sku,
            kind: def.kind,
            name: def.name,
            desc: def.desc ?? "",
            badge: def.badge ?? null,
            grants: def.grants,
            priceString: live?.priceString ?? "", // 빈 문자열이면 UI 가 "가격 불러오는 중"을 그린다
            available: Boolean(live) || adapter?.name === "dev",
        };
    });
    return productCache;
}

export function getProductsSync() {
    return productCache.map((p) => ({ ...p }));
}

export async function getProducts() {
    if (!productCache.length) return refreshProducts();
    return getProductsSync();
}

/**
 * 구매. @returns {{ok:boolean, receipt?:object, reason?:string}}
 * reason: unavailable | unknown_sku | already_owned | cancelled | store_error | product_not_found
 * ★ 성공 시 지급을 여기서 끝내지 않는다. pending 원장에 넣고 index.js 가 게임에 흘린다.
 */
export async function purchase(sku) {
    const def = CATALOG.get(sku);
    if (!def) return { ok: false, reason: "unknown_sku" };
    if (!adapter) return { ok: false, reason: "unavailable" };
    if (def.kind === "nonconsumable" && def.grants.some((g) => g.type === "entitlement" && hasEntitlement(g.key)))
        return { ok: false, reason: "already_owned" };

    let res;
    try {
        res = await adapter.purchase(sku);
    } catch (e) {
        // 유저 취소는 에러가 아니다. 실패 토스트를 띄우면 짜증만 남는다.
        const msg = String(e?.message ?? "");
        if (e?.userCancelled || /cancel/i.test(msg)) return { ok: false, reason: "cancelled" };
        return { ok: false, reason: "store_error" };
    }
    if (!res?.ok) return { ok: false, reason: res?.reason ?? "store_error" };

    // ★ 먼저 디스크에 적는다. 이 줄 다음에 앱이 죽어도 보상은 살아남는다.
    for (const g of def.grants) {
        if (g.type === "entitlement") grantEntitlement(g.key, { sku, src: "iap" });
        addPendingGrant({ ...g, sku });
    }
    refreshProducts().catch(() => {});
    return { ok: true, receipt: res.receipt };
}

/** 기기 변경·재설치 복구. 스토어가 정본이므로 결과를 원장에 병합한다(삭제는 하지 않는다). */
export async function restorePurchases() {
    if (!adapter) return [];
    try {
        const keys = await adapter.restore();
        mergeRestored(keys);
        refreshProducts().catch(() => {});
        return keys;
    } catch {
        return [];
    }
}

export function iapProvider() {
    return adapter?.name ?? "none";
}
