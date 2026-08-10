/**
 * GameScene — 런의 중심. 타일맵과 플레이어를 소유한다.
 *
 * 블록 B 완료 시점: 맵이 깔리고 플레이어가 스폰 지점에 서 있으며 벽에 충돌한다.
 * 블록 C에서 조이스틱 입력·이동·카메라 추적·대시가 들어온다. (T133~T137)
 * 규격: 06-TECH-DESIGN.md 4.2 (update 순서)
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../config";
import { DEBUG } from "../debug";

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        this.buildMap();
        this.spawnPlayer();

        // 카메라 — 블록 C에서 startFollow(lerp 0.1)로 바뀐다. 지금은 스폰 지점 중심.
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }

    /** 타일맵 로드 + 충돌 레이어 (T131) */
    buildMap() {
        if (!this.cache.tilemap.has("map_crypt")) {
            console.warn("[GameScene] 타일맵이 없다. npm run build:map 을 돌렸는지 확인할 것");
            return;
        }

        this.map = this.make.tilemap({ key: "map_crypt" });
        // addTilesetImage(Tiled 안의 타일셋 이름, Phaser 텍스처 키)
        const tiles = this.map.addTilesetImage("tiles-main", "tiles_main");

        this.groundLayer = this.map.createLayer("ground", tiles, 0, 0);
        this.wallLayer = this.map.createLayer("walls", tiles, 0, 0);
        this.groundLayer?.setDepth(DEPTH.GROUND);
        this.wallLayer?.setDepth(DEPTH.DECO);

        // walls 레이어에서 빈 칸(0)이 아닌 모든 타일을 충돌로 만든다.
        // setCollisionByExclusion([-1])은 "빈 칸 제외 전부"라는 뜻이다.
        this.wallLayer?.setCollisionByExclusion([-1]);
    }

    /** 플레이어 스폰 — 맵 properties의 spawnX/spawnY를 따른다 */
    spawnPlayer() {
        if (!this.textures.exists("player-idle-down")) {
            console.warn("[GameScene] 플레이어 텍스처가 없다. npm run build:assets 확인");
            return;
        }

        const p = this.map?.properties ?? [];
        const prop = (n, d) => p.find((e) => e.name === n)?.value ?? d;
        const sx = prop("spawnX", WORLD_WIDTH / 2);
        const sy = prop("spawnY", WORLD_HEIGHT / 2);

        this.player = this.physics.add.sprite(sx, sy, "player-idle-down", 0);
        this.player.setDepth(DEPTH.PLAYER);
        // 바디는 발 밑 작은 사각형. 09-ART 2.1 실측 권장값.
        this.player.body.setSize(14, 12).setOffset(41, 44);
        this.player.setCollideWorldBounds(true);
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        if (this.anims.exists("player.idle.down")) this.player.play("player.idle.down");
        if (this.wallLayer) this.physics.add.collider(this.player, this.wallLayer);
    }
}
