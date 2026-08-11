/**
 * PlayerSystem — 이동, 4방향 애니메이션 전환, 대시. (T135/T137)
 *
 * 규격: 03-GDD-CORE.md 3.2(조작) / 4(스탯 moveSpeed 70) / 10-UIUX 5
 *   대시: 이동방향으로 120px 순간이동, 무적 0.25초, 쿨다운 3.0초.
 *         정지 중이면 바라보는 방향.
 */
import { input } from "./InputSystem";

export const BASE_MOVE_SPEED = 70; // px/s (정본 4)
export const DASH_DISTANCE = 120;
export const DASH_IFRAME = 250; // ms
export const DASH_COOLDOWN = 3000; // ms

/** 대시 순간이동 시 벽을 뚫지 않도록 검사하는 간격 */
const DASH_STEP = 6;

export class PlayerSystem {
    /**
     * @param {Phaser.Scene} scene
     * @param {Phaser.Physics.Arcade.Sprite} player
     * @param {Phaser.Tilemaps.TilemapLayer|null} wallLayer 대시 경로 검사용
     */
    constructor(scene, player, wallLayer) {
        this.scene = scene;
        this.player = player;
        this.wallLayer = wallLayer;
        this.facing = "down";
        this.moveSpeed = BASE_MOVE_SPEED;
        this.dashReadyAt = 0;
        /**
         * 외부 힘 (StageSystem 환경 기믹 등).
         * ★ 좌표를 직접 옮기면(pl.x += ...) 물리를 우회해 대시 경로 검사·넉백 감쇠·충돌이
         *   전부 어긋난다. 속도로 받아 입력에 더한다.
         */
        this.externalVx = 0;
        this.externalVy = 0;
        this.invulnUntil = 0;
        this.currentAnim = null;
    }

    get dashReady() {
        return this.scene.time.now >= this.dashReadyAt;
    }

    /** 0~1. HUD 쿨다운 표시용 */
    get dashProgress() {
        const left = this.dashReadyAt - this.scene.time.now;
        return left <= 0 ? 1 : 1 - left / DASH_COOLDOWN;
    }

    get invulnerable() {
        return this.scene.time.now < this.invulnUntil;
    }

    update() {
        if (!this.player?.body) return;
        input.pollKeyboard();

        const v = input.vector;
        const speed = this.stats ? this.stats.get("moveSpeed") : this.moveSpeed;
        // 외부 힘은 입력 속도에 더한다(기믹의 미는 힘 등)
        this.player.setVelocity(v.x * speed + this.externalVx, v.y * speed + this.externalVy);
        const moving = v.x !== 0 || v.y !== 0;
        if (moving) this.facing = this.dirFromVector(v.x, v.y);
        this.playAnim(moving ? "run" : "idle");

        if (input.consumeDash()) this.tryDash();
    }

    /** 지배적 축으로 4방향을 정한다. 대각선에서 방향이 떨리지 않게 절대값을 비교한다 */
    dirFromVector(x, y) {
        return Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
    }

    playAnim(kind) {
        const key = "player." + kind + "." + this.facing;
        if (this.currentAnim === key) return;
        if (!this.scene.anims.exists(key)) return;
        this.player.play(key, true);
        this.currentAnim = key;
    }

    tryDash() {
        if (!this.dashReady) return;

        const v = input.vector;
        let dx = v.x, dy = v.y;
        if (dx === 0 && dy === 0) {
            // 정지 중이면 바라보는 방향 (정본 3.2)
            const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
            dx = f[0];
            dy = f[1];
        }
        const d = Math.hypot(dx, dy);
        dx /= d;
        dy /= d;

        // ★ 벽을 뚫지 않도록 경로를 잘게 검사하고 마지막 통행 가능 지점에서 멈춘다.
        //   순간이동을 그냥 하면 벽 너머로 빠져나가 맵 밖에 갇힌다.
        const sx = this.player.x, sy = this.player.y;
        let lastX = sx, lastY = sy;
        for (let t = DASH_STEP; t <= DASH_DISTANCE; t += DASH_STEP) {
            const nx = sx + dx * t;
            const ny = sy + dy * t;
            if (this.isSolidAt(nx, ny)) break;
            lastX = nx;
            lastY = ny;
        }

        this.player.setPosition(lastX, lastY);
        this.dashReadyAt = this.scene.time.now + DASH_COOLDOWN * (this.stats ? this.stats.get("dashCd") : 1);
        this.scene.audio?.sfx("dash");
        this.scene.fxSystem?.shake("dash");
        this.invulnUntil = this.scene.time.now + DASH_IFRAME;

        // 무적 동안 반짝임 — 피격 판정이 없다는 것을 눈으로 알려준다
        this.scene.tweens.add({
            targets: this.player,
            alpha: { from: 0.35, to: 1 },
            duration: DASH_IFRAME,
            ease: "Quad.easeOut",
        });
    }

    /** 발 밑 기준으로 통행 가능 여부를 본다. 바디 오프셋(발 밑)과 맞춘다 */
    isSolidAt(x, y) {
        if (!this.wallLayer) return false;
        const tile = this.wallLayer.getTileAtWorldXY(x, y + 6, true);
        return !!tile && tile.index !== -1;
    }
}
