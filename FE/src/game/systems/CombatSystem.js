/**
 * CombatSystem — 공간 해시 충돌 + 무기 + 데미지 + 사망 + EXP 오브.
 * (T210/T211/T212/T213/T214/T220/T221)
 *
 * 규격: 06-TECH 5.2(공간해시) / 05-COMBAT 2.1(W1) 2.2(W2)
 *
 * ★ update 순서가 고정이다 (06 4.2)
 *   무기 발사 -> 투사체 이동 -> 공간해시 재구축 -> 충돌 -> 데미지 일괄 -> 사망
 *   해시를 이동 중간에 갱신하면 그리드가 오염된다.
 *   데미지를 충돌에서 즉시 처리하지 않고 큐에 쌓는 이유: 한 프레임에 같은 적이
 *   여러 소스에서 맞을 때 사망이 중복 처리되어 EXP가 2배 드롭된다.
 */
import Phaser from "phaser";
import { SpatialHash } from "../utils/SpatialHash";
import { Pool } from "../pools/Pool";
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2 } from "../utils/math";
import { TEMPO_SCALE } from "./PlayerSystem";
import { emptyMods } from "./RuneSystem";
import weaponsData from "@/data/weapons.json";
import { resolveAdPlacement, showRewarded } from "@/monetization";

const MAX_PROJECTILES = 200;

// ── W1 참격 이펙트 (drawArcFx 주석 참조) ──────────────────────────────
/** 표시 시간(ms). 예전 100 에서 늘렸다 — 사그라드는 걸 보여주려면 100 은 너무 짧다 */
const ARC_FX_MS = 140;
/** 안쪽을 비우는 비율. 발밑까지 채우면 벤 자국이 아니라 바닥 데칼로 읽힌다 */
const ARC_FX_INNER = 0.45;
const ARC_FX_FILL = 0xc4182b;
/** 바깥 호에 얹는 밝은 선 — 이 실루엣이 "칼이 지나간 선"이다 */
const ARC_FX_EDGE = 0xff6b6b;
/**
 * 띠를 이루는 점의 개수(안/밖 각각). 12 면 160도 부채꼴에서 한 조각이 13도라 곡선이 매끄럽다.
 * ★ 고정값인 이유: 점 배열을 생성자에서 한 번만 만들고 좌표만 덮어쓰기 위해서다(런 중 new 금지).
 */
const ARC_FX_SEG = 12;
/** W3 유골 / W4 장판에 쓰는 투사체 아틀라스 시트. data/projectiles.json 의 키와 같아야 한다.
 *  ★ 텍스처가 없으면(에셋 미빌드) 예전 도형으로 조용히 되돌아간다 —
 *    무기가 안 보이는 것보다 못생긴 게 낫다. */
const W3_SHEET = "proj-shuriken-ash";
const W4_SHEET = "proj-spin-ash";
/** W3 유골 최대 수. Lv5 는 5개지만 룬 「더 많은 뼈」(+2) x 「역회전」(두 겹)이면 14개가 된다.
 *  ★ 스프라이트는 생성자에서 전부 만들어 두고 보이기/숨기기만 한다 — 런 중 new 금지(06-TECH 5.1) */
const MAX_ORBIT = 16;
/** W4 장판 최대 수. Lv5 5곳 x 지속 1.8s / 쿨 2.6s 가 기준이고,
 *  룬 「넘치는 성수」(+1)와 「마르지 않음」(지속 x1.6)까지 겹칠 때의 최악을 담는다 */
const MAX_ZONES = 20;
/** 장판 링 스프라이트의 최대 표시 크기(px). 원본이 24px 이라 이보다 늘리면 X 자 덩어리로 뭉개진다.
 *  ★ 룬 「퍼지는 성수」/「성역」이 반경을 크게 키우므로 필요해졌다 — 실제로 화면에서 확인하고 넣은 값이다. */
const RING_MAX_PX = 96;
const MAX_ORBS = 300;
const PLAYER_IFRAME = 400; // ms. 정본 05-COMBAT 1

/**
 * EXP 오브 아트. ItemSystem 과 **같은 아틀라스**를 쓴다.
 *
 * ★ 왜 도형(circle)에서 스프라이트로 바꾸는가 — 그림 문제만이 아니다
 *   Phaser 의 Arc/Shape 는 텍스처가 없어 MultiPipeline 이 아니라 도형 경로로 나간다.
 *   화면에 오브 200~300개 + 아이템 스프라이트가 섞이면 그릴 때마다 파이프라인이
 *   왔다갔다 하며 배치가 끊긴다. 오브를 items 아틀라스로 옮기면 아이템 드롭·후광과
 *   **같은 텍스처 한 장**이라 한 배치로 합쳐진다 — 드로우콜은 늘지 않고 오히려 준다.
 *
 * ★ 스케일 0.5 인 이유
 *   프레임이 32x32(잉크 21x24)다. pixelArt:true / roundPixels:true 환경에서
 *   0.5 는 원본 2픽셀이 화면 1픽셀로 정확히 떨어지는 유일한 축소비다.
 *   0.4 나 0.6 은 픽셀 행이 들쭉날쭉 버려져 오브가 움직일 때 반짝거린다.
 *   결과 크기는 잉크 약 10.5x12px — 예전 지름 4px 점보다 확실히 크고,
 *   아이템 드롭(21x24, 배율 1)보다는 확실히 작아 "흔한 것 / 귀한 것"이 구분된다.
 */
const ORB_ATLAS = "items";
const ORB_FRAME = "itm_gem_teal"; // 기존 0x35c9b4 청록과 같은 계열이라 학습된 색을 안 버린다
const ORB_SCALE = 0.5;

/**
 * 자석/흡인/획득 반경. TEMPO_SCALE 을 함께 곱한다.
 * ★ 안 곱하면 무슨 일이 생기나: 플레이어가 25% 빨라지면 오브 옆을 25% 빨리 지나쳐
 *   자석에 걸리는 시간이 그만큼 줄어든다. "빨라졌더니 EXP가 안 붙는다"가 된다.
 *   흡인 속도도 같이 올려야 오브가 플레이어를 따라잡는다(200 > 87.5, 여유 2.3배).
 */
const ORB_MAGNET = 48 * TEMPO_SCALE;          // 60px (정본 48 x 템포)
const ORB_MAGNET2 = ORB_MAGNET * ORB_MAGNET;
const ORB_PICKUP = 6 * TEMPO_SCALE;           // 7.5px — 한 프레임에 뛰어넘지 않을 크기
const ORB_PICKUP2 = ORB_PICKUP * ORB_PICKUP;
const ORB_PULL_SPEED = 160 * TEMPO_SCALE;     // 200px/s

const ORB_MERGE_THRESHOLD = 200; // 이 수를 넘으면 병합한다 (T302)
const ORB_MERGE_CELL = 24;       // 병합 격자 크기(px). 시각적으로 겹쳐 보이는 거리

