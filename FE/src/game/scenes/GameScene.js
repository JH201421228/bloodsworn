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

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        this.buildMap();
        this.placeProps();
        this.spawnPlayer();

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        if (this.player) {
            // 플레이어는 항상 화면 중앙에 둔다 — 조이스틱(좌하단)과 손가락이 겹치지 않는다(10-UIUX 5.2 원칙 3)
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.playerSystem = new PlayerSystem(this, this.player, this.wallLayer);
        }

        // ?overview=1 — 맵 전체를 한 화면에 담아 구조를 검수한다. 개발 전용.
        if (new URLSearchParams(location.search).get("overview") === "1") {
            const z = Math.min(LOGICAL_WIDTH / WORLD_WIDTH, LOGICAL_HEIGHT / WORLD_HEIGHT);
            this.cameras.main.setZoom(z).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        }

        this.scene.launch(SCENES.HUD);
        if (DEBUG) this.scene.launch(SCENES.DEBUG);
    }

    update() {
        this.playerSystem?.update();
    }

    /** 배경 이미지 + 충돌 격자 */
    buildMap() {
        if (this.textures.exists("map_crypt")) {
            this.add.image(0, 0, "map_crypt").setOrigin(0, 0).setDepth(DEPTH.GROUND);
        } else {
            console.warn("[GameScene] map_crypt 텍스처가 없다");
        }

        const col = this.cache.json.get("map_collision");
        if (!col?.data) {
            console.warn("[GameScene] map-collision.json 이 없다. 벽에 막히지 않는다");
            return;
        }

        // ★ 충돌은 타일맵으로 만든다. 셀마다 정적 바디를 만들면 3천 개가 넘어 예산 밖이다.
        //   Phaser 타일맵은 -1을 빈 칸으로 본다 → walkable(1)을 -1로, solid(0)을 0으로 뒤집는다.
        const data = col.data.map((row) => row.map((v) => (v ? -1 : 0)));

        // 렌더하지 않을 레이어라 텍스처는 투명 16x16 한 장이면 된다.
        if (!this.textures.exists("blank16")) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0xffffff, 0).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            g.generateTexture("blank16", TILE_SIZE, TILE_SIZE);
            g.destroy();
        }

        this.map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
        const ts = this.map.addTilesetImage("blank16");
        this.wallLayer = this.map.createLayer(0, ts, 0, 0);
        this.wallLayer.setVisible(false); // 충돌 전용. 그림은 배경 이미지가 담당한다
        this.wallLayer.setCollisionByExclusion([-1]);

        if (DEBUG) {
            const solid = col.data.flat().filter((v) => !v).length;
            console.log("[GameScene] 충돌 격자 " + col.width + "x" + col.height + " · solid " + solid + "칸");
        }
    }

    /** 좌표 목록으로 횃불·촛불을 얹는다. 불꽃은 맵 이미지에 없다(정본 8.1 청록 광원 연출) */
    placeProps() {
        const objs = this.cache.json.get("map_objects");
        if (!objs) return;

        const light = (x, y, radius, color, alpha) =>
            this.add
                .circle(x, y, radius, color, alpha)
                .setDepth(DEPTH.DECO)
                .setBlendMode(Phaser.BlendModes.ADD);

        let lit = 0;
        for (const t of objs.torches ?? []) {
            if (!this.textures.exists("torch")) break;
            const s = this.add.sprite(t.x, t.y, "torch", 0).setDepth(DEPTH.DECO + 1);
            if (this.anims.exists("deco.torch")) s.play("deco.torch");
            light(t.x, t.y + 2, 30, 0xff3b4a, 0.06);
            lit++;
        }
        for (const c of objs.candles ?? []) {
            if (!this.textures.exists("candle-a")) break;
            const s = this.add.sprite(c.x, c.y, "candle-a", 0).setDepth(DEPTH.DECO + 1);
            if (this.anims.exists("deco.candleA")) s.play("deco.candleA");
            light(c.x, c.y + 1, 18, 0x8ff0dc, 0.05);
            lit++;
        }
        if (DEBUG) console.log("[GameScene] 광원 " + lit + "개 배치");
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
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.player.setCollideWorldBounds(true);

        if (this.anims.exists("player.idle.down")) this.player.play("player.idle.down");
        if (this.wallLayer) this.physics.add.collider(this.player, this.wallLayer);
    }
}
