/**
 * FxSystem — 타격감 연출. 데미지 숫자 / 히트스톱 / 화면 흔들림 / 처치 이펙트. (Day 6 / T623 T624 T630)
 *
 * 규격: 09-ART-AUDIO-AND-ASSET-MAP.md 7.1(피격) 7.2(히트스톱) 7.3(흔들림) 7.4(파티클 상한)
 *
 * ★ 전투 로직이 연출에 의존하면 안 된다. CombatSystem 은 this.fx?.xxx() 로만 부른다.
 *   그래서 이 안에서 예외가 나면 게임이 통째로 멈춘다 — 모든 공개 메서드는 방어적으로 짠다.
 *
 * ★ 런 중 new 금지(06-TECH 5.1). 데미지 숫자와 파티클은 전부 생성자에서 만들어 두고 재활용한다.
 *   적 150체가 한 프레임에 맞으면 숫자 150개가 뜬다 → 풀 크기 자체가 상한이다(T624).
 *
 * ★ 전투 SFX 를 여기서 부르는 이유
 *   CombatSystem 은 이미 fx?.damageNumber / killBurst / playerHurt 를 부르고 있다.
 *   같은 지점에서 소리도 내면 CombatSystem 이 오디오를 전혀 몰라도 된다 —
 *   공유 파일을 건드리지 않고 타격음이 붙는다.
 *
 * ── 통합 계약 (시그니처를 바꾸지 말 것) ──
 *   new FxSystem(scene, { player })
 *   .damageNumber(x, y, amount, isCrit)
 *   .killBurst(x, y)
 *   .playerHurt()
 *   .hitStop(ms)
 *   .update(dt)
 */
import Phaser from "phaser";
import { Pool } from "../pools/Pool";
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";

/** 폭발 스프라이트. 매니페스트 키와 같아야 한다 */
const BURST_KEY = "fx-slash";
const BURST_ANIM = "fx.burst";
/** 동시 폭발 상한. 넘치면 가장 오래된 것을 회수한다 */
const MAX_BURST = 6;

const BONE = 0xd8cfc0;   // 09-ART 1.1 기본 텍스트색
const GOLD = 0xe8b44c;   // 치명타
const BLOOD = 0x8e1220;  // 피 파티클
const CRIMSON = 0xd6203a;

/** 09-ART 7.3 흔들림 강도표. 상한 0.015 — 그 이상은 가로 화면에서 멀미를 유발한다 */
const SHAKE = {
    dash: [60, 0.002],
    killElite: [120, 0.003],
    playerHurt: [120, 0.004],
    zoneImpact: [100, 0.004],
    eliteSpawn: [300, 0.006],
    bossHit: [200, 0.008],
    bossAppear: [800, 0.012],
    awaken: [500, 0.015],
    death: [400, 0.01],
};

/** 품질 레벨별 상한 (09-ART 7.4). 0=full 1=reduced 2=minimal */
const CAPS = [
    { numbers: 24, particles: 300, perKill: 3, hitStop: true },
    { numbers: 12, particles: 150, perKill: 2, hitStop: true },
    { numbers: 0, particles: 60, perKill: 0, hitStop: false },
];

const FLASH_MS = 60;      // 09-ART 7.1 피격 플래시
const FLASH_POOL = 256;   // 한 프레임에 150체가 맞아도 여유가 있다
const NUM_POOL = 24;      // 상한의 최대값. 품질이 낮아져도 풀은 그대로 두고 사용량만 줄인다
const PARTICLE_POOL = 300;
const NUM_LIFE = 0.5;     // s
const NUM_RISE = 18;      // px

