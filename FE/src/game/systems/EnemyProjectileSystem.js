/**
 * EnemyProjectileSystem — 적 투사체 전용 풀. (T505)
 *
 * 규격: 05-COMBAT-AND-BALANCE 4.3 E6 (속도 130px/s, dmg 9, 최대 사거리 260px)
 *
 * ★ 플레이어 투사체(CombatSystem)와 분리한 이유
 *   판정 방향이 정반대다. 플레이어 투사체는 "1 vs 150"이라 공간 해시가 필수지만,
 *   적 투사체는 "N vs 1"이라 표적이 플레이어 하나뿐이다. 해시에 넣으면 매 프레임
 *   삽입 비용만 내고 이득이 없다. 여기서는 투사체당 거리 비교 1회로 끝난다.
 *
 * ★ 속도 130px/s 는 플레이어(70px/s)가 옆으로 걸어서 피할 수 있는 속도다(정본 4.3).
 *   이 값을 올리면 "예측 사격"이 아니라 "확정 피격"이 된다. 밸런싱 노브가 아니다.
 *
 * ── 통합 계약 ──
 *   new EnemyProjectileSystem(scene, { player, combat })
 *   .fire(x, y, angle, { speed, damage, range })  : 1발 발사
 *   .update(dt)                                    : 이동 + 플레이어 피격
 *   .clear()                                       : 전탄 회수(보스 등장 정화 등)
 *   .activeCount
 */
import { Pool } from "../pools/Pool";
import { DEPTH } from "../constants";
import { dist2 } from "../utils/math";

/** E6 최대 16체 x 쿨 2.2s 를 감당하고도 남는다. 상한이 있어야 최악의 프레임을 예측할 수 있다 */
const MAX_ENEMY_PROJECTILES = 64;
/** 플레이어 히트 반경 — 바디 14x12 의 절반 + 투사체 두께 */
const HIT_R2 = 10 * 10;
/** 화면 밖으로 한참 나간 탄은 사거리와 무관하게 회수한다 */
const CULL_R2 = 640 * 640;
/**
 * 궁수 화살 텍스처. 14x14 칸에 12x3 그림이 오른쪽을 향해 누워 있다(docs/32 §11.2 C).
 * ★ 회전은 코드가 한다 — 방향별 시트를 만들지 않는다. fire() 의 setRotation 하나로 끝난다.
 */
const ARROW_TEX = "proj-arrow-bone";

export class EnemyProjectileSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;

        /**
         * ★ 폴백 판정은 생성자에서 한 번뿐이다. 매 프레임 textures.exists 를 부르지 않는다
         *   (EncounterSystem.buildObjects 와 같은 규약).
         *   아트가 없으면 예전의 7x2 단색 사각형으로 그대로 되돌아간다 —
         *   assets.json 에서 proj-arrow-bone 한 줄을 빼는 것이 롤백 절차다(docs/32 §11.2 C).
         */
        this.hasArrowTex = scene.textures.exists(ARROW_TEX);

        this.pool = new Pool(MAX_ENEMY_PROJECTILES, () => {
            // 화살 형태. 원으로 그리면 EXP 오브와 구분이 안 된다
            const s = this.hasArrowTex
                ? scene.add.image(-999, -999, ARROW_TEX)
                : scene.add.rectangle(-999, -999, 7, 2, 0xd8c9a0);
            s.setDepth(DEPTH.PROJECTILE).setVisible(false);
            return s;
        });
    }

    get activeCount() { return this.pool.activeCount; }

    /**
     * @param {number} angle 라디안. 발사 시점에 고정된다 — 유도탄이 아니다
     * @param {{speed:number, damage:number, range:number}} o
     */
    fire(x, y, angle, o) {
        const p = this.pool.obtain();
        if (!p) return null; // 상한 초과분은 조용히 버린다. 풀을 늘리는 것보다 안전하다
        p.vx = Math.cos(angle) * o.speed;
        p.vy = Math.sin(angle) * o.speed;
        p.damage = o.damage;
        p.life = o.range / o.speed;
        p.setPosition(x, y).setRotation(angle).setVisible(true);
        return p;
    }

    update(dt) {
        const list = this.pool.active;
        if (!list.length) return;
        const px = this.player.x, py = this.player.y;
        // 사망 후에도 날아오던 탄이 결과 화면 뒤에서 판정하면 안 된다
        const canHit = !!this.combat && !this.combat.dead;

        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (canHit && dist2(p.x, p.y, px, py) <= HIT_R2) {
                // ★ 무적 판정을 여기서 한다. CombatSystem.hurt() 는 방어율만 처리하고
                //   무적프레임은 보지 않는다(호출자가 거른다 — contactDamage 와 같은 규약).
                //   대시 무적으로 화살을 통과하는 것이 이 게임의 회피 문법이다.
                if (!this.combat.invulnerable) this.combat.hurt(p.damage);
                this.release(p);
                continue;
            }

            if (p.life <= 0 || dist2(p.x, p.y, px, py) > CULL_R2) this.release(p);
        }
    }

    release(p) {
        p.setVisible(false).setPosition(-999, -999);
        this.pool.release(p);
    }

    clear() {
        const list = this.pool.active;
        while (list.length) this.release(list[list.length - 1]);
    }
}
