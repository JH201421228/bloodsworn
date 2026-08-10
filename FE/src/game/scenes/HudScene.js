/**
 * HudScene — HP·EXP·타이머·처치수·인간성·조이스틱·데미지숫자.
 *
 * ★ 이 씬이 별도로 존재하는 이유: 60fps로 바뀌는 값은 Zustand에 넣지 않는다(T112).
 *   HP/EXP/타이머는 React 리렌더 없이 여기서 직접 그린다. 06-TECH-DESIGN.md 3.3
 *
 * ⚠ 블록 A 시점의 스텁이다. 실제 HUD는 Day 2(T160대)에서 채운다.
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";

export default class HudScene extends Phaser.Scene {
    constructor() {
        // active:false — GameScene이 launch()로 깨운다.
        super({ key: SCENES.HUD, active: false });
    }

    create() {
        this.scene.bringToTop();
        this.children.setAll("depth", DEPTH.HUD);
    }
}
