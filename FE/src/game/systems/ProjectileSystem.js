/**
 * ProjectileSystem — 플레이어 투사체 전담. (6개월 확장 / P-1)
 *
 * ★ 왜 CombatSystem 에서 떼어내는가: 현재 투사체는 `scene.add.circle` 로 그린 점 하나다.
 *   무기가 4종에서 수십 종으로 늘고 원소·관통·유도·분열·반사가 붙으면
 *   CombatSystem 의 fireProjectile 하나로는 감당이 안 된다.
 *   무엇보다 스프라이트 애니메이션과 충돌 판정이 한 곳에 있어야 "맞은 것처럼 보이는데
 *   안 맞는" 문제가 안 생긴다.
 *
 * ── 통합 계약 (GameScene / CombatSystem 이 이대로 부른다) ──
 *   new ProjectileSystem(scene, { player, combat, stats })
 *   .fire(def, x, y, angle, opts)  : 투사체 발사. def 는 data/projectiles.json 의 항목
 *   .update(dt)                    : 이동 + 수명 + 충돌
 *   .clear()                       : 전탄 회수 (씬 재시작/보스 등장)
 *   .activeCount
 */
export class ProjectileSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.activeCount = 0;
    }
    fire(_def, _x, _y, _angle, _opts) { return null; }
    update(_dt) {}
    clear() {}
}
