/**
 * 타일셋 + Tiled 맵 생성기 — 봉인묘(스테이지 1). (T130)
 *
 * 근거: 03-GDD-CORE.md 8.1 — 1600x1200 / 타일 16px / ground·walls·deco·objects 4레이어
 * 실행: npm run build:map   (FE/ 에서)
 *
 * ★ 벽을 조각내지 않는다 — 3번 실패하고 배운 것
 *   mainlevbuild.png에는 **완성된 벽 구간이 통째로** 들어 있다. (64,192)부터 12x5 타일.
 *     row0        밝은 석재 상단 갓돌
 *     row1..3     벽돌 몸통 + 해골 벽감 + 사슬 + 세로 기둥
 *     row4        밝은 석재 하단 갓돌 (알파가 있어 바닥 위에 얹힌다)
 *   이걸 4x3 조각으로 잘라 랜덤 배치하면 갓돌과 기둥 리듬이 사라져
 *   "이어진 벽"이 아니라 "바닥에 흩어진 벽돌 덩어리"가 된다.
 *   → 템플릿을 통째로, 가로 12칸 주기로 반복해 붙인다. 기둥이 규칙적으로 서고 벽이 이어진다.
 *
 * ★ 레이아웃은 절충안 C — 큰 홀 4개 + 중앙 성소 + 넓은 회랑.
 *   레퍼런스는 방·복도가 촘촘한 탐험형 던전이지만 본작은 서바이버즈다.
 *   적 150체 + 카이팅(정본 03 7 / 05)이 성립하려면 홀이 넓어야 한다.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SHEET = resolve(ROOT, "asset/tilemap/mainlevbuild.png");
const TILE_DIR = resolve(FE, "public/assets/tiles");
const MAP_DIR = resolve(FE, "public/assets/map");

const MAGICK = (() => {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 */ }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다");
})();
const magick = (a) => execFileSync(MAGICK, a, { stdio: ["ignore", "pipe", "pipe"] });

const TILE = 16;
const COLS = 12;

// ── 타일 정의
const T = [];
const push = (name, x, y, solid = false) => (T.push({ name, x, y, solid }), T.length - 1);
const rect = (name, x0, y0, w, h, solid) => {
    const start = T.length;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) push(name + r + "_" + c, x0 + c * TILE, y0 + r * TILE, solid);
    return { start, w, h };
};

const VOID = push("void", 80, 64, true);

const FLOOR = {
    warm: [push("fw0", 736, 208), push("fw1", 736, 272), push("fw2", 736, 320), push("fw3", 736, 368)],
    teal: [push("ft0", 832, 208), push("ft1", 832, 272), push("ft2", 832, 320), push("ft3", 832, 368)],
    green: [push("fg0", 928, 208), push("fg1", 928, 272), push("fg2", 928, 320), push("fg3", 928, 368)],
};
const MOSS = [push("mw", 736, 416), push("mt", 832, 416), push("mg", 928, 416)];

// ★ 완성된 벽 구간 12x5
const WALL_RUN = rect("wr", 64, 192, 12, 5, true);
const WR_W = 12, WR_H = 5;
const wr = (r, c) => WALL_RUN.start + r * WR_W + ((c % WR_W) + WR_W) % WR_W;

// 바닥 문양 — 금속 창살
const GRATE = rect("gr", 496, 208, 4, 4, false);

// ── 타일셋 이미지 조립
function buildTileset() {
    mkdirSync(TILE_DIR, { recursive: true });
    const tmp = resolve(TILE_DIR, "_tmp");
    mkdirSync(tmp, { recursive: true });
    const rows = Math.ceil(T.length / COLS);
    const parts = [];
    T.forEach((t, i) => {
        const p = resolve(tmp, "t" + String(i).padStart(3, "0") + ".png");
        magick([SHEET, "-crop", "16x16+" + t.x + "+" + t.y, "+repage", p]);
        parts.push(p);
    });
    for (let i = T.length; i < rows * COLS; i++) {
        const p = resolve(tmp, "t" + String(i).padStart(3, "0") + ".png");
        magick(["-size", "16x16", "xc:none", p]);
        parts.push(p);
    }
    const rowFiles = [];
    for (let r = 0; r < rows; r++) {
        const rp = resolve(tmp, "r" + r + ".png");
        magick([...parts.slice(r * COLS, (r + 1) * COLS), "-background", "none", "+append", rp]);
        rowFiles.push(rp);
    }
    const out = resolve(TILE_DIR, "tiles-main.png");
    magick([...rowFiles, "-background", "none", "-append", out]);
    rmSync(tmp, { recursive: true, force: true });
    return { out, size: magick([out, "-format", "%wx%h", "info:"]).toString().trim(), rows };
}

