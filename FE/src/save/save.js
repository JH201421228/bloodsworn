/**
 * 세이브. localStorage 키 `bloodsworn.save.v1` + Capacitor Preferences write-through. (T550~T552)
 *
 * ★ iOS 때문에 기존 결정을 뒤집었다(T552). iOS WKWebView 의 localStorage 는
 *   저장 공간 압박 시 OS가 임의로 비운다. 영구 진행도가 사라지면 복구할 방법이 없다.
 *   그래서 localStorage 를 1차로 쓰되 Preferences 에 동시 기록한다.
 * ★ 손상된 세이브는 예외를 던지지 않는다 — 게임이 아예 안 켜진다. 기본값으로 복구한다(T551).
 *
 * ── 통합 계약 ──
 *   loadSave()            : Promise<object>  손상 시 기본값
 *   saveNow(state)        : Promise<void>
 *   resetSave()           : Promise<void>
 *   SAVE_KEY / SAVE_VERSION
 *   STAGE_IDS / emptyStageClears()  : 스테이지 클리어 맵의 고정 키(S-1)
 *
 * 스키마 정본: 08-DATA-SCHEMA.md 4.2 / 4.3 / 4.4
 */
import stagesData from "@/data/stages.json";

/**
 * ★ 스테이지 클리어 기록을 "빈 객체 {}" 로 두면 안 된다.
 *   deepMergeDefaults 는 **기본값에 있는 키만** 순회한다(아래 함수 참조). 기본값이 {} 면
 *   저장본에 있던 clears 가 매 로드마다 통째로 버려진다. 그래서 stages.json 의 id 를 읽어
 *   0 으로 채운 고정 키 맵을 기본값으로 쓴다. 스테이지가 늘어나면 이 파일을 고치지 않아도
 *   새 키가 자동으로 생기고, 기존 저장본의 값은 그대로 살아남는다.
 */
export const STAGE_IDS = (stagesData.stages ?? []).map((s) => s.id);

export function emptyStageClears() {
    return Object.fromEntries(STAGE_IDS.map((id) => [id, 0]));
}

export const SAVE_KEY = "bloodsworn.save.v1";
export const SAVE_VERSION = 1;

/** 08-DATA-SCHEMA 4.3 기본 세이브를 그대로 옮긴 것. 필드를 여기서 빼면 스키마가 갈라진다. */
export function defaultSave() {
    return {
        version: SAVE_VERSION,
        gold: 0,
        sanctum: {
            meta_tough: 0, meta_sharp: 0, meta_swift: 0,
            meta_greed: 0, meta_awaken_boost: 0, meta_recontract: 0,
        },
        unlocks: { stage2: false, char2: false, awakenCodex: [] },
        stats: {
            runs: 0, clears: 0, deaths: 0, bestTimeSec: 0,
            totalKills: 0, totalAwakenings: 0,
            sumFirstLevelUpAt: 0, sumDeathTime: 0, sumBossFightDuration: 0,
            sumFinalLevel: 0, sumFinalHumanity: 0, sumLevelUpCount: 0,
            sumFirstAwakenAt: 0, awakenOverflowCount: 0,
            rerollUses: 0, skipUses: 0, sumGoldEarned: 0, bossEncounters: 0,
            // ── 스테이지 진행도 (S-1 스테이지 선택) ──
            // ★ stats 안에 두는 이유: store.collectSave() 가 stats 를 통째로 실어 나르므로
            //   최상위 키를 새로 만들면 collectSave() 도 함께 고쳐야 한다. 그 파일은 이 작업의
            //   소유가 아니고, 여기 두면 기존 저장 경로를 한 줄도 바꾸지 않고 영속된다.
            // ★ StageSystem.isUnlocked 가 먹는 모양은 { clears, awakenCount } 다.
            //   awakenCount 는 이미 있는 totalAwakenings 를 그대로 쓴다(필드를 늘리지 않는다).
            stageClears: emptyStageClears(),
        },
        options: {
            // bgm 0.9 — settingsSlice.SETTINGS_INIT 주석 참조(실효 볼륨이 곡별 vol 과 곱해진다).
            // 저장본에 bgm 이 있으면 deepMergeDefaults 가 그 값을 살리므로 직접 조절한 사용자는 영향이 없다.
            bgm: 0.9, sfx: 0.8, screenShake: true, damageNumbers: true,
            // ★ 기본 「고정」(2026-08). deepMergeDefaults 는 저장본에 키가 있으면 그 값을 살리므로
            //   이미 "floating" 을 저장해 둔 세이브는 그대로 유지된다. 마이그레이션이 필요 없다.
            joystickMode: "fixed", lowSpec: false, lang: "ko",
        },
        lastPlayedAt: 0,
    };
}

