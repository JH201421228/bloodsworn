/**
 * validateData / runRules — JSON 데이터 검증. (T322 + 교차 검증 확장)
 *
 * ★ 왜 필요한가: 데이터를 JSON으로 뺀 이유는 밸런싱을 코드 수정 없이 하기 위해서다.
 *   그런데 오타 하나(쉼표 누락이 아니라 `damge: 12` 같은 키 오타)는 JSON 파서를 통과하고
 *   런타임에 `undefined` 가 되어 데미지가 NaN 이 된다. NaN 은 비교가 전부 false 라
 *   "적이 죽지 않는다"로 나타나고, 원인을 찾는 데 반나절이 든다.
 *
 * ★ 그보다 더 조용한 사고는 **파일 사이**에서 난다. 한 파일만 보면 전부 정상인데
 *   `enemies.json` 의 stageAffinity 와 `stages.json` 의 계열 믹스가 어긋나
 *   그 스테이지에 적이 한 마리도 안 나온 적이 있다. 크래시가 아니라 "빈 맵"이라
 *   사람이 눈으로 볼 때까지 몇 시간이 걸렸다. 그래서 교차 참조를 전수 검사한다.
 *
 * ★ 예외를 던지지 않는다. 게임이 아예 안 켜지면 밸런싱 작업 자체가 막힌다.
 *   콘솔에 모아서 크게 찍고 계속 진행한다. 프로덕션 빌드에서는 호출되지 않는다.
 *
 * ★ 규칙 본체(runRules)는 순수 함수다 — 데이터 묶음을 받아 위반 목록만 돌려준다.
 *   브라우저는 아래 validateData() 가 정적 import 로, 노드는 tools/validate-data.mjs 가
 *   fs 로 묶음을 만들어 같은 runRules 를 부른다. 규칙을 두 벌 쓰면 반드시 어긋난다.
 *
 * ★ 각 규칙 옆에 **그 필드를 실제로 읽는 코드 위치**를 적어 두었다.
 *   검증기가 코드보다 낡으면 오탐을 낸다 — 예전에 낡은 필드명을 보다가 460건을 뱉었다.
 *   코드를 고치면 그 주석을 단서로 여기도 같이 고쳐라.
 */
import weapons from "./weapons.json" with { type: "json" };
import enemies from "./enemies.json" with { type: "json" };
import blessings from "./blessings.json" with { type: "json" };
import tolls from "./tolls.json" with { type: "json" };
import phases from "./phases.json" with { type: "json" };
import nocturne from "./nocturneLines.json" with { type: "json" };
import stages from "./stages.json" with { type: "json" };
import boss from "./boss.json" with { type: "json" };
import bossAtlas from "./boss-atlas.json" with { type: "json" };
import items from "./items.json" with { type: "json" };
import affixes from "./affixes.json" with { type: "json" };
import droptables from "./droptables.json" with { type: "json" };
import projectiles from "./projectiles.json" with { type: "json" };
import awakenings from "./awakenings.json" with { type: "json" };
import sanctum from "./sanctum.json" with { type: "json" };
import audio from "./audio.json" with { type: "json" };
// 스탯 이름은 문자열 목록을 여기 복사하면 안 된다. 코드가 쓰는 표를 그대로 가져온다 —
// 복사본은 반드시 낡는다(StatSystem.js:13 BASE / :36 FLOORS).
import { BASE_STATS, STAT_FLOORS } from "../game/systems/StatSystem.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string" && v.length > 0;

/** 위반 수집기. 던지지 않고 모은다 — 한 건 때문에 나머지 검사를 놓치면 안 된다 */
function makeReport() {
    const errors = [];
    const warns = [];
    return {
        errors,
        warns,
        /** 조용한 오작동을 낳는다 = 반드시 고쳐야 한다 */
        err: (m) => errors.push(m),
        /** 폴백이 있어 굴러는 간다 = 의도와 다르다는 신호 */
        warn: (m) => warns.push(m),
    };
}

/** 한 객체에 대해 {키: 검사함수} 표를 돌린다 */
function checkShape(R, where, obj, shape) {
    if (!obj || typeof obj !== "object") { R.err(`${where}: 객체가 아니다`); return; }
    for (const [key, test] of Object.entries(shape)) {
        if (!test(obj[key])) R.err(`${where}.${key} = ${JSON.stringify(obj[key])} (형식 위반)`);
    }
}

// ── 코드에 하드코딩된 값들의 거울 ────────────────────────────────
// 여기 있는 값은 전부 "데이터가 아니라 코드가 정한 것"이다. 데이터가 이 밖으로 나가면
// 코드가 조용히 무시한다(에러도 안 난다). 코드를 고치면 여기도 같이 고쳐야 한다.

/** 예고 절대 하한. BossSystem.js:69 MIN_TELEGRAPH / StageSystem.js:81 — 같은 값·같은 근거(T525) */
const MIN_TELEGRAPH = 0.6;
/** BossSystem.js:250 `this.byPhase = {1:[],2:[],3:[]}` — 1~3 밖의 phase 는 push 에서 터진다 */
const BOSS_PHASE_MAX = 3;
/** BossSystem.js:771 playAnim 호출 이름. 체인 폴백은 ruleBossSheets 의 ANIM_FALLBACK 참고 */
const BOSS_ANIM_KEYS = ["idle", "cast", "attack", "spell", "death"];
/** BossSystem.js:772~780 패턴 type 디스패치. 그 외는 아무 일도 안 일어난다 */
const BOSS_PATTERN_TYPES = ["cone", "projectile", "summon", "ground_aoe", "dash", "buff"];
/** StageSystem.js:359~367 update() 의 switch. 그 외 type 은 기믹이 통째로 없는 것과 같다 */
const GIMMICK_TYPES = ["sanctuary", "haze", "mire", "rockfall", "emberwind"];
/** StageSystem.js:348~353 gimmickScale(). off/reduced 외는 전부 1 로 취급된다 */
const DURING_BOSS = ["off", "reduced", "on"];
/** ItemSystem.js:155 `this.equipped = {fang,hide,charm}` — 리터럴이라 다른 슬롯은 유령 키가 된다 */
const EQUIP_SLOTS = ["fang", "hide", "charm"];
/** ItemSystem.js:246 resetRules() 의 플래그 이름. 그 외 rule 은 :634 에서 조용히 무시된다 */
const RELIC_RULES = ["magnetPulse", "slowAura", "secondWind", "goldSalvage", "burstOnUse"];
/** ItemSystem.js:599~616 applyUse() 가 실제로 처리하는 type. 그 외는 먹어도 아무 일이 없다 */
/** SanctumSystem.js 의 STAT_ALIAS 거울. 데이터 이름 -> StatSystem 키 */
const SANCTUM_ALIAS = { damageMult: "damage", speedMult: "moveSpeed" };
/** SanctumSystem.applySpecial 이 처리하는 special id 거울 */
const SANCTUM_SPECIALS = ["reroll_plus", "awaken_threshold_reduce"];

const USE_EFFECT_TYPES = ["heal", "healPct", "buff", "bomb", "slow", "exp"];
/** ItemSystem.js:564~569 pickup() 의 카테고리 분기 */
const ITEM_CATEGORIES = ["use", "gold", "relic", "equip"];
/** AwakeningSystem.js:141~146 tag switch. 여기 없는 태그는 각성해도 특수 효과가 안 붙는다 */
const AWAKEN_TAGS = ["FRAIL", "SLOW", "HUNGER", "MYOPIA", "GREED", "BLIND"];
/** StatSystem.js:97~105 recalc() 가 아는 연산자 */
const STAT_OPS = ["add", "mul", "toll", "tollAdd", "awaken"];
/** PactSystem.js:217~225 choose() 의 op 분기 */
const BLESSING_OPS = ["add", "mul", "weapon"];
/** 웨이브 곡선 허용 배수 — 정본 stage1 대비. 이 밖이면 공식이 다시 틀어진 것이다 */
const CURVE_LO = 0.5;
const CURVE_HI = 2.0;

