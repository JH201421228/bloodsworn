/**
 * SpawnSystem — 오브젝트 풀 + 링 스폰 + 12구간 웨이브 + 특수 이벤트 + 페이즈 연출.
 * (T202/T203/T204/T205 → T501/T502/T503/T504/T507)
 *
 * 규격: 05-COMBAT-AND-BALANCE 5.2(12구간 마스터) 5.3(구간별 가중치) 4.4(엘리트) / 06-TECH 5.1(풀)
 *   링 스폰: 카메라 밖 원주. 반경은 400 이 하한이고 화면이 넓으면 ringRadius() 가 늘린다
 *   디스폰: 900px 초과 시 풀 반환
 *   상한 도달 시 신규 스폰 대신 가장 먼 적을 텔레포트 재활용 (정본 7.1)
 *
 * ── 보스 연동 훅 (BossSystem 담당자용) ──
 *   spawn.suppressed = true;  // 잡몹 스폰·특수 이벤트 전면 정지
 *   spawn.purge();            // 화면의 잡몹 즉시 정화(엘리트 포함, 처치로 세지 않음)
 *   6:00(phases.json bossAt) 이 지나면 suppressed 는 자동으로 켜진다.
 *   보스를 이르게 부르려면 그 전에 직접 켜면 된다.
 */
import { Pool } from "../pools/Pool";
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { LOGICAL_HEIGHT, MAX_LOGICAL_WIDTH } from "../config";
import { dist2 } from "../utils/math";
import enemiesData from "@/data/enemies.json";
import phasesData from "@/data/phases.json";
// 상자 아트 키와 보상표는 조우 정본이 갖는다(30 §3.7). 여기서는 읽기만 한다.
import encData from "@/data/encounters.json";
import { TEMPO_SCALE } from "./PlayerSystem";

export const MAX_ENEMIES = 150;

/**
 * 적 렌더/히트박스 공통 배율. (16x16 원본이 640x360 에서 너무 작다는 지적)
 *
 * ★ 왜 1.4 인가 — 전부 실측이다
 *   1) 크기 문제의 정체
 *      enemies.png 40프레임 실측: 몸통 알파 bbox 평균 12.2x12.7px(캔버스 16x16 의 38.8%).
 *      플레이어는 19x34px 다. 적이 주인공의 절반도 안 되니 "점"으로 읽힌다.
 *      1.4 면 17.1x17.8px — 폭은 플레이어와 맞먹고 키는 절반, "작지만 생물"이 된다.
 *   2) 가독성 상한 (하네스로 350초 런을 돌려 캡 150 구간을 측정)
 *      카메라 안 동시 표시는 배율과 무관하게 148~150체. 캔버스 합계 점유율은
 *        1.00 -> 17.3% / 1.25 -> 27.1% / 1.40 -> 34.0% / 1.60 -> 44.3%.
 *      1.4 가 "화면의 1/3" 을 넘지 않는 마지막 값이라 여기서 끊었다.
 *   3) 그런데 진짜 병목은 크기가 아니었다
 *      겹침을 뺀 실제 피복률은 1.4 에서도 최대 5.0% 뿐이다. 적이 플레이어 반경
 *      약 40px 안으로 뭉치기 때문이다(separation 파라미터를 가진 def 가 150중 12뿐).
 *      즉 "화면이 적으로 덮인다"는 크기보다 뭉침이 지배한다 — 1.4 는 안전하다.
 *   4) 히트박스 동반 상승
 *      일반 적 hitbox 13 -> 18.2(반경 9.1). 접촉 판정은 반경+7 이므로 16.1px 에서 걸린다.
 *      배율 전 13.5px 였으니 "몸이 커진 만큼만" 위험해진다 — 보이는 것과 맞는 것이 일치한다.
 *   5) 티어 서열 유지
 *      엘리트 1.75 -> 2.45(39px), 미니보스 2.1 -> 2.94(47px).
 *      보스는 원본 시트가 140~160px 이고 boss.json spriteScale 을 따로 쓰므로 손대지 않는다.
 */
const ENEMY_SIZE_SCALE = 1.4;

