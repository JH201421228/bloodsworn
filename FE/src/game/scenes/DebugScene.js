/**
 * DebugScene — fps / 엔티티 수 / 시스템별 ms 오버레이. DEBUG일 때만 launch 된다.
 *
 * ★ Day 2(T240대)에 본격 구현한다. 로드맵이 개발 도구를 Day 6이 아니라 Day 2에 만드는 이유는
 *   Day 4 각성 6종 검증과 Day 6 밸런싱이 이것 없이는 "느낌"으로 흘러가기 때문이다.
 *
 * ⚠ 블록 A 시점에는 fps만 표시한다.
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";

export default class DebugScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENES.DEBUG, active: false });
    }

    create() {
        this.scene.bringToTop();
        this.fpsText = this.add
            .text(4, 4, "", {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#8ff0dc",
            })
            .setDepth(DEPTH.HUD + 1)
            .setScrollFactor(0);
    }

    update() {
        if (!this.fpsText) return;
        this.fpsText.setText(`fps ${Math.round(this.game.loop.actualFps)}`);
    }
}
