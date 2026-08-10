/**
 * SpawnSystem — 오브젝트 풀 + 링 스폰 + 웨이브 진행 + 재활용. (T202/T203/T204/T205)
 *
 * 규격: 05-COMBAT-AND-BALANCE.md 5(웨이브 12구간) / 06-TECH 5.1(풀)
 *   링 스폰: 카메라 밖 반경 400px 원주
 *   디스폰: 900px 초과 시 풀 반환
 *   상한 도달 시 신규 스폰 대신 가장 먼 적을 텔레포트 재활용 (정본 7.1)
 */
import { Pool } from "../pools/Pool";
import { DEPTH } from "../constants";
import { dist2 } from "../utils/math";
import enemiesData from "@/data/enemies.json";
import phasesData from "@/data/phases.json";

export const MAX_ENEMIES = 150;
const SPAWN_RADIUS = 400;
const DESPAWN_RADIUS = 900;
const DESPAWN_R2 = DESPAWN_RADIUS * DESPAWN_RADIUS;

export class SpawnSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.defs = enemiesData.enemies;
        this.segments = phasesData.segments;
        this.elapsed = 0;
        this.spawnTimer = 0;
        this.segIndex = 0;
        this.killCount = 0;

        // 적 풀 — 런 중 new가 실행되지 않도록 미리 만든다(06 5.1)
        this.pool = new Pool(MAX_ENEMIES, () => {
            const s = scene.add.sprite(-999, -999, "enemies", 0);
            s.setDepth(DEPTH.ENEMY).setActive(false).setVisible(false);
            return s;
        });
    }

    get segment() { return this.segments[this.segIndex]; }
    get enemies() { return this.pool.active; }

    /** 현재 시각에 등장 가능한 적 정의 */
    pickDef() {
        const t = this.elapsed;
        const pool = this.defs.filter((d) => d.unlockAt <= t && d.tier !== "elite");
        return pool[(Math.random() * pool.length) | 0] ?? this.defs[0];
    }

    update(dt) {
        this.elapsed += dt;

        // 웨이브 구간 전환
        while (this.segIndex + 1 < this.segments.length && this.elapsed >= this.segments[this.segIndex + 1].t) {
            this.segIndex++;
        }

        this.despawnFar();

        const seg = this.segment;
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer += seg.interval;
            const cap = Math.min(seg.cap, MAX_ENEMIES);
            if (this.pool.activeCount < cap) this.spawn();
            else this.recycleFarthest();
        }
    }

    /** 카메라 밖 원주에 스폰. 화면 안에서 튀어나오면 부당하게 느껴진다 */
    ringPoint() {
        const a = Math.random() * Math.PI * 2;
        return { x: this.player.x + Math.cos(a) * SPAWN_RADIUS, y: this.player.y + Math.sin(a) * SPAWN_RADIUS };
    }

    spawn(defOverride = null, at = null) {
        const e = this.pool.obtain();
        if (!e) return null;
        return this.reset(e, defOverride ?? this.pickDef(), at ?? this.ringPoint());
    }

    reset(e, def, at) {
        const seg = this.segment;
        e.def = def;
        e.maxHp = Math.round(def.baseHp * seg.hpMult);
        e.hp = e.maxHp;
        e.speed = def.moveSpeed;
        e.damage = def.contactDamage * seg.dmgMult;
        e.radius = def.hitbox / 2;
        e.expValue = def.expValue;
        e.knockbackResist = def.knockbackResist ?? 0;
        e.aiPhase = Math.random() * Math.PI * 2; // 지그재그 위상. 전원이 같은 박자로 흔들리지 않게
        e.stateTimer = 0;
        e.vx = 0;
        e.vy = 0;
        e.setPosition(at.x, at.y).setActive(true).setVisible(true).clearTint().setAlpha(1);
        if (this.scene.anims.exists(def.anim)) e.play(def.anim);
        return e;
    }

    /** 상한 도달 시 신규 스폰 대신 가장 먼 적을 끌어온다 (정본 7.1) */
    recycleFarthest() {
        const list = this.pool.active;
        if (!list.length) return;
        let far = null, farD = -1;
        for (const e of list) {
            const d = dist2(e.x, e.y, this.player.x, this.player.y);
            if (d > farD) { farD = d; far = e; }
        }
        if (far) this.reset(far, this.pickDef(), this.ringPoint());
    }

    despawnFar() {
        const list = this.pool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            if (dist2(e.x, e.y, this.player.x, this.player.y) > DESPAWN_R2) this.kill(e, false);
        }
    }

    /** @param {boolean} counted 처치로 세는가(디스폰은 세지 않는다) */
    kill(e, counted = true) {
        if (counted) this.killCount++;
        e.setActive(false).setVisible(false).setPosition(-999, -999);
        this.pool.release(e);
    }

    /** 치트: 즉시 n체 스폰 */
    forceSpawn(n) {
        for (let i = 0; i < n; i++) this.spawn();
    }
}
