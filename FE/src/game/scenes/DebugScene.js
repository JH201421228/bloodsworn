/**
 * DebugScene — fps / 1% Low / 엔티티 수 오버레이. DEBUG일 때만 launch. (T230)
 *
 * ★ 1% Low를 보는 이유 (13-QA 4)
 *   차단선은 평균 fps가 아니라 1% Low >= 40fps다.
 *   평균만 보면 "가끔 크게 끊기는" 상태를 통과시켜 버린다.
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";

const SAMPLE = 300; // 약 5초분

export default class DebugScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENES.DEBUG, active: false });
    }

    create() {
        this.scene.bringToTop();
        this.samples = new Array(SAMPLE).fill(60);
        this.idx = 0;
        this.txt = this.add
            .text(4, 8, "", { fontFamily: "monospace", fontSize: "9px", color: "#8ff0dc", lineSpacing: 1 })
            .setDepth(DEPTH.HUD + 2)
            .setScrollFactor(0);
    }

    update() {
        const fps = this.game.loop.actualFps;
        this.samples[this.idx] = fps;
        this.idx = (this.idx + 1) % SAMPLE;

        // 매 프레임 정렬하면 오버레이가 프레임을 먹는다 — 15프레임에 1회만
        if (this.idx % 15 === 0) {
            const sorted = [...this.samples].sort((a, b) => a - b);
            this.low1 = sorted[Math.floor(SAMPLE * 0.01)];
        }

        const gs = this.scene.get(SCENES.GAME);
        const sp = gs?.spawnSystem;
        const c = gs?.combatSystem;
        const lines = [
            "fps " + Math.round(fps) + "   1% low " + Math.round(this.low1 ?? fps),
        ];
        if (sp) lines.push("enemy " + sp.pool.activeCount + "/" + sp.pool.size + "   seg " + (sp.segIndex + 1) + "/12   kills " + sp.killCount);
        if (c) lines.push("proj " + c.projectiles.activeCount + "   orb " + c.orbs.activeCount + "   hp " + Math.ceil(c.hp) + (c.godMode ? "  [GOD]" : ""));
        this.txt.setText(lines);
    }
}
