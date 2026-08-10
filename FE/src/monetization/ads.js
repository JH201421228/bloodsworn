/**
 * ads — 보상형 광고. **유저가 스스로 누른 것만 띄운다.** (M-1)
 *
 * ★ 이 파일이 지키는 3가지:
 *   1) **광고 실패는 "보상 없음"이지 "진행 불가"가 아니다.** 모든 실패 경로가 reason 을 달고
 *      즉시 돌아온다. 게임은 광고가 영영 안 뜨는 기기에서도 끝까지 플레이돼야 한다.
 *   2) **절대 멈추지 않는다.** SDK 가 콜백을 영영 안 주는 사고가 실제로 있다.
 *      로드/표시 양쪽에 타임아웃을 걸어 스피너가 화면을 잠그는 일을 원천 차단한다.
 *   3) **상한은 성공한 시청만 깎는다.** 로드 실패로 하루치 기회가 사라지면 그건 유저 손해다.
 *
 * ★ 정적 import 금지 — `@capacitor-community/admob` 은 아직 설치되어 있지 않다(설치 명령은 보고서).
 *   네이티브에서는 브리지가 `window.Capacitor.Plugins.AdMob` 을 주입하므로 전역을 먼저 본다.
 */
import { loadJson, saveJson, readLocalJson } from "./kv";
import { hasEntitlement } from "./entitlements";
import { cfg } from "./remoteConfig";
import { ensureConsent, PERSONALIZED_ADS } from "./consent";

const ADMOB_MODULE = "@capacitor-community/admob";
const CAP_KEY = "bloodsworn.adcap.v1";

/** Google 공식 테스트 광고 단위. 실 단위 ID 를 코드에 박지 않는다 — opts 로 주입한다. */
const TEST_UNITS = {
    android: "ca-app-pub-3940256099942544/5224354917",
    ios: "ca-app-pub-3940256099942544/1712485313",
};

/** 플러그인이 버전마다 이름을 조금씩 바꿔서, 문자열을 직접 쓰되 여러 후보를 다 건다. */
const EV = {
    loaded: ["onRewardedVideoAdLoaded", "onRewardedVideoAdLoad"],
    failLoad: ["onRewardedVideoAdFailedToLoad"],
    rewarded: ["onRewardedVideoAdReward", "onRewarded"],
    dismissed: ["onRewardedVideoAdDismissed", "onRewardedVideoAdClosed"],
    failShow: ["onRewardedVideoAdFailedToShow"],
};

let AdMob = null;
let provider = "none"; // "admob" | "dev" | "none"
let units = { rewarded: "" };
let isTesting = true;
let loadedFlag = false;
let loadingPromise = null;
let showing = false;
let caps = null; // { day: "2026-08-11", perDay: {}, total: 0 }
let runCounts = {}; // 런 스코프 — 저장하지 않는다(런은 앱 재시작을 넘지 않는다)

/** @returns {"android"|"ios"|"web"} */
function platform() {
    try {
        const p = globalThis.Capacitor?.getPlatform?.();
        if (p === "android" || p === "ios") return p;
    } catch {
        /* 무시 */
    }
    return "web";
}

async function resolveAdMob() {
    const injected = globalThis.Capacitor?.Plugins?.AdMob;
    if (injected) return injected;
    try {
        const m = await import(/* @vite-ignore */ ADMOB_MODULE);
        return m?.AdMob ?? null;
    } catch {
        return null; // 웹/미설치. 정상 경로다
    }
}

