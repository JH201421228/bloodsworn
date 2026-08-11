/**
 * ProjectileSystem — 플레이어 투사체 전담. (6개월 확장 / P-1)
 *
 * ★ 왜 CombatSystem 에서 떼어내는가: 직전까지 투사체는 `scene.add.circle` 로 그린 주황 점 하나였다.
 *   무기가 4종에서 수십 종으로 늘고 원소·관통·유도·분열·도탄이 붙으면
 *   CombatSystem 의 fireProjectile 하나로는 감당이 안 된다.
 *   무엇보다 스프라이트 애니메이션과 충돌 판정이 한 곳에 있어야 "맞은 것처럼 보이는데
 *   안 맞는" 문제가 안 생긴다.
 *
 * ★ 거동은 코드가 아니라 data/projectiles.json 이 정한다
 *   6개월 뒤 무기가 수십 종이 되면 "관통하면서 유도되고 터지는 탄"을 코드로 조합할 수 없다.
 *   여기 있는 건 behavior 키 하나당 한 블록이고, 새 무기는 JSON 한 줄로 만든다.
 *
 * ★ 런 중 new 금지 (06-TECH 5.1)
 *   투사체/임팩트/궤적 전부 생성자에서 풀로 만든다. 피격 대상 Set 까지 미리 만들어 둔다.
 *   상한을 넘으면 가장 오래된 탄을 회수한다 — 새 탄을 버리면 방금 누른 공격이 안 나간 것처럼 보인다.
 *
 * ★ 피해는 반드시 combat.queueDamage 로 넣는다
 *   hp 를 직접 깎으면 한 프레임에 여러 소스가 때렸을 때 사망이 중복 처리되어 EXP 가 2배 드롭된다.
 *
 * ★ update 는 공간해시 재구축 **뒤에** 불러야 한다 (06-TECH 4.2)
 *   무기 발사 -> 해시 재구축 -> 여기(이동+충돌) -> 데미지 일괄 -> 사망.
 *
 * ── 통합 계약 (GameScene / CombatSystem 이 이대로 부른다) ──
 *   new ProjectileSystem(scene, { player, combat, stats })
 *   .fire(def, x, y, angle, opts)  : 투사체 발사. def 는 id 문자열 또는 projectiles.json 항목
 *   .update(dt)                    : 이동 + 수명 + 충돌
 *   .clear()                       : 전탄 회수 (사망/보스 등장)
 *   .activeCount
 */
import Phaser from "phaser";
import { Pool } from "../pools/Pool";
import { DEPTH } from "../constants";
import { dist2 } from "../utils/math";
import projectileData from "@/data/projectiles.json";

/** 상한이 있어야 최악의 프레임을 예측할 수 있다. W2 Lv5(3발/1.0s) 기준 한참 여유가 있다 */
const MAX_PROJECTILES = 160;
const MAX_IMPACTS = 48;
const MAX_TRAIL = 120;
/** 품질 레벨별 궤적 상한 (09-ART 7.4). 저사양에서 가장 먼저 버리는 것이 궤적이다 */
const TRAIL_CAPS = [MAX_TRAIL, 48, 0];
/** 해시 질의 여유 반경 — 적 반경 최대치(EL2 12px)보다 크게 잡아 스침을 놓치지 않는다 */
const ENEMY_MAX_R = 14;
/** 화면 밖으로 한참 나간 탄은 수명과 무관하게 회수한다 */
const CULL_R2 = 720 * 720;
const FALLBACK_TEX = "proj-fallback";
const EMPTY = {};