export class CombatSystem {
    constructor(scene, player, spawn, playerSystem, stats, pact) {
        this.scene = scene;
        this.player = player;
        this.spawn = spawn;
        this.playerSystem = playerSystem;
        this.stats = stats;
        this.pact = pact;

        this.hash = new SpatialHash(64);
        this.queryBuf = [];
        this.damageQueue = [];

        this.hp = stats.get("maxHp");
        this.exp = 0;
        this.level = 1;
        this.hurtUntil = 0;
        this.dead = false;
        this.godMode = false;
        this.gold = 0;
        this.ascended = false;  // T511 완전 흡혈귀화 — 한 런에 한 번만 발동한다
        /** @type {import("./AwakeningSystem").AwakeningSystem|null} 각성. GameScene이 주입한다 */
        this.awakening = null;
        /** @type {any} 연출. 없으면 조용히 건너뛴다 — 전투 로직이 연출에 의존하면 안 된다 */
        this.fx = null;
        /** @type {import("./ProjectileSystem").ProjectileSystem|null} 스프라이트 투사체. GameScene 이 주입한다 */
        this.projectiles = null;
        /** @type {import("./ItemSystem").ItemSystem|null} 아이템. GameScene 이 주입한다 */
        this.items = null;
        /** @type {import("./RuneSystem").RuneSystem|null} 룬. GameScene 이 주입한다.
         *  ★ null 이어도 게임은 그대로 굴러간다 — 룬은 조우에서만 들어오고, 조우는 아직 없을 수 있다.
         *    그래서 훅은 전부 옵셔널 체이닝이고 mods 는 무기 인스턴스가 스스로 항등원을 들고 있다. */
        this.runes = null;
        /**
         * 「눈먼 예언자」 미리보기 (30 §3.3). EncounterSystem 이 다음 레벨의 카드 3장을
         * 미리 뽑아 여기 심어 두고, 아래 checkLevelUp 이 그것을 **그대로** 쓴다.
         * ★ 따로 뽑아 보여주기만 하면 예언이 아니라 거짓말이 된다 — 실제로 나오는 카드와
         *   다른 3장을 보고 "다음에 W2 강화가 있으니 지금 마녀에게 W2 룬을 산다"는 계획을
         *   세우게 되기 때문이다. 그 계획이 배신당하면 조우 전체의 신뢰가 무너진다.
         * ★ nocturneLine 도 함께 보관한다. 카드와 대사는 같은 generate() 가 함께 만든 짝이라
         *   따로 두면 미리 본 카드에 엉뚱한 대사가 붙는다.
         */
        this.previewCards = null;
        this.previewLine = null;

        /**
         * 무기 레지스트리. id -> { def, level, s(=현재 레벨 수치), timer }
         * ★ 하드코딩된 w1/w2 필드를 쓰지 않는 이유: 축복으로 무기를 새로 얻을 수 있고
         *   (W3/W4), 레벨업 시 수치 전체가 교체된다. 필드 이름에 무기를 묶으면
         *   무기 하나 추가할 때마다 update 루프를 고쳐야 한다.
         */
        this.wdef = Object.fromEntries(weaponsData.weapons.map((w) => [w.id, w]));
        this.weapons = {};
        this.weaponList = [];
        this.addWeapon("W1", 1);
        this.addWeapon("W2", 1);

        this.projectilePool = new Pool(MAX_PROJECTILES, () => {
            const s = scene.add.circle(-999, -999, 3, 0xff8844);
            s.setDepth(DEPTH.PROJECTILE).setVisible(false);
            return s;
        });
        // 텍스처가 없으면(에셋 미빌드) 예전 청록 점으로 조용히 되돌아간다.
        // 오브가 아예 안 보이는 것보다 못생긴 게 낫다 — W3/W4 아트와 같은 규약이다.
        this.orbArt = scene.textures.exists(ORB_ATLAS) && !!scene.textures.get(ORB_ATLAS)?.has(ORB_FRAME);
        this.orbs = new Pool(MAX_ORBS, () => {
            const s = this.orbArt
                ? scene.add.sprite(-999, -999, ORB_ATLAS, ORB_FRAME).setScale(ORB_SCALE)
                : scene.add.circle(-999, -999, 2, 0x35c9b4);
            s.setDepth(DEPTH.ORB).setVisible(false);
            return s;
        });

        // ── W3 뼈 회오리: 유골 스프라이트는 미리 5개 만들어 두고 보이기/숨기기만 한다
        this.orbitBones = [];
        this.orbitArt = scene.textures.exists(W3_SHEET);
        for (let i = 0; i < MAX_ORBIT; i++) {
            const b = this.orbitArt
                ? scene.add.sprite(-999, -999, W3_SHEET, 0)
                : scene.add.circle(-999, -999, 4, 0xe8e0d0);
            b.setDepth(DEPTH.PROJECTILE).setVisible(false);
            this.orbitBones.push(b);
        }
        if (this.orbitArt) {
            // 유골은 궤도를 도는 내내 회전한다. 프레임 애니메이션 + 스프라이트 자체 회전을
            // 함께 쓰면 축이 두 개가 되어 어지럽다 — 애니메이션만 쓰고 rotation 은 건드리지 않는다.
            const key = W3_SHEET + ".spin";
            if (!scene.anims.exists(key)) {
                scene.anims.create({
                    key, frames: scene.anims.generateFrameNumbers(W3_SHEET, { start: 0, end: 3 }),
                    frameRate: 16, repeat: -1,
                });
            }
            for (const b of this.orbitBones) b.play(key);
        }
        // 재타격 쿨은 적별로 관리한다. 적 객체에 직접 시간을 박으면 풀 재사용 시
        // 죽었다 살아난 적이 공짜 무적을 얻는다.
        this.orbitHit = new Map();
        this.orbitSweep = 0;

        // ── W4 성수 낙하: 장판 풀
        // 장판은 바닥 면적이라 채움(원)이 필요하고, 테두리는 링 아트가 훨씬 잘 읽힌다.
        // 둘을 1:1 고정 짝으로 묶는다 — 매번 짝을 찾으면 그것도 비용이다.
        this.zoneArt = scene.textures.exists(W4_SHEET);
        this.zoneRings = [];
        for (let i = 0; i < MAX_ZONES; i++) {
            const r = this.zoneArt ? scene.add.sprite(-999, -999, W4_SHEET, 0) : null;
            r?.setDepth(DEPTH.FX + 1).setVisible(false).setAlpha(0.85);
            this.zoneRings.push(r);
        }
        if (this.zoneArt) {
            const key = W4_SHEET + ".pulse";
            if (!scene.anims.exists(key)) {
                scene.anims.create({
                    key, frames: scene.anims.generateFrameNumbers(W4_SHEET, { start: 0, end: 3 }),
                    frameRate: 10, repeat: -1,
                });
            }
        }
        this.zones = new Pool(MAX_ZONES, (i) => {
            const g = scene.add.circle(-999, -999, 30, 0xdfd08a, 0.22);
            if (!this.zoneArt) g.setStrokeStyle(1, 0xf4e9b8, 0.5);
            g.setDepth(DEPTH.FX).setVisible(false);
            g.__ring = this.zoneRings[i];
            return g;
        });

        this.arcFx = scene.add.graphics().setDepth(DEPTH.FX);
        /**
         * 참격 띠를 그릴 점 배열. 길이가 고정이라 매 프레임 x/y 만 덮어쓴다.
         * ★ Phaser Graphics 의 arc() 로 "구멍 뚫린 고리"를 만들 수 없다 — 바깥 호와 안쪽 호를
         *   이어 붙이면 하위 경로가 하나로 합쳐져 fillStyle 이 안 먹고 흰 덩어리가 나온다.
         *   실측으로 확인했다. 그래서 점을 직접 찍어 fillPoints 로 채운다.
         */
        this.arcPts = [];
        for (let i = 0; i < ARC_FX_SEG * 2; i++) this.arcPts.push({ x: 0, y: 0 });
        this.arcFxUntil = 0;
        this.arcBase = 0;
        this.arcHalf = 0;
        this.arcRadius = 0;
    }

