/**
 * HudScene — 조작 UI(조이스틱·대시)와 60fps HUD.
 *
 * ★ 이 씬이 별도로 존재하는 이유: 60fps로 바뀌는 값은 Zustand에 넣지 않는다(T112).
 *   HP/EXP/타이머는 React 리렌더 없이 여기서 직접 그린다. 06-TECH-DESIGN.md 3.3
 *
 * 규격: 10-UIUX-LANDSCAPE.md 5.2(조이스틱 시각) / 4(HUD 좌표)
 *   손가락 가림 최소화 3원칙 — 베이스는 링만, 노브는 작게(r14), 캐릭터는 화면 중앙
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { input, JOY_RADIUS, DASH_BTN } from "../systems/InputSystem";

const PARCHMENT = 0xc9b792;
const CANDLE = 0x35c9b4;

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

        // ★ HP/타이머/킬은 60fps로 바뀐다 -> Zustand에 넣지 않고 여기서 직접 그린다 (T112)
        const t = (x, y, size, color, origin) =>
            this.add.text(x, y, "", { fontFamily: "monospace", fontSize: size + "px", color })
                .setOrigin(origin ?? 0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0);
        this.txtTimer = t(320, 8, 14, "#c9b792", 0.5);
        this.txtKills = t(632, 10, 10, "#9a94a3", 1);
        this.txtHp = t(18, 26, 9, "#c7c2ce", 0);

        this.events.once("shutdown", () => input.detach());
    }

    update() {
        this.drawJoystick();
        this.drawDash();
        this.drawStats();
    }

    drawStats() {
        const gs = this.scene.get(SCENES.GAME);
        const c = gs?.combatSystem;
        const sp = gs?.spawnSystem;
        if (!c || !sp) return;

        const g = this.statG;
        g.clear();

        // HP 바 — 좌상단 120x10 (09-ART A-13 규격)
        const hpW = 120, hpRatio = Math.max(0, c.hp / c.maxHp);
        g.fillStyle(0x3a3345, 0.9).fillRect(16, 12, hpW, 10);
        g.fillStyle(0x8e1220, 1).fillRect(16, 12, hpW * hpRatio, 10);
        g.lineStyle(1, 0x7b7488, 0.8).strokeRect(16, 12, hpW, 10);

        // EXP 바 — 화면 최상단 전체 폭. 얇게 깔아 시선을 뺏지 않는다
        const need = 5 + c.level * 5;
        g.fillStyle(0x16121c, 0.9).fillRect(0, 0, 640, 4);
        g.fillStyle(0x2fbfa8, 1).fillRect(0, 0, 640 * Math.min(1, c.exp / need), 4);

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
        if (g.alpha < 0.02 && !input.active) return;

        const { origin, knob } = input;

        // 베이스는 링만 그린다 — 채우면 화면의 5%가 손가락 아래로 사라진다 (5.2 원칙 1)
        g.lineStyle(2, PARCHMENT, 0.3);
        g.strokeCircle(origin.x, origin.y, 40);

        // 8방향 눈금
        g.lineStyle(2, PARCHMENT, 0.15);
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i;
            const c = Math.cos(a), s = Math.sin(a);
            g.lineBetween(origin.x + c * 34, origin.y + s * 34, origin.x + c * 38, origin.y + s * 38);
        }

        // 원점 → 노브 궤적
        g.lineStyle(1, PARCHMENT, 0.2);
        g.lineBetween(origin.x, origin.y, knob.x, knob.y);

        // 노브는 작게(r14) — 손가락 밖으로 삐져나오면 시각적 노이즈다 (5.2 원칙 2)
        g.fillStyle(CANDLE, 0.55);
        g.fillCircle(knob.x, knob.y, 14);
        g.lineStyle(1, CANDLE, 0.8);
        g.strokeCircle(knob.x, knob.y, 14);

        void JOY_RADIUS;
    }

    drawDash() {
        const g = this.dashG;
        g.clear();

        const ps = this.scene.get(SCENES.GAME)?.playerSystem;
        const ready = ps ? ps.dashReady : true;
        const progress = ps ? ps.dashProgress : 1;

        // 쿨 중에는 흐리게 (10-UIUX 4: 0.45 / 쿨 중 0.25)
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
}
