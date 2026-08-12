/**
 * EnemyAISystem — 적 이동 AI + 특수 행동 상태 머신 + 틱 분산.
 * (T206/T207 → T504/T505/T506)
 *
 * 규격: 05-COMBAT-AND-BALANCE 4.3(특수 행동 파라미터) 4.4(엘리트) / 06-TECH 5.3
 *
 * ★ 틱 분산 — AI를 4그룹으로 나눠 프레임당 1/4만 재조준한다.
 *   적 150체의 방향 계산을 매 프레임 전부 돌리면 예산을 먹는다.
 *   이동 자체는 매 프레임 하되 "어디로 갈지"만 4프레임에 한 번 정한다.
 *   추격 대상이 플레이어 하나뿐이라 4프레임 지연은 체감되지 않는다.
 *
 * ★ 그런데 예비동작(텔레그래프)만은 매 프레임 본다.
 *   0.60s 텔레그래프를 4프레임(≈67ms) 해상도로 재면 최악의 경우 표시가 0.53s로 줄고,
 *   그건 그날의 프레임 사정에 따라 난이도가 달라진다는 뜻이다.
 *   그래서 상태 전이는 dt 누산이 아니라 **절대 시각(scene.time.now)** 으로 판정한다.
 *   비교 몇 번이라 매 프레임 돌려도 비용이 없고, 시간 배속 치트나 프레임 드롭에도 흔들리지 않는다.
 *
 * ★ 텔레그래프 0.60s 의 의미 (T506)
 *   모바일에서 엄지로 반응할 수 있는 최소 시간이다. 인지 → 판단 → 조이스틱/대시까지
 *   사람은 대략 0.4~0.5초를 쓴다. 이보다 짧으면 난이도가 아니라 불공정이 된다.
 *   E8 인디케이터 라인의 길이는 돌진 도달점(속도 260 x 지속 0.70 = 182px)과 정확히 같다 —
 *   "얼마나 빨리"가 아니라 "어디까지"를 보여줘야 옆으로 비킬 수 있다.
 */
import { DEPTH } from "../constants";
import { dist2 } from "../utils/math";

const GROUPS = 4;

export class EnemyAISystem {
    constructor(scene, player, spawn) {
        this.scene = scene;
        this.player = player;
        this.spawn = spawn;
        this.frame = 0;

        // 텔레그래프 전용 그래픽 1개. 적마다 Graphics를 만들면 드로우콜이 적 수만큼 늘어난다
        this.tele = scene.add.graphics().setDepth(DEPTH.FX);
        /** 분리(separation) 질의 결과 재사용 버퍼 — 매 프레임 배열을 만들지 않는다 */
        this.nbuf = [];
    }

    update(dt) {
        this.frame++;
        const g = this.frame % GROUPS;
        const now = this.scene.time.now;
        const px = this.player.x, py = this.player.y;
        const list = this.spawn.enemies;

        this.tele.clear();

        for (let i = 0; i < list.length; i++) {
            const e = list[i];

            if (now < e.stunUntil) {
                // 스턴 — 각성/축복이 e.stunUntil 을 세팅한다. 의지는 멈추지만 관성(넉백)은 남는다
                e.vx = 0;
                e.vy = 0;
            } else {
                // 특수 상태 머신이 속도를 장악했다면 재조준은 건너뛴다
                const owned = this.tickSpecial(e, now, px, py);
                if (!owned && i % GROUPS === g) this.retarget(e, px, py, dt);
            }

            // 이동은 매 프레임 (부드러움은 여기서 나온다). 슬로우는 이동에만 곱한다 —
            // 쿨다운까지 늦추면 "느려진 적이 더 자주 쏜다"는 착시가 생긴다
            // 만료된 감속을 푼다. slowUntil 을 아무도 읽지 않으면 한 번 느려진 적은
            // 풀에서 재활용될 때까지 영원히 느리다 — 소모품 「망각의 종」이 영구 효과가 된다.
            if (e.slowUntil && now >= e.slowUntil) { e.slowUntil = 0; e.slowMult = 1; }
            const slow = e.slowMult ?? 1;
            e.x += e.vx * dt * slow;
            e.y += e.vy * dt * slow;

            // 넉백 감쇠
            if (e.kbx || e.kby) {
                e.x += e.kbx * dt;
                e.y += e.kby * dt;
                const decay = Math.exp(-8 * dt);
                e.kbx *= decay;
                e.kby *= decay;
                if (Math.abs(e.kbx) < 1) e.kbx = 0;
                if (Math.abs(e.kby) < 1) e.kby = 0;
            }

            // 좌우 반전 — 스프라이트가 오른쪽을 보고 그려져 있다
            if (e.vx !== 0) e.setFlipX(e.vx < 0);
        }
    }

