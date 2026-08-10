/**
 * remoteConfig — 앱 업데이트 없이 밸런스·광고·상점을 흔들기 위한 원격 설정. (M-1 / 라이브옵스)
 *
 * ★ 제1원칙: **원격은 덮어쓰기일 뿐이다.** `data/remote-defaults.json` 만으로 게임이 100% 돌아야 한다.
 *   서버가 죽어도, 비행기 모드여도, 소프트런치 국가 밖이어도 아무 일도 일어나지 않아야 한다.
 *   그래서 init 은 **네트워크를 기다리지 않는다** — 캐시/기본값으로 즉시 반환하고 갱신은 뒤에서 한다.
 *
 * ★ 제2원칙: **서버를 믿지 않는다.** 오타 하나로 goldMult 에 "1"(문자열)이나 1e9 가 오면
 *   경제가 즉사한다. 모든 값은 로컬 스키마(t/min/max/maxLen)로 clamp 하고, 스키마에 없는 키는 버린다.
 *
 * ★ 이 파일은 개념상 `src/remote/` 에 있어야 하지만 소유권 경계 때문에 monetization 아래 둔다.
 *   옮길 때 고칠 곳은 import 경로뿐이다.
 *
 * ── 계약 ──
 *   await initRemoteConfig(opts) -> { source: "default"|"cache"|"network" }
 *   cfg(key) -> value            동기. 언제 불러도 유효한 값이 나온다
 *   allCfg() -> object
 *   onConfigUpdate(fn) -> unsubscribe
 */
import defaults from "@/data/remote-defaults.json";
import { loadJson, saveJson } from "./kv";

const CACHE_KEY = "bloodsworn.rc.v1";
const SCHEMA = defaults.values;

/** 스키마의 v 만 뽑은 평면 객체. 이게 어떤 상황에서도 보장되는 바닥이다. */
function baseValues() {
    const out = {};
    for (const [k, d] of Object.entries(SCHEMA)) out[k] = d.v;
    return out;
}

let values = baseValues();
let meta = { source: "default", fetchedAt: 0, configVersion: defaults.configVersion };
const listeners = new Set();

/**
 * 원격 값 1개를 로컬 스키마에 맞춰 강제 정규화한다.
 * @returns 정규화된 값, 또는 도저히 못 쓰겠으면 undefined(= 기본값 유지)
 */
function coerce(def, raw) {
    switch (def.t) {
        case "bool":
            if (typeof raw === "boolean") return raw;
            // "true"/"false"/0/1 도 받아준다. 원격 콘솔은 대개 문자열로 저장한다.
            if (raw === "true" || raw === 1) return true;
            if (raw === "false" || raw === 0) return false;
            return undefined;
        case "int":
        case "num": {
            const n = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(n)) return undefined;
            const v = def.t === "int" ? Math.round(n) : n;
            const lo = typeof def.min === "number" ? def.min : -Infinity;
            const hi = typeof def.max === "number" ? def.max : Infinity;
            return Math.min(hi, Math.max(lo, v));
        }
        case "str": {
            if (typeof raw !== "string") return undefined;
            const max = def.maxLen ?? 200;
            return raw.length > max ? raw.slice(0, max) : raw;
        }
        default:
            return undefined;
    }
}

/**
 * 원격 페이로드({ configVersion, values: {key: raw} }) → 정규화된 전체 값 집합.
 * ★ 항상 기본값 위에 덮는다. 원격이 키를 빼먹어도 그 키는 기본값이 살아남는다.
 */
function normalize(payload) {
    const out = baseValues();
    const src = payload?.values && typeof payload.values === "object" ? payload.values : payload;
    if (!src || typeof src !== "object") return out;
    let unknown = 0;
    for (const [k, raw] of Object.entries(src)) {
        const def = SCHEMA[k];
        if (!def) {
            unknown++;
            continue; // 스키마에 없는 키는 조용히 버린다. 구버전 앱이 신규 키를 만나도 안전하다
        }
        const v = coerce(def, raw);
        if (v !== undefined) out[k] = v;
    }
    if (unknown > 0) console.info(`[rc] 알 수 없는 원격 키 ${unknown}개를 버렸다(구버전 앱일 수 있다)`);
    return out;
}

