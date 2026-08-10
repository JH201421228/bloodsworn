/**
 * EventBus — React 셸과 Phaser 게임 사이의 유일한 통로.
 * 의존성 0. React도 Phaser도 이 파일만 import 한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.1
 * 규칙: 이벤트 이름은 반드시 EVENTS 상수를 통해서만 쓴다. 문자열 리터럴 직접 사용 금지.
 *
 * ★ Phaser의 Phaser.Events.EventEmitter를 쓰지 않는 이유
 *   React 쪽에서 Phaser를 import하게 되면 번들 분리(06 14.1)가 깨진다.
 */

/** 같은 이벤트에 핸들러가 이 수를 넘으면 누수를 의심한다. (T107b 조기 경보) */
const LEAK_WARN_THRESHOLD = 24;

class EventBusImpl {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.handlers = new Map();
        /** @type {Map<string, Map<string, Function>>} event → (key → fn) */
        this.keyed = new Map();
        this.debug = false;
    }

    /**
     * @param {string} event
     * @param {Function} fn
     * @param {{ key?: string }} [opts]
     *        key를 주면 **같은 key의 기존 핸들러를 교체**한다. 즉 몇 번 호출해도 1개만 남는다.
     *        ★ T107b: Phaser 시스템처럼 "한 번만 등록되어야 하는" 구독에 반드시 key를 준다.
     *        key 없이 등록하면 StrictMode 이중 마운트에서 핸들러가 2개가 되고,
     *        PACT 축복이 2번 적용되어 밸런스 데이터가 통째로 오염된다.
     * @returns {() => void} 구독 해제 함수 (useEffect cleanup에 그대로 반환한다)
     */
    on(event, fn, opts) {
        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }

        const key = opts?.key;
        if (key) {
            let byKey = this.keyed.get(event);
            if (!byKey) {
                byKey = new Map();
                this.keyed.set(event, byKey);
            }
            // 같은 key가 이미 있으면 먼저 걷어낸다 → 중복 등록이 구조적으로 불가능해진다.
            const prev = byKey.get(key);
            if (prev) set.delete(prev);
            byKey.set(key, fn);
        }

        set.add(fn);

        if (set.size > LEAK_WARN_THRESHOLD) {
            console.warn(
                `[EventBus] "${event}" 핸들러가 ${set.size}개다. off() 누락 또는 중복 등록을 의심할 것.`
            );
        }

        return () => {
            set.delete(fn);
            if (key) this.keyed.get(event)?.delete(key);
        };
    }

    /** 1회성 구독 */
    once(event, fn) {
        const off = this.on(event, (payload) => {
            off();
            fn(payload);
        });
        return off;
    }

    off(event, fn) {
        this.handlers.get(event)?.delete(fn);
    }

    /**
     * @param {string} event
     * @param {any} [payload]
     */
    emit(event, payload) {
        if (this.debug) console.log("[EB]", event, payload);
        const set = this.handlers.get(event);
        if (!set) return;
        // 핸들러 안에서 off()를 부를 수 있으므로 복사 후 순회
        for (const fn of [...set]) {
            try {
                fn(payload);
            } catch (e) {
                console.error(`[EventBus] handler error on "${event}"`, e);
            }
        }
    }

    /** 게임 재시작 시 Phaser 쪽 구독만 정리하기 위해 사용. React 구독은 useEffect가 정리한다. */
    clear(event) {
        if (event) {
            this.handlers.delete(event);
            this.keyed.delete(event);
        } else {
            this.handlers.clear();
            this.keyed.clear();
        }
    }

    /** 디버그용 — 현재 구독 수를 이벤트별로 센다. */
    counts() {
        const out = {};
        for (const [event, set] of this.handlers) out[event] = set.size;
        return out;
    }
}

export const EventBus = new EventBusImpl();