    /** @returns {boolean} 이 프레임의 속도를 상태 머신이 확정했는가 */
    tickSpecial(e, now, px, py) {
        /**
         * ★ 필드보스 리시 — 30 §3.6 "회피 가능하게 만드는 3가지 장치" 중 첫 번째.
         *   반경 밖에서는 **추적하지 않고 제자리를 배회한다.** 무시하려면 무시할 수 있어야
         *   무시가 선택이 된다. 여기(tickSpecial 맨 앞)에 두는 이유는 두 가지다 —
         *   ① true 를 돌려주면 retarget 이 통째로 건너뛰어 추격 코드가 아예 안 돈다.
         *   ② charge/shockwave 같은 특수기도 함께 잠긴다. 멀리서 충격파를 맞으면
         *      "제자리를 배회한다"는 약속이 거짓말이 된다.
         *   __leashR 은 EncounterSystem 이 필드보스에만 심는다. 나머지 적은 이 if 를
         *   비교 한 번으로 지나가므로 적 150체에서도 비용이 없다.
         */
        if (e.__leashR > 0 && dist2(e.x, e.y, px, py) > e.__leashR * e.__leashR) {
            // 스폰 지점 근처를 천천히 도는 원운동. 방향이 계속 돌아 멀리 가지 않는다.
            const a = now * 0.0006 + e.aiPhase;
            const s = e.speed * (e.__leashMul ?? 0.28);
            e.vx = Math.cos(a) * s;
            e.vy = Math.sin(a) * s;
            return true;
        }
        switch (e.def.ai) {
            case "ranged": return this.tickRanged(e, now, px, py);
            case "charge": return this.tickCharge(e, now, px, py);
            case "shockwave": return this.tickShockwave(e, now, px, py);
            default: return false;
        }
    }

    // ── E6 부서진 궁수 (T505) ─────────────────────────────────
    /**
     * 유지거리 160px 를 지키다가 쿨이 돌면 0.45s 조준 후 1발.
     * ★ 조준 각도는 조준 **시작** 시점에 고정한다. 발사 순간에 다시 조준하면
     *   예비동작을 보고 옆으로 걸어도 소용이 없어 텔레그래프가 거짓말이 된다.
     */
    tickRanged(e, now, px, py) {
        const p = e.def.params;

        if (e.state === "aim") {
            e.vx = 0;
            e.vy = 0; // 멈춤 자체가 텔레그래프의 절반이다
            const k = 1 - (e.stateUntil - now) / (p.windup * 1000);
            this.tele.lineStyle(1, 0xff6a5a, 0.25 + 0.45 * k);
            this.tele.lineBetween(e.x, e.y, e.x + e.aimX * 46, e.y + e.aimY * 46);
            if (now >= e.stateUntil) {
                this.scene.enemyProjectiles?.fire(e.x, e.y, e.aimAngle, {
                    speed: p.projSpeed, damage: p.projDamage, range: p.maxRange,
                });
                e.state = "idle";
                e.readyAt = now + p.cooldown * 1000;
            }
            return true;
        }

        if (now >= e.readyAt && dist2(e.x, e.y, px, py) <= p.maxRange * p.maxRange) {
            const dx = px - e.x, dy = py - e.y;
            const d = Math.hypot(dx, dy) || 1;
            e.aimX = dx / d;
            e.aimY = dy / d;
            e.aimAngle = Math.atan2(dy, dx);
            e.state = "aim";
            e.stateUntil = now + p.windup * 1000;
            e.vx = 0;
            e.vy = 0;
            return true;
        }
        return false; // 이동(카이팅)은 retarget 이 맡는다
    }