/**
 * 3x5 픽셀 숫자 글리프. 비트 1 = 불투명.
 * ★ 폰트를 코드로 굽는 이유(T623)
 *   데미지 숫자는 초당 수십 개가 갱신된다. Phaser Text 는 setText 마다 캔버스를 다시 래스터라이즈하고
 *   객체마다 텍스처가 달라 배칭이 깨진다. BitmapText 는 글리프 하나짜리 텍스처를 공유해 드로우콜이 1개로 수렴한다.
 *   그런데 프로젝트에 비트맵 폰트 에셋이 없다 → 런타임에 만든다. 에셋 의존이 늘지 않는 쪽이 안전하다.
 * ★ 그림자(09-ART 1.4)를 넣지 않은 이유: BitmapText 의 setTint 는 텍스처 전체를 물들이므로
 *   그림자 픽셀까지 금색이 된다. 대신 BONE/GOLD 둘 다 어두운 바닥(명도 0.03~0.16, 규칙 R2) 위에서 충분히 밝다.
 */
const GLYPHS = {
    "0": [0b111, 0b101, 0b101, 0b101, 0b111],
    "1": [0b010, 0b110, 0b010, 0b010, 0b111],
    "2": [0b111, 0b001, 0b111, 0b100, 0b111],
    "3": [0b111, 0b001, 0b111, 0b001, 0b111],
    "4": [0b101, 0b101, 0b111, 0b001, 0b001],
    "5": [0b111, 0b100, 0b111, 0b001, 0b111],
    "6": [0b111, 0b100, 0b111, 0b101, 0b111],
    "7": [0b111, 0b001, 0b001, 0b001, 0b001],
    "8": [0b111, 0b101, 0b111, 0b101, 0b111],
    "9": [0b111, 0b101, 0b111, 0b001, 0b111],
    "!": [0b010, 0b010, 0b010, 0b000, 0b010],
};
const CHARS = "0123456789!";
const CELL_W = 4;
const CELL_H = 6;
const FONT_KEY = "fx-num";
const DOT_KEY = "fx-dot";

/** 3x5 글리프를 캔버스에 구워 RetroFont 로 등록한다. 실패해도 게임은 굴러가야 한다 */
function buildNumberFont(scene) {
    try {
        if (!scene.cache.bitmapFont.exists(FONT_KEY)) {
            if (!scene.textures.exists(FONT_KEY)) {
                const tex = scene.textures.createCanvas(FONT_KEY, CHARS.length * CELL_W, CELL_H);
                const ctx = tex.getContext();
                ctx.fillStyle = "#ffffff"; // 흰색으로 굽고 색은 setTint 로 준다
                for (let c = 0; c < CHARS.length; c++) {
                    const rows = GLYPHS[CHARS[c]];
                    for (let y = 0; y < rows.length; y++) {
                        for (let x = 0; x < 3; x++) {
                            if (rows[y] & (1 << (2 - x))) ctx.fillRect(c * CELL_W + x, y, 1, 1);
                        }
                    }
                }
                tex.refresh();
            }
            scene.cache.bitmapFont.add(FONT_KEY, Phaser.GameObjects.RetroFont.Parse(scene, {
                image: FONT_KEY,
                offset: { x: 0, y: 0 },
                width: CELL_W,
                height: CELL_H,
                chars: CHARS,
                charsPerRow: CHARS.length,
                spacing: { x: 0, y: 0 },
                lineSpacing: 0,
            }));
        }
        return true;
    } catch (e) {
        console.warn("[FxSystem] 숫자 폰트 생성 실패 — 데미지 숫자를 끈다", e);
        return false;
    }
}

