/**
 * GameScene — 런의 중심. 시스템 소유, update 순서 고정.
 *
 * ⚠ 블록 B 시점의 스텁이다. 실제 런 로직은 블록 C 이후에 들어온다.
 *   현재는 에셋 파이프라인 산출물이 실제로 올바르게 잘려 들어오는지 검증하는 용도다.
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
        const cx = LOGICAL_WIDTH / 2;

        // ── 바닥: 타일셋 8칸 중 바닥 타일만 깔아 격자 정렬을 눈으로 검증한다
        if (this.textures.exists("tiles_main")) {
            const tex = this.textures.get("tiles_main");
            // 128x16 = 16px 타일 8칸. 1~6번이 바닥, 0=void, 7=벽
            for (let y = 0; y < LOGICAL_HEIGHT; y += 16) {
                for (let x = 0; x < LOGICAL_WIDTH; x += 16) {
                    const idx = 1 + ((x / 16 + y / 16) % 6);
                    this.add
                        .image(x, y, "tiles_main")
                        .setOrigin(0, 0)
                        .setCrop(idx * 16, 0, 16, 16)
                        .setPosition(x - idx * 16, y);
                }
            }
            void tex;
        }

        // ── 플레이어: 96x80 8프레임이 제대로 잘렸는지
        if (this.textures.exists("player-idle-down")) {
            const t = this.textures.get("player-idle-down");
            this.add.text(8, 6, `player-idle-down 프레임 ${t.frameTotal - 1}개`, {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#8ff0dc",
            });
            for (let i = 0; i < 4; i++) {
                this.add.sprite(60 + i * 100, 120, "player-idle-down", i);
            }
        }

        // ── 적: 16x16 40프레임. 10종의 첫 프레임만 늘어놓는다
        if (this.textures.exists("enemies")) {
            const t = this.textures.get("enemies");
            this.add.text(8, 200, `enemies 프레임 ${t.frameTotal - 1}개 (10종 x 4)`, {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#8ff0dc",
            });
            for (let i = 0; i < 10; i++) {
                this.add.sprite(24 + i * 32, 232, "enemies", i * 4).setScale(2);
            }
        }

        this.add
            .text(cx, LOGICAL_HEIGHT - 16, "Day 1 블록 B — 에셋 파이프라인 검증", {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#c9b792",
            })
            .setOrigin(0.5);

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }
}