/**
 * 버전 마이그레이션 체인. v1→v2 가 생기면 `1: (s) => ({...s, version: 2})` 를 추가한다.
 * ★ 08-DATA-SCHEMA 4.4 원칙: 키를 바꾸지도 지우지도 않는다. 새 키를 더할 뿐이다.
 *   신규 키는 deepMergeDefaults 가 채우므로 대부분의 변경에는 함수가 아예 필요 없다.
 */
const MIGRATIONS = {};

/**
 * 기본값 위에 저장값을 덮는다. 저장본에 없는 키는 기본값이 살아남는다.
 * ★ 배열은 병합하지 않고 통째로 교체한다 — awakenCodex 를 병합하면 지운 항목이 부활한다.
 */
function deepMergeDefaults(defaults, src) {
    if (Array.isArray(defaults)) return Array.isArray(src) ? [...src] : [...defaults];
    if (defaults === null || typeof defaults !== "object") {
        // 타입이 어긋나면 저장값을 버린다. 문자열이 들어온 gold 로 산술을 하면 조용히 망가진다.
        return typeof src === typeof defaults && src !== null ? src : defaults;
    }
    const out = {};
    for (const k of Object.keys(defaults)) {
        out[k] = k in (src ?? {}) ? deepMergeDefaults(defaults[k], src[k]) : defaults[k];
    }
    return out;
}

/**
 * 구버전 호환. S-1 이전 세이브에는 stageClears 가 없고, 스테이지1 클리어 사실이
 * `unlocks.stage2 = true`(정본 03-GDD 9.2 의 옛 경로)와 `stats.clears` 에만 남아 있다.
 * 그대로 두면 이미 보스를 잡은 플레이어가 스테이지2 앞에서 다시 잠긴 자물쇠를 본다 —
 * 진행도를 빼앗은 것으로 읽힌다. 흔적이 있으면 stage1 클리어 1회로 접어 준다.
 * ★ 값을 내리는 일은 절대 없다(항상 max). 절대 throw 하지 않는다.
 */
function foldLegacyProgress(save) {
    try {
        const st = save.stats;
        const clears = st.stageClears;
        const hadBossKill = save.unlocks?.stage2 === true || (st.clears ?? 0) > 0;
        if (hadBossKill && (clears.stage1 ?? 0) < 1) clears.stage1 = 1;
    } catch (e) {
        console.warn("[save] 구버전 진행도 변환 실패 — 기본값을 유지한다", e);
    }
    return save;
}

/**
 * 원본 JSON → 정상 세이브. 어떤 입력이 와도 절대 throw 하지 않는다.
 * @returns {{ save: object, readonly: boolean, recovered: boolean }}
 */
function normalize(raw) {
    const defaults = defaultSave();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { save: defaults, readonly: false, recovered: raw != null };
    }

    let save = raw;
    let v = Number.isInteger(save.version) ? save.version : 1;

    while (v < SAVE_VERSION) {
        const fn = MIGRATIONS[v];
        if (!fn) {
            console.warn("[save] v" + v + " 마이그레이션이 없다. 기본값으로 되돌린다");
            return { save: defaults, readonly: false, recovered: true };
        }
        save = fn(save);
        v = save.version;
    }

    // 구버전 앱으로 롤백된 경우. 덮어쓰면 최신 앱의 진행도가 잘려 나간다 — 읽기 전용으로 둔다.
    if (v > SAVE_VERSION) {
        console.warn("[save] 미래 버전 세이브(v" + v + "). 읽기 전용으로 연다");
        return { save: deepMergeDefaults(defaults, save), readonly: true, recovered: false };
    }

    return { save: foldLegacyProgress(deepMergeDefaults(defaults, save)), readonly: false, recovered: false };
}

function readLocal() {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    } catch (e) {
        console.warn("[save] localStorage 파싱 실패 — 기본값으로 복구한다", e);
        return null;
    }
}

function writeLocal(json) {
    try {
        localStorage.setItem(SAVE_KEY, json);
    } catch (e) {
        // 사파리 프라이빗 모드 등에서 QuotaExceeded 가 난다. 저장이 안 될 뿐 게임은 계속돼야 한다.
        console.warn("[save] localStorage 기록 실패", e);
    }
}

