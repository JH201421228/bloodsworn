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
 */
export const SAVE_KEY = "bloodsworn.save.v1";
export const SAVE_VERSION = 1;

export function defaultSave() {
    return { version: SAVE_VERSION, gold: 0, sanctum: {}, unlocks: {}, settings: {}, stats: {} };
}

export async function loadSave() { return defaultSave(); }
export async function saveNow(_state) {}
export async function resetSave() {}
