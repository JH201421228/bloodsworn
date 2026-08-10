/**
 * DebugScene — fps / 1% Low / 엔티티 수 오버레이. DEBUG일 때만 launch. (T230 / T622)
 *
 * ★ 1% Low를 보는 이유 (13-QA 4.1)
 *   차단선은 평균 fps가 아니라 1% Low >= 40fps다.
 *   평균만 보면 "가끔 크게 끊기는" 상태를 통과시켜 버린다.
 *
 * 표시 규격은 13-QA 4.3 "계측 오버레이 최소 구현" 을 그대로 따른다.
 *   FPS 58 (1%L 47)  E:148 P:96 N:12 O:173 T:22
 *   MEM 84MB  t:04:32 Lv18 q0 scene:2
 *
 * ★ 수치의 출처는 QualitySystem 이다. 여기서 fps 를 따로 재면 두 값이 미세하게 달라져
 *   "오버레이는 47인데 강등이 안 걸린다" 같은 헛된 추적을 하게 된다.
 *   QualitySystem 이 없을 때만 자체 링버퍼로 폴백한다.
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";

const SAMPLE = 300; // 폴백용. 약 5초분

const COLOR_OK = "#8ff0dc";
const COLOR_WARN = "#e8b44c";
const COLOR_BAD = "#ff6b4a";

export default class DebugScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENES.DEBUG, active: false });
    }

    create() {
        this.scene.bringToTop();
        this.samples = new Array(SAMPLE).fill(60);
        this.idx = 0;
        this.low1 = 60;
        this.txt = this.add
            .text(4, 8, "", { fontFamily: "monospace", fontSize: "9px", color: COLOR_OK, lineSpacing: 1 })
            .setDepth(DEPTH.HUD + 2)
            .setScrollFactor(0);
    }

    update() {
        const fpsNow = this.game.loop.actualFps;
        this.samples[this.idx] = fpsNow;
        this.idx = (this.idx + 1) % SAMPLE;

        // 매 프레임 정렬하면 오버레이가 프레임을 먹는다 — 15프레임에 1회만
        if (this.idx % 15 === 0) {
            const sorted = [...this.samples].sort((a, b) => a - b);
            this.low1 = sorted[Math.floor(SAMPLE * 0.01)];
        }

        const gs = this.scene.get(SCENES.GAME);
        const q = gs?.quality;
        const sp = gs?.spawnSystem;
        const c = gs?.combatSystem;
        const fx = gs?.fxSystem;
        const audio = gs?.audio;

        const fps = q ? q.fps : fpsNow;
        const low = q ? q.low1 : this.low1;

        const pad = (n, w) => String(n).padStart(w, " ");
        const lines = [];

        let l1 = "FPS " + pad(Math.round(fps), 2) + " (1%L " + pad(Math.round(low), 2) + ")";
        if (sp) l1 += "  E:" + pad(sp.pool.activeCount, 3);
        if (fx) l1 += " P:" + pad(fx.particles?.activeCount ?? 0, 3) + " N:" + pad(fx.numbers?.activeCount ?? 0, 2);
        if (c) l1 += " O:" + pad(c.orbs.activeCount, 3);
        l1 += " T:" + pad(gs?.tweens?.getTweens?.().length ?? 0, 2);
        lines.push(l1);

        const mem = performance?.memory?.usedJSHeapSize;
        let l2 = mem ? "MEM " + Math.round(mem / 1048576) + "MB" : "MEM  --";
        if (sp) l2 += "  t:" + this.clock(sp.elapsed) + " seg" + (sp.segIndex + 1) + "/12 K:" + sp.killCount;
        if (c) l2 += " Lv" + c.level + " hp" + Math.ceil(c.hp) + (c.godMode ? "[GOD]" : "");
        lines.push(l2);

        let l3 = "q" + (q?.level ?? 0) + (q?.lowSpec ? "[LOW]" : "") + " worst " + (q ? Math.round(q.worstMs) : 0) + "ms";
        l3 += "  scene:" + this.game.scene.getScenes(true).length;
        if (audio) l3 += "  au:" + (audio.unlocked ? "on" : "LOCKED") + " " + (audio.mode ?? "-") + " x" + audio.plan?.size;
        lines.push(l3);

        this.txt.setText(lines);
        // 1% Low 가 차단선(40) 아래면 빨강, 목표(45) 아래면 노랑. 색만 봐도 판정이 된다.
        this.txt.setColor(low < 40 ? COLOR_BAD : low < 45 ? COLOR_WARN : COLOR_OK);
    }

    clock(sec) {
        const s = Math.max(0, Math.floor(sec || 0));
        return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }
}
