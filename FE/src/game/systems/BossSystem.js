/**
 * BossSystem — 스테이지 보스 6종 공용 실행기. (Day 6 / T520~T526)
 *
 * 규격: 05-COMBAT 6(HP 역산/페이즈별 패턴표) / 03-GDD 7.3 / 08-DATA-SCHEMA 3.3 / docs/26 §5
 * 수치는 전부 data/boss.json 이다. 이 파일에 숫자를 박지 않는다 — 밸런싱은 JSON만 고쳐서 한다.
 *
 * ★ 이 파일은 "보스 하나"가 아니라 "패턴 문법의 해석기"다. (핵심 설계)
 *   보스를 추가하거나 패턴 축을 바꿀 때 코드를 고치면 안 된다 — boss.json 만 고쳐야 한다.
 *   그래서 패턴을 6종의 고정 동작이 아니라 6종의 타입 x 파라미터 조합으로 표현한다.
 *
 *   type          만드는 것                         차별화에 쓰는 파라미터
 *   ─────────────────────────────────────────────────────────────────────────────
 *   cone          보스 몸에서 뻗는 부채꼴/원/도넛    angle(360이면 전방위) innerRadius radius
 *   projectile    직선탄 / 추적탄 / 전방위 링 / 분열 count spread(360이면 링) homing split
 *   summon        링 소환                            enemyId count ringRadius hpMultOverride
 *   ground_aoe    장판 / 낙석 / 독무                 radius duration dropsPerCast scatter color
 *   dash          직선 돌진 (보스 본체가 흉기가 된다) distance speed halfWidth
 *   buff          자기강화(광폭화)                   duration speedMult cdMult
 *
 *   보스 6종의 "패턴 축"(_designNote)은 전부 이 6개 타입의 조합으로 만들어져 있다.
 *   BOSS1 낫·사령탄 / BOSS2 성가·추적탄 / BOSS3 독장판·소환 /
 *   BOSS4 돌진·낙석 / BOSS5 화염·광폭화 / BOSS6 전방위·분열
 *
 * ★ 이름 주의 — 「녹턴」은 PACT 카드를 내미는 흡혈귀(01-CONCEPT 4.4)다.
 *   6:00에 나오는 보스는 「여명의 처형인」이고 둘은 다른 캐릭터다.
 *
 * ★ T525 — 모든 패턴은 0.6s 이상 텔레그래프를 갖는다.
 *   640x360 모바일에서 붉은 인디케이터를 인지하고 엄지로 조이스틱을 꺾는 데 필요한 최소 시간이다.
 *   이보다 짧으면 난이도가 아니라 불공정이 된다. buildPhases() 가 데이터를 검사해 강제로 끌어올린다.
 *   같은 이유로 장판 산포 하한(scatterMin)도 검사한다 — 발밑에 깔리는 장판은 예고가 있어도 못 피한다.
 *
 * ★ 보스는 "특별한 개체"가 아니라 spawn.enemies 에 든 평범한 적이다. (핵심 설계)
 *   플레이어 무기 4종(W1 부채꼴 / W2 투사체 / W3 궤도 / W4 장판)은 전부
 *   CombatSystem.hash 에 들어있는 적을 때린다. 해시는 spawn.enemies 를 그대로 넣는다.
 *   그러므로 보스를 적 풀에서 꺼내 등록하기만 하면 무기별 충돌 코드가 0줄이 된다.
 *   보스 전용 히트박스를 따로 만들면 무기가 늘어날 때마다 여기도 고쳐야 하고,
 *   "W3만 보스에 안 맞는다" 같은 버그가 반드시 한 번은 난다.
 *   대신 넉백 면역(knockbackResist 1) / expValue 0 / goldValue 0 을 세팅해
 *   일반 적 처리 경로가 보스에게 이상한 보상을 주지 않게 한다.
 *
 * ── 전투 시간 검산 ──
 *   보스별 산식은 boss.json 의 _designNote 에 들어 있다. 요지는 하나다 —
 *   패턴 축이 다르면 플레이어의 실효 가동률이 달라지므로 HP 를 같은 비율로 올릴 수 없다.
 *   정지 패턴(cone)이 많은 보스는 때릴 시간이 늘고, 탄막·장판이 많은 보스는 줄어든다.
 *
 * ── 통합 계약 (GameScene 이 이대로 부른다) ──
 *   new BossSystem(scene, { player, spawn, combat, stats })
 *   .setBoss(id)    : 스테이지가 쓸 보스 선택 (StageSystem.load)
 *   .spawn()        : 보스 등장. 잡몹 정화 + 붉은 플래시.
 *   .update(dt)     : 매 프레임
 *   .active         : 보스전 진행 중인가
 *   .defeated       : 처치되었는가
 */
import Phaser from "phaser";
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { Pool } from "../pools/Pool";
import { dist2 } from "../utils/math";
import bossData from "@/data/boss.json";
import bossAtlas from "@/data/boss-atlas.json";

/** 09-ART 1.1 #16 DANGER — 보스 텔레그래프 인디케이터 전용색. 다른 곳에 절대 쓰지 않는다 */
const DANGER = 0xff3b30;
const BLOOD = 0x8e1220;
const BLOOD_DEEP = 0x4a0a14;
const BLOOD_BRIGHT = 0xd6203a;

/** T525 절대 하한. 데이터가 이보다 짧으면 여기서 끌어올린다 */
const MIN_TELEGRAPH = 0.6;

/**
 * 탄 동시 최대. BOSS6 P3 이 최악이다 — 링 14 + 파편 16 + 분열탄 4(자식 16) = 최악 50발이
 * 동시에 살아 있을 수 있다(세 볼리의 수명이 1.2~2.6s 라 겹친다). 여유 6발을 얹어 56으로 잡는다.
 * ★ 여유를 더 주지 않는 이유 — 풀이 마르면 obtain()이 null 을 돌려주고 그 탄은 그냥 안 나온다.
 *   화면이 읽히지 않을 만큼 탄이 많아지는 것보다 몇 발 누락되는 편이 낫다(가독성 예산).
 */
const MAX_BOLTS = 56;
/** 장판 동시 최대. BOSS4 낙석 P3 이 maxActive 12 로 가장 크다 */
const MAX_POOLS = 14;
/** 소환 링 좌표 / 장판 목표 좌표의 상한. 데이터가 이보다 많이 요구하면 잘린다 */
const MAX_RING = 8;
const MAX_MARKS = 8;

/**
 * 패턴 발동 직후 경직. 패턴이 끝나자마자 다음 예고가 시작되면 화면을 읽을 수 없다.
 * ★ 0.15로 잡은 근거 — BOSS1 P3 메인 채널 점유율 계산:
 *   낫 (0.80+0.15)/1.68 + 사령탄 (0.60+0.15)/4.00 + 소환 (1.00+0.15)/9.00 = 0.88
 *   0.25면 0.98이 되어 채널이 포화하고, 쿨이 긴 소환이 사실상 발동하지 못한다(실측 2회/기대 5회).
 *   나머지 5종도 같은 식으로 계산해 0.9 미만이 되게 데이터를 잡았고,
 *   buildPhases() 가 부팅 때 다시 계산해 넘으면 경고한다.
 */
const RECOVER = 0.15;
/** 메인 채널 점유율 경고선. 이걸 넘으면 쿨 긴 패턴이 사실상 발동하지 못한다 */
const LOAD_WARN = 0.92;

/** BOSS_HP 이벤트 스로틀. runSlice 주석이 지정한 200ms(React 리렌더 예산) */
const HP_EMIT_MS = 200;

/**
 * 리쉬(leash) — 플레이어 70px/s > 보스 46px/s 라서 도망만 치면 보스가 뒤처지고,
 * SpawnSystem.despawnFar(900px)에 걸려 보스가 통째로 사라진다.
 * 화면 밖(가로 반폭 320px)에서만 가속하므로 플레이어가 보는 전투 속도는 정본 그대로다.
 */
const LEASH_FAR2 = 420 * 420;
const LEASH_NEAR2 = 340 * 340;
const LEASH_BOOST = 3;

const BOLT_R = 4;
const PLAYER_R = 7;
const TAU = Math.PI * 2;
/**
 * 장판 산포 하한을 역산하기 위한 플레이어 제원.
 * 기본 이동속도 70px/s, 그리고 예고를 인지하고 엄지가 움직이기까지의 지연 0.25s.
 * 예고 windup 중 실제로 걸어서 벌 수 있는 거리는 70 x (windup - 0.25) 뿐이다.
 * ★ 대시(쿨 3.0s)는 계산에 넣지 않는다. 쿨다운 자원을 회피의 전제로 삼으면
 *   그 자원이 없는 순간의 패턴은 대응 불가능해진다 — 어려움이 아니라 불공정이다.
 */
const PLAYER_WALK = 70;
const REACT_LAG = 0.25;