// ── 맵
const W = 100, H = 75;
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const SEED = Number(process.argv[2] ?? 20260811);
const rnd = mulberry32(SEED);
const ri = (n) => Math.floor(rnd() * n);

const region = new Array(W * H).fill(0);
const floorAt = (x, y) => inb(x, y) && region[idx(x, y)] !== 0;
const setReg = (x0, y0, w, h, r) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) region[idx(x, y)] = r;
};

// ── 레이아웃 (절충안 C)
//    벽이 5타일을 차지하므로 방 사이 간격은 최소 7타일을 둔다.
const HALLS = [
    { name: "NW", x: 6,  y: 8,  w: 34, h: 24, reg: 1 },
    { name: "NE", x: 60, y: 8,  w: 34, h: 24, reg: 2 },
    { name: "SW", x: 6,  y: 46, w: 34, h: 23, reg: 3 },
    { name: "SE", x: 60, y: 46, w: 34, h: 23, reg: 2 },
];
const SANCTUM = { x: 41, y: 32, w: 18, h: 12, reg: 1 };
const CORRIDORS = [
    { x: 17, y: 32, w: 12, h: 14, reg: 3 },
    { x: 71, y: 32, w: 12, h: 14, reg: 3 },
    { x: 40, y: 14, w: 20, h: 12, reg: 3 },
    { x: 40, y: 51, w: 20, h: 12, reg: 3 },
    { x: 45, y: 25, w: 10, h: 8,  reg: 3 },
    { x: 45, y: 43, w: 10, h: 9,  reg: 3 },
    { x: 28, y: 35, w: 14, h: 6,  reg: 3 },
    { x: 58, y: 35, w: 14, h: 6,  reg: 3 },
];
for (const c of CORRIDORS) setReg(c.x, c.y, c.w, c.h, c.reg);
for (const h of HALLS) setReg(h.x, h.y, h.w, h.h, h.reg);
setReg(SANCTUM.x, SANCTUM.y, SANCTUM.w, SANCTUM.h, SANCTUM.reg);

const SPAWN_T = { x: SANCTUM.x + Math.floor(SANCTUM.w / 2), y: SANCTUM.y + Math.floor(SANCTUM.h / 2) };

// 홀 안 기둥 — 벽 템플릿과 같은 폭(12)의 배수 리듬으로 놓아 벽과 어긋나지 않게 한다.
const PILLARS = [];
for (const h of HALLS) {
    for (const fx of [0.28, 0.72]) {
        for (const fy of [0.3, 0.75]) {
            PILLARS.push([Math.round(h.x + h.w * fx) - 3, Math.round(h.y + h.h * fy) - 2]);
        }
    }
}
for (const [px, py] of PILLARS) setReg(px, py, 6, 4, 0);

// ── 레이어
const GID = (i) => i + 1;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const deco = new Array(W * H).fill(0);
const objects = [];

const FAMILY = { 1: FLOOR.warm, 2: FLOOR.teal, 3: FLOOR.green };
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        const r = region[idx(x, y)];
        if (r) ground[idx(x, y)] = GID(rnd() < 0.82 ? FAMILY[r][0] : FAMILY[r][1 + ri(3)]);
    }

// ── ★ 벽 세우기
//    바닥이 시작되는 북쪽 경계마다 템플릿을 통째로 5타일 세운다.
//    템플릿 열은 맵 x좌표 기준으로 정해 벽 전체에서 기둥이 한 줄로 맞게 한다.
let wallCols = 0;
for (let x = 0; x < W; x++) {
    for (let y = 1; y < H; y++) {
        if (!floorAt(x, y) || floorAt(x, y - 1)) continue; // 바닥의 첫 행만
        const top = y - WR_H;
        if (top < 0) continue;
        let clear = true;
        for (let k = top; k < y; k++) if (floorAt(x, k)) { clear = false; break; }
        if (!clear) continue;
        for (let r = 0; r < WR_H; r++) walls[idx(x, top + r)] = GID(wr(r, x));
        wallCols++;
    }
}

// 나머지 경계 마감 — 남쪽은 상단 갓돌, 좌우는 몸통 한 줄. 그 밖은 검정.
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        if (floorAt(x, y) || walls[idx(x, y)]) continue;
        if (floorAt(x, y - 1)) walls[idx(x, y)] = GID(wr(0, x));
        else if (floorAt(x - 1, y) || floorAt(x + 1, y)) walls[idx(x, y)] = GID(wr(2, x));
        else walls[idx(x, y)] = GID(VOID);
    }

