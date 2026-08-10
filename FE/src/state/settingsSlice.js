/**
 * settingsSlice — 옵션. 변경 시 EVENTS.CMD_SETTINGS로 Phaser에 통보한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 옵션 항목은 정본 03-GDD-CORE 13
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";

const SETTINGS_INIT = {
    bgmVolume: 0.7,
    sfxVolume: 0.8,
    screenShake: true, // 흔들림 (접근성: 끌 수 있어야 한다)
    damageNumbers: true, // 데미지 숫자
    joystickFloating: true, // true=플로팅 / false=고정
    lowQuality: false, // 저사양 모드 (파티클·이펙트 축소)
};

export const createSettingsSlice = (set, get) => ({
    settings: { ...SETTINGS_INIT },

    /**
     * 부분 갱신. 값이 바뀌면 Phaser에 1회만 통보한다.
     * ★ 여기서 emit하는 이유: 설정 변경은 "정지 시점"에만 일어나므로 EventBus 통보 비용이 무의미하다.
     */
    setSetting: (patch) => {
        const next = { ...get().settings, ...patch };
        set({ settings: next });
        EventBus.emit(EVENTS.CMD_SETTINGS, next);
    },

    resetSettings: () => {
        set({ settings: { ...SETTINGS_INIT } });
        EventBus.emit(EVENTS.CMD_SETTINGS, { ...SETTINGS_INIT });
    },
});
