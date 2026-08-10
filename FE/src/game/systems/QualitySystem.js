/**
 * QualitySystem — 적응형 품질. (Day 6 / T622/T625/T626)
 *
 * ★ 차단선은 평균 fps가 아니라 1% Low >= 40fps 다(13-QA 6).
 *   평균은 잘 나오는데 순간 끊김으로 죽는 게 모바일 로그라이크의 실제 사망 원인이다.
 *
 * ── 통합 계약 ──
 *   new QualitySystem(scene, { fx })
 *   .update(dt)   : fps 샘플링 + 자동 강등
 *   .level        : 0=full 1=reduced 2=minimal
 *   .setLowSpec(on)
 */
export class QualitySystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.fx = ctx.fx;
        this.level = 0;
    }
    update(_dt) {}
    setLowSpec(_on) {}
}