    // ── E8 진홍 임프 (T506) ───────────────────────────────────
    /** 감지 200px → 0.60s 예비동작(정지 + 붉은 라인) → 0.70s 돌진 → 0.4s 경직 → 쿨 3.5s */
    tickCharge(e, now, px, py) {
        const p = e.def.params;

        if (e.state === "windup") {
            e.vx = 0;
            e.vy = 0;
            const k = 1 - (e.stateUntil - now) / (p.windup * 1000);
            // 라인이 도달점까지 자란다. 길이가 곧 "어디까지 오는가"의 답이다
            const len = p.dashSpeed * p.dashDuration * k;
            this.tele.lineStyle(2, 0xff3b30, 0.30 + 0.55 * k);
            this.tele.lineBetween(e.x, e.y, e.x + e.aimX * len, e.y + e.aimY * len);
            if (now >= e.stateUntil) {
                e.state = "dash";
                e.stateUntil = now + p.dashDuration * 1000;
                e.vx = e.aimX * p.dashSpeed;
                e.vy = e.aimY * p.dashSpeed;
            }
            return true;
        }

        if (e.state === "dash") {
            // ★ 돌진 중에는 조향하지 않는다. 유도되는 순간 회피가 불가능해진다
            if (now >= e.stateUntil) {
                e.state = "recover";
                e.stateUntil = now + p.recover * 1000;
                e.readyAt = now + p.cooldown * 1000; // 쿨은 돌진이 끝난 시점부터
                e.vx = 0;
                e.vy = 0;
            }
            return true;
        }

        if (e.state === "recover") {
            e.vx = 0;
            e.vy = 0; // 경직 0.4s — 반격 창구다. 이게 없으면 돌진은 그냥 손해다
            if (now >= e.stateUntil) e.state = "idle";
            return true;
        }

        if (now >= e.readyAt && dist2(e.x, e.y, px, py) <= p.detect * p.detect) {
            const dx = px - e.x, dy = py - e.y;
            const d = Math.hypot(dx, dy) || 1;
            e.aimX = dx / d;
            e.aimY = dy / d;
            e.state = "windup";
            e.stateUntil = now + p.windup * 1000;
            e.vx = 0;
            e.vy = 0;
            return true;
        }
        return false; // 평시에는 직선 추격
    }

    // ── EL2 타락한 흑기사 (T504) ──────────────────────────────
    /**
     * 광역 충격파 — 반경 110px, dmg 18, 예비동작 0.80s(붉은 원 확장), 쿨 6.0s, 넉백 80.
     *
     * ★ dmg 18 에는 구간 dmgMult 를 곱하지 않는다.
     *   정본 4.1 이 배율을 적용한다고 명시한 값은 `contactDamage` 하나뿐이다.
     *   EL2 는 4:30(dmgMult 1.90)에만 나오므로 곱하면 즉사기(34)가 된다.
     * ★ 예비 0.80s 는 E8(0.60s)보다 길다. 반경 110px 를 벗어나려면 이동이 더 필요하기 때문이다.
     *   텔레그래프 길이는 "피하는 데 드는 거리"에 비례해야 공정하다.
     */
    tickShockwave(e, now, px, py) {
        const p = e.def.params;

        if (e.state === "cast") {
            e.vx = 0;
            e.vy = 0; // 시전 중 정지(정본 4.4)
            const k = 1 - (e.stateUntil - now) / (p.windup * 1000);
            this.tele.lineStyle(2, 0xff3b30, 0.22 + 0.55 * k);
            this.tele.strokeCircle(e.x, e.y, p.radius * k);
            if (now >= e.stateUntil) {
                this.tele.fillStyle(0xff3b30, 0.30);
                this.tele.fillCircle(e.x, e.y, p.radius); // 터지는 한 프레임
                this.detonate(e, p, px, py);
                e.state = "idle";
                e.readyAt = now + p.cooldown * 1000;
            }
            return true;
        }

        // 반경의 1.4배 안까지 들어와야 시전한다. 사거리 밖에서 헛시전하면 쿨만 버린다
        const trigger = p.radius * 1.4;
        if (now >= e.readyAt && dist2(e.x, e.y, px, py) <= trigger * trigger) {
            e.state = "cast";
            e.stateUntil = now + p.windup * 1000;
            e.vx = 0;
            e.vy = 0;
            return true;
        }
        return false; // 평시에는 직선 추격
    }

    detonate(e, p, px, py) {
        this.scene.fxSystem?.shake("selfDestruct");
        const combat = this.scene.combatSystem;
        if (!combat || combat.dead) return;
        if (dist2(e.x, e.y, px, py) > p.radius * p.radius) return;
        // 무적프레임은 호출자가 거른다 — CombatSystem.hurt() 는 방어율만 본다
        if (combat.invulnerable) return;
        combat.hurt(p.damage);

        // ★ 넉백 80 을 플레이어에게 적용한다. 플레이어에는 넉백 물리가 없어서(PlayerSystem이
        //   매 프레임 setVelocity 로 덮는다) 총 변위를 한 번에 준다.
        //   적 넉백 공식(속도 = kb x 6, 감쇠 exp(-8t))의 총 변위 = kb x 6 / 8 = kb x 0.75.
        //   같은 식에서 나온 값이라 적이 밀리는 거리와 눈으로 일치한다. 맵에 벽이 없어 관통 걱정도 없다.
        const dx = px - e.x, dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const push = p.knockback * 0.75;
        this.player.x += (dx / d) * push;
        this.player.y += (dy / d) * push;
    }

