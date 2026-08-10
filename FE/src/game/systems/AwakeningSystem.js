/**
 * AwakeningSystem — 대가 3중첩 시 저주를 축복으로 뒤집는다. (Day 4 / T401~T426)
 *
 * ★ 이 게임의 존재 이유다. PACT가 "손해를 감수하는 선택"이라면, 각성은
 *   그 손해가 임계점에서 무기로 바뀌는 순간이다. 여기가 재미없으면 게임이 없다.
 *
 * 규격: 04-PACT-SYSTEM 5 / 05-COMBAT 4 / 12-TASK-BACKLOG D4
 *
 * ── 통합 계약 (이 API는 GameScene/CombatSystem이 의존한다. 시그니처를 바꾸지 말 것) ──
 *   new AwakeningSystem(scene, { stats, pact, combat, player })
 *   .trigger(tag)  : 각성 발동. 중복 발동은 내부에서 막는다.
 *   .update(dt)    : 매 프레임. 오라/지속 효과.
 *   .has(tag)      : 해당 태그가 각성했는가
 *   .list          : 각성한 태그 배열 (최대 2)
 *   .onKill(e)     : 적 처치 시 CombatSystem이 호출 (진조의 갈증 폭발 등)
 *   .onHurt(amt)   : 피격 시 호출. 반환값이 number면 그 값으로 피해를 대체한다.
 */
import { AWAKEN_STACKS } from "../constants";

export const MAX_AWAKENINGS = 2; // 초과 시 인간성 −20 (T402)

export class AwakeningSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.stats = ctx.stats;
        this.pact = ctx.pact;
        this.combat = ctx.combat;
        this.player = ctx.player;
        /** @type {string[]} 각성한 태그 */
        this.list = [];
    }

    has(tag) { return this.list.includes(tag); }

    /** 각성 발동. Day 4에서 구현한다. */
    trigger(tag) {
        if (!tag || this.has(tag)) return false;
        this.list.push(tag);
        return true;
    }

    update(_dt) {}

    onKill(_enemy) {}

    /** @returns {number|undefined} 피해를 대체하려면 숫자를 반환한다 */
    onHurt(_amount) { return undefined; }
}

export { AWAKEN_STACKS };
