/**
 * 분석 — 소프트런치 지표 수집. (6개월 확장 / A-1)
 *
 * ★ 1000만 사용자를 목표로 하면 "재미있다"는 감이 아니라 **숫자**가 방향을 정한다.
 *   최소한 D1/D7 리텐션, 런 길이 분포, 이탈 지점(어느 페이즈에서 그만두는가),
 *   각 빌드의 클리어율, ARPDAU 는 있어야 무엇을 고칠지 알 수 있다.
 *
 * ★ 개인정보: 식별자는 기기 로컬에서 생성한 익명 UUID 하나만 쓴다.
 *   이름·이메일·연락처·정확한 위치를 절대 보내지 않는다. 광고 ID(AAID/IDFA)도 읽지 않는다.
 *   실제로 나가는 필드는 privacy/index.html 표와 1:1로 일치해야 한다 — 어긋나면 스토어 정책 위반이다.
 *
 * ★ **track() 은 절대 예외를 던지지 않는다.** 분석이 게임을 죽이는 건 있을 수 없는 일이다.
 *   함수 전체가 try/catch 로 닫혀 있고, 전송 대상(endpoint)이 없으면 아무 일도 하지 않는다.
 *
 * ★ **60fps 루프에서 부르지 마라.** 이벤트는 "런 시작/종료, 레벨업, 계약 선택, 각성, 보스, 결제"처럼
 *   초당 1회 미만인 것만이다. 대미지·처치처럼 프레임마다 나는 것은 런 종료 시 집계값으로 1건만 보낸다.
 *   실수를 대비해 초당 상한(RATE_PER_SEC)과 세션 상한을 코드로 강제한다.
 *
 * ★ 지표의 **해석·기준선(무엇이 좋은 D1 인가)** 은 docs/21-LIVEOPS-AND-ANALYTICS.md 소관이다.
 *   이 파일은 **구현 계약**(어떤 이름으로 무엇을 보내는가)만 정의한다.
 *
 * ── 통합 계약 ──
 *   await initAnalytics(opts)
 *   track(event, props)     : 이벤트 1건. 실패해도 절대 던지지 않는다
 *   setUserProp(k, v)
 *   flush()
 *   ANALYTICS_EVENTS        : 이벤트 이름 상수(오타 방지)
 */
import { loadJson, saveJson, removeJson, readLocalJson, makeId } from "@/monetization/kv";
import { configureQueue, enqueue, flushQueue, restoreQueue, persistNow, clearQueue, queueStats } from "./queue";

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

const KNOWN = new Set(Object.values(ANALYTICS_EVENTS));

const AID_KEY = "bloodsworn.aid.v1";
const RATE_PER_SEC = 20; // 실수로 프레임 루프에서 불렀을 때의 방어선
const MAX_PROPS = 12;
const MAX_KEY_LEN = 24;
const MAX_STR_LEN = 64;

/** ★ 절대 보내지 않는 키. 실수로 유저 식별 정보를 props 에 담는 사고를 코드로 막는다. */
const FORBIDDEN_KEYS = /^(name|email|mail|phone|tel|addr|address|lat|lng|latitude|longitude|gps|ip|uid|userid|account|device_?id|adid|idfa|idfv|imei|token)$/i;

let anonId = "";
let sessionId = "";
let enabled = false;
let sampledIn = true;
let userProps = {};
let sentThisSession = 0;
let maxEventsPerSession = 300;
let rateWindowSec = 0;
let rateCount = 0;
let rateDropped = 0;
let flushTimer = null;
let installed = false;

/** anonId 를 32bit 로 접는다. 샘플링을 기기 단위로 **고정**하기 위해서다 — 매번 주사위를 굴리면 퍼널이 깨진다. */
function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

/** 값 1개를 안전한 원시값으로 만든다. 객체·배열은 통째로 버린다(중첩은 스키마를 폭발시킨다). */
function sanitizeValue(v) {
    if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.length > MAX_STR_LEN ? v.slice(0, MAX_STR_LEN) : v;
    return undefined;
}

function sanitizeProps(props) {
    if (!props || typeof props !== "object" || Array.isArray(props)) return {};
    const out = {};
    let n = 0;
    for (const [k, v] of Object.entries(props)) {
        if (n >= MAX_PROPS) break;
        if (typeof k !== "string" || k.length > MAX_KEY_LEN) continue;
        if (FORBIDDEN_KEYS.test(k)) {
            console.warn(`[analytics] 금지된 prop 키를 버렸다: ${k}`);
            continue;
        }
        const sv = sanitizeValue(v);
        if (sv === undefined) continue;
        out[k] = sv;
        n++;
    }
    return out;
}

/** 익명 UUID 1개. 기기 로컬에서 생성하며 광고 ID·하드웨어 식별자와 아무 관계가 없다. */
async function ensureAnonId() {
    const cached = readLocalJson(AID_KEY, null);
    if (typeof cached === "string" && cached.length >= 8) {
        anonId = cached;
        return anonId;
    }
    let v = null;
    try {
        v = await loadJson(AID_KEY, null);
    } catch {
        /* 무시 */
    }
    anonId = typeof v === "string" && v.length >= 8 ? v : makeId();
    saveJson(AID_KEY, anonId).catch(() => {});
    return anonId;
}

