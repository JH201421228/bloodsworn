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
import weaponsData from "@/data/weapons.json";

const MAX_PROJECTILES = 200;
/** W3 유골 / W4 장판에 쓰는 투사체 아틀라스 시트. data/projectiles.json 의 키와 같아야 한다.
 *  ★ 텍스처가 없으면(에셋 미빌드) 예전 도형으로 조용히 되돌아간다 —
 *    무기가 안 보이는 것보다 못생긴 게 낫다. */
const W3_SHEET = "proj-shuriken-ash";
const W4_SHEET = "proj-spin-ash";
const MAX_ORBIT = 5;    // W3 유골 최대 수 (Lv5)
const MAX_ZONES = 12;   // W4 장판 최대 수 (Lv5 5곳 x 지속 1.8s / 쿨 2.6s)
const MAX_ORBS = 300;
const PLAYER_IFRAME = 400; // ms. 정본 05-COMBAT 1
const ORB_MAGNET2 = 48 * 48;
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
        this.orbs = new Pool(MAX_ORBS, () => {
            const s = scene.add.circle(-999, -999, 2, 0x35c9b4);
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
            w = this.weapons[id] = { id, type: def.type, level: 0, timer: 0, angle: 0 };
            this.weaponList.push(w);
        }
        w.level = lv;
        w.s = def.levels[lv - 1];
        if (def.type === "orbit") this.syncOrbit(w);
        return w;
    }

    fireWeapons(dt) {
        const haste = this.stats.get("haste");
        for (const w of this.weaponList) {
            switch (w.type) {
                case "melee_arc":
                    w.timer -= dt * haste;
                    if (w.timer <= 0) { w.timer += w.s.cooldown; this.fireArc(w); }
                    break;
                case "projectile":
                    w.timer -= dt * haste;
                    if (w.timer <= 0) { w.timer += w.s.cooldown; this.fireProjectile(w); }
                    break;
                case "zone":
                    w.timer -= dt * haste;
                    if (w.timer <= 0) { w.timer += w.s.cooldown; this.dropZones(w); }
                    break;
                // orbit 은 쿨다운이 없다 — updateOrbit 이 매 프레임 처리한다
            }
        }
    }

    /** W1 피의 송곳니 — 바라보는 방향 부채꼴. 범위 내 전원 타격(관통 무한) */
    fireArc(wp) {
        const w = wp.s;
        const facing = this.playerSystem?.facing ?? "down";
        const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[facing];
        const half = Phaser.Math.DegToRad(w.arcDeg) / 2;
        const radius = w.radius * this.stats.get("area");
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
        this.arcBase = base;
        this.arcHalf = half;
        this.arcRadius = radius;
        this.arcFxUntil = this.scene.time.now + 100;
        this.scene.audio?.sfx("slash");
    }

    /** W2 화염탄 — 사거리 내 최근접 적 자동조준 */
    fireProjectile(wp) {
        const w = wp.s;
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
        const spread = Phaser.Math.DegToRad(w.spreadDeg ?? 0);
        for (let i = 0; i < w.count; i++) {
            const off = w.count > 1 && spread ? (i - (w.count - 1) / 2) * spread : 0;
            const delay = w.burstGap ? i * w.burstGap * 1000 : 0;
            if (delay > 0) this.scene.time.delayedCall(delay, () => this.spawnBullet(a + off, w, range));
            else this.spawnBullet(a + off, w, range);
        }
    }

    spawnBullet(angle, w, range) {
        if (this.dead) return;
        const dmg = w.damage * this.stats.get("damage");
        const kb = w.knockback * this.stats.get("knockback");

        // ProjectileSystem 이 있으면 스프라이트 투사체를 쓴다.
        // ★ 수치는 여기서 이미 stats 를 곱해 넘긴다 — 저쪽에서 다시 곱하면 이중 적용이다.
        if (this.projectiles && w.projectile) {
            this.projectiles.fire(w.projectile, this.player.x, this.player.y, angle, {
                damage: dmg, knockback: kb, speed: w.speed, range, pierce: w.pierce,
            });
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
        p.pierce = w.pierce;
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
                this.items?.rollDrop(e);
                this.fx?.killBurst(e.x, e.y);
                this.gold += e.goldValue ?? 1;
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
        EventBus.emit(EVENTS.RUN_ENDED, {
            reason: "death",
            time: Math.floor(this.spawn.elapsed),
            kills: this.spawn.killCount,
            level: this.level,
            gold: Math.floor(this.gold),
            awakenings: this.awakening ? [...this.awakening.list] : [],
            humanity: this.pact?.humanity ?? 100,
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
            if (d2 < 36) {
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
                const sp = 160 * dt;
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
        const cards = this.pact.generate(this.level);
        this.pendingCards = cards;
        // 카드가 뜨는 동안 게임을 멈춘다 (T304)
        this.scene.scene.pause();
        EventBus.emit(EVENTS.RUN_LEVELUP, {
            level: this.level,
            cards,
            nocturneLine: this.pact.lastLine,
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
            if (r.humanity <= 0 && !this.ascended) {
                this.ascended = true;
                EventBus.emit(EVENTS.HUMANITY_ZERO, { humanity: 0 });
                this.awakening?.triggerAscension?.();
            }
        } else if (index < 0 && cards) {
            // T541 스킵 — HP 25% 회복 + 골드 30. 인간성 감소가 없는 유일한 선택지이자
            // 후반 인간성 관리의 유일한 수단이다(04-PACT 6.2).
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
            this.gold += 30;
        }
        this.pendingCards = null;
        this.scene.scene.resume();
    }

    // ── W3 뼈 회오리 ────────────────────────────────────────────
    /** 유골 개수가 바뀌면 스프라이트 표시 수를 맞춘다 */
    syncOrbit(wp) {
        for (let i = 0; i < MAX_ORBIT; i++) {
            const b = this.orbitBones[i];
            b.setVisible(i < wp.s.count);
            // 레벨이 오르면 유골도 커진다 — 수치가 올랐다는 것을 눈으로 알 수 있어야 한다
            if (this.orbitArt) b.setScale(0.8 + wp.level * 0.08);
        }
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

        const radius = w.radius * this.stats.get("area");
        const rehitMs = (w.rehit / this.stats.get("haste")) * 1000;
        const dmg = w.damage * this.stats.get("damage");
        const kb = w.knockback * this.stats.get("knockback");
        const step = (Math.PI * 2) / w.count;

        for (let i = 0; i < w.count; i++) {
            const a = wp.angle + step * i;
            const bx = this.player.x + Math.cos(a) * radius;
            const by = this.player.y + Math.sin(a) * radius;
            this.orbitBones[i].setPosition(bx, by);

            const cands = this.hash.query(bx, by, 10, this.queryBuf);
            for (const e of cands) {
                const rr = (e.radius + 5) * (e.radius + 5);
                if (dist2(bx, by, e.x, e.y) > rr) continue;
                if ((this.orbitHit.get(e) ?? 0) > now) continue;
                this.orbitHit.set(e, now + rehitMs);
                this.queueDamage(e, dmg, kb, wp);
            }
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
        const scatter = w.scatter * this.stats.get("range");
        const radius = w.radius * this.stats.get("area");
        for (let i = 0; i < w.drops; i++) {
            const z = this.zones.obtain();
            if (!z) break;
            const a = Math.random() * Math.PI * 2;
            const d = Math.sqrt(Math.random()) * scatter; // sqrt — 원 안에 고르게 뿌린다
            z.setPosition(this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d);
            z.setRadius(radius);
            z.setVisible(true).setAlpha(0.22);
            const ring = z.__ring;
            if (ring) {
                // 링 원본이 24px 이므로 장판 지름에 맞춰 늘린다
                ring.setPosition(z.x, z.y).setVisible(true).setAlpha(0.85)
                    .setDisplaySize(radius * 2.2, radius * 2.2);
                ring.play(W4_SHEET + ".pulse", true);
            }
            z.zr2 = radius * radius;
            z.damage = w.damage * this.stats.get("damage");
            z.life = w.duration;
            z.tickEvery = w.tick;
            z.tickTimer = 0; // 0 -> 진입 즉시 1틱
        }
    }

    updateZones(dt) {
        const list = this.zones.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const z = list[i];
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

    drawArcFx() {
        const g = this.arcFx;
        g.clear();
        if (this.scene.time.now > this.arcFxUntil) return;
        g.fillStyle(0xc4182b, 0.18);
        g.slice(this.player.x, this.player.y, this.arcRadius, this.arcBase - this.arcHalf, this.arcBase + this.arcHalf, false);
        g.fillPath();
    }
}
