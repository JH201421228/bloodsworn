/**
 * settingsSlice — 옵션. 변경 시 EVENTS.CMD_SETTINGS로 Phaser에 통보한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 옵션 항목은 정본 03-GDD-CORE 13 / 저장 형식 08-DATA-SCHEMA 4.3
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";

const SETTINGS_INIT = {
    bgmVolume: 0.6, // 정본 03-GDD-CORE 13 및 세이브 스키마 기본값과 일치시킨 값
    sfxVolume: 0.8,
    screenShake: true, // 흔들림 (접근성: 끌 수 있어야 한다)
    damageNumbers: true, // 데미지 숫자
    joystickFloating: true, // true=플로팅 / false=고정
    lowQuality: false, // 저사양 모드 (파티클·이펙트 축소)
    lang: "ko", // i18n 키 구조만 잡아두고 전환 UI는 만들지 않는다(COULD)
};

/**
 * 스토어 ↔ 세이브 필드명이 다르다. 세이브 스키마(08 4.3)는 additionalProperties:false 라
 * 마음대로 키를 추가할 수 없고, 스토어는 boolean 이 다루기 쉽다. 변환을 여기 한 곳에 가둔다.
 */
export function settingsToSave(s) {
    return {
        bgm: s.bgmVolume,
        sfx: s.sfxVolume,
        screenShake: s.screenShake,
        damageNumbers: s.damageNumbers,
        joystickMode: s.joystickFloating ? "floating" : "fixed",
        lowSpec: s.lowQuality,
        lang: s.lang,
    };
}

export function settingsFromSave(o) {
    return {
        bgmVolume: o?.bgm ?? SETTINGS_INIT.bgmVolume,
        sfxVolume: o?.sfx ?? SETTINGS_INIT.sfxVolume,
        screenShake: o?.screenShake ?? SETTINGS_INIT.screenShake,
        damageNumbers: o?.damageNumbers ?? SETTINGS_INIT.damageNumbers,
        joystickFloating: (o?.joystickMode ?? "floating") !== "fixed",
        lowQuality: o?.lowSpec ?? SETTINGS_INIT.lowQuality,
        lang: o?.lang ?? SETTINGS_INIT.lang,
    };
}

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

    /**
     * 세이브에서 복원. 부팅 시 1회.
     * ★ emit 까지 하는 이유: Phaser 는 부팅 직후 기본값으로 시작한다. 복원한 값을 통보하지 않으면
     *   저장해둔 "화면 흔들림 OFF"가 다음 런에서 조용히 되살아난다.
     */
    hydrateSettings: (options) => {
        const next = settingsFromSave(options);
        set({ settings: next });
        EventBus.emit(EVENTS.CMD_SETTINGS, next);
    },
});
