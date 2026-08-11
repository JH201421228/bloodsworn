/**
 * repack-items.mjs — 아이템 아이콘 아틀라스를 「여백 있는 격자」로 다시 묶는다.
 *
 * ★ 왜 필요한가 (실측한 결함)
 *   public/assets/items/items.png 은 71개 아이콘이 32px 격자에 「어긋나게」 얹혀 있었다.
 *   그림 자체는 전부 32x32 안에 들어가는 크기(최대 29x30)인데, 얹힌 위치가 칸마다
 *   1~7px 씩 밀려 있어서 39개 아이콘이 옆칸을 침범했다. 그 결과 items.json 좌표대로
 *   정확히 잘라도 이웃 아이콘의 1~7px 조각이 딸려 온다.
 *   증상 예: itm_charm_01 우측의 호박색 조각(itm_charm_02), itm_relic_spark 우측의
 *   주사위 조각(itm_relic_dice), itm_relic_phoenix 는 좌 7px · 상 3px 이나 밀려 있었다.
 *
 * ★ 왜 다시 굽지 않고 「다시 묶는가」
 *   현재 아틀라스의 그림은 build-items.mjs 도 gen-item-icons.mjs 도 재현하지 못한다
 *   (둘 다 돌려서 픽셀 비교로 확인했다 — 완전히 다른 그림이 나온다).
 *   즉 지금 실린 아트는 저장소 안에 생성기가 없는 「원본」이다. 그러니 그림은 한 픽셀도
 *   건드리지 말고 위치만 바로잡아야 한다.
 *
 * ★ 어떻게 아이콘과 이웃 조각을 가르는가
 *   아틀라스 전체를 연결요소(8-이웃)로 라벨링한다. 그러면 아이콘 하나가 덩어리 하나가 된다.
 *   덩어리의 무게중심이 어느 칸에 있는지로 소속을 정하고, 작은 파편은 가장 가까운
 *   주 덩어리에 붙인다. 칸 경계를 넘어간 픽셀도 「그 덩어리의 것」이므로 함께 옮겨진다.
 *   이러면 자르기 좌표를 고치는 게 아니라 그림을 통째로 자기 칸 안으로 되돌리는 셈이 된다.
 *
 * ★ 여백을 2px 로 잡은 근거
 *   아이콘은 UI 에서 14~20 논리픽셀로 「축소」되어 그려진다(iconStyle 의 k = size/32
 *   이므로 0.44~0.63 배). 축소 배율 0.44 에서는 화면 1픽셀이 원본 약 2.3 텍셀을 덮으므로
 *   잘라내는 상자 경계가 원본 기준 2 텍셀까지 어긋날 수 있다. 1px 여백으로는 모자란다.
 *   2px 이면 이 오차를 덮고, 나중에 누가 pixelArt:false 로 바꿔 선형 보간이 켜져도 버틴다.
 *
 * ★ 프레임 이름(키)은 절대 바꾸지 않는다 — items.json(데이터) · itemFrames.json ·
 *   sanctum.json 의 iconFrame · encounters.json 이 전부 이름으로 참조한다.
 *
 * ★ 여러 번 돌려도 결과가 같다(멱등). 이미 여백이 있는 아틀라스를 넣어도 그대로 나온다.
 *
 * 사용: node tools/repack-items.mjs [--gutter 2] [--cols 12]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const OUT = resolve(FE, "public/assets/items");
const TMP = resolve(FE, ".tmp-repack");
const CELL = 32;                 // 프레임 한 칸의 논리 크기. itemAtlas.js 의 CELL 과 같아야 한다
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : Number(argv[i + 1]); };
const GUT = argOf("gutter", 2);  // 칸 사이 투명 여백
const COLS = argOf("cols", 12);
const PITCH = CELL + GUT * 2;

function magick() {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 후보 */ }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다.");
}
const MG = magick();
const run = (a) => execFileSync(MG, a, { stdio: ["ignore", "pipe", "pipe"] });

