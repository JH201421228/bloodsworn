/**
 * AwakeningSystem — 대가 3중첩 시 저주를 축복으로 뒤집는다. (Day 4 / T401~T426)
 *
 * ★ 이 게임의 존재 이유다. PACT가 "손해를 감수하는 선택"이라면, 각성은
 *   그 손해가 임계점에서 무기로 바뀌는 순간이다. 여기가 재미없으면 게임이 없다.
 *
 * 규격: 04-PACT-SYSTEM 5 / 05-COMBAT 4 / 08-DATA-SCHEMA 3.7 / 12-TASK-BACKLOG D4
 *
 * ★ 설계 원칙 — "페널티 제거"로 끝내지 않는다.
 *   둔족이 사라지기만 하면 각성은 그냥 원상복구다. 반드시 **뒤집힌 이득**(주변을
 *   대신 느리게 만든다)이 붙어야 저주를 모으는 플레이가 성립한다.
 *
 * ★ 성능 원칙 — 적 150체에서 매 프레임 전수 순회를 만들지 않는다.
 *   ① 각성 전에는 update()가 즉시 반환한다(비용 0).
 *   ② 대상 선정은 SpatialHash 질의 + 0.08~0.15s 간격 갱신으로 끊는다.
 *   ③ 거리 비교는 전부 dist2(제곱). Math.sqrt는 넉백 방향 정규화에만 쓴다.
 *   ④ 파티클/마커는 각성 발동 시점(씬 정지 중)에 한 번만 만들고 재사용한다.
 *
 * ── 통합 계약 (이 API는 GameScene/CombatSystem이 의존한다. 시그니처를 바꾸지 말 것) ──
 *   new AwakeningSystem(scene, { stats, pact, combat, player })
 *   .trigger(tag)  : 각성 발동. 중복 발동은 내부에서 막는다.
 *   .update(dt)    : 매 프레임. 오라/지속 효과.
 *   .has(tag)      : 해당 태그가 각성했는가
 *   .list          : 각성한 태그 배열 (최대 2)
 *   .onKill(e)     : 적 처치 시 CombatSystem이 호출 (진조의 갈증 폭발 등)
 *   .onHurt(amt)   : 피격 시 호출. 반환값이 number면 그 값으로 피해를 대체한다.
 *   .onCrit(e,amt) : (확장) 치명타 확정 시 호출. 없으면 내부 폴백이 대신 굴린다.
 */
import Phaser from "phaser"; // BlendModes.DIFFERENCE (흑백 반전)만 쓴다
import { AWAKEN_STACKS, DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2 } from "../utils/math";
import { LOGICAL_HEIGHT, MAX_LOGICAL_WIDTH } from "../config";
import awakeningsData from "@/data/awakenings.json";

export const MAX_AWAKENINGS = 2; // 초과 시 인간성 감소 (T402 / 04-PACT 5.4)

/**
 * 상한 초과 1회당 인간성 감소. 정본 04-PACT §8 / 05-COMBAT §8.4 조정안 2.
 *
 * ★ 20 → 10 (2026-08-12). 근거는 값이 아니라 **빈도**다.
 *   04-PACT §8 의 인간성 예산 검산(총 −97.5)은 상한 초과를 런당 **0.5회**로 잡았다.
 *   그런데 같은 문서군의 05-COMBAT §8.4 가 비둘기집 원리로 이미 계산해 둔 기대값은
 *   **1.59회**이고, 4000런 시뮬 실측도 Lv20 무작위에서 **1.60회**, Lv22 에서 1.99회다.
 *   즉 이 벌점 하나가 예산에서 −10 이 아니라 −32 를 가져가고 있었다. 그 −22 가
 *   인간성 100 을 조기에 0 으로 밀어 「완전 흡혈귀화」를 기본값으로 만든다 —
 *   01 §6 이 「진조」를 진엔딩·도전 과제로 규정한 것과 어긋난다.
 *   빈도를 줄이는 길은 막혀 있다. 상한 도달 뒤 남은 4태그가 전부 2중첩에 닿으면
 *   후보가 비어 「대가 없는 카드」가 되기 때문이다(04-PACT §6.3.1). 그래서 값을 줄인다.
 *
 * ★ 왜 이 손잡이인가 — 상한 초과는 **대가가 아니다**. 축복도 각성도 스탯 페널티도 주지 않고
 *   인간성만 가져가는 순수 벌점이라, 반으로 줄여도 대가의 가격(tolls.json 의 humanityCost
 *   3/6/12)도, 받은 대가 수도, 태그 중첩도 그대로다. 반대로 humanityCost 나 대가 출현율을
 *   건드리면 그 순간 PACT 가 물러진다.
 *   실측(Lv20 무작위 4000런, 20 → 10): 받은 대가 15.86 → 15.97장, 대가 없는 카드 6.7% → 6.0%,
 *   대가 중첩 14.23 → 14.36, 순수 대가 무게(최대 체력 61.4 → 61.5 · 시야 147.9 → 145.8 ·
 *   초당 드레인 2.93 → 2.99) — 가벼워지기는커녕 그대로다.
 *   바뀐 것은 엔딩 분포뿐이다 — C 64.6% → 30.8%, B 32.6% → 65.4%.
 */
const OVER_CAP_HUMANITY = 10;

/** 태그 하나에 각성 하나. 최종 각성(tag:null)은 Day 5 소관이라 여기서 제외한다 */
const BY_TAG = {};
for (const a of awakeningsData.awakenings) if (a.tag) BY_TAG[a.tag] = a;
const PRES = awakeningsData.presentation;