function todayKey() {
    // 로컬 자정 기준. UTC 로 하면 한국 유저의 "하루"가 오전 9시에 끊긴다.
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function normalizeCaps(raw) {
    const day = todayKey();
    if (!raw || raw.day !== day) return { day, perDay: {}, total: 0 };
    return {
        day,
        perDay: raw.perDay && typeof raw.perDay === "object" ? { ...raw.perDay } : {},
        total: Number.isFinite(raw.total) ? raw.total : 0,
    };
}

function persistCaps() {
    saveJson(CAP_KEY, caps).catch(() => {});
}

/** 원격 설정에서 배치별 한도를 읽는다. shop.json 의 caps 는 기본값, 원격이 최종값이다. */
function placementLimits(placement) {
    switch (placement) {
        case "revive":
            return { enabled: cfg("ads.revive.enabled"), perRun: cfg("ads.revive.perRun"), perDay: Infinity };
        case "gold_double":
            return { enabled: cfg("ads.goldDouble.enabled"), perRun: cfg("ads.goldDouble.perRun"), perDay: Infinity };
        case "sanctum_offering":
            return {
                enabled: cfg("ads.sanctumOffering.enabled"),
                perRun: Infinity,
                perDay: cfg("ads.sanctumOffering.perDay"),
            };
        default:
            return { enabled: false, perRun: 0, perDay: 0 };
    }
}

/** @returns {""|"disabled"|"capped_run"|"capped_day"|"capped_global"} 빈 문자열이면 통과 */
function capBlockReason(placement) {
    if (!cfg("ads.enabled")) return "disabled";
    const lim = placementLimits(placement);
    if (!lim.enabled) return "disabled";
    if ((runCounts[placement] ?? 0) >= lim.perRun) return "capped_run";
    if ((caps?.perDay?.[placement] ?? 0) >= lim.perDay) return "capped_day";
    if ((caps?.total ?? 0) >= cfg("ads.dailyImpressionCap")) return "capped_global";
    return "";
}

function countImpression(placement) {
    runCounts[placement] = (runCounts[placement] ?? 0) + 1;
    if (!caps || caps.day !== todayKey()) caps = normalizeCaps(null);
    caps.perDay[placement] = (caps.perDay[placement] ?? 0) + 1;
    caps.total += 1;
    persistCaps();
}

/** 런 시작 시 호출. 런 스코프 카운터만 초기화한다. */
export function resetRunAdCounters() {
    runCounts = {};
}

/** Promise 에 타임아웃을 씌운다. SDK 가 콜백을 안 주는 사고에서 화면이 잠기는 걸 막는 유일한 장치다. */
function withTimeout(promise, ms, reason) {
    let t;
    return Promise.race([
        Promise.resolve(promise).finally(() => clearTimeout(t)),
        new Promise((_, rej) => {
            t = setTimeout(() => rej(new Error(reason)), ms);
        }),
    ]);
}

function addListeners(handles, names, fn) {
    for (const n of names) {
        try {
            const h = AdMob?.addListener?.(n, fn);
            if (h?.then) h.then((x) => handles.push(x)).catch(() => {});
            else if (h) handles.push(h);
        } catch {
            /* 없는 이벤트 이름은 무시 */
        }
    }
}

/**
 * 다음 보상형 광고를 미리 로드한다. 실패해도 조용히 넘어간다 — 필요할 때 다시 시도한다.
 * ★ 미리 로드가 UX 의 전부다. 버튼을 누른 뒤 로드를 시작하면 5~10초를 기다리게 되고,
 *   그 시간에 유저는 앱을 나간다.
 */
export function preloadRewarded() {
    if (provider !== "admob" || loadedFlag || loadingPromise) return loadingPromise ?? Promise.resolve(loadedFlag);
    loadingPromise = withTimeout(
        AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting, npa: !PERSONALIZED_ADS }),
        cfg("ads.loadTimeoutMs") ?? 10000,
        "load_timeout"
    )
        .then(() => {
            loadedFlag = true;
            return true;
        })
        .catch(() => {
            loadedFlag = false;
            return false; // no_fill / 네트워크 없음 / 타임아웃 — 전부 같게 취급한다
        })
        .finally(() => {
            loadingPromise = null;
        });
    return loadingPromise;
}

/**
 * 부팅 시 1회. **절대 던지지 않는다.**
 * @param {{rewardedUnitId?:string, rewardedUnitIdIos?:string, testMode?:boolean,
 *          devFakeAds?:boolean, testingDevices?:string[], debugGeography?:string}} opts
 */
export async function initAds(opts = {}) {
    caps = normalizeCaps(readLocalJson(CAP_KEY, null));
    loadJson(CAP_KEY, null)
        .then((raw) => {
            caps = normalizeCaps(raw);
        })
        .catch(() => {});

    const plat = platform();
    AdMob = await resolveAdMob();

    if (!AdMob) {
        // 웹 브라우저 개발 환경. 보상 흐름을 눈으로 확인하려면 가짜 광고를 켠다.
        provider = (opts.devFakeAds ?? Boolean(import.meta.env?.DEV)) ? "dev" : "none";
        return { provider, reason: provider === "dev" ? "dev_fake" : "no_plugin" };
    }

    // 실 단위 ID 가 없으면 무조건 테스트 모드다. 실수로 테스트 트래픽을 실 단위에 태우면 계정이 정지된다.
    const real = plat === "ios" ? opts.rewardedUnitIdIos : opts.rewardedUnitId;
    isTesting = opts.testMode ?? !real;
    units.rewarded = real || TEST_UNITS[plat === "ios" ? "ios" : "android"];

    try {
        await AdMob.initialize({
            // ★ ATT 프롬프트를 SDK 가 자동으로 띄우지 못하게 막는다(consent.js 방침).
            requestTrackingAuthorization: false,
            testingDevices: opts.testingDevices ?? [],
            initializeForTesting: isTesting,
        });
    } catch (e) {
        provider = "none";
        return { provider, reason: "init_failed", detail: String(e?.message ?? e) };
    }

    provider = "admob";
    await ensureConsent(AdMob, { debugGeography: opts.debugGeography, testDeviceIdentifiers: opts.testingDevices });
    preloadRewarded(); // 결과를 기다리지 않는다. 부팅을 광고 로드에 묶지 않는다
    return { provider, testing: isTesting };
}