const has = (arr, v) => arr.includes(v);
const idSet = (arr, key = "id") => new Set((arr ?? []).map((x) => x?.[key]));

// ── 1. 파일 내부 형식 ────────────────────────────────────────────

/** 무기: levels 가 maxLevel보다 짧으면 만렙 근처에서 levels[lv-1] 이 undefined 가 된다.
 *  읽는 곳: CombatSystem.js:195 `w.s = def.levels[lv - 1]` */
function ruleWeapons(R, D) {
    for (const w of D.weapons.weapons ?? []) {
        checkShape(R, `weapon ${w.id}`, w, { id: isStr, name: isStr, type: isStr, maxLevel: isNum });
        if (!Array.isArray(w.levels) || w.levels.length !== w.maxLevel) {
            R.err(`weapon ${w.id}: levels 길이 ${w.levels?.length} != maxLevel ${w.maxLevel}`);
            continue;
        }
        // type 별 필수 수치. 읽는 곳: CombatSystem.js:222(melee_arc) :250(projectile)
        //                            :648(orbit) / ZoneSystem(zone)
        const required = {
            melee_arc: ["damage", "cooldown", "radius", "arcDeg", "knockback"],
            projectile: ["damage", "cooldown", "range", "count", "pierce", "speed", "knockback"],
            orbit: ["damage", "radius", "count", "degPerSec", "rehit", "knockback"],
            zone: ["damage", "cooldown", "drops", "radius", "duration", "tick", "scatter"],
        }[w.type];
        if (!required) { R.err(`weapon ${w.id}: 알 수 없는 type "${w.type}"`); continue; }
        w.levels.forEach((lv, i) => {
            for (const k of required) if (!isNum(lv[k])) R.err(`weapon ${w.id} Lv${i + 1}.${k} 누락/비숫자`);
        });
    }
}

/** 적: 필드명은 08-DATA-SCHEMA 정본을 따른다 — baseHp/contactDamage/moveSpeed/hitbox 이지
 *  hp/damage/speed 가 아니다. 읽는 곳: SpawnSystem.js:288~296 reset().
 *  hitbox 는 **스칼라**다(:292 `def.hitbox / 2`). boss.json 만 {w,h} 를 쓴다. */
function ruleEnemies(R, D) {
    for (const e of D.enemies.enemies ?? []) {
        checkShape(R, `enemy ${e.id}`, e, {
            id: isStr, name: isStr, baseHp: isNum, contactDamage: isNum,
            moveSpeed: isNum, hitbox: isNum, expValue: isNum,
        });
        if (e.stageAffinity && !Array.isArray(e.stageAffinity)) {
            R.err(`enemy ${e.id}: stageAffinity 는 배열이어야 한다`);
        }
        // family 는 StageSystem.js:81 이 계열 색인의 키로 쓴다. 오타 하나면 그 적은
        // 어떤 스테이지 믹스에도 안 걸려 영원히 안 나온다.
        if (!isStr(e.family)) R.err(`enemy ${e.id}: family 누락`);
        if (!isStr(e.ai)) R.err(`enemy ${e.id}: ai 누락 (EnemyAISystem.js:88 이 읽는다)`);
    }
}

/** 축복: op 별로 필요한 필드가 다르다. 등급 3단계 값이 2개만 있으면
 *  PactSystem.js:188 `b.value[tier]` 가 undefined 가 되어 Epic 카드가 0% 로 적용된다.
 *  읽는 곳: PactSystem.js:185~196 describeBlessing / :217~225 choose */
function ruleBlessings(R, D) {
    const wids = idSet(D.weapons.weapons);
    for (const b of D.blessings.blessings ?? []) {
        checkShape(R, `blessing ${b.id}`, b, { id: isStr, name: isStr, op: isStr, maxLevel: isNum });
        if (!has(BLESSING_OPS, b.op)) {
            // choose() 는 else 없이 떨어진다 — 카드를 골라도 아무 일이 안 일어난다.
            R.err(`blessing ${b.id}: op "${b.op}" 는 PactSystem 이 모른다 (${BLESSING_OPS.join("/")})`);
            continue;
        }
        if (b.op === "weapon") {
            if (!isStr(b.target)) R.err(`blessing ${b.id}: weapon 인데 target 이 없다`);
            else if (!wids.has(b.target)) R.err(`blessing ${b.id}: target ${b.target} 무기가 weapons.json 에 없다`);
            continue;
        }
        if (!isStr(b.stat)) R.err(`blessing ${b.id}: stat 이 없다`);
        else if (!(b.stat in BASE_STATS)) R.err(`blessing ${b.id}: stat "${b.stat}" 은 StatSystem BASE 에 없다`);
        if (!Array.isArray(b.value) || b.value.length !== 3 || !b.value.every(isNum)) {
            R.err(`blessing ${b.id}: value 는 [common, rare, epic] 숫자 3개여야 한다`);
        }
    }
    // fallback 이 없으면 후보가 바닥났을 때 PactSystem.js:78 이 undefined 카드를 만든다
    if (!D.blessings.fallback?.id) R.err("blessings.fallback 이 없다 (PactSystem.js:78)");
}

/** 대가: 안전장치 S1 — 하한 없는 대가가 하나라도 있으면 밸런스가 붕괴한다.
 *  ★ floor 는 데이터에도 있지만 실제 하한은 StatSystem.js:36 FLOORS 표가 건다
 *    (PactSystem.js:176 isAtFloor → stats.floorOf). 그 표에 없는 stat 은
 *    데이터에 floor 를 적어 놔도 무제한으로 깎인다 — 그래서 양쪽을 다 본다.
 *  읽는 곳: PactSystem.js:199~212 describeToll */
function ruleTolls(R, D) {
    for (const t of D.tolls.tolls ?? []) {
        checkShape(R, `toll ${t.tag}`, t, { tag: isStr, stat: isStr });
        if (!isNum(t.rate)) R.err(`toll ${t.tag}: rate 누락/비숫자 (amount 아니다)`);
        if (!isNum(t.floor)) R.err(`toll ${t.tag}: floor(S1 하한) 누락`);
        if (!(t.stat in BASE_STATS)) R.err(`toll ${t.tag}: stat "${t.stat}" 은 StatSystem BASE 에 없다`);
        else if (!(t.stat in STAT_FLOORS)) {
            R.err(`toll ${t.tag}: stat "${t.stat}" 에 STAT_FLOORS 항목이 없다 — S1 하한이 실제로는 안 걸린다`);
        }
    }
    for (const k of ["rarityMult", "rarityStacks", "humanityCost", "rarityWeights"]) {
        for (const r of ["common", "rare", "epic"]) {
            if (!isNum(D.tolls[k]?.[r])) R.err(`tolls.${k}.${r} 누락 (PactSystem.js:43/99/147/199)`);
        }
    }
}

/** 페이즈: 시간 순서가 단조 증가해야 한다. 뒤집히면 구간이 영원히 안 온다.
 *  읽는 곳: SpawnSystem.js:88/60 (segments 를 앞에서부터 소비) */