/** 앱이 백그라운드로 갈 때가 유일하게 확실한 전송 시점이다. 여기서 못 보내면 다음 실행까지 큐에 남는다. */
function installLifecycleHooks() {
    if (installed || typeof document === "undefined") return;
    installed = true;
    const onHide = () => {
        if (document.visibilityState !== "hidden") return;
        persistNow();
        flushQueue({ force: true });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener?.("pagehide", () => {
        persistNow();
        flushQueue({ force: true });
    });
}

/**
 * 부팅 시 1회. **절대 던지지 않는다.**
 * @param {{endpoint?:string, enabled?:boolean, sampleRate?:number, batchSize?:number,
 *          flushIntervalSec?:number, maxQueue?:number, maxEventsPerSession?:number,
 *          appVersion?:string, platform?:string, country?:string}} opts
 *   ★ endpoint 가 없으면 분석은 **완전히 꺼진다**(네트워크 전송 0건 유지). 이게 기본 상태다.
 */
export async function initAnalytics(opts = {}) {
    try {
        const endpoint = opts.endpoint ?? "";
        enabled = Boolean(endpoint) && (opts.enabled ?? true);
        maxEventsPerSession = opts.maxEventsPerSession ?? 300;

        configureQueue({
            endpoint,
            maxQueue: opts.maxQueue ?? 500,
            batchSize: opts.batchSize ?? 20,
        });

        await ensureAnonId();
        sessionId = makeId().slice(0, 12);

        // 기기 단위 고정 샘플링. 같은 기기는 항상 같은 판정이라 퍼널·리텐션이 일관된다.
        const rate = Math.min(1, Math.max(0, opts.sampleRate ?? 1));
        sampledIn = hash32(anonId) < rate;

        if (!enabled) {
            await restoreQueue(); // endpoint 가 없으면 남은 큐를 지우는 역할만 한다
            return { ready: false, reason: endpoint ? "disabled" : "no_endpoint", anonId };
        }

        userProps = {
            app_ver: opts.appVersion ?? "",
            platform: opts.platform ?? globalThis.Capacitor?.getPlatform?.() ?? "web",
            // ★ 국가는 호출부가 **스토어/설정에서 얻은 국가 코드**만 넣는다. 위치 권한을 쓰지 않는다.
            country: opts.country ?? "",
        };

        await restoreQueue();
        installLifecycleHooks();

        const sec = Math.max(5, opts.flushIntervalSec ?? 60);
        clearInterval(flushTimer);
        flushTimer = setInterval(() => flushQueue({ force: true }), sec * 1000);

        track(ANALYTICS_EVENTS.SESSION_START, { sampled: sampledIn });
        flushQueue({ force: true });
        return { ready: true, anonId, sampledIn };
    } catch (e) {
        enabled = false;
        console.warn("[analytics] 초기화 실패 — 분석 없이 계속한다", e);
        return { ready: false, reason: "init_failed" };
    }
}

/**
 * 이벤트 1건. **어떤 경우에도 던지지 않는다.**
 * ★ 60fps 루프에서 부르지 마라. 초당 RATE_PER_SEC 를 넘는 호출은 조용히 버려진다.
 */
export function track(event, props) {
    try {
        if (!enabled || !sampledIn) return;
        if (typeof event !== "string" || !event) return;
        if (sentThisSession >= maxEventsPerSession) return;

        // 초당 상한. 넘치면 버리되 몇 개를 버렸는지는 다음 이벤트에 실어 보낸다.
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec !== rateWindowSec) {
            rateWindowSec = nowSec;
            rateCount = 0;
        }
        if (++rateCount > RATE_PER_SEC) {
            rateDropped++;
            if (rateDropped === 1) console.warn(`[analytics] 초당 상한 초과 — '${event}' 를 버렸다. 프레임 루프에서 부르고 있지 않은지 확인해라`);
            return;
        }

        if (!KNOWN.has(event) && import.meta.env?.DEV) {
            console.warn(`[analytics] 상수에 없는 이벤트: ${event} — ANALYTICS_EVENTS 에 추가해라`);
        }

        const evt = {
            n: event.slice(0, 40),
            t: Date.now(),
            s: sessionId,
            u: anonId,
            p: sanitizeProps(props),
        };
        if (rateDropped) {
            evt.p._rl = rateDropped;
            rateDropped = 0;
        }
        sentThisSession++;
        enqueue(evt);
        flushQueue(); // 배치 크기에 도달했을 때만 실제로 나간다
    } catch {
        // 분석이 게임을 죽이는 일은 없다. 여기서 끝.
    }
}

/** 세션 전체에 붙는 속성. 개인 식별이 가능한 값을 넣지 마라 — sanitize 가 한 번 더 거른다. */
export function setUserProp(k, v) {
    try {
        const key = typeof k === "string" ? k.slice(0, MAX_KEY_LEN) : "";
        if (!key || FORBIDDEN_KEYS.test(key)) return;
        const val = sanitizeValue(v);
        if (val === undefined) return;
        userProps[key] = val;
    } catch {
        /* 무시 */
    }
}

export function getUserProps() {
    return { ...userProps };
}

/** 지금 당장 보낸다. 런 종료·상점 이탈처럼 "끊길 수 있는" 지점에서 부른다. */
export async function flush() {
    try {
        persistNow();
        await flushQueue({ force: true });
    } catch {
        /* 무시 */
    }
}

/** 익명 ID 를 새로 발급하고 큐를 비운다. 설정의 "분석 데이터 삭제"가 이 함수다(GDPR 삭제권 대응). */
export async function resetAnalyticsIdentity() {
    try {
        await clearQueue();
        await removeJson(AID_KEY);
        anonId = makeId();
        await saveJson(AID_KEY, anonId);
        sessionId = makeId().slice(0, 12);
        return anonId;
    } catch {
        return anonId;
    }
}

export function analyticsDebugState() {
    return { enabled, sampledIn, anonId, sessionId, sentThisSession, ...queueStats() };
}
