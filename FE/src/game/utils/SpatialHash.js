/**
 * 공간 해시 — 셀 64px. 06-TECH-DESIGN.md 5.2
 *
 * ★ 왜 필요한가
 *   적 150체 x 투사체 200개를 전수 비교하면 3만 번이다. 프레임 예산 밖이다.
 *   64px 셀로 나누면 질의당 주변 9칸만 본다.
 *
 * ★ 재구축 시점 — 모든 이동이 끝난 뒤, 충돌 판정 전에 정확히 1회.
 *   이동 중간에 갱신하면 그리드가 오염된다(06 4.2).
 */
export const CELL = 64;

export class SpatialHash {
    constructor(cell = CELL) {
        this.cell = cell;
        /** @type {Map<number, any[]>} */
        this.buckets = new Map();
    }

    /** 셀 좌표를 하나의 정수 키로. 좌표가 음수여도 충돌하지 않게 오프셋을 준다 */
    key(cx, cy) {
        return (cx + 4096) * 16384 + (cy + 4096);
    }

    clear() {
        // Map을 새로 만들지 않고 배열만 비운다 — GC 압력을 줄인다
        for (const arr of this.buckets.values()) arr.length = 0;
    }

    insert(obj) {
        const cx = Math.floor(obj.x / this.cell);
        const cy = Math.floor(obj.y / this.cell);
        const k = this.key(cx, cy);
        let arr = this.buckets.get(k);
        if (!arr) { arr = []; this.buckets.set(k, arr); }
        arr.push(obj);
    }

    /**
     * 반경 r 안의 후보를 out에 채운다(정확한 거리 검사는 호출자가 한다).
     * 배열을 새로 만들지 않고 재사용해 매 프레임 할당을 없앤다.
     */
    query(x, y, r, out) {
        out.length = 0;
        const c = this.cell;
        const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
        const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                const arr = this.buckets.get(this.key(cx, cy));
                if (!arr) continue;
                for (let i = 0; i < arr.length; i++) out.push(arr[i]);
            }
        }
        return out;
    }
}
