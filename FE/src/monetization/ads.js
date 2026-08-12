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
 * ★ 플러그인은 `@capacitor-community/admob` 7.2.0 (Capacitor 7 호환 — package.json 의
 *   `@capacitor/core` 의존이 ^7.0.0 이고 설치된 코어가 7.6.0 이다).
 *   동적 import 로 잡되 **Vite 가 해석하게 둔다**. 전역 `Capacitor.Plugins.AdMob` 은 폴백이다.
 * ★ **웹에서는 플러그인을 아예 건드리지 않는다.** 이 패키지의 웹 구현은 예외를 던지지 않고
 *   console.log 만 찍는 스텁이라, 그대로 두면 브라우저에서 provider 가 "admob" 으로 잡히고
 *   `showRewardVideoAd()` 가 즉시 빈 보상을 돌려준다 — 아무 화면도 안 뜨는데 보상만 나간다.
 *   platform() 게이트가 그것을 막는 유일한 장치다.
 */
import { loadJson, saveJson, readLocalJson } from "./kv";
import { hasEntitlement } from "./entitlements";
import { cfg } from "./remoteConfig";
import { ensureConsent, getConsentState, PERSONALIZED_ADS } from "./consent";
import { resolveRewardedUnit } from "./adConfig";

const CAP_KEY = "bloodsworn.adcap.v1";

/* 광고 단위 ID 는 adConfig.js 가 유일한 정본이다. 이 파일에 ID 문자열을 다시 적지 마라. */

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
let unitSource = "test"; // "opts" | "real" | "test" — 디버그 HUD 에서 어느 ID 를 쓰는지 확인한다
let loadedFlag = false;
let loadingPromise = null;
let showing = false;
let caps = null; // { day: "2026-08-11", perDay: {}, total: 0 }
let runCounts = {}; // 런 스코프 — 저장하지 않는다(런은 앱 재시작을 넘지 않는다)

/**
 * 「광고 준비 상태가 바뀌었다」 구독자들.
 *
 * ★ 이게 없으면 실제로 이런 일이 난다: 결과 화면이 그려지는 순간엔 광고가 아직 로드 중이라
 *   `isAdReady()` 가 false → 버튼이 안 그려진다 → 2초 뒤 로드가 끝나도 **리렌더 트리거가 없어서
 *   버튼이 영영 안 나타난다.** 에뮬레이터에서 실제로 재현한 증상이다.
 *   `isAdReady()` 는 렌더 시점의 스냅샷일 뿐이므로, 값이 바뀐 사실을 밖에 알려 줘야 한다.
 */
const readyListeners = new Set();

/**
 * 광고 준비 상태 변화를 구독한다. React 는 useEffect 에서 부르고 정리 함수로 해제하면 된다.
 * @param {() => void} cb
 * @returns {() => void} 해제 함수
 */
export function onAdReadyChange(cb) {
    if (typeof cb !== "function") return () => {};
    readyListeners.add(cb);
    return () => readyListeners.delete(cb);
}

/** loadedFlag 를 바꾸는 **유일한** 통로. 직접 대입하지 마라 — 구독자가 못 듣는다. */
function setLoaded(v) {
    const next = Boolean(v);
    if (loadedFlag === next) return;
    loadedFlag = next;
    for (const cb of readyListeners) {
        try {
            cb();
        } catch {
            /* 구독자 하나가 던져도 나머지는 받아야 한다 */
        }
    }
}

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

/**
 * 「AdMob」 핸들을 얻는다. **네이티브(android/ios)에서만** 시도한다.
 * ★ 웹에서 null 을 돌려주는 것이 의도다 — 파일 상단 주석의 웹 스텁 문제를 참고하라.
 *
 * ★★ **반드시 { plugin } 으로 감싸서 돌려준다. 플러그인 객체를 그대로 반환하지 마라.** ★★
 *   Capacitor 의 플러그인 핸들은 Proxy 라서 **어떤 속성 접근이든 네이티브 메서드 호출로 바꾼다.**
 *   `then` 도 예외가 아니다 → 자바스크립트가 이 객체를 thenable 로 착각한다.
 *   그래서 async 함수가 이걸 그대로 return 하면 Promise 해결 절차가 `AdMob.then()` 을 호출하고,
 *   네이티브가 `"AdMob.then()" is not implemented on android` 로 거부해 **initAds 가 통째로 reject 된다.**
 *   결과는 provider="none" — 즉 **APK 에서 광고 버튼이 영영 안 뜬다.** 실제로 이 프로젝트에서
 *   에뮬레이터 로그로 잡아낸 사고다. 한 겹 감싸는 것이 유일한 해법이다.
 */
