/**
 * 타일셋 + Tiled 맵 생성기 — 봉인묘(스테이지 1). (T130)
 *
 * 근거: 03-GDD-CORE.md 8.1 — 1600x1200 / 타일 16px / ground·walls·deco·objects 4레이어
 * 실행: npm run build:map   (FE/ 에서)
 *
 * ★ 이 파일이 타일셋도 함께 만드는 이유
 *   타일 인덱스와 맵 GID는 한 몸이다. 두 스크립트로 나누면 인덱스가 어긋나도
 *   맵이 조용히 이상해질 뿐 에러가 나지 않는다. 한 파일이 계약 전체를 소유한다.
 *
 * ★ AT-07 정정 (2026-08-11) — 1차 판단이 틀렸다
 *   README와 09-ART는 mainlevbuild.png를 "정면뷰 플랫포머 세트"로 경고했고 나도 그렇게 판단했다.
 *   원작(szadiart.itch.io/rogue-fantasy-catacombs)을 확인한 결과 **공식적으로 탑다운 전용**이다.
 *   내가 입면도로 읽은 것은 탑다운 픽셀 던전의 표준 관례인 **벽면(wall face) 표현**이었다.
 *
 *   원작자 레퍼런스 맵에서 읽어낸 조립 규칙:
 *     - 바닥은 평평한 석재. 벽은 3타일 높이 벽돌 밴드. 벽 너머는 순수 검정(void)
 *     - 벽면에 납골 벽감 격자와 해골 알코브를 박아 넣는다
 *     - 횃불·촛불을 벽면을 따라 다수 배치한다 (분위기의 절반이 광원이다)
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
const COLS = 10;

// ── 타일 정의. 각 타일은 실제로 렌더해 눈으로 확인한 것만 쓴다.
//    (1차에는 알파 점유 지도만 보고 좌표를 추측했다가 벽 조각을 바닥 격자로 잘못 넣었다)
const T = [];
const push = (name, x, y, solid = false) => (T.push({ name, x, y, solid }), T.length - 1);
const rect = (name, x0, y0, w, h, solid) => {
    const start = T.length;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) push(name + r + c, x0 + c * TILE, y0 + r * TILE, solid);
    return { start, w, h };
};

const VOID = push("void", 80, 64, true); // 벽 너머의 검정

// 바닥 — 계열별 [평면, 패턴A, 패턴B, 패턴C]. 평면을 주로 깐다.
const FLOOR = {
    warm: [push("f-warm-0", 736, 208), push("f-warm-1", 736, 272), push("f-warm-2", 736, 320), push("f-warm-3", 736, 368)],
    teal: [push("f-teal-0", 832, 208), push("f-teal-1", 832, 272), push("f-teal-2", 832, 320), push("f-teal-3", 832, 368)],
    green: [push("f-green-0", 928, 208), push("f-green-1", 928, 272), push("f-green-2", 928, 320), push("f-green-3", 928, 368)],
};
const MOSS = [push("moss-warm", 736, 416), push("moss-teal", 832, 416), push("moss-green", 928, 416)];

// 벽 밴드 — 손상된 벽돌 3행 x 6열 변형. 레퍼런스대로 벽은 3타일 높이다.
const WALL_TOP = [0, 1, 2, 3, 4, 5].map((i) => push("wt" + i, 272 + i * TILE, 272, true));
const WALL_MID = [0, 1, 2, 3, 4, 5].map((i) => push("wm" + i, 272 + i * TILE, 288, true));
const WALL_BOT = [0, 1, 2, 3, 4, 5].map((i) => push("wb" + i, 272 + i * TILE, 304, true));

// 프리팹
const ALCOVE = rect("alcove", 80, 272, 4, 3, true);  // 해골 안치 벽감. 벽 밴드(3타일)에 정확히 맞는다
const GRATE = rect("grate", 496, 208, 4, 4, false);  // 금속 창살. 바닥 문양으로 쓴다(통행 가능)

// ── 벽면 모듈 (전부 4x3 = 벽 밴드 높이와 동일)
//    레퍼런스 맵의 벽은 한 종류가 아니라 여러 벽면이 이어 붙어 있다.
//    민무늬 하나로만 채우면 밀도가 나오지 않는다.
const WM_PLAIN = rect("wmp", 272, 272, 4, 3, true);   // 손상된 벽돌
const WM_NICHE = rect("wmn", 64, 192, 4, 3, true);    // 해골 안치 벽감 + 사슬
const WM_NICHE2 = rect("wmn2", 176, 192, 4, 3, true); // 해골 벽감 변형
const WM_BARRED = rect("wmb", 272, 208, 4, 3, true);  // 창살 감방 문
const WM_LATTICE = rect("wml", 496, 208, 4, 3, true); // 납골 격자 (레퍼런스 벽면의 주역)
const WALL_MODULES = [
    { pf: WM_PLAIN, w: 40 },
    { pf: WM_NICHE, w: 16 },
    { pf: WM_NICHE2, w: 14 },
    { pf: WM_LATTICE, w: 22 },
    { pf: WM_BARRED, w: 8 },
];

// ── 타일셋 이미지 조립 (COLS칸씩 가로로 붙인 뒤 세로로 이어붙인다)
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
        const rp = resolve(tmp, "row" + r + ".png");
        magick([...parts.slice(r * COLS, (r + 1) * COLS), "-background", "none", "+append", rp]);
        rowFiles.push(rp);
    }
    const out = resolve(TILE_DIR, "tiles-main.png");
    magick([...rowFiles, "-background", "none", "-append", out]);
    rmSync(tmp, { recursive: true, force: true });
    return { out, size: magick([out, "-format", "%wx%h", "info:"]).toString().trim(), rows };
}

// ── 맵 규격 (03-GDD 8.1)
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

// region: 0=void 1=warm(중앙) 2=teal(모서리 묘실) 3=green(가장자리 띠)
const region = new Array(W * H).fill(0);
const floorAt = (x, y) => inb(x, y) && region[idx(x, y)] !== 0;
const setReg = (x0, y0, w, h, r) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) region[idx(x, y)] = r;
};

// ── 레이아웃 — 큰 홀 4개 + 중앙 성소를 넓은 회랑으로 연결한다.
//    레퍼런스(원작 맵)는 방과 복도가 촘촘한 탐험형 던전이지만 본작은 서바이버즈다.
//    적 150체 동시 + 카이팅(정본 03 7 / 05)이 성립하려면 통로가 좁으면 안 된다.
//    타협: 홀 하나하나를 카이팅 가능한 크기(34x26 타일 = 544x416px)로 유지하되,
//    홀마다 바닥 색조와 벽면 구성을 다르게 해서 "여러 방을 도는" 밀도를 만든다.
const HALLS = [
    { name: "NW", x: 6,  y: 5,  w: 34, h: 26, reg: 1 },
    { name: "NE", x: 60, y: 5,  w: 34, h: 26, reg: 2 },
    { name: "SW", x: 6,  y: 44, w: 34, h: 26, reg: 3 },
    { name: "SE", x: 60, y: 44, w: 34, h: 26, reg: 2 },
];
const SANCTUM = { x: 40, y: 31, w: 20, h: 13, reg: 1 };
// 회랑 — 폭 10타일. 좁으면 적 무리에 갇힌다.
const CORRIDORS = [
    { x: 18, y: 28, w: 10, h: 20, reg: 3 }, // 좌 세로 (NW-SW)
    { x: 72, y: 28, w: 10, h: 20, reg: 3 }, // 우 세로 (NE-SE)
    { x: 36, y: 12, w: 28, h: 10, reg: 3 }, // 상 가로 (NW-NE)
    { x: 36, y: 52, w: 28, h: 10, reg: 3 }, // 하 가로 (SW-SE)
    { x: 45, y: 20, w: 10, h: 12, reg: 3 }, // 성소 -> 상 회랑
    { x: 45, y: 43, w: 10, h: 10, reg: 3 }, // 성소 -> 하 회랑
    { x: 26, y: 34, w: 15, h: 7,  reg: 3 }, // 성소 -> 좌 회랑
    { x: 59, y: 34, w: 15, h: 7,  reg: 3 }, // 성소 -> 우 회랑
];

for (const c of CORRIDORS) setReg(c.x, c.y, c.w, c.h, c.reg);
for (const h of HALLS) setReg(h.x, h.y, h.w, h.h, h.reg);
setReg(SANCTUM.x, SANCTUM.y, SANCTUM.w, SANCTUM.h, SANCTUM.reg);

const SPAWN_T = { x: SANCTUM.x + Math.floor(SANCTUM.w / 2), y: SANCTUM.y + Math.floor(SANCTUM.h / 2) };

// 열주 — 홀마다 대칭 격자로 4x3 블록을 놓는다. 홀 안에서만, 가장자리는 비운다.
const PILLARS = [];
for (const h of HALLS) {
    for (const fx of [0.22, 0.55, 0.88]) {
        for (const fy of [0.25, 0.72]) {
            const px = Math.round(h.x + h.w * fx) - 2;
            const py = Math.round(h.y + h.h * fy) - 1;
            PILLARS.push([px, py]);
        }
    }
}
// 성소는 비워둔다 — 스폰 지점이자 각성 연출이 벌어지는 곳이다
for (const [px, py] of PILLARS) setReg(px, py, 4, 3, 0);

// ── 레이어 조립
const GID = (i) => i + 1;
const ground = new Array(W * H).fill(0);
const walls = new Array(W * H).fill(0);
const deco = new Array(W * H).fill(0);
const objects = [];

const FAMILY = { 1: FLOOR.warm, 2: FLOOR.teal, 3: FLOOR.green };
// 평면 타일을 80% 깐다. 패턴을 많이 섞으면 바닥이 노이즈로 보인다(1차 실패 원인).
const pickFloor = (fam) => (rnd() < 0.8 ? fam[0] : fam[1 + ri(3)]);

for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        const r = region[idx(x, y)];
        if (r) ground[idx(x, y)] = GID(pickFloor(FAMILY[r]));
    }

// 벽 밴드 — 바닥의 북쪽 경계 위로 3타일. 그 밖은 검정. 레퍼런스의 조립 규칙.
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        if (floorAt(x, y)) continue;
        const v = ri(6);
        if (floorAt(x, y + 1)) walls[idx(x, y)] = GID(WALL_BOT[v]);
        else if (floorAt(x, y + 2)) walls[idx(x, y)] = GID(WALL_MID[v]);
        else if (floorAt(x, y + 3)) walls[idx(x, y)] = GID(WALL_TOP[v]);
        // 남·좌·우 경계는 1타일 캡으로 마감한다. 이게 없으면 바닥이 허공에서 끊긴다.
        else if (floorAt(x - 1, y) || floorAt(x + 1, y) || floorAt(x, y - 1)) walls[idx(x, y)] = GID(WALL_TOP[v]);
        else walls[idx(x, y)] = GID(VOID);
    }

/** 벽 밴드(3타일)에 프리팹을 찍는다 */
function stampWall(pf, x0, y0) {
    for (let r = 0; r < pf.h; r++)
        for (let c = 0; c < pf.w; c++) {
            const x = x0 + c, y = y0 + r;
            if (!inb(x, y) || floorAt(x, y)) return false;
        }
    for (let r = 0; r < pf.h; r++)
        for (let c = 0; c < pf.w; c++) walls[idx(x0 + c, y0 + r)] = GID(pf.start + r * pf.w + c);
    return true;
}