function rulePhases(R, D) {
    const walk = (name, arr) => {
        let prev = -1;
        (arr ?? []).forEach((p, i) => {
            const t = p.t ?? p.startSec ?? p.start ?? p.at;
            if (!isNum(t)) { R.err(`${name}[${i}]: 시작 시각이 없다`); return; }
            if (t <= prev) R.err(`${name}[${i}]: 시작 시각 ${t} 가 직전 ${prev} 이하다`);
            prev = t;
        });
    };
    walk("phases.phases", D.phases.phases);
    // ★ segments 도 봐야 한다. 예전 검증기는 phases(4개)만 보고 segments(12개)를 통째로 놓쳤다.
    walk("phases.segments", D.phases.segments);
    for (const s of D.phases.segments ?? []) {
        for (const k of ["hpMult", "dmgMult", "interval", "cap"]) {
            if (!isNum(s[k])) R.err(`phases.segments[t=${s.t}].${k} 누락 (SpawnSystem.js:288/291/165)`);
        }
    }
}

/** 녹턴: 1줄 22자 초과는 UI에서 잘린다 (10-UIUX §1340) */
function ruleNocturne(R, D) {
    const n = D.nocturne;
    if (!n) return;
    const lines = [...(n.pool ?? []), n.first, ...(n.awaken ?? [])].filter(isStr);
    if ((n.pool?.length ?? 0) < 12) R.err(`nocturne: 대사가 ${n.pool?.length}개 (최소 12)`);
    for (const l of lines) if (l.length > 22) R.err(`nocturne: "${l}" 가 22자를 넘는다 (${l.length}자)`);
}

// ── 2. 파일 사이(교차) ──────────────────────────────────────────

/**
 * ★ 사고 1번: stage2 의 적 풀이 0 이었다.
 *   `enemies.json` 의 stageAffinity 와 `stages.json` 의 계열 믹스를 서로 다른 작업이 써서
 *   어긋났고, 그 스테이지는 적이 한 마리도 안 나왔다. 크래시는 없었다.
 *
 * 지금은 StageSystem.js:215~217 에 "비면 계열 전체로 내려간다"는 안전망이 있지만,
 * 그건 사고를 **감추는** 장치다(경고 한 줄만 남는다). 의도한 적이 안 나오는 건 그대로다.
 * 그래서 여기서는 폴백이 있어도 error 로 올린다.
 *
 * 읽는 곳: StageSystem.js:81~83 (byFamily 색인: !swarmOnly && tier==="normal")
 *          StageSystem.js:83 affinityOf (stageAffinity 비었으면 전체 허용)
 *          StageSystem.js:204~221 weightsAt
 */
function ruleStageEnemyPools(R, D) {
    const all = D.enemies.enemies ?? [];
    // StageSystem 의 색인 조건을 그대로 복제한다. 조건이 코드와 어긋나면 이 규칙은 무용지물이다.
    const spawnable = all.filter((e) => !e.swarmOnly && (!e.tier || e.tier === "normal"));
    const famsInData = new Set(all.map((e) => e.family));
    const stageIds = new Set((D.stages.stages ?? []).map((s) => s.id));

    for (const st of D.stages.stages ?? []) {
        const mix = st.waves?.mix;
        if (!mix) continue; // waves.inherit === "phases" 는 id 가중치를 직접 쓴다(아래 ruleWaveWeights)
        let prevT = -1;
        for (const band of mix) {
            const t = band.t ?? 0;
            if (t <= prevT) R.err(`${st.id}.waves.mix: 밴드 t=${t} 가 직전 ${prevT} 이하다 (StageSystem.js:716 pickBand)`);
            prevT = t;
            const fams = Object.keys(band.families ?? {});
            if (!fams.length) { R.err(`${st.id}.waves.mix[t=${t}]: families 가 비었다 — 이 구간에 적이 안 나온다`); continue; }
            let share = 0;
            for (const fam of fams) {
                share += band.families[fam] ?? 0;
                if (!famsInData.has(fam)) {
                    R.err(`${st.id}.waves.mix[t=${t}]: 계열 "${fam}" 은 enemies.json 에 없다 — 이 몫만큼 적이 안 나온다`);
                    continue;
                }
                const inFam = spawnable.filter((e) => e.family === fam);
                const pool = inFam.filter((e) => !e.stageAffinity?.length || e.stageAffinity.includes(st.id));
                if (!pool.length) {
                    R.err(
                        `${st.id}.waves.mix[t=${t}]: 계열 "${fam}" x stageAffinity 교차 풀이 0 종이다`
                        + ` (계열 전체 ${inFam.length}종 / normal·!swarmOnly 기준)`
                        + " — StageSystem.js:250 폴백이 계열 전체로 내려가 의도와 다른 적이 나온다",
                    );
                }
            }
            if (share <= 0) R.err(`${st.id}.waves.mix[t=${t}]: 계열 몫 합계가 ${share} 다`);
        }
        // stageAffinity 에 적힌 스테이지 id 가 실제로 있어야 한다
        if (st.unlock?.stageId && !stageIds.has(st.unlock.stageId)) {
            R.err(`${st.id}.unlock.stageId "${st.unlock.stageId}" 스테이지가 없다 (StageSystem.js:109~115 evalUnlock)`);
        }
    }
    // 역방향: 어떤 스테이지에도 안 걸리는 stageAffinity 값은 오타다
    for (const e of all) {
        for (const a of e.stageAffinity ?? []) {
            if (!stageIds.has(a)) R.err(`enemy ${e.id}: stageAffinity "${a}" 스테이지가 stages.json 에 없다`);
        }
    }
}

/** 웨이브가 id 가중치를 직접 쓰는 경로(phases.json). 존재하지 않는 id / swarmOnly 는
 *  SpawnSystem.js:125~127 에서 경고만 남기고 통째로 빠진다 = 그만큼 적이 덜 나온다. */
function ruleWaveWeights(R, D) {
    const byId = new Map((D.enemies.enemies ?? []).map((e) => [e.id, e]));
    for (const seg of D.phases.segments ?? []) {
        for (const id of Object.keys(seg.weights ?? {})) {
            const def = byId.get(id);
            if (!def) { R.err(`phases.segments[t=${seg.t}].weights: 알 수 없는 적 id "${id}"`); continue; }
            if (def.swarmOnly) R.err(`phases.segments[t=${seg.t}].weights: "${id}" 는 swarmOnly 라 풀에서 제외된다`);
        }
    }
    // 스테이지 이벤트가 부르는 id (StageSystem.js:230~235 buildEvents → SpawnSystem.runEvents)
    for (const st of D.stages.stages ?? []) {
        const ev = st.waves?.events;
        if (!ev) continue;
        for (const e of ev.elite ?? []) {
            if (!byId.has(e.id)) R.err(`${st.id}.waves.events.elite[t=${e.t}]: 적 id "${e.id}" 가 없다`);
        }
        if (ev.swarm && !byId.has(ev.swarm.id)) R.err(`${st.id}.waves.events.swarm: 적 id "${ev.swarm.id}" 가 없다`);
    }
    for (const e of D.phases.events ?? []) {
        if (e.id && !byId.has(e.id)) R.err(`phases.events[t=${e.t}]: 적 id "${e.id}" 가 없다`);
    }
}