    get maxHp() { return this.stats.get("maxHp"); }

    /** EXP 곡선 — floor(5 + lv*4 + lv^1.55). 정본 03-GDD 5 */
    get expToNext() { const lv = this.level; return Math.floor(5 + lv * 4 + Math.pow(lv, 1.55)); }

    get invulnerable() {
        return this.godMode || this.scene.time.now < this.hurtUntil || !!this.playerSystem?.invulnerable;
    }

    update(dt) {
        if (this.dead) return;
        this.fireWeapons(dt);
        this.moveProjectiles(dt);
        this.rebuildHash();
        this.projectileHits();
        this.updateOrbit(dt);
        this.updateZones(dt);
        this.runes?.update(dt); // 시간축 룬(정화 슬로우 / 뼈 사출). 룬이 없으면 즉시 반환한다
        this.contactDamage();
        this.flushDamage();
        this.awakening?.update(dt);
        this.updateVitals(dt);
        this.updateOrbs(dt);
        this.drawArcFx();
    }

    rebuildHash() {
        this.hash.clear();
        const list = this.spawn.enemies;
        for (let i = 0; i < list.length; i++) this.hash.insert(list[i]);
    }

    /**
     * 무기 획득 / 레벨업. 축복 op:"weapon" 이 target 무기를 1레벨 올린다.
     * 아직 없는 무기면 Lv1로 새로 얻는다 — 이것이 빌드 다양성의 축이다.
     */
    addWeapon(id, level = 1) {
        const def = this.wdef[id];
        if (!def) return null;
        const lv = Math.max(1, Math.min(level, def.maxLevel));
        let w = this.weapons[id];
        if (!w) {
            // ★ 룬 슬롯과 mods 를 여기서 만든다 (31 §5.1).
            //   w.s 는 weapons.json 에서 import 한 **객체 그 자체**라 읽기 전용이다.
            //   룬이 거기에 쓰면 JSON 원본이 오염되어 다음 런까지 남는다(검증 R-1).
            //   그래서 룬의 결과는 전부 mods / specials / shot 으로만 흐른다.
            w = this.weapons[id] = {
                id, type: def.type, level: 0, timer: 0, angle: 0,
                runes: { t1: null, t2: null, t3: null },
                mods: emptyMods(),  // 룬이 없을 때의 항등원. 발사 코드가 분기 없이 곱할 수 있다
                specials: {},       // special id -> params (RuneSystem 이 채운다)
                shot: null,         // 투사체 per-shot 오버라이드 (유도/작렬/연쇄)
                riposte: 0,         // 「되받아치기」 다음 쿨 감산 비율
                sanctZone: null,    // 「성역」이 붙들고 있는 장판 하나
            };
            this.weaponList.push(w);
        }
        w.level = lv;
        w.s = def.levels[lv - 1];
        if (def.type === "orbit") this.syncOrbit(w);
        this.runes?.emitSnapshot(); // 조망(일시정지 화면)이 무기 레벨을 따라오게 한다
        return w;
    }

    fireWeapons(dt) {
        const haste = this.stats.get("haste");
        for (const w of this.weaponList) {
            switch (w.type) {
                case "melee_arc":
                    w.timer -= dt * haste;
                    // ★ 베고 나서 쿨을 매긴다 — 룬 「되받아치기」가 "이번에 몇을 벴는가"로
                    //   **다음** 쿨을 정하기 때문이다. 순서를 뒤집으면 한 박자 늦게 적용된다.
                    if (w.timer <= 0) {
                        this.fireArc(w);
                        w.timer += w.s.cooldown * w.mods.cdMul * (1 - w.riposte);
                    }
                    break;
                case "projectile":
                    w.timer -= dt * haste;
                    if (w.timer <= 0) { w.timer += w.s.cooldown * w.mods.cdMul; this.fireProjectile(w); }
                    break;
                case "zone":
                    w.timer -= dt * haste;
                    if (w.timer <= 0) { w.timer += w.s.cooldown * w.mods.cdMul; this.dropZones(w); }
                    break;
                // orbit 은 쿨다운이 없다 — updateOrbit 이 매 프레임 처리한다
            }
        }
    }

    /** W1 피의 송곳니 — 바라보는 방향 부채꼴. 범위 내 전원 타격(관통 무한) */
    fireArc(wp) {
        const w = wp.s;
        const m = wp.mods;
        const facing = this.playerSystem?.facing ?? "down";
        // 무기를 휘두르는 모션. facing 을 읽은 **뒤**에 부른다 — playAttack 이 그 시점의
        // facing 으로 모션 방향을 고정하므로, 판정 부채꼴과 그림이 같은 방향을 본다.
        this.playerSystem?.playAttack();
        const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[facing];
        // 룬 「선혈의 원」 — half 가 PI 면 어떤 각도든 통과한다. 조준이 사라진다.
        // 「벌어진 아가리」는 각도를 넓히되 360도를 넘지 못하게 자른다(넘으면 부채꼴이 겹쳐 그려진다).
        const half = this.runes?.isFullCircle(wp)
            ? Math.PI
            : Math.min(Math.PI, Phaser.Math.DegToRad(w.arcDeg * m.arcMul) / 2);
        const radius = w.radius * m.radiusMul * this.stats.get("area");
        const r2 = radius * radius;

        const cands = this.hash.query(this.player.x, this.player.y, radius, this.queryBuf);
        let hit = 0;
        for (const e of cands) {
            if (dist2(e.x, e.y, this.player.x, this.player.y) > r2) continue;
            const a = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            if (Math.abs(Phaser.Math.Angle.Wrap(a - base)) > half) continue;
            this.queueDamage(e, w.damage * this.stats.get("damage"), w.knockback * this.stats.get("knockback"), wp);
            hit++;
        }
        // Lv4+ 처치 시 20% 확률로 쿨 즉시 리셋. 실제 처치 여부는 flushDamage 가 판정하므로
        // 여기서는 "때린 대상이 있었는가"만 보고 killReset 플래그를 세워 둔다.
        wp.pendingReset = hit > 0 && !!w.resetChance;
        // 룬 훅 — 「되받아치기」(다음 쿨 감산) / 「참격 파동」(전방 관통 투사체)
        wp.riposte = this.runes?.riposteFor(wp, hit) ?? 0;
        this.runes?.onArcFired(wp, base);
        this.arcBase = base;
        this.arcHalf = half;
        this.arcRadius = radius;
        this.arcFxUntil = this.scene.time.now + ARC_FX_MS;
        this.scene.audio?.sfx("slash");
    }

