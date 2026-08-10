/**
 * GameScene — 런의 중심. 타일맵과 플레이어를 소유한다.
 *
 * 블록 B 완료 시점: 맵이 깔리고 플레이어가 스폰 지점에 서 있으며 벽에 충돌한다.
 * 블록 C에서 조이스틱 입력·이동·카메라 추적·대시가 들어온다. (T133~T137)
 * 규격: 06-TECH-DESIGN.md 4.2 / 맵 레이어 규약은 03-GDD-CORE.md 8.1
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { WORLD_WIDTH, WORLD_HEIGHT, LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";
import { DEBUG } from "../debug";

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        this.buildMap();
        this.placeProps();
        this.spawnPlayer();

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);

        // ?overview=1 — 맵 전체를 한 화면에 담아 구조를 검수한다. 개발 전용.
        if (new URLSearchParams(location.search).get("overview") === "1") {
            const z = Math.min(LOGICAL_WIDTH / WORLD_WIDTH, LOGICAL_HEIGHT / WORLD_HEIGHT);
            this.cameras.main.setZoom(z).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        }

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }

    /** 타일맵 로드 + 충돌 (T131). 레이어는 ground / deco / walls / objects */
    buildMap() {
        if (!this.cache.tilemap.has("map_crypt")) {
            console.warn("[GameScene] 타일맵이 없다. npm run build:map 을 돌렸는지 확인할 것");
            return;
        }
        this.map = this.make.tilemap({ key: "map_crypt" });
        const tiles = this.map.addTilesetImage("tiles-main", "tiles_main");

        this.groundLayer = this.map.createLayer("ground", tiles, 0, 0)?.setDepth(DEPTH.GROUND);
        this.decoLayer = this.map.createLayer("deco", tiles, 0, 0)?.setDepth(DEPTH.GROUND + 1);
        this.wallLayer = this.map.createLayer("walls", tiles, 0, 0)?.setDepth(DEPTH.DECO);

        // walls 레이어의 빈 칸이 아닌 전부가 충돌이다(벽면 + void).
        this.wallLayer?.setCollisionByExclusion([-1]);
    }

    /** objects 레이어의 포인트를 읽어 횃불을 세운다. 정본 8.1의 "청록 광원 연출" */
    placeProps() {
        const layer = this.map?.getObjectLayer("objects");
        if (!layer) return;

        let lit = 0;
        for (const o of layer.objects) {
            if (o.type !== "torch" && o.name !== "torch") continue;
            if (!this.textures.exists("torch")) break;

            const s = this.add.sprite(o.x, o.y, "torch", 0).setDepth(DEPTH.DECO + 1);
            if (this.anims.exists("deco.torch")) s.play("deco.torch");

            // 불빛 — 스프라이트 뒤에 반투명 원을 깔아 광원처럼 보이게 한다.
            // 실제 라이팅 파이프라인은 7일 스코프 밖이다(06 15).
            this.add
                .circle(o.x, o.y + 2, 26, 0xff3b4a, 0.055)
                .setDepth(DEPTH.DECO)
                .setBlendMode(Phaser.BlendModes.ADD);
            lit++;
        }
        if (DEBUG) console.log("[GameScene] 횃불 " + lit + "개 배치");
    }

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
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.player.setCollideWorldBounds(true);

        if (this.anims.exists("player.idle.down")) this.player.play("player.idle.down");
        if (this.wallLayer) this.physics.add.collider(this.player, this.wallLayer);
    }
}
