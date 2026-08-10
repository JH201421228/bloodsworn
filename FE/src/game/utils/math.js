/**
 * 수학 유틸. 06-TECH-DESIGN.md 5.2 — 충돌 판정에서 Math.sqrt를 쓰지 않는다.
 * 적 150체 x 투사체 다수를 매 프레임 도는데 sqrt는 예산 밖이다.
 */
export const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
};
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 배열에서 i번을 O(1)로 제거. 순서가 바뀌어도 되는 곳에서만 쓴다 */
export const swapPop = (arr, i) => {
    const last = arr.length - 1;
    if (i !== last) arr[i] = arr[last];
    arr.pop();
};
