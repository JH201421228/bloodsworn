/**
 * runeSheet — runes 시트(정본 docs/32) 한 칸을 React 인라인 스타일로 바꾼다.
 *
 * ★ itemAtlas 와 같은 방식이다. 다른 점은 좌표표가 필요 없다는 것 하나다 —
 *   items.png 는 이름표(itemFrames.json)를 가진 아틀라스지만 runes.png 는 균일 격자라
 *   칸 번호에서 좌표가 바로 나온다. 베껴 둘 표가 없으니 어긋날 자리도 없다.
 *
 * ★ 왜 Phaser 가 아니라 CSS 인가
 *   이 파일을 쓰는 두 자리(성소 6종 · 일시정지 룬 조망)는 React(DOM)가 그린다.
 *   캔버스가 아니므로 GPU 텍스처가 아니라 브라우저 이미지 캐시를 그대로 쓴다.
 *   assets.json 에서 카드 프레임·인장·로고를 뺀 것과 같은 판단이다(public/assets.json 주석).
 *
 * ★ 폴백을 지우지 마라 (32 §0.2)
 *   CSS 는 Phaser 매니페스트를 보지 않는다. 그래서 이쪽의 롤백 스위치는 **데이터**다 —
 *   sanctum.json 의 iconCell 이나 runes.json 의 icon 을 null 로 바꾸면 hasCell 이 false 가 되고
 *   호출부가 이모지·글리프로 떨어진다. png 가 통째로 없어도 배경만 안 그려질 뿐 레이아웃은 그대로다.
 */
import "./runeSheet.css";

/** 시트 규격. docs/32 §2 — 바꾸려면 그림을 다시 굽는 것이 먼저다 */
const CELL = 32;
const COLS = 12;
const ROWS = 4;
const SHEET_W = CELL * COLS;   // 384
const SHEET_H = CELL * ROWS;   // 128
/** 실사용 마지막 칸. 38~47 은 예비이고 완전히 비어 있다(32 §3.5) */
const LAST_CELL = 37;

/** 그릴 수 있는 칸인가. 빈 칸을 가리키면 "아무것도 안 뜨는" 형태로 조용히 망가진다 */
export function hasCell(cell) {
    return Number.isInteger(cell) && cell >= 0 && cell <= LAST_CELL;
}

/**
 * @param {number} cell 0-based 칸 번호(행 우선). docs/32 §3
 * @param {number} size 논리 픽셀 크기(640x360 기준). 실제 CSS 치수는 size * --u 다
 *
 * 배율 = size / 32. background-size 는 시트 전체를 그 배율로 늘린 값,
 * background-position 은 칸 좌상단을 같은 배율로 민 값이다. itemAtlas.iconStyle 과 같다.
 */
export function cellStyle(cell, size) {
    const k = size / CELL;
    const cx = (cell % COLS) * CELL;
    const cy = ((cell / COLS) | 0) * CELL;
    const u = (n) => `calc(${+n.toFixed(4)} * var(--u))`;
    return {
        width: u(size),
        height: u(size),
        backgroundSize: `${u(SHEET_W * k)} ${u(SHEET_H * k)}`,
        backgroundPosition: `${u(-cx * k)} ${u(-cy * k)}`,
    };
}
