/**
 * 소품 시트에서 프레임 좌표를 자동 추출한다.
 *
 * ★ 좌표 목록을 손으로 받지 않는 이유
 *   목록과 그림이 어긋나면 소품이 잘려 나온다. 그림에서 직접 뽑으면 어긋날 수가 없다.
 *   (맵 마스크가 좌표표를 따라 그려져 3번 실패한 것과 같은 교훈이다)
 *
 * 알파 채널의 연결 성분을 찾아 바운딩 박스를 구한다.
 * 실행: npm run build:props
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = resolve(HERE, "../public/assets/map");
const SHEET = resolve(MAP, "props-grave.png");

const MAGICK = (() => {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* next */ }
    }
    throw new Error("ImageMagick 없음");
})();
const magick = (a) => execFileSync(MAGICK, a, { stdio: ["ignore", "pipe", "pipe"] }).toString();

const out = magick([
    SHEET, "-alpha", "extract", "-threshold", "25%",
    "-define", "connected-components:verbose=true",
    "-define", "connected-components:area-threshold=80",
    "-connected-components", "8", "null:",
]);

const frames = [];
for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+):\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+[\d.,]+\s+(\d+)/);
    if (!m) continue;
    const [, , w, h, x, y, area] = m.map(Number);
    if (w >= 500 && h >= 500) continue; // 배경
    frames.push({ x, y, w, h, area });
}

// 반투명 여부로 안개를 가려낸다 — 안개만 알파가 낮다
for (const f of frames) {
    const mean = Number(
        magick([SHEET, "-crop", `${f.w}x${f.h}+${f.x}+${f.y}`, "+repage", "-alpha", "extract", "-format", "%[fx:mean]", "info:"])
    );
    f.meanAlpha = Math.round(mean * 255);
}

// 분류 — 배치 밀도를 다르게 주기 위한 등급
// ★ 안개 판정은 바운딩 박스 평균 알파로 하면 안 된다.
//   가지가 성긴 고목이 박스 평균은 낮지만 칠해진 픽셀은 불투명하다(실제로 오분류가 났다).
//   칠해진 픽셀만의 평균 알파를 보면 고목 229 / 안개 179~183으로 깨끗이 갈린다.
for (const f of frames) {
    f.solidAlpha = Math.round((f.meanAlpha * f.w * f.h) / f.area);
    if (f.solidAlpha < 200) f.kind = "fog";
    else if (f.w >= 90 && f.h <= 45) f.kind = "fence";
    else if (f.area >= 4000) f.kind = "large";     // 석관
    else if (f.h >= 88) f.kind = "tree";           // 고목 — 세로로 길다
    else if (f.area >= 1400) f.kind = "medium";    // 묘비·십자가
    else f.kind = "small";                          // 뼈·등불
}

frames.sort((a, b) => a.y - b.y || a.x - b.x);
frames.forEach((f, i) => (f.id = i));

const byKind = {};
for (const f of frames) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;

writeFileSync(resolve(MAP, "props-grave.json"), JSON.stringify({
    _comment: "tools/build-props.mjs가 props-grave.png의 알파 연결성분에서 자동 추출. 손으로 고치지 말 것.",
    sheet: "assets/map/props-grave.png",
    frames,
}, null, 1));

console.log("소품 " + frames.length + "개 추출");
console.log("등급별: " + JSON.stringify(byKind));
console.log("props-grave.json 생성");