/** 텍스처가 하나도 없어도 게임이 죽으면 안 된다. 점 하나짜리 대체 텍스처를 굽는다 */
function buildFallback(scene) {
    if (scene.textures.exists(FALLBACK_TEX)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff8844, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture(FALLBACK_TEX, 4, 4);
    g.destroy();
}

const indexById = (arr) => Object.fromEntries((arr ?? []).map((d) => [d.id, d]));

export class ProjectileSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;
        this.stats = ctx.stats;

        this.sheets = projectileData.sheets ?? {};
        this.defs = indexById(projectileData.projectiles);
        this.impacts = indexById(projectileData.impacts);

        // 질의 버퍼를 2개 두는 이유: 충돌 순회(queryBuf) 도중 폭발/도탄이 다시 질의한다.
        // 하나를 돌려쓰면 순회 중인 배열이 갈려 나가 적을 건너뛴다.
        this.queryBuf = [];
        this.auxBuf = [];
        this.warned = new Set();

        buildFallback(scene);
        this.baseTexture = this.pickBaseTexture();
        this.registerAnims();

        this.pool = new Pool(MAX_PROJECTILES, () => {
            const s = scene.add.sprite(-999, -999, this.baseTexture, 0);
            s.setDepth(DEPTH.PROJECTILE).setVisible(false);
            // 관통 중복 타격 방지용. 런 중에 만들면 초당 수십 개가 GC 대상이 된다
            s.__hits = new Set();
            return s;
        });
        this.impactPool = new Pool(MAX_IMPACTS, () => {
            const s = scene.add.sprite(-999, -999, this.baseTexture, 0);
            s.setDepth(DEPTH.FX).setVisible(false);
            return s;
        });
        // 궤적은 탄보다 뒤에 깔린다. 위에 깔면 탄 머리가 자기 잔상에 가려진다
        this.trailPool = new Pool(MAX_TRAIL, () => {
            const s = scene.add.sprite(-999, -999, this.baseTexture, 0);
            s.setDepth(DEPTH.PROJECTILE - 1).setVisible(false);
            return s;
        });
    }

    get activeCount() { return this.pool.activeCount; }

    hasDef(id) { return !!this.defs[id]; }

    /** 풀 생성용 텍스처. 실제 텍스처는 발사할 때마다 바꿔 끼운다 */
    pickBaseTexture() {
        for (const key of Object.keys(this.sheets)) {
            if (this.scene.textures.exists(key)) return key;
        }
        console.warn("[ProjectileSystem] 투사체 텍스처가 하나도 없다 — 대체 점으로 굴린다");
        return FALLBACK_TEX;
    }

    /**
     * 애니메이션을 여기서 등록하는 이유: registerAnims.js 는 PreloadScene 전용 공유 파일이고,
     * 투사체 시트는 이 시스템만 쓴다. 소유자가 자기 키를 만드는 편이 충돌 지점이 적다.
     * ★ anims 는 씬이 아니라 게임 전역이다 — 재시작 때 이미 있으면 건너뛴다.
     */
    registerAnims() {
        const anims = this.scene.anims;
        for (const s of Object.values(this.sheets)) {
            if (!this.scene.textures.exists(s.key)) continue;
            const loop = s.kind !== "impact";
            this.make(anims, "proj." + s.key, s, loop, false);
            // yoyo 는 별도 키다. 성장 시퀀스(comet)를 그냥 반복하면 커졌다가 툭 끊긴다
            if (loop) this.make(anims, "proj." + s.key + ".yoyo", s, true, true);
        }
    }

    make(anims, key, sheet, loop, yoyo) {
        if (anims.exists(key)) return;
        anims.create({
            key,
            frames: anims.generateFrameNumbers(sheet.key, { start: 0, end: sheet.frames - 1 }),
            frameRate: sheet.fps ?? 12,
            repeat: loop ? -1 : 0,
            yoyo,
        });
    }

    warn(msg) {
        // 같은 경고를 매 프레임 찍으면 콘솔이 막히고 그 프레임이 통째로 날아간다
        if (this.warned.has(msg)) return;
        this.warned.add(msg);
        console.warn("[ProjectileSystem] " + msg);
    }

    // ── 발사 ────────────────────────────────────────────────
    /**
     * @param {string|object} def projectiles.json 의 id 또는 항목 자체
     * @param {number} angle 라디안
     * @param {{damage?:number,knockback?:number,speed?:number,range?:number,pierce?:number,scale?:number,gen?:number}} opts
     *        수치는 호출자(CombatSystem)가 이미 stats 를 곱해 넘긴다 — 여기서 두 번 곱하지 않는다.
     */
    fire(def, x, y, angle, opts = EMPTY) {
        const d = typeof def === "string" ? this.defs[def] : def;
        if (!d) { this.warn("정의를 찾을 수 없다: " + def); return null; }
        const sheet = this.sheets[d.sheet];
        const p = this.obtain();
        if (!p) return null;

        const b = d.behavior ?? EMPTY;
        const speed = opts.speed ?? d.speed ?? 220;
        const range = opts.range ?? d.range ?? 220;

        p.__def = d;
        p.__speed = speed;
        p.__range = range;
        // 사거리를 수명으로 바꿔 둔다. 매 프레임 이동거리를 누적하려면 hypot(=sqrt)이 필요하다.
        p.__life = opts.life ?? (speed > 0 ? range / speed : 1);
        p.__dmg = opts.damage ?? d.damage ?? 1;
        p.__kb = opts.knockback ?? d.knockback ?? 0;
        p.__pierce = opts.pierce ?? b.pierce ?? 0;
        p.__bounce = b.bounce?.count ?? 0;
        p.__gen = opts.gen ?? 0;
        p.__hitR = d.hitR ?? 4;
        p.__target = null;
        p.__homeT = 0;
        p.__hits.clear();
        // 분열 자식이 부모를 죽인 그 적을 다시 때리면 표기 데미지의 2배가 들어간다.
        // 자식은 명중 지점에서 태어나므로 첫 프레임에 반드시 겹친다 — 여기서 막는 것이 유일한 지점이다.
        if (opts.exclude) p.__hits.add(opts.exclude);
        this.setHeading(p, angle);

        // 방향이 있는 그림(dir:"+x")만 진행 방향으로 돌린다. 구체를 돌리면 아무 일도 안 일어난다.
        p.__rotate = sheet ? sheet.dir === "+x" : false;
        p.__spin = d.spin ?? 0;
        p.rotation = p.__rotate ? angle : 0;

        const trail = d.trail;
        p.__trailEvery = trail ? (trail.every ?? 0.05) : 0;
        p.__trailT = 0;

        const scale = opts.scale ?? d.scale ?? 1;
        p.setScale(scale).setAlpha(d.alpha ?? 1).setPosition(x, y).setVisible(true);
        this.playAnim(p, sheet, d);
        this.scene.audio?.sfx(d.sfx ?? "fire");
        return p;
    }

    /** 시트가 없으면(에셋 누락) 애니메이션 없이 대체 텍스처로라도 날린다 */
    playAnim(sprite, sheet, d) {
        if (!sheet || !this.scene.textures.exists(sheet.key)) {
            sprite.setTexture(FALLBACK_TEX, 0);
            sprite.anims?.stop();
            return;
        }
        const key = "proj." + sheet.key + (d.anim?.yoyo ? ".yoyo" : "");
        if (this.scene.anims.exists(key)) sprite.play(key, true);
        else sprite.setTexture(sheet.key, 0);
    }

    /** 상한 초과 시 가장 오래된 탄을 회수한다. Pool.release 가 swap-remove 라 active[0] 이 대체로 가장 오래됐다 */
    obtain() {
        let p = this.pool.obtain();
        if (p) return p;
        const oldest = this.pool.active[0];
        if (!oldest) return null;
        this.release(oldest);
        p = this.pool.obtain();
        return p;
    }

    setHeading(p, angle) {
        p.__heading = angle;
        p.__vx = Math.cos(angle) * p.__speed;
        p.__vy = Math.sin(angle) * p.__speed;
    }

    // ── 프레임 갱신 ─────────────────────────────────────────
    update(dt) {
        if (!(dt > 0)) return;
        this.moveAll(dt);
        this.updateTrail(dt);
        this.updateImpacts(dt);
    }

    moveAll(dt) {
        const list = this.pool.active;
        if (!list.length) return;
        // 사망 후에도 날아가던 탄이 결과 화면 뒤에서 EXP 를 벌면 안 된다
        const canHit = !!this.combat && !this.combat.dead && !!this.combat.hash;
        const px = this.player?.x ?? 0;
        const py = this.player?.y ?? 0;

        // 뒤에서부터 도는 이유: 회수(swap-remove)와 분열(뒤에 push)이 순회를 깨지 않는다
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            const b = p.__def.behavior ?? EMPTY;

            if (b.homing && canHit) this.steer(p, b.homing, dt);
            if (b.accel) { p.__speed = Math.max(0, p.__speed + b.accel * dt); this.setHeading(p, p.__heading); }

            p.x += p.__vx * dt;
            p.y += p.__vy * dt;
            p.__life -= dt;

            if (p.__rotate) p.rotation = p.__heading;
            else if (p.__spin) p.rotation += Phaser.Math.DegToRad(p.__spin) * dt;

            if (p.__trailEvery > 0) {
                p.__trailT -= dt;
                if (p.__trailT <= 0) { p.__trailT = p.__trailEvery; this.spawnTrail(p); }
            }

            if (canHit) this.collide(p);
            if (!p.__active) continue; // 명중으로 이미 회수됐다
            if (p.__life <= 0 || dist2(p.x, p.y, px, py) > CULL_R2) this.expire(p);
        }
    }

    /**
     * 유도. 매 프레임 표적을 다시 찾지 않고 reacquire 간격으로만 찾는다 —
     * 유도탄 20발 x 매 프레임 해시 질의는 그 자체가 프레임 예산이다.
     */
    steer(p, h, dt) {
        p.__homeT -= dt;
        const t = p.__target;
        if (p.__homeT <= 0 || !t || !t.__active || t.hp <= 0) {
            p.__homeT = h.reacquire ?? 0.12;
            p.__target = this.nearest(p.x, p.y, h.range ?? 140, p.__hits);
        }
        const e = p.__target;
        if (!e) return;
        const want = Math.atan2(e.y - p.y, e.x - p.x);
        // 선회 속도 상한이 없으면 표적 위로 즉시 꺾여 "유도"가 아니라 "순간이동 조준"이 된다
        const max = Phaser.Math.DegToRad(h.turnRate ?? 240) * dt;
        const diff = Phaser.Math.Angle.Wrap(want - p.__heading);
        this.setHeading(p, p.__heading + (diff > max ? max : diff < -max ? -max : diff));
    }

    /** 반경 안에서 가장 가까운 적. exclude 에 든 적은 건너뛴다 */
    nearest(x, y, range, exclude) {
        const cands = this.combat.hash.query(x, y, range, this.auxBuf);
        let best = null;
        let bestD = range * range;
        for (let i = 0; i < cands.length; i++) {
            const e = cands[i];
            if (!e.__active || e.hp <= 0) continue;
            if (exclude && exclude.has(e)) continue;
            const d = dist2(x, y, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    collide(p) {
        const cands = this.combat.hash.query(p.x, p.y, p.__hitR + ENEMY_MAX_R, this.queryBuf);
        for (let i = 0; i < cands.length; i++) {
            const e = cands[i];
            if (!e.__active || e.hp <= 0) continue;
            if (p.__hits.has(e)) continue;
            const rr = e.radius + p.__hitR;
            if (dist2(p.x, p.y, e.x, e.y) > rr * rr) continue;
            p.__hits.add(e);
            this.combat.queueDamage(e, p.__dmg, p.__kb);
            this.onHit(p, e);
            if (!p.__active) return;
        }
    }

    onHit(p, e) {
        const b = p.__def.behavior ?? EMPTY;
        this.playImpact(p.__def.impact, e.x, e.y, p.__heading);
        if (b.aoe) this.explode(p, e.x, e.y, b.aoe);
        if (b.split && (b.split.on ?? "hit") === "hit") this.split(p, b.split, e);
        // 도탄이 남아 있으면 죽지 않고 다음 표적으로 튄다 — 관통 횟수를 소모하지 않는다
        if (b.bounce && p.__bounce > 0 && this.rebound(p, b.bounce)) return;
        if (p.__pierce-- <= 0) this.release(p);
    }

    /**
     * 폭발. 이미 때린 적은 제외한다 — 직격 대상이 폭발로 한 번 더 맞으면
     * 표기 데미지의 2배가 들어가고 밸런스표(05-COMBAT 2.2)와 어긋난다.
     * ★ 반경만 stats.area 를 곱한다. 직격 판정에는 area 가 붙지 않는다(정본에 그런 항목이 없다).
     */
    explode(p, x, y, aoe) {
        // 광역 폭발 연출. 반경에 맞춰 스프라이트를 늘린다.
        this.scene.fxSystem?.burst?.(x, y, aoe?.radius ?? 40);
        const radius = (aoe.radius ?? 24) * (this.stats?.get("area") ?? 1);
        const r2 = radius * radius;
        const dmg = p.__dmg * (aoe.damageMult ?? 0.5);
        const kb = p.__kb * (aoe.knockbackMult ?? 0);
        const cands = this.combat.hash.query(x, y, radius, this.auxBuf);
        for (let i = 0; i < cands.length; i++) {
            const e = cands[i];
            if (!e.__active || e.hp <= 0) continue;
            if (p.__hits.has(e)) continue;
            if (dist2(x, y, e.x, e.y) > r2) continue;
            p.__hits.add(e);
            this.combat.queueDamage(e, dmg, kb);
        }
        this.playImpact(aoe.impact ?? p.__def.impact, x, y, 0, aoe.fxScale ?? 1);
        this.scene.fxSystem?.shake?.("zoneImpact");
    }

    /** 분열. gen 상한이 없으면 한 발이 화면을 뒤덮는다 */
    split(p, s, hit) {
        if (p.__gen >= (s.maxGen ?? 1)) return;
        const n = s.count ?? 2;
        const spread = Phaser.Math.DegToRad(s.spreadDeg ?? 40);
        const mult = s.damageMult ?? 0.6;
        for (let i = 0; i < n; i++) {
            const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
            this.fire(s.childId ?? p.__def.id, p.x, p.y, p.__heading + off, {
                damage: p.__dmg * mult,
                knockback: p.__kb * mult,
                speed: p.__speed * (s.speedMult ?? 0.9),
                range: p.__range * (s.rangeMult ?? 0.5),
                pierce: s.pierce ?? 0,
                gen: p.__gen + 1,
                exclude: hit,
            });
        }
    }

    /**
     * 도탄. ★ 이 게임의 맵에는 벽이 없다(GameScene.buildMap) — 벽 반사는 영원히 발동하지 않는다.
     *   그래서 bounce 를 "적 사이를 튀는 연쇄"로 정의한다. 데이터 이름만 bounce 고 의미는 chain 이다.
     */
    rebound(p, b) {
        const range = b.range ?? 90;
        const best = this.nearest(p.x, p.y, range, p.__hits);
        if (!best) return false;
        p.__bounce--;
        p.__dmg *= b.damageMult ?? 0.85;
        this.setHeading(p, Math.atan2(best.y - p.y, best.x - p.x));
        // 남은 수명이 짧으면 다음 표적에 닿기 전에 사라진다. 최소한 사거리만큼은 준다.
        const need = range / Math.max(1, p.__speed);
        if (p.__life < need) p.__life = need;
        return true;
    }

    /** 수명이 다했다. 만료 시 터지는 탄(포탄)과 분열탄을 여기서 처리한다 */
    expire(p) {
        const b = p.__def.behavior ?? EMPTY;
        if (b.aoe && b.aoe.onExpire) this.explode(p, p.x, p.y, b.aoe);
        if (b.split && b.split.on === "expire") this.split(p, b.split, null);
        if (b.fxOnExpire) this.playImpact(p.__def.impact, p.x, p.y, p.__heading);
        this.release(p);
    }

    release(p) {
        p.anims?.stop();
        p.setVisible(false).setPosition(-999, -999);
        p.__hits.clear();
        p.__target = null;
        this.pool.release(p);
    }

    // ── 명중 이펙트 ─────────────────────────────────────────
    /**
     * 맞았는지 안 맞았는지 눈으로 알 수 있게 하는 것이 이 풀의 유일한 목적이다.
     * 데미지 숫자(FxSystem)는 상한에 걸려 안 뜰 수 있지만 임팩트는 타격 지점에 반드시 뜬다.
     */
    playImpact(id, x, y, angle = 0, scaleMult = 1) {
        if (!id) return;
        const d = this.impacts[id];
        if (!d) { this.warn("임팩트 정의를 찾을 수 없다: " + id); return; }
        const sheet = this.sheets[d.sheet];
        if (!sheet || !this.scene.textures.exists(sheet.key)) return;

        // 상한을 넘으면 가장 오래된 것을 덮어쓴다. 새 타격의 피드백이 사라지면 안 된다
        const s = this.impactPool.activeCount >= MAX_IMPACTS
            ? this.impactPool.active[0]
            : this.impactPool.obtain();
        if (!s) return;

        const fps = d.fps ?? sheet.fps ?? 16;
        s.__life = sheet.frames / fps;
        s.__max = s.__life;
        s.__spin = d.spin ?? 0;
        s.setTexture(sheet.key, 0);
        s.setPosition(x, y).setScale((d.scale ?? 1) * scaleMult).setAlpha(1).setVisible(true);
        s.rotation = d.align === "heading" ? angle : (d.randomRotate === false ? 0 : Math.random() * Math.PI * 2);
        const key = "proj." + sheet.key;
        if (this.scene.anims.exists(key)) s.play(key, true);
    }

    updateImpacts(dt) {
        const list = this.impactPool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const s = list[i];
            s.__life -= dt;
            if (s.__life <= 0) { this.releaseImpact(s); continue; }
            if (s.__spin) s.rotation += Phaser.Math.DegToRad(s.__spin) * dt;
            // 마지막 30% 만 흐려진다. 처음부터 페이드하면 타격 순간이 흐릿해진다
            const t = s.__life / s.__max;
            s.setAlpha(t < 0.3 ? t / 0.3 : 1);
        }
    }

    releaseImpact(s) {
        s.anims?.stop();
        s.setVisible(false).setPosition(-999, -999);
        this.impactPool.release(s);
    }

    // ── 궤적 ────────────────────────────────────────────────
    /** 현재 프레임을 그 자리에 복사해 두고 흐려지게 둔다. 파티클 시스템을 쓰지 않아 드로우콜이 늘지 않는다 */
    spawnTrail(p) {
        const cap = TRAIL_CAPS[Math.min(TRAIL_CAPS.length - 1, this.scene.quality?.level ?? 0)];
        if (cap <= 0 || this.trailPool.activeCount >= cap) return;
        const s = this.trailPool.obtain();
        if (!s) return;
        const t = p.__def.trail ?? EMPTY;
        s.setTexture(p.texture.key, p.frame.name);
        s.setPosition(p.x, p.y).setRotation(p.rotation);
        s.setScale(p.scaleX * (t.scale ?? 0.75));
        s.__a0 = t.alpha ?? 0.5;
        s.__life = t.life ?? 0.16;
        s.__max = s.__life;
        s.setAlpha(s.__a0).setVisible(true);
    }

    updateTrail(dt) {
        const list = this.trailPool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const s = list[i];
            s.__life -= dt;
            if (s.__life <= 0) { this.releaseTrail(s); continue; }
            s.setAlpha(s.__a0 * (s.__life / s.__max));
        }
    }

    releaseTrail(s) {
        s.setVisible(false).setPosition(-999, -999);
        this.trailPool.release(s);
    }

    /** 씬 재시작/사망/보스 등장 — 화면에 떠 있는 것을 전부 걷어낸다 */
    clear() {
        for (let i = this.pool.active.length - 1; i >= 0; i--) this.release(this.pool.active[i]);
        for (let i = this.impactPool.active.length - 1; i >= 0; i--) this.releaseImpact(this.impactPool.active[i]);
        for (let i = this.trailPool.active.length - 1; i >= 0; i--) this.releaseTrail(this.trailPool.active[i]);
    }
}