/** 파티클 1종 = 텍스처 1장. 전 파티클이 같은 텍스처를 쓰면 드로우콜이 1개로 묶인다(T623) */
function buildDotTexture(scene) {
    if (scene.textures.exists(DOT_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture(DOT_KEY, 2, 2);
    g.destroy();
}

export class FxSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.enabled = true;

        // 폭발 스프라이트 풀. 런 중 new 금지 규약대로 미리 만든다.
        if (scene.textures.exists(BURST_KEY)) {
            if (!scene.anims.exists(BURST_ANIM)) {
                scene.anims.create({
                    key: BURST_ANIM,
                    frames: scene.anims.generateFrameNumbers(BURST_KEY, { start: 0, end: 7 }),
                    frameRate: 24, repeat: 0, hideOnComplete: true,
                });
            }
            this.bursts = new Pool(MAX_BURST, () => {
                const b = scene.add.sprite(-999, -999, BURST_KEY, 0);
                b.setDepth(DEPTH.FX + 2).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
                // 재생이 끝나면 스스로 풀로 돌아간다 — update 에서 수명을 세지 않아도 된다
                b.on("animationcomplete", () => { b.setVisible(false).setPosition(-999, -999); this.bursts.release(b); });
                return b;
            });
        }
        this.level = 0;                 // QualitySystem 이 바꾼다
        this.caps = CAPS[0];
        this.screenShake = true;        // settings.screenShake
        this.showNumbers = true;        // settings.damageNumbers

        this.hitStopToken = 0;
        this.savedTimeScale = 1;

        this.numbersReady = buildNumberFont(scene);
        buildDotTexture(scene);

        // ── 데미지 숫자 풀 (T624)
        this.numbers = new Pool(this.numbersReady ? NUM_POOL : 0, () => {
            const t = scene.add.bitmapText(-999, -999, FONT_KEY, "");
            t.setDepth(DEPTH.DAMAGE_TEXT).setVisible(false);
            return t;
        });

        // ── 파티클 풀
        this.particles = new Pool(PARTICLE_POOL, () => {
            const p = scene.add.image(-999, -999, DOT_KEY);
            p.setDepth(DEPTH.FX).setVisible(false);
            return p;
        });

        // 전체 화면 플래시. 카메라에 고정하므로 scrollFactor 0.
        this.flashRect = scene.add
            .rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, CRIMSON, 1)
            .setScrollFactor(0)
            .setDepth(DEPTH.HUD - 5)
            .setAlpha(0)
            .setVisible(false);
        this.flashAlpha = 0;
        this.flashDecay = 0;

        // 피격 플래시 링버퍼. 지속시간이 60ms 고정이라 항상 오래된 것부터 만료된다 → FIFO 로 충분하다.
        this.fSprite = new Array(FLASH_POOL).fill(null);
        this.fUntil = new Float64Array(FLASH_POOL);
        this.fHead = 0;
        this.fTail = 0;

        this._offs = [
            EventBus.on(EVENTS.CMD_SETTINGS, (s) => {
                if (typeof s?.screenShake === "boolean") this.screenShake = s.screenShake;
                if (typeof s?.damageNumbers === "boolean") this.showNumbers = s.damageNumbers;
            }, { key: "fx:settings" }),
            // 사망하면 GameScene.update 가 조기 반환한다 → 여기서 정리하지 않으면 잔상이 화면에 얼어붙는다
            EventBus.on(EVENTS.RUN_ENDED, () => this.clear(), { key: "fx:ended" }),
        ];
        scene.events.once("shutdown", () => this.destroy());
        scene.events.once("destroy", () => this.destroy());
    }

    /** QualitySystem 이 부른다. 0=full 1=reduced 2=minimal */
    setQuality(level) {
        this.level = Math.max(0, Math.min(CAPS.length - 1, level | 0));
        this.caps = CAPS[this.level];
        // 상한이 내려갔으면 초과분을 즉시 반납한다 — 다음 프레임까지 기다리면 그 프레임이 가장 무겁다
        while (this.numbers.activeCount > this.caps.numbers) this.releaseNumber(this.numbers.active[0]);
        while (this.particles.activeCount > this.caps.particles) this.releaseParticle(this.particles.active[0]);
    }

    // ── 공개 API ────────────────────────────────────────────
    /**
     * 데미지 숫자. CombatSystem 이 피격마다 부른다 — 한 프레임에 150번 들어올 수 있다.
     * ★ 상한 초과 시 "가장 오래된 것"을 재활용한다. 신규를 버리면 방금 때린 적의 숫자가 안 뜨고
     *   화면에 남은 건 전부 과거 것이라 피드백이 거꾸로 된다.
     */
    damageNumber(x, y, amount, isCrit) {
        // 치명타도 같은 타격음을 쓴다 — 소리로까지 구분하면 150체 전투에서 음색이 두 겹으로 뭉갠다.
        // 치명타 구분은 금색 + "!" 로 충분하다(09-ART 1.6 R7). bossHit 은 BossSystem 이 직접 부른다.
        this.scene.audio?.sfx("hit");
        if (!this.enabled || !this.showNumbers || !this.numbersReady) return;
        const cap = this.caps.numbers;
        if (cap <= 0) return;
        try {
            // 상한에 걸리면 풀에 반납하지 않고 살아 있는 것 중 하나를 그대로 덮어쓴다.
            // Pool.release 가 swap-remove 라 active[0] 이 대체로 가장 오래된 항목이다.
            const t = this.numbers.activeCount >= cap ? this.numbers.active[0] : this.numbers.obtain();
            if (!t) return;
            const v = Math.max(1, Math.round(amount));
            t.setText(isCrit ? v + "!" : String(v));
            // origin 대신 폭으로 직접 중앙을 잡는다. RetroFont 는 폭이 글자수마다 달라진다.
            t.__ox = -Math.round(t.width / 2);
            t.__x = x;
            t.__y = y - 8;
            t.__life = NUM_LIFE;
            t.setTint(isCrit ? GOLD : BONE);
            t.setPosition(Math.round(x + t.__ox), Math.round(t.__y));
            t.setAlpha(1).setVisible(true);
        } catch (e) {
            this.fail("damageNumber", e);
        }
    }

    /** 처치 이펙트. 09-ART 7.1 — 피 파티클 3개(저사양 0개) + 처치음 */
    /**
     * 폭발 연출. fx-slash 시트(64x64 x 8프레임)를 쓴다.
     *
     * ★ 이 에셋은 이름과 달리 **참격이 아니라 방사형 폭발**이다(별 모양 -> 잔불).
     *   근접 부채꼴에 쓰면 휘두를 때마다 플레이어 중심에 폭발이 터지는 꼴이 된다.
     *   폭탄·광역 투사체처럼 "한 점에서 퍼지는" 것에만 쓴다.
     * ★ 텍스처가 없으면 조용히 건너뛴다. 연출이 없어도 피해는 이미 들어간 뒤다.
     *
     * @param {number} radius 폭발 반경(px). 스프라이트를 여기에 맞춰 늘린다
     */
    burst(x, y, radius = 48) {
        if (!this.enabled || !this.scene.textures.exists(BURST_KEY)) return;
        const s2 = this.bursts?.obtain?.();
        if (!s2) return;
        s2.setPosition(x, y).setVisible(true).setAlpha(0.9)
            .setDisplaySize(radius * 2.2, radius * 2.2)
            .setRotation(Math.random() * Math.PI * 2);   // 매번 같은 각도면 도장처럼 보인다
        s2.play(BURST_ANIM, true);
    }

    killBurst(x, y) {
        this.scene.audio?.sfx("kill");
        if (!this.enabled) return;
        try {
            const n = this.caps.perKill;
            for (let i = 0; i < n; i++) {
                if (this.particles.activeCount >= this.caps.particles) break;
                const p = this.particles.obtain();
                if (!p) break;
                const a = Math.random() * Math.PI * 2;
                const sp = 24 + Math.random() * 36;
                p.__vx = Math.cos(a) * sp;
                p.__vy = Math.sin(a) * sp - 20; // 살짝 위로 튀었다가 떨어진다
                p.__life = 0.35;
                p.setPosition(x, y).setTint(BLOOD).setAlpha(1).setVisible(true);
            }
        } catch (e) {
            this.fail("killBurst", e);
        }
    }

    /** 플레이어 피격. 화면 흔들림 + 심홍 비네트 플래시 */
    playerHurt() {
        this.scene.audio?.sfx("hurt");
        if (!this.enabled) return;
        try {
            this.shake("playerHurt");
            // 흔들림 OFF 여도 정보는 남아야 한다(13-QA UI-03) → 플래시는 끄지 않는다
            this.flash(CRIMSON, 0.28, 0.22);
        } catch (e) {
            this.fail("playerHurt", e);
        }
    }

    /**
     * 히트스톱. 각성 시스템이 200ms 로 부른다(09-ART 7.2).
     *
     * ★ scene.time.timeScale / physics.world.timeScale 이 아니라 GameScene 이 가진 scene.timeScale 을 쓴다.
     *   근거: GameScene.update 가 dt = min(delta,50)/1000 * this.timeScale 로 모든 시스템에 dt 를 넘긴다.
     *   즉 이 게임의 시간축은 이미 scene.timeScale 하나로 통일되어 있고, 적 이동·무기 쿨·스폰이 전부 여기 걸린다.
     *   Phaser 쪽 timeScale 을 건드리면 delayedCall(피격 플래시 해제 등)까지 같이 멈춰
     *   히트스톱이 끝난 뒤 적이 흰색으로 굳어 있는 버그가 난다. 오디오는 게임 루프에 붙어 있어 영향 없다(AU-08).
     */
    hitStop(ms) {
        if (!this.enabled || !this.caps.hitStop || !(ms > 0)) return;
        try {
            const scene = this.scene;
            if (this.hitStopToken === 0) this.savedTimeScale = scene.timeScale ?? 1;
            const token = ++this.hitStopToken;
            scene.timeScale = 0;
            // 실시간 클럭이다. scene.timeScale 을 0으로 만들어도 이 타이머는 정상 진행한다.
            scene.time.delayedCall(ms, () => {
                if (token !== this.hitStopToken) return; // 더 긴 히트스톱이 덮어썼다
                this.hitStopToken = 0;
                scene.timeScale = this.savedTimeScale;
            });
        } catch (e) {
            this.fail("hitStop", e);
            this.scene.timeScale = 1; // 실패해도 시간이 멈춘 채로 두면 게임이 죽는다
        }
    }

    /**
     * 적 피격 플래시. 09-ART 7.1 — setTint 가 아니라 setTintFill 이어야 150체 중에서도 보인다.
     *
     * ★ scene.time.delayedCall 로 해제하지 않는 이유(T622)
     *   피격은 초당 수백 번 일어난다. 그때마다 TimerEvent 객체 + 클로저가 하나씩 생기고
     *   전부 GC 대상이 된다. "런 중 new 금지"(06-TECH 5.1)를 정면으로 어기는 지점이고,
     *   평균 fps 는 멀쩡한데 1% Low 만 무너지는 전형적인 원인이다.
     *   여기서는 미리 잡아 둔 링버퍼에 만료 시각만 적는다 — 할당이 0이다.
     */
    hitFlash(sprite, isCrit) {
        if (!this.enabled || !sprite) return;
        try {
            sprite.setTintFill(isCrit ? 0xffd24a : 0xffffff);
            const until = this.scene.game.loop.time + FLASH_MS;
            const next = (this.fTail + 1) % FLASH_POOL;
            // 가득 차면 가장 오래된 것을 즉시 해제한다. 밀린 채로 두면 흰색으로 굳은 적이 남는다.
            if (next === this.fHead) this.expireOldestFlash();
            this.fSprite[this.fTail] = sprite;
            this.fUntil[this.fTail] = until;
            this.fTail = (this.fTail + 1) % FLASH_POOL;
        } catch (e) {
            this.fail("hitFlash", e);
        }
    }

    expireOldestFlash() {
        const s = this.fSprite[this.fHead];
        this.fSprite[this.fHead] = null;
        this.fHead = (this.fHead + 1) % FLASH_POOL;
        // 풀에 반납됐다가 재사용된 적이면 새 주인의 틴트를 지우면 안 된다
        if (s && s.__active !== false) s.clearTint();
    }

    updateFlashes() {
        const now = this.scene.game.loop.time;
        while (this.fHead !== this.fTail && this.fUntil[this.fHead] <= now) this.expireOldestFlash();
    }

    /** 09-ART 7.3 표에서 골라 흔든다. 옵션이 꺼져 있으면 0 (13-QA UI-03) */
    shake(kind) {
        if (!this.screenShake || this.level >= 2) return;
        const s = SHAKE[kind];
        if (!s) return;
        this.scene.cameras?.main?.shake(s[0], s[1]);
    }

    /** 전체 화면 색 플래시. 흔들림을 끈 사용자에게 남는 유일한 피격 신호이므로 옵션과 무관하게 동작한다 */
    flash(color, seconds = 0.25, alpha = 0.3) {
        if (!this.flashRect) return;
        this.flashRect.setFillStyle(color, 1);
        this.flashAlpha = Math.max(this.flashAlpha, alpha);
        this.flashDecay = this.flashAlpha / Math.max(0.05, seconds);
        this.flashRect.setAlpha(this.flashAlpha).setVisible(true);
    }

    /** 각성/보스 등장처럼 큰 연출은 이름으로 부른다 — 수치를 호출부에 흩뿌리지 않는다 */
    awakenBurst() { this.shake("awaken"); this.flash(CRIMSON, 0.5, 0.6); }
    bossAppear() { this.shake("bossAppear"); this.flash(CRIMSON, 0.8, 0.4); }

    // ── 프레임 갱신 ─────────────────────────────────────────
    /** @param {number} dt 초. GameScene 이 scene.timeScale 을 곱해 넘긴다 → 히트스톱 중에는 0이 되어 연출이 함께 멎는다 */
    update(dt) {
        if (!this.enabled || !(dt > 0)) return;
        try {
            this.updateFlashes();
            this.updateNumbers(dt);
            this.updateParticles(dt);
            if (this.flashAlpha > 0) {
                this.flashAlpha = Math.max(0, this.flashAlpha - this.flashDecay * dt);
                this.flashRect.setAlpha(this.flashAlpha);
                if (this.flashAlpha <= 0) this.flashRect.setVisible(false);
            }
        } catch (e) {
            this.fail("update", e);
        }
    }

    updateNumbers(dt) {
        const list = this.numbers.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const t = list[i];
            t.__life -= dt;
            if (t.__life <= 0) { this.releaseNumber(t); continue; }
            const p = 1 - t.__life / NUM_LIFE;
            // ease-out — 처음에 빠르게 솟았다가 멎는다. 선형이면 "떠오른다"가 아니라 "끌려간다"로 보인다
            const e = 1 - (1 - p) * (1 - p);
            t.setPosition(Math.round(t.__x + t.__ox), Math.round(t.__y - NUM_RISE * e));
            t.setAlpha(p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
        }
    }

    updateParticles(dt) {
        const list = this.particles.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.__life -= dt;
            if (p.__life <= 0) { this.releaseParticle(p); continue; }
            p.__vy += 220 * dt; // 중력
            p.x += p.__vx * dt;
            p.y += p.__vy * dt;
            p.setAlpha(Math.min(1, p.__life / 0.2));
        }
    }

    releaseNumber(t) {
        t.setVisible(false).setPosition(-999, -999);
        this.numbers.release(t);
    }

    releaseParticle(p) {
        p.setVisible(false).setPosition(-999, -999);
        this.particles.release(p);
    }

    /** 화면에 떠 있는 연출을 전부 걷어낸다 */
    clear() {
        try {
            for (let i = this.numbers.active.length - 1; i >= 0; i--) this.releaseNumber(this.numbers.active[i]);
            for (let i = this.particles.active.length - 1; i >= 0; i--) this.releaseParticle(this.particles.active[i]);
            while (this.fHead !== this.fTail) this.expireOldestFlash();
            this.flashAlpha = 0;
            this.flashRect?.setAlpha(0).setVisible(false);
        } catch { /* 정리 중 실패는 무시한다 */ }
    }

    /**
     * 연출에서 예외가 났다. 로그만 남기고 그 기능을 끈다 —
     * 매 프레임 같은 예외를 던지면 콘솔이 막히고 프레임이 통째로 날아간다.
     */
    fail(where, e) {
        if (this.__failed) return;
        this.__failed = true;
        this.enabled = false;
        console.error("[FxSystem] " + where + " 실패 — 연출을 끄고 전투는 계속한다", e);
    }

    destroy() {
        this._offs?.forEach((f) => f());
        this._offs = null;
        this.clear();
        // 히트스톱 도중 씬이 내려가면 시간이 0으로 굳은 채 남는다
        if (this.hitStopToken !== 0 && this.scene) this.scene.timeScale = this.savedTimeScale;
        this.hitStopToken = 0;
    }
}