    /** W2 화염탄 — 사거리 내 최근접 적 자동조준 */
    fireProjectile(wp) {
        const w = wp.s;
        const m = wp.mods;
        const range = w.range * this.stats.get("range");
        const cands = this.hash.query(this.player.x, this.player.y, range, this.queryBuf);
        let best = null, bestD = range * range;
        for (const e of cands) {
            const d = dist2(e.x, e.y, this.player.x, this.player.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) return;

        const a = Math.atan2(best.y - this.player.y, best.x - this.player.x);
        // Lv3~4 는 0.08s 간격 연사, Lv5 는 10도 부채꼴 동시 확산.
        // 같은 count 라도 연사는 이동 표적 추적에, 확산은 군중에 강하다.
        const count = w.count + m.countAdd;
        // ★ 룬 「쌍포」로 늘어난 탄은 확산도 연사도 없는 레벨(Lv1~2)에서 정확히 겹친다 —
        //   한 발처럼 보이고, 관통이 없으면 실제로 한 마리만 맞는다. 그때만 최소 확산을 준다.
        const spread = Phaser.Math.DegToRad(w.spreadDeg || (m.countAdd > 0 && !w.burstGap ? 8 : 0));
        for (let i = 0; i < count; i++) {
            const off = count > 1 && spread ? (i - (count - 1) / 2) * spread : 0;
            const delay = w.burstGap ? i * w.burstGap * 1000 : 0;
            if (delay > 0) this.scene.time.delayedCall(delay, () => this.spawnBullet(a + off, w, range, wp));
            else this.spawnBullet(a + off, w, range, wp);
        }
        // 룬 「유성우」 — 발사할 때마다 하늘에서 3발이 더 떨어진다
        this.runes?.onProjectileFired(wp, best);
    }

    spawnBullet(angle, w, range, wp = null) {
        if (this.dead) return;
        const dmg = w.damage * this.stats.get("damage");
        const kb = w.knockback * this.stats.get("knockback");
        const pierce = w.pierce + (wp?.mods.pierceAdd ?? 0);

        // ProjectileSystem 이 있으면 스프라이트 투사체를 쓴다.
        // ★ 수치는 여기서 이미 stats 를 곱해 넘긴다 — 저쪽에서 다시 곱하면 이중 적용이다.
        if (this.projectiles && w.projectile) {
            const opts = { damage: dmg, knockback: kb, speed: w.speed, range, pierce };
            // 룬 per-shot 오버라이드 (31 §5.2 (4)). 새길 때 미리 만들어 둔 객체를 **참조만** 넘긴다 —
            // 발사마다 만들면 초당 수십 개가 GC 대상이 되고 1% Low 부터 무너진다.
            const shot = wp?.shot;
            if (shot) {
                opts.homing = shot.homing; // 「불의 눈」
                opts.aoe = shot.aoe;       // 「작렬」
                opts.bounce = shot.bounce; // 「연쇄 화염」 — 탄을 만들지 않고 같은 탄을 꺾는다
            }
            this.projectiles.fire(w.projectile, this.player.x, this.player.y, angle, opts);
            return;
        }

        // 폴백 — 투사체 시스템이나 정의가 없으면 예전 원으로라도 쏜다.
        // 무기가 조용히 사라지는 것보다 못생긴 게 낫다.
        const p = this.projectilePool.obtain();
        if (!p) return;
        p.setPosition(this.player.x, this.player.y).setVisible(true);
        p.vx = Math.cos(angle) * w.speed;
        p.vy = Math.sin(angle) * w.speed;
        p.life = range / w.speed;
        p.pierce = pierce;
        p.damage = dmg;
        p.knockback = kb;
        if (!p.hitSet) p.hitSet = new Set();
        p.hitSet.clear();
    }

    moveProjectiles(dt) {
        const list = this.projectilePool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.releaseProjectile(p);
        }
    }

    releaseProjectile(p) {
        p.setVisible(false).setPosition(-999, -999);
        this.projectilePool.release(p);
    }

