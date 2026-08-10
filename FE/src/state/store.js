/**
 * 전역 스토어. 슬라이스 4개를 하나의 store로 합성한다.
 * 스토어를 여러 개 만들지 않는다 — 구독 지점이 늘어나고 저장 로직이 갈라진다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4
 *
 * ★ 여기에 들어오는 값의 유일한 기준: "게임이 정지된 순간에만 바뀌는가?" (T112)
 *   HP·EXP·타이머·처치수처럼 60fps로 바뀌는 값은 절대 넣지 않는다. HudScene이 직접 그린다.
 *   이 규칙을 어기면 매 프레임 React 리렌더가 돌아 모바일에서 프레임이 무너진다.
 */
import { create } from "zustand";
import { createMetaSlice } from "./metaSlice";
import { createRunSlice } from "./runSlice";
import { createUiSlice, SCREENS } from "./uiSlice";
import { createSettingsSlice, settingsToSave } from "./settingsSlice";
import { defaultSave, loadSave, saveNow, resetSave } from "@/save/save";

export const useStore = create((set, get, api) => ({
    ...createMetaSlice(set, get, api),
    ...createRunSlice(set, get, api),
    ...createUiSlice(set, get, api),
    ...createSettingsSlice(set, get, api),
}));

/**
 * Phaser가 런 시작 시 1회만 읽어가는 스냅샷.
 * ★ Phaser는 이 함수 외로 스토어를 만지지 않는다. 반대 방향(Phaser→React)은 EventBus뿐이다.
 */
export function getSnapshotForRun() {
    const s = useStore.getState();
    return {
        meta: {
            upgrades: { ...s.upgrades },
            unlocked: [...s.unlocked],
        },
        settings: { ...s.settings },
    };
}

// ── 세이브 연동 (T550) ───────────────────────────────────────────
/**
 * 현재 스토어 → 세이브 객체. 08-DATA-SCHEMA 4.3 스키마 형태를 그대로 만든다.
 * ★ 세이브 대상은 meta + settings 뿐이다. run 상태(레벨·인간성 등)는 저장하지 않는다 —
 *   런 도중 저장/복구 기능이 없으므로 저장해봐야 되살릴 수 없는 값이다.
 */
export function collectSave() {
    const s = useStore.getState();
    const base = defaultSave();
    return {
        ...base,
        gold: Math.max(0, Math.floor(s.gold)),
        sanctum: { ...base.sanctum, ...s.upgrades },
        unlocks: {
            stage2: s.unlocked.includes("stage2"),
            char2: s.unlocked.includes("char2"),
            awakenCodex: [...s.codex],
        },
        stats: { ...base.stats, ...s.stats },
        options: settingsToSave(s.settings),
    };
}

/**
 * 저장 요청. 08-DATA-SCHEMA 4.1이 정한 3개 시점(런 종료 / 성소 구매 / 옵션 변경)에서만 부른다.
 * ★ 마이크로태스크 1틱 디바운스: 옵션 슬라이더를 연타하면 탭 1회당 write가 한 번씩 나가는데,
 *   Preferences 는 네이티브 IPC라 연타 시 큐가 밀린다. 마지막 상태 한 번이면 충분하다.
 */
let pending = false;
export function persistSave() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
        pending = false;
        saveNow(collectSave());
    });
}

/**
 * 부팅 시 1회. 세이브를 읽어 meta/settings 에 주입한다.
 * ★ 실패해도 throw하지 않는다 — 세이브 하나 때문에 게임이 안 켜지는 사고를 막는다(T551).
 */
export async function hydrateStore() {
    let save;
    try {
        save = await loadSave();
    } catch (e) {
        console.error("[store] 세이브 로드 실패 — 기본값으로 시작한다", e);
        save = defaultSave();
    }
    const s = useStore.getState();
    s.hydrate(save);
    s.hydrateSettings(save.options);
    return save;
}

/** 옵션 화면의 "저장 데이터 삭제". 지운 뒤 타이틀로 되돌린다 — 성소에 남아 있으면 유령 골드가 보인다. */
export async function wipeSave() {
    await resetSave();
    const s = useStore.getState();
    s.hydrate(defaultSave());
    s.resetSettings();
    s.setScreen(SCREENS.TITLE);
}
