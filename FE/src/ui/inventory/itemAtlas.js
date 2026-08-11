/**
 * itemAtlas — 아틀라스 프레임 하나를 React 인라인 스타일(background-position)로 바꾼다.
 *
 * ★ 왜 <img> 가 아니라 background 인가
 *   아이콘 66개 + 후광 5개가 한 장(384x192)에 들어 있다. <img src="...items.png"> 를
 *   토스트마다 쓰면 같은 그림을 통째로 여러 번 그리게 되고, 크롭을 하려면 어차피
 *   overflow 컨테이너가 하나 더 든다. background-position 이면 요소 하나로 끝난다.
 *
 * ★ 왜 좌표를 이 폴더에 복사해 두는가 (itemFrames.json)
 *   진짜 좌표는 FE/public/assets/items/items.json 이다. 그런데 public/ 은 Vite 가
 *   "번들에 넣지 말고 그대로 복사하는" 디렉토리라, 거기서 JS 로 import 하는 것은
 *   공식적으로 권장되지 않는다(빌드 경고 또는 에러). 그래서 좌표만 뽑아 src 안에 둔다.
 *   ── 아틀라스를 다시 구우면(tools/build-icons.mjs) 반드시 아래를 갱신해라 ──
 *   갱신 절차(FE/ 에서): public/assets/items/items.json 의 frames 를 훑어
 *   { 프레임이름: [x, y, w, h] } 로 납작하게 눌러 이 폴더의 itemFrames.json 에 쓴다.
 *   프레임 수(현재 71 = 아이콘 66 + 등급 후광 5)가 달라졌다면 반드시 다시 돌려라 —
 *   좌표가 어긋나면 크래시가 아니라 "엉뚱한 아이콘이 조용히 뜨는" 형태로 나타난다.
 *
 * ★ 그림 경로는 CSS 쪽(.inv-icon) 에 있고 `../assets/items/items.png` 다.
 *   빌드 후 CSS 는 dist/assets/index-*.css, 그림은 dist/assets/items/items.png 이므로
 *   CSS 파일 기준 상대경로가 정확히 맞는다. 절대경로 `/assets/...` 는 Capacitor 의
 *   file:// WebView 에서 루트가 달라 깨진다(vite.config.js base:"./" 와 같은 이유).
 */
import atlas from "./itemFrames.json";

const FRAMES = atlas.frames;
const [SHEET_W, SHEET_H] = atlas._meta.sheet;
/** 아틀라스 셀 한 칸. 모든 아이콘이 32x32 로 구워진다 */
const CELL = 32;

/** 프레임 이름이 없을 때 대신 쓸 칸. 조용히 빈 사각형이 뜨는 편이 크래시보다 낫다 */
const MISSING = [0, 0, CELL, CELL];

export function hasFrame(name) {
    return !!name && Object.prototype.hasOwnProperty.call(FRAMES, name);
}

/**
 * @param {string} name  아틀라스 프레임 이름 (items.json 의 base.icon 값)
 * @param {number} size  논리 픽셀 크기(640x360 기준). 실제 CSS 치수는 size * --u 다
 * @returns {object} React style 객체
 *
 * 배율 = size / 32 이다. background-size 는 시트 전체를 그 배율로 늘린 값,
 * background-position 은 프레임 좌상단을 같은 배율로 민 값이다.
 * 모든 수치를 --u 로 계산하므로 기기 해상도가 달라도 HUD 와 눈금이 어긋나지 않는다.
 */
export function iconStyle(name, size) {
    const f = FRAMES[name] ?? MISSING;
    const k = size / CELL;
    const u = (n) => `calc(${+n.toFixed(4)} * var(--u))`;
    return {
        width: u(size),
        height: u(size),
        backgroundSize: `${u(SHEET_W * k)} ${u(SHEET_H * k)}`,
        backgroundPosition: `${u(-f[0] * k)} ${u(-f[1] * k)}`,
    };
}

/** 등급 후광 프레임. rarity 가 common 이면 후광을 그리지 않는다(있어 봐야 정보가 0이다) */
export function haloFrame(rarityId) {
    const n = "itm_halo_" + rarityId;
    return hasFrame(n) ? n : null;
}