/**
 * ★ 애니메이션 대체는 "같은 시트 안에서만" 한다.
 *   Phaser 의 애니메이션 프레임은 자기 텍스처 키를 들고 다닌다. 그래서 boss4 시트를 쓰는 보스에게
 *   boss.spell 을 재생하면 애니가 없는 게 아니라 **스프라이트가 통째로 BOSS1 로 바뀐다.**
 *   에러도 안 나고 화면에서만 보인다 — 가장 늦게 발견되는 종류의 사고다.
 *   시트에 그 동작이 없으면 비슷한 동작으로 내려가고, 그것도 없으면 아무것도 하지 않는다.
 */
const ANIM_FALLBACK = {
    idle: ["idle"],
    walk: ["walk", "idle"],
    attack: ["attack", "cast", "idle"],
    cast: ["cast", "attack", "idle"],
    spell: ["spell", "cast", "attack", "idle"],
    death: ["death", "hurt", "idle"],
};

export class BossSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        /**
         * ★ 필드 이름이 spawner 인 이유 — SpawnSystem을 this.spawn 에 넣으면
         *   인스턴스 필드가 프로토타입의 spawn() 메서드를 가려 bossSystem.spawn() 이 호출 불가가 된다.
         *   통합 계약(GameScene이 .spawn()을 부른다)이 조용히 깨지는 자리라 이름을 분리한다.
         */
        this.spawner = ctx.spawn;
        this.combat = ctx.combat;
        this.stats = ctx.stats;

        this.defs = bossData.bosses ?? { BOSS1: bossData.boss };
        this.def = this.defs.BOSS1 ?? bossData.boss;
        this.active = false;
        this.defeated = false;
        this.dying = false;
        this.boss = null;
        this.phase = 0;

        /** 페이즈 전환 무적 (05-COMBAT 4.4 BOSS: 1.2초 x 2회) */
        this.invulnUntil = 0;
        this.lockedHp = 0;

        /** 메인 채널(cone/projectile/summon/dash/buff). 예고가 전부 보스 몸에서 뻗어 동시에 읽을 수 없다 */
        this.cast = null;
        this.castT = 0;
        this.castX = 0;
        this.castY = 0;
        this.recoverT = 0;
        /** 장판 전용 채널. 예고가 보스 몸이 아니라 월드에 그려져 메인 예고와 겹치지 않는다 */
        this.aoe = null;
        this.aoeT = 0;

        /** 메인 채널 조준 스냅샷. 예고 시작 순간에 고정한다 (아래 startCast 주석 참고) */
        this.aim = { x: 0, y: 0, ang: 0 };
        /** ★ 장판 채널은 조준을 따로 찍는다. 메인의 aim 을 빌리면 "직전 낫을 휘두른 시점"에 깔린다 */
        this.aoeAim = { x: 0, y: 0 };
        /** 소환 링 / 장판 목표 — 예고와 실제가 정확히 같은 자리여야 한다 */
        this.ring = Array.from({ length: MAX_RING }, () => ({ x: 0, y: 0 }));
        this.marks = Array.from({ length: MAX_MARKS }, () => ({ x: 0, y: 0 }));
        this.markCount = 0;
        /** 돌진 예고용 사각형 4점. 매 프레임 만들지 않으려고 미리 잡는다 */
        this.quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));

        /** 돌진 상태. left>0 이면 진행 중 */
        this.dash = { dx: 1, dy: 0, speed: 0, left: 0, damage: 0, r2: 0, hit: false };
        /** 광폭화(buff) 상태 */
        this.enrageUntil = 0;
        this.enrageSpeed = 1;
        this.enrageCd = 1;
        this.enrageTint = 0xff5a28;
        this.enrageOn = false;

        /** 보스가 죽으면 CombatSystem이 즉시 스프라이트를 풀에 반환한다 → 좌표를 미리 들고 있는다 */
        this.lastX = 0;
        this.lastY = 0;
        this.hpEmitAt = 0;
        this.hitFxUntil = 0;
        this.hitR = 0;      // 낫 착탄 잔상용. 매 프레임 객체를 만들지 않으려고 원시값으로 들고 있다
        this.hitInner = 0;
        this.hitHalf = 0;
        this.leashing = false;
        this.deathAt = 0;
        this.animsReady = null;

        /** 페이즈별 패턴 런타임. 데이터 검증도 여기서 한다 */
        this.byPhase = { 1: [], 2: [], 3: [] };
        this.buildPhases();

        // ── 풀 (런 중 new 금지. 06-TECH 5.1)
        this.bolts = new Pool(MAX_BOLTS, () => {
            const s = scene.add.circle(-999, -999, BOLT_R, BLOOD_BRIGHT);
            s.setStrokeStyle(1, DANGER, 0.9);
            s.setDepth(DEPTH.PROJECTILE).setVisible(false);
            return s;
        });
        this.pools = new Pool(MAX_POOLS, () => {
            const s = scene.add.circle(-999, -999, 70, BLOOD_DEEP, 0.34);
            s.setStrokeStyle(1, BLOOD, 0.7);
            s.setDepth(DEPTH.FX).setVisible(false);
            return s;
        });

        /** 텔레그래프 전용 그래픽스. 매 프레임 clear+재작성이라 객체는 하나면 된다 */
        this.tele = scene.add.graphics().setDepth(DEPTH.FX);

        /**
         * 처치 연출용 시체 스프라이트.
         * 보스 본체는 사망 순간 CombatSystem이 풀에 반환해 다른 잡몹으로 재사용될 수 있다.
         * 그 위에 death 애니를 얹으면 "해골이 보스 시체로 보이는" 사고가 난다 → 전용 스프라이트를 쓴다.
         * ★ 텍스처는 등장 시점에 그 보스의 시트로 갈아끼운다. 고정해 두면 어느 보스를 잡든
         *   BOSS1 의 시체가 남는다(docs/26 §8-11).
         */
        this.corpse = scene.add.sprite(-999, -999, "boss", 0)
            .setDepth(DEPTH.ENEMY).setVisible(false);
    }

    // ── 데이터 검증 ──────────────────────────────────────────────
    /**
     * boss.json 의 patterns 를 페이즈별 런타임으로 굽는다.
     *
     * ★ setBoss() 도 반드시 이걸 다시 부른다. 생성자에서 한 번만 만들면 스테이지가 무엇이든
     *   BOSS1 패턴이 나온다 — 6종 패턴이 동일했던 시절에는 무증상이었고, 보스별 패턴을 넣는
     *   순간 발현하는 잠복 버그였다(docs/26 §8-12).
     *
     * ★ 여기서 데이터를 "고쳐서" 받는 이유.
     *   밸런싱은 JSON 만 고쳐서 한다는 것이 이 프로젝트의 규칙이고, 그러다 보면 예고 시간이
     *   가장 먼저 깎인다(효과가 즉각적이라서). 그래서 T525 하한만은 JSON 이 넘을 수 없는 곳에 둔다.
     *   데이터가 틀렸다고 게임을 죽이지는 않되, 조용히 넘어가면 불공정한 빌드가 배포된다.
     */
    buildPhases() {
        this.byPhase = { 1: [], 2: [], 3: [] };
        for (const d of this.def.patterns ?? []) {
            const list = this.byPhase[d.phase];
            if (!list) {
                console.error(`[BossSystem] ${this.def.id} ${d.id}: 페이즈 ${d.phase} 는 존재하지 않는다`);
                continue;
            }
            const windup = Math.max(d.windup ?? 0, MIN_TELEGRAPH);
            if (windup !== d.windup) {
                console.error(`[BossSystem] T525 위반 — ${this.def.id}/${d.id}(P${d.phase}) windup ${d.windup}s → ${MIN_TELEGRAPH}s로 강제`);
            }
            const p = { def: d, windup, timer: d.cooldown, scatterMin: 0, scatterMax: 0 };
            if (d.type === "ground_aoe") this.fixScatter(p, windup);
            list.push(p);
        }
        this.checkLoad();
    }

    /**
     * ★ 장판을 플레이어 발밑에 깔지 않는다 (T525 의 공간 버전).
     *   예고를 0.6초 줘도 그 사이 걸어서 24px 밖에 못 가는데 반경 70px 원 한가운데에 서 있으면
     *   회피 불가다. 시간 하한만 지키고 공간을 방치하면 T525 는 서류상으로만 지켜진다.
     *
     *   판정식:  (반경 + 플레이어 반경) - 산포하한  <=  70px/s x (windup - 0.25s)
     *   = "예고 시작 시점에 원 안쪽 얼마까지 들어가 있어도 걸어서 나올 수 있는가".
     *   BOSS1 붉은 장판(r70 / 산포 70~150 / 0.6s)은 최악의 굴림에서도 7px만 벗어나면 되므로
     *   여유 24px 안에 들어온다 — 정본 수치가 그대로 통과한다(튜닝을 건드리지 않는다).
     *   BOSS4 낙석(r32 / 0.8s)은 39px 이 필요하고 실이동이 38px 라 산포 48px 로 잡아 뒀다.
     */
    fixScatter(p, windup) {
        const w = p.def.params ?? {};
        const r = (w.radius ?? 0) + PLAYER_R;
        // 예고 동안 걸어서 벌 수 있는 거리. 이만큼은 원 안쪽에서 시작해도 빠져나올 수 있다
        const reach = PLAYER_WALK * Math.max(0, windup - REACT_LAG);
        const need = Math.max(0, r - reach);
        p.scatterMin = Math.max(w.scatterMin ?? 0, need);
        p.scatterMax = Math.max(w.scatterMax ?? 0, p.scatterMin + 10);
        if (p.scatterMin !== (w.scatterMin ?? 0)) {
            console.error(`[BossSystem] T525(공간) 위반 — ${this.def.id}/${p.def.id}: 반경 ${w.radius}px 장판을 ${w.scatterMin}px 앞에 깔면 예고 ${windup}s(실이동 ${reach.toFixed(0)}px)로 못 빠져나온다 → scatterMin ${p.scatterMin.toFixed(0)}로 강제`);
        }
    }

    /**
     * 메인 채널 점유율 = sum((windup + 실행시간 + 경직) / cooldown).
     * 1.0 을 넘으면 오버서브스크립션이고, 쿨이 긴 패턴부터 순서를 빼앗겨 사실상 발동하지 못한다.
     * "데이터를 넣었는데 그 패턴이 안 나온다"는 재현이 어렵고 원인 추적이 오래 걸리는 종류라
     * 부팅 시점에 산수로 잡는다.
     */
    checkLoad() {
        for (const n of [1, 2, 3]) {
            let load = 0;
            for (const p of this.byPhase[n]) {
                if (p.def.type === "ground_aoe") continue;   // 별도 채널
                load += this.busyOf(p) / p.def.cooldown;
            }
            if (load > LOAD_WARN) {
                console.warn(`[BossSystem] ${this.def.id} P${n} 메인 채널 점유율 ${load.toFixed(2)} — 쿨이 긴 패턴이 발동하지 못한다`);
            }
        }
    }

    /** 한 번 시전할 때 메인 채널을 붙잡는 총 시간. 돌진만 이동 시간이 더 붙는다 */
    busyOf(p) {
        const d = p.def;
        let busy = p.windup + RECOVER;
        if (d.type === "dash") busy += (d.params.distance ?? 0) / Math.max(1, d.params.speed ?? 1);
        return busy;
    }

    /** 현재 페이즈 정의 (moveSpeedMult 등) */
    get phaseDef() { return this.def.phases[this.phase - 1] ?? this.def.phases[0]; }

    get invulnerable() { return this.scene.time.now < this.invulnUntil; }

    /** 광폭화 중인가. 이동속도와 쿨다운 진행 속도에만 관여한다 — 예고 시간은 절대 줄이지 않는다 */
    get enraged() { return this.scene.time.now < this.enrageUntil; }

    /**
     * 스테이지가 어떤 보스를 쓸지 정한다. StageSystem.load 가 부른다.
     * ★ 여기서 스프라이트를 만들지 않는다 — 보스는 등장 시점에 적 풀에서 꺼낸다.
     *   미리 만들면 런 내내 보이지 않는 스프라이트가 배칭에 끼어든다.
     */
    setBoss(bossId) {
        const d = this.defs[bossId];
        if (!d) { console.warn("[BossSystem] 알 수 없는 보스:", bossId); return false; }
        if (this.active || this.dying) {
            console.warn("[BossSystem] 전투 중에는 보스를 바꾸지 않는다:", bossId);
            return false;
        }
        this.def = d;
        this.buildPhases();     // ★ 이 한 줄이 없으면 어떤 스테이지든 BOSS1 패턴이 나온다
        this.animsReady = null; // 시트가 바뀌었으니 애니 등록을 다시 판단한다
        return true;
    }

    /**
     * 애니메이션 키. 스테이지 보스는 전용 시트를 쓰므로 접두가 다르다.
     * ★ 전용 시트를 쓰는 보스가 시트에 없는 동작을 요구하면 같은 시트의 비슷한 동작으로 내려간다.
     *   boss.* 로는 절대 내려가지 않는다 — 위 ANIM_FALLBACK 주석 참고(스프라이트가 통째로 바뀐다).
     * @returns {string|null} 재생 가능한 키, 없으면 null
     */
    animKey(name) {
        const sheet = this.def.sheet;
        const chain = ANIM_FALLBACK[name] ?? [name];
        if (!sheet) {
            // 기본 시트(BOSS1/BOSS4)는 boss.* 가 자기 시트다
            for (const c of chain) {
                if (this.scene.anims.exists("boss." + c)) return "boss." + c;
            }
            return null;
        }
        for (const c of chain) {
            const k = sheet + "." + c;
            if (this.scene.anims.exists(k)) return k;
        }
        return null;
    }

    /** 있으면 재생, 없으면 아무것도 하지 않는다. 호출부마다 exists 검사를 반복하지 않으려고 모은다 */
    playAnim(target, name) {
        const k = this.animKey(name);
        if (k) target.play(k, true);
        return k;
    }

    /**
     * 보스 애니메이션을 등장 직전에 한 번만 등록한다.
     * ★ 부팅 시 6종을 전부 등록하면 쓰지 않을 애니메이션 30여 개가 상주한다.
     *   보스는 런당 하나뿐이라 지연 등록이 명백히 싸다.
     */
    ensureAnims() {
        const key = this.def.sheet;
        if (!key || this.animsReady === key) return;
        const meta = bossAtlas?.bosses?.find((b) => b.key === key);
        if (!meta || !this.scene.textures.exists(key)) return;
        for (const a of meta.anims ?? []) {
            const name = key + "." + a.key;   // 아틀라스의 필드명은 key 다(name 아님)
            if (this.scene.anims.exists(name)) continue;
            this.scene.anims.create({
                key: name,
                frames: this.scene.anims.generateFrameNumbers(key, { start: a.from, end: a.to }),
                frameRate: a.fps ?? 8,
                repeat: a.repeat ?? -1,
            });
        }
        this.animsReady = key;
    }

    // ── T521 등장 연출 ────────────────────────────────────────────
    /**
     * 잡몹 전멸(정화) → 보스 등록 → 붉은 플래시.
     * 정화를 먼저 하는 이유가 연출만은 아니다. 후반 구간 cap 은 150이라 풀이 꽉 차 있어
     * 정화 전에 obtain() 하면 null 이 돌아와 보스가 아예 등장하지 않는다.
     */
    spawn() {
        if (this.active || this.defeated) return this.boss;

        // 스폰 영구 중단. SpawnSystem 소유자가 이 플래그를 본다(의존성: 보고서 참고)
        this.spawner.suppressed = true;
        this.purgeMinions();

        const d = this.def;
        // 가로 640 / 세로 360 — 좌우에서 들어와야 보스 전신이 화면에 들어온다.
        // 위아래에서 오면 등장 순간 프레임의 절반이 화면 밖이다.
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const a = side + (Math.random() - 0.5) * Phaser.Math.DegToRad(50);
        const at = { x: this.player.x + Math.cos(a) * 210, y: this.player.y + Math.sin(a) * 210 };

        const b = this.spawner.spawn(d, at) ?? this.rawSpawn(d, at);
        if (!b) {
            console.error("[BossSystem] 적 풀에서 보스를 꺼내지 못했다");
            return null;
        }

        // SpawnSystem.reset 이 웨이브 배율(hpMult 5.64 등)을 곱해 놨다. 보스는 고정값이다.
        b.maxHp = d.baseHp;
        b.hp = d.baseHp;
        b.damage = d.contactDamage;              // dmgMult 미적용 — 정본 4.4 고정값
        b.speed = d.moveSpeed;
        /**
         * 히트박스를 원으로 근사할 때 긴 변을 쓰면 머리 위 허공에서 맞는다. 짧은 변이 "보이는 몸통"에 가깝다.
         * ★ 예전에는 hitbox.w/2 였다. w 가 짧은 변이라는 전제가 데이터에 적혀 있지 않아
         *   가로가 더 넓은 보스 하나에서 규칙이 반대로 작동했다(docs/26 §8-9).
         *   전제를 코드가 직접 만족시킨다 — 데이터가 어느 쪽을 크게 적든 결과가 같다.
         */
        b.radius = Math.min(d.hitbox.w, d.hitbox.h) / 2;
        b.expValue = d.expValue;                 // 0 — 보스는 EXP를 주지 않는다(런이 끝난다)
        b.goldValue = d.goldValue;               // 0 — 클리어 보상은 goldOnClear로 따로 준다
        // ★ 보스는 적 풀에 든 평범한 적이라 despawnFar(900px)의 대상이 된다.
        //   리쉬가 508px에서 잡아주지만, 치트나 극단적 이동으로 한 번만 넘어가면
        //   보스가 소리 없이 사라지고 런이 끝나지 않는다. 표식으로 막는다.
        b.isBoss = true;
        // 스테이지 보스는 전용 시트를 쓴다. 없으면 기존 텍스처를 유지한다.
        this.ensureAnims();
        if (d.sheet && this.scene.textures.exists(d.sheet)) {
            b.setTexture(d.sheet, 0);
            this.playAnim(b, "idle");
        }
        // 스프라이트를 3종으로 돌려 쓰므로 색조와 크기로 가른다.
        // ★ 라이선스가 확인된 스프라이트를 재사용하는 편이 불분명한 것을 쓰는 것보다 낫다 —
        //   전자는 "본 적 있는 실루엣"이고 후자는 스토어에서 내려갈 수 있는 위험이다.
        //   대신 같은 시트를 쓰는 두 보스는 패턴 축이 확실히 다르다(boss.json _designNote).
        b.setTint(d.tint ?? 0xffffff);
        b.setScale(d.spriteScale ?? 1);
        b.knockbackResist = 1;                   // 넉백 면역. 정본 09-ART 넉백표 "보스 0px"
        b.kbx = 0;
        b.kby = 0;

        // 시체 스프라이트도 이 보스의 시트로 맞춘다
        const cs = d.sheet && this.scene.textures.exists(d.sheet) ? d.sheet : "boss";
        this.corpse.setTexture(cs, 0).setTint(d.tint ?? 0xffffff).setScale(d.spriteScale ?? 1);

        this.boss = b;
        this.lastX = b.x;
        this.lastY = b.y;
        this.active = true;
        this.dash.left = 0;
        this.enrageUntil = 0;
        this.enrageOn = false;
        this.enterPhase(1, false);

        // 붉은 전체 플래시 + 흔들림 (10-UIUX 12번 "보스를 만났다" / 09-ART 등장 800ms 0.012)
        const cam = this.scene.cameras.main;
        cam.flash(d.flashDuration * 1000, 255, 43, 43);
        cam.shake(800, 0.012);
        this.scene.fxSystem?.bossAppear(); // 등장 SFX·BGM 전환은 BOSS_SPAWNED 구독이 처리한다

        EventBus.emit(EVENTS.BOSS_SPAWNED, {
            id: d.id, name: d.name, hp: b.hp, maxHp: b.maxHp, phase: 1,
        });
        return b;
    }

    /** spawn.spawn()이 막혀 있을 때의 폴백. 풀은 debugCheats도 직접 만지는 공개 경로다 */
    rawSpawn(def, at) {
        const e = this.spawner.pool.obtain();
        return e ? this.spawner.reset(e, def, at) : null;
    }

    /** 정화 — 보스를 제외한 전원 제거. counted=false 로 넣어 처치수에 세지 않는다 */
    purgeMinions() {
        const list = this.spawner.enemies;
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            if (e === this.boss) continue;
            this.spawner.kill(e, false);
        }
    }

    // ── 메인 루프 ────────────────────────────────────────────────
    update(dt) {
        if (this.dying) { this.updateDeath(); return; }
        if (!this.active) return;
        const b = this.boss;
        if (!b) return;

        // 사망 감지 — 데미지/사망 판정은 CombatSystem 소유다. 보스도 예외 없이 그 경로로 죽는다.
        // 그래서 여기서는 "이미 죽어 있는가"만 본다. 스프라이트는 이미 풀로 돌아가 -999에 있다.
        if (b.hp <= 0 || !b.__active) { this.onDefeat(); return; }

        this.lastX = b.x;
        this.lastY = b.y;

        this.updatePhase();
        const locked = this.updateInvuln();
        this.updateEnrage();
        this.updateMove(locked);
        if (!locked) {
            this.updateDash(dt);
            this.updatePatterns(dt);
        }
        this.updateBolts(dt);
        this.updatePools(dt);
        this.drawTelegraph();
        this.emitHp();
    }

    // ── 페이즈 ───────────────────────────────────────────────────
    updatePhase() {
        const r = this.boss.hp / this.boss.maxHp;
        // 정본 6.1 임계: 66% / 33%
        const want = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
        if (want > this.phase) this.enterPhase(want, true);
    }

    /**
     * @param {boolean} withInvuln 등장 시(페이즈 1)는 무적을 걸지 않는다 — 전환이 아니라 시작이다
     *
     * ★ 전환 시 모든 패턴 타이머를 쿨다운 만큼으로 되돌린다.
     *   P3 진입 순간 패턴 타이머가 전부 0 이하로 쌓여 있으면 무적이 풀리자마자
     *   낫→사령탄→장판이 연달아 터져 "페이즈 전환에서 죽었다"가 된다. 숨 쉴 틈을 데이터가 아니라
     *   전환 규칙으로 보장한다.
     */
    enterPhase(n, withInvuln) {
        this.phase = n;
        this.cancelCast();
        for (const p of this.byPhase[n]) p.timer = p.def.cooldown;

        if (withInvuln) {
            this.invulnUntil = this.scene.time.now + this.def.phaseInvuln * 1000;
            this.lockedHp = this.boss.hp;
            this.scene.cameras.main.shake(300, 0.006);
            this.combat?.fx?.hitStop(250);      // 10-UIUX 페이즈 전환 히트스톱 250ms
        }
        this.emitHp(true);
    }

    /**
     * 페이즈 전환 무적 1.2초.
     * ★ CombatSystem에 "무적 적" 개념이 없고, 그걸 만들면 적 150체 루프에 분기가 하나 늘어난다.
     *   대신 매 프레임 HP를 되돌린다 — 무적 구간에 들어온 피해는 그냥 없던 일이 된다.
     *   한 프레임에 페이즈 임계값 전량을 넣을 수 있는 빌드는 존재하지 않으므로
     *   CombatSystem이 먼저 사망 처리하는 일은 일어나지 않는다.
     * @returns {boolean} 무적 중인가
     */
    updateInvuln() {
        if (!this.invulnerable) {
            if (this.boss.alpha !== 1) this.boss.setAlpha(1);
            return false;
        }
        this.boss.hp = this.lockedHp;
        // 60ms 주기 점멸 — "지금 때려도 소용없다"를 색이 아니라 리듬으로 알린다
        this.boss.setAlpha((this.scene.time.now / 60) % 2 < 1 ? 0.35 : 1);
        return true;
    }

    /**
     * 광폭화 색조. 상태가 바뀌는 프레임에만 setTint 한다 —
     * 매 프레임 부르면 Phaser가 tint 를 4정점에 다시 밀어 넣는다.
     * ★ 색조로만 알린다. 광폭화는 예고를 줄이지 않으므로 "지금부터 빨라진다"만 보이면 된다.
     */
    updateEnrage() {
        const on = this.enraged;
        if (on === this.enrageOn) return;
        this.enrageOn = on;
        this.boss.setTint(on ? this.enrageTint : (this.def.tint ?? 0xffffff));
    }

    // ── 이동 ─────────────────────────────────────────────────────
    /**
     * 이동은 EnemyAISystem이 한다(직선 추격 + 넉백 감쇠 + 좌우 반전).
     * 여기서는 speed 만 바꿔 개입한다 — 보스만 별도 이동 코드를 쓰면 같은 버그를 두 곳에서 고치게 된다.
     * EnemyAISystem은 4프레임에 한 번 재조준하므로 정지 반영이 최대 3프레임(=2px) 늦지만 체감되지 않는다.
     */
    updateMove(locked) {
        const b = this.boss;
        /**
         * ★ 정지하는 것은 몸에 붙은 예고(cone)와 돌진 예비동작(dash)뿐이다.
         *   그 둘은 예고 도형의 원점이 보스 몸이라, 보스가 움직이면 예고가 그대로 거짓말이 된다.
         *   반대로 탄·소환·장판까지 정지시키면 P3 점유율이 90%를 넘어 보스가 사실상 제자리에 서고,
         *   정본이 광폭화의 핵심으로 지정한 이동속도 배율이 화면에 한 번도 나타나지 않는다.
         * ★ 돌진 중(dash.left>0)에도 AI 이동을 끈다 — 돌진은 updateDash 가 직접 민다.
         */
        const t = this.cast?.def.type;
        if (locked || t === "cone" || t === "dash" || this.dash.left > 0) {
            b.speed = 0;
            b.vx = 0;
            b.vy = 0;
            return;
        }
        const base = this.def.moveSpeed * this.phaseDef.moveSpeedMult * (this.enraged ? this.enrageSpeed : 1);
        const d2 = dist2(b.x, b.y, this.player.x, this.player.y);
        // 히스테리시스 — 경계에서 가속/감속이 떨리면 이동이 덜덜거린다
        if (d2 > LEASH_FAR2) this.leashing = true;
        else if (d2 < LEASH_NEAR2) this.leashing = false;
        b.speed = this.leashing ? base * LEASH_BOOST : base;
    }

    /**
     * 돌진 진행. 보스 본체가 흉기가 되는 유일한 패턴이다.
     * ★ 한 번의 돌진은 한 번만 맞힌다. 프레임마다 판정하면 5~6프레임이 겹쳐 즉사한다 —
     *   combat.invulnerable 을 보더라도 무적프레임이 끝나는 순간 다시 맞으므로 hit 플래그가 따로 필요하다.
     * ★ 예고는 직사각형으로 최종 도달점까지 전부 그려 두었으므로, 돌진 자체는 조준하지 않는다.
     *   진행 중 플레이어를 따라 휘면 예고가 장식이 된다.
     */
    updateDash(dt) {
        const d = this.dash;
        if (d.left <= 0) return;
        const b = this.boss;
        const step = Math.min(d.left, d.speed * dt);
        b.x += d.dx * step;
        b.y += d.dy * step;
        d.left -= step;
        if (!d.hit && dist2(b.x, b.y, this.player.x, this.player.y) <= d.r2) {
            d.hit = true;
            if (this.strike(d.damage)) {
                this.scene.cameras.main.shake(280, 0.010);
                this.combat?.fx?.hitStop(90);
            }
        }
    }

    // ── 패턴 스케줄러 ────────────────────────────────────────────
    /**
     * 채널이 둘이다 — 메인(cone/projectile/summon/dash/buff)과 장판(ground_aoe).
     *
     * ★ 메인 채널은 한 번에 하나만 시전한다.
     *   메인 패턴의 예고는 전부 보스 몸에서 뻗어나오는 도형이라, 둘이 겹치면
     *   640x360에서 어느 쪽이 언제 터지는지 읽을 수 없고 0.6s 텔레그래프가 장식이 된다(T525).
     *
     * ★ 장판만 별도 채널인 이유.
     *   장판 예고는 보스가 아니라 플레이어 주변 월드 좌표에 그려지는 독립된 원이라 시각적으로 겹치지 않는다.
     *   그리고 메인 채널에 넣으면 P3 점유율이 1.05를 넘어(오버서브스크립션) 장판이 26초 동안 2회밖에
     *   나오지 못한다 — 정본이 P3의 정체성으로 지정한 "바닥 장판"이 사실상 사라진다.
     *
     * 대기 중인 패턴은 쿨이 계속 흘러 마이너스가 되고, 가장 오래 기다린 것이 다음 차례를 갖는다.
     * 빚의 상한이 -cooldown이라 쿨이 긴 패턴(소환 -9.0)이 짧은 패턴(낫 -1.68)보다 항상 먼저 선택된다.
     *
     * ★ 광폭화는 예고가 아니라 쿨다운만 빨리 감는다. 예고를 줄이면 T525 위반이고,
     *   쿨을 줄이면 "같은 패턴이 더 자주 온다"가 되어 난이도만 오른다.
     */
    updatePatterns(dt) {
        const cdt = dt * (this.enraged ? 1 / Math.max(0.1, this.enrageCd) : 1);
        let main = null, aoe = null;
        for (const p of this.byPhase[this.phase]) {
            if (p === this.cast || p === this.aoe) continue;   // 시전 중인 것은 발동 시 리셋된다
            p.timer -= cdt;
            if (p.timer < -p.def.cooldown) p.timer = -p.def.cooldown;
            if (p.timer > 0) continue;
            if (p.def.type === "ground_aoe") { if (!aoe || p.timer < aoe.timer) aoe = p; }
            else if (!main || p.timer < main.timer) main = p;
        }

        // ── 메인 채널
        if (this.cast) {
            this.castT += dt;
            if (this.castT >= this.cast.windup) {
                const extra = this.fire(this.cast);
                this.cast.timer = this.cast.def.cooldown;
                this.cast = null;
                this.recoverT = RECOVER + extra;   // 돌진은 이동이 끝날 때까지 채널을 붙잡는다
            }
        } else if (this.recoverT > 0) {
            this.recoverT -= dt;
            // 경직이 풀리는 프레임에만 idle로 되돌린다. delayedCall을 쓰면 런 중 TimerEvent가 쌓인다
            if (this.recoverT <= 0) this.playAnim(this.boss, "idle");
        } else if (main) {
            this.startCast(main);
        }

        // ── 장판 채널 (경직 없음. 시전 애니도 메인 채널이 소유하므로 건드리지 않는다)
        if (this.aoe) {
            this.aoeT += dt;
            if (this.aoeT >= this.aoe.windup) {
                this.fireGroundAoe(this.aoe);
                this.aoe.timer = this.aoe.def.cooldown;
                this.aoe = null;
            }
        } else if (aoe) {
            this.aoe = aoe;
            this.aoeT = 0;
            // ★ 장판 채널도 자기 예고가 시작되는 순간에 조준을 찍는다.
            //   메인 채널의 aim 을 빌려 쓰면 "직전에 낫을 휘두른 시점"의 위치에 장판이 깔려,
            //   예고와 플레이어의 관계가 매번 달라진다(학습 불가).
            this.aoeAim.x = this.player.x;
            this.aoeAim.y = this.player.y;
            this.planMarks(aoe);
        }
    }

    /**
     * ★ 조준은 예고 시작 순간에 고정한다 (핵심 공정성 규칙).
     *   예고 내내 플레이어를 따라다니는 조준은 0.6초를 줘도 피할 수 없다 — 텔레그래프가 장식이 된다.
     *   시작 시점의 위치를 찍고 그 자리에 그대로 꽂아야 "보고 피했다"가 성립한다.
     */
    startCast(p) {
        this.cast = p;
        this.castT = 0;
        const b = this.boss;
        this.aim.x = this.player.x;
        this.aim.y = this.player.y;
        this.aim.ang = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        /**
         * ★ 전방위 링(spread>=360)만 조준을 버리고 무작위로 돌린다.
         *   플레이어를 향해 정렬하면 탄 사이의 틈이 매번 같은 곳(정면과 등 뒤)에 생겨
         *   "링을 향해 걸어 들어가면 항상 안전"이 된다. 회피가 아니라 암기가 되는 자리다.
         */
        if (p.def.type === "projectile" && (p.def.params.spread ?? 0) >= 360) {
            this.aim.ang = Math.random() * TAU;
        }

        // 예고를 그릴 원점. 소환 링은 보스가 걸어가도 예고한 자리에 그대로 나와야 한다
        this.castX = b.x;
        this.castY = b.y;
        // 예고에 그릴 좌표를 지금 확정한다. 예고와 실제가 1px이라도 다르면 플레이어는 학습할 수 없다.
        if (p.def.type === "summon") this.planRing(p);
        if (p.def.type === "dash") b.setFlipX(Math.cos(this.aim.ang) < 0);

        this.playAnim(b, "cast");
    }

    cancelCast() {
        this.cast = null;
        this.castT = 0;
        this.aoe = null;
        this.aoeT = 0;
        this.recoverT = 0;
        this.dash.left = 0;     // 페이즈 전환 무적 중에 보스가 계속 미끄러지면 안 된다
        this.tele.clear();
    }

    /**
     * ★ 플레이어 피격은 반드시 이 함수를 거친다.
     *   CombatSystem.hurt()는 무적프레임을 스스로 검사하지 않는다 — 검사는 호출자(contactDamage)에 있다.
     *   그래서 탄 5발이 같은 프레임에 닿으면 18 x 5 = 90이 한 번에 들어가 즉사한다.
     *   보스 패턴은 전부 여기로 모아 combat.invulnerable 을 먼저 본다.
     *   ★ 전방위·분열 보스가 들어오면서 "같은 프레임 다중 히트"는 예외가 아니라 상시 상황이 됐다.
     * @returns {boolean} 실제로 피해가 들어갔는가
     */
    strike(amount) {
        if (this.combat.invulnerable) return false;
        this.combat.hurt(amount);
        return true;
    }

    /**
     * 패턴 실행. 타입별 분기는 여기 한 곳뿐이고, 그 아래는 전부 params 해석이다.
     * @returns {number} 메인 채널을 추가로 붙잡는 시간(초). 돌진 외에는 0.
     */
    fire(p) {
        const b = this.boss;
        this.playAnim(b, p.def.type === "cone" || p.def.type === "dash" ? "attack" : "spell");
        switch (p.def.type) {
            case "cone": this.fireCone(p); return 0;
            case "projectile": this.fireBolts(p); return 0;
            case "summon": this.fireSummon(p); return 0;
            case "ground_aoe": this.fireGroundAoe(p); return 0;
            case "dash": return this.fireDash(p);
            case "buff": this.fireBuff(p); return 0;
            default:
                console.error("[BossSystem] 알 수 없는 패턴 타입:", p.def.type);
                return 0;
        }
    }

    // ── ① cone — 부채꼴 / 전방위 원 / 도넛 ────────────────────────
    /**
     * 하나의 도형으로 세 가지를 만든다. 이게 "패턴을 데이터로 표현한다"의 실제 모습이다.
     *   angle 130 / inner 0    → 낫 휘두르기 (BOSS1) : 앞에 서지 마라
     *   angle 62  / inner 0    → 화염 방사   (BOSS5) : 정면 직선만 위험, 옆으로 돌아라
     *   angle 360 / inner 46   → 성가 도넛   (BOSS2) : ★ 규칙이 반대다 — 붙어 있어야 안전하다
     * ★ 도넛이 중요한 이유: 다른 보스는 전부 "떨어져라"인데 BOSS2 만 "붙어라"가 된다.
     *   플레이어가 몸에 익힌 안전거리를 한 보스가 무효화하면 그 보스는 확실히 다른 보스가 된다.
     */
    fireCone(p) {
        const w = p.def.params;
        const b = this.boss;
        const r = w.radius;
        const inner = w.innerRadius ?? 0;
        const half = Phaser.Math.DegToRad(w.angle) / 2;
        const dx = this.player.x - b.x, dy = this.player.y - b.y;
        const d2 = dx * dx + dy * dy;

        if (d2 <= r * r && d2 >= inner * inner) {
            const a = Math.atan2(dy, dx);
            // 조준각은 예고 시작 시점에 고정된 aim.ang 이다. 지금 각도로 다시 재면 예고가 무의미해진다.
            if (Math.abs(Phaser.Math.Angle.Wrap(a - this.aim.ang)) <= half) {
                if (this.strike(p.def.damage)) {
                    this.scene.cameras.main.shake(250, 0.008); // 09-ART 낫 착탄 200ms 0.008
                    this.combat?.fx?.hitStop(80);
                }
            }
        }
        this.hitR = r;
        this.hitInner = inner;
        this.hitHalf = half;
        this.hitFxUntil = this.scene.time.now + 120; // 착탄 순간 도형을 한 번 채워 결과를 보여준다
    }

    // ── ② projectile — 직선탄 / 추적탄 / 전방위 링 / 분열탄 ──────
    /**
     *   spread 30~70  → 부채꼴 탄막 (BOSS1 사령탄, BOSS5 잉걸)
     *   spread 360    → 전방위 링   (BOSS6) : count 로 틈의 크기가 정해진다
     *   homing        → 추적탄      (BOSS2) : 선회속도 제한이 공정성의 전부다
     *   split         → 분열탄      (BOSS6) : 사거리 끝에서 갈라진다
     */
    fireBolts(p) {
        const w = p.def.params;
        const b = this.boss;
        const full = (w.spread ?? 0) >= 360;
        const spread = Phaser.Math.DegToRad(full ? 360 : (w.spread ?? 0));
        // "확산 30도"는 부채꼴 전체 폭이다. 3발이면 -15/0/+15도가 된다.
        // 링은 첫 발과 끝 발이 겹치므로 count 로 나눈다(360/count 간격).
        const step = full ? spread / w.count : (w.count > 1 ? spread / (w.count - 1) : 0);
        const a0 = full ? this.aim.ang : this.aim.ang - spread / 2;
        for (let i = 0; i < w.count; i++) {
            const s = this.bolts.obtain();
            if (!s) break;   // 풀이 마르면 그 발은 나오지 않는다. 화면 가독성 예산이 우선이다
            this.initBolt(s, b.x, b.y, a0 + step * i, w, p.def.damage);
        }
    }

    /**
     * 탄 하나 세팅. 분열 자식도 같은 경로를 쓴다 — 두 곳에 두면 반드시 한쪽만 고치게 된다.
     * @param {object} w params. 분열 자식은 부모의 split 블록을 w 로 받는다
     * @param {boolean} child 자식은 다시 분열하지 않는다
     */
    initBolt(s, x, y, ang, w, damage, child = false) {
        const speed = w.speed ?? 150;
        const r = w.boltRadius ?? BOLT_R;
        s.setPosition(x, y).setVisible(true).setAlpha(1);
        s.setRadius(r);
        s.setFillStyle(w.color ?? BLOOD_BRIGHT, 1);
        s.r2 = (r + PLAYER_R) * (r + PLAYER_R);
        s.vx = Math.cos(ang) * speed;
        s.vy = Math.sin(ang) * speed;
        s.spd = speed;
        s.life = (w.range ?? 400) / speed;
        s.damage = damage;
        /**
         * ★ 추적은 선회속도(도/초)로만 준다. 완전 추적탄은 0.6초를 줘도 못 피하므로 T525 위반이다.
         *   70도/초면 플레이어가 탄의 진행 방향에 수직으로 걸어가는 것만으로 각도가 벌어진다 —
         *   "달아나는 것"이 아니라 "옆으로 도는 것"이 정답이 되고, 그건 학습 가능한 회피다.
         *   homingSec 로 추적을 끊는 것도 같은 이유다. 끝까지 따라오면 결국 맞는다.
         */
        s.turn = w.homing ? Phaser.Math.DegToRad(w.homing) : 0;
        s.homeLeft = w.homingSec ?? s.life;
        const sp = child ? null : w.split;
        s.splitN = sp?.count ?? 0;
        if (sp) {
            s.splitSpread = Phaser.Math.DegToRad(sp.spread ?? 90);
            s.splitW = sp;
            s.splitDamage = sp.damage ?? Math.round(damage * 0.6);
        }
    }

    updateBolts(dt) {
        const list = this.bolts.active;
        const px = this.player.x, py = this.player.y;
        for (let i = list.length - 1; i >= 0; i--) {
            const s = list[i];
            if (s.turn > 0 && s.homeLeft > 0) {
                s.homeLeft -= dt;
                const cur = Math.atan2(s.vy, s.vx);
                const diff = Phaser.Math.Angle.Wrap(Math.atan2(py - s.y, px - s.x) - cur);
                const max = s.turn * dt;
                const na = cur + (diff > max ? max : diff < -max ? -max : diff);
                s.vx = Math.cos(na) * s.spd;
                s.vy = Math.sin(na) * s.spd;
            }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (dist2(s.x, s.y, px, py) <= s.r2) {
                // 무적 중이어도 탄은 소멸시킨다. 통과시키면 무적이 끝나는 순간 뒤통수에서 맞는다
                this.strike(s.damage);
                this.releaseBolt(s);     // ★ 맞은 탄은 분열하지 않는다 (아래 splitBolt 주석)
                continue;
            }
            if (s.life <= 0) {
                this.splitBolt(s);
                this.releaseBolt(s);
            }
        }
    }

    /**
     * 분열 — 사거리 끝에서만 갈라진다.
     * ★ 이 규칙이 분열을 공정하게 만든다. 예고선의 길이가 곧 사거리이므로 플레이어는
     *   "어디서 갈라지는지"를 예고 단계에서 이미 보고 있다. 맞은 탄까지 갈라지면
     *   분열 지점이 플레이어 몸 위가 되어 회피 불가능한 2차 타격이 된다.
     * ★ 1세대만 분열한다. 무한 분열은 640x360을 몇 초 만에 채운다.
     */
    splitBolt(s) {
        if (!s.splitN) return;
        const base = Math.atan2(s.vy, s.vx);
        const step = s.splitN > 1 ? s.splitSpread / (s.splitN - 1) : 0;
        for (let i = 0; i < s.splitN; i++) {
            const c = this.bolts.obtain();
            if (!c) break;
            this.initBolt(c, s.x, s.y, base - s.splitSpread / 2 + step * i, s.splitW, s.splitDamage, true);
        }
    }

    releaseBolt(s) {
        s.splitN = 0;
        s.setVisible(false).setPosition(-999, -999);
        this.bolts.release(s);
    }

    // ── ③ summon — 링 소환 ───────────────────────────────────────
    planRing(p) {
        const w = p.def.params;
        const n = Math.min(w.count, this.ring.length);
        const base = Math.random() * TAU; // 매번 같은 자리에 나오면 외워서 무시하게 된다
        for (let i = 0; i < n; i++) {
            const a = base + (TAU / n) * i;
            this.ring[i].x = this.castX + Math.cos(a) * w.ringRadius;
            this.ring[i].y = this.castY + Math.sin(a) * w.ringRadius;
        }
    }

    /**
     * ★ hpMultOverride 1.0 고정 (정본 6.2 근거)
     *   후반 구간의 hpMult(5.64 등)를 그대로 먹이면 소환물 HP가 100을 넘어 잡몹 정리에만 20초가 든다.
     *   보스전은 1:1 구도가 정본(03-GDD 7.3)이고, 소환물은 압박용이지 벽이 아니다.
     *   접촉 데미지는 정본이 hpMult만 고정하라고 했으므로 웨이브 dmgMult를 그대로 둔다.
     */
    fireSummon(p) {
        const w = p.def.params;
        const def = this.spawner.defs.find((d) => d.id === w.enemyId);
        if (!def) { console.error("[BossSystem] 소환할 적 정의가 없다:", w.enemyId); return; }
        for (let i = 0; i < w.count && i < this.ring.length; i++) {
            const at = this.ring[i];
            const e = this.spawner.spawn(def, at) ?? this.rawSpawn(def, at);
            if (!e) break;
            e.maxHp = Math.round(def.baseHp * w.hpMultOverride);
            e.hp = e.maxHp;
        }
    }

    // ── ④ ground_aoe — 장판 / 낙석 / 독무 ────────────────────────
    /**
     * ★ 플레이어 발밑에 깔지 않는다.
     *   반경 r 원의 중심에서 벗어나려면 r px 를 가야 하는데, 예고 0.6s 동안 이동 가능 거리는
     *   70px/s x 0.6 = 42px 뿐이다. 대시(쿨 3.0s)가 없으면 회피 불가 — T525 위반이다.
     *   그래서 플레이어 주위 도넛에 흩뿌린다. 안전지대는 남되 이동은 강제된다.
     *   하한은 buildPhases 의 fixScatter 가 반경에서 역산해 강제한다(데이터가 틀려도 막힌다).
     *
     * ★ 같은 타입으로 성격이 다른 셋을 만든다 — 파라미터만 다르다.
     *   r70 / 6s / 2장   붉은 장판 (BOSS1) : 바닥을 조금씩 잠식
     *   r62 / 8s / 2~4장 독장판   (BOSS3) : 오래 남아 지형을 지운다. 이 보스의 정체성
     *   r32 / 0.7s / 5장 낙석     (BOSS4) : 거의 즉발. 넓게 흩뿌려 "서 있을 곳"을 뺏는다
     */
    planMarks(p) {
        const w = p.def.params;
        const n = Math.min(w.dropsPerCast ?? 1, this.marks.length);
        const base = Math.random() * TAU;
        this.markCount = n;
        for (let i = 0; i < n; i++) {
            // 서로 최소 (360/n)도 떨어뜨린다 — 겹쳐 깔리면 반쪽짜리 장판 하나가 된다
            const a = base + (TAU / n) * i;
            const d = p.scatterMin + Math.random() * (p.scatterMax - p.scatterMin);
            this.marks[i].x = this.aoeAim.x + Math.cos(a) * d;
            this.marks[i].y = this.aoeAim.y + Math.sin(a) * d;
        }
    }

    fireGroundAoe(p) {
        const w = p.def.params;
        for (let i = 0; i < this.markCount; i++) {
            if (this.pools.activeCount >= w.maxActive) break;
            const z = this.pools.obtain();
            if (!z) break;
            const a0 = w.alpha ?? 0.34;
            z.setPosition(this.marks[i].x, this.marks[i].y).setVisible(true).setAlpha(a0);
            z.setRadius(w.radius);
            z.setFillStyle(w.color ?? BLOOD_DEEP, 0.34);
            z.setStrokeStyle(1, w.edge ?? BLOOD, 0.7);
            z.a0 = a0;
            z.zr2 = (w.radius + PLAYER_R) * (w.radius + PLAYER_R);
            z.damage = p.def.damage;
            z.life = w.duration;
            z.tickEvery = w.tickInterval;
            z.tickTimer = 0; // 진입 즉시 1틱 — "밟았는데 아프지 않다"가 더 혼란스럽다
        }
    }

    updatePools(dt) {
        const list = this.pools.active;
        const px = this.player.x, py = this.player.y;
        for (let i = list.length - 1; i >= 0; i--) {
            const z = list[i];
            z.tickTimer -= dt;
            if (z.tickTimer <= 0) {
                z.tickTimer += z.tickEvery;
                if (dist2(z.x, z.y, px, py) <= z.zr2) this.strike(z.damage);
            }
            z.life -= dt;
            if (z.life <= 0) {
                z.setVisible(false).setPosition(-999, -999);
                this.pools.release(z);
            } else if (z.life < 1) {
                z.setAlpha(z.a0 * z.life); // 마지막 1초에 옅어진다 — 사라질 때를 눈으로 알 수 있게
            }
        }
    }

    // ── ⑤ dash — 직선 돌진 ───────────────────────────────────────
    /** @returns {number} 이동에 걸리는 시간. 메인 채널이 그만큼 더 잠긴다 */
    fireDash(p) {
        const w = p.def.params;
        const d = this.dash;
        d.dx = Math.cos(this.aim.ang);
        d.dy = Math.sin(this.aim.ang);
        d.speed = w.speed;
        d.left = w.distance;
        d.damage = p.def.damage;
        d.r2 = (w.halfWidth + PLAYER_R) * (w.halfWidth + PLAYER_R);
        d.hit = false;
        this.scene.cameras.main.shake(160, 0.006);
        return w.distance / w.speed;
    }

    // ── ⑥ buff — 광폭화 ──────────────────────────────────────────
    /**
     * ★ 광폭화가 건드리는 것은 이동속도와 쿨다운뿐이다. 예고 시간은 절대 건드리지 않는다.
     *   "빨라진다"를 예고 단축으로 표현하면 그 순간 T525 하한이 무너지고, 플레이어는
     *   자기 실력이 아니라 게임의 결함으로 정확히 인식한다.
     *   대신 같은 패턴이 더 자주 오게 해서 "쉴 틈이 없다"로 압박한다 — 학습 가능한 어려움이다.
     */
    fireBuff(p) {
        const w = p.def.params;
        this.enrageUntil = this.scene.time.now + (w.duration ?? 6) * 1000;
        this.enrageSpeed = w.speedMult ?? 1;
        this.enrageCd = w.cdMult ?? 1;
        this.enrageTint = w.tint ?? 0xff5a28;
        this.scene.cameras.main.shake(320, 0.007);
        this.combat?.fx?.hitStop(120);
    }

    // ── T525 텔레그래프 ──────────────────────────────────────────
    /**
     * ★ 예고는 처음부터 "최종 범위 전체"를 윤곽선으로 보여주고, 채움만 시간에 따라 짙어진다.
     *   범위 자체가 커지는 연출은 멋있지만 t=0.3 시점에 최종 범위를 알 수 없어
     *   실질 반응 시간이 0.6s보다 짧아진다. 윤곽은 즉시 = 어디가 위험한가,
     *   농도는 점증 = 언제 터지는가. 두 정보를 분리해야 0.6초가 온전히 쓰인다.
     */
    drawTelegraph() {
        const g = this.tele;
        g.clear();
        const b = this.boss;
        const now = this.scene.time.now;

        // 착탄 잔상 — 맞았든 피했든 "여기까지였다"를 보여준다
        if (now < this.hitFxUntil) {
            this.fillSector(g, b.x, b.y, this.hitInner, this.hitR,
                this.aim.ang - this.hitHalf, this.aim.ang + this.hitHalf, 0.45);
        }

        // 광폭화 표시 — 시전 중이 아니어도 계속 떠 있어야 "지금 빠르다"가 읽힌다
        if (this.enraged) {
            const pulse = 0.25 + 0.15 * Math.sin(now / 90);
            g.lineStyle(2, DANGER, pulse);
            g.strokeCircle(b.x, b.y, 34);
        }

        // 장판 채널 — 메인과 동시에 떠 있을 수 있다
        if (this.aoe) {
            const w = this.aoe.def.params;
            const t = Math.min(1, this.aoeT / this.aoe.windup);
            for (let i = 0; i < this.markCount; i++) {
                const m = this.marks[i];
                g.fillStyle(DANGER, 0.10 + 0.30 * t);
                g.fillCircle(m.x, m.y, w.radius);
                g.lineStyle(1, DANGER, 0.75);
                g.strokeCircle(m.x, m.y, w.radius);
            }
        }

        const p = this.cast;
        if (!p) return;
        const w = p.def.params;
        const t = Math.min(1, this.castT / p.windup);
        const fill = 0.10 + 0.30 * t;

        switch (p.def.type) {
            case "cone": {
                const half = Phaser.Math.DegToRad(w.angle) / 2;
                const inner = w.innerRadius ?? 0;
                const a0 = this.aim.ang - half, a1 = this.aim.ang + half;
                this.fillSector(g, b.x, b.y, inner, w.radius, a0, a1, fill);
                g.lineStyle(1, DANGER, 0.7);
                g.beginPath();
                g.arc(b.x, b.y, w.radius, a0, a1, false);
                g.strokePath();
                if (inner > 0) {
                    // ★ 안쪽 경계선은 "여기부터 안전하다"를 알리는 선이다. 도넛의 핵심 정보라 더 진하게.
                    g.lineStyle(1, DANGER, 0.9);
                    g.beginPath();
                    g.arc(b.x, b.y, inner, a0, a1, false);
                    g.strokePath();
                } else if (half < Math.PI - 0.01) {
                    g.lineBetween(b.x, b.y, b.x + Math.cos(a0) * w.radius, b.y + Math.sin(a0) * w.radius);
                    g.lineBetween(b.x, b.y, b.x + Math.cos(a1) * w.radius, b.y + Math.sin(a1) * w.radius);
                }
                break;
            }
            case "projectile": {
                // 붉은 조준선 N줄. 선 길이는 실제 사거리와 같다 — 짧게 그리면 뒤에서 맞는다.
                // ★ 링(spread 360)은 이 선들 사이의 틈이 곧 안전지대다. 그래서 선을 줄이면 안 된다.
                const full = (w.spread ?? 0) >= 360;
                const spread = Phaser.Math.DegToRad(full ? 360 : (w.spread ?? 0));
                const step = full ? spread / w.count : (w.count > 1 ? spread / (w.count - 1) : 0);
                const a0 = full ? this.aim.ang : this.aim.ang - spread / 2;
                g.lineStyle(1, DANGER, 0.35 + 0.45 * t);
                for (let i = 0; i < w.count; i++) {
                    const a = a0 + step * i;
                    g.lineBetween(b.x, b.y, b.x + Math.cos(a) * w.range, b.y + Math.sin(a) * w.range);
                }
                // 분열탄은 갈라지는 지점을 미리 찍는다. 사거리 끝에서만 갈라지므로 예고가 성립한다
                if (w.split) {
                    g.fillStyle(DANGER, 0.25 + 0.45 * t);
                    for (let i = 0; i < w.count; i++) {
                        const a = a0 + step * i;
                        g.fillCircle(b.x + Math.cos(a) * w.range, b.y + Math.sin(a) * w.range, 3);
                    }
                }
                break;
            }
            case "summon": {
                // 예고 원점은 시전 시작 위치다. 보스가 걸어가도 소환물은 예고한 자리에 나온다
                g.lineStyle(1, DANGER, 0.35 + 0.35 * t);
                g.strokeCircle(this.castX, this.castY, w.ringRadius);
                g.fillStyle(DANGER, fill + 0.15);
                for (let i = 0; i < w.count && i < this.ring.length; i++) {
                    g.fillCircle(this.ring[i].x, this.ring[i].y, 3 + 3 * t);
                }
                break;
            }
            case "dash": {
                // 도달점까지의 직사각형 전체를 처음부터 보여준다. 폭은 판정 폭과 같다
                const c = Math.cos(this.aim.ang), s = Math.sin(this.aim.ang);
                const nx = -s * w.halfWidth, ny = c * w.halfWidth;
                const ex = b.x + c * w.distance, ey = b.y + s * w.distance;
                const q = this.quad;
                q[0].x = b.x + nx; q[0].y = b.y + ny;
                q[1].x = ex + nx;  q[1].y = ey + ny;
                q[2].x = ex - nx;  q[2].y = ey - ny;
                q[3].x = b.x - nx; q[3].y = b.y - ny;
                g.fillStyle(DANGER, fill);
                g.fillPoints(q, true);
                g.lineStyle(1, DANGER, 0.75);
                g.strokePoints(q, true);
                break;
            }
            case "buff": {
                // 안쪽 원이 차오르면 발동한다. 범위 정보가 아니라 타이밍 정보만 주면 되는 유일한 패턴이다
                const r = w.radius ?? 40;
                g.lineStyle(2, DANGER, 0.35 + 0.5 * t);
                g.strokeCircle(b.x, b.y, r);
                g.lineStyle(1, DANGER, 0.3 + 0.4 * t);
                g.strokeCircle(b.x, b.y, r * (0.25 + 0.75 * t));
                break;
            }
        }
    }

    /**
     * 부채꼴/원/도넛을 한 함수로 채운다.
     * ★ 도넛을 "굵은 호"로 그리는 이유 — Graphics 에는 구멍 뚫린 도형이 없다.
     *   안쪽을 배경색으로 덮으면 그 아래 있는 적과 바닥이 지워져 더 나쁘다.
     *   선 굵기 = 바깥-안쪽, 반지름 = 중간값인 호는 정확히 같은 면적을 칠한다.
     */
    fillSector(g, x, y, inner, outer, a0, a1, alpha) {
        if (outer <= 0) return;
        if (inner > 0) {
            g.lineStyle(outer - inner, DANGER, alpha);
            g.beginPath();
            g.arc(x, y, (outer + inner) / 2, a0, a1, false);
            g.strokePath();
            g.lineStyle(1, DANGER, 0);   // 이후 stroke 가 이 굵기를 물려받지 않게 되돌린다
            return;
        }
        g.fillStyle(DANGER, alpha);
        g.slice(x, y, outer, a0, a1, false);
        g.fillPath();
    }

    // ── T526 HP 전파 ─────────────────────────────────────────────
    /**
     * HP바 자체는 HudScene이 60fps로 직접 그린다(this.boss를 읽는다).
     * 이 이벤트는 React 쪽 소비자용이고, runSlice 주석대로 200ms 스로틀을 건다.
     * 매 프레임 emit하면 Zustand가 초당 60회 리렌더를 돌려 보스전에서 프레임이 깎인다.
     */
    emitHp(force = false) {
        const now = this.scene.time.now;
        if (!force && now - this.hpEmitAt < HP_EMIT_MS) return;
        this.hpEmitAt = now;
        const b = this.boss;
        EventBus.emit(EVENTS.BOSS_HP, {
            hp: Math.max(0, b.hp), maxHp: b.maxHp, phase: this.phase,
        });
    }

    // ── 처치 ─────────────────────────────────────────────────────
    onDefeat() {
        this.defeated = true;
        this.active = false;
        this.dying = true;
        this.cancelCast();
        this.purgeMinions();          // 남은 소환물까지 같이 정리한다. 승리 순간에 잡몹이 남으면 김이 샌다
        this.clearProjectiles();

        // 골드 공식의 bossClear 항 (08-DATA-SCHEMA goldFormula: perKill 1 / bossClear 200)
        // 클리어 보상에도 성소 「탐욕」이 붙는다 — 처치 골드만 오르고 보상은 안 오르면
        // "골드 획득 +10%"라는 문구가 거짓이 된다.
        this.combat.gold += this.def.goldOnClear * (this.combat.stats?.get("goldMult") ?? 1);

        this.corpse.setPosition(this.lastX, this.lastY).setVisible(true).setAlpha(1);
        this.playAnim(this.corpse, "death");
        this.combat?.fx?.hitStop(300);              // 09-ART 보스 처치 히트스톱 300ms
        this.scene.cameras.main.shake(500, 0.010);
        EventBus.emit(EVENTS.BOSS_HP, { hp: 0, maxHp: this.def.baseHp, phase: this.phase });

        // 10-UIUX 6.4 보스 처치 연출 총 1.4초. dt가 아니라 벽시계로 잰다 —
        // 히트스톱/슬로모션이 dt를 건드려도 결과 화면이 늦게 뜨면 안 된다.
        this.deathAt = this.scene.time.now + 1400;
    }

    updateDeath() {
        if (this.scene.time.now < this.deathAt) return;
        this.dying = false;
        this.corpse.setVisible(false).setPosition(-999, -999);
        this.endRun();
    }

    /**
     * ★ 승리 종료는 CombatSystem이 아니라 여기서 쏜다.
     *   페이로드 모양은 CombatSystem.die()와 정확히 같아야 한다 — 결과 화면은 reason만 보고
     *   나머지 필드는 구분 없이 읽는다. 필드가 하나라도 빠지면 승리 화면에서만 값이 비어 보인다.
     */
    endRun() {
        const c = this.combat;
        EventBus.emit(EVENTS.RUN_ENDED, {
            reason: "victory",
            time: Math.floor(this.spawner.elapsed),
            kills: this.spawner.killCount,
            level: c.level,
            gold: Math.floor(c.gold),
            awakenings: c.awakening ? [...c.awakening.list] : [],
            humanity: c.pact?.humanity ?? 100,
            stageId: this.scene.stages?.current?.id ?? null,
        });
        // 결과 화면 뒤에서 스폰·AI가 계속 돌면 안 된다. CombatSystem.die()는 dead 플래그로
        // GameScene을 조기 반환시키지만 승리는 "플레이어가 죽었다"가 아니므로 그 플래그를 빌리지 않는다.
        this.scene.scene.pause();
    }

    clearProjectiles() {
        const bolts = this.bolts.active;
        for (let i = bolts.length - 1; i >= 0; i--) this.releaseBolt(bolts[i]);
        const zones = this.pools.active;
        for (let i = zones.length - 1; i >= 0; i--) {
            zones[i].setVisible(false).setPosition(-999, -999);
            this.pools.release(zones[i]);
        }
    }
}
