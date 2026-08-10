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

        this.events.once("shutdown", () => input.detach());
    }

    update() {
        this.drawJoystick();
        this.drawDash();
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