// ── 횃불 — 벽 하단 갓돌 앞에 규칙적으로. 광원이 분위기의 절반이다.
let torches = 0;
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        if (!floorAt(x, y) || floorAt(x, y - 1)) continue;
        // 템플릿의 기둥 위치(0열, 6열)에 맞춰 세운다
        if (x % 6 !== 3) continue;
        objects.push({ type: "torch", x: x * TILE + 8, y: y * TILE - 1 });
        torches++;
    }

// ── 바닥 문양
function stampFloor(pf, x0, y0) {
    for (let r = 0; r < pf.h; r++) for (let c = 0; c < pf.w; c++) if (!floorAt(x0 + c, y0 + r)) return false;
    for (let r = 0; r < pf.h; r++)
        for (let c = 0; c < pf.w; c++) deco[idx(x0 + c, y0 + r)] = GID(pf.start + r * pf.w + c);
    return true;
}
let grates = 0;
const GRATE_AT = [[SPAWN_T.x - 2, SPAWN_T.y - 2], ...HALLS.map((h) => [h.x + ((h.w / 2) | 0) - 2, h.y + ((h.h / 2) | 0) - 2])];
for (const [gx, gy] of GRATE_AT) if (stampFloor(GRATE, gx, gy)) grates++;

// ── 이끼 — 벽에 붙은 자리에만 얇게
let moss = 0;
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
        if (floorAt(x, y) && !deco[idx(x, y)] && !floorAt(x, y + 1) && rnd() < 0.5) {
            deco[idx(x, y)] = GID(MOSS[(region[idx(x, y)] || 1) - 1]); moss++;
        }

const SPAWN = { x: SPAWN_T.x * TILE + 8, y: SPAWN_T.y * TILE + 8 };
objects.push({ type: "spawn", x: SPAWN.x, y: SPAWN.y });

// ── Tiled JSON
const ts = buildTileset();
const L = (id, name, data) => ({ data, height: H, id, name, opacity: 1, type: "tilelayer", visible: true, width: W, x: 0, y: 0 });
const map = {
    compressionlevel: -1, height: H, infinite: false,
    layers: [
        L(1, "ground", ground), L(2, "deco", deco), L(3, "walls", walls),
        {
            draworder: "topdown", id: 4, name: "objects", opacity: 1, type: "objectgroup", visible: true, x: 0, y: 0,
            objects: objects.map((o, i) => ({ id: i + 1, name: o.type, type: o.type, point: true, x: o.x, y: o.y, width: 0, height: 0, rotation: 0, visible: true })),
        },
    ],
    nextlayerid: 5, nextobjectid: objects.length + 1,
    orientation: "orthogonal", renderorder: "right-down", tiledversion: "1.10.2",
    tileheight: TILE,
    tilesets: [{
        columns: COLS, firstgid: 1, image: "../tiles/tiles-main.png",
        imageheight: ts.rows * TILE, imagewidth: COLS * TILE, margin: 0,
        name: "tiles-main", spacing: 0, tilecount: ts.rows * COLS, tileheight: TILE, tilewidth: TILE,
    }],
    tilewidth: TILE, type: "map", version: "1.10", width: W,
    properties: [
        { name: "spawnX", type: "int", value: SPAWN.x },
        { name: "spawnY", type: "int", value: SPAWN.y },
        { name: "seed", type: "int", value: SEED },
    ],
};
mkdirSync(MAP_DIR, { recursive: true });
writeFileSync(resolve(MAP_DIR, "crypt.json"), JSON.stringify(map));

const walkable = region.filter((v) => v !== 0).length;
console.log("타일셋 tiles-main.png (" + ts.size + ") · " + T.length + "타일 / " + COLS + "x" + ts.rows);
console.log("맵 crypt.json · " + W + "x" + H + " = " + W * TILE + "x" + H * TILE + "px · 시드 " + SEED);
console.log("  통행 가능 " + walkable + " (" + Math.round((walkable / (W * H)) * 100) + "%) · 홀 " + HALLS.length + " · 기둥 " + PILLARS.length);
console.log("  벽 세운 열 " + wallCols + " · 횃불 " + torches + " · 바닥문양 " + grates + " · 이끼 " + moss);
console.log("  스폰 (" + SPAWN.x + ", " + SPAWN.y + ")");
