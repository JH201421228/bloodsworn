/**
 * AudioSystem — BGM 5구간 크로스페이드 + 절차적 SFX. (Day 6 / T610~T613)
 *
 * 규격: 09-ART-AUDIO-AND-ASSET-MAP.md 5(BGM 배정) 6(SFX 12종) / 13-QA 3.9(AU-01~12)
 * 데이터: src/data/audio.json — 곡 목록·볼륨·페이드·스로틀은 전부 거기 있다.
 *
 * ★ 모바일 자동재생 정책 때문에 첫 터치 전에는 어떤 소리도 나지 않는다(T611).
 *   unlock()을 첫 포인터 입력에 반드시 물려야 한다. GameScene이 이미 물려 두었다.
 *   iOS 무음 스위치가 켜져 있으면 unlock 이 성공해도 소리가 안 난다 — 버그가 아니다(13-QA AU-11).
 *
 * ★ 페이드를 scene.tweens 가 아니라 game.events "prestep" 으로 돌리는 이유
 *   PACT 카드가 뜨면 CombatSystem 이 scene.pause() 를 부른다. 씬이 멈추면 씬 트윈도 멈춘다.
 *   그 위에서 덕킹 트윈을 돌리면 카드가 열린 순간 볼륨이 중간값에 얼어붙는다.
 *   게임 루프 이벤트는 씬 정지와 무관하게 계속 돌고, 히트스톱(scene.timeScale=0)에도 영향받지 않는다.
 *   → 13-QA AU-08 "히트스톱 200ms 동안 오디오는 정상 속도로 계속 재생" 을 구조적으로 보장한다.
 *
 * ★ 절차적 SFX 를 택한 이유(T612)
 *   asset/ 7,846 파일 중 효과음은 0개다(09-ART 6.1). 외부 조달은 라이선스 개별 확인이 필요하고
 *   용량과 로딩이 늘어난다. 코드 합성은 라이선스 0 / 용량 0 / 피치 랜덤화가 공짜다.
 *
 * ── 통합 계약 (시그니처를 바꾸지 말 것) ──
 *   new AudioSystem(scene)
 *   .unlock()             : 첫 터치에서 호출
 *   .playBgm(key)         : 크로스페이드 전환. "run"|"boss"|"title"|"sanctum"|"result-win"|"result-lose"
 *   .sfx(name, opts)      : 효과음. 중복은 내부에서 억제(T613)
 *   .setVolume(bgm, sfx)  : 0~1
 *   .stopAll()
 */
import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { EVENTS } from "../constants";
import audioData from "@/data/audio.json";

/** 지수 램프는 0을 목표로 잡을 수 없다(WebAudio 사양). 사실상 무음인 하한값. */
const SILENT = 0.0001;

/**
 * 절차적 SFX 합성기. Phaser 의 AudioContext 를 빌려 쓴다 —
 * 컨텍스트를 따로 만들면 첫 터치 언락이 한쪽에만 걸려 "가끔 소리가 안 나는" 버그가 된다.
 */
class ProcSfx {
    constructor(ctx, volume) {
        this.ctx = ctx;
        this.bus = ctx.createGain();
        this.bus.gain.value = volume;
        this.bus.connect(ctx.destination);
        // 노이즈 소스는 1초짜리 버퍼 1장을 전 효과음이 공유한다. 매번 만들면 런 중 new 금지 규칙 위반.
        this.noise = this._noiseBuffer(1.0);
        /** 동시 발음 추적 — 각 원소는 "이 시각까지 울린다"는 ms 타임스탬프 */
        this.voices = [];
    }

    setVolume(v) {
        this.bus.gain.value = Math.max(0, Math.min(1, v));
    }