/**
 * 버튼을 활성화해도 되는가. **상한까지 함께 본다** —
 * 광고는 준비됐는데 상한에 걸린 버튼을 눌렀다가 실패 토스트를 보는 건 최악의 UX 다.
 */
export function isAdReady(placement) {
    if (hasEntitlement("removeAds")) return capBlockReason(placement) === ""; // 결제자는 로드 여부와 무관
    if (capBlockReason(placement) !== "") return false;
    if (provider === "dev") return true;
    if (provider !== "admob") return false;
    if (!loadedFlag) preloadRewarded(); // 눌리기 전에 다시 채워 둔다
    return loadedFlag;
}

/**
 * 보상형 광고를 띄우고 보상 여부를 돌려준다.
 * @returns {Promise<{rewarded:boolean, reason?:string}>}
 *   reason: entitlement | disabled | capped_run | capped_day | capped_global |
 *           unavailable | no_fill | busy | dismissed | show_failed | timeout
 * ★ 어떤 경우에도 reject 하지 않는다. 호출부는 try/catch 없이 써도 된다.
 */
export async function showRewarded(placement) {
    const blocked = capBlockReason(placement);
    if (blocked) return { rewarded: false, reason: blocked };

    // ★ 「영원한 서약」 보유자: 광고 없이 즉시 보상. 상한은 동일하게 적용된다(위에서 이미 검사했다).
    if (hasEntitlement("removeAds")) {
        countImpression(placement);
        return { rewarded: true, reason: "entitlement" };
    }

    if (provider === "dev") {
        await new Promise((r) => setTimeout(r, 600));
        countImpression(placement);
        return { rewarded: true, reason: "dev_fake" };
    }
    if (provider !== "admob") return { rewarded: false, reason: "unavailable" };
    if (showing) return { rewarded: false, reason: "busy" }; // 연타 방지. 두 번 띄우면 SDK 가 예외를 던진다
    showing = true;

    const handles = [];
    try {
        if (!loadedFlag) {
            const ok = await preloadRewarded();
            if (!ok) return { rewarded: false, reason: "no_fill" };
        }

        let gotReward = false;
        addListeners(handles, EV.rewarded, () => {
            gotReward = true;
        });

        let result;
        try {
            result = await withTimeout(AdMob.showRewardVideoAd(), cfg("ads.showTimeoutMs") ?? 90000, "timeout");
        } catch (e) {
            const msg = String(e?.message ?? e);
            return { rewarded: false, reason: msg === "timeout" ? "timeout" : "show_failed" };
        } finally {
            loadedFlag = false; // 소진됐다. 성공이든 실패든 다음 것을 다시 채운다
        }

        // 버전에 따라 보상 아이템을 resolve 값으로도, 이벤트로도 준다. 둘 다 본다.
        if (result && (Number(result.amount) > 0 || result.type != null)) gotReward = true;
        if (!gotReward) return { rewarded: false, reason: "dismissed" };

        countImpression(placement); // ★ 성공한 시청만 상한을 깎는다
        return { rewarded: true };
    } catch {
        return { rewarded: false, reason: "show_failed" };
    } finally {
        showing = false;
        for (const h of handles) {
            try {
                h?.remove?.();
            } catch {
                /* 무시 */
            }
        }
        setTimeout(() => preloadRewarded(), 1000); // 즉시 재로드하면 SDK 가 거부하는 경우가 있다
    }
}

/** 디버그 HUD 용. 상한이 왜 막혔는지 화면에 그릴 때 쓴다. */
export function adDebugState() {
    return { provider, isTesting, loaded: loadedFlag, showing, caps: { ...caps }, runCounts: { ...runCounts } };
}