    // ── 기본 이동 ─────────────────────────────────────────────
    retarget(e, px, py, dt) {
        const dx = px - e.x, dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d, ny = dy / d;
        const ai = e.def.ai;
        const p = e.def.params ?? {};

        if (ai === "stagger") {
            // 이동 0.8s / 정지 0.2s 반복 — 탱커의 육중함을 속도가 아니라 리듬으로 표현한다
            e.stateTimer -= dt * GROUPS;
            if (e.stateTimer <= 0) {
                e.moving = !e.moving;
                e.stateTimer = e.moving ? (p.moveDuration ?? 0.8) : (p.pauseDuration ?? 0.2);
            }
            const s = e.moving ? e.speed : 0;
            e.vx = nx * s;
            e.vy = ny * s;
            return;
        }

        if (ai === "zigzag") {
            // 접선 방향으로 사인 진동을 더한다. 직선 추격보다 맞히기 어렵다
            const amp = p.amplitude ?? 40;
            const period = p.period ?? 1.2;
            e.aiPhase += (dt * GROUPS * Math.PI * 2) / period;
            const wobble = Math.sin(e.aiPhase) * amp;
            e.vx = nx * e.speed + -ny * wobble;
            e.vy = ny * e.speed + nx * wobble;
            return;
        }

        if (ai === "overshoot") {
            // E3 — 0.5s마다만 방향을 다시 잡는다. 135px/s 짜리가 매 프레임 조향하면
            // 절대 뿌리칠 수 없다. 오버슛이 생겨야 회피가 성립한다(정본 4.3)
            e.stateTimer -= dt * GROUPS;
            if (e.stateTimer > 0 && (e.vx || e.vy)) return;
            e.stateTimer = p.retarget ?? 0.5;
            e.vx = nx * e.speed;
            e.vy = ny * e.speed;
            return;
        }

        if (ai === "ranged") {
            // 카이팅 — 너무 가까우면 후퇴, 너무 멀면 접근, 그 사이면 옆으로 돈다.
            // 멈춰 서지 않는 이유: 정지한 궁수는 그냥 과녁이라 원거리의 위협이 사라진다
            const dist = d;
            let s = 0, ox = 0, oy = 0;
            if (dist < (p.tooClose ?? 130)) { s = -e.speed; }
            else if (dist > (p.tooFar ?? 220)) { s = e.speed; }
            else { ox = -ny * e.speed * 0.6; oy = nx * e.speed * 0.6; }
            e.vx = nx * s + ox;
            e.vy = ny * s + oy;
            return;
        }

        // chase — 직선 추격
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;

        // E4 분리(separation) — 겹쳐서 1체처럼 보이지 않게 서로 민다(정본 4.3).
        // 자기 그룹 차례에만 도는 데다 E4 계열에만 붙는 파라미터라 질의 수가 프레임당 10회 안쪽이다.
        if (p.separation) this.separate(e, p.separation);
    }

    /**
     * ★ CombatSystem 의 공간 해시를 빌려 쓴다(한 프레임 낡았다).
     *   AI는 해시 재구축 전에 도니 최신일 수 없다. 겹침 방지는 1프레임 오차로 무너지지 않는 종류의 계산이라
     *   전용 해시를 하나 더 굴리는 비용을 낼 이유가 없다.
     */
    separate(e, r) {
        const hash = this.scene.combatSystem?.hash;
        if (!hash) return;
        const list = hash.query(e.x, e.y, r, this.nbuf);
        const r2 = r * r;
        let sx = 0, sy = 0;
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (o === e) continue;
            const dx = e.x - o.x, dy = e.y - o.y;
            const d2v = dx * dx + dy * dy;
            if (d2v > r2 || d2v === 0) continue;
            sx += dx;
            sy += dy;
        }
        if (!sx && !sy) return;
        const m = Math.hypot(sx, sy) || 1;
        e.vx += (sx / m) * e.speed * 0.5;
        e.vy += (sy / m) * e.speed * 0.5;
    }
}
