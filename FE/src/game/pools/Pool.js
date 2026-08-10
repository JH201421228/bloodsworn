/**
 * 고정 크기 오브젝트 풀. 06-TECH-DESIGN.md 5.1 (T202)
 *
 * ★ 규칙: 런 중에 new가 실행되는 코드는 존재하지 않는다.
 *   모든 엔티티는 여기서 미리 만들어 두고 재활용한다.
 *   가비지가 쌓이면 모바일에서 주기적 프레임 드롭이 생긴다.
 */
export class Pool {
    /**
     * @param {number} size 최대 개수
     * @param {() => any} factory 객체 생성
     */
    constructor(size, factory) {
        this.items = new Array(size);
        this.active = [];
        this.free = [];
        for (let i = 0; i < size; i++) {
            const o = factory(i);
            o.__poolIndex = i;
            o.__active = false;
            this.items[i] = o;
            this.free.push(o);
        }
    }

    get size() { return this.items.length; }
    get activeCount() { return this.active.length; }

    /** 여유가 없으면 null. 호출자가 재활용 정책을 정한다(예: 최원거리 텔레포트) */
    obtain() {
        const o = this.free.pop();
        if (!o) return null;
        o.__active = true;
        this.active.push(o);
        return o;
    }

    release(o) {
        if (!o.__active) return;
        o.__active = false;
        const i = this.active.indexOf(o);
        if (i >= 0) {
            const last = this.active.length - 1;
            if (i !== last) this.active[i] = this.active[last];
            this.active.pop();
        }
        this.free.push(o);
    }

    releaseAll() {
        while (this.active.length) this.release(this.active[this.active.length - 1]);
    }
}
