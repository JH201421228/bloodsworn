/**
 * entitlements — 구매한 권리와 **아직 게임에 지급되지 않은 보상**의 원장. (M-1)
 *
 * ★ 왜 세이브(`bloodsworn.save.v1`)에 넣지 않았나:
 *   1) 옵션의 "데이터 초기화"가 세이브를 지운다. 결제 이력이 같이 지워지면 그건 사고다.
 *   2) 세이브 스키마는 다른 모듈의 소유다. 결제가 세이브 마이그레이션에 묶이면
 *      밸런스 패치 하나가 결제 복구를 깰 수 있다.
 *   지운 권리는 `restorePurchases()` 로 스토어에서 되살아나지만, 그건 유저가 버튼을 눌러야 한다.
 *
 * ★ 소모성 지급은 **2단계**다. 구매 성공 → pending 에 적재 → 게임이 골드를 더한 뒤 ack.
 *   한 번에 처리하면 "결제는 됐는데 골드가 안 들어옴"이 반드시 난다(앱 강제 종료, 렌더 중 예외).
 *   pending 은 ack 될 때까지 부팅마다 다시 흘러나온다. 중복 지급은 id 로 막는다.
 *
 * ★ 이 파일의 값은 **캐시지 증거가 아니다.** 위조 가능하다고 가정한다(docs/22 §영수증 검증).
 */
import { loadJson, saveJson, readLocalJson, makeId } from "./kv";

const ENT_KEY = "bloodsworn.ent.v1";
const ENT_VERSION = 1;

function emptyState() {
    return {
        version: ENT_VERSION,
        firstLaunchAt: 0,
        // 결제 횟수. 21-LIVEOPS §3.2 의 iap_purchase.first_purchase 를 계산하는 유일한 근거다.
        // ★ 최초 결제 전환은 소프트런치에서 가장 중요한 단일 수익화 지표라 반드시 구분돼야 한다.
        purchaseCount: 0,
        owned: {}, // { removeAds: { sku, at, src } }
        pending: [], // [{ id, type, amount?, key?, sku, at }]
    };
}

/** 어떤 입력이 와도 던지지 않는다. 손상 = 빈 원장(그 뒤 복원 버튼으로 회복한다). */
function normalize(raw) {
    const s = emptyState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
    if (raw.owned && typeof raw.owned === "object" && !Array.isArray(raw.owned)) {
        for (const [k, v] of Object.entries(raw.owned)) {
            if (typeof k !== "string" || !k) continue;
            s.owned[k] = {
                sku: typeof v?.sku === "string" ? v.sku : "",
                at: Number.isFinite(v?.at) ? v.at : 0,
                src: v?.src === "restore" || v?.src === "promo" ? v.src : "iap",
            };
        }
    }
    if (Array.isArray(raw.pending)) {
        for (const g of raw.pending.slice(0, 100)) {
            if (!g || typeof g.id !== "string") continue;
            if (g.type !== "gold" && g.type !== "entitlement" && g.type !== "cosmetic") continue;
            s.pending.push({
                id: g.id,
                type: g.type,
                amount: Number.isFinite(g.amount) ? g.amount : undefined,
                key: typeof g.key === "string" ? g.key : undefined,
                sku: typeof g.sku === "string" ? g.sku : "",
                at: Number.isFinite(g.at) ? g.at : 0,
            });
        }
    }
    s.firstLaunchAt = Number.isFinite(raw.firstLaunchAt) ? raw.firstLaunchAt : 0;
    // 구버전 원장에는 이 필드가 없다. 소유 상품 수로 보수적으로 추정한다
    // (0 으로 두면 두 번째 결제가 "최초 결제"로 잘못 집계된다).
    s.purchaseCount = Number.isFinite(raw.purchaseCount)
        ? Math.max(0, Math.round(raw.purchaseCount))
        : Object.keys(s.owned).length;
    return s;
}

// 동기 조회(hasEntitlement)를 위해 메모리 사본을 둔다. localStorage 값으로 즉시 부트스트랩한다.
let state = normalize(readLocalJson(ENT_KEY, null));
let loaded = false;

/** 쓰기는 즉시 발사하고 기다리지 않는다. 결제 UI 가 디스크 I/O 때문에 멎으면 안 된다. */
function persist() {
    saveJson(ENT_KEY, state).catch(() => {});
}

export async function initEntitlements() {
    if (!loaded) {
        try {
            state = normalize(await loadJson(ENT_KEY, null));
        } catch {
            state = emptyState();
        }
        loaded = true;
    }
    // 스타터 팩 노출 창의 기준점. 첫 실행에 못 박아 둬야 "설치 후 72시간"이 사실이 된다.
    if (!state.firstLaunchAt) {
        state.firstLaunchAt = Date.now();
        persist();
    }
    return state;
}

/** 동기. 부팅 직후(initEntitlements 이전)에도 localStorage 사본으로 답한다. */
export function hasEntitlement(key) {
    return Boolean(key && state.owned[key]);
}

export function listEntitlements() {
    return Object.keys(state.owned);
}

export function firstLaunchAt() {
    return state.firstLaunchAt || Date.now();
}

/** 이 기기에서 결제가 한 번도 성공하지 않았는가. 지급 **전에** 읽어야 의미가 있다. */
export function isFirstPurchase() {
    return state.purchaseCount === 0;
}

export function purchaseCount() {
    return state.purchaseCount;
}

/** 결제 성공 직후 1회. 소모성/비소모성을 가리지 않는다. */
export function notePurchase() {
    state.purchaseCount += 1;
    persist();
    return state.purchaseCount;
}

/** @returns {boolean} 이번 호출로 새로 생겼으면 true (UI 토스트 판단용) */
export function grantEntitlement(key, { sku = "", src = "iap" } = {}) {
    if (!key || state.owned[key]) return false;
    state.owned[key] = { sku, at: Date.now(), src };
    persist();
    return true;
}

/** 복원 결과 전체 반영. 스토어가 정본이므로 **덮어쓰되 지우지는 않는다** — 오프라인 복원 실패로 권리가 증발하면 안 된다. */
export function mergeRestored(keys, skuByKey = {}) {
    let added = 0;
    for (const k of keys ?? []) if (grantEntitlement(k, { sku: skuByKey[k] ?? "", src: "restore" })) added++;
    return added;
}

/**
 * 지급 대기 등록. 반환 id 를 게임이 ack 해야 사라진다.
 * @param {{type:"gold"|"entitlement"|"cosmetic", amount?:number, key?:string, sku?:string}} grant
 */
export function addPendingGrant(grant) {
    const g = { ...grant, id: makeId(), at: Date.now(), sku: grant.sku ?? "" };
    state.pending.push(g);
    // 상한. 원장이 무한히 자라면 부팅이 느려지고 저장 용량을 먹는다.
    if (state.pending.length > 100) state.pending = state.pending.slice(-100);
    persist();
    return g.id;
}

export function getPendingGrants() {
    return state.pending.map((g) => ({ ...g }));
}

/** 게임이 실제로 반영한 뒤 부른다. 반영 **전에** 부르면 그 보상은 영영 사라진다. */
export function ackGrant(id) {
    const before = state.pending.length;
    state.pending = state.pending.filter((g) => g.id !== id);
    if (state.pending.length !== before) persist();
    return state.pending.length !== before;
}

/** 개발/QA 전용. 스토어 구매를 흉내 낼 때만 쓴다. */
export function __resetEntitlements() {
    state = emptyState();
    state.firstLaunchAt = Date.now();
    persist();
}
