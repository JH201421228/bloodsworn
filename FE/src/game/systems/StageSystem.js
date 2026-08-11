/**
 * StageSystem — 스테이지 선택 / 진행 / 해금 / 환경 기믹. (6개월 확장 / S-1)
 *
 * ★ 스테이지는 "맵이 다른 것"이 아니라 **규칙이 다른 것**이어야 한다.
 *   배경만 바꾸면 두 번째 스테이지에서 바로 질린다. stages.json 은 그래서
 *   길이·보스·적 계열 조합·웨이브 곡선·환경 기믹을 스테이지마다 전부 다르게 정의한다.
 *
 * ★ 웨이브를 "계열 믹스"로 쓰는 이유
 *   적이 150종이라 스테이지마다 적 ID 가중치를 손으로 나열하면 데이터가 폭발하고
 *   적 하나를 추가할 때마다 5곳을 고쳐야 한다. 계열(undead/holy/demon…) 비율만 적고
 *   실제 ID 분배는 여기서 계산한다. 적을 추가하면 자동으로 해당 계열에 섞인다.
 *
 * ── 통합 계약 ──
 *   new StageSystem(scene, { spawn, boss })
 *   .load(stageId)   : 적 풀·페이즈·보스·배경 적용
 *   .current         : 현재 스테이지 정의
 *   .update(dt)      : 환경 기믹
 *   .isUnlocked(id, save) : 해금 판정
 *   .list            : 전체 스테이지 정의(선택 화면이 읽는다)
 */
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2 } from "../utils/math";
import stagesData from "@/data/stages.json";
import enemiesData from "@/data/enemies.json";
import phasesData from "@/data/phases.json";

/** 기믹 오브젝트 상한. 넘치면 화면이 읽히지 않고 프레임도 흔들린다 */
const MAX_GIMMICK = 8;