// ── 1) 현재 아틀라스를 생 RGBA 로 읽는다 ─────────────────────────
//    ImageMagick 의 -crop 타일링은 오프셋 처리에 함정이 있어 쓰지 않는다.
//    RGBA 로 통째로 뽑아 직접 인덱싱하는 편이 검증 가능하고 안전하다.
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const srcPng = resolve(OUT, "items.png");
const atlas = JSON.parse(readFileSync(resolve(OUT, "items.json"), "utf8"));
const SW = atlas.meta.size.w, SH = atlas.meta.size.h;
const rawIn = resolve(TMP, "in.rgba");
run([srcPng, "-depth", "8", "RGBA:" + rawIn]);
const src = readFileSync(rawIn);
if (src.length !== SW * SH * 4) throw new Error(`RGBA 크기 불일치: ${src.length} != ${SW * SH * 4}`);
const alphaAt = (x, y) => src[(y * SW + x) * 4 + 3];

// ── 2) 아틀라스 전체를 연결요소로 라벨링 ─────────────────────────
//    알파 1 이상을 「그림」으로 본다. 흐린 안티에일리어싱 가장자리까지 한 덩어리로 묶어야
//    옮길 때 테두리가 잘려나가지 않는다.
const label = new Int32Array(SW * SH).fill(-1);
const blobs = [];
for (let seed = 0; seed < SW * SH; seed++) {
    if (label[seed] !== -1) continue;
    const sx = seed % SW, sy = (seed / SW) | 0;
    if (alphaAt(sx, sy) === 0) { label[seed] = -2; continue; }
    const id = blobs.length, stack = [seed];
    label[seed] = id;
    let n = 0, minX = SW, minY = SH, maxX = -1, maxY = -1, accX = 0, accY = 0;
    while (stack.length) {
        const c = stack.pop(), cx = c % SW, cy = (c / SW) | 0;
        n++; accX += cx; accY += cy;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
            const ns = ny * SW + nx;
            if (label[ns] !== -1) continue;
            if (alphaAt(nx, ny) === 0) { label[ns] = -2; continue; }
            label[ns] = id; stack.push(ns);
        }
    }
    blobs.push({ id, n, bbox: [minX, minY, maxX, maxY], cx: accX / n, cy: accY / n, owner: -1 });
}

// ── 3) 덩어리를 아이콘에 배정한다 ─────────────────────────────────
//    (a) 칸마다 「무게중심이 그 칸 안에 있는 가장 큰 덩어리」를 주 덩어리로 삼는다.
//    (b) 남은 잔조각은 가장 가까운 주 덩어리에 붙인다 — 떨어져 있는 반짝임·사슬 같은
//        장식이 주인을 잃지 않도록.
const keys = Object.keys(atlas.frames);
const icons = keys.map((k) => ({ key: k, frame: atlas.frames[k].frame, parts: [] }));
// 무게중심이 프레임 사각형 안에 있으면 그 아이콘의 것이다.
// ★ 「32px 격자」로 판정하면 안 된다 — 여백이 들어간 아틀라스를 다시 넣었을 때
//   피치가 36 이라 열 번호가 어긋나고 주 덩어리를 못 찾는다(멱등성이 깨진다).
const cellOf = (b, f) => b.cx >= f.x && b.cx < f.x + f.w && b.cy >= f.y && b.cy < f.y + f.h;
for (const ic of icons) {
    const cand = blobs.filter((b) => b.owner === -1 && cellOf(b, ic.frame)).sort((a, b) => b.n - a.n);
    if (!cand.length) throw new Error(`주 덩어리를 못 찾았다: ${ic.key}`);
    cand[0].owner = ic.key; ic.parts.push(cand[0]);
}
const dist2 = (b, m) => {
    const dx = Math.max(m.bbox[0] - b.bbox[2], b.bbox[0] - m.bbox[2], 0);
    const dy = Math.max(m.bbox[1] - b.bbox[3], b.bbox[1] - m.bbox[3], 0);
    return dx * dx + dy * dy;
};
let strays = 0;
for (const b of blobs) {
    if (b.owner !== -1) continue;
    let best = null, bd = Infinity;
    for (const ic of icons) {
        const d = dist2(b, ic.parts[0]);
        if (d < bd) { bd = d; best = ic; }
    }
    b.owner = best.key; best.parts.push(b); strays++;
}