    _noiseBuffer(sec) {
        const n = Math.floor(this.ctx.sampleRate * sec);
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    /** 살아 있는 보이스 수. 만료된 것은 이 때 걷어낸다 — 별도 타이머를 두지 않기 위해서다. */
    voiceCount(now) {
        const v = this.voices;
        for (let i = v.length - 1; i >= 0; i--) if (v[i] <= now) { v[i] = v[v.length - 1]; v.pop(); }
        return v.length;
    }

    reserve(now, durMs) { this.voices.push(now + durMs); }

    /** 톤 1발: f0 → f1 글라이드 + 지수 감쇠 */
    tone({ type = "square", f0, f1 = f0, dur = 0.1, gain = 0.3, delay = 0, detune = 0 }) {
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.detune.value = detune;
        osc.frequency.setValueAtTime(Math.max(1, f0), t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(SILENT, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.004); // 4ms 어택
        g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
        osc.connect(g).connect(this.bus);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    /** 노이즈 1발: 필터로 음색을 정한다 */
    noiseHit({ freq = 1200, q = 1.2, dur = 0.08, gain = 0.3, delay = 0, type = "bandpass" }) {
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const flt = this.ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.setValueAtTime(freq, t);
        flt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.35), t + dur);
        flt.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
        src.connect(flt).connect(g).connect(this.bus);
        src.start(t);
        src.stop(t + dur + 0.02);
    }
}

/**
 * SFX 레시피 12종+ (09-ART 6.5). 각 함수는 (s: ProcSfx, o: opts) 를 받고 **대략 지속시간(ms)** 을 반환한다.
 * 반환값은 동시 발음 계산에만 쓴다 — 정확할 필요는 없고 과소평가만 아니면 된다.
 *
 * ★ 피치를 랜덤화하는 이유: 초당 20~40회 나는 타격음이 완전히 같으면 기계음처럼 들린다.
 *   ±120cent 흔들면 같은 소재로도 귀가 "다른 타격"으로 받아들인다.
 */
const RECIPES = {
    /** 1. 적 피격 — 매우 짧고 건조하게. 이 소리가 길면 150체 전투에서 화면이 웅웅거린다 */
    hit: (s) => {
        const d = (Math.random() * 2 - 1) * 120;
        s.noiseHit({ freq: 900, q: 0.9, dur: 0.045, gain: 0.22 });
        s.tone({ type: "square", f0: 220, f1: 90, dur: 0.05, gain: 0.12, detune: d });
        return 60;
    },
    /** 2. 적 처치 — "뼈가 부서지는" 질감 */
    kill: (s) => {
        s.noiseHit({ freq: 2200, q: 0.6, dur: 0.09, gain: 0.2 });
        s.tone({ type: "sawtooth", f0: 320, f1: 60, dur: 0.14, gain: 0.18 });
        return 160;
    },
    /** 3. 플레이어 피격 — 적 피격보다 확실히 저역이어야 "내가 맞았다"가 즉시 구분된다 */
    hurt: (s) => {
        s.tone({ type: "sine", f0: 140, f1: 45, dur: 0.22, gain: 0.42 });
        s.noiseHit({ freq: 500, q: 0.8, dur: 0.13, gain: 0.24 });
        return 240;
    },
    /** 4. 레벨업 — C5-E5-G5. 밝지만 화려하지 않게(고딕 톤을 깨지 않는다) */
    levelUp: (s) => {
        [523.25, 659.25, 783.99].forEach((f, i) =>
            s.tone({ type: "triangle", f0: f, f1: f, dur: 0.16, gain: 0.22, delay: i * 0.075 }));
        return 400;
    },
    /** 5. 카드 선택 — 양피지 스크래치 + 인장 찍기. 정본 "계약서" 모티프 */
    cardSelect: (s) => {
        s.noiseHit({ freq: 3200, q: 0.5, dur: 0.1, gain: 0.14 });
        s.tone({ type: "sine", f0: 180, f1: 150, dur: 0.09, gain: 0.28, delay: 0.06 });
        return 170;
    },
    /**
     * 6. ★ 각성 스팅 — 낮은 종 + 심장 2박. 정본 04-PACT 5.2 가 명시한 게임의 대표 순간이다.
     *    55Hz 기음 + 3배음 + 옥타브로 종의 배음렬을 흉내내고, 0.55s 뒤 심장박동을 얹는다.
     */
    awaken: (s) => {
        s.tone({ type: "sine", f0: 55, f1: 52, dur: 1.6, gain: 0.5 });
        s.tone({ type: "sine", f0: 82.5, f1: 78, dur: 1.4, gain: 0.22 });
        s.tone({ type: "sine", f0: 165, f1: 156, dur: 0.9, gain: 0.14 });
        s.noiseHit({ freq: 4000, q: 0.4, dur: 0.35, gain: 0.18 });
        [0.0, 0.28].forEach((d) =>
            s.tone({ type: "sine", f0: 70, f1: 32, dur: 0.2, gain: 0.45, delay: 0.55 + d }));
        return 1700;
    },
    /** 7. 대시 — 공기 가르는 소리 */
    dash: (s) => {
        s.noiseHit({ freq: 5000, q: 0.4, dur: 0.16, gain: 0.22, type: "highpass" });
        return 180;
    },
    /** 8. 보스 등장 — 서브 브라스 + 룸블. 붉은 플래시와 동기 */
    bossAppear: (s) => {
        s.tone({ type: "sawtooth", f0: 38, f1: 30, dur: 1.2, gain: 0.55 });
        s.tone({ type: "square", f0: 76, f1: 60, dur: 1.0, gain: 0.18 });
        s.noiseHit({ freq: 220, q: 1.4, dur: 1.1, gain: 0.28, type: "lowpass" });
        return 1300;
    },
    /** 9. 게임오버 — 300→22Hz 글리산도. 끝을 길게 끌어 정적으로 넘긴다 */
    gameOver: (s) => {
        s.tone({ type: "sine", f0: 300, f1: 22, dur: 1.5, gain: 0.45 });
        s.noiseHit({ freq: 700, q: 0.5, dur: 0.9, gain: 0.16, type: "lowpass" });
        return 1600;
    },
    /** 10. UI 탭 */
    uiTap: (s) => {
        s.tone({ type: "square", f0: 900, f1: 700, dur: 0.03, gain: 0.16 });
        return 40;
    },
    /** 11. EXP 오브 — ±3반음 랜덤. 연속 획득이 멜로디처럼 들리게 하는 장치다 */
    pickup: (s) => {
        const f = 880 * Math.pow(2, (Math.floor(Math.random() * 7) - 3) / 12);
        s.tone({ type: "triangle", f0: f, f1: f * 1.5, dur: 0.055, gain: 0.13 });
        return 70;
    },
    /** 12. 골드/회복 — C6 + G6 동전 딸랑 */
    gold: (s) => {
        s.tone({ type: "triangle", f0: 1046, f1: 1046, dur: 0.07, gain: 0.16 });
        s.tone({ type: "triangle", f0: 1568, f1: 1568, dur: 0.09, gain: 0.12, delay: 0.045 });
        return 140;
    },
    /** 13. W1 참격 — 금속 스윕. hit 과 겹쳐 나므로 대역을 위로 띄워 자리를 비켜준다 */
    slash: (s) => {
        s.noiseHit({ freq: 3400, q: 1.6, dur: 0.11, gain: 0.16, type: "bandpass" });
        s.tone({ type: "sawtooth", f0: 640, f1: 180, dur: 0.09, gain: 0.1 });
        return 130;
    },
    /** 14. W2 화염탄 발사 — 짧은 훅 */
    fire: (s) => {
        s.noiseHit({ freq: 1400, q: 1.1, dur: 0.06, gain: 0.15 });
        s.tone({ type: "sawtooth", f0: 180, f1: 420, dur: 0.06, gain: 0.1 });
        return 80;
    },
    /** 15. 보스 피격 — 일반 hit 보다 무겁고 금속성. 보스에 맞고 있다는 피드백이 명확해야 한다 */
    bossHit: (s) => {
        s.noiseHit({ freq: 1600, q: 2.2, dur: 0.12, gain: 0.2, type: "bandpass" });
        s.tone({ type: "square", f0: 130, f1: 70, dur: 0.1, gain: 0.2 });
        return 140;
    },
};

export class AudioSystem {
    constructor(scene) {
        this.scene = scene;
        this.unlocked = false;
        this.bgmVolume = 0.6;
        this.sfxVolume = 0.8;

        this.data = audioData;
        this.tracks = Object.fromEntries(audioData.tracks.map((t) => [t.key, t]));
        this.cfg = audioData.sfx;

        /** @type {Object<string, Phaser.Sound.BaseSound>} 생성된 BGM 인스턴스 */
        this.sounds = {};
        /** @type {Map<string, {from:number,to:number,t:number,dur:number,stop:boolean}>} 진행 중인 페이드 */
        this.fades = new Map();
        /** @type {Set<string>} 지금 울려야 하는 트랙 집합 */
        this.plan = new Set();

        this.mode = "none";      // "none" | "phased" | "screen"
        this.phaseIndex = -1;
        // ★ 기본 요청을 "run" 으로 깔아 두는 이유
        //   AudioSystem 을 만드는 곳은 GameScene 뿐이고, 그 시점에 울려야 할 것은 런 BGM 뿐이다.
        //   GameScene 이 playBgm 을 부르지 않아도 첫 터치(unlock)에서 자동으로 시작한다 —
        //   공유 파일을 건드리지 않고 T610 이 동작하게 만드는 최소 장치다.
        this.pendingBgm = "run";
        this.duckFactor = 1;
        this.duckUntil = 0;

        /** @type {ProcSfx|null} 언락 시점에 만든다 — 컨텍스트가 suspended 인 동안 노드를 쌓아 두면 첫 소리가 몰려 터진다 */
        this.synth = null;
        this.lastPlayed = Object.create(null); // name -> ms
        this.frameCount = 0;
        this.frameStamp = 0;

        // 페이드/구간 판정 틱. 씬 정지·히트스톱과 무관해야 하므로 게임 루프에 붙인다.
        this._tick = this._tick.bind(this);
        scene.game.events.on(Phaser.Core.Events.PRE_STEP, this._tick);

        this._offs = [
            EventBus.on(EVENTS.CMD_SETTINGS, (s) => this.setVolume(s?.bgmVolume, s?.sfxVolume), { key: "audio:settings" }),
            EventBus.on(EVENTS.RUN_LEVELUP, () => { this.sfx("levelUp"); this.duck(this.data.duck.cardOpen, 0); }, { key: "audio:levelup" }),
            EventBus.on(EVENTS.PACT_APPLIED, () => { this.sfx("cardSelect"); this.duck(1, 0); }, { key: "audio:pact" }),
            EventBus.on(EVENTS.AWAKENING_TRIGGERED, () => {
                // 각성 스팅은 게임의 대표 순간이다. 스로틀에 걸려 사라지면 안 된다(정본 04-PACT 5.2)
                this.sfx("awaken", { force: true });
                this.duck(this.data.duck.awakening, this.data.duck.awakeningMs);
            }, { key: "audio:awaken" }),
            EventBus.on(EVENTS.BOSS_SPAWNED, () => { this.sfx("bossAppear", { force: true }); this.playBgm("boss"); }, { key: "audio:boss" }),
            EventBus.on(EVENTS.RUN_ENDED, (p) => {
                const win = p?.reason === "clear";
                if (!win) this.sfx("gameOver", { force: true }); // 승리에 하강 글리산도를 깔면 결과가 뒤집혀 읽힌다
                this.playBgm(win ? "result-win" : "result-lose");
            }, { key: "audio:ended" }),
        ];
        scene.events.once("shutdown", () => this.destroy());
        scene.events.once("destroy", () => this.destroy());
    }

