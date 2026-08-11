/**
 * PlayerSystem — 이동, 4방향 애니메이션 전환, 대시. (T135/T137)
 *
 * 규격: 03-GDD-CORE.md 3.2(조작) / 4(스탯 moveSpeed 70) / 10-UIUX 5
 *   대시: 이동방향으로 120px 순간이동, 무적 0.25초, 쿨다운 3.0초.
 *         정지 중이면 바라보는 방향.
 */
import { input } from "./InputSystem";

/**
 * 게임 전체의 "이동 템포" 배율. 플레이어와 적에 **똑같이** 곱한다.
 * (SpawnSystem.reset 의 e.speed, CombatSystem 의 자석/오브 흡인 속도가 이 값을 함께 쓴다)
 *
 * ★ 왜 1.25 인가 — 그리고 왜 플레이어만 올리면 안 되는가
 *   정본 05-COMBAT 4 의 설계 전제는 "속도 기준선은 플레이어 70px/s, 그보다 빠른 적은
 *   E1(95)·E3(135)·E7(110) 3종뿐" 이다. 이 3:5 비율이 "키팅은 통하지만 방심하면
 *   둘러싸인다" 를 만든다. 플레이어만 올리면 빠른 적이 0종이 되어 게임이 사라진다.
 *   그래서 **상대속도를 1.000 로 고정한 채** 절대 템포만 올린다.
 *
 *   1.25 의 근거 (640x360 논리 해상도 기준):
 *   - 체감: 화면 단축(360px) 횡단 5.14s -> 4.11s, 장축(640px) 9.14s -> 7.31s.
 *     20% 미만은 손에 잡히지 않고(원 불만이 그대로 남는다) 25%면 확실히 다르다.
 *   - 상한: 데이터상 최속 적 140px/s 가 1.25 에서 175px/s 가 된다. 스폰 링(400px)에서
 *     플레이어까지 도달 2.86s -> 2.29s. 1.5 로 올리면 210px/s / 1.90s 가 되는데,
 *     모바일 화면에서 "보고-판단하고-경로를 트는" 데 필요한 약 2s 아래로 내려간다.
 *     즉 1.25 는 "빨라진 체감"과 "반응 가능한 위협 도달시간"이 둘 다 성립하는 상한이다.
 *   - 대시(120px)도 같은 배율로 올린다. 안 올리면 대시의 값어치가
 *     "걸어서 1.71초" 에서 "1.37초" 로 떨어져 쿨 3s 를 정당화하지 못한다.
 */
export const TEMPO_SCALE = 1.25;

export const BASE_MOVE_SPEED = 70 * TEMPO_SCALE; // 87.5px/s (정본 4 의 70 x 템포)
export const DASH_DISTANCE = 120 * TEMPO_SCALE;  // 150px — 걸어서 1.71초, 배율 전과 동일
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
        this.moveSpeed = BASE_MOVE_SPEED; // 이미 TEMPO_SCALE 이 반영된 값 — 다시 곱하지 않는다
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
        /**
         * ★ 공격 모션 (T850)
         *   player-atk1/atk2 x 4방향 8종이 registerAnims 에 등록돼 있고 스프라이트시트도
         *   매니페스트에 있었는데 **재생하는 코드가 한 줄도 없었다.** 96x80 시트 8장을
         *   GPU 에 올려 두고 쓰지 않는 상태였다.
         *   attackUntil 이 지날 때까지 run/idle 이 이 모션을 덮지 않는다.
         *   시간으로 재는 이유: animationcomplete 리스너는 W1 이 쿨보다 빨리 재발사될 때
         *   (haste + 룬 「되받아치기」로 쿨 0.48초까지 내려간다) 중첩 해제가 꼬인다.
         */
        this.attackUntil = 0;
        this.attackAlt = 0; // atk1 / atk2 를 번갈아 — 두 모션이 이어지면 연격으로 읽힌다
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
        // ★ 배율을 StatSystem 안이 아니라 여기서 곱하는 이유
        //   StatSystem 은 다른 소유다. 그리고 결과값에 곱하면 안전장치 S1 의
        //   moveSpeed 하한(abs 32)까지 같은 비율로 40 이 되어, "대가로 아무리 느려져도
        //   기본치의 45.7%는 남는다" 는 04-PACT 4 의 의도가 그대로 보존된다.
        //   BASE 만 88 로 바꾸고 하한을 32 로 두면 그 비율이 36.4% 로 몰래 나빠진다.
        const speed = this.stats ? this.stats.get("moveSpeed") * TEMPO_SCALE : this.moveSpeed;
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
        // 공격 모션이 도는 동안에는 이동/대기 모션이 덮지 않는다.
        if (this.scene.time.now < this.attackUntil) return;
        const key = "player." + kind + "." + this.facing;
        if (this.currentAnim === key) return;
        if (!this.scene.anims.exists(key)) return;
        this.player.play(key, true);
        this.currentAnim = key;
    }

    /**
     * W1 「피의 송곳니」가 벨 때 호출한다 (CombatSystem.fireArc).
     *
     * ★ 방향을 발사 시점의 facing 으로 **고정**한다. 휘두르는 중에 방향을 바꿔도 모션은
     *   그대로다 — fireArc 의 판정 부채꼴도 발사 시점 facing 으로 계산되므로, 모션이
     *   따라 돌면 "맞은 방향"과 "휘두른 방향"이 어긋나 보인다.
     * ★ 근접 무기에만 붙인다. atk 시트는 무기를 휘두르는 그림이라 원거리 W2 나 상시
     *   궤도 W3 에 붙이면 쏘지도 않은 칼을 계속 휘두르게 된다.
     */
    playAttack() {
        if (!this.player?.anims) return;
        this.attackAlt ^= 1;
        const key = "player.atk" + (this.attackAlt + 1) + "." + this.facing;
        if (!this.scene.anims.exists(key)) return;
        // ignoreIfPlaying = false — 쿨이 모션보다 짧아지면 처음부터 다시 휘두른다.
        this.player.play(key);
        this.currentAnim = key;
        const a = this.player.anims.currentAnim;
        this.attackUntil = this.scene.time.now + (a ? a.duration : 500);
        // ★ 여기서 setTint 를 부르지 않는다. 궤적 색은 이미 시트에 구워져 있다
        //   (tools/build-player-atk.mjs). 런타임 틴트는 스프라이트 전체에 곱해져서
        //   궤적을 적당히 어둡게 하면 캐릭터까지 단색 덩어리가 된다 — 실제로 시도해 봤다.
        //   궤적과 캐릭터가 같은 텍스처에 있는 한 런타임에는 분리할 수 없어 굽는 쪽을 택했다.
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
