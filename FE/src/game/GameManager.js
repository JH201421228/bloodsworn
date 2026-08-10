/**
 * 게임 매니저
 * Phaser 게임 인스턴스 관리 및 씬 전환
 */
import Phaser from "phaser";
import { GAME_CONFIG } from "./config.js";
import { AudienceRoomScene } from "./scenes/AudienceRoomScene.js";

export class GameManager {
    constructor() {
        this.game = null;
        this.isInitialized = false;
    }

    /**
     * 게임 초기화
     * @param {HTMLElement} container - Phaser 게임을 마운트할 컨테이너
     */
    init(container) {
        if (this.isInitialized) {
            console.warn("[GameManager] Game already initialized, destroying previous instance");
            this.destroy();
        }

        if (!container) {
            console.error("[GameManager] Container element is required");
            return;
        }

        try {
            const config = {
                ...GAME_CONFIG,
                parent: container,
                scene: [AudienceRoomScene],
            };

            this.game = new Phaser.Game(config);
            this.isInitialized = true;
            // console.log("[GameManager] Game initialized successfully");
        } catch (error) {
            console.error("[GameManager] Failed to initialize game:", error);
            this.isInitialized = false;
        }
    }

    /**
     * 게임 파괴
     */
    destroy() {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
            this.isInitialized = false;
        }
    }

    /**
     * 씬 전환
     * @param {string} sceneKey
     */
    switchScene(sceneKey) {
        if (this.game) {
            this.game.scene.start(sceneKey);
        }
    }

    /**
     * 현재 씬 가져오기
     * @returns {Phaser.Scene|null}
     */
    getCurrentScene() {
        return this.game?.scene?.scenes?.[0] || null;
    }
}

// 싱글톤 인스턴스
export const gameManager = new GameManager();
