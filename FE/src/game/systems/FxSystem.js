/**
 * FxSystem — 타격감 연출. 데미지 숫자 / 히트스톱 / 화면 흔들림 / 처치 이펙트. (Day 6 / T630)
 *
 * ★ 전투 로직이 연출에 의존하면 안 된다. CombatSystem은 this.fx?.xxx() 로만 부르고
 *   FxSystem이 없어도 게임은 정상 동작한다. 연출은 언제든 잘라낼 수 있어야 한다.
 * ★ 상한이 있어야 한다(T624) — 적 150체가 동시에 맞으면 숫자 150개가 뜬다.
 *
 * ── 통합 계약 ──
 *   new FxSystem(scene, { player })
 *   .damageNumber(x, y, amount, isCrit)
 *   .killBurst(x, y)
 *   .playerHurt()
 *   .hitStop(ms)
 *   .update(dt)
 */
export class FxSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.enabled = true;
    }
    damageNumber(_x, _y, _amount, _isCrit) {}
    killBurst(_x, _y) {}
    playerHurt() {}
    hitStop(_ms) {}
    update(_dt) {}
}