// ── 4) 새 격자에 그림을 「통째로」 옮겨 넣는다 ────────────────────
//    칸 안에서 다시 가운데 정렬한다. 원본이 칸마다 제각각 밀려 있었기 때문에
//    좌표만 고쳐서는 그림이 여전히 한쪽으로 쏠린다.
const rows = Math.ceil(icons.length / COLS);
const DW = COLS * PITCH, DH = rows * PITCH;
const dst = Buffer.alloc(DW * DH * 4, 0);
const report = [];
for (let i = 0; i < icons.length; i++) {
    const ic = icons[i];
    let minX = SW, minY = SH, maxX = -1, maxY = -1;
    for (const p of ic.parts) {
        if (p.bbox[0] < minX) minX = p.bbox[0]; if (p.bbox[2] > maxX) maxX = p.bbox[2];
        if (p.bbox[1] < minY) minY = p.bbox[1]; if (p.bbox[3] > maxY) maxY = p.bbox[3];
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    if (w > CELL || h > CELL) throw new Error(`${ic.key}: 그림이 ${w}x${h} 로 한 칸(${CELL})을 넘는다`);
    const col = i % COLS, row = (i / COLS) | 0;
    const fx = col * PITCH + GUT, fy = row * PITCH + GUT;          // 프레임(32x32) 좌상단
    const ox = fx + ((CELL - w) >> 1), oy = fy + ((CELL - h) >> 1); // 그림 좌상단(가운데 정렬)
    const own = new Set(ic.parts.map((p) => p.id));
    let moved = 0;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (!own.has(label[y * SW + x])) continue;   // ★ 이웃 덩어리 픽셀은 옮기지 않는다
        const s = (y * SW + x) * 4, d = ((oy + y - minY) * DW + (ox + x - minX)) * 4;
        dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = src[s + 3];
        moved++;
    }
    ic.out = { x: fx, y: fy, w: CELL, h: CELL };
    report.push({ key: ic.key, w, h, parts: ic.parts.length, moved });
}

// ── 5) 내보내기 — png · 아틀라스 json · UI 좌표표 ────────────────
const rawOut = resolve(TMP, "out.rgba");
writeFileSync(rawOut, dst);
run(["-size", `${DW}x${DH}`, "-depth", "8", "RGBA:" + rawOut,
     "-define", "png:color-type=6", "PNG32:" + srcPng]);

const frames = {};
for (const ic of icons) {
    frames[ic.key] = {
        frame: { ...ic.out }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL }, sourceSize: { w: CELL, h: CELL },
    };
}
writeFileSync(resolve(OUT, "items.json"), JSON.stringify({
    frames,
    meta: { app: "tools/repack-items.mjs", image: "items.png",
            size: { w: DW, h: DH }, scale: "1", gutter: GUT },
}, null, 2) + "\n");

// itemFrames.json — src 안에서 쓰는 납작한 좌표표. public/ 은 JS 에서 import 하지 않는다
const flat = Object.entries(frames)
    .map(([k, f]) => `  ${JSON.stringify(k)}: [${f.frame.x}, ${f.frame.y}, ${f.frame.w}, ${f.frame.h}]`)
    .join(",\n");
writeFileSync(resolve(FE, "src/ui/inventory/itemFrames.json"),
    `{\n"_meta": { "sheet": [${DW}, ${DH}], "src": "public/assets/items/items.json", "gutter": ${GUT} },\n`
    + `"frames": {\n${flat}\n}\n}\n`);

rmSync(TMP, { recursive: true, force: true });
const bytes = readFileSync(srcPng).length;
console.log(`아이템 아틀라스 재패킹: ${icons.length}프레임 / 잔조각 ${strays}개를 주인에게 붙였다`);
console.log(`  격자 ${COLS}x${rows}, 칸 ${CELL}px + 여백 ${GUT}px -> 피치 ${PITCH}px`);
console.log(`  ${SW}x${SH} -> ${DW}x${DH}px  (${(bytes / 1024).toFixed(1)}KB)`);
console.log(`  갱신: public/assets/items/items.{png,json} · src/ui/inventory/itemFrames.json`);
const big = report.filter((r) => r.w > CELL - GUT * 2 || r.h > CELL - GUT * 2);
if (big.length) console.log(`  ※ 칸을 거의 채우는 그림 ${big.length}개: ` + big.map((r) => `${r.key}(${r.w}x${r.h})`).join(", "));