async function resolveAdMob(plat) {
    if (plat !== "android" && plat !== "ios") return null;
    try {
        // ★ **`@vite-ignore` 를 절대 붙이지 마라.** 붙이면 Vite 가 이 지정자를 그대로 두고,
        //   빌드된 번들에서 WebView 가 "@capacitor-community/admob" 을 URL 로 해석해 404 가 난다.
        //   그러면 catch 로 빠져 provider 가 영원히 "none" 이 되고 **APK 에서 광고 버튼이 안 뜬다.**
        //   실제로 이 프로젝트에서 한 번 그렇게 실패했다. 코드 스플리팅은 Vite 에 맡긴다.
        const m = await import("@capacitor-community/admob");
        if (m?.AdMob) return { plugin: m.AdMob };
    } catch (e) {
        console.info("[ads] 플러그인 모듈 로드 실패 — 브리지 전역으로 재시도한다", e?.message ?? e);
    }
    // 폴백: 네이티브 브리지가 주입하는 전역. 모듈 로드가 실패해도 여기서 살아날 수 있다.
    const injected = globalThis.Capacitor?.Plugins?.AdMob;
    return injected ? { plugin: injected } : null;
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

/**
 * UMP 가 광고 요청을 허용하는가. (27-COMPLIANCE §7)
 *
 * ★ 순서가 전부다: 매 실행 requestConsentInfoUpdate() → canRequestAds() 확인 → **그 다음에야** 로드.
 *   initAds() 가 ensureConsent() 를 먼저 await 하는 이유이고, 이 순서를 뒤집으면
 *   canRequestAds 가 항상 false 라 **광고가 하나도 안 나간다.**
 * ★ 「영원한 서약」 보유자는 광고를 보지 않으므로 이 검사와 무관하다. 호출부에서 분기한다.
 */
function consentAllowsAds() {
    return getConsentState().canRequestAds !== false;
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
    // ★ 동의 확인 전/거부 상태에서 로드를 시도하면 정책 위반이자 낭비다.
    if (provider !== "admob" || !consentAllowsAds()) return Promise.resolve(false);
    if (loadedFlag || loadingPromise) return loadingPromise ?? Promise.resolve(loadedFlag);
    loadingPromise = withTimeout(
        AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting, npa: !PERSONALIZED_ADS, immersiveMode: true }),
        cfg("ads.loadTimeoutMs") ?? 10000,
        "load_timeout"
    )
        .then(() => {
            setLoaded(true);
            return true;
        })
        .catch(() => {
            setLoaded(false);
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
    // ★ resolveAdMob 이 던져도 initAds 는 절대 던지면 안 된다(부팅이 광고에 묶이면 안 된다).
    const box = await resolveAdMob(plat).catch(() => null);
    AdMob = box?.plugin ?? null;

    if (!AdMob) {
        // 웹 브라우저 개발 환경. 보상 흐름을 눈으로 확인하려면 가짜 광고를 켠다.
        provider = (opts.devFakeAds ?? Boolean(import.meta.env?.DEV)) ? "dev" : "none";
        return { provider, reason: provider === "dev" ? "dev_fake" : "no_plugin" };
    }

    // 실 단위 ID 가 없으면 무조건 테스트 모드다. 실수로 테스트 트래픽을 실 단위에 태우면 계정이 정지된다.
    const picked = resolveRewardedUnit(plat, plat === "ios" ? opts.rewardedUnitIdIos : opts.rewardedUnitId);
    isTesting = opts.testMode ?? picked.isTesting;
    units.rewarded = picked.unitId;
    unitSource = picked.source;

    try {
        await AdMob.initialize({
            testingDevices: opts.testingDevices ?? [],
            initializeForTesting: isTesting,
            // ★ 아동 대상 앱이 아니다(20-MONETIZATION §6.3 — 18+ 로 선언한다).
            //   false 를 **명시**하는 것이 중요하다. 미지정이면 SDK 가 "선언 안 함"으로 보내고,
            //   그러면 일부 광고 수요처가 요청을 거른다.
            tagForChildDirectedTreatment: false,
            tagForUnderAgeOfConsent: false,
            // 폭력 묘사가 있는 게임이다. 광고 등급을 콘텐츠에 맞춘다.
            maxAdContentRating: "MatureAudience",
        });
    } catch (e) {
        provider = "none";
        return { provider, reason: "init_failed", detail: String(e?.message ?? e) };
    }

    provider = "admob";
    await ensureConsent(AdMob, { debugGeography: opts.debugGeography, testDeviceIdentifiers: opts.testingDevices });
    preloadRewarded(); // 결과를 기다리지 않는다. 부팅을 광고 로드에 묶지 않는다
    console.info(`[ads] 「AdMob」 초기화 완료 — testing=${isTesting} unit=${unitSource}`);
    return { provider, testing: isTesting, unitSource };
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
    if (!consentAllowsAds()) return false;
    if (!loadedFlag) preloadRewarded(); // 눌리기 전에 다시 채워 둔다
    return loadedFlag;
}

/**
 * 보상형 광고를 띄우고 보상 여부를 돌려준다.
 * @returns {Promise<{rewarded:boolean, reason?:string}>}
 *   reason: entitlement | disabled | capped_run | capped_day | capped_global |
 *           unavailable | no_consent | no_fill | busy | dismissed | show_failed | timeout
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
    // EEA/UK/CH 에서 UMP 가 거부한 상태. 광고를 띄우면 정책 위반이다.
    if (!consentAllowsAds()) return { rewarded: false, reason: "no_consent" };
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
            setLoaded(false); // 소진됐다. 성공이든 실패든 다음 것을 다시 채운다
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
    return {
        provider,
        isTesting,
        unitSource,
        loaded: loadedFlag,
        showing,
        consent: getConsentState(),
        caps: { ...caps },
        runCounts: { ...runCounts },
    };
}
