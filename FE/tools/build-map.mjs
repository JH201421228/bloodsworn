/**
 * Tiled 맵 생성기 — 봉인묘(스테이지 1) 1600x1200 맵을 프로그램으로 만든다. (T130)
 *
 * 근거: 03-GDD-CORE.md 8.1(월드 1600x1200 / 타일 16px) · 09-ART AT-07
 * 실행: npm run build:map   (FE/ 에서)
 *
 * ★ Tiled 에디터로 손으로 그리지 않는 이유
 *   ① AT-07 결과 이 타일셋에서 쓸 수 있는 건 평면 바닥 텍스처와 벽 1종뿐이라
 *      손으로 배치해서 얻을 표현력이 거의 없다.
 *   ② 시드 고정 생성이면 밸런스 조정 때 맵을 재현 가능하게 다시 뽑을 수 있다.
 *   ③ Day 1에 1.5시간을 아낀다. 로드맵의 실패 폴백(단색 무한 평면)보다 훨씬 낫다.
 *   Tiled로 손보고 싶어지면 이 산출물을 Tiled에서 열어 편집하면 된다. 형식은 표준이다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const OUT_DIR = resolve(FE, "public/assets/map");

// ── 규격 (03-GDD-CORE 8.1)
const TILE = 16;
const W = 100; // 1600 / 16
const H = 75; // 1200 / 16

// ── 타일 인덱스 (tools/build-assets.mjs 의 TILES 배열과 반드시 일치)
const T_VOID = 0;
const T_FLOOR = [1, 2, 3, 4, 5, 6]; // slab-a slab-b brick stone rough moss
const T_WALL = 7;
const GID = (i) => i + 1; // Tiled firstgid=1. 0은 빈 칸이다.

// ── 시드 고정 RNG (mulberry32). 같은 시드면 같은 맵이 나온다.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = Number(process.argv[2] ?? 20260810);
const rnd = mulberry32(SEED);
const ri = (n) => Math.floor(rnd() * n);

const idx = (x, y) => y * W + x;

// ── 1. ground 레이어: 전면 바닥. 패턴이 눈에 띄지 않게 가중치를 준다.
//    slab 계열을 주로 깔고 rough/moss를 드물게 섞는다.
const GROUND_WEIGHTS = [
    [1, 34], // slab-a
    [2, 30], // slab-b
    [3, 16], // brick
    [4, 12], // stone
    [5, 5], // rough
    [6, 3], // moss
];
const GROUND_TOTAL = GROUND_WEIGHTS.reduce((s, [, w]) => s + w, 0);

function pickFloor() {
    let r = ri(GROUND_TOTAL);
    for (const [t, w] of GROUND_WEIGHTS) {
        if (r < w) return t;
        r -= w;
    }
    return T_FLOOR[0];
}

const ground = new Array(W * H);
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) ground[idx(x, y)] = GID(pickFloor());
}

// ── 2. walls 레이어: 외곽 테두리 + 내부 기둥 블록
//    0 = 빈 칸(통행 가능). 벽 타일만 GID를 넣는다.
const walls = new Array(W * H).fill(0);

// 외곽 2타일 — 맵 밖으로 나가지 못하게 한다
const BORDER = 2;
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) {
            walls[idx(x, y)] = GID(T_WALL);
        }
    }
}

// 플레이어 스폰 안전 구역 — 맵 중앙. 여기엔 기둥을 놓지 않는다.
const SPAWN = { x: Math.floor(W / 2), y: Math.floor(H / 2), r: 9 };

// 내부 기둥: 3x3 ~ 6x6 사각 블록. 서바이버즈는 시야가 생명이라 크게 만들지 않는다.
const PILLARS = 38;
let placed = 0;
for (let attempt = 0; attempt < PILLARS * 12 && placed < PILLARS; attempt++) {
    const w = 3 + ri(4);
    const h = 3 + ri(4);
    const x = BORDER + 2 + ri(W - 2 * BORDER - 4 - w);
    const y = BORDER + 2 + ri(H - 2 * BORDER - 4 - h);

    // 스폰 안전 구역과 겹치면 버린다
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (Math.hypot(cx - SPAWN.x, cy - SPAWN.y) < SPAWN.r + Math.max(w, h)) continue;

    // 기존 기둥과 최소 3타일 간격 — 붙으면 통로가 막힌다
    let clash = false;
    for (let yy = y - 3; yy < y + h + 3 && !clash; yy++) {
        for (let xx = x - 3; xx < x + w + 3; xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            if (walls[idx(xx, yy)] !== 0 && !(xx < BORDER || yy < BORDER || xx >= W - BORDER || yy >= H - BORDER)) {
                clash = true;
                break;
            }
        }
    }
    if (clash) continue;

    for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) walls[idx(xx, yy)] = GID(T_WALL);
    }
    placed++;
}

// ── 3. Tiled JSON 출력 (표준 형식. Tiled 에디터로 열어 편집 가능)
const layer = (id, name, data) => ({
    data,
    height: H,
    id,
    name,
    opacity: 1,
    type: "tilelayer",
    visible: true,
    width: W,
    x: 0,
    y: 0,
});

const map = {
    compressionlevel: -1,
    height: H,
    infinite: false,
    layers: [layer(1, "ground", ground), layer(2, "walls", walls)],
    nextlayerid: 3,
    nextobjectid: 1,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.10.2",
    tileheight: TILE,
    tilesets: [
        {
            columns: 8,
            firstgid: 1,
            image: "../tiles/tiles-main.png",
            imageheight: TILE,
            imagewidth: 128,
            margin: 0,
            name: "tiles-main",
            spacing: 0,
            tilecount: 8,
            tileheight: TILE,
            tilewidth: TILE,
        },
    ],
    tilewidth: TILE,
    type: "map",
    version: "1.10",
    width: W,
    properties: [
        { name: "spawnX", type: "int", value: SPAWN.x * TILE + TILE / 2 },
        { name: "spawnY", type: "int", value: SPAWN.y * TILE + TILE / 2 },
        { name: "seed", type: "int", value: SEED },
    ],
};

mkdirSync(OUT_DIR, { recursive: true });
const outFile = resolve(OUT_DIR, "crypt.json");
writeFileSync(outFile, JSON.stringify(map));

// ── 검산 — 눈으로 못 보는 산출물이므로 숫자로 확인한다
const wallCount = walls.filter((v) => v !== 0).length;
const borderCount = W * H - (W - 2 * BORDER) * (H - 2 * BORDER);
const innerWalls = wallCount - borderCount;
const walkable = W * H - wallCount;

console.log("맵 생성 완료");
console.log("  파일: " + outFile);
console.log("  시드: " + SEED);
console.log("  크기: " + W + "x" + H + " 타일 = " + W * TILE + "x" + H * TILE + "px");
console.log("  스폰: (" + SPAWN.x * TILE + ", " + SPAWN.y * TILE + ") 안전반경 " + SPAWN.r + "타일");
console.log("  기둥: " + placed + "개 배치 (목표 " + PILLARS + ")");
console.log("  벽 타일: " + wallCount + " (외곽 " + borderCount + " + 내부 " + innerWalls + ")");
console.log("  통행 가능: " + walkable + " 타일 (" + Math.round((walkable / (W * H)) * 100) + "%)");
if (walkable / (W * H) < 0.75) console.warn("  ! 통행 가능 면적이 75% 미만이다. 기둥이 너무 많다");
