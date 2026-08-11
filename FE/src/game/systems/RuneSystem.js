/**
 * RuneSystem — 무기에 새기는 룬. 무기의 「수치」가 아니라 「거동」을 바꾼다.
 *
 * 규격: 31-RUNE-EVOLUTION-TREE (정본) / 30-ENCOUNTERS §3(획득처) / 04-PACT §7(각성과의 분업)
 *
 * ★ 이 시스템이 푸는 문제 (31 §0)
 *   무기는 Lv5 에서 끝난다. 만렙이 되면 PactSystem.candidates() 가 그 축복을 후보에서 빼므로
 *   레벨 21 이후의 카드는 체력·이동속도만 남는다. 룬은 **만렙 이후의 성장 축**이다.
 *
 * ★ 룬은 레벨업 카드에 절대 나오지 않는다 (31 §1.2 · 검증 R-3)
 *   이 파일은 PactSystem 을 import 하지 않고 PactSystem 도 이 파일을 모른다.
 *   룬이 들어오는 문은 engrave() 하나뿐이고, 그 문을 여는 것은 조우와 치트뿐이다.
 *
 * ★ 가장 중요한 함정 — w.s 는 읽기 전용이다 (31 §5.1 · 검증 R-1)
 *   CombatSystem 의 `w.s = def.levels[lv-1]` 은 weapons.json 에서 import 한 **객체 그 자체**다.
 *   룬이 거기에 쓰면 JSON 원본이 오염되어 다음 런까지 남는다.
 *   그래서 룬은 w.s 를 절대 건드리지 않고 w.mods / w.specials / w.shot 에만 쓴다.
 *   그리고 새길 때마다 mods 를 **처음부터 다시 계산**한다 — 누적 곱 오차가 생길 자리가 없다.
 *
 * ★ 런 중 new 금지 (06-TECH 5.1 · 검증 R-5/R-6)
 *   룬이 만드는 투사체는 전부 ProjectileSystem 의 기존 풀(상한 160)에서 나온다.
 *   그리고 룬이 쏘는 탄은 전부 gen:1 로 태어난다 — gen >= 1 인 탄은 다시 아무것도 만들지 않는다.
 *   연쇄(rn_w2_chain)는 애초에 탄을 만들지 않는다. **같은 탄의 진행 방향을 꺾는다**
 *   (ProjectileSystem.rebound — 그 파일 주석이 "이름만 bounce 고 의미는 chain 이다"라고 적어 둔
 *   바로 그 경로다). 만들지 않으므로 분열할 세대 자체가 존재하지 않는다.
 *
 * ── 통합 계약 (EncounterSystem 이 이대로 부른다. 시그니처를 바꾸지 말 것) ──
 *   new RuneSystem(scene, { combat, stats, player })
 *   .offerable()      : 지금 제시 가능한 룬 목록 (게이트 G-1~G-4 전부 적용)
 *   .pick(n)          : 좌판에 올릴 n개. 가능하면 서로 다른 무기의 룬으로 (31 §2.1)
 *   .engrave(runeId)  : 실제로 새긴다. 게이트를 통과하지 못하면 false
 *   .snapshot()       : 조망용 — [{ weaponId, name, level, t1, t2, t3 }]
 *   .update(dt)       : 시간축 특수(정화 슬로우 / 뼈 사출). 룬이 없으면 즉시 반환한다
 */
import { EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2 } from "../utils/math";
import runesData from "@/data/runes.json";

/** tier -> 슬롯 키. 한 무기의 같은 단계 룬은 하나뿐이다 (G-4 / 검증 R-4) */
export const TIER_KEY = { 1: "t1", 2: "t2", 3: "t3" };
export const TIER_KEYS = ["t1", "t2", "t3"];
export const MAX_TIER = 3;

/**
 * 룬이 하나도 없을 때의 항등원. **무기 인스턴스는 항상 이걸 들고 태어난다** —
 * 룬이 없어도 발사 코드가 `w.mods.xxx` 를 무조건 읽을 수 있어야 분기가 안 늘어난다.
 *
 * ★ 키 이름이 곧 결합 규칙이다: 끝이 Mul 이면 곱(기본 1), Add 면 합(기본 0).
 *   runes.json 의 op:"mod" 는 이 표에 있는 키만 쓸 수 있고, validate.js 가 거울을 들고 대조한다.
 *   표에 없는 키를 데이터에 적으면 코드가 조용히 무시한다 — 그래서 검증기가 잡아야 한다.
 */