// ── 벽면 구성 — 북향 벽 밴드를 4칸짜리 모듈로 이어 붙인다.
//    한 종류로 채우면 밀도가 안 난다. 레퍼런스 맵도 벽면이 계속 바뀐다.
const pickModule = () => {
    const total = WALL_MODULES.reduce((s2, m) => s2 + m.w, 0);
    let r = ri(total);
    for (const m of WALL_MODULES) { if (r < m.w) return m.pf; r -= m.w; }
    return WM_PLAIN;
};

let modules = 0, torches = 0;
for (let y = 0; y < H - 3; y++) {
    // 이 행에서 "북향 벽면"(3타일 밴드의 맨 위)이 연속되는 구간을 찾는다
    let x = 0;
    while (x < W) {
        const face = (xx) => !floorAt(xx, y) && !floorAt(xx, y + 1) && !floorAt(xx, y + 2) && floorAt(xx, y + 3);
        if (!face(x)) { x++; continue; }
        let end = x;
        while (end < W && face(end)) end++;
        // 구간을 4칸씩 모듈로 채운다
        for (let sx = x; sx + 4 <= end; sx += 4) {
            if (stampWall(pickModule(), sx, y)) modules++;
        }
        // 구간 중앙마다 횃불 — 광원이 분위기의 절반이다
        for (let tx = x + 2; tx < end; tx += 7) {
            objects.push({ type: "torch", x: tx * TILE + 8, y: (y + 3) * TILE - 2 });
            torches++;
        }
        x = end;
    }
}
const alcoves = modules;

