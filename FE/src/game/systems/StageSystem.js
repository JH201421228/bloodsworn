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
 * ★ 기믹 파라미터는 stages.json 이 정본이다.
 *   코드가 자기 기본값으로 굴러가면 "밸런싱은 JSON 만 고쳐서 한다"는 규칙이 거짓말이 된다.
 *   데이터에 적힌 키는 전부 여기서 읽고, 읽을 수 없는 키는 데이터에서 지운다.
 *   docs/26 §8 이 실측한 12건 중 8-3 ~ 8-8 이 이 파일의 몫이다.
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
import { clamp, dist2 } from "../utils/math";
import stagesData from "@/data/stages.json";
import enemiesData from "@/data/enemies.json";
import phasesData from "@/data/phases.json";

/** 기믹 오브젝트 상한. 넘치면 화면이 읽히지 않고 프레임도 흔들린다 */
const MAX_GIMMICK = 8;

/**
 * ★ 예고가 있는 기믹의 절대 하한. BossSystem 의 MIN_TELEGRAPH 와 같은 값·같은 근거다
 *   (T525 / 03-GDD 7.3). 0.6초는 임의의 숫자가 아니라 인지 → 판단 → 엄지 이동 →
 *   캐릭터 반응이라는 4단 체인의 합이고, 그보다 짧은 예고는 "어려운 패턴"이 아니라
 *   "입력 장치로 대응할 수 없는 패턴"이다. 밸런싱 중 가장 먼저 깎이는 값이라
 *   JSON 이 넘을 수 없는 곳에 둔다. 다만 데이터가 하한보다 **길게** 적으면 그 값을 존중한다.
 */
const MIN_TELEGRAPH = 0.6;

/** 수렁 배치 시드 소금. GroundSystem 의 소품과 같은 좌표에서 같은 난수가 나오면 안 된다 */
const MIRE_SALT = 0x9e3779b1;

/** 3x3 청크 x 청크당 최대 2개 — 후보 스크래치 크기. 런 중 배열을 늘리지 않는다 */
const MIRE_CAND = 18;

/**
 * 청크 좌표를 시드로 — 같은 청크는 언제 와도 같은 배치가 나온다.
 * ★ GroundSystem.chunkRng 와 **같은 규약·같은 해시**다. 소품과 수렁이 다른 규칙으로
 *   배치되면 "이 지형은 외울 수 있다"는 약속이 반쪽이 된다. 구현을 복사한 이유는
 *   GroundSystem 이 이 함수를 export 하지 않기 때문이고, 바꿀 때는 두 곳을 같이 바꾼다.
 */
