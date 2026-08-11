/**
 * HudScene — 조작 UI(조이스틱·대시)와 60fps HUD.
 *
 * ★ 이 씬이 별도로 존재하는 이유: 60fps로 바뀌는 값은 Zustand에 넣지 않는다(T112).
 *   HP/EXP/타이머는 React 리렌더 없이 여기서 직접 그린다. 06-TECH-DESIGN.md 3.3
 *
 * ★ 화면 폭은 640 고정이 아니다 (config.js 좌표계 주석)
 *   논리 세로만 360 으로 고정이고 가로는 기기 비율을 따라 640~864 로 늘어난다.
 *   그래서 이 씬의 좌표는 세 종류로 나뉜다.
 *     - 좌상단 앵커(HP 바, HP 숫자)     : 상수 그대로 쓴다
 *     - 우측/중앙 앵커(킬 수, 타이머)    : this.scale.width 로 매번 계산한다
 *     - 화면 전체 폭(EXP 바)            : this.scale.width 를 그대로 쓴다
 *   폭이 바뀔 수 있으므로 상수로 굳혀 두면 20:9 기기에서 킬 수가 화면 한가운데 뜬다.
 *
 * 규격: 10-UIUX-LANDSCAPE.md 5.2(조이스틱 시각) / 4(HUD 좌표)
 *   손가락 가림 최소화 3원칙 — 베이스는 링만, 노브는 작게(r14), 캐릭터는 화면 중앙
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { input, JOY_RADIUS, DASH_BTN } from "../systems/InputSystem";

const PARCHMENT = 0xc9b792;
const CANDLE = 0x35c9b4;

/** 우측 끝에서 킬 수까지의 여백. 640 기준 원안(x=632)을 앵커로 환산한 값이다 */
const KILLS_MARGIN_R = 8;
/** 보스 HP 바 규격 (10-UIUX 4.1 H13). 폭은 고정이고 위치만 화면 중앙을 따라간다 */
const BOSS_BAR = { w: 400, h: 8, y: 30 };