/** 바닥 문양 */
function stampFloor(pf, x0, y0) {
    for (let r = 0; r < pf.h; r++) for (let c = 0; c < pf.w; c++) if (!floorAt(x0 + c, y0 + r)) return false;
    for (let r = 0; r < pf.h; r++)
        for (let c = 0; c < pf.w; c++) deco[idx(x0 + c, y0 + r)] = GID(pf.start + r * pf.w + c);
    return true;
}
let grates = 0;
const GRATE_AT = [
    [SPAWN_T.x - 2, SPAWN_T.y - 2],
    ...HALLS.map((h) => [h.x + Math.floor(h.w / 2) - 2, h.y + Math.floor(h.h / 2) - 2]),
];
for (const [gx, gy] of GRATE_AT) if (stampFloor(GRATE, gx, gy)) grates++;

// 이끼 — 벽에 붙은 자리에만 얇게. 넓게 뿌리면 바닥이 지저분해진다.
let mossCells = 0;
const nearWall = (x, y) => [[0,-1],[0,1],[-1,0],[1,0]].some(([dx,dy]) => inb(x+dx,y+dy) && !floorAt(x+dx,y+dy));
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
        if (floorAt(x, y) && deco[idx(x, y)] === 0 && nearWall(x, y) && rnd() < 0.35) {
            deco[idx(x, y)] = GID(MOSS[region[idx(x, y)] - 1] ?? MOSS[0]); mossCells++;
        }

