/**
 * BLOODSWORN 게임 전역 설정
 * 논리 해상도 640x360 가로 고정. 정본 03-GDD-CORE 2.1 준수.
 *
 * 규격 출처: 06-TECH-DESIGN.md 1.3
 * 이전 프로젝트 잔재(세로 375x667, Scale.RESIZE, AUDIENCE_LAYOUT)는 전량 폐기했다. (T104/T105)
 */
import Phaser from "phaser";

/** 논리 해상도 — 이 값을 코드 여기저기 하드코딩하지 말고 항상 여기서 import 한다. */
export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;

/** 월드(스테이지1 봉인묘) 크기. 정본 03-GDD-CORE 8.1 */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1200;

/** 타일 크기 */
export const TILE_SIZE = 16;

/** 런 길이(초). 정본 01 2 */
export const RUN_DURATION = 360;

/** 배경색 — 레터박스와 같은 색이어야 "묘실의 어둠"으로 읽힌다. 정본 03-GDD-CORE 2.1 */
export const VOID_COLOR = "#0b0710";

export const GAME_CONFIG = {
    type: Phaser.AUTO,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: VOID_COLOR,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    powerPreference: "high-performance",
    // 모바일 WebView에서 60fps 상한을 명시. forceSetTimeOut은 쓰지 않는다(rAF가 더 안정적).
    fps: { target: 60, min: 30, forceSetTimeOut: false },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
    },
    render: {
        // 픽셀아트 텍스처가 씻겨나가지 않도록 프리멀티플라이 비활성
        premultipliedAlpha: false,
        // 스크린샷/공유 기능 없음 → 백버퍼 보존 불필요
        preserveDrawingBuffer: false,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            // 플레이어 vs 벽 타일맵 충돌에만 쓴다(06 5.2). 적/투사체는 공간해시로 직접 판정.
            fps: 60,
        },
    },
    audio: { disableWebAudio: false },
    // scene 배열은 GameManager가 주입한다.
};
