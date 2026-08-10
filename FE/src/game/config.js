/**
 * 게임 전역 설정
 * Phaser 게임 설정 및 상수 정의
 */
import Phaser from "phaser";

export const GAME_CONFIG = {
    // 화면 설정
    width: 375, // 세로 모드 기준 너비 (모바일)
    height: 667, // 세로 모드 기준 높이
    type: Phaser.AUTO,
    parent: "phaser-game-container",
    backgroundColor: "#0f0f1e",
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
};

// 알현실 레이아웃
export const AUDIENCE_LAYOUT = {
    // 옥좌 위치 (우측 상단)
    throne: {
        x: 300,
        y: 120,
    },
    // 몬스터 대기열 시작 위치 (좌측)
    queueStart: {
        x: -50,
        y: 400,
    },
    // 알현 위치 (옥좌 앞)
    audienceSpot: {
        x: 200,
        y: 350,
    },
    // 대기열 간격
    queueSpacing: 60,
};