/**
 * ★ 사고 6번: BOSS6 이 어느 스테이지에도 배정돼 있지 않아 영원히 등장하지 않는다.
 *   정방향(스테이지→보스)만 보면 절대 안 잡힌다. 역방향을 반드시 같이 본다.
 *
 * 읽는 곳: StageSystem.js:133 `this.boss?.setBoss?.(st.bossId)`
 *          BossSystem.js:332~343 setBoss (this.defs[bossId], 없으면 경고 후 이전 보스 유지)
 */
function ruleBossAssignment(R, D) {
    const defs = D.boss.bosses ?? {};
    const assigned = new Set();
    for (const st of D.stages.stages ?? []) {
        if (!isStr(st.bossId)) { R.err(`${st.id}: bossId 가 없다`); continue; }
        assigned.add(st.bossId);
        if (!defs[st.bossId]) R.err(`${st.id}.bossId "${st.bossId}" 가 boss.json 에 없다 — 직전 스테이지 보스가 그대로 나온다`);
        // 보스 등장 시각. GameScene.js:147 (스테이지 진입 시 setBoss) 이 `elapsed >= def.spawnAt` 로 부른다.
        // runSec 를 넘으면 보스가 뜨기 전에 런이 끝난다.
        const d = defs[st.bossId];
        if (d && isNum(d.spawnAt) && isNum(st.runSec) && d.spawnAt > st.runSec) {
            R.err(`${st.id}: boss ${st.bossId}.spawnAt ${d.spawnAt}s 가 runSec ${st.runSec}s 보다 늦다 — 보스가 안 나온다`);
        }
    }
    for (const id of Object.keys(defs)) {
        if (!assigned.has(id)) R.err(`boss ${id}: 어느 스테이지의 bossId 도 아니다 — 영원히 등장하지 않는다`);
    }
}

/**
 * ★ 사고 3번: 보스 애니메이션 키가 "boss.*" 하드코딩이라 BOSS2~6 이 idle 외에
 *   아무것도 재생하지 않았다. `anims.exists()` 가드에 조용히 걸려 에러조차 안 났다.
 *
 * 지금 구조(BossSystem.js:128 ANIM_FALLBACK / :351 animKey)는 두 번 고쳐졌다 —
 *   ① 전용 시트에 없는 동작은 **같은 시트의 비슷한 동작**으로 내려간다(spell→cast→attack→idle).
 *   ② boss.* 로는 절대 내려가지 않는다. 스프라이트가 통째로 바뀌는 것보다 안 움직이는 게 낫다.
 *   그래서 지금의 위험은 "다른 보스 그림"이 아니라 **"시전 모션이 idle 로 때워진다"** 다.
 *   체인이 통째로 비면(=idle 조차 없으면) animKey 가 null 을 돌려주고 아무것도 안 움직인다.
 *
 * 읽는 곳: BossSystem.js:380~396 ensureAnims — bossAtlas.bosses 를 **key** 로 찾는다(id 아니다)
 *          BossSystem.js:384 `textures.exists(key)` — 텍스처가 없으면 등록 자체를 건너뛴다
 */
function ruleBossSheets(R, D) {
    // ★ BossSystem.js:128 ANIM_FALLBACK 의 거울. 체인이 바뀌면 여기도 바꿔야 한다.
    const ANIM_FALLBACK = {
        idle: ["idle"],
        walk: ["walk", "idle"],
        attack: ["attack", "cast", "idle"],
        cast: ["cast", "attack", "idle"],
        spell: ["spell", "cast", "attack", "idle"],
        death: ["death", "hurt", "idle"],
    };
    const atlasByKey = new Map((D.bossAtlas.bosses ?? []).map((b) => [b.key, b]));
    const sheetUsers = new Map();

    for (const [id, d] of Object.entries(D.boss.bosses ?? {})) {
        if (!d.sheet) {
            // BossSystem.js:355 — 시트가 없으면 공용 "boss" 시트가 자기 시트다. BOSS1 은 정상,
            // 나머지는 "전용 스프라이트를 아직 안 붙였다"는 뜻이라 알려는 준다.
            R.warn(`boss ${id}: sheet 가 없다 — 공용 boss 시트(BOSS1 그림)로 나온다`);
            continue;
        }
        if (!sheetUsers.has(d.sheet)) sheetUsers.set(d.sheet, []);
        sheetUsers.get(d.sheet).push(id);

        const meta = atlasByKey.get(d.sheet);
        if (!meta) {
            R.err(`boss ${id}: sheet "${d.sheet}" 가 boss-atlas.json 에 없다 — 애니가 하나도 등록되지 않는다`);
            continue;
        }
        const have = new Set((meta.anims ?? []).map((a) => a.key));
        for (const [name, chain] of Object.entries(ANIM_FALLBACK)) {
            const hit = chain.find((c) => have.has(c));
            if (!hit) R.err(`boss ${id}/${d.sheet}: "${name}" 체인 [${chain.join("→")}] 이 아틀라스에 하나도 없다 — 그 동작이 멈춘다`);
            else if (hit !== name) R.warn(`boss ${id}/${d.sheet}: anim "${name}" 이 없어 "${hit}" 으로 대체된다`);
        }
        // 아틀라스가 이 시트를 다른 보스의 것으로 적어 뒀다 = 그림 재사용이거나 배선 실수다
        if (meta.id && meta.id !== id) {
            R.warn(`boss ${id}: sheet "${d.sheet}" 는 아틀라스상 ${meta.id} 의 시트다 — 두 보스가 같은 그림이 된다`);
        }
        for (const a of meta.anims ?? []) {
            if (!isNum(a.from) || !isNum(a.to) || a.to < a.from) {
                R.err(`boss-atlas ${meta.key}.${a.key}: from/to 가 잘못됐다 (${a.from}~${a.to})`);
            }
        }
        // 8-10: 두 파일의 이름이 다르면 로그·기획서·UI 가 서로 다른 보스를 가리킨다
        if (isStr(meta.name) && isStr(d.name) && meta.name !== d.name) {
            R.warn(`boss ${id}: 이름이 다르다 — boss.json "${d.name}" vs boss-atlas.json "${meta.name}"`);
        }
    }
    for (const [sheet, users] of sheetUsers) {
        // ★ 라이선스가 확인된 스프라이트가 3종뿐이라 6보스가 돌려 쓰는 것은 **의도된 선택**이다
        //   (17-LICENSES 부록). tint·spriteScale·패턴 축으로 가르므로 위반이 아니라 경고다.
        //   불분명한 스프라이트를 쓰는 것보다 재사용이 낫다.
        if (users.length > 1) R.warn(`시트 "${sheet}" 를 ${users.join(", ")} 가 함께 쓴다 — tint/scale/패턴으로 갈라야 한다`);
    }
    for (const b of D.bossAtlas.bosses ?? []) {
        if (!sheetUsers.has(b.key)) R.warn(`boss-atlas "${b.key}"(${b.id}): 이 시트를 쓰는 보스가 없다 — 스프라이트가 놀고 있다`);
        if (b.id && !D.boss.bosses?.[b.id]) R.warn(`boss-atlas "${b.key}": id ${b.id} 가 boss.json 에 없다`);
        if (b.stage && !(D.stages.stages ?? []).some((s) => s.id === b.stage)) {
            R.warn(`boss-atlas "${b.key}": stage "${b.stage}" 가 stages.json 에 없다`);
        }
    }
}

/**
 * 텔레그래프 — 보스 패턴과 기믹의 예고는 전부 0.6s 이상이어야 한다(T525).
 * 코드는 Math.max 로 강제하고 console.error 를 찍지만(BossSystem.js:257 / StageSystem.js:290),
 * 그건 **런을 시작해야** 보인다. 커밋 전에 잡는 게 이 규칙의 목적이다.
 */
