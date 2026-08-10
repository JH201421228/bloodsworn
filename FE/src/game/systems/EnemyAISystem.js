/**
 * EnemyAISystem — 적 이동 AI + 틱 분산. (T206/T207)
 *
 * 규격: 05-COMBAT 4 / 06-TECH 5.3
 *
 * ★ 틱 분산 — AI를 4그룹으로 나눠 프레임당 1/4만 재조준한다.
 *   적 150체의 방향 계산을 매 프레임 전부 돌리면 예산을 먹는다.
 *   이동 자체는 매 프레임 하되 "어디로 갈지"만 4프레임에 한 번 정한다.
 *   추격 대상이 플레이어 하나뿐이라 4프레임 지연은 체감되지 않는다.
 */
const GROUPS = 4;

export class EnemyAISystem {
    constructor(scene, player, spawn) {
        this.scene = scene;
        this.player = player;
        this.spawn = spawn;
        this.frame = 0;
    }

    update(dt) {
        this.frame++;
        const g = this.frame % GROUPS;
        const px = this.player.x, py = this.player.y;
        const list = this.spawn.enemies;

        for (let i = 0; i < list.length; i++) {
            const e = list[i];

            // 재조준은 자기 그룹 차례에만
            if (i % GROUPS === g) this.retarget(e, px, py, dt);

            // 이동은 매 프레임 (부드러움은 여기서 나온다)
            e.x += e.vx * dt;
            e.y += e.vy * dt;

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

    retarget(e, px, py, dt) {
        const dx = px - e.x, dy = py - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d, ny = dy / d;
        const ai = e.def.ai;

        if (ai === "stagger") {
            // 이동 0.8s / 정지 0.2s 반복 — 탱커의 육중함을 속도가 아니라 리듬으로 표현한다
            const p = e.def.params ?? {};
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
            const p = e.def.params ?? {};
            const amp = p.amplitude ?? 40;
            const period = p.period ?? 1.2;
            e.aiPhase += (dt * GROUPS * Math.PI * 2) / period;
            const wobble = Math.sin(e.aiPhase) * amp;
            e.vx = nx * e.speed + -ny * wobble;
            e.vy = ny * e.speed + nx * wobble;
            return;
        }

        // chase — 직선 추격
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
    }
}