function publish(next, source) {
    values = next;
    meta = { ...meta, source, fetchedAt: Date.now() };
    for (const fn of listeners) {
        try {
            fn(values, meta);
        } catch {
            /* 구독자 예외가 설정 갱신을 막아선 안 된다 */
        }
    }
}

/** 정적 JSON CDN 폴러. 기본 구현이자 권고안 — SDK 도, 계정도, 비용도 필요 없다. */
async function defaultFetcher(url, timeoutMs) {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => ac?.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: "GET",
            signal: ac?.signal,
            // 캐시 헤더는 CDN 쪽에서 관리한다. 여기서 no-store 를 걸면 CDN 이득이 사라진다.
            cache: "default",
            credentials: "omit",
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null; // 오프라인/타임아웃/JSON 파싱 실패 — 전부 "갱신 없음"으로 같게 취급한다
    } finally {
        clearTimeout(t);
    }
}

let started = false;

/**
 * 부팅 시 1회. **네트워크를 기다리지 않는다.**
 * @param {{url?:string, ttlSec?:number, timeoutMs?:number, fetcher?:Function}} opts
 *        url 이 없으면 원격 기능 자체가 꺼진다(기본값 전용 모드). 소프트런치 이전의 정상 상태다.
 *        fetcher 를 주면 Firebase Remote Config 등으로 갈아끼울 수 있다 — 이 파일을 고칠 필요가 없다.
 */
export async function initRemoteConfig(opts = {}) {
    if (started) return meta;
    started = true;

    const ttlSec = opts.ttlSec ?? defaults._fetch?.ttlSec ?? 21600;
    const timeoutMs = opts.timeoutMs ?? defaults._fetch?.timeoutMs ?? 4000;

    // 1) 캐시를 먼저 얹는다. 로컬 읽기라 빠르고, 오프라인 부팅에서도 지난 설정이 유지된다.
    let cache = null;
    try {
        cache = await loadJson(CACHE_KEY, null);
    } catch {
        /* 무시 */
    }
    if (cache?.values) publish(normalize(cache), "cache");

    if (!opts.url || typeof fetch !== "function") return meta;

    const fresh = cache?.fetchedAt && Date.now() - cache.fetchedAt < ttlSec * 1000;
    if (fresh) return meta;

    // 2) 갱신은 백그라운드. await 하지 않는 것이 핵심이다 — 여기서 기다리면 스플래시가 4초 늘어난다.
    const fetcher = opts.fetcher ?? defaultFetcher;
    Promise.resolve()
        .then(() => fetcher(opts.url, timeoutMs))
        .then(async (payload) => {
            if (!payload || typeof payload !== "object") return;
            const next = normalize(payload);
            publish(next, "network");
            await saveJson(CACHE_KEY, {
                fetchedAt: Date.now(),
                configVersion: Number(payload.configVersion) || 0,
                values: next,
            });
        })
        .catch(() => {
            /* 원격 갱신 실패는 정상 경로다 */
        });

    return meta;
}

/** 동기 조회. 스키마에 없는 키를 물으면 undefined 대신 경고 — 오타를 개발 중에 잡는다. */
export function cfg(key) {
    if (!(key in SCHEMA)) {
        console.warn(`[rc] 스키마에 없는 키: ${key}`);
        return undefined;
    }
    return values[key];
}

export function allCfg() {
    return { ...values };
}

export function remoteConfigMeta() {
    return { ...meta };
}

export function onConfigUpdate(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * 테스트/디버그 전용. 프로덕션 경로에서 부르지 말 것.
 * ★ normalize() 는 항상 전체 기본값을 반환하므로 그대로 펼치면 나머지 키가 기본값으로 되돌아간다.
 *   patch 에 들어온 키만 골라 덮는다.
 */
export function __setConfigForTest(patch) {
    const full = normalize({ values: patch });
    const next = { ...values };
    for (const k of Object.keys(patch ?? {})) if (k in SCHEMA) next[k] = full[k];
    publish(next, "test");
}
