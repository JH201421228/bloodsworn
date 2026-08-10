/**
 * 마스크 보정 + 검증 + 충돌 배열 생성.
 *
 * 하는 일
 *  1) map-objects.json의 solids(홀 안 소품)를 마스크에서 흰색으로 되돌린다
 *     근거: 06-TECH-DESIGN 998행 "적은 벽을 통과한다". 적이 통과하는데 플레이어만
 *     막히면 소품은 전술적 이득 0에 카이팅 걸림만 만든다. 막는 것은 방 경계 벽뿐이다.
 *  2) 16px 격자 충돌 배열(100x75)을 만든다 — 셀의 과반이 검정이면 solid
 *  3) 스폰에서 도달 가능한 영역을 flood fill로 검사한다 (봉인된 방 검출)
 *
 * 실행: node tools/fix-mask.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = resolve(HERE, "../public/assets/map");
const MAGICK = (() => {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* next */ }
    }
    throw new Error("ImageMagick 없음");
})();
const magick = (a) => execFileSync(MAGICK, a, { stdio: ["ignore", "pipe", "pipe"] });

const SRC = resolve(MAP, "map-crypt-mask.png");
const ORIG = resolve(MAP, "map-crypt-mask-original.png");
const OUT = resolve(MAP, "map-crypt-mask.png");

// 원본 1회 보존
if (!existsSync(ORIG)) { copyFileSync(SRC, ORIG); console.log("원본 보존: map-crypt-mask-original.png"); }

const objs = JSON.parse(readFileSync(resolve(MAP, "map-objects.json"), "utf8"));
const solids = objs.solids ?? [];

// 1) solids를 흰색으로 — 16px 격자에 맞춰 바깥으로 확장해 잔여 픽셀이 남지 않게 한다
const draws = [];
for (const s of solids) {
    const x0 = Math.floor(s.x / 16) * 16;
    const y0 = Math.floor(s.y / 16) * 16;
    const x1 = Math.ceil((s.x + s.w) / 16) * 16 - 1;
    const y1 = Math.ceil((s.y + s.h) / 16) * 16 - 1;
    draws.push("rectangle " + x0 + "," + y0 + " " + x1 + "," + y1);
}
magick([ORIG, "-fill", "white", "-stroke", "none", "-draw", draws.join(" "), OUT]);
console.log("소품 " + solids.length + "개를 통행 가능으로 되돌림");

const colors = magick([OUT, "-format", "%k", "info:"]).toString().trim();
console.log("보정 후 고유 색 수: " + colors + (colors === "2" ? " (정상)" : " ⚠ 2가 아니다"));

// 2) 16px 격자 충돌 배열 — 셀 평균 밝기가 50% 미만이면 solid
const W = 100, H = 75;
const txt = magick([OUT, "-colorspace", "gray", "-resize", W + "x" + H + "!", "-depth", "8", "txt:-"]).toString();
const grid = Array.from({ length: H }, () => new Array(W).fill(0));
for (const line of txt.split("\n")) {
    const m = line.match(/^(\d+),(\d+):\s*\((\d+)/);
    if (!m) continue;
    const x = +m[1], y = +m[2], v = +m[3];
    grid[y][x] = v >= 128 ? 1 : 0; // 1=walkable
}

// 3) 스폰에서 flood fill
const spawn = { x: Math.floor(800 / 16), y: Math.floor(608 / 16) };
if (!grid[spawn.y][spawn.x]) console.warn("⚠ 스폰 칸이 solid다!");
const seen = Array.from({ length: H }, () => new Array(W).fill(false));
const q = [[spawn.x, spawn.y]];
seen[spawn.y][spawn.x] = true;
let reach = 1;
while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (seen[ny][nx] || !grid[ny][nx]) continue;
        seen[ny][nx] = true; reach++; q.push([nx, ny]);
    }
}
const walk = grid.flat().filter((v) => v).length;
console.log("통행 가능 " + walk + "칸 (" + Math.round((walk / (W * H)) * 100) + "%)");
console.log("스폰에서 도달 " + reach + "칸 (" + Math.round((reach / walk) * 100) + "%)");
if (reach < walk) console.warn("⚠ 고립된 영역 " + (walk - reach) + "칸 — 봉인된 방이 있다");

// 4) 충돌 배열 저장 (기존 포맷 유지: 0=solid, 1=walkable)
writeFileSync(resolve(MAP, "map-collision.json"), JSON.stringify({
    tileSize: 16, width: W, height: H,
    encoding: "0=solid,1=walkable",
    source: "mask-derived-v3 (solids reverted to walkable)",
    data: grid,
}));
console.log("map-collision.json 생성 완료");
