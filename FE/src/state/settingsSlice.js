/**
 * settingsSlice — 옵션. 변경 시 EVENTS.CMD_SETTINGS로 Phaser에 통보한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 옵션 항목은 정본 03-GDD-CORE 13 / 저장 형식 08-DATA-SCHEMA 4.3
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";

const SETTINGS_INIT = {
    // ★ 0.6 → 0.9 (2026-08). 실효 볼륨은 「곡별 vol x 이 값」이라 이중으로 깎인다
    //   (audio.json 중앙값 0.50 → 타이틀 0.50x0.6 = 0.30 밖에 안 나왔다).
    //   곡별 vol 은 13곡 사이의 상대 밸런스라 건드리지 않고 여기만 올린다.
    //   0.9 인 이유: 옵션 볼륨 스텝이 0.1 격자라 격자 위에 있어야 첫 조작에서 값이 안 튀고,
    //   1.0 으로 올리면 사용자가 더 키울 여지가 사라진다.
    //   ★ 정본 03-GDD-CORE 13 / 08-DATA-SCHEMA 4.3 / AudioSystem 초기값과 반드시 같아야 한다.
    bgmVolume: 0.9,
    sfxVolume: 0.8,
    screenShake: true, // 흔들림 (접근성: 끌 수 있어야 한다)
    damageNumbers: true, // 데미지 숫자
    joystickFloating: false, // true=플로팅 / false=고정. 기본은 「고정」이다(10-UIUX 5.3)
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
        // ★ 기본값이 「고정」으로 바뀌었다(2026-08). 저장본에 joystickMode 가 있으면 그 값이 이긴다 —
        //   예전에 「플로팅」을 골라 저장한 사용자의 선택을 새 기본값이 덮어쓰면 안 된다.
        //   키가 아예 없을 때만 새 기본값(fixed)을 쓴다.
        joystickFloating: (o?.joystickMode ?? "fixed") !== "fixed",
        lowQuality: o?.lowSpec ?? SETTINGS_INIT.lowQuality,
        lang: o?.lang ?? SETTINGS_INIT.lang,
    };
}

/**
 * ★ 런이 시작될 때 설정을 한 번 더 통보한다 (2026-08).
 *
 *   hydrateSettings 의 emit 은 **부팅 직후 1회**다. 그런데 CMD_SETTINGS 를 듣는 쪽은 두 종류다.
 *     - 모듈 싱글턴(InputSystem)  : import 시점에 이미 구독하고 있다 → 부팅 emit 을 받는다
 *     - GameScene 이 만드는 시스템 : AudioSystem / FxSystem / QualitySystem 은 **런을 시작할 때**
 *                                    생성된다 → 부팅 emit 은 이미 지나갔다
 *   그래서 「BGM 30% 로 저장해 둔 사용자」가 런에 들어가면 스토어·옵션 화면은 30% 인데
 *   실제 소리는 코드 기본값으로 났다(실측 확인). 흔들림 OFF·저사양 ON 도 같은 구멍이었다.
 *   RUN_STARTED 는 GameScene.create 의 **맨 끝**에서 나오므로 그때 다시 쏘면 세 시스템이 전부 받는다.
 * ★ 멱등하다 — 세 핸들러 모두 값을 대입할 뿐이라 몇 번을 받아도 결과가 같다.
 * ★ 60fps 경로가 아니다. 런 시작 1회뿐이라 비용이 없다.
 */
export const createSettingsSlice = (set, get) => {
    EventBus.on(EVENTS.RUN_STARTED, () => {
        EventBus.emit(EVENTS.CMD_SETTINGS, get().settings);
    }, { key: "settings:run-started" });

    return {
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
    };
};
