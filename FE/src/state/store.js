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
import { createUiSlice } from "./uiSlice";
import { createSettingsSlice } from "./settingsSlice";

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