function ruleTelegraph(R, D) {
    for (const [id, d] of Object.entries(D.boss.bosses ?? {})) {
        const seen = new Set();
        for (const p of d.patterns ?? []) {
            const at = `boss ${id}/${p.id}(P${p.phase})`;
            // 필드명은 windup 이다(telegraph 아니다). BossSystem.js:257 Math.max(d.windup, 0.6)
            if (!isNum(p.windup)) R.err(`${at}: windup 누락`);
            else if (p.windup < MIN_TELEGRAPH) R.err(`${at}: windup ${p.windup}s < ${MIN_TELEGRAPH}s (T525)`);
            // BossSystem.js:250 `this.byPhase = {1:[],2:[],3:[]}` — 밖의 값은 push 에서 터진다
            if (!isNum(p.phase) || p.phase < 1 || p.phase > BOSS_PHASE_MAX) {
                R.err(`boss ${id}/${p.id}: phase ${p.phase} 는 1~${BOSS_PHASE_MAX} 밖이다 (BossSystem.js:250)`);
            } else seen.add(p.phase);
            if (!has(BOSS_PATTERN_TYPES, p.type)) R.err(`${at}: type "${p.type}" 은 BossSystem.js:772 디스패치에 없다`);
            if (!isNum(p.cooldown)) R.err(`${at}: cooldown 누락`);
            // BossSystem.js:950 `spawner.defs.find((d) => d.id === w.enemyId)`
            if (p.type === "summon" && p.params?.enemyId
                && !(D.enemies.enemies ?? []).some((e) => e.id === p.params.enemyId)) {
                R.err(`${at}: params.enemyId "${p.params.enemyId}" 가 enemies.json 에 없다`);
            }
        }
        for (let ph = 1; ph <= BOSS_PHASE_MAX; ph++) {
            if (!seen.has(ph)) R.err(`boss ${id}: P${ph} 에 패턴이 하나도 없다 — 그 페이즈에서 보스가 가만히 있는다`);
        }
        // phaseDef 는 **위치**로 읽는다(BossSystem.js:320 `phases[phase - 1]`). 적으면 P1 로 되돌아간다.
        if ((d.phases?.length ?? 0) < BOSS_PHASE_MAX) {
            R.err(`boss ${id}: phases 가 ${d.phases?.length}개 (${BOSS_PHASE_MAX}개 필요 — BossSystem.js:320)`);
        }
        // BossSystem.js:435 `Math.min(d.hitbox.w, d.hitbox.h) / 2` — 둘 다 있어야 한다
        if (!isNum(d.hitbox?.w) || !isNum(d.hitbox?.h)) R.err(`boss ${id}: hitbox.w/h 누락 (BossSystem.js:435)`);
        if (!isNum(d.spawnAt)) R.err(`boss ${id}: spawnAt 누락 (GameScene.js:147 이 등장 판정에 쓴다)`);
    }
    // 기믹 예고. StageSystem.js:289 `p.windup ?? p.telegraph ?? 0.8`
    for (const st of D.stages.stages ?? []) {
        const gm = st.gimmick;
        if (!gm) continue;
        if (!has(GIMMICK_TYPES, gm.type)) {
            R.err(`${st.id}.gimmick.type "${gm.type}" 는 StageSystem.js:359 switch 에 없다 — 기믹이 없는 것과 같다`);
            continue;
        }
        if (gm.duringBoss && !has(DURING_BOSS, gm.duringBoss)) {
            R.warn(`${st.id}.gimmick.duringBoss "${gm.duringBoss}" 는 미지의 값 — StageSystem.js:352 가 1(그대로)로 취급한다`);
        }
        if (gm.type === "rockfall" || gm.type === "emberwind") {
            const raw = gm.params?.windup ?? gm.params?.telegraph;
            if (!isNum(raw)) R.err(`${st.id}.gimmick.params.windup 누락 — 기본값 0.8s 로 굴러간다`);
            else if (raw < MIN_TELEGRAPH) R.err(`${st.id}.gimmick ${gm.type}: windup ${raw}s < ${MIN_TELEGRAPH}s (T525)`);
        }
    }
}

/**
 * ★ 사고 4번: 아이템 아이콘 좌표가 2건 중복돼 서로 다른 아이템이 같은 그림을 썼다.
 * ★ 사고 7번: `gold` 카테고리가 분기의 else 에 걸려 `equipped[undefined]` 유령 슬롯을 만들었다.
 *   분기는 고쳐졌지만(ItemSystem.js:564~569), slot 오타는 여전히 같은 유령 키를 만든다.
 *   equipped 는 {fang,hide,charm} 리터럴이라 그 밖의 슬롯은 장착도 해제도 안 된다.
 *
 * 읽는 곳: ItemSystem.js:395 `s.setTexture("items", b.icon)` — icon 은 아틀라스 프레임 이름 그대로
 *          ItemSystem.js:124 `"itm_halo_" + r.id` (등급별 후광은 파생 프레임이다)
 *          ItemSystem.js:172~185 buildIndex (category/slot/rarity 색인)
 *          src/ui/inventory/itemAtlas.js:24 (React 는 itemFrames.json 사본을 본다)
 */
function ruleItems(R, D) {
    const rarityIds = (D.items.rarities ?? []).map((r) => r.id);
    const slotIds = (D.items.slots ?? []).map((s) => s.id);

    for (const s of EQUIP_SLOTS) {
        if (!slotIds.includes(s)) R.err(`items.slots 에 "${s}" 가 없다 — ItemSystem.js:155 equipped 리터럴과 어긋난다`);
    }
    for (const s of slotIds) {
        if (!has(EQUIP_SLOTS, s)) R.err(`items.slots "${s}" 는 ItemSystem.js:155 equipped 에 없다 — 유령 슬롯이 된다`);
    }
    if (rarityIds[0] !== "common") {
        R.warn(`items.rarities[0] 이 "${rarityIds[0]}" 다 — ItemSystem.js:400 은 index 0 을 "후광 없음"으로 쓴다`);
    }

    for (const b of D.items.bases ?? []) {
        checkShape(R, `item ${b.id}`, b, { id: isStr, name: isStr, category: isStr, icon: isStr });
        if (!has(ITEM_CATEGORIES, b.category)) {
            R.err(`item ${b.id}: category "${b.category}" 는 ItemSystem.js:564 분기에 없다 — 주워도 아무 일이 없다`);
            continue;
        }
        if (b.category === "equip" && !slotIds.includes(b.slot)) {
            R.err(`item ${b.id}: equip 인데 slot "${b.slot}" 이 items.slots 에 없다 — equipped[undefined] 유령 슬롯이 된다`);
        }
        if (b.category === "relic") {
            if (!rarityIds.includes(b.rarity ?? "rare")) R.err(`item ${b.id}: relic rarity "${b.rarity}" 가 rarities 에 없다`);
            if (b.rule && !has(RELIC_RULES, b.rule)) {
                R.err(`item ${b.id}: rule "${b.rule}" 은 ItemSystem.js:246 에 없다 — 유물 효과가 안 켜진다`);
            }
        }
        if (b.category === "use" && !has(USE_EFFECT_TYPES, b.effect?.type)) {
            R.err(`item ${b.id}: effect.type "${b.effect?.type}" 은 ItemSystem.js:599~616 applyUse 가 처리하지 않는다 — 먹어도 아무 일이 없다(토스트는 뜬다)`);
        }
        if (b.category === "gold" && !isNum(b.effect?.value)) {
            R.err(`item ${b.id}: gold 인데 effect.value 가 없다 (ItemSystem.js:590)`);
        }
    }
    // 유물 최소 보증 — ItemSystem.js:283 이 boss 번들에서 "legendary" 를 직접 요구한다
    const legendary = (D.items.bases ?? []).filter((b) => b.category === "relic" && (b.rarity ?? "rare") === "legendary");
    if (!legendary.length) R.err("items: legendary 유물이 0종이다 — 보스 확정 드롭이 빈손이 된다 (ItemSystem.js:283)");
}