    // ── 언락 ────────────────────────────────────────────────
    /**
     * T611. 첫 터치에서 호출된다. 이게 없으면 iOS/Android 에서 소리가 전혀 나지 않는다.
     * ★ sound.unlock() 과 context.resume() 을 둘 다 부르는 이유
     *   Phaser 의 unlock 은 "잠김 상태로 감지된 경우"에만 resume 을 예약한다.
     *   앱이 백그라운드에 다녀오면 잠금 플래그 없이 컨텍스트만 suspended 로 남는 경우가 있다(AU-12).
     */
    unlock() {
        this.unlocked = true;
        const sm = this.scene.sound;
        try {
            if (typeof sm?.unlock === "function") sm.unlock();
            const ctx = sm?.context;
            if (ctx) {
                if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
                if (!this.synth) this.synth = new ProcSfx(ctx, this.sfxVolume);
            }
        } catch (e) {
            console.warn("[AudioSystem] 언락 실패 — 무음으로 계속 진행한다", e);
        }
        if (this.pendingBgm) {
            const k = this.pendingBgm;
            this.pendingBgm = null;
            this.playBgm(k);
        }
    }

    // ── BGM ────────────────────────────────────────────────
    /**
     * @param {string} key "run"|"boss"|"title"|"sanctum"|"result-win"|"result-lose" 또는 트랙 키 직접 지정
     */
    playBgm(key) {
        if (!key) return;
        // 언락 전에는 재생을 시작하지 않는다. 시작해 두면 브라우저가 막아 "재생 중인데 무음"이 된다.
        if (!this.unlocked) { this.pendingBgm = key; return; }

        const screen = this.data.screens[key];
        if (screen?.phased) {
            this.mode = "phased";
            this.phaseIndex = -1; // 다음 틱에서 현재 시각에 맞는 구간이 즉시 적용된다
            return;
        }
        this.mode = "screen";
        this.phaseIndex = -1;
        if (screen) {
            if (screen.intro) this.oneShot(screen.intro);
            const next = new Set(screen.layers ?? []);
            if (screen.bed) next.add(screen.bed);
            this.apply(next, screen.fadeMs ?? this.data.fade.sceneChange, screen.layerFadeMs);
        } else if (this.tracks[key]) {
            this.apply(new Set([key]), this.data.fade.sceneChange);
        } else {
            console.warn("[AudioSystem] 모르는 BGM 키: " + key);
        }
    }