    projectileHits() {
        const list = this.projectilePool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            const cands = this.hash.query(p.x, p.y, 12, this.queryBuf);
            for (const e of cands) {
                if (p.hitSet.has(e)) continue;
                const rr = (e.radius + 3) * (e.radius + 3);
                if (dist2(p.x, p.y, e.x, e.y) > rr) continue;
                p.hitSet.add(e);
                this.queueDamage(e, p.damage, p.knockback);
                if (p.pierce-- <= 0) { this.releaseProjectile(p); break; }
            }
        }
    }

    // ── 데미지
    queueDamage(enemy, amount, knockback, src = null) {
        this.damageQueue.push({ e: enemy, amount, knockback, src });
    }

    /** 큐를 한 번에 처리 — 같은 적이 여러 소스에서 맞아도 사망은 1회다 */
    flushDamage() {
        const crit = this.stats.get("crit");
        const critMult = this.stats.get("critMult");
        for (const d of this.damageQueue) {
            const e = d.e;
            if (!e.__active || e.hp <= 0) continue;
            // 치명타는 큐를 비울 때 한 번만 굴린다 — 무기별로 굴리면 판정이 흩어진다
            const isCrit = crit > 0 && Math.random() < crit;
            if (isCrit) this.awakening?.onCrit(e, d.amount * critMult);
            e.hp -= isCrit ? d.amount * critMult : d.amount;

            // 피격 플래시 60ms (T213). 치명타는 금색으로 구분한다.
            // ★ 매 피격마다 delayedCall 을 만들면 TimerEvent 와 클로저가 초당 수백 개 쌓인다.
            //   평균 fps 는 멀쩡한데 1% Low 만 무너지는 전형적 원인이다(T622).
            //   FxSystem 이 링버퍼로 만료를 관리한다 — 할당이 0이다.
            if (this.fx) this.fx.hitFlash(e, isCrit);
            else e.setTintFill(isCrit ? 0xffd24a : 0xffffff);
            this.fx?.damageNumber(e.x, e.y, isCrit ? d.amount * critMult : d.amount, isCrit);
            if (isCrit) this.fx?.hitStop(30); // 09-ART 7.2. 저사양이면 FxSystem 이 알아서 건너뛴다

            if (d.knockback) {
                const dx = e.x - this.player.x, dy = e.y - this.player.y;
                const m = Math.hypot(dx, dy) || 1;
                const k = d.knockback * (1 - (e.knockbackResist ?? 0)) * 6;
                e.kbx = (dx / m) * k;
                e.kby = (dy / m) * k;
            }

            if (e.hp <= 0) {
                // W1 Lv4+ — 처치 시 20% 확률로 쿨 즉시 리셋. "처치했을 때만" 이므로
                // 발사 시점이 아니라 사망 확정 시점에 판정한다.
                const src = d.src;
                if (src && src.pendingReset && Math.random() < (src.s.resetChance ?? 0)) src.timer = 0;
                this.orbitHit.delete(e);
                this.awakening?.onKill(e);
                this.runes?.onKill(e, src); // 룬 「피 빨기」 — 그 무기가 낸 처치일 때만 회복한다
                this.items?.rollDrop(e);
                this.fx?.killBurst(e.x, e.y);
                this.gold += (e.goldValue ?? 1) * this.stats.get("goldMult");
                const leech = this.stats.get("lifeOnKill");
                if (leech > 0) this.hp = Math.min(this.maxHp, this.hp + leech);
                this.dropOrb(e.x, e.y, e.expValue);
                this.spawn.kill(e, true);
            }
        }
        this.damageQueue.length = 0;
    }

    /** 적 접촉 데미지 + 무적프레임 0.4s (T212) */
    contactDamage() {
        if (this.invulnerable) return;
        const cands = this.hash.query(this.player.x, this.player.y, 20, this.queryBuf);
        for (const e of cands) {
            const rr = (e.radius + 7) * (e.radius + 7);
            if (dist2(e.x, e.y, this.player.x, this.player.y) > rr) continue;
            this.hurt(e.damage);
            return;
        }
    }

    hurt(amount) {
        // 방어율은 상한 60%(S1). 100%가 되면 후반 적 강화가 통째로 무의미해진다.
        let taken = amount * (1 - this.stats.get("armor"));
        // 각성이 피해를 가로챌 수 있다 (불사의 껍질 = 1회 부활, 저HP 보너스 등)
        const replaced = this.awakening?.onHurt(taken);
        if (typeof replaced === "number") taken = replaced;
        // 유물도 같은 계약으로 피해를 가로챈다 (「멈춘 모래시계」 = 치명상 1회 방어).
        // ★ 각성 **다음**에 두는 이유: 「불사의 껍질」이 이미 살렸으면 모래시계는 굴리지
        //   않아야 한다. 런당 1회짜리 자원 두 개를 같은 피격에 동시에 태우면 안 된다.
        const byItem = this.items?.onHurt(taken);
        if (typeof byItem === "number") taken = byItem;
        this.hp = Math.max(0, this.hp - taken);
        this.hurtUntil = this.scene.time.now + PLAYER_IFRAME * this.stats.get("iframe");
        // 흔들림을 여기서 직접 하면 "화면 흔들림 OFF" 접근성 옵션이 무시된다(13-QA UI-03).
        // FxSystem 이 옵션을 보고 흔들지 말지 결정한다.
        if (this.fx) this.fx.hitFlash(this.player, false);
        else { this.player.setTintFill(0xffffff); this.scene.time.delayedCall(60, () => this.player.clearTint()); }
        if (this.fx) this.fx.playerHurt();
        else this.scene.cameras.main.shake(90, 0.004);
        if (this.hp <= 0) this.die();
    }

    die() {
        this.dead = true;
        // ★ 조건을 만족하면 RUN_ENDED 를 보류하고 결정을 기다린다.
        //   어떤 실패·무응답이든 8초 안에 endRunDead() 로 떨어진다 —
        //   광고는 보상을 줄 수는 있어도 진행을 막아서는 안 된다.
        if (this.tryOfferRevive()) return;
        this.endRunDead();
    }

    /** @returns {boolean} 제안을 띄웠으면 true */
    tryOfferRevive() {
        if (this.reviveOffered) return false;            // 런당 1회
        // ★ 각성 「불사의 껍질」과 카운터를 공유한다. 나누면 한 런에 두 번 살아난다.
        if (this.awakening?.reviveUsed) return false;
        let p = null;
        try { p = resolveAdPlacement("revive"); } catch { p = null; }
        if (!p?.ready) return false;
        const cost = p.cost?.humanity ?? 0;
        if ((this.pact?.humanity ?? 0) < cost) return false;

        this.reviveOffered = true;
        this.scene.scene.pause();
        this.reviveTimer = setTimeout(() => this.resolveRevive(false), 8000);
        EventBus.emit(EVENTS.REVIVE_OFFER, {
            humanityCost: cost, humanity: this.pact?.humanity ?? 0,
            hpPct: p.reward?.hpPct ?? 0.5, timeoutMs: 8000,
        });
        return true;
    }

    /**
     * CMD_REVIVE 응답. 두 번 불려도 안전하다.
     *
     * ★ 「광고 보고 부활」은 **광고를 실제로 튼 다음**에 살린다 (2026-08-12 수정).
     *   고치기 전에는 수락과 동시에 인간성만 깎고 그 자리에서 부활했다 — 광고는 한 번도
     *   재생되지 않았고(showRewarded 호출부가 없었다), 그래서
     *     · 버튼 문구 「광고 보고 부활」이 거짓말이 되고,
     *     · ads.revive.perRun 상한과 일일 노출 집계가 영원히 0 이며,
     *     · ad_request / ad_rewarded 텔레메트리에 revive 가 통째로 빠진다.
     *   실측(웹 dev, 2026-08-12): 부활 성공 후 caps.perDay={} / runCounts={} 였다.
     * ★ 8초 무응답 타임아웃은 「답을 안 했다」를 위한 것이다. 사용자가 눌렀으면 그 순간
     *   끝난다 — 안 그러면 광고를 끝까지 보고 온 사람이 그 사이 타임아웃으로 죽는다.
     * ★ 광고 실패는 "보상 없음"이지 "진행 불가"가 아니다(20-MONETIZATION). 실패·거부·
     *   미준비는 전부 거절과 같게 endRunDead() 로 떨어진다. 절대 멈춘 채로 남지 않는다.
     */
    resolveRevive(accepted) {
        if (!this.reviveOffered || this.reviveDone || this.reviveShowing) return;
        // 사용자가 답했다 — 무응답 타임아웃은 여기서 역할이 끝난다.
        clearTimeout(this.reviveTimer);
        this.reviveTimer = null;
        if (!accepted) { this.reviveDone = true; this.endRunDead(); return; }

        this.reviveShowing = true;
        showRewarded("revive")
            .then((r) => this.finishRevive(Boolean(r?.rewarded)))
            .catch(() => this.finishRevive(false));
    }

    /** 광고 결과가 나온 뒤의 실제 부활 처리. rewarded=false 면 거절과 같다. */
    finishRevive(rewarded) {
        this.reviveShowing = false;
        if (this.reviveDone) return;
        this.reviveDone = true;
        if (!rewarded) { this.endRunDead(); return; }

        let p = null;
        try { p = resolveAdPlacement("revive"); } catch { p = null; }
        const cost = p?.cost?.humanity ?? 0;
        // PactSystem 이 자기 안에서 쓰는 것과 같은 방식이다(직접 대입 + 0 하한)
        if (this.pact) this.pact.humanity = Math.max(0, (this.pact.humanity ?? 0) - cost);
        this.hp = Math.max(1, Math.floor(this.maxHp * (p?.reward?.hpPct ?? 0.5)));
        this.hurtUntil = this.scene.time.now + (p?.reward?.invulnSec ?? 2) * 1000;
        this.dead = false;
        this.scene.scene.resume();
        EventBus.emit(EVENTS.RUN_RESUMED, {});
        if ((this.pact?.humanity ?? 1) <= 0 && !this.ascended) {
            this.ascended = true;
            EventBus.emit(EVENTS.HUMANITY_ZERO, { humanity: 0 });
            this.awakening?.triggerAscension?.();
        }
    }

    endRunDead() {
        this.dead = true;
        EventBus.emit(EVENTS.RUN_ENDED, {
            reason: "death",
            time: Math.floor(this.spawn.elapsed),
            kills: this.spawn.killCount,
            level: this.level,
            gold: Math.floor(this.gold),
            awakenings: this.awakening ? [...this.awakening.list] : [],
            humanity: this.pact?.humanity ?? 100,
            stageId: this.scene.stages?.current?.id ?? null,
        });
    }

    // ── EXP 오브
    dropOrb(x, y, value) {
        const o = this.orbs.obtain();
        if (!o) return;
        o.setPosition(x, y).setVisible(true);
        o.value = value;
    }

    /**
     * 오브가 너무 많으면 근접한 것끼리 합친다. (T302)
     *
     * ★ 왜 필요한가: 오브는 자석 반경 밖에서는 그냥 서 있는다. 후반 페이즈에
     *   초당 20체가 죽는데 플레이어가 지나가지 않은 구역의 오브는 계속 쌓인다.
     *   300개를 넘기면 updateOrbs 의 거리 계산만으로 프레임을 갉아먹고,
     *   화면에는 청록 점이 뭉개진 얼룩으로 보인다.
     * ★ EXP 총량은 보존한다 — 병합으로 손해를 보면 플레이어가 알아채지 못하는
     *   방식으로 성장이 느려진다. 가장 나쁜 종류의 버그다.
     */
    mergeOrbs(dt) {
        // 0.5s 간격. 흩어져 있어 병합할 게 없는 상태에서도 임계를 넘으면
        // 매 프레임 Map을 새로 만들게 되므로 호출 자체를 눌러야 한다.
        this.mergeTimer = (this.mergeTimer ?? 0) - dt;
        if (this.mergeTimer > 0) return;
        this.mergeTimer = 0.5;
        const list = this.orbs.active;
        if (list.length <= ORB_MERGE_THRESHOLD) return;
        const cells = new Map();
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const key = ((o.x / ORB_MERGE_CELL) | 0) + "," + ((o.y / ORB_MERGE_CELL) | 0);
            const head = cells.get(key);
            if (!head) { cells.set(key, o); continue; }
            head.value += o.value;
            o.setVisible(false).setPosition(-999, -999);
            this.orbs.release(o);
        }
    }

    updateOrbs(dt) {
        this.mergeOrbs(dt);
        const list = this.orbs.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const d2 = dist2(o.x, o.y, this.player.x, this.player.y);
            if (d2 < ORB_PICKUP2) {
                this.exp += o.value * this.stats.get("expMult");
                o.setVisible(false).setPosition(-999, -999);
                this.orbs.release(o);
                this.scene.audio?.sfx("pickup");
                this.checkLevelUp();
                continue;
            }
            const magnet2 = ORB_MAGNET2 * this.stats.get("magnet") * this.stats.get("magnet");
            if (d2 < magnet2) {
                const d = Math.sqrt(d2) || 1;
                const sp = ORB_PULL_SPEED * dt;
                o.x += ((this.player.x - o.x) / d) * sp;
                o.y += ((this.player.y - o.y) / d) * sp;
            }
        }
    }

    /** 초당 회복(축복)과 감소(HUNGER 대가) */
    updateVitals(dt) {
        const regen = this.stats.get("regen");
        const drain = this.stats.get("drain");
        const net = (regen - drain) * dt;
        if (net === 0) return;
        this.hp = Math.min(this.maxHp, this.hp + net);
        // ★ 안전장치 S5 — HUNGER 드레인만으로는 죽지 않는다 (04-PACT 6)
        if (this.hp < 1 && drain > regen) this.hp = 1;
        else if (this.hp <= 0) this.die();
    }

    checkLevelUp() {
        if (this.exp < this.expToNext) return;
        this.exp -= this.expToNext;
        this.level++;
        // 예언자가 미리 보여준 3장이 있으면 그것이 이번 레벨업의 카드다(30 §3.3)
        const cards = this.previewCards ?? this.pact.generate(this.level);
        const line = this.previewCards ? this.previewLine : this.pact.lastLine;
        this.previewCards = null;
        this.previewLine = null;
        this.pendingCards = cards;
        // 카드가 뜨는 동안 게임을 멈춘다 (T304)
        this.scene.scene.pause();
        EventBus.emit(EVENTS.RUN_LEVELUP, {
            level: this.level,
            cards,
            nocturneLine: line,
            canSkip: true,
            humanity: this.pact.humanity,
            rerollLeft: this.pact.rerollLeft,
        });
    }

    /** T540 리롤 — 3장 전체 재생성. 응답도 RUN_LEVELUP 으로 보낸다(브릿지가 이미 처리한다) */
    rerollCards() {
        if (!this.pendingCards) return;          // 카드가 안 떠 있으면 무시
        if (!this.pact.consumeReroll()) return;  // 남은 횟수 0 — 버튼이 이미 disabled 다
        const cards = this.pact.generate(this.level);
        this.pendingCards = cards;
        EventBus.emit(EVENTS.RUN_LEVELUP, {
            level: this.level, cards,
            nocturneLine: this.pact.lastLine, canSkip: true,
            humanity: this.pact.humanity, rerollLeft: this.pact.rerollLeft,
        });
    }

    /** 중도 포기. 골드는 획득한 만큼 그대로 준다 — 모바일이므로 관대하게(정본 03-GDD 12) */
    abandon() {
        if (this.dead) return;
        this.dead = true;
        EventBus.emit(EVENTS.RUN_ENDED, {
            reason: "abandon",
            time: Math.floor(this.spawn.elapsed), kills: this.spawn.killCount,
            level: this.level, gold: Math.floor(this.gold),
            awakenings: this.awakening ? [...this.awakening.list] : [],
            humanity: this.pact?.humanity ?? 100,
            stageId: this.scene.stages?.current?.id ?? null,
        });
        this.scene.scene.resume(); // 카드가 떠 있는 상태에서 포기하면 pause 가 남는다
    }

    /** React에서 카드를 고르면 호출된다 */
    applyCard(index) {
        const cards = this.pendingCards;
        const card = cards?.[index];
        if (card) {
            const r = this.pact.choose(card);
            if (r.weapon) this.addWeapon(r.weapon.target, r.weapon.level);
            this.hp = Math.min(this.hp, this.maxHp);
            EventBus.emit(EVENTS.PACT_APPLIED, {
                level: this.level, humanity: r.humanity, tagCounts: r.tagCounts,
                ownedBlessings: { ...this.pact.owned },
            });
            if (r.awakened && this.awakening?.trigger(r.awakened)) {
                const def = this.awakening.defs?.[r.awakened];
                EventBus.emit(EVENTS.AWAKENING_TRIGGERED, {
                    tag: r.awakened,
                    list: [...this.awakening.list],
                    awakeningId: def?.id,
                    name: def?.name,
                    quote: def?.quote,
                    desc: def?.desc,
                    sigil: def?.sigil,
                    atLevel: this.level,
                });
            }

            // T511 — 인간성 0 「완전 흡혈귀화」. 여기서만 쏜다(스킵으로는 인간성이 줄지 않는다).
            // ★ r.humanity 가 아니라 pact.humanity 를 본다 (2026-08-12 수정).
            //   r 은 choose() 시점의 스냅샷이라 그 위에서 일어난 감소를 모른다. 바로 위
            //   awakening.trigger() 가 상한 초과에서 overflow() 를 타고 인간성을 −20 하는데,
            //   그 −20 으로 0 이 되면 r.humanity 는 아직 양수라 「완전 흡혈귀화」가 조용히 빠진다.
            //   실측: 각성 2개 + 인간성 15 에서 Common 카드(−3)로 세 번째 태그 3중첩 →
            //   인간성 0 인데 ascended=false 였다. 04-PACT §8 이 잡아 둔 표준 런
            //   (총 −97.5 에 상한 초과 −20 포함)이 정확히 이 경로라 예외가 아니라 기본값에 가깝다.
            //   EncounterSystem.afterPact 도 살아 있는 pact.humanity 를 본다 — 두 문이 같아야 한다.
            if ((this.pact?.humanity ?? r.humanity) <= 0 && !this.ascended) {
                this.ascended = true;
                EventBus.emit(EVENTS.HUMANITY_ZERO, { humanity: 0 });
                this.awakening?.triggerAscension?.();
            }
        } else if (cards) {
            if (index < 0) {
                // T541 스킵 — HP 25% 회복 + 골드 30. 인간성 감소가 없는 유일한 선택지이자
                // 후반 인간성 관리의 유일한 수단이다(04-PACT 6.2).
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
                this.gold += 30;
            }
            // ★ 카드를 화면에서 내리는 신호는 PACT_APPLIED **하나뿐**이다(bridge:pact-applied).
            //   축복을 고른 경로에서만 쏘고 있어서, 「거절」을 누르면 씬은 resume 되는데
            //   카드 3장은 화면에 그대로 남아 조작이 통째로 막혔다. 실측: 거절 직후
            //   paused=false 인데 .pact-stage 가 DOM 에 남고 다음 레벨업까지 사라지지 않는다.
            //   범위 밖 index(늦게 들어온 연타 등)도 같은 자리에서 닫아 준다.
            //   스킵은 인간성·대가를 건드리지 않으므로 지금 값을 그대로 실어 보낸다 — 멱등하다.
            EventBus.emit(EVENTS.PACT_APPLIED, {
                level: this.level,
                humanity: this.pact?.humanity ?? 100,
                tagCounts: { ...(this.pact?.tagCounts ?? {}) },
                ownedBlessings: { ...(this.pact?.owned ?? {}) },
            });
        }
        this.pendingCards = null;
        this.scene.scene.resume();
    }

    // ── W3 뼈 회오리 ────────────────────────────────────────────
    /** 유골 크기를 레벨에 맞춘다.
     *  ★ 표시 **개수**는 updateOrbit 이 매 프레임 정한다 — 룬 「더 많은 뼈」/「역회전」/「뼈 사출」이
     *    개수를 프레임 단위로 바꾸므로, 한곳에서만 정해야 유령 뼈가 남지 않는다. */
    syncOrbit(wp) {
        if (!this.orbitArt) return;
        // 레벨이 오르면 유골도 커진다 — 수치가 올랐다는 것을 눈으로 알 수 있어야 한다
        const s = 0.8 + wp.level * 0.08;
        for (let i = 0; i < MAX_ORBIT; i++) this.orbitBones[i].setScale(s);
    }

    /**
     * 상시 발동. 쿨다운이 없는 대신 "같은 적 재타격 쿨"이 단일 대상 DPS의 상한이다.
     * ★ haste 는 재타격 쿨만 나눈다. 회전 속도까지 올리면 화면이 어지러워진다(05-COMBAT 2.3).
     */
    updateOrbit(dt) {
        const wp = this.weapons.W3;
        if (!wp) return;
        const w = wp.s;
        const now = this.scene.time.now;
        wp.angle = (wp.angle + Phaser.Math.DegToRad(w.degPerSec) * dt) % (Math.PI * 2);

        const m = wp.mods;
        // 룬 「분쇄기」 — 반경이 2.4초 주기로 팽창·수축한다. 룬이 없으면 1이다
        const radius = w.radius * m.radiusMul * this.stats.get("area") * (this.runes?.orbitPulse(wp) ?? 1);
        const rehitMs = ((w.rehit * m.rehitMul) / this.stats.get("haste")) * 1000;
        const dmg = w.damage * this.stats.get("damage");
        const kb = w.knockback * this.stats.get("knockback");

        // 룬 「역회전」 — 겹이 둘이 되고 바깥 겹이 반대로 돈다. 겹당 유골 수는 같다.
        const counter = this.runes?.orbitCounter(wp) ?? null;
        const rings = counter ? 2 : 1;
        const per = Math.max(1, Math.min(MAX_ORBIT / rings, w.count + m.countAdd));
        const step = (Math.PI * 2) / per;
        // 룬 「뼈 사출」로 자리를 비운 유골. 비우지 않으면 뼈가 하나 늘어난 것처럼 보인다
        const away = this.runes?.launchedIndex(wp) ?? -1;

        let idx = 0;
        for (let r = 0; r < rings; r++) {
            const rr0 = r === 0 ? radius : radius * (counter.outerRadiusMul ?? 1.55);
            // 바깥 겹은 각도를 반대로 돌리고 반 칸 어긋나게 둔다 — 안쪽과 겹쳐 보이지 않는다
            const spin = r === 0 ? wp.angle : -wp.angle + step / 2;
            for (let i = 0; i < per; i++, idx++) {
                const b = this.orbitBones[idx];
                if (idx === away) { if (b.visible) b.setVisible(false); continue; }
                if (!b.visible) b.setVisible(true);
                const a = spin + step * i;
                const bx = this.player.x + Math.cos(a) * rr0;
                const by = this.player.y + Math.sin(a) * rr0;
                b.setPosition(bx, by);

                const cands = this.hash.query(bx, by, 10, this.queryBuf);
                for (const e of cands) {
                    const rr = (e.radius + 5) * (e.radius + 5);
                    if (dist2(bx, by, e.x, e.y) > rr) continue;
                    if ((this.orbitHit.get(e) ?? 0) > now) continue;
                    this.orbitHit.set(e, now + rehitMs);
                    this.queueDamage(e, dmg, kb, wp);
                }
            }
        }
        // 안 쓰는 유골은 숨긴다. 룬으로 개수가 줄어드는 경우는 없지만 사출 중에는 한 칸이 빈다
        for (; idx < MAX_ORBIT; idx++) {
            const b = this.orbitBones[idx];
            if (b.visible) b.setVisible(false);
        }

        // 만료된 항목을 2초마다 청소한다. 매 프레임 전수 순회하면 적 150체에서 낭비다.
        this.orbitSweep -= dt;
        if (this.orbitSweep <= 0) {
            this.orbitSweep = 2;
            for (const [e, t] of this.orbitHit) if (t <= now || !e.__active) this.orbitHit.delete(e);
        }
    }

    // ── W4 성수 낙하 ────────────────────────────────────────────
    /** 플레이어 주위 산포 반경 안에 랜덤 낙하. 조준이 개입하지 않는 대신 단일 명중률이 낮다. */
    dropZones(wp) {
        const w = wp.s;
        const m = wp.mods;
        const radius = w.radius * m.radiusMul * this.stats.get("area");
        const dmg = w.damage * this.stats.get("damage");
        const life = w.duration * m.durationMul;

        // 룬 「성역」 — 장판이 하나로 합쳐지고 플레이어를 따라다닌다.
        // ★ 매번 새로 까는 대신 **같은 장판을 갱신**한다. 새로 깔면 쿨(2.6s)과 지속(1.8s)의
        //   차이만큼 성역이 사라지는 구간이 생겨 "따라다닌다"가 깜빡임이 된다.
        const sanct = this.runes?.sanctuary(wp);
        if (sanct) {
            const r = radius * (sanct.radiusMul ?? 1.8);
            let z = wp.sanctZone;
            if (!z || !z.__active) z = wp.sanctZone = this.zones.obtain();
            if (!z) return;
            this.armZone(z, this.player.x, this.player.y, r, dmg,
                Math.max(life, w.cooldown * m.cdMul + (sanct.minLifePad ?? 0.6)), w.tick, true);
            this.runes.onZoneDropped(wp, z);
            return;
        }

        const scatter = w.scatter * this.stats.get("range");
        const drops = w.drops + m.countAdd;
        for (let i = 0; i < drops; i++) {
            const z = this.zones.obtain();
            if (!z) break;
            const a = Math.random() * Math.PI * 2;
            const d = Math.sqrt(Math.random()) * scatter; // sqrt — 원 안에 고르게 뿌린다
            this.armZone(z, this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d,
                radius, dmg, life, w.tick, false);
            // 룬 「낙뢰」 — 장판이 생기는 순간 중심에 즉발 대형 피해가 떨어진다
            this.runes?.onZoneDropped(wp, z);
        }
    }

    /**
     * 장판 하나를 세팅한다. 룬 「성역」이 같은 장판을 반복 갱신하므로 한 곳으로 모았다 —
     * 두 벌로 쓰면 링 크기나 틱 초기화 중 하나가 반드시 어긋난다.
     */
    armZone(z, x, y, radius, damage, life, tick, follow) {
        z.setPosition(x, y).setRadius(radius).setVisible(true).setAlpha(0.22);
        const ring = z.__ring;
        const ringSize = radius * 2.2; // 링 원본이 24px 이므로 장판 지름에 맞춰 늘린다
        if (ring && ringSize <= RING_MAX_PX) {
            ring.setPosition(x, y).setVisible(true).setAlpha(0.85).setDisplaySize(ringSize, ringSize);
            ring.play(W4_SHEET + ".pulse", true);
            z.setStrokeStyle();
        } else {
            // 링을 접고 원 테두리로 반경을 알린다. 뭉개진 링보다 얇은 선이 회피 판단에 훨씬 낫다
            ring?.setVisible(false).setPosition(-999, -999);
            z.setStrokeStyle(1, 0xf4e9b8, 0.5);
        }
        z.zr2 = radius * radius;
        z.damage = damage;
        z.life = life;
        z.tickEvery = tick;
        z.tickTimer = 0; // 0 -> 진입 즉시 1틱
        z.follow = follow;
    }

    updateZones(dt) {
        const list = this.zones.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const z = list[i];
            // 룬 「성역」 — 장판이 플레이어를 따라다닌다
            if (z.follow) {
                z.setPosition(this.player.x, this.player.y);
                z.__ring?.setPosition(z.x, z.y);
            }
            z.tickTimer -= dt;
            if (z.tickTimer <= 0) {
                z.tickTimer += z.tickEvery;
                const cands = this.hash.query(z.x, z.y, Math.sqrt(z.zr2), this.queryBuf);
                for (const e of cands) {
                    if (dist2(z.x, z.y, e.x, e.y) > z.zr2) continue;
                    this.queueDamage(e, z.damage, 0);
                }
            }
            z.life -= dt;
            if (z.life <= 0) {
                z.setVisible(false).setPosition(-999, -999);
                z.__ring?.setVisible(false).setPosition(-999, -999);
                this.zones.release(z);
            } else {
                const a = Math.min(1, z.life);
                z.setAlpha(0.10 + 0.14 * a); // 사라질 때 옅어진다
                z.__ring?.setAlpha(0.35 + 0.5 * a);
            }
        }
    }

    /**
     * W1 참격 이펙트.
     *
     * ★ 예전에는 발밑부터 꽉 찬 파이 조각(alpha 0.18 고정)이었다. 플레이어 스프라이트가
     *   무기를 휘두르는 모션을 갖게 된 뒤로는(T850) 그 도형이 연출을 두 번 하는 셈이 되어
     *   과했고, 발밑까지 채워진 부채꼴은 벤 자국이 아니라 **바닥 데칼**로 읽혔다.
     *   지금은 셋을 바꿨다:
     *     1. 칼끝이 지나간 **바깥 띠**만 그린다 (안쪽 45% 를 비운다)
     *     2. 남은 시간에 비례해 **옅어진다** — 예전에는 상수 알파로 있다가 툭 사라졌다
     *     3. 바깥 호에 밝은 실선을 얹는다. 실루엣이 곧 "칼이 지나간 선"이다
     *   모션이 연출을 맡고, 이 도형은 **사거리를 알리는 역할만** 남는다.
     */
    drawArcFx() {
        const g = this.arcFx;
        g.clear();
        const left = this.arcFxUntil - this.scene.time.now;
        if (left <= 0) return;
        const t = Math.max(0, Math.min(1, left / ARC_FX_MS)); // 1 -> 0 으로 사그라든다
        const px = this.player.x;
        const py = this.player.y;
        const rOut = this.arcRadius;

        // ★ 룬 「선혈의 원」(반각 = PI). 예전에는 slice 로 그리려다 아무것도 안 그려졌다 —
        //   시작각과 끝각이 2PI 차이라 Phaser 가 각도를 감으면서 시작 == 끝이 되기 때문이다.
        //   여기서는 띠를 만들지 않고 옅은 원 + 바깥 테두리로 간다. 360도짜리 고리는
        //   자기 자신과 겹치는 다각형이라 fillPoints 로도 안전하게 못 채운다.
        if (this.arcHalf >= Math.PI - 1e-6) {
            g.fillStyle(ARC_FX_FILL, 0.08 * t);
            g.fillCircle(px, py, rOut);
            g.lineStyle(1.5, ARC_FX_EDGE, 0.5 * t);
            g.strokeCircle(px, py, rOut);
            return;
        }

        const a0 = this.arcBase - this.arcHalf;
        const a1 = this.arcBase + this.arcHalf;
        const step = (a1 - a0) / (ARC_FX_SEG - 1);
        const rIn = rOut * ARC_FX_INNER;
        const pts = this.arcPts;
        // 바깥 호를 정방향으로, 안쪽 호를 역방향으로 이어 붙이면 자기 자신과 겹치지 않는
        // 단순 다각형이 된다. fillPoints 는 이런 모양을 정확히 채운다.
        for (let i = 0; i < ARC_FX_SEG; i++) {
            const a = a0 + step * i;
            const c = Math.cos(a);
            const sn = Math.sin(a);
            const o = pts[i];
            o.x = px + c * rOut;
            o.y = py + sn * rOut;
            const b = a1 - step * i;
            const cb = Math.cos(b);
            const sb = Math.sin(b);
            const q = pts[ARC_FX_SEG + i];
            q.x = px + cb * rIn;
            q.y = py + sb * rIn;
        }
        g.fillStyle(ARC_FX_FILL, 0.12 * t);
        g.fillPoints(pts, true);
        // 바깥 호만 밝게 — 이 선이 "칼이 지나간 자리"다
        g.lineStyle(1.5, ARC_FX_EDGE, 0.5 * t);
        g.beginPath();
        g.arc(px, py, rOut, a0, a1, false);
        g.strokePath();
    }
}