/** 아이콘 → 아틀라스 프레임. 프레임 표는 노드판에서만 읽을 수 있다(public/ 은 번들 밖이다).
 *  frames 가 없으면 이 규칙만 건너뛴다 — 나머지 검사를 막지 않는다. */
function ruleItemIcons(R, D) {
    const sources = [
        ["public/assets/items/items.json", D.itemAtlas],
        ["src/ui/inventory/itemFrames.json", D.itemFrames],
    ].filter(([, v]) => v);
    if (!sources.length) return;

    for (const [name, frames] of sources) {
        const names = Object.keys(frames);
        const set = new Set(names);
        for (const b of D.items.bases ?? []) {
            if (b.icon && !set.has(b.icon)) R.err(`item ${b.id}: icon "${b.icon}" 프레임이 ${name} 에 없다`);
        }
        for (const r of D.items.rarities ?? []) {
            if (!set.has("itm_halo_" + r.id)) R.err(`itm_halo_${r.id} 프레임이 ${name} 에 없다 (ItemSystem.js:124)`);
        }
        // ★ 좌표 중복 = 서로 다른 아이템이 같은 그림을 쓴다. 크래시가 아니라 "왜 둘이 똑같지?" 다.
        const byXy = new Map();
        for (const n of names) {
            const f = frames[n];
            const k = `${f.x},${f.y},${f.w},${f.h}`;
            if (!byXy.has(k)) byXy.set(k, []);
            byXy.get(k).push(n);
        }
        for (const [k, list] of byXy) {
            if (list.length > 1) R.err(`${name}: 좌표 [${k}] 를 ${list.length}개 프레임이 공유한다 — ${list.join(", ")}`);
        }
    }
    // 두 사본이 어긋나면 게임 화면과 인벤토리 UI 가 다른 그림을 그린다
    if (D.itemAtlas && D.itemFrames) {
        const a = new Set(Object.keys(D.itemAtlas));
        const b = new Set(Object.keys(D.itemFrames));
        for (const n of a) if (!b.has(n)) R.err(`프레임 "${n}" 이 itemFrames.json 사본에 없다 (인벤토리 UI 가 빈칸을 그린다)`);
        for (const n of b) if (!a.has(n)) R.warn(`프레임 "${n}" 이 itemFrames.json 에만 있다 (public 아틀라스에 없음)`);
    }
}

/** 드롭 테이블이 참조하는 카테고리·등급이 실제로 존재하는가.
 *  읽는 곳: ItemSystem.js:295~300 spawnOne / :334~358 rollRarity / :272~277 normalTable */
function ruleDroptables(R, D) {
    const rarityIds = new Set((D.items.rarities ?? []).map((r) => r.id));
    const catCount = {};
    for (const b of D.items.bases ?? []) catCount[b.category] = (catCount[b.category] ?? 0) + 1;

    const checkTable = (where, t) => {
        for (const k of Object.keys(t?.categoryWeights ?? {})) {
            if (!(k in catCount)) R.err(`droptables.${where}.categoryWeights "${k}" 카테고리의 아이템이 0종이다 — 그 몫은 꽝이 된다 (ItemSystem.js:297)`);
        }
        for (const k of Object.keys(t?.rarityWeights ?? {})) {
            if (!rarityIds.has(k)) R.err(`droptables.${where}.rarityWeights "${k}" 등급이 items.rarities 에 없다 — 조용히 무시된다`);
        }
    };
    (D.droptables.normal ?? []).forEach((t, i) => checkTable(`normal[${i}]`, t));
    checkTable("elite", D.droptables.elite);
    checkTable("boss", D.droptables.boss);
    checkTable("(top)", D.droptables);
    for (const k of Object.keys(D.droptables.tuning?.luckShiftTo ?? {})) {
        if (!rarityIds.has(k)) R.err(`droptables.tuning.luckShiftTo "${k}" 등급이 items.rarities 에 없다`);
    }
    // normal 은 phase 번호로 **위치** 색인한다. 페이즈보다 짧으면 마지막 표가 계속 쓰인다.
    const nPhase = (D.phases.phases ?? []).length;
    if ((D.droptables.normal ?? []).length < nPhase) {
        R.err(`droptables.normal 이 ${D.droptables.normal?.length}개인데 페이즈는 ${nPhase}개다 (ItemSystem.js:275)`);
    }
}

/** 무기 레벨의 projectile 이 유효한가. 없는 id 는 ProjectileSystem.js:159 에서
 *  경고 한 줄 남기고 null 을 돌려준다 — 그 무기는 **조용히 발사를 멈춘다**.
 *  읽는 곳: CombatSystem.js:279 `this.projectiles.fire(w.projectile, ...)` (w = levels[lv-1]) */
function ruleProjectiles(R, D) {
    const pids = idSet(D.projectiles.projectiles);
    const impacts = idSet(D.projectiles.impacts);
    const sheets = D.projectiles.sheets ?? {};

    for (const w of D.weapons.weapons ?? []) {
        (w.levels ?? []).forEach((lv, i) => {
            if (lv.projectile === undefined) return;
            if (!pids.has(lv.projectile)) {
                R.err(`weapon ${w.id} Lv${i + 1}: projectile "${lv.projectile}" 가 projectiles.json 에 없다 — 이 레벨부터 발사가 멈춘다`);
            }
        });
        // projectile 형 무기인데 어느 레벨에도 projectile 이 없으면 폴백 사각형이 날아간다
        if (w.type === "projectile" && !(w.levels ?? []).some((lv) => lv.projectile)) {
            R.warn(`weapon ${w.id}: projectile 형인데 어느 레벨에도 projectile 이 없다 — 폴백 텍스처가 나간다`);
        }
    }
    for (const p of D.projectiles.projectiles ?? []) {
        if (!sheets[p.sheet]) R.err(`projectile ${p.id}: sheet "${p.sheet}" 가 projectiles.sheets 에 없다 (ProjectileSystem.js:160)`);
        if (p.impact && !impacts.has(p.impact)) R.err(`projectile ${p.id}: impact "${p.impact}" 가 impacts 에 없다`);
    }
    for (const im of D.projectiles.impacts ?? []) {
        if (!sheets[im.sheet]) R.err(`impact ${im.id}: sheet "${im.sheet}" 가 projectiles.sheets 에 없다`);
    }
    for (const [k, s] of Object.entries(sheets)) {
        if (s.key !== k) R.err(`projectiles.sheets["${k}"].key 가 "${s.key}" 다 — ProjectileSystem 은 키로 텍스처를 찾는다`);
        if (!isNum(s.frameWidth) || !isNum(s.frameHeight)) R.err(`projectiles.sheets["${k}"]: frameWidth/Height 누락`);
    }
}

/** 모든 대가 태그가 awakenings.json 에 대응 각성을 갖는가 (양방향).
 *  읽는 곳: AwakeningSystem.js:41 BY_TAG / :111 lookup — 없으면 각성이 조용히 불발한다.
 *  ★ AwakeningSystem.js:141~146 의 switch 는 하드코딩이다. 새 태그를 데이터로 넣어도
 *    특수 효과는 안 붙는다 — 그래서 "코드가 아는 6종"과도 대조한다. */