/**
 * 정본 수치에 런타임 튜닝 배율을 **부팅 시 1회** 굽는다.
 *
 * ★ 왜 reset() 이 아니라 def 자체를 고치는가
 *   AwakeningSystem 이 슬로우를 풀 때 `e.speed = e.def.moveSpeed` 로 원복한다.
 *   reset() 에서만 배율을 곱하면 슬로우가 끝난 적만 조용히 옛 속도로 돌아가
 *   "가끔 어떤 적이 느리다" 는, 재현도 추적도 어려운 버그가 된다.
 *   def 를 고치면 def.moveSpeed 를 읽는 모든 코드가 자동으로 맞는다.
 *
 * ★ 왜 enemies.json 을 직접 안 고치는가
 *   그 파일 머리주석이 "tools/build-monsters.mjs 생성물 — 손으로 고치지 말고
 *   스크립트를 고쳐 다시 돌린다" 다. 150행을 손으로 고치면 다음 재생성에 전부 날아간다.
 *
 * ★ 배율을 곱하는 것과 안 곱하는 것의 구분
 *   속도(px/s)만 곱한다. dashSpeed/projSpeed 도 속도라서 함께 곱해야
 *   "돌진은 대시로, 화살은 옆걸음으로 피한다"는 회피 기하가 보존된다.
 *   크기(separation)는 SIZE 배율을 곱한다 — 분리 거리는 "겹쳐서 1체로 보이지 않게"가
 *   목적이라(EnemyAISystem:315) 몸집을 키우면 같이 커져야 한다. 안 그러면 1.4배로 커진
 *   적들이 예전 간격으로 붙어 서서 후반에 덩어리로 뭉개져 보인다.
 *   전술 거리(maxRange/detect/tooClose/tooFar/radius)와 시간(windup/cooldown/dashDuration)은
 *   **곱하지 않는다** — 화면 크기와 사람의 반응시간은 그대로다.
 *
 * @param {object} data enemies.json 모듈 객체. 씬 재시작으로 두 번 불려도 안전하다.
 */
function applyTuning(data) {
    if (data.__tuned) return; // 이중 적용 방지. 씬 restart 는 SpawnSystem 을 새로 만든다
    data.__tuned = { tempo: TEMPO_SCALE, size: ENEMY_SIZE_SCALE };
    for (const d of data.enemies) {
        d.moveSpeed *= TEMPO_SCALE;
        d.hitbox *= ENEMY_SIZE_SCALE;
        // scale 이 없던 일반 적에게도 명시적으로 넣는다 — reset() 의 (def.scale ?? 1) 이
        // 히트박스만 커지고 그림은 그대로인 "안 맞는 적"을 만들지 않게 한다.
        d.scale = (d.scale ?? 1) * ENEMY_SIZE_SCALE;
        const p = d.params;
        if (!p) continue;
        if (typeof p.dashSpeed === "number") p.dashSpeed *= TEMPO_SCALE;
        if (typeof p.projSpeed === "number") p.projSpeed *= TEMPO_SCALE;
        if (typeof p.separation === "number") p.separation *= ENEMY_SIZE_SCALE;
    }
}
/**
 * 링 스폰 반경(정본 5.2 기준값). 640x360 화면의 반대각선은 367px 이라 33px 의 여유가 있었다 —
 * 즉 "적은 언제나 화면 밖에서 나타난다"가 이 33px 위에 서 있는 규약이었다.
 */
const SPAWN_RADIUS = 400;
/** 위 33px 여유. 화면이 넓어져도 이 값만큼은 화면 밖에 두어야 규약이 유지된다 */
const SPAWN_CLEARANCE = SPAWN_RADIUS - Math.hypot(640 / 2, 360 / 2); // ≈ 32.8
const DESPAWN_RADIUS = 900;
const DESPAWN_R2 = DESPAWN_RADIUS * DESPAWN_RADIUS;

/** 무리 대형 각도. 정본 4.3 "30도 부채꼴" */
const SWARM_ARC = Math.PI / 6;
/** 보물상자 — EL1 은 런당 최대 2회. 여유를 둬 4개면 충분하다 */
const MAX_CHESTS = 4;
const CHEST_PICKUP_R2 = 18 * 18;
/** 페이즈 붉은 틴트가 차오르는 속도(알파/초). 1.2초에 걸쳐 물든다 */
const TINT_RATE = 0.14;

