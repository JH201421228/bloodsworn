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
const MAX_ORBS = 300;
const PLAYER_IFRAME = 400; // ms. 정본 05-COMBAT 1
const ORB_MAGNET2 = 48 * 48;

export class CombatSystem {
    constructor(scene, player, spawn, playerSystem) {
        this.scene = scene;
        this.player = player;
        this.spawn = spawn;
        this.playerSystem = playerSystem;

        this.hash = new SpatialHash(64);
        this.queryBuf = [];
        this.damageQueue = [];

        this.maxHp = 100; // 정본 03-GDD 4
        this.hp = this.maxHp;
        this.exp = 0;
        this.level = 1;
        this.hurtUntil = 0;
        this.dead = false;
        this.godMode = false;

        const W = Object.fromEntries(weaponsData.weapons.map((w) => [w.id, w.levels[0]]));
        this.w1 = { ...W.W1, timer: 0 };
        this.w2 = { ...W.W2, timer: 0 };

        this.projectiles = new Pool(MAX_PROJECTILES, () => {
            const s = scene.add.circle(-999, -999, 3, 0xff8844);
            s.setDepth(DEPTH.PROJECTILE).setVisible(false);
            return s;
        });
        this.orbs = new Pool(MAX_ORBS, () => {
            const s = scene.add.circle(-999, -999, 2, 0x35c9b4);
            s.setDepth(DEPTH.ORB).setVisible(false);
            return s;
        });

        this.arcFx = scene.add.graphics().setDepth(DEPTH.FX);
        this.arcFxUntil = 0;
        this.arcBase = 0;
        this.arcHalf = 0;
        this.arcRadius = 0;
    }

    get invulnerable() {
        return this.godMode || this.scene.time.now < this.hurtUntil || !!this.playerSystem?.invulnerable;
    }

    update(dt) {
        if (this.dead) return;
        this.fireWeapons(dt);
        this.moveProjectiles(dt);
        this.rebuildHash();
        this.projectileHits();
        this.contactDamage();
        this.flushDamage();
        this.updateOrbs(dt);
        this.drawArcFx();
    }

    rebuildHash() {
        this.hash.clear();
        const list = this.spawn.enemies;
        for (let i = 0; i < list.length; i++) this.hash.insert(list[i]);
    }

    fireWeapons(dt) {
        this.w1.timer -= dt;
        if (this.w1.timer <= 0) { this.w1.timer += this.w1.cooldown; this.fireW1(); }
        this.w2.timer -= dt;
        if (this.w2.timer <= 0) { this.w2.timer += this.w2.cooldown; this.fireW2(); }
    }

    /** W1 피의 송곳니 — 바라보는 방향 부채꼴. 범위 내 전원 타격(관통 무한) */
    fireW1() {
        const w = this.w1;
        const facing = this.playerSystem?.facing ?? "down";
        const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[facing];
        const half = Phaser.Math.DegToRad(w.arcDeg) / 2;
        const r2 = w.radius * w.radius;

        const cands = this.hash.query(this.player.x, this.player.y, w.radius, this.queryBuf);
        for (const e of cands) {
            if (dist2(e.x, e.y, this.player.x, this.player.y) > r2) continue;
            const a = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            if (Math.abs(Phaser.Math.Angle.Wrap(a - base)) > half) continue;
            this.queueDamage(e, w.damage, w.knockback);
        }
        this.arcBase = base;
        this.arcHalf = half;
        this.arcRadius = w.radius;
        this.arcFxUntil = this.scene.time.now + 100;
    }

    /** W2 화염탄 — 사거리 내 최근접 적 자동조준 */
    fireW2() {
        const w = this.w2;
        const cands = this.hash.query(this.player.x, this.player.y, w.range, this.queryBuf);
        let best = null, bestD = w.range * w.range;
        for (const e of cands) {
            const d = dist2(e.x, e.y, this.player.x, this.player.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) return;

        const a = Math.atan2(best.y - this.player.y, best.x - this.player.x);
        for (let i = 0; i < w.count; i++) {
            const p = this.projectiles.obtain();
            if (!p) break;
            p.setPosition(this.player.x, this.player.y).setVisible(true);
            p.vx = Math.cos(a) * w.speed;
            p.vy = Math.sin(a) * w.speed;
            p.life = w.range / w.speed;
            p.pierce = w.pierce;
            p.damage = w.damage;
            p.knockback = w.knockback;
            if (!p.hitSet) p.hitSet = new Set();
            p.hitSet.clear();
        }
    }

    moveProjectiles(dt) {
        const list = this.projectiles.active;
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
        this.projectiles.release(p);
    }

    projectileHits() {
        const list = this.projectiles.active;
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
    queueDamage(enemy, amount, knockback) {
        this.damageQueue.push({ e: enemy, amount, knockback });
    }

    /** 큐를 한 번에 처리 — 같은 적이 여러 소스에서 맞아도 사망은 1회다 */
    flushDamage() {
        for (const d of this.damageQueue) {
            const e = d.e;
            if (!e.__active || e.hp <= 0) continue;
            e.hp -= d.amount;

            // 피격 플래시 60ms (T213)
            e.setTintFill(0xffffff);
            this.scene.time.delayedCall(60, () => { if (e.__active) e.clearTint(); });

            if (d.knockback) {
                const dx = e.x - this.player.x, dy = e.y - this.player.y;
                const m = Math.hypot(dx, dy) || 1;
                const k = d.knockback * (1 - (e.knockbackResist ?? 0)) * 6;
                e.kbx = (dx / m) * k;
                e.kby = (dy / m) * k;
            }

            if (e.hp <= 0) {
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
        this.hp = Math.max(0, this.hp - amount);
        this.hurtUntil = this.scene.time.now + PLAYER_IFRAME;
        this.player.setTintFill(0xffffff);
        this.scene.time.delayedCall(60, () => this.player.clearTint());
        this.scene.cameras.main.shake(90, 0.004);
        if (this.hp <= 0) this.die();
    }

    die() {
        this.dead = true;
        EventBus.emit(EVENTS.RUN_ENDED, {
            reason: "death",
            time: Math.floor(this.spawn.elapsed),
            kills: this.spawn.killCount,
            level: this.level,
        });
    }

    // ── EXP 오브
    dropOrb(x, y, value) {
        const o = this.orbs.obtain();
        if (!o) return;
        o.setPosition(x, y).setVisible(true);
        o.value = value;
    }

    updateOrbs(dt) {
        const list = this.orbs.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const d2 = dist2(o.x, o.y, this.player.x, this.player.y);
            if (d2 < 36) {
                this.exp += o.value;
                o.setVisible(false).setPosition(-999, -999);
                this.orbs.release(o);
                continue;
            }
            if (d2 < ORB_MAGNET2) {
                const d = Math.sqrt(d2) || 1;
                const sp = 160 * dt;
                o.x += ((this.player.x - o.x) / d) * sp;
                o.y += ((this.player.y - o.y) / d) * sp;
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
