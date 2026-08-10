/**
 * QualitySystem — 적응형 품질 + 성능 계측. (Day 6 / T622 T625 T626)
 *
 * 규격: 13-QA-TEST-PLAN.md 4.1(목표 수치) 4.3(계측) 4.4(미달 시 조치) / 09-ART 7.4(파티클 상한)
 *
 * ★ 차단선은 평균 fps 가 아니라 1% Low >= 40fps 다(13-QA 4.1).
 *   평균은 잘 나오는데 적이 몰리는 순간 25fps 로 떨어지면 플레이어는 바로 그 순간 죽는다.
 *   그래서 강등 판정도 평균이 아니라 "45fps 미만이 3초 지속" 이라는 **구간** 조건으로 본다(T625).
 *
 * ★ dt 를 쓰지 않고 game.loop.delta 를 쓰는 이유
 *   GameScene 이 넘기는 dt 는 scene.timeScale 이 곱해진 값이다. 히트스톱 중에는 0이 되어
 *   그 200ms 동안 fps 샘플이 멈추고 강등 타이머도 얼어붙는다. 성능 계측은 실시간이어야 한다.
 *
 * ── 통합 계약 (시그니처를 바꾸지 말 것) ──
 *   new QualitySystem(scene, { fx })
 *   .update(dt)   : fps 샘플링 + 자동 강등
 *   .level        : 0=full 1=reduced 2=minimal
 *   .setLowSpec(on)
 */
import { EventBus } from "../EventBus";
import { EVENTS } from "../constants";

/** 1% Low 를 뽑는 표본 수. 13-QA 4.3 이 "600프레임 링버퍼" 를 지정한다 (60fps 기준 10초) */
const SAMPLES = 600;
/** 매 프레임 정렬하면 계측이 계측을 방해한다. 이 간격으로만 다시 뽑는다 */
const RESORT_EVERY = 30;

const DEGRADE_FPS = 45;      // T625
const DEGRADE_SEC = 3;
const RECOVER_FPS = 57;
const RECOVER_SEC = 10;      // 강등보다 훨씬 길게 — 짧으면 경계에서 품질이 깜빡인다
const MAX_LEVEL = 2;
const SAMPLE_EMIT_SEC = 1;

export class QualitySystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.fx = ctx.fx;

        this.level = 0;
        this.lowSpec = false;

        this.samples = new Float32Array(SAMPLES).fill(60);
        this.idx = 0;
        this.filled = 0;
        this.sortBuf = new Float32Array(SAMPLES);

        this.fps = 60;
        this.low1 = 60;
        this.worstMs = 0;

        this.badTimer = 0;
        this.goodTimer = 0;
        this.emitTimer = 0;
        this.tickCount = 0;

        this._offs = [
            EventBus.on(EVENTS.CMD_SETTINGS, (s) => {
                if (typeof s?.lowQuality === "boolean") this.setLowSpec(s.lowQuality);
            }, { key: "quality:settings" }),
        ];
        scene.events.once("shutdown", () => this.destroy());
        scene.events.once("destroy", () => this.destroy());
    }

    /** @param {number} _dt GameScene 이 넘기지만 쓰지 않는다 — 위 주석 참고 */
    update(_dt) {
        const loop = this.scene.game?.loop;
        if (!loop) return;
        // 탭 복귀 직후의 거대한 delta 는 실측이 아니라 브라우저 사정이다. 표본을 오염시키지 않는다.
        const deltaMs = Math.min(loop.delta || 16.7, 200);
        const fps = 1000 / Math.max(1, deltaMs);
        const real = deltaMs / 1000;

        this.samples[this.idx] = fps;
        this.idx = (this.idx + 1) % SAMPLES;
        if (this.filled < SAMPLES) this.filled++;
        this.fps = fps;
        if (deltaMs > this.worstMs) this.worstMs = deltaMs;

        if (++this.tickCount % RESORT_EVERY === 0) this.recomputeLow1();

        this.trackQuality(real);

        this.emitTimer += real;
        if (this.emitTimer >= SAMPLE_EMIT_SEC) {
            this.emitTimer = 0;
            this.emitSample();
            this.worstMs = 0; // 창(window)마다 최악값을 다시 잰다
        }
    }

    /** 하위 1% 프레임. 정렬 비용은 0.5초에 한 번만 낸다 */
    recomputeLow1() {
        const n = this.filled;
        if (n < 30) return;
        const buf = this.sortBuf.subarray(0, n);
        buf.set(this.samples.subarray(0, n));
        buf.sort();
        this.low1 = buf[Math.max(0, Math.floor(n * 0.01))];
    }

    /**
     * T625 — 강등/복구 판정.
     * ★ 저사양 모드가 켜져 있으면 자동 판정을 하지 않는다. 사용자가 명시적으로 고른 상태를
     *   프레임이 좀 나온다고 되돌리면 "옵션이 안 먹는다" 로 보인다.
     */
    trackQuality(real) {
        if (this.lowSpec) return;

        if (this.fps < DEGRADE_FPS) { this.badTimer += real; this.goodTimer = 0; }
        else if (this.fps >= RECOVER_FPS) { this.goodTimer += real; this.badTimer = 0; }
        else { this.badTimer = 0; this.goodTimer = 0; }

        if (this.badTimer >= DEGRADE_SEC && this.level < MAX_LEVEL) {
            this.badTimer = 0;
            this.setLevel(this.level + 1, "auto-degrade");
        } else if (this.goodTimer >= RECOVER_SEC && this.level > 0) {
            this.goodTimer = 0;
            this.setLevel(this.level - 1, "auto-recover");
        }
    }

    setLevel(level, reason) {
        const next = Math.max(0, Math.min(MAX_LEVEL, level | 0));
        if (next === this.level) return;
        this.level = next;
        this.fx?.setQuality?.(next);
        EventBus.emit(EVENTS.QUALITY_CHANGED, { level: next, reason, fps: Math.round(this.fps), low1: Math.round(this.low1) });
        console.log("[Quality] level " + next + " (" + reason + ") fps=" + Math.round(this.fps) + " 1%low=" + Math.round(this.low1));
    }

    /**
     * T626 저사양 모드. 13-QA UI-04 합격 기준(파티클 <= 60, 데미지 숫자 OFF)이 곧 level 2 다.
     * 끄면 level 0 에서 자동 판정을 다시 시작한다.
     */
    setLowSpec(on) {
        const next = !!on;
        if (next === this.lowSpec) return;
        this.lowSpec = next;
        this.badTimer = 0;
        this.goodTimer = 0;
        this.setLevel(next ? MAX_LEVEL : 0, next ? "low-spec-on" : "low-spec-off");
    }

    /** 13-QA 4.3 계측 오버레이·기록 양식이 쓰는 값 */
    emitSample() {
        const gs = this.scene;
        EventBus.emit(EVENTS.PERF_SAMPLE, {
            fps: Math.round(this.fps),
            low1: Math.round(this.low1),
            worstMs: Math.round(this.worstMs),
            level: this.level,
            enemies: gs.spawnSystem?.pool?.activeCount ?? 0,
            particles: this.fx?.particles?.activeCount ?? 0,
            numbers: this.fx?.numbers?.activeCount ?? 0,
            orbs: gs.combatSystem?.orbs?.activeCount ?? 0,
        });
    }

    destroy() {
        this._offs?.forEach((f) => f());
        this._offs = null;
    }
}
