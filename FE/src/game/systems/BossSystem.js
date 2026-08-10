/**
 * BossSystem — 최종 보스 「녹턴」. (Day 6 / T520~T526)
 *
 * 규격: 05-COMBAT 6(보스 HP 11,000 / 3페이즈) / 03-GDD 8
 *
 * ★ 모든 패턴은 0.6s 이상 텔레그래프를 갖는다 (T525).
 *   모바일에서 엄지로 반응할 수 있는 최소 시간이다. 이보다 짧으면
 *   "피할 수 없는 공격"이 되어 난이도가 아니라 불공정이 된다.
 *
 * ── 통합 계약 ──
 *   new BossSystem(scene, { player, spawn, combat, stats })
 *   .spawn()        : 보스 등장 (6:00). 잡몹 정화 + 붉은 플래시.
 *   .update(dt)     : 패턴 진행
 *   .active         : 보스전 진행 중인가
 *   .defeated       : 처치되었는가
 */
export class BossSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.spawn = ctx.spawn;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.active = false;
        this.defeated = false;
        this.boss = null;
    }

    spawn() { return null; }
    update(_dt) {}
}
