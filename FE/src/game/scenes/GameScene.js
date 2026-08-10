/**
 * GameScene — 런의 중심. 맵과 플레이어를 소유한다.
 *
 * ★ 맵은 Tiled 타일맵이 아니라 **단일 이미지 + 충돌 배열**이다.
 *   타일셋 자동 조립 품질이 요구 수준에 미달해 방식을 바꿨다. 경위와 규격: docs/18-MAP-IMAGE-PROMPT.md
 *     map-crypt.png      1600x1200 배경 이미지 1장
 *     map-collision.json 16px 격자 100x75 배열 (0=solid, 1=walkable)
 *     map-objects.json   횃불·촛불 좌표 (불꽃은 이미지에 없다. 여기서 스프라이트로 얹는다)
 *
 * 블록 C에서 조이스틱 입력·이동·카메라 추적·대시가 들어온다. (T133~T137)
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { WORLD_WIDTH, WORLD_HEIGHT, LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE_SIZE } from "../config";
import { DEBUG } from "../debug";
import { PlayerSystem } from "../systems/PlayerSystem";
import { SpawnSystem } from "../systems/SpawnSystem";
import { EnemyAISystem } from "../systems/EnemyAISystem";
import { CombatSystem } from "../systems/CombatSystem";
import { installCheats } from "../debugCheats";
import { GroundSystem } from "../systems/GroundSystem";

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        this.timeScale = 1; // 치트: 시간 배속
        this.buildMap();
        this.spawnPlayer();

        // 끝없는 맵이라 카메라·월드 경계를 두지 않는다
        if (this.player) {
            // 플레이어는 항상 화면 중앙에 둔다 — 조이스틱(좌하단)과 손가락이 겹치지 않는다(10-UIUX 5.2 원칙 3)
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.playerSystem = new PlayerSystem(this, this.player, this.wallLayer);
            this.spawnSystem = new SpawnSystem(this, this.player);
            this.aiSystem = new EnemyAISystem(this, this.player, this.spawnSystem);
            this.combatSystem = new CombatSystem(this, this.player, this.spawnSystem, this.playerSystem);
            if (DEBUG) installCheats(this);
        }

        // ?overview=1 — 맵 전체를 한 화면에 담아 구조를 검수한다. 개발 전용.
        if (new URLSearchParams(location.search).get("overview") === "1") {
            const z = Math.min(LOGICAL_WIDTH / WORLD_WIDTH, LOGICAL_HEIGHT / WORLD_HEIGHT);
            this.cameras.main.setZoom(z).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        }

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }

    update(time, delta) {
        // ★ update 순서 고정 (06-TECH 4.2) — 입력/이동 -> 스폰 -> AI -> 전투
        //   전투가 마지막인 이유: 공간해시를 모든 이동이 끝난 뒤 재구축해야 한다.
        const dt = Math.min(delta, 50) / 1000 * this.timeScale;
        // 사망하면 전부 멈춘다 — 결과 화면이 뜨는데 뒤에서 스폰이 계속 돌면 안 된다
        if (this.combatSystem?.dead) return;
        this.groundSystem?.update();
        this.playerSystem?.update();
        this.spawnSystem?.update(dt);
        this.aiSystem?.update(dt);
        this.combatSystem?.update(dt);
    }

    /** 끝없는 바닥 + 소품. 벽도 충돌도 없다(18번 문서 4차 개정) */
    buildMap() {
        this.groundSystem = new GroundSystem(this);
        this.wallLayer = null; // 벽이 없다 — 대시 경로 검사도 통과시킨다
    }

    spawnPlayer() {
        if (!this.textures.exists("player-idle-down")) {
            console.warn("[GameScene] 플레이어 텍스처가 없다");
            return;
        }
        // 스폰은 맵 규격(18번 문서 4)에서 고정값이다
        const sx = 800;
        const sy = 608;

        this.player = this.physics.add.sprite(sx, sy, "player-idle-down", 0);
        this.player.setDepth(DEPTH.PLAYER);
        // 바디는 발 밑 작은 사각형. 09-ART 2.1 실측 권장값.
        this.player.body.setSize(14, 12).setOffset(41, 44);


        if (this.anims.exists("player.idle.down")) this.player.play("player.idle.down");
        if (this.wallLayer) this.physics.add.collider(this.player, this.wallLayer);
    }
}
