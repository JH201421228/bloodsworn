/**
 * GameManager — Phaser 인스턴스의 유일한 소유자.
 * React StrictMode 이중 마운트 / Vite HMR 양쪽을 모두 방어한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.7
 * T106: 깨진 AudienceRoomScene import 제거 (이전 프로젝트 잔재. 빌드 불가 원인이었다)
 * T107: StrictMode 이중 마운트 대응
 */
import Phaser from "phaser";
import { GAME_CONFIG } from "./config";
import { EventBus } from "./EventBus";
import BootScene from "./scenes/BootScene";
import PreloadScene from "./scenes/PreloadScene";
import GameScene from "./scenes/GameScene";
import HudScene from "./scenes/HudScene";
import DebugScene from "./scenes/DebugScene";

class GameManagerImpl {
    constructor() {
        /** @type {Phaser.Game|null} */
        this.game = null;
        /** StrictMode 이중 호출 방어 카운터 */
        this.mountCount = 0;
    }

    /**
     * @param {HTMLElement} container
     * @returns {Phaser.Game|null}
     */
    boot(container) {
        this.mountCount += 1;
        // 이미 살아 있으면 새로 만들지 않고 기존 인스턴스를 그대로 돌려준다.
        if (this.game) return this.game;
        if (!container) {
            console.error("[GameManager] container 엘리먼트가 없다");
            return null;
        }

        this.game = new Phaser.Game({
            ...GAME_CONFIG,
            parent: container,
            scene: [BootScene, PreloadScene, GameScene, HudScene, DebugScene],
        });
        return this.game;
    }

    /**
     * cleanup에서 호출. StrictMode의 즉시 언마운트에서는 파괴하지 않는다.
     * 실제 파괴는 페이지 이탈(pagehide) 또는 HMR dispose에서만 일어난다.
     */
    release() {
        this.mountCount -= 1;
    }

    destroy() {
        if (!this.game) return;
        // removeCanvas=true 로 캔버스 DOM까지 제거해야 HMR에서 캔버스가 쌓이지 않는다.
        // 두 번째 인자 noReturn=false — true면 Phaser 전역이 정리되어 HMR 재생성이 깨진다.
        this.game.destroy(true, false);
        this.game = null;
        this.mountCount = 0;
        EventBus.clear();
    }
}

export const gameManager = new GameManagerImpl();

// Vite HMR: 모듈이 교체될 때 기존 게임을 확실히 파괴한다. 이걸 빼면 개발 중 캔버스가 무한 증식한다.
if (import.meta.hot) {
    import.meta.hot.dispose(() => gameManager.destroy());
}
