/**
 * BossSystem — 6:00 최종 보스 「여명의 처형인」. (Day 6 / T520~T526)
 *
 * 규격: 05-COMBAT 6(HP 11,000 / 3페이즈 / 패턴 수치표) / 03-GDD 7.3 / 08-DATA-SCHEMA 3.3
 * 수치는 전부 data/boss.json 이다. 이 파일에 숫자를 박지 않는다 — 밸런싱은 JSON만 고쳐서 한다.
 *
 * ★ 이름 주의 — 「녹턴」은 PACT 카드를 내미는 흡혈귀(01-CONCEPT 4.4)다.
 *   6:00에 나오는 보스는 「여명의 처형인」이고 둘은 다른 캐릭터다.
 *
 * ★ T525 — 모든 패턴은 0.6s 이상 텔레그래프를 갖는다.
 *   640x360 모바일에서 붉은 인디케이터를 인지하고 엄지로 조이스틱을 꺾는 데 필요한 최소 시간이다.
 *   이보다 짧으면 난이도가 아니라 불공정이 된다. 생성자가 데이터를 검사해 강제로 끌어올린다.
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
 * ── 전투 시간 검산 (05-COMBAT 6.1/6.3) ──
 *   6:00 표준 빌드 실효 DPS 152. HP 11,000 / 152 = 72.4초.
 *   페이즈 전환 무적 1.2s x 2 = 2.4초, P3 회피 부담으로 +20%(약 4.8초) 가산 => 약 80초.
 *   목표 60~90초 안이다. 하위 10% 빌드(DPS 109)는 101초로 초과하지만
 *   이는 정본이 §9 튜닝 노브로 대응하기로 한 의도된 편차다.
 *
 * ── 통합 계약 (GameScene 이 이대로 부른다) ──
 *   new BossSystem(scene, { player, spawn, combat, stats })
 *   .spawn()        : 보스 등장 (6:00). 잡몹 정화 + 붉은 플래시.
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

/** 사령탄 동시 최대 = 5발(P2/P3 1회) + 여유. 런 중 new 금지라 미리 만든다 */
const MAX_BOLTS = 16;
/** 장판 동시 최대 4개(정본) + 여유 */
const MAX_POOLS = 6;

/**
 * 패턴 발동 직후 경직. 패턴이 끝나자마자 다음 예고가 시작되면 화면을 읽을 수 없다.
 * ★ 0.15로 잡은 근거 — P3 메인 채널 점유율 계산:
 *   낫 (0.80+0.15)/1.68 + 사령탄 (0.60+0.15)/4.00 + 소환 (1.00+0.15)/9.00 = 0.88
 *   0.25면 0.98이 되어 채널이 포화하고, 쿨이 긴 소환이 사실상 발동하지 못한다(실측 2회/기대 5회).
 */
