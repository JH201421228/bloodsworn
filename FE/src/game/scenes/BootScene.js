/**
 * BootScene — 부팅 1단계. 매니페스트만 읽고 즉시 PreloadScene으로 넘긴다.
 *
 * 여기서 무거운 에셋을 로드하지 않는다. 이 씬의 목적은 "화면이 켜졌다"를 가장 빨리 만드는 것이다.
 * 06-TECH-DESIGN.md 13: 부팅 단계마다 눈으로 구분되는 상태를 남긴다.
 */
import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { EVENTS, SCENES } from "../constants";

/** 매니페스트 경로. base:"./" 이므로 상대경로여야 한다 — 절대경로는 Capacitor에서 깨진다. */
const MANIFEST_URL = "assets.json";

export default class BootScene extends Phaser.Scene {
    constructor() {
        super(SCENES.BOOT);
    }

    preload() {
        // 매니페스트 자체는 수 KB다. 이것만 먼저 읽는다.
        this.load.json("manifest", MANIFEST_URL);

        // 매니페스트가 없어도 게임이 죽지 않게 한다. 블록 B 이전 상태에서도 부팅이 되어야 한다.
        this.load.on("loaderror", (file) => {
            if (file?.key === "manifest") {
                console.warn("[BootScene] assets.json을 읽지 못했다. 빈 매니페스트로 진행한다.");
            }
        });
    }

    create() {
        // "검은 화면에서 멈춘 것"과 "부팅 중"을 눈으로 구분할 수 있게 한다.
        this.add
            .text(this.scale.width / 2, this.scale.height / 2, "BLOODSWORN", {
                fontFamily: "monospace",
                fontSize: "16px",
                color: "#4a4454",
            })
            .setOrigin(0.5);

        EventBus.emit(EVENTS.BOOT_READY, {});
        this.scene.start(SCENES.PRELOAD);
    }
}