    /** 루프하지 않는 1회성 트랙(보스 오프너 등). 페이드 관리 대상에서 제외한다 */
    oneShot(key) {
        const s = this.ensure(key);
        if (!s) return;
        s.setVolume(this.targetFor(key));
        if (!s.isPlaying) s.play();
    }

    /**
     * 목표 트랙 집합으로 크로스페이드한다.
     * @param {Set<string>} next
     * @param {number} outMs 빠지는 트랙의 페이드아웃 시간
     * @param {number} [inMs] 들어오는 트랙의 페이드인 시간. 없으면 outMs 와 같다
     */
    apply(next, outMs, inMs) {
        for (const key of this.plan) {
            if (!next.has(key)) this.fadeTo(key, 0, outMs, true);
        }
        for (const key of next) {
            if (!this.plan.has(key)) {
                const s = this.ensure(key);
                if (!s) continue;
                s.setVolume(0);
                if (!s.isPlaying) s.play();
                this.fadeTo(key, this.targetFor(key), inMs ?? outMs, false);
            }
        }
        this.plan = next;
    }

    /** 캐시에 파일이 없으면 조용히 null. 오디오가 없다고 게임이 멈추면 안 된다 */
    ensure(key) {
        if (this.sounds[key]) return this.sounds[key];
        const def = this.tracks[key];
        if (!def) return null;
        if (!this.scene.cache.audio.exists(key)) return null;
        try {
            // 규칙 A3 — 레이어는 seek(0) 재시작이 아니라 겹쳐 페이드한다. loop 는 데이터가 정한다.
            const s = this.scene.sound.add(key, { loop: def.loop !== false, volume: 0 });
            this.sounds[key] = s;
            return s;
        } catch (e) {
            console.warn("[AudioSystem] 사운드 생성 실패: " + key, e);
            return null;
        }
    }