export function emptyMods() {
    return {
        arcMul: 1,      // W1 부채꼴 각도
        radiusMul: 1,   // W1 사거리 / W3 궤도 반경 / W4 장판 반경
        countAdd: 0,    // W2 발사 수 / W3 궤도 뼈 수 / W4 낙하 수
        pierceAdd: 0,   // W2 관통
        cdMul: 1,       // 쿨다운
        rehitMul: 1,    // W3 재타격 간격
        durationMul: 1, // W4 장판 지속 시간
    };
}

const BY_ID = {};
for (const r of runesData.runes) BY_ID[r.id] = r;

/** 피셔-예이츠. 좌판 추첨에만 쓴다 — 런당 몇 번이라 비용을 따질 자리가 아니다 */
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

export class RuneSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.player = ctx.player;

        /** @type {any[]} 정의 원본. 읽기 전용으로만 쓴다 — 여기에 쓰면 runes.json 이 오염된다 */
        this.defs = runesData.runes;
        /** 새긴 룬 수. 0이면 update()가 즉시 반환한다(평시 비용 0) */
        this.count = 0;

        // ★ 필드를 전부 여기서 선언한다. 나중에 붙이면 히든클래스가 갈려 접근이 느려진다.
        this.queryBuf = [];
        this.drainUntil = 0;      // 「피 빨기」 내부 쿨
        this.cleanseTimer = 0;    // 「정화」 갱신 주기
        this.cleanseMarked = [];  // 지난 틱에 느려진 적. 다음 틱에 원복 대상이 된다
        /** 「뼈 사출」 — 한 런에 하나뿐이라 무기 인스턴스가 아니라 여기 둔다 */
        this.launch = { timer: 0, index: -1, awayFor: 0 };
    }

    // ══ 조회 / 게이트 ══════════════════════════════════════════

    byId(id) { return BY_ID[id] ?? null; }

    /**
     * 게이트 4개 (31 §4). 넷을 **전부** 만족해야 좌판에 오른다.
     *   G-1 그 무기를 보유 / G-2 무기 레벨 요건 / G-3 선행 단계 보유 / G-4 그 슬롯이 비었음
     */
    canEngrave(def, wp = this.combat?.weapons?.[def?.weapon]) {
        if (!def || !wp) return false;                                  // G-1
        if (!wp.runes) return false;                                    // 룬 슬롯이 없는 무기 인스턴스
        if (wp.level < (def.requires?.weaponLevel ?? 1)) return false;   // G-2
        const prev = def.tier - 1;                                      // G-3
        if (prev >= 1 && !wp.runes[TIER_KEY[prev]]) return false;
        if (wp.runes[TIER_KEY[def.tier]]) return false;                 // G-4
        return true;
    }

    /** 지금 제시 가능한 룬 전부. 조우가 좌판을 채울 때 쓴다 */
    offerable() {
        const out = [];
        for (const def of this.defs) {
            if (this.canEngrave(def)) out.push(def);
        }
        return out;
    }

    /**
     * 좌판에 올릴 n개.
     * ★ 무기별로 묶어 서로 다른 무기에서 하나씩 뽑는다 (31 §2.1).
     *   그래야 플레이어가 고르는 것이 "어떤 룬"이 아니라 **"어떤 무기를 키울 것인가"** 가 된다.
     *   무기 종류가 모자랄 때만 남은 것으로 채운다.
     */
    pick(n = 3) {
        const pool = this.offerable();
        if (!pool.length || n <= 0) return [];
        const byWeapon = new Map();
        for (const r of pool) {
            if (!byWeapon.has(r.weapon)) byWeapon.set(r.weapon, []);
            byWeapon.get(r.weapon).push(r);
        }
        const groups = shuffle([...byWeapon.values()]);
        for (const g of groups) shuffle(g);

        const out = [];
        for (const g of groups) {
            if (out.length >= n) break;
            out.push(g.shift());
        }
        if (out.length < n) {
            const rest = shuffle(groups.flat());
            while (out.length < n && rest.length) out.push(rest.shift());
        }
        return out;
    }

    /**
     * 실제로 새긴다. 한 번 새기면 바꿀 수 없다 (31 §2).
     * @returns {boolean} 게이트를 통과해 새겨졌는가
     */
    engrave(runeId) {
        const def = BY_ID[runeId];
        if (!def) return false;
        const wp = this.combat?.weapons?.[def.weapon];
        if (!this.canEngrave(def, wp)) return false;

        wp.runes[TIER_KEY[def.tier]] = def.id;
        this.count++;
        this.recompute(wp);
        // 궤도 무기는 유골 스프라이트 크기가 레벨에 묶여 있다. 룬으로 개수가 바뀌면 맞춰 준다
        if (wp.type === "orbit") this.combat.syncOrbit?.(wp);
        this.emitSnapshot();
        // 전용 SFX 가 아직 없다(Day 6 소관). 각성 종을 빌려 쓴다 — 소리가 없는 것보다 낫다
        this.scene.audio?.sfx("awaken");
        return true;
    }

    // ══ mods 재계산 ════════════════════════════════════════════

    /**
     * ★ 이 함수가 R-1(원본 무오염)의 전부다.
     *   룬을 새길 때마다 **처음부터** 다시 계산한다. 직전 값에 곱해 나가면
     *   부동소수 누적 오차가 쌓이고, 무엇보다 "룬을 뺄 수 없는" 구조가 된다.
     *   w.s(=weapons.json 객체)는 이 함수 안에서 **읽지도 쓰지도 않는다.**
     */
    recompute(w) {
        const mods = emptyMods();
        const specials = {};

        for (const key of TIER_KEYS) {
            const id = w.runes[key];
            if (!id) continue;
            // 전역 스탯형은 걷어내고 다시 얹는다 — 재계산이 두 번 불려도 두 배가 되지 않는다
            this.stats?.removeBySrc("rune:" + id);
            const def = BY_ID[id];
            if (!def) continue;
            for (const e of def.effects ?? []) {
                if (e.op === "mod") {
                    if (!(e.key in mods)) continue; // 검증기가 잡는다. 여기서는 조용히 넘긴다
                    if (e.key.endsWith("Mul")) mods[e.key] *= e.value;
                    else mods[e.key] += e.value;
                } else if (e.op === "stat") {
                    // src 접두 규약 "rune:" (31 §5.2). bls:/toll:/item:/sanctum: 과 같은 자리다
                    this.stats?.add(e.stat, e.mode ?? "mul", e.value, "rune:" + id);
                } else if (e.op === "special") {
                    specials[e.id] = e.params ?? {};
                }
            }
        }

        w.mods = mods;
        w.specials = specials;
        w.shot = this.buildShotOpts(specials);
    }

    /**
     * per-shot 오버라이드를 **미리** 만들어 둔다 (31 §5.2 (4)).
     * ★ 발사 때마다 객체를 만들면 초당 수십 개가 GC 대상이 된다. 룬은 새길 때만 바뀌므로
     *   그때 한 번 만들어 두고 발사 지점은 참조만 넘긴다.
     * ★ params 를 그대로 넘기지 않고 복사하는 이유: 그건 runes.json 객체 그 자체다.
     *   ProjectileSystem 은 읽기만 하지만, 한 군데라도 쓰면 w.s 와 똑같은 사고가 된다.
     */
    buildShotOpts(specials) {
        const seek = specials.homing_seek;
        const burst = specials.hit_burst;
        const chain = specials.chain_bounce;
        if (!seek && !burst && !chain) return null;
        return {
            homing: seek
                ? { turnRate: seek.turnRate ?? 120, range: seek.range ?? 170, reacquire: seek.reacquire ?? 0.15 }
                : null,
            aoe: burst
                ? {
                    radius: burst.radius ?? 22,
                    damageMult: burst.damageMult ?? 0.4,
                    impact: burst.impact ?? "fx_flame_blast",
                    fxScale: burst.fxScale ?? 0.8,
                }
                : null,
            // 연쇄 — 탄을 만들지 않고 같은 탄을 꺾는다. falloff 0.25 = 튈 때마다 피해 x0.75
            bounce: chain
                ? { count: chain.count ?? 3, range: chain.range ?? 70, damageMult: 1 - (chain.falloff ?? 0.25) }
                : null,
        };
    }

    // ══ 조망 ═══════════════════════════════════════════════════

    /** 일시정지 화면이 읽는 형태 (31 §6.2). 새 화면을 만들지 않는다 */
    snapshot() {
        const out = [];
        for (const wp of this.combat?.weaponList ?? []) {
            const def = this.combat.wdef?.[wp.id];
            out.push({
                weaponId: wp.id,
                name: def?.name ?? wp.id,
                level: wp.level,
                maxLevel: def?.maxLevel ?? 5,
                t1: this.brief(wp.runes?.t1),
                t2: this.brief(wp.runes?.t2),
                t3: this.brief(wp.runes?.t3),
            });
        }
        return out;
    }

    brief(id) {
        const d = id ? BY_ID[id] : null;
        return d ? { id: d.id, name: d.name, glyph: d.glyph, icon: d.icon ?? null, desc: d.desc } : null;
    }

    /**
     * ★ 룬 보유 상태는 레벨업/조우 빈도로만 바뀐다 — 그래서 스토어에 넣어도 된다(06 §3.3).
     *   DPS·쿨다운 같은 60fps 값은 절대 여기 실리지 않는다.
     */
    emitSnapshot() {
        EventBus.emit(EVENTS.RUNES_CHANGED, { weapons: this.snapshot() });
    }

    // ══ 매 프레임 ══════════════════════════════════════════════

    /**
     * CombatSystem.update 안에서 **공간해시 재구축 뒤**에 불린다 (06-TECH 4.2).
     * 여기 있는 것은 "시간이 흘러야 일어나는" 룬 둘뿐이다. 나머지는 발사 지점의 훅으로 처리한다.
     */
    update(dt) {
        if (this.count === 0) return; // 룬이 하나도 없으면 비용 0
        const w4 = this.combat.weapons.W4;
        if (w4?.specials?.zone_slow) this.updateCleanse(w4, dt);
        const w3 = this.combat.weapons.W3;
        if (w3?.specials?.bone_launch) this.updateBoneLaunch(w3, dt);
    }

    /**
     * 「정화」 — 장판 안의 적을 느리게 한다.
     * ★ 각성 「중력의 군주」와 같은 방식이다: def.moveSpeed 가 스폰 시 기준값이므로
     *   별도 백업 필드가 필요 없다. 다음 틱에 전부 원복하고 다시 표시한다.
     * ⚠ 두 효과가 겹치면 갱신 순간의 한 틱(0.15s)만 서로를 덮는다. 둘 다 같은 주기로
     *   다시 칠하므로 결과는 수렴한다 — 대신 곱해지지는 않는다(의도한 상한이다).
     */
    updateCleanse(wp, dt) {
        const p = wp.specials.zone_slow;
        this.cleanseTimer -= dt;
        if (this.cleanseTimer > 0) return;
        this.cleanseTimer += p.refreshSec ?? 0.15;

        for (let i = 0; i < this.cleanseMarked.length; i++) {
            const e = this.cleanseMarked[i];
            if (e.__active && e.def) e.speed = e.def.moveSpeed;
        }
        this.cleanseMarked.length = 0;

        const mult = p.speedMult ?? 0.65;
        const zones = this.combat.zones.active;
        for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            const r = Math.sqrt(z.zr2);
            const cands = this.combat.hash.query(z.x, z.y, r, this.queryBuf);
            for (const e of cands) {
                if (!e.__active || !e.def) continue;
                if (dist2(e.x, e.y, z.x, z.y) > z.zr2) continue;
                e.speed = e.def.moveSpeed * mult;
                this.cleanseMarked.push(e);
            }
        }
    }

    /**
     * 「뼈 사출」 — 궤도 뼈 하나가 최근접 적에게 날아가 관통하고 3초 뒤 복귀한다.
     * ★ 날아가는 뼈는 궤도에서 **자리를 비운다**(updateOrbit 이 그 인덱스를 건너뛴다).
     *   비우지 않으면 뼈가 두 개로 늘어난 것처럼 보여 "사출"이 아니라 "추가 공격"이 된다.
     */
    updateBoneLaunch(wp, dt) {
        const p = wp.specials.bone_launch;
        const st = this.launch;
        if (st.awayFor > 0) {
            st.awayFor -= dt;
            if (st.awayFor <= 0) { st.awayFor = 0; st.index = -1; }
            return;
        }
        st.timer -= dt;
        if (st.timer > 0) return;

        const proj = this.combat.projectiles;
        const target = this.nearest(this.player.x, this.player.y, p.range ?? 320);
        // 표적이 없으면 주기를 태우지 않는다 — 적이 오면 곧바로 쏜다
        if (!target || !proj) { st.timer = 0.4; return; }
        st.timer = p.everySec ?? 5;

        const a = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        const dmg = wp.s.damage * (p.damageMult ?? 1.6) * this.stats.get("damage");
        // ★ 기존 풀에서만 나온다. gen:1 — 이 탄은 다시 아무것도 만들지 않는다
        proj.fire(p.projectile ?? "p_bone_shard", this.player.x, this.player.y, a, {
            damage: dmg,
            knockback: wp.s.knockback * this.stats.get("knockback"),
            speed: p.speed ?? 300,
            range: p.range ?? 320,
            pierce: p.pierce ?? 99,
            gen: 1,
        });
        st.index = 0;
        st.awayFor = p.returnSec ?? 3;
    }

    /** 「뼈 사출」로 자리를 비운 궤도 인덱스. 없으면 -1 */
    launchedIndex(wp) {
        return wp?.specials?.bone_launch && this.launch.awayFor > 0 ? this.launch.index : -1;
    }

    /** 반경 안 최근접 적. ProjectileSystem.nearest 와 같은 계산이지만 버퍼를 공유하지 않는다 */
    nearest(x, y, range) {
        const cands = this.combat.hash.query(x, y, range, this.queryBuf);
        let best = null;
        let bestD = range * range;
        for (let i = 0; i < cands.length; i++) {
            const e = cands[i];
            if (!e.__active || e.hp <= 0) continue;
            const d = dist2(x, y, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    // ══ CombatSystem 훅 (31 §5.2) ═══════════════════════════════
    // 전부 "룬이 없으면 즉시 반환"이다. 룬을 안 뽑은 런에서 비용이 늘면 안 된다.

    /**
     * 「되받아치기」 — 벤 수만큼 **다음** 쿨다운이 줄고, 공격할 때마다 다시 센다.
     * @returns {number} 0~max 의 감산 비율. fireWeapons 가 cooldown x (1 - 이 값) 으로 쓴다
     */
    riposteFor(wp, hits) {
        const p = wp.specials?.riposte;
        if (!p) return 0;
        return Math.min(p.max ?? 0.4, hits * (p.perHit ?? 0.08));
    }

    /** 「선혈의 원」 — 부채꼴이 전방위가 된다. 조준이 사라진다 */
    isFullCircle(wp) {
        return !!wp.specials?.arc_360;
    }

    /**
     * 「참격 파동」 — 벨 때마다 전방으로 관통 파동이 나간다. 근접이 원거리가 된다.
     * ★ 「선혈의 원」과 같이 새길 수는 없다(둘 다 T3, 슬롯은 하나다). 그래서 파동의 방향은
     *   언제나 바라보는 쪽으로 정의해도 모순이 없다.
     */
    onArcFired(wp, baseAngle) {
        const p = wp.specials?.arc_wave;
        const proj = this.combat.projectiles;
        if (!p || !proj) return;
        proj.fire(p.projectile ?? "p_blood_wave", this.player.x, this.player.y, baseAngle, {
            damage: wp.s.damage * (p.damageMult ?? 0.6) * this.stats.get("damage"),
            knockback: wp.s.knockback * this.stats.get("knockback"),
            speed: p.speed ?? 260,
            range: (p.range ?? 220) * this.stats.get("range"),
            pierce: p.pierce ?? 5,
            scale: p.scale ?? 1.4,
            gen: 1, // 파동은 다시 아무것도 만들지 않는다
        });
    }

    /**
     * 「유성우」 — 발사할 때마다 하늘에서 3발이 더 떨어진다.
     * ★ 지연 낙하(delayedCall)를 쓰지 않는다. 발사마다 TimerEvent 3개 + 클로저 3개가 쌓이면
     *   평균 fps 는 멀쩡한데 1% Low 만 무너진다(CombatSystem.flushDamage 주석의 T622 와 같은 함정).
     *   대신 낙하 지점을 흩뿌려 동시에 떨어져도 한 점에 겹치지 않게 한다.
     */
    onProjectileFired(wp, target) {
        const p = wp.specials?.meteor;
        const proj = this.combat.projectiles;
        if (!p || !proj || !target) return;
        const n = p.count ?? 3;
        const h = p.fallHeight ?? 150;
        const spread = p.spread ?? 70;
        const dmg = wp.s.damage * (p.damageMult ?? 0.8) * this.stats.get("damage");
        const kb = wp.s.knockback * this.stats.get("knockback");
        for (let i = 0; i < n; i++) {
            const ox = target.x + (Math.random() * 2 - 1) * spread;
            const oy = target.y + (Math.random() * 2 - 1) * spread * 0.5;
            // 각도 PI/2 = 화면 아래쪽. 사거리는 낙하 높이 + 여유만큼만 준다
            proj.fire(p.projectile ?? "p_meteor_fire", ox, oy - h, Math.PI / 2, {
                damage: dmg,
                knockback: kb,
                speed: p.speed ?? 340,
                range: h + (p.overshoot ?? 44),
                pierce: p.pierce ?? 1,
                gen: 1,
            });
        }
    }

    /**
     * 「피 빨기」 — 송곳니로 처치하면 회복한다.
     * ★ 정본 31 §3.1 은 "처치 시"라고만 적혀 있지만 **W1 이 낸 처치로 한정**했다.
     *   무기를 가리지 않으면 그것은 룬이 아니라 축복(stat lifeOnKill)이고,
     *   31 §1.1 의 "룬은 무기의 거동을 바꾼다"와 어긋난다. 이 판단은 보고서에 적어 둔다.
     */
    onKill(e, src) {
        const p = src?.specials?.lifesteal_kill;
        if (!p) return;
        const now = this.scene.time.now;
        if (now < this.drainUntil) return;
        this.drainUntil = now + (p.cooldownSec ?? 0.6) * 1000;
        const c = this.combat;
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * (p.pctMaxHp ?? 0.015));
    }

    /**
     * 「분쇄기」 — 궤도 반경이 주기적으로 팽창·수축한다.
     * @returns {number} 반경 배율. 룬이 없으면 1
     */
    orbitPulse(wp) {
        const p = wp.specials?.orbit_pulse;
        if (!p) return 1;
        const period = p.periodSec ?? 2.4;
        const min = p.minMul ?? 0.55;
        const max = p.maxMul ?? 1.75;
        // 코사인이라 양 끝에서 부드럽게 멈춘다. 톱니로 하면 수축 순간이 튄다
        const t = ((this.scene.time.now / 1000) % period) / period;
        return min + (max - min) * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
    }

    /** 「역회전」 — 궤도가 두 겹이 되고 바깥 겹이 반대로 돈다. 없으면 null */
    orbitCounter(wp) {
        return wp.specials?.orbit_counter ?? null;
    }

    /** 「성역」 — 장판이 하나로 합쳐지고 플레이어를 따라다닌다. 없으면 null */
    sanctuary(wp) {
        return wp.specials?.sanctuary ?? null;
    }

    /**
     * 「낙뢰」 — 장판이 생기는 순간 중심에 즉발 대형 피해가 떨어진다.
     * 장판을 깐 직후에 불린다. 장판 자체의 지속 피해와는 별개다.
     */
    onZoneDropped(wp, z) {
        const p = wp.specials?.zone_smite;
        if (!p) return;
        const r2 = z.zr2 * (p.radiusMul ?? 1) * (p.radiusMul ?? 1);
        const dmg = z.damage * (p.damageMult ?? 6);
        const cands = this.combat.hash.query(z.x, z.y, Math.sqrt(r2), this.queryBuf);
        for (const e of cands) {
            if (!e.__active || e.hp <= 0) continue;
            if (dist2(e.x, e.y, z.x, z.y) > r2) continue;
            this.combat.queueDamage(e, dmg, 0);
        }
        this.scene.fxSystem?.burst?.(z.x, z.y, Math.sqrt(r2));
    }
}