/**
 * Capacitor Preferences 핸들. 없으면 null.
 *
 * ★ 정적 import 를 쓰지 않는 이유: `@capacitor/preferences` 가 아직 설치되어 있지 않다.
 *   정적으로 쓰면 번들러가 즉시 해석 실패로 빌드를 깬다. 설치 명령은 보고서에 적었다.
 * ★ 네이티브에서는 패키지 없이도 `window.Capacitor.Plugins.Preferences` 가 존재한다
 *   (네이티브 브리지가 등록한다). 그래서 전역을 먼저 본다 — 설치 후 코드 수정이 필요 없다.
 */
const PREFS_MODULE = "@capacitor/preferences";
let prefsCache; // undefined=미조회 / null=사용 불가 / object=사용 가능

async function getPreferences() {
    if (prefsCache !== undefined) return prefsCache;
    const injected = globalThis.Capacitor?.Plugins?.Preferences;
    if (injected) {
        prefsCache = injected;
        return prefsCache;
    }
    try {
        const m = await import(/* @vite-ignore */ PREFS_MODULE);
        prefsCache = m?.Preferences ?? null;
    } catch {
        // 웹/미설치 환경. localStorage 단독으로 동작한다 — 조용히 넘어간다.
        prefsCache = null;
    }
    return prefsCache;
}

/** 미래 버전 세이브를 열었으면 이후 모든 쓰기를 막는다. 진행도를 잘라먹는 것보다 안 쓰는 게 낫다. */
let readonlyMode = false;

export function isReadonly() {
    return readonlyMode;
}

/**
 * 부팅 시 1회. Preferences(영속) 우선, 없으면 localStorage(핫 캐시)에서 읽어 승격한다.
 * ★ 절대 throw 하지 않는다. 세이브가 깨졌다고 게임이 안 켜지면 그게 최악의 사고다(T551).
 */
export async function loadSave() {
    let raw = null;

    const P = await getPreferences();
    if (P) {
        try {
            const { value } = await P.get({ key: SAVE_KEY });
            if (value) raw = JSON.parse(value);
        } catch (e) {
            console.warn("[save] Preferences 읽기 실패 — localStorage 로 대체한다", e);
        }
    }

    // Preferences 가 비었으면 기존 localStorage 세이브를 끌어올린다(1회 마이그레이션).
    const promote = raw == null;
    if (promote) raw = readLocal();

    const { save, readonly, recovered } = normalize(raw);
    readonlyMode = readonly;
    if (recovered) console.warn("[save] 손상된 세이브를 기본값으로 복구했다");

    // 핫 캐시를 항상 최신으로 맞춰 둔다. 이후 동기 읽기는 이 값을 믿어도 된다.
    if (!readonly) {
        const json = JSON.stringify(save);
        writeLocal(json);
        if (P && promote && raw != null) {
            try {
                await P.set({ key: SAVE_KEY, value: json });
            } catch (e) {
                console.warn("[save] Preferences 승격 실패", e);
            }
        }
    }
    return save;
}

/**
 * 저장. localStorage 는 동기로 즉시, Preferences 는 뒤따라 비동기로 쓴다.
 * ★ 쓰기 시점은 런 종료 / 성소 구매 / 옵션 변경 3곳뿐이다(08-DATA-SCHEMA 4.1).
 *   런 중에 쓰면 JSON.stringify 가 프레임 스파이크를 만든다.
 */
export async function saveNow(state) {
    if (readonlyMode) return;
    const { save } = normalize(state);
    save.lastPlayedAt = Date.now();
    const json = JSON.stringify(save);

    writeLocal(json); // 먼저 동기로 — 여기서 앱이 죽어도 최소 한 계층은 남는다

    const P = await getPreferences();
    if (!P) return;
    try {
        await P.set({ key: SAVE_KEY, value: json });
    } catch (e) {
        console.warn("[save] Preferences 기록 실패", e);
    }
}

/** 옵션 화면의 "저장 데이터 삭제". 두 계층 모두 지운다 — 한쪽만 지우면 부팅 때 되살아난다. */
export async function resetSave() {
    readonlyMode = false;
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) {
        console.warn("[save] localStorage 삭제 실패", e);
    }
    const P = await getPreferences();
    if (!P) return;
    try {
        await P.remove({ key: SAVE_KEY });
    } catch (e) {
        console.warn("[save] Preferences 삭제 실패", e);
    }
}