export class SpawnSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        applyTuning(enemiesData);
        this.defs = enemiesData.enemies;
        this.byId = Object.fromEntries(this.defs.map((d) => [d.id, d]));
        this.segments = phasesData.segments;
        this.events = phasesData.events ?? [];
        this.phases = phasesData.phases ?? [];
        this.bossAt = phasesData.bossAt ?? 360;

        this.elapsed = 0;
        this.spawnTimer = 0;
        this.segIndex = 0;
        this.killCount = 0;
        this.eventIndex = 0;
        this.phaseIndex = -1;
        /** 보스 등장 시 잡몹 스폰을 끊는 공개 플래그. BossSystem 이 켠다 */
        this.suppressed = false;

        // ★ 구간별 가중치 테이블을 미리 누적합으로 굽는다.
        //   스폰마다 filter/Object.keys 를 돌면 초당 4~5회 배열을 새로 만든다.
        //   런 중 할당 0 이라는 규약(06 5.1)은 스폰 경로에도 그대로 적용된다.
        this.tables = this.segments.map((seg) => this.bakeTable(seg));

        // 적 풀 — 런 중 new가 실행되지 않도록 미리 만든다(06 5.1)
        this.pool = new Pool(MAX_ENEMIES, () => {
            const s = scene.add.sprite(-999, -999, "enemies", 0);
            s.setDepth(DEPTH.ENEMY).setActive(false).setVisible(false);
            return s;
        });

        /**
         * 보물상자 풀 (T503 → 30 §3.7). 엘리트가 죽은 자리에 남고, 밟으면 열린다.
         *
         * ★ 11x9 노란 사각형이었다. 도형은 "미완성"이 아니라 "고장"으로 읽힌다 —
         *   30 §7.2 대로 items 아틀라스의 주머니 프레임을 임시로 빌린다.
         *   ⚠ 전용 상자 아트(docs/32 C-1)가 오면 **encounters.json 의 chest.frameClosed 만**
         *     갈아 끼우면 된다. 프레임 이름을 코드에 적지 않은 이유가 그것이다.
         *   아틀라스가 아직 안 구워졌으면 옛 사각형으로 조용히 내려간다 — 상자가 아예
         *   안 보이는 것보다 못생긴 게 낫다(ItemSystem 의 폴백과 같은 규약).
         */
        const chestArt = encData.chest ?? {};
        const chestTex = chestArt.texture ?? "items";
        this.chestArt = scene.textures.exists(chestTex) && !!scene.textures.get(chestTex)?.has(chestArt.frameClosed);
        this.chests = new Pool(MAX_CHESTS, () => {
            const c = this.chestArt
                ? scene.add.sprite(-999, -999, chestTex, chestArt.frameClosed).setScale(chestArt.scale ?? 1.15)
                : scene.add.rectangle(-999, -999, 11, 9, 0xd9b45a).setStrokeStyle(1, 0x6b4a12);
            c.setDepth(DEPTH.ORB + 1).setVisible(false);
            return c;
        });
        /** 상자 맥동의 기준 배율. 아트를 쓰면 1 이 아니다 — setScale 이 이 값을 곱해야 크기가 안 튄다 */
        this.chestScale = this.chestArt ? (chestArt.scale ?? 1.15) : 1;

        // 페이즈 색조 오버레이 (T502).
        // ★ Phaser 카메라에는 지속 틴트가 없다(flash/fade/shake 뿐).
        //   그래서 순간 연출은 cameras.main.flash 로, 지속 색조는 스크롤 고정 사각형으로 나눈다.
        //   포스트 FX 파이프라인은 WebGL 전용이라 Canvas 폴백에서 색조가 사라진다.
        // ★ 좌상단 원점 + 논리 가로 상한(864). 화면 폭은 기기 비율마다 다르다
        //   (config.js 좌표계 주석). 넘치는 부분은 카메라가 잘라낸다.
        this.tintRect = scene.add
            .rectangle(0, 0, MAX_LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x900b1d, 0)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH.FX + 5);
        this.tintAlpha = 0;
        this.tintTarget = 0;
    }

    get segment() { return this.segments[this.segIndex]; }
    get enemies() { return this.pool.active; }
    /** 현재 페이즈 정의(1~4). HUD/오디오가 물어볼 수 있게 공개한다 */
    get phase() { return this.phases[Math.max(0, this.phaseIndex)]; }

    /** 가중치 맵 → { defs, cum, total } 누적합 테이블 */
    /**
     * 스테이지 데이터를 적용한다. StageSystem 이 부른다.
     *
     * ★ 테이블을 다시 굽는 것이 핵심이다. 생성자에서 한 번 구운 누적합 테이블을 그대로 두면
     *   스테이지를 바꿔도 1스테이지 적이 계속 나온다. 반대로 매 스폰마다 굽게 만들면
     *   런 중 할당 0 규약이 깨진다 — 전환 시점에 한 번만 굽는 것이 정답이다.
     * ★ elapsed 를 0 으로 되돌리지 않는다. 런 재시작은 씬 restart 가 담당하고
     *   여기서는 "무엇이 나오는가"만 바꾼다. 둘을 섞으면 보스전 중 전환 같은 경우에 어긋난다.
     *
     * @param {{segments:object[], events?:object[], phases?:object[], bossAt?:number}} plan
     */
    applyStage(plan) {
        if (!plan?.segments?.length) { console.warn("[SpawnSystem] 빈 스테이지 계획 — 무시한다"); return false; }
        this.segments = plan.segments;
        this.events = plan.events ?? [];
        this.phases = plan.phases ?? [];
        this.bossAt = plan.bossAt ?? this.bossAt;
        this.tables = this.segments.map((seg) => this.bakeTable(seg));
        this.segIndex = 0;
        this.eventIndex = 0;
        this.phaseIndex = -1;
        this.suppressed = false;
        return true;
    }

    bakeTable(seg) {
        const defs = [];
        const cum = [];
        let acc = 0;
        for (const id of Object.keys(seg.weights ?? {})) {
            const def = this.byId[id];
            if (!def) { console.warn(`[SpawnSystem] 알 수 없는 적 ID: ${id}`); continue; }
            // swarmOnly(E7)는 일반 틱에 섞이면 동시 상한을 예측 불가능하게 만든다. 데이터가 실수로 넣어도 막는다
            if (def.swarmOnly) { console.warn(`[SpawnSystem] ${id} 는 무리 전용이라 가중치 풀에서 제외한다`); continue; }
            acc += seg.weights[id];
            defs.push(def);
            cum.push(acc);
        }
        return { defs, cum, total: acc };
    }

    /** 현재 구간 가중치로 뽑는다. 후보가 비면 첫 적으로 폴백 — 빈 웨이브는 버그처럼 보인다 */
    pickDef() {
        const t = this.tables[this.segIndex];
        if (!t || !t.total) return this.defs[0];
        const r = Math.random() * t.total;
        for (let i = 0; i < t.cum.length; i++) if (r < t.cum[i]) return t.defs[i];
        return t.defs[t.defs.length - 1];
    }

    update(dt) {
        this.elapsed += dt;

        // 웨이브 구간 전환
        while (this.segIndex + 1 < this.segments.length && this.elapsed >= this.segments[this.segIndex + 1].t) {
            this.segIndex++;
        }

        this.updatePhase(dt);
        // 6:00 여명 — 정본 5.2 마지막 행. BossSystem 이 없어도 스폰은 여기서 끊긴다
        if (this.elapsed >= this.bossAt) this.suppressed = true;

        this.runEvents();
        this.despawnFar();
        this.updateChests();

        if (this.suppressed) return;

        const seg = this.segment;
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer += seg.interval;
            const cap = Math.min(seg.cap, MAX_ENEMIES);
            if (this.pool.activeCount < cap) this.spawn();
            else this.recycleFarthest();
        }
    }

    // ── 페이즈 (T502) ─────────────────────────────────────────
    /**
     * 90초 경계 4구간. 06-TECH 3.2 의 페이로드 규격을 그대로 지킨다.
     * ★ phase 1 은 t=0 에 발화하지만 화면 플래시는 넣지 않는다.
     *   런 시작에 화면이 번쩍이면 "전환"이 아니라 "로딩 실패"로 읽힌다.
     *   그래도 이벤트는 쏜다 — React 시각 표시와 BGM 티어의 초기값이 필요하다.
     */
    updatePhase(dt) {
        // 틴트는 목표치로 서서히 수렴시킨다. tween 을 쓰지 않는 이유는 런 중 할당을 만들지 않기 위해서다
        if (this.tintAlpha !== this.tintTarget) {
            const step = TINT_RATE * dt;
            const d = this.tintTarget - this.tintAlpha;
            this.tintAlpha = Math.abs(d) <= step ? this.tintTarget : this.tintAlpha + Math.sign(d) * step;
            this.tintRect.setAlpha(this.tintAlpha);
        }

        let idx = 0;
        while (idx + 1 < this.phases.length && this.elapsed >= this.phases[idx + 1].t) idx++;
        if (idx === this.phaseIndex) return;

        const first = this.phaseIndex < 0;
        this.phaseIndex = idx;
        const p = this.phases[idx];

        if (!first && p.flash) this.scene.cameras.main.flash(420, p.flash[0], p.flash[1], p.flash[2], false);
        if (p.tint) this.tintRect.setFillStyle(p.tint);
        this.tintTarget = p.tintAlpha ?? 0;
        if (first) { this.tintAlpha = this.tintTarget; this.tintRect.setAlpha(this.tintAlpha); }

        EventBus.emit(EVENTS.RUN_PHASE_CHANGED, {
            phase: p.phase,
            timeSec: Math.floor(this.elapsed),
            label: p.label,
            bgmTier: p.bgmTier,
        });
    }

    // ── 특수 이벤트 (T503/T504/T507) ──────────────────────────
    /** 절대 시각 이벤트를 순서대로 정확히 1회씩 소비한다 */
    runEvents() {
        while (this.eventIndex < this.events.length && this.elapsed >= this.events[this.eventIndex].t) {
            const ev = this.events[this.eventIndex++];
            if (this.suppressed) continue;
            if (ev.type === "elite") this.spawnElite(ev.id);
            else if (ev.type === "swarm") this.spawnSwarm(ev.id, ev.count ?? 8);
            else if (ev.type === "orbs") this.preplaceOrbs(ev.count ?? 6);
        }
    }

    /**
     * 엘리트 1체. 등장을 알려야 하므로 이벤트를 쏜다.
     * @param {string} id enemies.json 의 적 id
     * @param {{x:number,y:number}|null} at 배치 좌표. 없으면 기존대로 링 위.
     *   ★ EncounterSystem 이 필드보스를 "화면 밖 200~260px"에 놓기 위해 넘긴다(30 §4.3).
     *     링 반경(400+)에 놓으면 등장 순간 화살표만 보이고 조우가 너무 멀어진다.
     */
    spawnElite(id, at = null) {
        const def = this.byId[id];
        if (!def) return null;
        const e = this.obtainOrRecycle();
        if (!e) return null;
        this.reset(e, def, at ?? this.ringPoint());
        EventBus.emit(EVENTS.ELITE_SPAWNED, {
            id: def.id, name: def.name, hp: e.maxHp, x: e.x, y: e.y, timeSec: Math.floor(this.elapsed),
        });
        this.scene.cameras.main.shake(180, 0.005);
        return e;
    }

    /**
     * E7 무리 8체 (T507). 30도 부채꼴 대형으로 한쪽에서 몰려온다.
     * ★ 사방에 흩뿌리지 않는 이유: 한 방향에서 뭉쳐 와야 W1 부채꼴 한 번에 3~5체가
     *   함께 들어온다(정본 4.3). 무리의 재미는 밀도가 아니라 "쓸어담는 각"에서 나온다.
     */
    spawnSwarm(id, count) {
        const def = this.byId[id];
        if (!def) return;
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
            const a = base + (count > 1 ? (i / (count - 1) - 0.5) * SWARM_ARC : 0);
            // 앞뒤 두 줄로 어긋나게 — 한 줄이면 겹쳐서 8체가 3체처럼 보인다
            const r = this.ringRadius() + (i % 2 ? 22 : 0);
            const e = this.obtainOrRecycle();
            if (!e) break;
            this.reset(e, def, { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r });
        }
    }

    /** S1 특수 이벤트 — 시작 시 EXP 오브 6개 선배치(정본 5.2). 첫 레벨업을 앞당긴다 */
    preplaceOrbs(n) {
        const combat = this.scene.combatSystem;
        if (!combat) return;
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
            const d = 90 + Math.random() * 90;
            combat.dropOrb(this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, 1);
        }
    }

    /**
     * 링 반경. 화면이 넓어지면 400 으로는 부족하다.
     *
     * ★ 이 함수가 없으면 20:9 기기에서 적이 눈앞에 튀어나온다.
     *   논리 가로가 800 이면 화면 반대각선이 √(400²+180²)=439 라 반경 400 원주가
     *   좌우 끝에서 화면 **안쪽**으로 들어온다. "적은 화면 밖에서 온다"는 공정성
     *   규약이 비율 하나 때문에 깨지는 것이고, 좁은 화면 유저만 손해를 보는 것도 아니라
     *   넓은 화면 유저가 반응 불가 스폰을 맞는다.
     *
     * ★ 대신 반경이 늘면 이동 시간도 늘어 압박이 약해진다. 그래서 여유(33px)는
     *   640x360 과 **똑같이** 유지한다 — 화면 가장자리에서 적이 나타나기까지의
     *   거리가 모든 비율에서 동일해지고, 체감 압박은 폭과 무관해진다.
     *   16:9 에서는 max() 가 그대로 400 을 돌려주므로 기존 밸런스가 1px 도 안 바뀐다.
     */
    ringRadius() {
        const cam = this.scene.cameras.main;
        return Math.max(SPAWN_RADIUS, Math.hypot(cam.width / 2, cam.height / 2) + SPAWN_CLEARANCE);
    }

    /** 카메라 밖 원주에 스폰. 화면 안에서 튀어나오면 부당하게 느껴진다 */
    ringPoint() {
        const a = Math.random() * Math.PI * 2;
        const r = this.ringRadius();
        return { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r };
    }

    spawn(defOverride = null, at = null) {
        const e = this.pool.obtain();
        if (!e) return null;
        return this.reset(e, defOverride ?? this.pickDef(), at ?? this.ringPoint());
    }

    /** 풀에 여유가 없으면 가장 먼 잡몹을 끌어와 쓴다. 엘리트는 절대 재활용 대상이 아니다 */
    obtainOrRecycle() {
        return this.pool.obtain() ?? this.farthestNormal();
    }

    reset(e, def, at) {
        const seg = this.segment;
        const now = this.scene.time.now;
        e.def = def;
        e.tier = def.tier ?? "normal";
        e.isElite = e.tier === "elite";
        e.maxHp = Math.round(def.baseHp * seg.hpMult);
        e.hp = e.maxHp;
        // def 는 부팅 시 applyTuning() 으로 이미 배율이 반영돼 있다 (파일 상단 참조)
        e.speed = def.moveSpeed;
        e.damage = def.contactDamage * seg.dmgMult;
        e.radius = def.hitbox / 2;
        e.expValue = def.expValue;
        // ★ ?? 1 은 CombatSystem 과 같은 규약이다 — 03-GDD 9 골드식의 "처치수x1".
        //   풀 재사용 때 이전 엘리트의 보너스 골드가 남지 않도록 매번 명시적으로 덮어쓴다.
        e.goldValue = def.goldValue ?? 1;
        e.knockbackResist = def.knockbackResist ?? 0;

        // 상태이상 — 각성/축복이 세팅한다. 재사용 시 반드시 초기화해야
        // 죽었다 살아난 적이 공짜 스턴/슬로우를 물려받지 않는다
        e.stunUntil = 0;
        e.slowMult = 1;
        e.isBoss = false;  // 풀 재사용 시 보스 표식이 남으면 잡몹이 불사가 된다
        e.slowUntil = 0;   // 각성 「중력의 군주」 슬로우 만료 시각
        e.orbHitAt = 0;    // 각성 「탐욕의 왕관」 오브 관통 재타격 쿨
        // ★ 필드보스 표식은 반드시 여기서 지운다(30 §3.6).
        //   남으면 그 스프라이트를 물려받은 잡몹이 영원히 제자리를 배회한다 —
        //   "가끔 어떤 적이 안 쫓아온다"는, 재현도 추적도 어려운 종류의 버그다.
        e.__leashR = 0;
        e.__leashMul = 0;
        e.__encToken = 0;

        e.aiPhase = Math.random() * Math.PI * 2; // 지그재그 위상. 전원이 같은 박자로 흔들리지 않게
        e.stateTimer = 0;
        e.moving = true;
        e.vx = 0;
        e.vy = 0;
        e.kbx = 0;
        e.kby = 0;

        // 특수 AI 상태 머신 — 절대 시각(ms)으로 관리한다. 자세한 이유는 EnemyAISystem 주석
        e.state = "idle";
        e.stateUntil = 0;
        // 쿨다운 초기값을 흩뿌린다. 같은 파도로 들어온 궁수 8체가 동시에 쏘면 회피가 불가능하다
        e.readyAt = now + Math.random() * 1200;
        e.aimX = 0;
        e.aimY = 0;

        e.setScale(def.scale ?? 1);
        e.setPosition(at.x, at.y).setActive(true).setVisible(true).clearTint().setAlpha(1);
        if (this.scene.anims.exists(def.anim)) e.play(def.anim);
        return e;
    }

    /** 상한 도달 시 신규 스폰 대신 가장 먼 적을 끌어온다 (정본 7.1) */
    recycleFarthest() {
        const far = this.farthestNormal();
        if (far) this.reset(far, this.pickDef(), this.ringPoint());
    }

    /** 가장 먼 잡몹. 엘리트는 제외한다 — 재활용되면 보스급 개체가 소리 없이 사라진다 */
    farthestNormal() {
        const list = this.pool.active;
        let far = null, farD = -1;
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (e.isElite) continue;
            const d = dist2(e.x, e.y, this.player.x, this.player.y);
            if (d > farD) { farD = d; far = e; }
        }
        return far;
    }

    /**
     * 900px 밖은 풀로 돌려보낸다.
     * ★ 엘리트만은 예외 — 원주로 끌어온다. 엘리트(55~63px/s)는 플레이어(87.5px/s)보다 느려서
     *   (TEMPO_SCALE 1.25 적용 후 값. 배율 전 44~50 vs 70 — 비율은 그대로다)
     *   도망만 치면 사라진다. 그러면 보물상자도 EXP 40도 그냥 증발한다.
     */
    despawnFar() {
        const list = this.pool.active;
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            if (dist2(e.x, e.y, this.player.x, this.player.y) <= DESPAWN_R2) continue;
            // 보스와 엘리트는 지우지 않고 링 위로 되돌린다. 지우면 런이 끝나지 않거나
            // 보물상자와 EXP 40이 그냥 증발한다.
            if (e.isElite || e.isBoss) {
                const p = this.ringPoint();
                e.setPosition(p.x, p.y);
                e.kbx = 0;
                e.kby = 0;
            } else {
                this.kill(e, false);
            }
        }
    }

    /** @param {boolean} counted 처치로 세는가(디스폰은 세지 않는다) */
    kill(e, counted = true) {
        if (counted) {
            this.killCount++;
            if (e.def?.dropsChest) this.dropChest(e.x, e.y, e.def.id);
        }
        // setScale(1) 은 "기본 크기 복원"이 아니라 **중립화**다.
        // 실제 크기는 다음 reset() 의 def.scale 이 정한다(applyTuning 이 배율을 이미 반영했다).
        e.setActive(false).setVisible(false).setPosition(-999, -999).setScale(1);
        this.pool.release(e);
    }

    /** 보스 등장 정화 — 06 5.2 "전체 잡몹 즉시 제거". 처치로 세지 않는다 */
    purge() {
        const list = this.pool.active;
        while (list.length) this.kill(list[list.length - 1], false);
        this.scene.enemyProjectiles?.clear();
    }

    // ── 보물상자 (T503) ───────────────────────────────────────
    dropChest(x, y, sourceId) {
        const c = this.chests.obtain();
        if (!c) return;
        c.sourceId = sourceId;
        c.setPosition(x, y).setVisible(true).setAlpha(1).setScale(1);
    }

    updateChests() {
        const list = this.chests.active;
        if (!list.length) return;
        const t = this.scene.time.now;
        for (let i = list.length - 1; i >= 0; i--) {
            const c = list[i];
            // 숨 쉬듯 맥동시킨다 — 묘지 바닥 소품과 구분되지 않으면 밟히지 않는다
            c.setScale(this.chestScale * (1 + Math.sin(t / 220) * 0.09));
            if (dist2(c.x, c.y, this.player.x, this.player.y) <= CHEST_PICKUP_R2) this.openChest(c);
        }
    }

    /**
     * ★ 보상이 축복 1개 고정이라 **열 때마다 같았다**(30 §3.7).
     *   3종 추첨(축복 55 / 룬 25 / 아이템 다발 20)의 표와 실행은 EncounterSystem 이 갖는다 —
     *   룬과 아이템 풀을 아는 것이 그쪽이기 때문이다. 조우 시스템이 없으면(디버그 씬 등)
     *   기존 동작인 "대가 없는 축복 1개"로 조용히 내려간다.
     * ★ CHEST_OPENED 는 **이미 쏘고 있었는데 구독자가 0이었다.** 새 이벤트를 만들지 않고
     *   페이로드만 넓혀 살린다(30 §6). 토스트는 ui/encounter 가 이걸 듣는다.
     */
    openChest(c) {
        const r = this.scene.encounters?.rollChestReward?.(c.x, c.y)
            ?? { kind: "blessing", label: this.grantFreeBlessing()?.name ?? "축복", blessing: null };
        EventBus.emit(EVENTS.CHEST_OPENED, {
            x: c.x, y: c.y, sourceId: c.sourceId,
            kind: r.kind, label: r.label, blessing: r.blessing ?? null,
        });
        this.scene.cameras.main.flash(160, 220, 190, 110, false);
        c.setVisible(false).setPosition(-999, -999);
        this.chests.release(c);
    }

    /**
     * 보물상자 = 대가 없는 축복 1개 즉시 지급 (정본 4.4).
     *
     * ★ 카드 3장을 띄우지 않는다. 게임이 멈추지 않는 것이 이 보상의 정체성이다.
     *   엘리트를 잡느라 12초를 버틴 직후에 또 선택 화면이 뜨면 긴장이 두 번 끊긴다.
     *   골드 25 / EXP 40 은 상자가 아니라 엘리트 시체가 준다(enemies.json goldValue/expValue).
     *   상자에서 또 주면 정본 5.4 골드 합계와 7.2 EXP 시뮬레이션이 이중 계산된다.
     */
    grantFreeBlessing() {
        const pact = this.scene.pact;
        const combat = this.scene.combatSystem;
        if (!pact || !combat) return null;
        const pool = pact.candidates();
        if (!pool.length) return null;

        const b = pool[(Math.random() * pool.length) | 0];
        const card = { index: -1, rarity: "rare", blessing: pact.describeBlessing(b, "rare"), toll: null, humanityCost: 0 };
        const r = pact.choose(card);
        if (r.weapon) combat.addWeapon(r.weapon.target, r.weapon.level);
        EventBus.emit(EVENTS.PACT_APPLIED, {
            level: combat.level,
            humanity: r.humanity,
            tagCounts: r.tagCounts,
            ownedBlessings: { ...pact.owned },
            source: "chest",
        });
        return card.blessing;
    }

    // ── 디버그 ────────────────────────────────────────────────
    /** 치트: 즉시 n체 스폰 */
    forceSpawn(n) {
        for (let i = 0; i < n; i++) this.spawn();
    }

    /**
     * 치트: 특정 시각으로 점프. 지나친 특수 이벤트는 소비만 하고 발화시키지 않는다.
     * 그냥 elapsed 만 밀면 엘리트 3체와 무리 18파도가 한 프레임에 쏟아진다.
     */
    jumpTo(sec) {
        this.elapsed = sec;
        this.segIndex = 0;
        while (this.segIndex + 1 < this.segments.length && this.elapsed >= this.segments[this.segIndex + 1].t) this.segIndex++;
        this.eventIndex = 0;
        while (this.eventIndex < this.events.length && this.events[this.eventIndex].t <= sec) this.eventIndex++;
        this.phaseIndex = -1;
        this.updatePhase(0);
        return this.segment;
    }
}