function ruleAwakenings(R, D) {
    const awTags = new Set((D.awakenings.awakenings ?? []).map((a) => a.tag).filter(Boolean));
    const tollTags = new Set((D.tolls.tolls ?? []).map((t) => t.tag));

    for (const tag of tollTags) {
        if (!awTags.has(tag)) R.err(`toll "${tag}": 대응 각성이 awakenings.json 에 없다 — 3스택을 쌓아도 각성이 안 뜬다`);
        if (!has(AWAKEN_TAGS, tag)) R.err(`toll "${tag}": AwakeningSystem.js:141 switch 에 없는 태그다 — 각성해도 특수 효과가 안 붙는다`);
    }
    for (const tag of awTags) {
        if (!tollTags.has(tag)) R.err(`awakening tag "${tag}": 대응 대가가 tolls.json 에 없다 — 발동 경로가 없다`);
    }
    // humanityZero 각성(승천)은 AwakeningSystem.js:46 이 이름이 아니라 trigger.type 으로 찾는다
    if (!(D.awakenings.awakenings ?? []).some((a) => a.trigger?.type === "humanityZero")) {
        R.err("awakenings: trigger.type === \"humanityZero\" 인 승천 각성이 없다 (AwakeningSystem.js:46)");
    }
    for (const a of D.awakenings.awakenings ?? []) {
        for (const e of a.effects ?? []) {
            if (e.op === "special") { if (!isStr(e.id)) R.err(`awakening ${a.id}: special 효과에 id 가 없다`); continue; }
            if (!has(STAT_OPS, e.op)) R.err(`awakening ${a.id}: op "${e.op}" 를 StatSystem 이 모른다 (StatSystem.js:97)`);
            if (e.stat && !(e.stat in BASE_STATS)) R.err(`awakening ${a.id}: stat "${e.stat}" 이 StatSystem BASE 에 없다`);
        }
    }
    if (!D.awakenings.presentation) R.err("awakenings.presentation 이 없다 (AwakeningSystem.js:43)");
}

/** 어픽스·성소 — 스탯 이름이 코드 표에 없으면 모디파이어가 허공에 쌓인다 */
function ruleAffixesAndSanctum(R, D) {
    const rarities = D.items.rarities ?? [];
    const maxTier = Math.max(0, ...rarities.map((r) => r.affixTier ?? 0));
    for (const group of ["prefixes", "suffixes"]) {
        for (const a of D.affixes[group] ?? []) {
            checkShape(R, `affix ${a.id}`, a, { id: isStr, name: isStr, stat: isStr, op: isStr });
            if (!(a.stat in BASE_STATS)) R.err(`affix ${a.id}: stat "${a.stat}" 이 StatSystem BASE 에 없다`);
            if (!has(STAT_OPS, a.op)) R.err(`affix ${a.id}: op "${a.op}" 를 StatSystem 이 모른다`);
            // rarities[].affixTier 가 tiers 배열의 색인이다. 짧으면 undefined 배율이 붙는다.
            if (!Array.isArray(a.tiers) || a.tiers.length <= maxTier) {
                R.err(`affix ${a.id}: tiers 가 ${a.tiers?.length}개인데 items.rarities 의 최대 affixTier 는 ${maxTier} 다`);
            }
        }
    }
    for (const k of Object.keys(D.affixes.weights ?? {})) {
        if (!(k in BASE_STATS)) R.err(`affixes.weights "${k}" 은 StatSystem BASE 에 없다`);
    }
    for (const u of D.sanctum.upgrades ?? []) {
        checkShape(R, `sanctum ${u.id}`, u, { id: isStr, name: isStr, maxLevel: isNum });
        if (!Array.isArray(u.costs) || u.costs.length !== u.maxLevel) {
            R.err(`sanctum ${u.id}: costs 가 ${u.costs?.length}개 != maxLevel ${u.maxLevel} — 만렙 근처에서 비용이 undefined 가 된다`);
        }
        const e = u.effectPerLevel ?? {};
        if (e.op === "special") { if (!isStr(e.id)) R.err(`sanctum ${u.id}: special 인데 id 가 없다`); continue; }
        if (e.op !== "special" && !has(STAT_OPS, e.op)) R.warn(`sanctum ${u.id}: effectPerLevel.op "${e.op}" 를 StatSystem 이 모른다`);
        if (e.op === "special") {
            if (!has(SANCTUM_SPECIALS, e.id)) R.err(`sanctum ${u.id}: special "${e.id}" 을 SanctumSystem.applySpecial 이 모른다 — 사도 아무 효과가 없다`);
        } else {
            const key = SANCTUM_ALIAS[e.stat] ?? e.stat;
            if (!(key in BASE_STATS)) R.err(`sanctum ${u.id}: stat "${e.stat}" 이 StatSystem BASE 에도 STAT_ALIAS 에도 없다 — 그 업그레이드는 아무 효과가 없다`);
        }
        if (e.op !== "special" && !isNum(e.value)) R.err(`sanctum ${u.id}: effectPerLevel.value 누락/비숫자`);
    }
}

/** 오디오 — 트랙 키가 매니페스트에 없으면 그 층은 무음이다. 폴백이 없다.
 *  읽는 곳: PreloadScene.js:73 (manifest.audio) / AudioSystem 이 audio.json 의 key 로 재생 */
function ruleAudio(R, D) {
    const trackKeys = new Set((D.audio.tracks ?? []).map((t) => t.key));
    const refs = new Set();
    for (const p of D.audio.phases ?? []) {
        if (isStr(p.bed)) refs.add(p.bed);
        for (const l of p.layers ?? []) refs.add(typeof l === "string" ? l : l?.key);
    }
    for (const sc of Object.values(D.audio.screens ?? {})) {
        if (isStr(sc.bed)) refs.add(sc.bed);
        if (isStr(sc.intro)) refs.add(sc.intro);
        for (const l of sc.layers ?? []) refs.add(typeof l === "string" ? l : l?.key);
    }
    for (const r of refs) {
        if (isStr(r) && !trackKeys.has(r)) R.err(`audio: "${r}" 참조가 tracks 에 없다 — 그 층이 무음이다`);
    }
}

/**
 * ★ 사고 2번: 웨이브 곡선의 지수 밑이 **인덱스**였다.
 *   stage2 최종 hpMult 가 15.59 로, 정본 stage1 의 5.64 보다 3배 가까이 높았다.
 *   segmentSec 가 다르면 곡선이 통째로 달라지는데 아무도 눈치채지 못했다 —
 *   "적이 좀 딱딱하네" 로만 보인다.
 *
 * 그래서 여기서는 **결과값**을 검산한다. 공식을 다시 적어 검사하면 공식이 틀렸을 때
 * 검증기도 같이 틀린다. 정본은 stage1(phases.json segments 마지막)의 hpMult 다 —
 * 숫자를 여기 박아 두지 않고 데이터에서 가져온다.
 *
 * 읽는 곳: StageSystem.js:172~199 buildSegments (밑은 `min = t / 60`, 인덱스가 아니다)
 *          SpawnSystem.js:288 `def.baseHp * seg.hpMult`
 */