const SPAWN = { x: SPAWN_T.x * TILE + 8, y: SPAWN_T.y * TILE + 8 };
objects.push({ type: "spawn", x: SPAWN.x, y: SPAWN.y });

// ── Tiled JSON 출력
const ts = buildTileset();
const tileLayer = (id, name, data) => ({
    data, height: H, id, name, opacity: 1, type: "tilelayer", visible: true, width: W, x: 0, y: 0,
});

const map = {
    compressionlevel: -1, height: H, infinite: false,
    layers: [
        tileLayer(1, "ground", ground),
        tileLayer(2, "deco", deco),
        tileLayer(3, "walls", walls),
        {
            draworder: "topdown", id: 4, name: "objects", opacity: 1, type: "objectgroup",
            visible: true, x: 0, y: 0,
            objects: objects.map((o, i) => ({
                id: i + 1, name: o.type, type: o.type, point: true,
                x: o.x, y: o.y, width: 0, height: 0, rotation: 0, visible: true,
            })),
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
const band = walls.filter((v) => v !== 0 && v !== GID(VOID)).length;
console.log("타일셋 tiles-main.png (" + ts.size + ") · " + T.length + "타일 / " + COLS + "x" + ts.rows);
console.log("맵 crypt.json · " + W + "x" + H + " 타일 = " + W * TILE + "x" + H * TILE + "px · 시드 " + SEED);
console.log("  레이어 4종: ground / deco / walls / objects (정본 8.1)");
console.log("  통행 가능 " + walkable + "타일 (" + Math.round((walkable / (W * H)) * 100) + "%) · 열주 " + PILLARS.length + "개");
console.log("  벽면 " + band + "타일 · 알코브 " + alcoves + " · 횃불 " + torches + " · 바닥문양 " + grates + " · 이끼 " + mossCells);
console.log("  스폰 (" + SPAWN.x + ", " + SPAWN.y + ")");
if (walkable / (W * H) < 0.35) console.warn("  ! 통행 면적 부족 — 카이팅 공간이 좁다");