    targetFor(key) {
        const def = this.tracks[key];
        return (def?.vol ?? 0.5) * this.bgmVolume * this.duckFactor;
    }

    /**
     * ★ equal-power 크로스페이드(규칙 A1). 선형 페이드는 교차 지점에서 합성 파워가 −3dB 파인다.
     *   들어오는 쪽 sin(p·π/2) / 빠지는 쪽 cos(p·π/2) 를 쓰면 합이 일정하게 유지된다.
     *   양쪽 다 0이 아닌 경우(볼륨 옵션 변경 등)는 교차가 아니므로 그냥 선형으로 옮긴다.
     */
    fadeTo(key, to, ms, stop) {
        const s = this.sounds[key];
        if (!s) return;
        if (ms <= 0) {
            s.setVolume(to);
            this.fades.delete(key);
            if (stop) this.release(key);
            return;
        }
        this.fades.set(key, { from: s.volume, to, t: 0, dur: ms / 1000, stop: !!stop });
    }

    release(key) {
        const s = this.sounds[key];
        if (!s) return;
        s.stop();
    }

    /** 게임 루프 틱. 씬이 pause 여도, 히트스톱으로 scene.timeScale=0 이어도 계속 돈다 */
    _tick(_time, delta) {
        const dt = Math.min(delta, 100) / 1000;

        // 1) 페이드 진행
        if (this.fades.size) {
            for (const [key, f] of this.fades) {
                f.t += dt;
                const p = Math.min(1, f.t / f.dur);
                let v;
                if (f.from <= SILENT) v = f.to * Math.sin((p * Math.PI) / 2);        // 페이드인
                else if (f.to <= SILENT) v = f.from * Math.cos((p * Math.PI) / 2);   // 페이드아웃
                else v = f.from + (f.to - f.from) * p;                                // 교차가 아닌 단순 이동
                const s = this.sounds[key];
                if (s) s.setVolume(Math.max(0, v));
                if (p >= 1) {
                    this.fades.delete(key);
                    if (f.stop) this.release(key);
                }
            }
        }

        // 2) 덕킹 해제
        if (this.duckUntil && _time >= this.duckUntil) {
            this.duckUntil = 0;
            this.duck(1, 0);
        }

        // 3) 런 구간 전환 (T610). 시각의 정본은 SpawnSystem 의 경과 시간이다 —
        //    오디오가 자체 시계를 굴리면 치트 BS.setTime() 과 어긋나 디버깅이 불가능해진다.
        if (this.mode !== "phased") return;
        const elapsed = this.scene.spawnSystem?.elapsed ?? 0;
        const phases = this.data.phases;
        let idx = 0;
        for (let i = 0; i < phases.length; i++) if (elapsed >= phases[i].t) idx = i;
        if (idx === this.phaseIndex) return;
        const first = this.phaseIndex < 0;
        this.phaseIndex = idx;
        const ph = phases[idx];
        const next = new Set(ph.layers ?? []);
        if (ph.bed) next.add(ph.bed);
        this.apply(next, first ? this.data.fade.sceneChange : this.data.fade.phaseChange);
    }