const RECOVER = 0.15;

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

        /** 메인 채널(낫/사령탄/소환). 이 셋은 예고가 전부 보스 몸에서 뻗어나와 동시에 읽을 수 없다 */
        this.cast = null;
        this.castT = 0;
        this.castX = 0;
        this.castY = 0;
        this.recoverT = 0;
        /** 장판 전용 채널. 예고가 보스 몸이 아니라 월드에 그려져 메인 예고와 겹치지 않는다 */
        this.aoe = null;
        this.aoeT = 0;

        /** 조준 스냅샷. 예고 시작 순간에 고정한다 (아래 startCast 주석 참고) */
        this.aim = { x: 0, y: 0, ang: 0 };
        /** 소환 링 좌표 6개 / 장판 목표 2개 — 예고와 실제가 정확히 같은 자리여야 한다 */
        this.ring = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
        this.marks = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
        this.markCount = 0;

        /** 보스가 죽으면 CombatSystem이 즉시 스프라이트를 풀에 반환한다 → 좌표를 미리 들고 있는다 */
        this.lastX = 0;
        this.lastY = 0;
        this.hpEmitAt = 0;
        this.hitFxUntil = 0;
        this.hitR = 0;      // 낫 착탄 잔상용. 매 프레임 객체를 만들지 않으려고 원시값으로 들고 있다
        this.hitHalf = 0;
        this.leashing = false;
        this.deathAt = 0;

        /**
         * 페이즈별 패턴 런타임. 데이터의 windup 이 T525 하한 미만이면 여기서 끌어올린다.
         * 데이터가 틀렸다고 게임을 죽이지는 않되, 조용히 넘어가면 "불공정한 보스"가 배포된다.
         */
        this.byPhase = { 1: [], 2: [], 3: [] };
        for (const d of this.def.patterns) {
            const windup = Math.max(d.windup, MIN_TELEGRAPH);
            if (windup !== d.windup) {
                console.error(`[BossSystem] T525 위반 — ${d.id}(P${d.phase}) windup ${d.windup}s → ${MIN_TELEGRAPH}s로 강제`);
            }
            this.byPhase[d.phase].push({ def: d, windup, timer: d.cooldown });
        }

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
         */
        this.corpse = scene.add.sprite(-999, -999, "boss", 0)
            .setDepth(DEPTH.ENEMY).setVisible(false);
    }

    /** 현재 페이즈 정의 (moveSpeedMult 등) */
    get phaseDef() { return this.def.phases[this.phase - 1] ?? this.def.phases[0]; }

    get invulnerable() { return this.scene.time.now < this.invulnUntil; }

    // ── T521 등장 연출 ────────────────────────────────────────────
    /**
     * 잡몹 전멸(정화) → 보스 등록 → 붉은 플래시.
     * 정화를 먼저 하는 이유가 연출만은 아니다. 6:00 구간 cap 은 150이라 풀이 꽉 차 있어
     * 정화 전에 obtain() 하면 null 이 돌아와 보스가 아예 등장하지 않는다.
     */
    /**
     * 스테이지가 어떤 보스를 쓸지 정한다. StageSystem.load 가 부른다.
     * ★ 여기서 스프라이트를 만들지 않는다 — 보스는 등장 시점(6:00)에 적 풀에서 꺼낸다.
     *   미리 만들면 런 내내 보이지 않는 스프라이트가 배칭에 끼어든다.
     */
    setBoss(bossId) {
        const d = this.defs[bossId];
        if (!d) { console.warn("[BossSystem] 알 수 없는 보스:", bossId); return false; }
        this.def = d;
        return true;
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

    spawn() {
        if (this.active || this.defeated) return this.boss;

        // 스폰 영구 중단. SpawnSystem 소유자가 이 플래그를 본다(의존성: 보고서 참고)
        this.spawner.suppressed = true;
        this.purgeMinions();

        const d = this.def;
        // 가로 640 / 세로 360 — 좌우에서 들어와야 보스 전신(140x93)이 화면에 들어온다.
        // 위아래에서 오면 등장 순간 프레임의 절반이 화면 밖이다.
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const a = side + (Math.random() - 0.5) * Phaser.Math.DegToRad(50);
        const at = { x: this.player.x + Math.cos(a) * 210, y: this.player.y + Math.sin(a) * 210 };

        const b = this.spawner.spawn(d, at) ?? this.rawSpawn(d, at);
        if (!b) {
            console.error("[BossSystem] 적 풀에서 보스를 꺼내지 못했다");
            return null;
        }

        // SpawnSystem.reset 이 웨이브 배율(6:00 hpMult 5.64)을 곱해 놨다. 보스는 고정값이다.
        b.maxHp = d.baseHp;
        b.hp = d.baseHp;
        b.damage = d.contactDamage;              // dmgMult 미적용 — 정본 4.4 고정값
        b.speed = d.moveSpeed;
        // 히트박스 56x80을 원으로 근사할 때 긴 변(80)을 쓰면 머리 위 허공에서 맞는다.
        // 짧은 변 기준 반경 28이 "보이는 몸통"과 가장 가깝다.
        b.radius = d.hitbox.w / 2;
        b.expValue = d.expValue;                 // 0 — 보스는 EXP를 주지 않는다(런이 끝난다)
        b.goldValue = d.goldValue;               // 0 — 클리어 보상은 goldOnClear로 따로 준다
        // ★ 보스는 적 풀에 든 평범한 적이라 despawnFar(900px)의 대상이 된다.
        //   리쉬가 508px에서 잡아주지만, 치트나 극단적 이동으로 한 번만 넘어가면
        //   보스가 소리 없이 사라지고 런이 끝나지 않는다. 표식으로 막는다.
        b.isBoss = true;
        // 스테이지 보스는 전용 시트를 쓴다. 없으면 기존 텍스처를 유지한다.
        this.ensureAnims();
        if (this.def.sheet && this.scene.textures.exists(this.def.sheet)) {
            b.setTexture(this.def.sheet, 0);
            const idle = this.def.sheet + ".idle";
            if (this.scene.anims.exists(idle)) b.play(idle, true);
        }
        b.knockbackResist = 1;                   // 넉백 면역. 정본 09-ART 넉백표 "보스 0px"
        b.kbx = 0;
        b.kby = 0;

        this.boss = b;
        this.lastX = b.x;
        this.lastY = b.y;
        this.active = true;
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
        this.updateMove(locked);
        if (!locked) this.updatePatterns(dt);
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
     *   P3 진입 순간 4개 패턴의 타이머가 전부 0 이하로 쌓여 있으면 무적이 풀리자마자
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
     *   한 프레임에 3,630(=P3 임계값 전량)을 넣을 수 있는 빌드는 존재하지 않으므로
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

    // ── 이동 ─────────────────────────────────────────────────────
    /**
     * 이동은 EnemyAISystem이 한다(직선 추격 + 넉백 감쇠 + 좌우 반전).
     * 여기서는 speed 만 바꿔 개입한다 — 보스만 별도 이동 코드를 쓰면 같은 버그를 두 곳에서 고치게 된다.
     * EnemyAISystem은 4프레임에 한 번 재조준하므로 정지 반영이 최대 3프레임(=2px) 늦지만 체감되지 않는다.
     */
    updateMove(locked) {
        const b = this.boss;
        /**
         * ★ 정지하는 것은 낫(cone)뿐이다.
         *   부채꼴은 보스 몸에 붙은 예고라 보스가 움직이면 예고가 그대로 거짓말이 된다.
         *   반대로 사령탄·소환·장판까지 정지시키면 P3 점유율이 90%를 넘어 보스가 사실상 제자리에 서고,
         *   정본이 광폭화의 핵심으로 지정한 이동속도 x1.4(64px/s)가 화면에 한 번도 나타나지 않는다.
         */
        if (locked || this.cast?.def.type === "cone") {
            b.speed = 0;
            b.vx = 0;
            b.vy = 0;
            return;
        }
        const base = this.def.moveSpeed * this.phaseDef.moveSpeedMult;
        const d2 = dist2(b.x, b.y, this.player.x, this.player.y);
        // 히스테리시스 — 경계에서 가속/감속이 떨리면 이동이 덜덜거린다
        if (d2 > LEASH_FAR2) this.leashing = true;
        else if (d2 < LEASH_NEAR2) this.leashing = false;
        b.speed = this.leashing ? base * LEASH_BOOST : base;
    }

    // ── 패턴 스케줄러 ────────────────────────────────────────────
    /**
     * 채널이 둘이다 — 메인(낫/사령탄/소환)과 장판.
     *
     * ★ 메인 채널은 한 번에 하나만 시전한다.
     *   낫·사령탄·소환의 예고는 전부 보스 몸에서 뻗어나오는 도형이라, 둘이 겹치면
     *   640x360에서 어느 쪽이 언제 터지는지 읽을 수 없고 0.6s 텔레그래프가 장식이 된다(T525).
     *
     * ★ 장판만 별도 채널인 이유.
     *   장판 예고는 보스가 아니라 플레이어 주변 월드 좌표에 그려지는 독립된 원이라 시각적으로 겹치지 않는다.
     *   그리고 메인 채널에 넣으면 P3 점유율이 1.05를 넘어(오버서브스크립션) 장판이 26초 동안 2회밖에
     *   나오지 못한다 — 정본이 P3의 정체성으로 지정한 "바닥 장판"이 사실상 사라진다.
     *
     * 대기 중인 패턴은 쿨이 계속 흘러 마이너스가 되고, 가장 오래 기다린 것이 다음 차례를 갖는다.
     * 빚의 상한이 -cooldown이라 쿨이 긴 패턴(소환 -9.0)이 짧은 패턴(낫 -1.68)보다 항상 먼저 선택된다.
     */
    updatePatterns(dt) {
        let main = null, aoe = null;
        for (const p of this.byPhase[this.phase]) {
            if (p === this.cast || p === this.aoe) continue;   // 시전 중인 것은 발동 시 리셋된다
            p.timer -= dt;
            if (p.timer < -p.def.cooldown) p.timer = -p.def.cooldown;
            if (p.timer > 0) continue;
            if (p.def.type === "ground_aoe") { if (!aoe || p.timer < aoe.timer) aoe = p; }
            else if (!main || p.timer < main.timer) main = p;
        }

        // ── 메인 채널
        if (this.cast) {
            this.castT += dt;
            if (this.castT >= this.cast.windup) {
                this.fire(this.cast);
                this.cast.timer = this.cast.def.cooldown;
                this.cast = null;
                this.recoverT = RECOVER;
            }
        } else if (this.recoverT > 0) {
            this.recoverT -= dt;
            // 경직이 풀리는 프레임에만 idle로 되돌린다. delayedCall을 쓰면 런 중 TimerEvent가 쌓인다
            if (this.recoverT <= 0 && this.scene.anims.exists("boss.idle")) this.boss.play("boss.idle", true);
        } else if (main) {
            this.startCast(main);
        }

        // ── 장판 채널 (경직 없음. 시전 애니도 메인 채널이 소유하므로 건드리지 않는다)
        if (this.aoe) {
            this.aoeT += dt;
            if (this.aoeT >= this.aoe.windup) {
                this.fireBloodpool(this.aoe);
                this.aoe.timer = this.aoe.def.cooldown;
                this.aoe = null;
            }
        } else if (aoe) {
            this.aoe = aoe;
            this.aoeT = 0;
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

        // 예고를 그릴 원점. 소환 링은 보스가 걸어가도 예고한 자리에 그대로 나와야 한다
        this.castX = b.x;
        this.castY = b.y;
        // 예고에 그릴 좌표를 지금 확정한다. 예고와 실제가 1px이라도 다르면 플레이어는 학습할 수 없다.
        if (p.def.type === "summon") this.planRing(p);

        if (this.scene.anims.exists("boss.cast")) b.play("boss.cast", true);
    }

    cancelCast() {
        this.cast = null;
        this.castT = 0;
        this.aoe = null;
        this.aoeT = 0;
        this.recoverT = 0;
        this.tele.clear();
    }

    /**
     * ★ 플레이어 피격은 반드시 이 함수를 거친다.
     *   CombatSystem.hurt()는 무적프레임을 스스로 검사하지 않는다 — 검사는 호출자(contactDamage)에 있다.
     *   그래서 사령탄 5발이 같은 프레임에 닿으면 18 x 5 = 90이 한 번에 들어가 즉사한다.
     *   보스 패턴은 전부 여기로 모아 combat.invulnerable 을 먼저 본다.
     * @returns {boolean} 실제로 피해가 들어갔는가
     */
    strike(amount) {
        if (this.combat.invulnerable) return false;
        this.combat.hurt(amount);
        return true;
    }

    fire(p) {
        const b = this.boss;
        const anim = p.def.type === "cone" ? "boss.attack" : "boss.spell";
        if (this.scene.anims.exists(anim)) b.play(anim, true);
        switch (p.def.type) {
            case "cone": this.fireScythe(p); break;
            case "projectile": this.fireBolts(p); break;
            case "summon": this.fireSummon(p); break;
            case "ground_aoe": this.fireBloodpool(p); break;
        }
    }

    // ── T522 ① 낫 휘두르기 (부채꼴 130도 / 반경 96 / dmg 26) ─────
    fireScythe(p) {
        const w = p.def.params;
        const b = this.boss;
        const r = w.radius;
        const half = Phaser.Math.DegToRad(w.angle) / 2;
        const dx = this.player.x - b.x, dy = this.player.y - b.y;

        if (dx * dx + dy * dy <= r * r) {
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
        this.hitHalf = half;
        this.hitFxUntil = this.scene.time.now + 120; // 착탄 순간 부채꼴을 한 번 채워 결과를 보여준다
    }

    // ── T522 ② 사령탄 (P1 3방향 30도 / P2·P3 5방향 50도) ─────────
    fireBolts(p) {
        const w = p.def.params;
        const b = this.boss;
        const spread = Phaser.Math.DegToRad(w.spread);
        // "확산 30도"는 부채꼴 전체 폭이다. 3발이면 -15/0/+15도가 된다.
        const step = w.count > 1 ? spread / (w.count - 1) : 0;
        for (let i = 0; i < w.count; i++) {
            const s = this.bolts.obtain();
            if (!s) break;
            const a = this.aim.ang - spread / 2 + step * i;
            s.setPosition(b.x, b.y).setVisible(true).setAlpha(1);
            s.vx = Math.cos(a) * w.speed;
            s.vy = Math.sin(a) * w.speed;
            s.life = w.range / w.speed;
            s.damage = p.def.damage;
        }
    }

    updateBolts(dt) {
        const list = this.bolts.active;
        const px = this.player.x, py = this.player.y;
        const rr = (BOLT_R + PLAYER_R) * (BOLT_R + PLAYER_R);
        for (let i = list.length - 1; i >= 0; i--) {
            const s = list[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (dist2(s.x, s.y, px, py) <= rr) {
                // 무적 중이어도 탄은 소멸시킨다. 통과시키면 무적이 끝나는 순간 뒤통수에서 맞는다
                this.strike(s.damage);
                this.releaseBolt(s);
                continue;
            }
            if (s.life <= 0) this.releaseBolt(s);
        }
    }

    releaseBolt(s) {
        s.setVisible(false).setPosition(-999, -999);
        this.bolts.release(s);
    }

    // ── T523 ③ 소환 (E4 낡은 해골 6체 / 링 반경 120 / hpMult 1.0 고정) ──
    planRing(p) {
        const w = p.def.params;
        const base = Math.random() * TAU; // 매번 같은 자리에 나오면 외워서 무시하게 된다
        for (let i = 0; i < w.count && i < this.ring.length; i++) {
            const a = base + (TAU / w.count) * i;
            this.ring[i].x = this.castX + Math.cos(a) * w.ringRadius;
            this.ring[i].y = this.castY + Math.sin(a) * w.ringRadius;
        }
    }

    /**
     * ★ hpMult 1.0 고정 (정본 6.2 근거)
     *   6:00의 hpMult 5.64를 그대로 먹이면 해골 HP가 101이 되어 잡몹 정리에만 20초가 든다.
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

    // ── T524 ④ 붉은 장판 (반경 70 / 12 per sec / 지속 6.0s / 최대 4개) ──
    /**
     * ★ 플레이어 발밑에 깔지 않는다.
     *   반경 70px 원의 중심에서 벗어나려면 70px를 가야 하는데, 예고 0.6s 동안 이동 가능 거리는
     *   70px/s x 0.6 = 42px 뿐이다. 대시(쿨 3.0s)가 없으면 회피 불가 — T525 위반이다.
     *   그래서 플레이어 주위 도넛(70~150px)에 흩뿌린다. 안전지대는 남되 이동은 강제된다.
     *
     * ★ 1회 2장을 까는 근거: 쿨 5.0s / 지속 6.0s 이므로 1장씩이면 동시 최대가 2장에 머문다.
     *   정본 6.2가 "최대 4개 동시"를 전제로 안전지대 60%를 계산했으므로 2장이 맞다.
     */
    planMarks(p) {
        const w = p.def.params;
        const n = Math.min(w.dropsPerCast ?? 1, this.marks.length);
        const base = Math.random() * TAU;
        this.markCount = n;
        for (let i = 0; i < n; i++) {
            // 서로 최소 (360/n)도 떨어뜨린다 — 겹쳐 깔리면 반쪽짜리 장판 하나가 된다
            const a = base + (TAU / n) * i;
            const d = w.scatterMin + Math.random() * (w.scatterMax - w.scatterMin);
            this.marks[i].x = this.aim.x + Math.cos(a) * d;
            this.marks[i].y = this.aim.y + Math.sin(a) * d;
        }
    }

    fireBloodpool(p) {
        const w = p.def.params;
        for (let i = 0; i < this.markCount; i++) {
            if (this.pools.activeCount >= w.maxActive) break;
            const z = this.pools.obtain();
            if (!z) break;
            z.setPosition(this.marks[i].x, this.marks[i].y).setVisible(true).setAlpha(0.34);
            z.setRadius(w.radius);
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
                z.setAlpha(0.34 * z.life); // 마지막 1초에 옅어진다 — 사라질 때를 눈으로 알 수 있게
            }
        }
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

        // 낫 착탄 잔상 — 맞았든 피했든 "여기까지였다"를 보여준다
        if (now < this.hitFxUntil) {
            g.fillStyle(DANGER, 0.45);
            g.slice(b.x, b.y, this.hitR, this.aim.ang - this.hitHalf, this.aim.ang + this.hitHalf, false);
            g.fillPath();
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
                const a0 = this.aim.ang - half, a1 = this.aim.ang + half;
                g.fillStyle(DANGER, fill);
                g.slice(b.x, b.y, w.radius, a0, a1, false);
                g.fillPath();
                g.lineStyle(1, DANGER, 0.7);
                g.beginPath();
                g.arc(b.x, b.y, w.radius, a0, a1, false);
                g.strokePath();
                g.lineBetween(b.x, b.y, b.x + Math.cos(a0) * w.radius, b.y + Math.sin(a0) * w.radius);
                g.lineBetween(b.x, b.y, b.x + Math.cos(a1) * w.radius, b.y + Math.sin(a1) * w.radius);
                break;
            }
            case "projectile": {
                // 붉은 조준선 N줄. 선 길이는 실제 사거리와 같다 — 짧게 그리면 뒤에서 맞는다
                const spread = Phaser.Math.DegToRad(w.spread);
                const step = w.count > 1 ? spread / (w.count - 1) : 0;
                g.lineStyle(1, DANGER, 0.35 + 0.45 * t);
                for (let i = 0; i < w.count; i++) {
                    const a = this.aim.ang - spread / 2 + step * i;
                    g.lineBetween(b.x, b.y, b.x + Math.cos(a) * w.range, b.y + Math.sin(a) * w.range);
                }
                break;
            }
            case "summon": {
                // 예고 원점은 시전 시작 위치다. 보스가 걸어가도 해골은 예고한 자리에 나온다
                g.lineStyle(1, DANGER, 0.35 + 0.35 * t);
                g.strokeCircle(this.castX, this.castY, w.ringRadius);
                g.fillStyle(DANGER, fill + 0.15);
                for (let i = 0; i < w.count && i < this.ring.length; i++) {
                    g.fillCircle(this.ring[i].x, this.ring[i].y, 3 + 3 * t);
                }
                break;
            }
        }
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
        this.combat.gold += this.def.goldOnClear;

        this.corpse.setPosition(this.lastX, this.lastY).setVisible(true).setAlpha(1);
        if (this.scene.anims.exists("boss.death")) this.corpse.play("boss.death");
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