/** 최종 각성 「완전 흡혈귀화」 — 태그가 아니라 인간성 0 으로 발동한다(T511 / 04-PACT 5.4) */
const ASCENSION = awakeningsData.awakenings.find((a) => a.trigger?.type === "humanityZero");

/** "#rrggbb" -> 0xrrggbb. JSON은 사람이 고치는 파일이라 CSS 표기를 쓴다 */
const hex = (s) => parseInt(String(s).slice(1), 16);

/** effects[]에서 special 훅의 params를 꺼낸다. 없으면 빈 객체 — 수치는 전부 JSON에서 온다 */
const paramsOf = (def, id) => {
    for (const e of def.effects) if (e.op === "special" && e.id === id) return e.params ?? {};
    return {};
};

const AURA_DOTS = 8;     // 각성 1개당 오라 입자 수. 최대 2각성 = 16개
const BURST_DOTS = 16;   // 피 폭발/부활 파편 공용 풀
const BURST_MS = 260;

export class AwakeningSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.stats = ctx.stats;
        this.pact = ctx.pact;
        this.combat = ctx.combat;
        this.player = ctx.player;
        /** @type {string[]} 각성한 태그 */
        this.list = [];
        /** @type {Record<string, any>} 태그 -> 각성 정의 */
        this.defs = {};

        // ★ 필드를 전부 여기서 선언한다. 나중에 붙이면 히든클래스가 갈려 접근이 느려진다.
        //   각성별 런타임 상태는 발동 전까지 null이고, null이 곧 "이 각성 없음"이다.
        this.frail = null;
        this.slow = null;
        this.myopia = null;
        this.greed = null;
        this.blind = null;
        this.hunger = null;

        /** SpatialHash 질의 버퍼. CombatSystem의 queryBuf를 빌려 쓰면 순회 중 덮어쓴다 */
        this.queryBuf = [];

        this.dmgHook = null;      // 원본 queueDamage (래퍼 설치 후 보관)
        this.critHookLive = false; // CombatSystem이 onCrit을 부르기 시작하면 폴백을 끈다
        this.reviveUsed = false;
        this.reviveUntil = 0;
        this.hitStopRestore = null;

        this.stunUntil = 0;
        this.stunned = [];        // 충격파로 스턴된 적 (재사용 배열)
        this.overflowed = new Set();

        this.auras = [];
        this.burst = null;
        this.burstCursor = 0;
        this.invertRect = null;
        this.ring = null;
        this.slowRing = null;
    }

    has(tag) { return this.list.includes(tag); }

    /**
     * 각성 발동. 성공 시 true.
     * CombatSystem.applyCard가 카드 적용 직후(씬이 pause된 상태) 호출한다 —
     * 여기서 스프라이트를 만들어도 프레임을 깎지 않는 이유가 그것이다.
     */
    trigger(tag) {
        const def = BY_TAG[tag];
        if (!def || this.has(tag)) return false;

        // T402 — 런당 각성은 2개까지. 3번째 태그가 3중첩되면 각성 대신 인간성을 잃는다
        if (this.list.length >= MAX_AWAKENINGS) {
            this.overflow(tag);
            return false;
        }

        this.list.push(tag);
        // ★ PactSystem 의 장부에도 적는다. 이 한 줄이 없어서 pact.awakened 는 **저장소 전체에서
        //   한 번도 채워진 적이 없었다**(awakened.add 검색 결과 0건). 그 결과 PactSystem 의
        //   각성 관련 그물 두 개가 통째로 죽어 있었다:
        //     pickToll:148  atCap = awakened.size >= AWAKEN_CAP   -> 영원히 false
        //     pickToll:158  awakened.has(t.tag) 로 제외            -> 영원히 통과
        //   즉 **이미 각성한 태그의 대가가 계속 다시 제시**됐다. 그 중첩은 각성을 더 만들지
        //   못하면서 페널티만 쌓는다. 상한 2 자체는 위 MAX_AWAKENINGS 검사가 지키고 있어
        //   각성 개수는 정상이었기 때문에 겉으로 드러나지 않았다.
        //   여기서 적는 이유: trigger() 가 각성의 유일한 권위자라 호출 경로(레벨업 카드 /
        //   제단)마다 따로 적으면 또 어긋난다.
        this.pact?.awakened?.add(tag);

        this.scene.fxSystem?.hitStop(200);   // 정본 04-PACT 5.2 ① 필수 연출

        this.scene.fxSystem?.awakenBurst(); // 심홍 플래시 + 흔들림
        this.defs[tag] = def;

        // ★ 저주를 실제로 뒤집는 지점. src 규약("toll:" + TAG)은 PactSystem.choose와 맞물린다.
        //   FRAIL/BLIND/HUNGER는 removePenalty=false — 페널티가 남아야 각성의 정체성이 산다.
        if (def.removePenalty) this.stats.removeBySrc("toll:" + tag);

        // 스탯으로 표현되는 효과는 StatSystem에 맡긴다. special은 아래 init*가 해석한다
        for (const e of def.effects) {
            if (e.op === "special") continue;
            this.stats.add(e.stat, e.op, e.value, "awaken:" + tag);
        }

        // 피해 보정 래퍼는 special 초기화보다 먼저 — init*가 원본 큐(dmgHook)를 참조한다
        this.installDamageHook();

        switch (tag) {
            case "FRAIL": this.initFrail(def); break;
            case "SLOW": this.initSlow(def); break;
            case "HUNGER": this.initHunger(def); break;
            case "MYOPIA": this.initMyopia(def); break;
            case "GREED": this.initGreed(def); break;
            case "BLIND": this.initBlind(def); break;
        }

        // T425 / 안전장치 S6 — 각성이 순수 보상으로 느껴져야 한다 (04-PACT 9)
        const healPct = def.onTrigger?.healPctMaxHp ?? 0;
        if (healPct > 0) this.healPct(healPct);

        this.spawnAura(def);
        this.present(def);
        return true;
    }

    /**
     * T511 「완전 흡혈귀화」 — 인간성 0 에서 발동한다. 태그 각성과 다른 축이라
     * MAX_AWAKENINGS(2) 상한에 포함되지 않는다. 인간성 0 은 그 자체가 상한이다.
     *
     * ★ 회복이 없다(healPctMaxHp: 0). 이건 보상이 아니라 귀결이다 — 여기까지 온 대가로
     *   모든 대가가 2배가 되고 초당 2.0 씩 탄다. 강해지는 대신 시계가 빨라진다.
     */
    triggerAscension() {
        if (!ASCENSION || this.ascended) return false;
        this.ascended = true;

        for (const e of ASCENSION.effects) {
            if (e.op === "special") continue;
            this.stats.add(e.stat, e.op, e.value, "awaken:ASCENSION");
        }

        // 모든 대가 페널티 2배 — 이미 걸린 toll 모디파이어를 같은 값으로 한 벌 더 얹는다.
        // 곱연산이므로 (1-x)^2 이 되어 "2배로 아프다"가 수치로도 성립한다.
        const mult = ASCENSION.effects.find((e) => e.op === "special")?.params?.tollPenaltyMult ?? 2;
        if (mult > 1 && this.stats.mods) {
            const tolls = this.stats.mods.filter((m) => String(m.src).startsWith("toll:"));
            for (let i = 1; i < mult; i++) {
                for (const m of tolls) this.stats.add(m.stat, m.op, m.value, "ascend:" + m.src);
            }
        }

        this.scene.fxSystem?.hitStop(200);
        this.scene.fxSystem?.awakenBurst();
        this.spawnAura(ASCENSION);
        this.present(ASCENSION);
        return true;
    }

    /** 상한 초과. 각성은 없고 인간성만 깎인다 — "더 가져가도 더 강해지지 않는다" */
    overflow(tag) {
        if (!this.pact || this.overflowed.has(tag)) return;
        this.overflowed.add(tag);
        this.pact.humanity = Math.max(0, this.pact.humanity - OVER_CAP_HUMANITY);

        // PACT_APPLIED는 applyCard에서 이 호출 직전에 이미 나갔다. 다시 실어 보내지 않으면
        // HUD 심장 아이콘이 다음 레벨업까지 옛 인간성을 보여준다
        EventBus.emit(EVENTS.PACT_APPLIED, {
            level: this.combat?.level ?? 1,
            humanity: this.pact.humanity,
            tagCounts: { ...this.pact.tagCounts },
            ownedBlessings: { ...this.pact.owned },
        });
        if (this.pact.humanity <= 0) EventBus.emit(EVENTS.HUMANITY_ZERO, { source: "awakening-cap" });
    }

    healPct(pct) {
        const c = this.combat;
        if (!c) return;
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * pct);
    }

    // ══ 각성별 초기화 ══════════════════════════════════════════

    /** T410 FRAIL → 불사의 껍질. 페널티는 유지된다 — 약한 몸이 곧 화력이다 */
    initFrail(def) {
        const crit = paramsOf(def, "husk_crit_heal");
        const rev = paramsOf(def, "husk_revive");
        const low = paramsOf(def, "husk_lowhp_damage");
        this.frail = {
            critHeal: crit.healPctMaxHp ?? 0.06,
            reviveHpPct: rev.hpPct ?? 0.5,
            reviveInvulnMs: (rev.invulnSec ?? 2) * 1000,
            uses: rev.uses ?? 1,
            lowHpScale: low.scale ?? 0.4,
        };
    }

    /** T411 SLOW → 중력의 군주. 내 발이 풀리고 세상이 대신 묶인다 */
    initSlow(def) {
        const a = paramsOf(def, "weight_slow_aura");
        const b = paramsOf(def, "weight_bonus_vs_slowed");
        const radius = a.radius ?? 120;
        this.slow = {
            radius,
            r2: radius * radius,
            enemySpeedMult: a.enemySpeedMult ?? 0.6,
            refreshSec: a.refreshSec ?? 0.15,
            bonusVsSlowed: b.damageMult ?? 1.25,
            timer: 0,
            marked: [], // 지난 틱에 느려진 적. 다음 틱에 원복 대상이 된다
        };
        const color = hex(def.auraColor);
        this.slowRing = this.scene.add.circle(this.player.x, this.player.y, radius);
        this.slowRing.setStrokeStyle(1, color, 0.5).setFillStyle(color, 0.05).setDepth(DEPTH.DECO);
    }

    /** T412 HUNGER → 진조의 갈증. 굶주림은 그대로다. 대신 학살이 회복이 된다 */
    initHunger(def) {
        const ex = paramsOf(def, "thirst_kill_explosion");
        const st = paramsOf(def, "thirst_killstreak_speed");
        const killsForMax = st.killsForMax ?? 12;
        this.hunger = {
            radius: ex.radius ?? 40,
            r2: (ex.radius ?? 40) * (ex.radius ?? 40),
            damage: (ex.baseDamage ?? 12) * (ex.damagePctBase ?? 0.6),
            windowMs: (st.windowSec ?? 3) * 1000,
            maxBonus: st.maxBonus ?? 0.35,
            killsForMax,
            step: st.step ?? 0.05,
            // 최근 처치 시각 링버퍼. 상한을 넘겨도 보너스는 이미 최대라 덮어써도 무해하다
            // 0 으로 두면 게임 시작 3초 안에는 빈 슬롯이 "최근 처치"로 오인된다
            times: new Float64Array(Math.max(16, killsForMax * 2)).fill(-1e12),
            head: 0,
            mod: this.pushMod("moveSpeed", "awaken", "awaken:HUNGER:rush"),
            color: hex(def.auraColor),
        };
    }

    /** T413 MYOPIA → 접촉의 광기. 사거리가 돌아오고, 코앞이 사냥터가 된다 */
    initMyopia(def) {
        const d = paramsOf(def, "madness_close_damage");
        const s = paramsOf(def, "madness_close_attackspeed");
        const radius = d.radius ?? 80;
        this.myopia = {
            radius,
            r2: radius * radius,
            damageMult: d.damageMult ?? 2,
            maxBonus: s.maxBonus ?? 0.6,
            enemiesForMax: s.enemiesForMax ?? 6,
            step: s.step ?? 0.1,
            refreshSec: s.refreshSec ?? 0.15,
            timer: 0,
            mod: this.pushMod("haste", "awaken", "awaken:MYOPIA:close"),
        };
    }

    /** T414 GREED → 탐욕의 왕관. 덜 받던 자가 전부 가져간다 */
    initGreed(def) {
        const g = paramsOf(def, "avarice_gold");
        const o = paramsOf(def, "avarice_orb_projectile");
        this.greed = {
            goldMult: g.mult ?? 2,
            damage: o.damage ?? 10,
            radius: o.radius ?? 9,
            rehitMs: (o.rehitSec ?? 0.4) * 1000,
            refreshSec: o.refreshSec ?? 0.08,
            budget: o.budget ?? 24,
            cursor: 0,
            timer: 0,
        };
    }

    /** T415 BLIND → 어둠의 눈. 비네트는 남는다(시각적 정체성) — 대신 어둠이 표적이 된다 */
    initBlind(def) {
        const m = paramsOf(def, "nyx_offscreen_marker");
        const d = paramsOf(def, "nyx_offscreen_damage");
        const x = paramsOf(def, "nyx_offscreen_exp");
        this.blind = {
            color: hex(m.color ?? "#ff3b3b"),
            max: m.max ?? 12,
            size: m.size ?? 5,
            scanRadius: m.scanRadius ?? 520,
            refreshSec: m.refreshSec ?? 0.15,
            damageMult: d.damageMult ?? 1.8,
            expMult: x.expMult ?? 2,
            timer: 0,
            marks: [],
            gfx: this.scene.add.graphics().setDepth(DEPTH.FX),
        };
    }

    /**
     * 값이 매 틱 바뀌는 모디파이어를 미리 하나 꽂아 두고 참조를 들고 있는다.
     * ★ add/removeBySrc를 반복하면 mods 배열이 매번 재생성되고 recalc가 계속 돈다.
     *   자리 하나를 잡아 두고 value만 갈아끼우는 편이 훨씬 싸다.
     */
    pushMod(stat, op, src) {
        this.stats.add(stat, op, 0, src);
        return this.stats.mods[this.stats.mods.length - 1];
    }

    /** 계단식으로 끊어 넣는다 — 값이 안 바뀌면 StatSystem을 dirty로 만들지 않는다 */
    setModValue(mod, v) {
        if (!mod || mod.value === v) return;
        mod.value = v;
        this.stats.dirty = true;
    }

    // ══ 피해 가로채기 ══════════════════════════════════════════

    /**
     * ★ 왜 queueDamage를 감싸는가
     *   각성 4종(FRAIL/SLOW/MYOPIA/BLIND)이 "주는 피해"를 바꾼다. 그런데 CombatSystem은
     *   무기 타입마다 다른 경로로 queueDamage를 부른다(부채꼴/투사체/궤도/장판).
     *   보정을 무기별로 심으면 무기를 하나 추가할 때마다 각성 6종을 다시 손봐야 한다.
     *   입구 하나를 감싸면 무기가 늘어도 각성 코드는 그대로다.
     *   각성이 하나도 없으면 설치되지 않으므로 평시 비용은 0이다.
     */
    installDamageHook() {
        if (this.dmgHook || !this.combat) return;
        const combat = this.combat;
        const orig = combat.queueDamage.bind(combat);
        this.dmgHook = orig;
        combat.queueDamage = (enemy, amount, knockback, src) => {
            this.rollCritHeal();
            orig(enemy, this.scaleDamage(enemy, amount), knockback, src);
        };
    }

    /** 각성 보정 배율. 조건은 전부 제곱거리/사각형 비교라 sqrt가 없다 */
    scaleDamage(e, amount) {
        let m = 1;
        if (this.frail) {
            // 최대 HP가 낮을수록 세진다 — 유리대포를 "버티지 못하는 대신 빨리 죽인다"로 보상
            const c = this.combat;
            const ratio = c.maxHp > 0 ? c.hp / c.maxHp : 1;
            m *= 1 + (1 - Math.min(1, Math.max(0, ratio))) * this.frail.lowHpScale;
        }
        if (this.slow && (e.slowUntil ?? 0) > this.scene.time.now) m *= this.slow.bonusVsSlowed;
        if (this.myopia && dist2(e.x, e.y, this.player.x, this.player.y) <= this.myopia.r2) m *= this.myopia.damageMult;
        if (this.blind && this.isOffscreen(e)) m *= this.blind.damageMult;
        return amount * m;
    }

    /**
     * husk_crit_heal 폴백. CombatSystem은 치명타를 flushDamage 안에서 굴리고 밖으로 알리지 않는다.
     * ★ 같은 확률로 독립 시행한다 — 기대값은 정본과 같고, onCrit 훅이 들어오는 순간
     *   critHookLive가 서면서 이 폴백은 스스로 꺼진다(이중 회복 방지).
     */
    rollCritHeal() {
        if (!this.frail || this.critHookLive) return;
        const crit = this.stats.get("crit");
        if (crit > 0 && Math.random() < crit) this.healPct(this.frail.critHeal);
    }

    /** (확장 훅) CombatSystem이 치명타를 확정했을 때 부르면 이쪽이 정본이 된다 */
    onCrit() {
        this.critHookLive = true;
        if (this.frail) this.healPct(this.frail.critHeal);
    }

    /** 카메라 밖인가. worldView는 Phaser가 매 프레임 갱신하는 월드 좌표 사각형이다 */
    isOffscreen(e) {
        const v = this.scene.cameras.main.worldView;
        return e.x < v.x || e.x > v.right || e.y < v.y || e.y > v.bottom;
    }

    // ══ CombatSystem 콜백 ══════════════════════════════════════

    /** 적 처치. flushDamage 안에서 사망 확정 직후, 골드/EXP 지급 직전에 불린다 */
    onKill(e) {
        if (!e || !this.list.length) return;

        if (this.hunger) {
            this.hunger.times[this.hunger.head] = this.scene.time.now;
            this.hunger.head = (this.hunger.head + 1) % this.hunger.times.length;
            this.bloodExplosion(e.x, e.y);
        }
        // 골드 x2 — CombatSystem이 곧 gold += goldValue를 하므로 차액만 얹는다
        if (this.greed) this.combat.gold += (e.goldValue ?? 1) * (this.greed.goldMult - 1);
        // 시야 밖 처치 EXP x2 — 직후 dropOrb(e.expValue)가 이 값을 읽는다.
        // expValue는 스폰 때마다 def 값으로 되돌아가므로 누적되지 않는다
        if (this.blind && this.isOffscreen(e)) e.expValue *= this.blind.expMult;
    }

    /** 반경 40px 피 폭발. 05-COMBAT 기준 W1 Lv1 데미지의 60% */
    bloodExplosion(x, y) {
        const h = this.hunger;
        const dmg = h.damage * this.stats.get("damage");
        const cands = this.combat.hash.query(x, y, h.radius, this.queryBuf);
        for (const e of cands) {
            if (!e.__active || e.hp <= 0) continue;
            if (dist2(e.x, e.y, x, y) > h.r2) continue;
            // ★ 원본 큐를 직접 쓴다. 래퍼를 타면 근접/시야 보정이 폭발에 이중으로 곱해진다
            this.dmgHook(e, dmg, 0, null);
        }
        this.emitBurst(x, y, h.color, 5, 70);
    }

    /**
     * 피격. 숫자를 반환하면 그 값이 실제 피해가 된다.
     * @returns {number|undefined}
     */
    onHurt(amount) {
        const f = this.frail;
        if (!f || this.reviveUsed || f.uses <= 0) return undefined;
        if (this.combat.hp - amount > 0) return undefined;

        // 런당 1회 부활. hurt()가 이 직후 hp -= 0 을 하므로 여기서 목표 HP를 확정해도 안전하다
        this.reviveUsed = true;
        this.combat.hp = this.combat.maxHp * f.reviveHpPct;
        this.reviveUntil = this.scene.time.now + f.reviveInvulnMs;
        this.emitBurst(this.player.x, this.player.y, 0xffe08a, 10, 110);
        this.scene.cameras.main.flash(220, 255, 230, 160);
        // 전용 부활 SFX 키가 아직 없다(Day 6 소관). 종소리를 빌려 쓴다
        this.scene.audio?.sfx(PRES.sfxKey);
        return 0;
    }

    // ══ 매 프레임 ══════════════════════════════════════════════

    update(dt) {
        if (!this.list.length) return; // 각성 전에는 비용 0
        const now = this.scene.time.now;

        // 부활 무적 2초. hurt()가 onHurt 이후에 hurtUntil을 덮어쓰므로 여기서 되민다
        if (this.reviveUntil > now && this.combat.hurtUntil < this.reviveUntil) {
            this.combat.hurtUntil = this.reviveUntil;
        }
        if (now < this.stunUntil) this.holdStun(now);
        else if (this.stunned.length) this.stunned.length = 0;

        if (this.slow) {
            this.updateSlowAura(dt);
            this.slowRing.setPosition(this.player.x, this.player.y);
        }
        if (this.myopia) this.updateMadness(dt);
        if (this.hunger) this.updateThirst(now);
        if (this.greed) this.updateOrbProjectiles(dt);
        if (this.blind) this.updateNyx(dt);
        this.updateAura(dt);
        this.updateBurst(dt, now);
    }

    /**
     * 충격파 스턴 유지.
     * ★ EnemyAISystem이 아직 e.stunUntil을 읽지 않는다(그 파일은 다른 에이전트 소유).
     *   패치가 들어올 때까지 여기서 속도를 눌러 "2초 정지"가 실제로 보이게 한다.
     *   패치 후에도 결과가 같아(둘 다 0) 충돌하지 않는다. 대상은 충격파에 맞은 적뿐이라
     *   전수 순회가 아니고, 2초 뒤 배열을 비워 비용이 사라진다.
     */
    holdStun(now) {
        const list = this.stunned;
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e.__active && now < (e.stunUntil ?? 0)) { e.vx = 0; e.vy = 0; }
        }
    }

    /** T411 — 반경 120px 안의 적을 60% 속도로 묶는다 */
    updateSlowAura(dt) {
        const s = this.slow;
        s.timer -= dt;
        if (s.timer > 0) return;
        s.timer += s.refreshSec;

        // 원복 먼저. def.moveSpeed가 스폰 시 기준값이라 별도 백업 필드가 필요 없다
        for (let i = 0; i < s.marked.length; i++) {
            const e = s.marked[i];
            if (e.__active && e.def) e.speed = e.def.moveSpeed;
        }
        s.marked.length = 0;

        const px = this.player.x, py = this.player.y;
        const now = this.scene.time.now;
        const cands = this.combat.hash.query(px, py, s.radius, this.queryBuf);
        for (const e of cands) {
            if (!e.__active || !e.def) continue;
            if (dist2(e.x, e.y, px, py) > s.r2) continue;
            e.speed = e.def.moveSpeed * s.enemySpeedMult;
            // 데미지 보너스 판정용 타임스탬프. 적이 풀에 반납돼도 알아서 만료된다
            e.slowUntil = now + s.refreshSec * 2000;
            s.marked.push(e);
        }
    }

    /** T413 — 붙어 있는 적이 많을수록 공격속도가 오른다 (최대 +60%) */
    updateMadness(dt) {
        const m = this.myopia;
        m.timer -= dt;
        if (m.timer > 0) return;
        m.timer += m.refreshSec;

        const px = this.player.x, py = this.player.y;
        const cands = this.combat.hash.query(px, py, m.radius, this.queryBuf);
        let n = 0;
        for (const e of cands) {
            if (!e.__active) continue;
            if (dist2(e.x, e.y, px, py) <= m.r2) n++;
        }
        const raw = Math.min(m.maxBonus, (n / m.enemiesForMax) * m.maxBonus);
        this.setModValue(m.mod, Math.round(raw / m.step) * m.step);
    }

    /** T412 — 최근 3초 처치 수에 비례한 이동속도 보너스. 멈추면 사라진다 */
    updateThirst(now) {
        const h = this.hunger;
        const cutoff = now - h.windowMs;
        let n = 0;
        for (let i = 0; i < h.times.length; i++) if (h.times[i] > cutoff) n++;
        const raw = Math.min(h.maxBonus, (n / h.killsForMax) * h.maxBonus);
        this.setModValue(h.mod, Math.round(raw / h.step) * h.step);
    }

    /**
     * T414 — 끌려오는 EXP 오브가 적을 관통하며 데미지를 준다.
     * ★ 오브는 최대 300개다. 전부에 해시 질의를 걸면 자석 x4 구간에서 프레임이 튄다.
     *   ① 자석 반경 밖(정지 상태) 오브는 제곱거리 한 번으로 즉시 버리고
     *   ② 커서로 나눠 한 틱에 budget개만 검사한다. 놓친 오브는 다음 틱에 걸린다.
     */
    updateOrbProjectiles(dt) {
        const g = this.greed;
        g.timer -= dt;
        if (g.timer > 0) return;
        g.timer += g.refreshSec;

        const orbs = this.combat.orbs.active;
        if (!orbs.length) return;
        const now = this.scene.time.now;
        const px = this.player.x, py = this.player.y;
        const mag = 48 * this.stats.get("magnet");
        const mag2 = mag * mag;
        const dmg = g.damage * this.stats.get("damage");

        let checked = 0;
        for (let n = 0; n < orbs.length && checked < g.budget; n++) {
            if (g.cursor >= orbs.length) g.cursor = 0;
            const o = orbs[g.cursor++];
            if (!o || dist2(o.x, o.y, px, py) > mag2) continue;
            checked++;
            const cands = this.combat.hash.query(o.x, o.y, g.radius, this.queryBuf);
            for (const e of cands) {
                if (!e.__active || e.hp <= 0) continue;
                if ((e.orbHitAt ?? 0) > now) continue;
                const rr = e.radius + g.radius;
                if (dist2(o.x, o.y, e.x, e.y) > rr * rr) continue;
                e.orbHitAt = now + g.rehitMs;
                // 오브는 별개 피해원이다 — 근접/시야 보정을 태우지 않는다
                this.dmgHook(e, dmg, 0, null);
            }
        }
    }

    /** T415 — 화면 밖 적을 화면 테두리에 붉은 점으로 투영한다 */
    updateNyx(dt) {
        const b = this.blind;
        b.timer -= dt;
        if (b.timer <= 0) {
            b.timer += b.refreshSec;
            // ★ 대상 선정만 0.15s 간격이다. 그리기는 매 프레임 — 적 참조를 들고 있으니
            //   좌표는 저절로 따라오고, 마커가 끊겨 보이지 않는다
            b.marks.length = 0;
            const cands = this.combat.hash.query(this.player.x, this.player.y, b.scanRadius, this.queryBuf);
            for (const e of cands) {
                if (b.marks.length >= b.max) break;
                if (e.__active && this.isOffscreen(e)) b.marks.push(e);
            }
        }
        this.drawMarkers(b);
    }

    drawMarkers(b) {
        const g = b.gfx;
        g.clear();
        if (!b.marks.length) return;
        const v = this.scene.cameras.main.worldView;
        const cx = v.centerX, cy = v.centerY;
        const hw = v.width / 2 - 8, hh = v.height / 2 - 8;
        g.fillStyle(b.color, 0.85);
        for (let i = 0; i < b.marks.length; i++) {
            const e = b.marks[i];
            if (!e.__active) continue;
            const dx = e.x - cx, dy = e.y - cy;
            // 화면 테두리로 투영 — 가로/세로 중 먼저 벽에 닿는 쪽이 배율을 정한다
            const s = Math.min(hw / (Math.abs(dx) || 0.0001), hh / (Math.abs(dy) || 0.0001));
            g.fillCircle(cx + dx * s, cy + dy * s, b.size);
        }
    }

    // ══ 발동 연출 (T420~T424, T426) ═════════════════════════════
    // 정본 04-PACT 5.2: "이 연출에 하루의 1/4을 써도 아깝지 않다. 이게 대표 스크린샷이 된다."

    /**
     * ★ 역할 분담 — 히트스톱/흔들림/심홍 플래시는 FxSystem이 정본이다(09-ART 7.2/7.3).
     *   같은 scene.timeScale을 두 시스템이 각자 저장·복원하면 히트스톱이 겹칠 때
     *   시간이 0에 굳는다. FxSystem은 토큰으로 중첩을 처리하므로 그쪽에 맡기고,
     *   FxSystem이 없을 때만(연출을 통째로 잘라낸 빌드) 자체 폴백을 쓴다.
     *   흑백 반전·충격파·오라는 FxSystem에 없다 — 여기가 유일한 주인이다.
     */
    present(def) {
        // T426 — 사운드는 호출만 한다. AudioSystem이 스텁이어도 게임은 정상 동작해야 한다.
        // AudioSystem이 AWAKENING_TRIGGERED 도 구독하고 있어 이벤트 경로와 겹치지만,
        // 8ms 중복 억제(T613)가 잡는다. 치트/테스트처럼 이벤트가 안 나가는 경로에서도
        // 소리가 나야 하므로 여기서도 직접 부른다.
        this.scene.audio?.sfx(PRES.sfxKey);

        const fx = this.combat?.fx;
        if (typeof fx?.awakenBurst === "function") {
            fx.hitStop(PRES.hitstop * 1000); // T420
            fx.awakenBurst();                // T421 심홍 플래시 + 화면 흔들림
        } else {
            this.hitStop(PRES.hitstop * 1000);
            const c = hex(PRES.flashColor);
            this.scene.cameras.main.flash(PRES.invertDuration * 1000, (c >> 16) & 255, (c >> 8) & 255, c & 255);
        }

        this.invert();
        this.shockwave();
        // 오라 색으로 한 번 더 흩뿌린다 — 어느 저주가 뒤집혔는지 색으로 먼저 읽힌다
        this.emitBurst(this.player.x, this.player.y, hex(def.auraColor), BURST_DOTS, 130);
    }

    /**
     * T420 히트스톱 0.2s — FxSystem이 없을 때만 쓰는 폴백.
     * ★ GameScene.update가 dt에 곱하는 scene.timeScale이 이 게임 시간축의 유일한 스위치다.
     *   해제 타이머는 Phaser 자체 시계라 timeScale 0의 영향을 받지 않는다.
     *   각성은 씬이 pause된 상태에서 불리므로 타이머는 resume 직후부터 흐른다.
     */
    hitStop(ms) {
        if (this.hitStopRestore !== null) return; // 중첩 방지
        const scene = this.scene;
        this.hitStopRestore = scene.timeScale ?? 1;
        scene.timeScale = 0;
        scene.time.delayedCall(ms, () => {
            scene.timeScale = this.hitStopRestore ?? 1;
            this.hitStopRestore = null;
        });
    }

    /**
     * T421 흑백 반전 0.15s.
     *
     * ★ 반전 수단이 렌더러마다 다르다.
     *   WebGL — 카메라 postFX ColorMatrix(grayscale -> negative). 셰이더 한 장이면 끝난다.
     *   Canvas — postFX가 없다. 흰 사각형을 DIFFERENCE로 덮으면 |255 - src| = 반전이다.
     *   어느 쪽도 각성 1회당 0.15초만 켜지므로 상시 렌더 비용은 0이다.
     *   커스텀 파이프라인을 새로 작성하지 않는 이유: 저사양 안드로이드에서 셰이더
     *   컴파일이 실패하면 화면 전체가 검게 죽는다. 실패해도 심홍 플래시만 남으면 된다.
     */
    invert() {
        const scene = this.scene;
        const ms = PRES.invertDuration * 1000;
        const fx = scene.cameras.main.postFX;
        if (fx && typeof fx.addColorMatrix === "function") {
            const cm = fx.addColorMatrix();
            cm.grayscale(1, false);
            cm.negative(true);
            scene.time.delayedCall(ms, () => fx.remove(cm));
            return;
        }
        const inv = this.getInvertRect();
        inv.setAlpha(1).setVisible(true);
        scene.tweens.add({
            targets: inv, alpha: 0, duration: ms, ease: "Quad.In",
            onComplete: () => inv.setVisible(false),
        });
    }

    /** T423 원형 충격파 — 화면 내 전체 넉백 + 2초 스턴 */
    shockwave() {
        const p = this.player;
        const r = PRES.shockwaveRadius;
        const kb = PRES.shockwaveKnockback;
        const stunMs = PRES.shockwaveStun * 1000;
        const now = this.scene.time.now;
        const r2 = r * r;

        this.stunned.length = 0;
        const cands = this.combat.hash.query(p.x, p.y, r, this.queryBuf);
        for (const e of cands) {
            if (!e.__active) continue;
            const d2 = dist2(e.x, e.y, p.x, p.y);
            if (d2 > r2) continue;
            // 넉백 방향 정규화에만 sqrt를 쓴다. 각성 순간 1회, 화면 내 한정이라 예산 안이다
            const d = Math.sqrt(d2) || 1;
            e.kbx = ((e.x - p.x) / d) * kb;
            e.kby = ((e.y - p.y) / d) * kb;
            e.stunUntil = now + stunMs; // EnemyAISystem 패치 지점 (보고서 참조)
            this.stunned.push(e);
        }
        this.stunUntil = now + stunMs;

        const ring = this.getRing(r);
        ring.setPosition(p.x, p.y).setScale(0.05).setAlpha(0.95).setVisible(true);
        this.scene.tweens.add({
            targets: ring, scale: 1, alpha: 0, duration: 420, ease: "Cubic.Out",
            onComplete: () => ring.setVisible(false),
        });
    }

    getInvertRect() {
        if (this.invertRect) return this.invertRect;
        // ★ 한 번 만들고 캐시하므로 그 뒤 회전으로 폭이 바뀌면 크기가 어긋난다.
        //   카메라 실측 대신 논리 가로 상한(864)으로 깔고 넘치는 부분은 잘리게 둔다.
        const r = this.scene.add.rectangle(0, 0, MAX_LOGICAL_WIDTH, LOGICAL_HEIGHT, 0xffffff);
        r.setOrigin(0, 0);
        r.setScrollFactor(0).setDepth(DEPTH.HUD + 900).setVisible(false);
        r.setBlendMode(Phaser.BlendModes.DIFFERENCE);
        this.invertRect = r;
        return r;
    }

    getRing(radius) {
        if (this.ring) return this.ring;
        const r = this.scene.add.circle(0, 0, radius);
        r.setStrokeStyle(3, hex(PRES.flashColor), 1).setDepth(DEPTH.FX).setVisible(false);
        this.ring = r;
        return r;
    }

    // ══ 상시 오라 / 파편 (T424) ═════════════════════════════════

    /**
     * 태그별 색 오라. 각성 1개당 입자 8개를 발동 시점(씬 정지 중)에 한 번만 만든다.
     * ★ 런 중 new 금지 원칙 — 최대 2각성 = 16개가 상한이고 그 뒤로는 위치만 바뀐다.
     */
    spawnAura(def) {
        const color = hex(def.auraColor);
        const dots = [];
        for (let i = 0; i < AURA_DOTS; i++) {
            const d = this.scene.add.circle(this.player.x, this.player.y, 2, color, 0.9);
            d.setDepth(DEPTH.FX);
            dots.push(d);
        }
        const idx = this.auras.length;
        this.auras.push({ dots, phase: idx * Math.PI, spin: 1.6 + idx * 0.6, r: 16 + idx * 7 });
    }

    updateAura(dt) {
        for (let a = 0; a < this.auras.length; a++) {
            const au = this.auras[a];
            au.phase += dt * au.spin;
            const step = (Math.PI * 2) / au.dots.length;
            for (let i = 0; i < au.dots.length; i++) {
                const ang = au.phase + step * i;
                const rr = au.r + Math.sin(au.phase * 2 + i) * 3;
                const d = au.dots[i];
                // y를 0.6배로 눌러 바닥에 붙은 타원 궤도로 보이게 한다 (탑다운 원근)
                d.x = this.player.x + Math.cos(ang) * rr;
                d.y = this.player.y + Math.sin(ang) * rr * 0.6;
                d.setAlpha(0.3 + 0.5 * (0.5 + 0.5 * Math.sin(ang)));
            }
        }
    }

    /** 피 폭발·부활 파편 공용 풀. 살아 있는 조각은 빼앗지 않는다 */
    emitBurst(x, y, color, n, speed) {
        const arr = this.ensureBurst();
        const now = this.scene.time.now;
        let spawned = 0;
        for (let i = 0; i < arr.length && spawned < n; i++) {
            const c = arr[this.burstCursor];
            this.burstCursor = (this.burstCursor + 1) % arr.length;
            if (c.until > now) continue;
            const a = Math.random() * Math.PI * 2;
            c.setPosition(x, y).setFillStyle(color, 1).setAlpha(1).setVisible(true);
            c.vx = Math.cos(a) * speed;
            c.vy = Math.sin(a) * speed;
            c.until = now + BURST_MS;
            spawned++;
        }
    }

    ensureBurst() {
        if (this.burst) return this.burst;
        const arr = [];
        for (let i = 0; i < BURST_DOTS; i++) {
            const c = this.scene.add.circle(-999, -999, 2, 0xffffff, 1);
            c.setDepth(DEPTH.FX).setVisible(false);
            c.until = 0; c.vx = 0; c.vy = 0;
            arr.push(c);
        }
        this.burst = arr;
        return arr;
    }

    updateBurst(dt, now) {
        const arr = this.burst;
        if (!arr) return;
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (c.until <= now) {
                if (c.visible) c.setVisible(false).setPosition(-999, -999);
                continue;
            }
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.vx *= 0.92;
            c.vy *= 0.92;
            c.setAlpha((c.until - now) / BURST_MS);
        }
    }
}

export { AWAKEN_STACKS };
