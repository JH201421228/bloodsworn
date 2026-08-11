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
import { EnemyProjectileSystem } from "../systems/EnemyProjectileSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { installCheats } from "../debugCheats";
import { validateData } from "@/data/validate";
import { GroundSystem } from "../systems/GroundSystem";
import { StatSystem } from "../systems/StatSystem";
import { PactSystem } from "../systems/PactSystem";
import { AwakeningSystem } from "../systems/AwakeningSystem";
import { BossSystem } from "../systems/BossSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { FxSystem } from "../systems/FxSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { ItemSystem } from "../systems/ItemSystem";
import { StageSystem } from "../systems/StageSystem";
import { QualitySystem } from "../systems/QualitySystem";
import { EventBus } from "../EventBus";
import { EVENTS } from "../constants";

export default class GameScene extends Phaser.Scene {
    constructor() {
        super(SCENES.GAME);
    }

    create() {
        this.timeScale = 1; // 치트: 시간 배속
        // 데이터 오타는 JSON 파서를 통과하고 런타임에 NaN 으로 나타난다. 부팅 때 한 번 잡는다(T322).
        if (DEBUG) validateData();
        this.buildMap();
        this.spawnPlayer();

        // 끝없는 맵이라 카메라·월드 경계를 두지 않는다
        if (this.player) {
            // 플레이어는 항상 화면 중앙에 둔다 — 조이스틱(좌하단)과 손가락이 겹치지 않는다(10-UIUX 5.2 원칙 3)
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.playerSystem = new PlayerSystem(this, this.player, this.wallLayer);
            this.spawnSystem = new SpawnSystem(this, this.player);
            this.aiSystem = new EnemyAISystem(this, this.player, this.spawnSystem);
            this.stats = new StatSystem();
            this.pact = new PactSystem(this.stats);
            this.combatSystem = new CombatSystem(this, this.player, this.spawnSystem, this.playerSystem, this.stats, this.pact);
            this.playerSystem.stats = this.stats;
            // 적 투사체(E6). EnemyAISystem 이 scene.enemyProjectiles 로 찾으므로 이 이름이 계약이다.
            this.enemyProjectiles = new EnemyProjectileSystem(this, { player: this.player, combat: this.combatSystem });

            // ★ 각성은 CombatSystem 안쪽에서 피해·처치를 가로채므로 주입으로 연결한다.
            //   생성자 인자로 넘기면 CombatSystem <-> AwakeningSystem 순환 참조가 된다.
            this.awakening = new AwakeningSystem(this, {
                stats: this.stats, pact: this.pact, combat: this.combatSystem, player: this.player,
            });
            this.combatSystem.awakening = this.awakening;

            this.bossSystem = new BossSystem(this, {
                player: this.player, spawn: this.spawnSystem, combat: this.combatSystem, stats: this.stats,
            });
            // 플레이어 투사체. CombatSystem 이 직접 원을 그리던 것을 대체한다 —
            // 스프라이트·진행방향 회전·명중 이펙트·관통/유도/분열/폭발이 전부 여기 있다.
            this.projectiles = new ProjectileSystem(this, {
                player: this.player, combat: this.combatSystem, stats: this.stats,
            });
            this.combatSystem.projectiles = this.projectiles;

            // 아이템 드롭. CombatSystem 이 적 사망 시 rollDrop 을 부른다.
            this.items = new ItemSystem(this, {
                player: this.player, combat: this.combatSystem, stats: this.stats, spawn: this.spawnSystem,
            });
            this.combatSystem.items = this.items;
            this.fxSystem = new FxSystem(this, { player: this.player });
            this.combatSystem.fx = this.fxSystem;
            this.quality = new QualitySystem(this, { fx: this.fxSystem });
            // 스테이지 — 적 풀·웨이브 곡선·보스·배경·환경 기믹을 한 번에 바꾼다.
            // bossSystem 이 먼저 있어야 기믹이 보스전 중 강도를 판단할 수 있다.
            this.stages = new StageSystem(this, { spawn: this.spawnSystem, boss: this.bossSystem });
            this.stages.load(this.registry.get("stageId") ?? undefined);
            this.audio = new AudioSystem(this);
            this.input.once("pointerdown", () => this.audio.unlock());

            // React -> Phaser 커맨드. key를 줘 StrictMode 이중 등록을 막는다(T107b)
            this.offCmds = [
                EventBus.on(EVENTS.CMD_PACT_CHOOSE, (p) => this.combatSystem.applyCard(p?.index ?? 0), { key: "game:pact-choose" }),
                EventBus.on(EVENTS.CMD_PACT_SKIP, () => this.combatSystem.applyCard(-1), { key: "game:pact-skip" }),
                EventBus.on(EVENTS.CMD_PACT_REROLL, () => this.combatSystem.rerollCards(), { key: "game:pact-reroll" }),
                EventBus.on(EVENTS.CMD_PAUSE, () => {
                    if (this.scene.isPaused()) return;
                    this.scene.pause();
                    EventBus.emit(EVENTS.RUN_PAUSED, {});
                }, { key: "game:pause" }),
                EventBus.on(EVENTS.CMD_RESUME, () => {
                    if (!this.scene.isPaused()) return;
                    this.scene.resume();
                    EventBus.emit(EVENTS.RUN_RESUMED, {});
                }, { key: "game:resume" }),
                EventBus.on(EVENTS.CMD_REVIVE, (p) => this.combatSystem.resolveRevive(Boolean(p?.accepted)), { key: "game:revive" }),
                EventBus.on(EVENTS.CMD_ABANDON, () => this.combatSystem.abandon(), { key: "game:abandon" }),
            ];
            this.events.once("shutdown", () => this.offCmds?.forEach((f) => f()));
            if (DEBUG) installCheats(this);
        }

        // ?overview=1 — 맵 전체를 한 화면에 담아 구조를 검수한다. 개발 전용.
        if (new URLSearchParams(location.search).get("overview") === "1") {
            const z = Math.min(LOGICAL_WIDTH / WORLD_WIDTH, LOGICAL_HEIGHT / WORLD_HEIGHT);
            this.cameras.main.setZoom(z).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        }

        // React 가 화면을 PLAYING 으로 넘기고 런 상태를 초기화하는 신호.
        // rerollLeft 는 성소 「재계약」으로 늘어나므로 Phaser 가 계산해 실어 보낸다.
        EventBus.emit(EVENTS.RUN_STARTED, { rerollLeft: this.combatSystem?.pact?.rerollLeft ?? 2 });

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
        this.enemyProjectiles?.update(dt); // 투사체 이동 -> 충돌은 그 안에서 처리한다

        // 6:00 최종 보스 「여명의 처형인」. 등장 시각은 data/boss.json 의 spawnAt(=360)이 정본이다.

        const bs = this.bossSystem;

        if (bs && !bs.active && !bs.defeated && this.spawnSystem.elapsed >= bs.def.spawnAt) bs.spawn();
        this.combatSystem?.update(dt);
        this.projectiles?.update(dt); // 해시 재구축 뒤에 충돌을 본다
        this.items?.update(dt);      // 드롭 자석·획득·유물 규칙
        this.stages?.update(dt);     // 환경 기믹
        this.bossSystem?.update(dt);
        this.fxSystem?.update(dt);
        this.quality?.update(dt);
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
