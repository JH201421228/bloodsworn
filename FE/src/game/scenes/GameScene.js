/**
 * GameScene — 런의 중심. 시스템 소유, update 순서 고정.
 *
 * ⚠ 블록 A 시점의 스텁이다. 실제 내용은 Day 1 블록 B/C에서 채운다.
 *   - 블록 B: 타일맵 로드, 플레이어 배치 (T130/T131)
 *   - 블록 C: 이동·카메라·대시 (T133~T137)
 * 규격: 06-TECH-DESIGN.md 4.2 (update 순서)
 */
import Phaser from "phaser";
import { SCENES } from "../constants";
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";
import { DEBUG } from "../debug";

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        // 부팅 경로가 끝까지 돌았음을 눈으로 확인하기 위한 임시 표식.
        // 블록 B에서 타일맵이 들어오면 이 블록은 통째로 사라진다.
        const cx = LOGICAL_WIDTH / 2;
        const cy = LOGICAL_HEIGHT / 2;

        this.add
            .text(cx, cy - 10, "BOOT OK — GameScene", {
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#35c9b4",
            })
            .setOrigin(0.5);

        this.add
            .text(cx, cy + 12, "Day 1 블록 A — 스캐폴드 재건 완료", {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#7b7488",
            })
            .setOrigin(0.5);

        // 로드된 에셋이 실제로 화면에 그려지는지 확인 (매니페스트 경로 검증)
        if (this.textures.exists("joystick_base")) {
            this.add.image(64, LOGICAL_HEIGHT - 64, "joystick_base").setAlpha(0.5);
        }

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }
}
