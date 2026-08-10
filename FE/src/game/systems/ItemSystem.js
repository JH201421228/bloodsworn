/**
 * ItemSystem — 드롭 / 획득 / 장비 / 접두·접미(affix). (6개월 확장 / I-1)
 *
 * ★ 서바이버즈에 아이템을 붙이는 이유는 "런 밖의 성장"이 아니라 **런 안의 변주**다.
 *   같은 무기라도 어떤 아이템이 떨어졌느냐로 빌드가 갈려야 반복 플레이가 산다.
 *   그래서 드롭은 런 종료와 함께 사라지고(소모), 영구 보관은 성소가 맡는다.
 *
 * ★ 아이콘 라이선스: Raven Fantasy(무료판)는 수익화 시 사용 불가, asset/item(pixel items)은
 *   제작자 미상이다. 아이콘은 전부 자체 생성분을 쓴다 — 이 시스템은 아이콘 키만 참조하고
 *   실제 이미지를 알지 않는다(교체 가능하게).
 *
 * ── 통합 계약 ──
 *   new ItemSystem(scene, { player, combat, stats, spawn })
 *   .rollDrop(enemy)         : 적 처치 시 호출. 드롭 테이블을 굴려 월드에 떨군다
 *   .update(dt)              : 자석/획득/수명
 *   .equip(itemId) / .unequip(slot)
 *   .inventory               : 현재 런의 보유 아이템
 *   .clear()
 */
export class ItemSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.spawn = ctx.spawn;
        this.inventory = [];
    }
    rollDrop(_enemy) { return null; }
    update(_dt) {}
    equip(_itemId) { return false; }
    unequip(_slot) { return false; }
    clear() { this.inventory.length = 0; }
}
