/**
 * StageSystem — 스테이지 선택 / 진행 / 해금. (6개월 확장 / S-1)
 *
 * ★ 스테이지는 "맵이 다른 것"이 아니라 **규칙이 다른 것**이어야 한다.
 *   배경만 바꾸면 두 번째 스테이지에서 바로 질린다. 적 구성·페이즈 길이·보스·
 *   환경 기믹이 함께 바뀌어야 새 스테이지로 읽힌다.
 *
 * ── 통합 계약 ──
 *   new StageSystem(scene, { spawn, boss })
 *   .load(stageId)   : 스테이지 데이터 적용 (적 풀, 페이즈, 보스, 배경)
 *   .current         : 현재 스테이지 정의
 *   .update(dt)      : 환경 기믹
 */
export class StageSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.spawn = ctx.spawn;
        this.boss = ctx.boss;
        this.current = null;
    }
    load(_stageId) { return null; }
    update(_dt) {}
}
