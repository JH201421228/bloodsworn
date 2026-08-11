/**
 * 이벤트 이름 상수 및 전역 상수.
 * 오타 하나로 반나절을 날리지 않기 위한 장치 — 문자열 리터럴 직접 사용 금지.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.1 / 3.2
 * ★ 이 표에 없는 이벤트는 만들지 않는다. 늘려야 하면 06 3.2부터 고친다.
 */

export const EVENTS = {
    // ── Phaser → React (P→R) ──
    BOOT_READY: "boot:ready",
    ASSET_PROGRESS: "asset:progress",
    RUN_STARTED: "run:started",
    RUN_PHASE_CHANGED: "run:phase-changed",
    RUN_LEVELUP: "run:levelup",
    PACT_APPLIED: "pact:applied",
    AWAKENING_TRIGGERED: "awakening:triggered",
    HUMANITY_ZERO: "humanity:zero",
    ELITE_SPAWNED: "elite:spawned",
    CHEST_OPENED: "chest:opened",
    ITEM_PICKED: "item:picked",
    BOSS_SPAWNED: "boss:spawned",
    BOSS_HP: "boss:hp",
    RUN_PAUSED: "run:paused",
    RUN_RESUMED: "run:resumed",
    RUN_ENDED: "run:ended",
    /** M-1 사망 시 부활 제안. React 가 CMD_REVIVE 로 반드시 응답한다(8초 타임아웃 존재) */
    REVIVE_OFFER: "revive:offer",
    PERF_SAMPLE: "perf:sample",
    QUALITY_CHANGED: "quality:changed",
    FATAL_ERROR: "error:fatal",

    // ── React → Phaser (R→P) ──
    CMD_START_RUN: "cmd:start-run",
    CMD_PACT_CHOOSE: "cmd:pact-choose",
    CMD_PACT_REROLL: "cmd:pact-reroll",
    CMD_PACT_SKIP: "cmd:pact-skip",
    CMD_AWAKENING_ACK: "cmd:awakening-ack",
    CMD_PAUSE: "cmd:pause",
    CMD_RESUME: "cmd:resume",
    CMD_ABANDON: "cmd:abandon",
    CMD_REVIVE: "cmd:revive", // { accepted: boolean }
    CMD_SETTINGS: "cmd:settings",
    CMD_DEBUG: "cmd:debug",
};

/** 씬 키 — scene.start()에 문자열을 직접 쓰지 않는다. */
export const SCENES = {
    BOOT: "BootScene",
    PRELOAD: "PreloadScene",
    GAME: "GameScene",
    HUD: "HudScene",
    DEBUG: "DebugScene",
};

/** 렌더 깊이. 숫자를 흩뿌리지 않고 여기서만 관리한다. */
export const DEPTH = {
    GROUND: 0,
    DECO: 10,
    ORB: 20,
    ENEMY: 30,
    PLAYER: 40,
    PROJECTILE: 50,
    FX: 60,
    DAMAGE_TEXT: 70,
    HUD: 100,
};

/** 대가 태그 6종. 정본 04-PACT-SYSTEM 4 */
export const TOLL_TAGS = ["FRAIL", "SLOW", "MYOPIA", "GREED", "BLIND", "HUNGER"];

/** 각성 발동 중첩 수. 정본 04-PACT-SYSTEM 5 */
export const AWAKEN_STACKS = 3;
