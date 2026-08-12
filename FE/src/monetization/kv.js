/**
 * kv — localStorage + Capacitor Preferences 이중 기록 KV. (M-1 / A-1 공용)
 *
 * ★ 왜 또 만드나: `save/save.js` 가 세이브 한 덩어리에 대해 하는 일과 같지만,
 *   수익화 원장(소유권·영수증)과 분석 큐는 **세이브와 생명주기가 다르다.**
 *   - 세이브는 "데이터 초기화"로 지워도 되지만, 구매한 권리(removeAds)는 지워지면 안 된다.
 *   - 분석 큐는 손실돼도 무해하지만 런 중에도 쓰인다.
 *   한 파일에 묶으면 초기화 버튼 하나가 결제 이력을 날린다. 그래서 키를 분리했다.
 *
 * ★ 저장 위치가 원본이 아니다. 영수증의 원본은 스토어(Google Play / App Store)다.
 *   여기 있는 값은 캐시일 뿐이며, 위조 가능하다고 가정하고 다룬다(22-BACKEND 문서 §영수증 검증).
 *
 * ★ 이 파일은 원래 `src/utils/kv.js` 에 있어야 한다. 현재 소유권 경계 때문에 여기 둔다.
 *   옮길 때 고칠 곳은 import 두 줄뿐이다.
 */

const PREFS_MODULE = "@capacitor/preferences";
let prefsCache; // undefined=미조회 / null=사용 불가 / object=사용 가능

/**
 * Capacitor Preferences 핸들. 없으면 null.
 *
 * ★★ **여기서 `import("@capacitor/preferences")` 를 정적/해석 가능한 형태로 부르지 마라.** ★★
 *   그 import 는 @capacitor/core 의 `registerPlugin()` 을 실행시키고, 그 순간
 *   `Capacitor.Plugins.Preferences` 가 **네이티브 브리지가 심어 둔 평범한 객체에서
 *   모든 속성 접근을 가로채는 Proxy 로 바뀐다.** 그 Proxy 는 `then` 까지 네이티브 호출로 바꾸기
 *   때문에 thenable 로 오인되고, **그 값을 async 함수에서 그대로 return 하는 다른 파일**
 *   (`src/save/save.js`)이 통째로 reject 된다 → 세이브 로드 실패 → **매 실행 진행도 초기화.**
 *   실제로 이 저장소에서 한 번 그렇게 깨뜨렸다가 되돌렸다. save.js 가 고쳐지기 전까지
 *   이 파일은 **전역을 먼저 보고, import 는 `@vite-ignore` 로 묶어 둔다.**
 *   (save.js 패치 코드는 20-MONETIZATION.md §10.7 에 있다.)
 * ★ 핸들은 `{ plugin }` 으로 감싸 캐시한다 — 위와 같은 thenable 사고를 이 파일에서 만들지 않기 위해서다.
 */
async function getPreferences() {
    if (prefsCache !== undefined) return prefsCache?.plugin ?? null;
    const injected = globalThis.Capacitor?.Plugins?.Preferences;
    if (injected) {
        prefsCache = { plugin: injected };
        return prefsCache.plugin;
    }
    try {
        const m = await import(/* @vite-ignore */ PREFS_MODULE);
        prefsCache = m?.Preferences ? { plugin: m.Preferences } : null;
    } catch {
        prefsCache = null; // 웹/미설치. localStorage 단독으로 동작한다
    }
    return prefsCache?.plugin ?? null;
}

/** 동기 읽기. 부팅 직후 Preferences 승격 전에도 최소한 이 값은 쓸 수 있다. */
export function readLocalJson(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        const v = JSON.parse(raw);
        return v ?? fallback;
    } catch {
        return fallback; // 손상 = 없는 것으로 취급. 절대 던지지 않는다
    }
}

export function writeLocalJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        // 사파리 프라이빗 모드 QuotaExceeded 등. 저장이 안 될 뿐 진행은 계속돼야 한다.
        return false;
    }
}

/**
 * 영속 읽기. Preferences(있으면) 우선, 없으면 localStorage.
 * ★ Preferences 가 비어 있고 localStorage 에만 있으면 자동으로 승격(1회 마이그레이션)한다.
 */
export async function loadJson(key, fallback = null) {
    const P = await getPreferences();
    if (P) {
        try {
            const { value } = await P.get({ key });
            if (value != null) {
                try {
                    return JSON.parse(value) ?? fallback;
                } catch {
                    return fallback;
                }
            }
        } catch {
            /* 읽기 실패 → localStorage 로 대체 */
        }
    }
    const local = readLocalJson(key, null);
    if (local != null && P) {
        try {
            await P.set({ key, value: JSON.stringify(local) });
        } catch {
            /* 승격 실패는 무해하다 */
        }
    }
    return local ?? fallback;
}

/** 영속 쓰기. localStorage 를 먼저 동기로 — 여기서 앱이 죽어도 한 계층은 남는다. */
export async function saveJson(key, value) {
    writeLocalJson(key, value);
    const P = await getPreferences();
    if (!P) return;
    try {
        await P.set({ key, value: JSON.stringify(value) });
    } catch {
        /* 무시. localStorage 사본이 남아 있다 */
    }
}

export async function removeJson(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* 무시 */
    }
    const P = await getPreferences();
    if (!P) return;
    try {
        await P.remove({ key });
    } catch {
        /* 무시 */
    }
}

/** 충돌 없는 짧은 id. crypto 가 없는 구형 WebView 도 있어 폴백을 둔다. */
export function makeId() {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        if (globalThis.crypto?.getRandomValues) {
            const b = new Uint8Array(16);
            globalThis.crypto.getRandomValues(b);
            b[6] = (b[6] & 0x0f) | 0x40;
            b[8] = (b[8] & 0x3f) | 0x80;
            const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
            return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        }
    } catch {
        /* 폴백으로 내려간다 */
    }
    return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