    /**
     * BGM 일시 감쇠. 카드가 열리거나 각성 스팅이 울리는 동안 BGM 이 스팅을 덮으면 안 된다.
     * @param {number} factor 0~1
     * @param {number} ms 0이면 수동 해제(다음 duck(1,0) 까지 유지)
     */
    duck(factor, ms) {
        this.duckFactor = factor;
        this.duckUntil = ms > 0 ? this.scene.game.loop.time + ms : 0;
        const fade = this.data.fade.duck;
        for (const key of this.plan) this.fadeTo(key, this.targetFor(key), fade, false);
    }

    // ── SFX ────────────────────────────────────────────────
    /**
     * @param {string} name RECIPES 키
     * @param {{force?:boolean}} [opts] force=true 면 스로틀을 무시한다(각성 등 절대 놓치면 안 되는 소리)
     */
    sfx(name, opts) {
        const s = this.synth;
        if (!s || this.sfxVolume <= 0) return;
        const recipe = RECIPES[name];
        if (!recipe) return;

        const now = this.scene.game.loop.time;
        const force = opts?.force === true;

        if (!force) {
            // T613 — 같은 소리의 연타 억제. 8ms 는 태스크가 정한 하한이고,
            // 개별 값(09-ART 6.4)이 더 크면 그쪽을 쓴다. 적 150체 동시 처치 시 이게 없으면 소리가 뭉갠다.
            const gap = this.cfg.throttleMs[name] ?? this.cfg.defaultThrottleMs;
            if (now - (this.lastPlayed[name] ?? -1e9) < gap) return;

            // 프레임당 트리거 상한 — 서로 다른 소리 12종이 한 프레임에 몰리는 것도 막아야 한다
            if (this.frameStamp !== now) { this.frameStamp = now; this.frameCount = 0; }
            if (this.frameCount >= this.cfg.maxPerFrame) return;
            this.frameCount++;

            if (s.voiceCount(now) >= this.cfg.maxVoices) return; // 13-QA AU-07
        }

        this.lastPlayed[name] = now;
        try {
            s.reserve(now, recipe(s, opts) || 100);
        } catch (e) {
            // 오디오 노드 생성 실패가 전투를 멈추면 안 된다
            console.warn("[AudioSystem] SFX 실패: " + name, e);
        }
    }

    // ── 볼륨 / 정리 ─────────────────────────────────────────
    /** AU-05: 재시작 없이 즉시 반영되어야 한다 */
    setVolume(bgm, sfx) {
        if (typeof bgm === "number") this.bgmVolume = Math.max(0, Math.min(1, bgm));
        if (typeof sfx === "number") this.sfxVolume = Math.max(0, Math.min(1, sfx));
        this.synth?.setVolume(this.sfxVolume);
        for (const key of this.plan) this.fadeTo(key, this.targetFor(key), 120, false);
    }

    stopAll() {
        this.fades.clear();
        for (const key of Object.keys(this.sounds)) this.release(key);
        this.plan = new Set();
        this.mode = "none";
        this.phaseIndex = -1;
        this.pendingBgm = null;
    }

    destroy() {
        this.scene.game.events.off(Phaser.Core.Events.PRE_STEP, this._tick);
        this._offs?.forEach((f) => f());
        this._offs = null;
        this.stopAll();
    }
}