export class StageSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.spawn = ctx.spawn;
        this.boss = ctx.boss;
        this.list = stagesData.stages;
        this.byId = Object.fromEntries(this.list.map((s) => [s.id, s]));
        this.current = null;

        // 계열별 적 목록을 부팅 시 한 번만 만든다. 스테이지 전환마다 150종을 훑지 않는다.
        this.byFamily = {};
        for (const e of enemiesData.enemies) {
            if (e.swarmOnly) continue;            // 무리 전용은 일반 가중치 풀에 넣지 않는다
            if (e.tier && e.tier !== "normal") continue; // 엘리트·보스는 이벤트로만 나온다
            (this.byFamily[e.family] ??= []).push(e);
        }
        this.affinityOf = (e, id) => !e.stageAffinity?.length || e.stageAffinity.includes(id);

        /** 기믹 상태 — 타입마다 쓰는 필드가 다르지만 객체는 하나만 쓴다(런 중 할당 0) */
        this.g = { t: 0, phase: 0, until: 0, next: 0, visionMul: 1, active: [] };
        this.gfx = null;
    }

    // ── 해금 ────────────────────────────────────────────────
    /**
     * @param {string} id
     * @param {{clears?:Record<string,number>, awakenCount?:number}} save 메타 진행도
     */
    isUnlocked(id, save = {}) {
        const st = this.byId[id];
        if (!st) return false;
        return this.evalUnlock(st.unlock, save);
    }

    evalUnlock(u, save) {
        if (!u || u.type === "always") return true;
        switch (u.type) {
            case "bossDefeated": return (save.clears?.[u.stageId] ?? 0) > 0;
            case "awakenCount": return (save.awakenCount ?? 0) >= (u.n ?? 0);
            case "all": return (u.of ?? []).every((x) => this.evalUnlock(x, save));
            case "any": return (u.of ?? []).some((x) => this.evalUnlock(x, save));
            default:
                console.warn("[StageSystem] 알 수 없는 해금 조건:", u.type);
                return false;
        }
    }

    // ── 적재 ────────────────────────────────────────────────
    load(stageId) {
        const st = this.byId[stageId] ?? this.byId[stagesData.defaultStageId] ?? this.list[0];
        if (!st) { console.warn("[StageSystem] 스테이지가 없다"); return null; }
        this.current = st;

        const plan = this.compile(st);
        this.spawn?.applyStage?.(plan);
        this.applyGround(st);
        this.resetGimmick();

        EventBus.emit(EVENTS.RUN_PHASE_CHANGED, {
            phase: 1, stageId: st.id, stageName: st.name, label: st.subtitle ?? st.name,
            bgmTier: plan.phases?.[0]?.bgmTier ?? "bgm_ambient",
        });
        return st;
    }

    /**
     * 스테이지 정의 → SpawnSystem 이 먹는 계획으로 변환한다.
     * stage1 은 waves.inherit === "phases" 라 기존 phases.json 을 그대로 쓴다 —
     * 이미 실측으로 튜닝된 곡선이라 손대지 않는 것이 맞다.
     */
    compile(st) {
        const w = st.waves ?? {};
        if (w.inherit === "phases") {
            return {
                segments: phasesData.segments,
                events: phasesData.events ?? [],
                phases: phasesData.phases ?? [],
                bossAt: st.runSec ?? phasesData.bossAt,
            };
        }
        return {
            segments: this.buildSegments(st, w),
            events: this.buildEvents(w.events, st.runSec),
            phases: (w.moments ?? []).map((m) => ({ ...m })),
            bossAt: st.runSec ?? 360,
        };
    }

    /**
     * 곡선 파라미터로 구간을 생성한다.
     * ★ hpMult 를 선형이 아니라 지수(hpExp)로 올리는 이유: 플레이어 DPS 는 무기 레벨과
     *   축복이 곱연산으로 쌓여 지수적으로 오른다. 적 HP 가 선형이면 후반이 무의미해진다.
     */
    buildSegments(st, w) {
        const c = w.curve ?? {};
        const n = Math.max(1, w.segments ?? 12);
        const sec = w.segmentSec ?? 30;
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
            const p = n === 1 ? 0 : i / (n - 1);   // 0..1 진행도
            out[i] = {
                t: i * sec,
                hpMult: 1 + (c.hpK ?? 0.4) * Math.pow(i, c.hpExp ?? 1.5),
                dmgMult: 1 + (c.dmgK ?? 0.12) * Math.pow(i, c.dmgExp ?? 1.3),
                interval: lerp(c.intervalFrom ?? 1.2, c.intervalTo ?? 0.25, p),
                cap: Math.round(lerp(c.capFrom ?? 18, c.capTo ?? 120, p)),
                weights: this.weightsAt(st, w.mix, i * sec),
            };
        }
        return out;
    }

    /**
     * 해당 시각의 계열 비율을 실제 적 ID 가중치로 편다.
     * ★ 계열 비율을 그 계열의 적 수로 나눠 배분한다 — 나누지 않으면 종이 많은 계열이
     *   비율과 무관하게 훨씬 자주 나온다. "언데드 20%"는 언데드 전체가 20% 라는 뜻이어야 한다.
     */
    weightsAt(st, mix, t) {
        const band = pickBand(mix, t);
        const out = {};
        if (!band) return out;
        for (const fam of Object.keys(band.families)) {
            const share = band.families[fam];
            const fam0 = this.byFamily[fam] ?? [];
            let pool = fam0.filter((e) => this.affinityOf(e, st.id));
            // ★ 안전망: enemies.json 의 stageAffinity 와 stages.json 의 계열 믹스는 서로 다른
            //   파일이라 언제든 어긋날 수 있다. 실제로 한 번 어긋나 stage2 의 적 풀이 0 이 됐고
            //   그 스테이지는 통째로 플레이 불가였다. 소속이 하나도 없으면 계열 전체로 내려간다 —
            //   "의도와 다른 적이 나오는 것"이 "적이 안 나오는 것"보다 낫다.
            if (!pool.length && fam0.length) {
                console.warn(`[StageSystem] ${st.id}: ${fam} 계열에 소속 적이 없어 계열 전체를 쓴다`);
                pool = fam0;
            }
            if (!pool.length) { console.warn(`[StageSystem] ${st.id}: ${fam} 계열 자체가 비어 있다`); continue; }
            const each = share / pool.length;
            for (const e of pool) out[e.id] = (out[e.id] ?? 0) + each;
        }
        return out;
    }

    /** 엘리트·무리·오브 이벤트를 SpawnSystem 의 절대시각 이벤트 목록으로 편다 */
    buildEvents(ev, runSec) {
        const out = [];
        if (!ev) return out;
        for (const e of ev.elite ?? []) out.push({ t: e.t, type: "elite", id: e.id });
        const sw = ev.swarm;
        if (sw) {
            for (let t = sw.from ?? 0; t <= Math.min(sw.to ?? runSec, runSec); t += sw.every ?? 20) {
                out.push({ t, type: "swarm", id: sw.id, count: sw.count ?? 8 });
            }
        }
        out.sort((a, b) => a.t - b.t);
        return out;
    }

    /**
     * 배경. 전용 텍스처가 아직 없으면 fallback 으로 내려가고 tint 로만 분위기를 가른다.
     * ★ 없는 텍스처를 그대로 요청하면 Phaser 가 초록 체크무늬를 그린다 —
     *   "미완성"이 아니라 "고장"으로 보인다. 반드시 존재 확인 후 내려간다.
     */
    applyGround(st) {
        const gs = this.scene.groundSystem;
        const g = st.ground;
        if (!gs || !g) return;
        const tex = this.scene.textures.exists(g.texture) ? g.texture : g.fallbackTexture;
        const props = this.scene.textures.exists(g.props) ? g.props : g.fallbackProps;
        gs.setTheme?.(tex, props, g.tint ?? 0xffffff);
    }

    // ── 환경 기믹 ────────────────────────────────────────────
    /**
     * ★ 기믹은 화면을 어지럽히는 것이 아니라 플레이어의 선택을 바꾸는 것이어야 한다.
     *   시야가 좁아지면 안전거리를 다시 잡아야 하고, 늪이 느리게 하면 대시를 아껴야 한다.
     * ★ duringBoss 를 반드시 존중한다. 보스전에서 시야를 조이면 0.6s 텔레그래프가
     *   안 보여 T525 위반이 된다 — 난이도가 아니라 불공정이 되는 지점이다.
     */
    resetGimmick() {
        const g = this.g;
        g.t = 0; g.phase = 0; g.until = 0; g.visionMul = 1;
        for (const o of g.active) o.destroy();
        g.active.length = 0;
        g.next = this.current?.gimmick?.params?.firstAt ?? 0;
        if (!this.gfx) this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.FX + 5);
        this.gfx.clear();
        this.scene.stats?.removeBySrc?.("stage:gimmick");
    }

    /** 보스전 중 강도. off = 완전 정지, reduced = 절반, 그 외 = 그대로 */
    gimmickScale() {
        if (!this.boss?.active) return 1;
        const mode = this.current?.gimmick?.duringBoss;
        if (mode === "off") return 0;
        if (mode === "reduced") return 0.5;
        return 1;
    }

    update(dt) {
        const gm = this.current?.gimmick;
        if (!gm) return;
        const scale = this.gimmickScale();
        this.g.t += dt;
        switch (gm.type) {
            case "sanctuary": this.gimSanctuary(dt, gm.params ?? {}, scale); break;
            case "haze": this.gimHaze(dt, gm.params ?? {}, scale); break;
            case "mire": this.gimMire(dt, gm.params ?? {}, scale); break;
            case "rockfall": this.gimRockfall(dt, gm.params ?? {}, scale); break;
            case "emberwind": this.gimEmberwind(dt, gm.params ?? {}, scale); break;
        }
    }

    /** 성수 웅덩이 — 밟으면 회복. 유일하게 플레이어에게 이로운 기믹이다 */
    gimSanctuary(dt, p, scale) {
        const g = this.g;
        if (scale > 0) {
            g.next -= dt;
            if (g.next <= 0 && g.active.length < (p.maxActive ?? 2)) {
                g.next = (p.every ?? 60) / scale;
                const a = Math.random() * Math.PI * 2;
                const d = (p.ringMin ?? 120) + Math.random() * ((p.ringMax ?? 220) - (p.ringMin ?? 120));
                const c = this.scene.add.circle(
                    this.scene.player.x + Math.cos(a) * d,
                    this.scene.player.y + Math.sin(a) * d,
                    p.radius ?? 30, 0x9fe8d8, 0.22,
                ).setDepth(DEPTH.GROUND + 1);
                c.__life = p.duration ?? 12;
                c.__tick = 0;
                g.active.push(c);
            }
        }
        const pl = this.scene.player;
        for (let i = g.active.length - 1; i >= 0; i--) {
            const c = g.active[i];
            c.__life -= dt;
            c.__tick -= dt;
            if (c.__tick <= 0 && dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius) {
                c.__tick = p.tickInterval ?? 1;
                const cb = this.scene.combatSystem;
                if (cb) cb.hp = Math.min(cb.maxHp, cb.hp + (p.heal ?? 6));
            }
            if (c.__life <= 0) { c.destroy(); g.active.splice(i, 1); }
        }
    }

    /**
     * 향로 연기 — 주기적으로 시야가 조여든다.
     * vision 을 직접 쓰지 않고 StatSystem 모디파이어로 넣는 이유:
     * BLIND 대가·밤눈 축복과 같은 축에서 계산돼야 하한(90px)이 한 번만 적용된다.
     */
    gimHaze(dt, p, scale) {
        const g = this.g;
        const period = p.period ?? 24;
        const close = p.closeSec ?? 6, hold = p.holdSec ?? 6, open = p.openSec ?? 4;
        const cyc = g.t % period;
        let k = 0;
        if (cyc < close) k = cyc / close;
        else if (cyc < close + hold) k = 1;
        else if (cyc < close + hold + open) k = 1 - (cyc - close - hold) / open;
        k *= scale;

        const from = p.visionFrom ?? 320, to = p.visionTo ?? 150;
        const mul = lerp(from, to, k) / from;
        if (Math.abs(mul - g.visionMul) > 0.01) {
            g.visionMul = mul;
            this.scene.stats?.removeBySrc?.("stage:gimmick");
            if (mul < 0.999) this.scene.stats?.add?.("vision", "toll", 1 - mul, "stage:gimmick");
        }
        const gfx = this.gfx;
        gfx.clear();
        if (k <= 0.01) return;
        const w = this.scene.scale.width, h = this.scene.scale.height;
        const band = (p.bandWidth ?? 18) * k * 2;
        gfx.fillStyle(p.color ?? 0x0b0710, 0.55 * k);
        gfx.fillRect(0, 0, w, band);
        gfx.fillRect(0, h - band, w, band);
        gfx.fillRect(0, 0, band, h);
        gfx.fillRect(w - band, 0, band, h);
    }

    /** 역병 늪 — 웅덩이를 밟으면 느려진다. 대시를 아껴 쓰게 만든다 */
    gimMire(dt, p, scale) {
        const g = this.g;
        if (scale > 0) {
            g.next -= dt;
            if (g.next <= 0 && g.active.length < Math.min(MAX_GIMMICK, p.maxActive ?? 5)) {
                g.next = (p.every ?? 8) / scale;
                const a = Math.random() * Math.PI * 2;
                const d = (p.ringMin ?? 80) + Math.random() * ((p.ringMax ?? 260) - (p.ringMin ?? 80));
                const c = this.scene.add.circle(
                    this.scene.player.x + Math.cos(a) * d,
                    this.scene.player.y + Math.sin(a) * d,
                    p.radius ?? 44, p.color ?? 0x4a5a2a, 0.3,
                ).setDepth(DEPTH.GROUND + 1);
                c.__life = p.duration ?? 14;
                g.active.push(c);
            }
        }
        const pl = this.scene.player;
        let inside = false;
        for (let i = g.active.length - 1; i >= 0; i--) {
            const c = g.active[i];
            c.__life -= dt;
            if (dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius) inside = true;
            if (c.__life <= 0) { c.destroy(); g.active.splice(i, 1); }
        }
        const want = inside ? (p.slowMult ?? 0.6) : 1;
        if (Math.abs(want - g.visionMul) > 0.01) {
            g.visionMul = want;
            this.scene.stats?.removeBySrc?.("stage:gimmick");
            if (want < 0.999) this.scene.stats?.add?.("moveSpeed", "toll", 1 - want, "stage:gimmick");
        }
    }

    /** 낙석 — 예고 후 낙하. 예고 시간은 반드시 0.6s 이상이다(T525 와 같은 근거) */
    gimRockfall(dt, p, scale) {
        const g = this.g;
        if (scale > 0) {
            g.next -= dt;
            if (g.next <= 0 && g.active.length < MAX_GIMMICK) {
                g.next = (p.every ?? 4) / scale;
                const a = Math.random() * Math.PI * 2;
                const d = Math.random() * (p.spread ?? 200);
                const x = this.scene.player.x + Math.cos(a) * d;
                const y = this.scene.player.y + Math.sin(a) * d;
                const warn = this.scene.add.circle(x, y, p.radius ?? 34, 0xff5533, 0.18)
                    .setStrokeStyle(1, 0xff8866, 0.8).setDepth(DEPTH.GROUND + 1);
                // ★ 0.6 미만으로 내려갈 수 없다. 데이터가 더 짧게 적어도 여기서 끌어올린다.
                warn.__warn = Math.max(0.6, p.telegraph ?? 0.8);
                warn.__dmg = p.damage ?? 18;
                g.active.push(warn);
            }
        }
        const pl = this.scene.player;
        for (let i = g.active.length - 1; i >= 0; i--) {
            const c = g.active[i];
            c.__warn -= dt;
            if (c.__warn > 0) { c.setAlpha(0.12 + 0.3 * (1 - c.__warn)); continue; }
            if (dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius) {
                const cb = this.scene.combatSystem;
                if (cb && !cb.invulnerable) cb.hurt(c.__dmg);
            }
            this.scene.fxSystem?.shake?.("rockfall");
            c.destroy();
            g.active.splice(i, 1);
        }
    }

    /** 불티 바람 — 한 방향으로 미는 힘. 이동과 조준을 같이 흔든다 */
    gimEmberwind(dt, p, scale) {
        const g = this.g;
        const period = p.period ?? 18;
        const blowing = (g.t % period) < (p.blowSec ?? 8);
        const push = blowing ? (p.push ?? 26) * scale : 0;
        if (push > 0) {
            const a = (p.angleDeg ?? 0) * Math.PI / 180 + Math.sin(g.t * 0.2) * 0.3;
            const pl = this.scene.player;
            pl.x += Math.cos(a) * push * dt;
            pl.y += Math.sin(a) * push * dt;
        }
        const gfx = this.gfx;
        gfx.clear();
        if (!blowing) return;
        gfx.fillStyle(p.color ?? 0xff7a3c, 0.10);
        const w = this.scene.scale.width, h = this.scene.scale.height;
        for (let i = 0; i < 6; i++) {
            const y = ((g.t * 60 + i * 47) % (h + 40)) - 20;
            gfx.fillRect(0, y, w, 2);
        }
    }
}

const lerp = (a, b, t) => a + (b - a) * t;

/** mix 는 시각 오름차순 구간표다. 해당 시각 이하의 마지막 밴드를 쓴다 */
function pickBand(mix, t) {
    if (!mix?.length) return null;
    let best = mix[0];
    for (const b of mix) if ((b.t ?? 0) <= t) best = b;
    return best;
}