export default class HudScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENES.HUD, active: false });
    }

    create() {
        this.scene.bringToTop();
        input.attach(this);

        this.joy = this.add.graphics().setDepth(DEPTH.HUD).setScrollFactor(0).setAlpha(0);
        this.dashG = this.add.graphics().setDepth(DEPTH.HUD).setScrollFactor(0);
        this.statG = this.add.graphics().setDepth(DEPTH.HUD).setScrollFactor(0);
        // T526 보스 HP바 — statG와 분리한다. 보스전에만 그려지고 보스전이 끝나면 통째로 clear하면 된다
        this.bossG = this.add.graphics().setDepth(DEPTH.HUD).setScrollFactor(0);

        // ★ HP/타이머/킬은 60fps로 바뀐다 -> Zustand에 넣지 않고 여기서 직접 그린다 (T112)
        const t = (x, y, size, color, origin) =>
            this.add.text(x, y, "", { fontFamily: "monospace", fontSize: size + "px", color })
                .setOrigin(origin ?? 0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0);
        this.txtTimer = t(0, 8, 14, "#c9b792", 0.5);
        this.txtKills = t(0, 10, 10, "#9a94a3", 1);
        this.txtHp = t(18, 26, 9, "#c7c2ce", 0);

        // ── 아트 껍데기 ─────────────────────────────────────
        // ★ 채움(fillRect)은 그대로 두고 그 위에 프레임 이미지만 얹는다.
        //   채움까지 이미지로 바꾸면 비율에 따라 텍스처를 매 프레임 크롭해야 해서
        //   60fps 경로에 불필요한 비용이 든다. 프레임은 정적이라 한 번 두면 끝이다.
        // ★ 원본이 108x16 / 66x10 이라 폭이 안 맞는다. nineslice 로 좌우 6px 만 남기고
        //   가운데를 늘린다 — 통짜로 늘리면 리벳이 뭉개진다.
        const nine = (key, x, y, w, h, l = 6, r = 6) =>
            (this.textures.exists(key)
                ? this.add.nineslice(x, y, key, undefined, w, h, l, r, 0, 0)
                : null)?.setOrigin(0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0) ?? null;

        this.hpFrame = nine("ui-bar-hp", 14, 10, 124, 14);
        // 폭은 layout() 이 화면 폭으로 다시 잡는다. 여기 값은 생성용 초기치일 뿐이다.
        this.expFrame = nine("ui-bar-exp", 0, 0, this.scale.width, 6, 4, 4);

        // 조이스틱 — 도형 대신 실제 아트. 입력 판정은 InputSystem 이 그대로 갖는다.
        const img = (key, r) => (this.textures.exists(key)
            ? this.add.image(-999, -999, key).setDepth(DEPTH.HUD).setScrollFactor(0).setDisplaySize(r * 2, r * 2)
            : null);
        this.joyBase = img("joystick_base", JOY_RADIUS);
        this.joyKnob = img("joystick_knob", 15);
        if (this.joyBase) this.joyBase.setAlpha(0);
        if (this.joyKnob) this.joyKnob.setAlpha(0);

        this.layout(this.scale.width, this.scale.height);
        // 회전·폴더블 펼침으로 논리 폭이 바뀌면 우측/중앙 앵커를 다시 잡는다.
        this.onResize = (size) => this.layout(size.width, size.height);
        this.scale.on("resize", this.onResize);

        this.events.once("shutdown", () => {
            this.scale.off("resize", this.onResize);
            input.detach();
        });
    }

    /**
     * 폭이 바뀔 때만 하는 일을 모아 둔다.
     * ★ update() 안에서 매 프레임 setPosition 하지 않는 이유: 텍스트 위치 변경은
     *   내부적으로 바운드 재계산을 부른다. 폭은 회전할 때만 바뀌므로 그때만 하면 된다.
     */
    layout(w, h) {
        this.txtTimer?.setX(Math.round(w / 2));
        this.txtKills?.setX(w - KILLS_MARGIN_R);
        this.expFrame?.setSize(w, 6);
        void h;
    }

    update() {
        this.drawJoystick();
        this.drawDash();
        this.drawStats();
        this.drawBossBar();
    }

    drawStats() {
        const gs = this.scene.get(SCENES.GAME);
        const c = gs?.combatSystem;
        const sp = gs?.spawnSystem;
        if (!c || !sp) return;

        const g = this.statG;
        g.clear();

        // HP 바 — 좌상단 120x10 (09-ART A-13 규격). 좌측 앵커라 폭과 무관하다
        const hpW = 120, hpRatio = Math.max(0, c.hp / c.maxHp);
        g.fillStyle(0x3a3345, 0.9).fillRect(16, 12, hpW, 10);
        g.fillStyle(0x8e1220, 1).fillRect(16, 12, hpW * hpRatio, 10);
        g.lineStyle(1, 0x7b7488, 0.8).strokeRect(16, 12, hpW, 10);

        // EXP 바 — 화면 최상단 전체 폭. 얇게 깔아 시선을 뺏지 않는다
        // ★ 640 이 아니라 실제 논리 폭이다. 굳히면 20:9 에서 우측 160px 가 비어 보인다.
        const w = this.scale.width;
        const need = 5 + c.level * 5;
        g.fillStyle(0x16121c, 0.9).fillRect(0, 0, w, 4);
        g.fillStyle(0x2fbfa8, 1).fillRect(0, 0, w * Math.min(1, c.exp / need), 4);

        const m = Math.floor(sp.elapsed / 60);
        const s2 = Math.floor(sp.elapsed % 60);
        this.txtTimer.setText(m + ":" + String(s2).padStart(2, "0"));
        this.txtKills.setText(sp.killCount + " kills");
        this.txtHp.setText(Math.ceil(c.hp) + " / " + c.maxHp);
    }

    drawJoystick() {
        const g = this.joy;
        g.clear();

        // 릴리즈 시 150ms 페이드 아웃 / 터치 시 80ms 페이드 인 (5.1)
        const target = input.active ? 1 : 0;
        const step = input.active ? 1 / 5 : 1 / 9; // 약 80ms / 150ms @60fps
        g.alpha = Phaser.Math.Linear(g.alpha, target, step);
        if (g.alpha < 0.02 && !input.active) {
            // 그래픽만 페이드시키고 이미지를 놔두면 조이스틱이 화면에 박힌 채 남는다
            this.joyBase?.setAlpha(0);
            this.joyKnob?.setAlpha(0);
            return;
        }

        const { origin, knob } = input;

        // 베이스는 링만 그린다 — 채우면 화면의 5%가 손가락 아래로 사라진다 (5.2 원칙 1)
        g.lineStyle(2, PARCHMENT, 0.3);
        g.strokeCircle(origin.x, origin.y, 40);

        // 8방향 눈금
        g.lineStyle(2, PARCHMENT, 0.15);
        // 베이스 아트가 있으면 도형 링과 눈금은 건너뛴다 — 겹쳐 그리면 지저분하다
        if (!this.joyBase) for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i;
            const c = Math.cos(a), s = Math.sin(a);
            g.lineBetween(origin.x + c * 34, origin.y + s * 34, origin.x + c * 38, origin.y + s * 38);
        }

        // 원점 → 노브 궤적
        g.lineStyle(1, PARCHMENT, 0.2);
        g.lineBetween(origin.x, origin.y, knob.x, knob.y);

        // 노브는 작게 — 손가락 밖으로 삐져나오면 시각적 노이즈다 (5.2 원칙 2)
        // 아트가 있으면 도형 대신 이미지를 쓴다. 판정은 InputSystem 이 그대로 갖는다.
        if (this.joyKnob) {
            this.joyBase.setPosition(origin.x, origin.y).setAlpha(g.alpha * 0.85);
            this.joyKnob.setPosition(knob.x, knob.y).setAlpha(g.alpha);
        } else {
            g.fillStyle(CANDLE, 0.55);
            g.fillCircle(knob.x, knob.y, 14);
            g.lineStyle(1, CANDLE, 0.8);
            g.strokeCircle(knob.x, knob.y, 14);
        }

        void JOY_RADIUS;
    }

    drawDash() {
        const g = this.dashG;
        g.clear();

        const ps = this.scene.get(SCENES.GAME)?.playerSystem;
        const ready = ps ? ps.dashReady : true;
        const progress = ps ? ps.dashProgress : 1;

        // 쿨 중에는 흐리게 (10-UIUX 4: 0.45 / 쿨 중 0.25)
        // ★ DASH_BTN.x 는 InputSystem.layout 이 화면 폭에 맞춰 갱신한다. 복사해 두면 안 된다.
        g.fillStyle(PARCHMENT, ready ? 0.45 : 0.25);
        g.fillCircle(DASH_BTN.x, DASH_BTN.y, 20);
        g.lineStyle(2, PARCHMENT, ready ? 0.7 : 0.3);
        g.strokeCircle(DASH_BTN.x, DASH_BTN.y, 20);

        // 쿨다운 진행을 링으로 보여준다
        if (!ready) {
            g.lineStyle(3, CANDLE, 0.8);
            g.beginPath();
            g.arc(DASH_BTN.x, DASH_BTN.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            g.strokePath();
        }
    }

    /**
     * T526 보스 HP 바 — 10-UIUX 4.1 H13 (400x8 / 알파 0.95 / 매 프레임 / 보스전에서만).
     *
     * ★ React가 아니라 여기서 직접 그린다.
     *   보스 HP는 60fps로 변한다. Zustand에 넣으면 초당 60회 리렌더가 돌아
     *   보스전이라는 가장 무거운 구간에서 프레임이 깎인다. 이 프로젝트의 확정 규약(T112)이다.
     *   BossSystem은 별도로 200ms 스로틀된 BOSS_HP 이벤트를 쏘지만 그건 React 소비자용이고,
     *   폭을 결정하는 건 아래 한 줄뿐이다.
     *
     * ★ 원안의 x=120 은 "640 화면의 중앙"이라는 뜻이었다. 폭이 변하므로 상수가 아니라
     *   중앙 정렬로 적는다 — 640 에서는 정확히 120 으로 떨어져 기존 그림이 그대로 나온다.
     *
     * ★ 페이즈 눈금 2개(66% / 33%)를 그린다.
     *   "언제 광폭화가 오는가"를 숫자가 아니라 바 위의 위치로 알려준다 — 정본 4.3.
     */
    drawBossBar() {
        const g = this.bossG;
        g.clear();

        const bs = this.scene.get(SCENES.GAME)?.bossSystem;
        const b = bs?.active ? bs.boss : null;
        // 킬 카운터는 보스전에 무의미하다 (10-UIUX 4.3). 값이 바뀔 때만 건드린다
        if (this.txtKills && this.txtKills.visible === !!b) this.txtKills.setVisible(!b);
        if (!b) return;

        const W = BOSS_BAR.w, H = BOSS_BAR.h, Y = BOSS_BAR.y;
        const X = Math.round((this.scale.width - W) / 2);
        const ratio = Math.max(0, Math.min(1, b.hp / b.maxHp));

        g.fillStyle(0x241e2e, 0.95).fillRect(X, Y, W, H);                 // STONE_DARK 트랙
        g.fillStyle(0x8e1220, 0.95).fillRect(X, Y, W * ratio, H);         // BLOOD 채움
        // 남은 HP의 앞머리를 밝게 — 400px 바에서 잔량 1%의 변화를 눈으로 잡을 수 있게 한다
        if (ratio > 0) g.fillStyle(0xd6203a, 0.95).fillRect(X + W * ratio - 2, Y, 2, H);

        // 페이즈 눈금 — 지나간 눈금은 금색으로 남겨 "2페이즈를 넘겼다"를 계속 보여준다
        for (const cut of [0.66, 0.33]) {
            const passed = ratio <= cut;
            g.fillStyle(passed ? 0xe8b44c : 0x0b0710, passed ? 0.95 : 0.8);
            g.fillRect(X + W * cut - 1, Y - 1, 2, H + 2);
        }

        g.lineStyle(1, 0x6e6478, 0.9).strokeRect(X, Y, W, H);

        // 페이즈 전환 무적 중에는 바를 점멸시킨다. "때려도 안 깎이는" 1.2초의 이유를 알려준다
        g.alpha = bs.invulnerable ? ((this.time.now / 60) % 2 < 1 ? 0.45 : 1) : 1;
    }
}
