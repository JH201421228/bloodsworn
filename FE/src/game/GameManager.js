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
import { DEBUG } from "./debug";
import { EVENTS, SCENES } from "./constants";
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

        // T531 재시작 3초 규칙 — location.reload() 는 에셋 재파싱만 3~5초라 규칙을 못 지킨다.
        // ★ GameScene 안이 아니라 여기에 거는 이유: scene.restart() 가 shutdown 을 발화시켜
        //   자기 자신의 구독을 해제하는 도중에 핸들러가 도는 경합이 생긴다.
        EventBus.on(EVENTS.CMD_START_RUN, (p) => {
            const g = this.game;
            if (!g) return;
            // ★ GameScene.create() 가 registry 의 stageId 로 스테이지를 고른다.
            //   registry 는 씬 재시작을 넘어 살아남으므로, stageId 없이 온 재시작
            //   (결과 화면 [다시], 성소 [출정])은 직전 스테이지를 그대로 잇는다 —
            //   "방금 진 그 스테이지를 다시"라는 기대와 맞다.
            if (p?.stageId) g.registry.set("stageId", p.stageId);
            // 성소 업그레이드. registry 에 두면 씬 재시작을 넘어 살아남아
            // 결과 화면 [다시 하기] 로 돌아온 런에도 그대로 적용된다.
            if (p?.meta?.upgrades) g.registry.set("sanctum", p.meta.upgrades);
            // ★ else 로 묶여 있던 줄이다. requestStartRun 은 meta.upgrades 를 **항상** 실어
            //   보내므로 이 기본값은 한 번도 실행된 적이 없었다(실측: 부팅 직후 성소 [출정]
            //   에서 registry.stageId 가 undefined). StageSystem.load 가 defaultStageId 로
            //   떨어져 결과는 같았지만, 「기본 스테이지를 여기서 정한다」는 의도가 죽어 있었다.
            if (!g.registry.has("stageId")) g.registry.set("stageId", "stage1");
            const gs = g.scene.getScene(SCENES.GAME);
            if (!gs || !gs.scene.isActive()) { g.scene.start(SCENES.GAME); return; }
            // 승리/카드 대기 중에는 씬이 pause 상태다. 풀지 않으면 restart 가 먹지 않는다.
            if (gs.scene.isPaused()) gs.scene.resume();
            g.scene.stop(SCENES.HUD);
            g.scene.stop(SCENES.DEBUG);
            gs.scene.restart();
        }, { key: "gm:start-run" });
        // DEBUG일 때만 전역 노출 — 브라우저 콘솔과 자동 검증 스크립트가 게임 상태를 읽는다
        if (DEBUG && typeof window !== "undefined") window.__PHASER_GAME__ = this.game;
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