function ruleWaveCurve(R, D) {
    const canonSeg = (D.phases.segments ?? []).at(-1);
    const canon = canonSeg?.hpMult;
    if (!isNum(canon)) { R.err("phases.segments 마지막 hpMult 가 없다 — 곡선 검산의 기준이 사라진다"); return; }

    for (const st of D.stages.stages ?? []) {
        const w = st.waves ?? {};
        if (w.inherit === "phases") continue; // stage1 = 정본 그 자체
        const n = Math.max(1, w.segments ?? 12);
        const sec = w.segmentSec ?? 30;
        const c = w.curve ?? {};
        const lastT = (n - 1) * sec;
        const min = lastT / 60;
        const hp = 1 + (c.hpK ?? 0.4) * Math.pow(min, c.hpExp ?? 1.5);
        const ratio = hp / canon;
        if (ratio < CURVE_LO || ratio > CURVE_HI) {
            R.warn(
                `${st.id}: 최종 hpMult ${hp.toFixed(2)} 가 정본 stage1 ${canon} 의 ${ratio.toFixed(2)}배다`
                + ` (허용 ${CURVE_LO}~${CURVE_HI}) — 곡선 공식이 다시 틀어졌다는 신호다`,
            );
        }
        // 마지막 구간이 runSec 를 못 덮으면 그 뒤로는 배율이 멈춘 채 보스까지 간다
        if (isNum(st.runSec) && lastT + sec < st.runSec) {
            R.warn(`${st.id}: 웨이브가 ${lastT + sec}s 까지인데 runSec 는 ${st.runSec}s 다 — 마지막 ${st.runSec - lastT - sec}s 는 난이도가 멈춘다`);
        }
        for (const k of ["hpK", "hpExp", "dmgK", "dmgExp", "intervalFrom", "intervalTo", "capFrom", "capTo"]) {
            if (c[k] !== undefined && !isNum(c[k])) R.err(`${st.id}.waves.curve.${k} 가 숫자가 아니다`);
        }
    }
}

/** 텍스처 키가 매니페스트에 있는가. public/assets.json 은 번들 밖이라 노드판에서만 본다.
 *  읽는 곳: PreloadScene.js:37~73 queueFromManifest / StageSystem.js:250 (폴백 있음)
 *          BossSystem.js:384 `textures.exists(key)` — 없으면 애니 생성이 통째로 건너뛴다 */
function ruleManifest(R, D) {
    const M = D.manifest;
    if (!M) return;
    const tex = new Set([...(M.images ?? []), ...(M.spritesheets ?? []), ...(M.atlases ?? [])].map((e) => e.key));
    const aud = new Set((M.audio ?? []).map((e) => e.key));

    for (const [id, d] of Object.entries(D.boss.bosses ?? {})) {
        if (d.sheet && !tex.has(d.sheet)) {
            R.err(`boss ${id}: sheet "${d.sheet}" 텍스처가 매니페스트에 없다 — ensureAnims 가 조용히 반환한다 (BossSystem.js:384)`);
        }
    }
    for (const b of D.bossAtlas.bosses ?? []) {
        if (!tex.has(b.key)) R.warn(`boss-atlas "${b.key}": 텍스처가 매니페스트에 없다 (file=${b.file})`);
    }
    for (const st of D.stages.stages ?? []) {
        const g = st.ground ?? {};
        // texture/props 는 폴백이 있으니 경고, 폴백까지 없으면 초록 체크무늬가 뜬다 = error
        for (const [k, fb] of [["texture", "fallbackTexture"], ["props", "fallbackProps"]]) {
            if (g[k] && !tex.has(g[k])) {
                if (g[fb] && tex.has(g[fb])) R.warn(`${st.id}.ground.${k} "${g[k]}" 없음 — ${fb} "${g[fb]}" 로 내려간다`);
                else R.err(`${st.id}.ground.${k} "${g[k]}" 도 ${fb} 도 매니페스트에 없다 — 초록 체크무늬가 뜬다`);
            }
        }
    }
    for (const s of Object.values(D.projectiles.sheets ?? {})) {
        if (!tex.has(s.key)) R.err(`projectiles.sheets "${s.key}" 텍스처가 매니페스트에 없다`);
    }
    for (const t of D.audio.tracks ?? []) {
        if (!aud.has(t.key)) R.err(`audio track "${t.key}" 가 매니페스트에 없다 — 로드되지 않는다`);
    }
    if (!(M.atlases ?? []).some((a) => a.key === "items")) {
        R.err('매니페스트에 아틀라스 "items" 가 없다 — 모든 아이템이 폴백 사각형으로 나온다 (ItemSystem.js:67)');
    }
}

// ── 3. 규칙 본체 ────────────────────────────────────────────────

/** 이 목록이 규칙의 전부다. 브라우저·노드가 같은 배열을 돈다. */
const RULES = [
    ruleWeapons, ruleEnemies, ruleBlessings, ruleTolls, rulePhases, ruleNocturne,
    ruleStageEnemyPools, ruleWaveWeights, ruleBossAssignment, ruleBossSheets, ruleTelegraph,
    ruleItems, ruleItemIcons, ruleDroptables, ruleProjectiles, ruleAwakenings,
    ruleAffixesAndSanctum, ruleAudio, ruleWaveCurve, ruleManifest,
];

/**
 * 규칙 본체. 순수 함수 — 데이터 묶음을 받아 위반만 돌려준다.
 * manifest / itemAtlas / itemFrames 는 선택이다(브라우저 번들 밖 파일). 없으면 그 규칙만 건너뛴다.
 *
 * ★ 규칙 하나가 터져도 나머지를 계속 돈다. 검증기 버그로 게임이 안 켜지면 본말전도다.
 * @returns {{errors: string[], warns: string[]}}
 */
export function runRules(D) {
    const R = makeReport();
    for (const rule of RULES) {
        try {
            rule(R, D);
        } catch (e) {
            R.err(`[검증기 내부 오류] ${rule.name}: ${e?.message ?? e}`);
        }
    }
    return { errors: R.errors, warns: R.warns };
}

/** 브라우저용 데이터 묶음 — 정적 import 로 번들에 들어간 것만 담는다 */
export function browserBundle() {
    return {
        weapons, enemies, blessings, tolls, phases, nocturne, stages,
        boss, bossAtlas, items, affixes, droptables, projectiles, awakenings, sanctum, audio,
    };
}

/**
 * 개발 모드 진입점. GameScene.js:44 `if (DEBUG) validateData()` 에서만 불린다.
 * 예외를 던지지 않고 콘솔에 모아 찍는다. 기존 호출부와의 호환을 위해 errors 배열을 돌려준다.
 */
export function validateData() {
    let errors = [];
    let warns = [];
    try {
        ({ errors, warns } = runRules(browserBundle()));
    } catch (e) {
        console.error("[데이터 검증] 검증기 자체가 실패했다 —", e);
        return [];
    }
    if (errors.length) {
        console.error(`%c[데이터 검증] ${errors.length}건 위반`, "color:#c4182b;font-weight:bold");
        errors.forEach((e) => console.error("  ·", e));
    }
    if (warns.length) {
        console.warn(`%c[데이터 검증] 경고 ${warns.length}건`, "color:#e0a020;font-weight:bold");
        warns.forEach((w) => console.warn("  ·", w));
    }
    if (!errors.length && !warns.length) console.info("%c[데이터 검증] 통과", "color:#35c9b4");
    // 매니페스트·아이템 아틀라스는 번들 밖이라 여기선 못 본다. 전수 검사는 노드판이 한다.
    else console.info("%c[데이터 검증] 전체 검사는 `npm run validate`", "color:#8a8a9a");
    return errors;
}