function chunkRng(cx, cy, salt) {
    let a = (cx * 374761393 + cy * 668265263 + salt * 2246822519) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

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

        /**
         * 기믹 상태 — 타입마다 쓰는 필드가 다르지만 객체는 하나만 쓴다(런 중 할당 0).
         * mod : 지금 걸어 둔 "stage:gimmick" 모디파이어 값 캐시. 값이 변할 때만 갈아끼운다.
         *       (예전 이름은 visionMul 이었는데 mire 에서는 이동속도 감소량을 담고 있어
         *        읽는 사람을 반드시 한 번 속인다 — docs/26 §4.4-3)
         */
        this.g = {
            t: 0, next: 0, mod: 0, windup: MIN_TELEGRAPH,
            active: [], free: [],
            mirePool: null, mireCand: null, mireN: 0, mireCx: NaN, mireCy: NaN,
            band: null,
        };
        this.gfx = null;    // 화면 고정(HUD 좌표계) — haze 비네트
        this.gfxW = null;   // 월드 좌표계 — emberwind 띠. 카메라가 움직여도 땅에 붙어 있어야 한다
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
        this.boss?.setBoss?.(st.bossId);
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
            const t = i * sec;
            // ★ 지수의 밑은 구간 인덱스가 아니라 **분(minute)** 이다.
            //   인덱스를 쓰면 segmentSec 에 따라 곡선이 통째로 달라진다 —
            //   실제로 stage2(25초 구간)에서 마지막 hpMult 가 15.59 로,
            //   정본 stage1 의 5.64(330초)보다 3배 가까이 높았다.
            //   같은 시각에는 같은 배율이어야 스테이지 간 난이도를 비교할 수 있다.
            const min = t / 60;
            out[i] = {
                t,
                hpMult: 1 + (c.hpK ?? 0.4) * Math.pow(min, c.hpExp ?? 1.5),
                dmgMult: 1 + (c.dmgK ?? 0.12) * Math.pow(min, c.dmgExp ?? 1.3),
                interval: lerp(c.intervalFrom ?? 1.2, c.intervalTo ?? 0.25, p),
                cap: Math.round(lerp(c.capFrom ?? 18, c.capTo ?? 120, p)),
                weights: this.weightsAt(st, w.mix, t),
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
     *
     * ★ 오브젝트는 전부 여기서 미리 만든다(06-TECH 5.1 "런 중 new 금지").
     *   기믹은 초당 여러 개가 뜨고 사라지는 물건이라 매번 add.circle 을 하면
     *   GC 가 전투 중에 튄다. 상한(MAX_GIMMICK)만큼만 만들고 돌려 쓴다.
     */
    resetGimmick() {
        const g = this.g;
        g.t = 0; g.mod = 0; g.mireN = 0; g.mireCx = NaN; g.mireCy = NaN;
        for (const o of g.active) o.destroy();
        g.active.length = 0;
        for (const o of g.free) o.destroy();
        g.free.length = 0;
        if (g.mirePool) { for (const o of g.mirePool) o.destroy(); g.mirePool = null; }
        g.band = null;

        const gm = this.current?.gimmick;
        const p = gm?.params ?? {};
        g.next = p.firstAt ?? 0;

        if (!this.gfx) this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.FX + 5);
        this.gfx.clear();
        this.gfxW?.clear();
        this.scene.stats?.removeBySrc?.("stage:gimmick");
        this.clearPush();

        // ★ 예고가 있는 기믹은 적재 시점에 한 번 검사한다. 매 발생마다 검사하면
        //   같은 오류 로그가 런 내내 수백 줄 쌓여 아무도 안 읽는다(BossSystem 생성자와 같은 규약).
        if (gm?.type === "rockfall" || gm?.type === "emberwind") {
            const raw = p.windup ?? p.telegraph ?? 0.8;
            g.windup = Math.max(MIN_TELEGRAPH, raw);
            if (g.windup !== raw) {
                console.error(`[StageSystem] T525 위반 — ${this.current.id} ${gm.type} windup ${raw}s → ${MIN_TELEGRAPH}s로 강제`);
            }
        }

        switch (gm?.type) {
            case "sanctuary":
            case "rockfall":
                this.buildCirclePool(Math.min(MAX_GIMMICK, p.maxActive ?? MAX_GIMMICK));
                break;
            case "mire":
                g.mirePool = new Array(MAX_GIMMICK);
                for (let i = 0; i < MAX_GIMMICK; i++) {
                    g.mirePool[i] = this.scene.add
                        .circle(-9999, -9999, 8, p.color ?? 0x2f4a2a, p.alpha ?? 0.42)
                        .setDepth(DEPTH.GROUND + 1).setVisible(false);
                }
                g.mireCand = new Array(MIRE_CAND);
                for (let i = 0; i < MIRE_CAND; i++) g.mireCand[i] = { x: 0, y: 0, r: 0, d: 0 };
                break;
            case "emberwind":
                g.band = {
                    on: false, t: 0, windup: g.windup, ox: 0, oy: 0, dx: 1, dy: 0,
                    half: 28, burn: 56, reach: 0, speed: 240, dmg: 0, tick: 0.5, cd: 0, head: 0, push: 0,
                };
                if (!this.gfxW) this.gfxW = this.scene.add.graphics().setDepth(DEPTH.FX);
                this.gfxW.clear();
                break;
        }
    }

    buildCirclePool(n) {
        for (let i = 0; i < n; i++) {
            this.g.free.push(this.scene.add.circle(-9999, -9999, 8, 0xffffff, 0.2)
                .setDepth(DEPTH.GROUND + 1).setVisible(false).setActive(false));
        }
    }

    /** 풀에서 원 하나. 없으면 null — 상한을 넘겨서라도 그리는 일은 없어야 한다 */
    obtainCircle(x, y, r, color, alpha) {
        const c = this.g.free.pop();
        if (!c) return null;
        c.setPosition(x, y).setRadius(r).setFillStyle(color, alpha)
            .setStrokeStyle().setVisible(true).setActive(true);
        this.g.active.push(c);
        return c;
    }

    releaseCircle(i) {
        const g = this.g;
        const c = g.active[i];
        c.setVisible(false).setActive(false).setPosition(-9999, -9999);
        g.active.splice(i, 1);
        g.free.push(c);
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
        if (!gm || !this.scene.player) return;
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
        // ★ duringBoss:"off" 는 연출이 아니라 **밸런스 계약**이다.
        //   05-COMBAT 6 의 BOSS HP 11,000 역산은 "보스전에 회복이 없다"를 전제로 세운 값이다.
        //   생성만 멈추고 남은 웅덩이를 놔두면 전제가 깨지므로 즉시 걷는다.
        if (scale <= 0) {
            for (let i = g.active.length - 1; i >= 0; i--) this.releaseCircle(i);
            return;
        }
        g.next -= dt;
        if (g.next <= 0 && g.active.length < Math.min(MAX_GIMMICK, p.maxActive ?? 2)) {
            g.next = (p.every ?? 60) / scale;
            const a = Math.random() * Math.PI * 2;
            const rmin = p.ringMin ?? 120;
            const d = rmin + Math.random() * ((p.ringMax ?? 220) - rmin);
            const c = this.obtainCircle(
                this.scene.player.x + Math.cos(a) * d,
                this.scene.player.y + Math.sin(a) * d,
                p.radius ?? 30, p.color ?? 0x9fe8d8, p.alpha ?? 0.22,
            );
            if (c) { c.__life = p.duration ?? 12; c.__tick = 0; }
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
            if (c.__life <= 0) this.releaseCircle(i);
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
        if (Math.abs(mul - g.mod) > 0.01) {
            g.mod = mul;
            this.scene.stats?.removeBySrc?.("stage:gimmick");
            if (mul < 0.999) this.scene.stats?.add?.("vision", "toll", 1 - mul, "stage:gimmick");
        }
        const gfx = this.gfx;
        gfx.clear();
        if (k <= 0.01) return;
        // ★ 640 이 아니라 scale.width 다. 논리 가로는 기기 비율마다 640~864 로 다르다
        //   (config.js 좌표계 주석). 굳히면 넓은 화면에서 우측 비네트가 화면 중간에 선다.
        const w = this.scene.scale.width, h = this.scene.scale.height;
        const total = (p.bandWidth ?? 18) * k * 2;
        // ★ bands 는 "가장자리 어둠을 몇 겹으로 나눌 것인가"다. 한 겹으로 칠하면 경계가
        //   직선으로 서서 "시야가 좁아졌다"가 아니라 "화면에 검은 테두리가 생겼다"로 읽힌다.
        //   겹을 안쪽으로 짧게 쌓으면 알파가 누적돼 가장자리만 짙은 비네트가 된다.
        //   16 겹에서 자르는 이유는 겹당 fillRect 4회라 그 이상은 눈에 안 보이는 드로콜이다.
        const n = clamp(Math.round(p.bands ?? 14), 1, 16);
        gfx.fillStyle(p.color ?? 0x0b0710, (0.55 * k) / n);
        for (let i = 0; i < n; i++) {
            const b = total * (1 - i / n);
            if (b <= 0.5) continue;
            gfx.fillRect(0, 0, w, b);
            gfx.fillRect(0, h - b, w, b);
            gfx.fillRect(0, 0, b, h);
            gfx.fillRect(w - b, 0, b, h);
        }
    }

    /**
     * 역병 늪 — 웅덩이를 밟으면 느려진다. 대시를 아껴 쓰게 만든다.
     *
     * ★ 배치가 무작위면 이 기믹은 그냥 사고다.
     *   "이동속도 -35%"는 플레이어가 **피할 수 있을 때만** 난이도이고,
     *   피할 수 없으면 그냥 랜덤하게 얻어맞는 것이다. 그래서 웅덩이는 청크 좌표를
     *   시드로 고정 배치한다 — 같은 자리에 가면 언제나 같은 수렁이 있어서 외울 수 있다.
     *   (docs/26 §4.4-2 가 지적한 "공정성 근거 미성립"이 여기서 해소된다)
     */
    gimMire(dt, p, scale) {
        const g = this.g;
        const pl = this.scene.player;
        const chunk = p.chunk ?? 256;
        const cx = Math.floor(pl.x / chunk), cy = Math.floor(pl.y / chunk);
        // 청크를 넘어갈 때만 다시 고른다. 배치는 좌표의 함수라 매 프레임 계산할 이유가 없다.
        if (cx !== g.mireCx || cy !== g.mireCy) {
            g.mireCx = cx; g.mireCy = cy;
            this.buildMire(p, chunk, cx, cy, pl);
        }
        let inside = false;
        for (let i = 0; i < g.mireN; i++) {
            const c = g.mirePool[i];
            if (dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius) { inside = true; break; }
        }
        // slow 는 배율이 아니라 **깎는 비율**이다(0.35 = -35%). toll 경로로 넣어야
        // SLOW 대가와 같은 축에서 계산되고 하한 32px/s 가 한 번만 걸린다.
        const want = inside ? (p.slow ?? 0.35) * scale : 0;
        if (Math.abs(want - g.mod) > 0.005) {
            g.mod = want;
            this.scene.stats?.removeBySrc?.("stage:gimmick");
            if (want > 0.001) this.scene.stats?.add?.("moveSpeed", "toll", want, "stage:gimmick");
        }
    }

    /**
     * 플레이어가 선 청크와 8이웃의 수렁을 시드로 만들어 가까운 순 MAX_GIMMICK 개만 켠다.
     * ★ 상한을 "가장 먼 것부터" 버리는 이유: 3x3 청크(768x768)에 평균 12.6개가 나오는데
     *   가까운 8개면 반경 약 345px 를 덮는다. 화면 반대각선(367px)과 거의 같아서
     *   실제로 보이는 것은 전부 남고, 버려지는 것은 화면 밖 모서리뿐이다.
     *   판정에 쓰이는 것은 언제나 발밑이므로 "같은 자리 = 같은 결과"가 깨지지 않는다.
     */
    buildMire(p, chunk, cx, cy, pl) {
        const g = this.g;
        const per = p.perChunk ?? 1.4;
        const minR = p.minR ?? 34, maxR = p.maxR ?? 62;
        const cand = g.mireCand;
        let n = 0;
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const rng = chunkRng(cx + ox, cy + oy, MIRE_SALT);
                // 소수 밀도는 확률로 — 1.4 는 "1개 + 40% 확률로 1개 더"다(GroundSystem 과 같은 규약)
                const k = Math.floor(per) + (rng() < per % 1 ? 1 : 0);
                for (let i = 0; i < k && n < cand.length; i++) {
                    const c = cand[n++];
                    c.x = (cx + ox) * chunk + rng() * chunk;
                    c.y = (cy + oy) * chunk + rng() * chunk;
                    c.r = minR + rng() * (maxR - minR);
                    c.d = dist2(pl.x, pl.y, c.x, c.y);
                }
            }
        }
        // 가까운 것 keep 개만 앞으로 끌어온다(부분 선택 정렬). n<=18 이고 청크 전환에만 돈다.
        const keep = Math.min(MAX_GIMMICK, n);
        for (let a = 0; a < keep; a++) {
            let m = a;
            for (let b = a + 1; b < n; b++) if (cand[b].d < cand[m].d) m = b;
            if (m !== a) { const tmp = cand[a]; cand[a] = cand[m]; cand[m] = tmp; }
        }
        for (let i = 0; i < g.mirePool.length; i++) {
            const c = g.mirePool[i];
            if (i < keep) c.setPosition(cand[i].x, cand[i].y).setRadius(cand[i].r).setVisible(true);
            else c.setVisible(false);
        }
        g.mireN = keep;
    }

    /** 낙석 — 예고 후 낙하. 예고 시간은 반드시 0.6s 이상이다(T525 와 같은 근거) */
    gimRockfall(dt, p, scale) {
        const g = this.g;
        const cap = Math.min(MAX_GIMMICK, p.maxActive ?? 6);
        if (scale > 0) {
            g.next -= dt;
            if (g.next <= 0 && g.active.length < cap) {
                g.next = (p.every ?? 7.5) / scale;
                // ★ countFrom→countTo 를 런 진행도로 보간한다. 끝까지 1개씩만 떨어지면
                //   "낙석이 바닥을 계속 뺏는다"는 stage4 의 정체성이 성립하지 않는다.
                const prog = clamp(g.t / (this.current?.runSec ?? 330), 0, 1);
                const want = Math.round(lerp(p.countFrom ?? 1, p.countTo ?? 1, prog));
                const n = Math.min(want, cap - g.active.length);
                for (let i = 0; i < n; i++) this.dropRock(p, scale);
            }
        }
        const pl = this.scene.player;
        for (let i = g.active.length - 1; i >= 0; i--) {
            const c = g.active[i];
            c.__warn -= dt;
            if (c.__warn > 0) {
                // 윤곽은 처음부터 최종 반경 = 어디가 위험한가 / 채움만 점증 = 언제 떨어지는가.
                // 원이 커지는 연출은 t=0.3 시점에 최종 범위를 알 수 없어 예고 시간을 갉아먹는다.
                c.setFillStyle(0xff5533, 0.10 + 0.30 * (1 - c.__warn / c.__warn0));
                continue;
            }
            if (dist2(pl.x, pl.y, c.x, c.y) < c.radius * c.radius) {
                const cb = this.scene.combatSystem;
                if (cb && !cb.invulnerable) cb.hurt(c.__dmg);
            }
            this.scene.fxSystem?.shake?.("rockfall");
            this.releaseCircle(i);
        }
    }

    dropRock(p, scale) {
        const pl = this.scene.player;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (p.spread ?? 180);
        const c = this.obtainCircle(pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d,
            p.radius ?? 34, 0xff5533, 0.10);
        if (!c) return;
        c.setStrokeStyle(1, 0xff8866, 0.8);
        c.__warn = this.g.windup;
        c.__warn0 = this.g.windup;
        c.__dmg = (p.damage ?? 14) * scale;
    }

    /**
     * 불티 바람 — 예고선 뒤에 불길 띠가 지나간다.
     *
     * ★ 데이터가 말하는 기믹은 "밀어내기"가 아니라 "피해야 하는 띠"다.
     *   windup 1.1s 동안 띠(폭 2*halfWidth = 56px)의 윤곽 전체를 먼저 보여주고,
     *   그 다음 불길 머리가 speed 로 띠를 따라 달린다.
     * ★ 56px 이라는 폭에는 근거가 있다 — 이동속도 70px/s 로 절반(28px)을 빠져나오는 데
     *   0.4s 다. 예고 1.1s 안에 **걸어서** 벗어날 수 있다는 뜻이고, 그래서 이 패턴은
     *   쿨 3.0s 짜리 대시를 전제하지 않는다. 대시를 전제하면 대시가 없는 순간의
     *   패턴은 대응 불가능해진다 — T525 정신을 공간 축으로 옮긴 것이다.
     * ★ 띠는 플레이어가 서 있던 자리를 지나간다. "서 있으면 죽는다"가 stage5 의 규칙이다.
     */
    gimEmberwind(dt, p, scale) {
        const g = this.g;
        const b = g.band;
        if (!b) return;
        const gfx = this.gfxW;
        if (scale <= 0) {
            // 보스전 off — 진행 중인 띠까지 즉시 걷는다. 보스 텔레그래프 위에 겹치면 안 된다.
            if (b.on) { b.on = false; this.clearPush(); }
            gfx.clear();
            return;
        }
        // ★ every 는 "띠와 띠 사이의 쉬는 시간"이 아니라 **점화 주기**다.
        //   띠가 지나가는 동안 타이머를 멈추면 실제 주기가 11s + 통과시간(약 3.8s)이 되어
        //   데이터가 적은 11s 와 어긋난다. 항상 돌리고 점화만 비어 있을 때 한다.
        g.next -= dt;
        if (g.next <= 0 && !b.on) { g.next = (p.every ?? 11) / scale; this.igniteLane(p, scale); }
        gfx.clear();
        if (!b.on) { this.clearPush(); return; }

        b.t += dt;
        if (b.t < b.windup) { this.drawLane(p, b, b.t / b.windup, false); this.clearPush(); return; }

        b.head = -b.reach + (b.t - b.windup) * b.speed;
        if (b.head - b.burn > b.reach) { b.on = false; this.clearPush(); return; }
        b.cd -= dt;
        this.drawLane(p, b, 1, true);
        this.burnPlayer(b);
    }

    igniteLane(p, scale) {
        const b = this.g.band;
        const pl = this.scene.player;
        const a = Math.random() * Math.PI * 2;
        b.dx = Math.cos(a); b.dy = Math.sin(a);
        b.ox = pl.x; b.oy = pl.y;
        b.half = p.halfWidth ?? 28;
        // 불길 머리 길이 = 띠 두께. 240px/s 로 지나가면 노출 56/240 = 0.23s → 정확히 1틱이다.
        // 지나간 자리까지 계속 아프면 되돌아갈 길이 막혀 "피하는 패턴"이 "가두는 패턴"이 된다.
        b.burn = b.half * 2;
        // ★ 불길이 화면을 관통해야 한다. 폭이 기기마다 다르므로 실측값을 쓴다(config.js 좌표계).
        const w = this.scene.scale.width, h = this.scene.scale.height;
        // 화면을 확실히 관통하는 길이. 각도에 따라 필요한 사거리가 달라진다.
        b.reach = (w * Math.abs(b.dx) + h * Math.abs(b.dy)) / 2 + b.burn;
        b.speed = p.speed ?? 240;
        b.windup = this.g.windup;
        b.dmg = (p.damage ?? 16) * scale;
        b.tick = p.tickInterval ?? 0.5;
        // push 는 데이터가 요구할 때만 산다(현재 stage5 는 선언하지 않는다 = 0).
        // 좌표를 직접 쓰지 않고 PlayerSystem 의 속도 채널로 넘긴다 — 아래 clearPush 주석 참조.
        b.push = (p.push ?? 0) * scale;
        b.cd = 0; b.t = 0; b.head = -b.reach; b.on = true;
    }

    burnPlayer(b) {
        const pl = this.scene.player;
        const rx = pl.x - b.ox, ry = pl.y - b.oy;
        const along = rx * b.dx + ry * b.dy;          // 진행축 투영
        const perp = -rx * b.dy + ry * b.dx;          // 띠 폭 방향 투영
        const hit = Math.abs(perp) < b.half && along <= b.head && along >= b.head - b.burn;
        this.setPush(hit ? b.dx * b.push : 0, hit ? b.dy * b.push : 0);
        if (!hit || b.cd > 0) return;
        b.cd = b.tick;
        const cb = this.scene.combatSystem;
        if (cb && !cb.invulnerable) cb.hurt(b.dmg);
    }

    /**
     * ★ 미는 힘을 pl.x += 로 주면 안 된다.
     *   PlayerSystem 이 매 프레임 setVelocity 로 속도를 덮어쓰므로 좌표를 직접 쓰는 것은
     *   물리를 통째로 우회하는 것이고, 대시(순간이동 경로 검사)·넉백 감쇠·충돌 어느 것도
     *   적용되지 않는다. 외부 힘은 속도 채널로 넘겨 PlayerSystem 이 합산하게 한다.
     *   (PlayerSystem 은 다른 작업자 소유다. 필드가 없으면 이 대입은 조용히 무시된다)
     */
    setPush(vx, vy) {
        const ps = this.scene.playerSystem;
        if (!ps) return;
        ps.externalVx = vx;
        ps.externalVy = vy;
    }

    clearPush() { this.setPush(0, 0); }

    /**
     * 띠 그리기. BossSystem.drawTelegraph 와 같은 규약 —
     * 윤곽은 즉시 최종 범위 전체(= 어디가 위험한가), 채움만 시간에 따라 짙어진다(= 언제 터지는가).
     * 범위가 자라는 연출은 t=0.3 에 최종 범위를 알 수 없어 실질 반응 시간을 깎는다.
     */
    drawLane(p, b, t, burning) {
        const g = this.gfxW;
        const color = p.color ?? 0xff6a2a;
        if (!burning) {
            g.fillStyle(color, 0.06 + 0.16 * t);
            this.laneQuad(g, b, -b.reach, b.reach, true);
            g.lineStyle(1, color, 0.45 + 0.40 * t);
            this.laneQuad(g, b, -b.reach, b.reach, false);
            // 시작 변을 굵게 — "불이 어느 쪽에서 오는가"까지 알려줘야 도망칠 방향이 정해진다
            const hx = -b.dy * b.half, hy = b.dx * b.half;
            const sx = b.ox - b.dx * b.reach, sy = b.oy - b.dy * b.reach;
            g.lineStyle(3, color, 0.85);
            g.lineBetween(sx + hx, sy + hy, sx - hx, sy - hy);
            return;
        }
        // 지나간 자리는 옅게 남긴다 — "여기는 이미 지나갔다"가 다음 판단의 정보가 된다
        g.fillStyle(color, 0.07);
        this.laneQuad(g, b, -b.reach, b.head - b.burn, true);
        g.fillStyle(color, 0.42);
        this.laneQuad(g, b, b.head - b.burn, b.head, true);
        g.lineStyle(1, color, 0.9);
        this.laneQuad(g, b, b.head - b.burn, b.head, false);
    }

    /** 진행축 s0~s1 구간의 회전 사각형. fillRect 로는 각도를 못 주므로 4점을 직접 찍는다 */
    laneQuad(g, b, s0, s1, fill) {
        if (s1 <= s0) return;
        const hx = -b.dy * b.half, hy = b.dx * b.half;
        const ax = b.ox + b.dx * s0, ay = b.oy + b.dy * s0;
        const bx = b.ox + b.dx * s1, by = b.oy + b.dy * s1;
        g.beginPath();
        g.moveTo(ax + hx, ay + hy);
        g.lineTo(bx + hx, by + hy);
        g.lineTo(bx - hx, by - hy);
        g.lineTo(ax - hx, ay - hy);
        g.closePath();
        if (fill) g.fillPath(); else g.strokePath();
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
