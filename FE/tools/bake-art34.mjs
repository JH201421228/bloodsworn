/**
 * 3차 수령본 4종 재단 — 대시 아이콘 · 「혼탄」 · 궁수 화살 · 궤 발밑 표식.
 *
 * 정본: docs/32 §11 (대시 아이콘 · 「혼탄」 · 화살) · docs/33 §9 (궤 표식)
 * 실행: node tools/bake-art34.mjs        (FE/ 에서. build:all-assets 에 넣지 않는다)
 *
 * ★ 이 스크립트는 무엇을 하는가 — 「그리지」 않는다. 「자른다」
 *   Codex 수령본은 한 대상당 3벌로 온다.
 *     -source  큰 캔버스 · RGB(알파 없음) · 배경이 크로마키 초록          = 원본
 *     -alpha   같은 크기 · RGBA · 배경만 지운 것                          = 중간본
 *     숫자     게임 격자로 축소한 것 (32 / 4x16 / 14 / 48)                = 최종본 후보
 *   여기서 하는 일은 그 최종본 후보를 검수하고 결함만 고쳐 배선 경로로 옮기는 것이다.
 *   새 형태를 만들지 않는다 — 절차 생성은 이 파일에 한 줄도 없다.
 *
 * ★ 수령 검수에서 나온 결함 2종 (docs/32 §7 · docs/33 §8 절차)
 *   D-1 크로마키 초록 잔류. -source 의 배경이 rgb(46,240,47) 인데 배경 제거가 완전하지
 *       않아 그림 안쪽에 초록 화소가 남았다. ui-dash 2개 · soul-bolt 8개.
 *       16px 투사체에서 8화소는 눈에 그대로 보인다.
 *   D-2 enemy-arrow-14.png 가 파손이다. 불투명 화소가 4개뿐이고 bbox 가 4x1 이다.
 *       원인은 축소 방식이다 — 1774x887 캔버스 전체를 14x14 로 줄여서
 *       그림(581x161)이 4x1 로 뭉개졌다. 화살 자체는 -alpha 안에 멀쩡히 있다.
 *       그래서 여기서는 -alpha 를 잘라 다시 줄인다. 그리는 것이 아니라 굽기 단계의 복구다.
 *
 * ★ 절대 규칙 — public/assets/generated/ 아래는 읽기 전용이다
 *   사용자 수령본이고 이 저장소에서 빌드 스크립트가 수령본을 덮어쓴 사고가 두 번 났다
 *   (커밋 131d554 · 6889771). 아래 assertNotReceipt() 가 출력 경로를 물리적으로 막는다.
 *
 * ★ 색 정책 — 투사체는 색을 갖고, 바닥 데칼은 무채색이다
 *   proj-*.png 10장은 전부 유채색 팔레트다(실측: 무채색 화소 0). 「혼탄」과 화살은 그 형제라
 *   색을 그대로 둔다. 반대로 mark-chest 는 데칼이라 R=G=B 여야 하고(docs/33 §5.1),
 *   실측에서 이미 78/157 두 계조의 무채색이었다 — 손대지 않고 그대로 옮긴다.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../public/assets/generated");
const PUB = resolve(HERE, "../public/assets");

/** 출력 경로가 수령본 폴더를 가리키면 즉시 죽는다. 이 가드가 이 파일의 존재 이유의 절반이다 */
function assertNotReceipt(file) {
    const p = resolve(file).split("\\").join("/");
    if (p.includes("/public/assets/generated/")) {
        throw new Error("수령본 폴더에 쓰려고 했다. 중단한다: " + file);
    }
}

// ── PNG 코덱 (zlib 만 쓴다 — build-decals.mjs 와 같은 이유) ─────────────────
const CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();
function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}
/** RGBA 생바이트 -> PNG. 필터 0(None) — 픽셀아트라 예측 필터의 이득이 없다 */
function encodePng(w, h, rgba) {
    const raw = Buffer.alloc(h * (w * 4 + 1));
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

/**
 * PNG -> {w,h,rgba}. 수령본이 팔레트(ct3)·회색+알파(ct4)·RGB(ct2)로 섞여 오므로
 * 네 형식을 다 받아 RGBA 로 펼친다. 인터레이스와 16비트는 안 온다 — 오면 죽는 편이 낫다.
 */
function decodePng(path) {
    const b = readFileSync(path);
    let p = 8, ihdr = null, plte = null, trns = null;
    const idat = [];
    while (p < b.length) {
        const len = b.readUInt32BE(p);
        const type = b.toString("latin1", p + 4, p + 8);
        const data = b.subarray(p + 8, p + 8 + len);
        if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), bd: data[8], ct: data[9], il: data[12] };
        else if (type === "IDAT") idat.push(data);
        else if (type === "PLTE") plte = data;
        else if (type === "tRNS") trns = data;
        else if (type === "IEND") break;
        p += 12 + len;
    }
    if (!ihdr || ihdr.il || ihdr.bd === 16) throw new Error("지원하지 않는 PNG: " + path);
    const raw = inflateSync(Buffer.concat(idat));
    const { w, h, bd, ct } = ihdr;
    const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
    const bpp = Math.max(1, (chans * bd) >> 3);
    const rowBytes = Math.ceil((w * chans * bd) / 8);
    const out = Buffer.alloc(h * rowBytes);
    let pos = 0, prev = Buffer.alloc(rowBytes);
    for (let y = 0; y < h; y++) {
        const ft = raw[pos++];
        const line = Buffer.from(raw.subarray(pos, pos + rowBytes));
        pos += rowBytes;
        for (let i = 0; i < rowBytes; i++) {
            const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], ul = i >= bpp ? prev[i - bpp] : 0;
            let v = line[i];
            if (ft === 1) v += a;
            else if (ft === 2) v += up;
            else if (ft === 3) v += (a + up) >> 1;
            else if (ft === 4) {
                const pp = a + up - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - ul);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
            }
            line[i] = v & 255;
        }
        line.copy(out, y * rowBytes);
        prev = line;
    }
    const rgba = Buffer.alloc(w * h * 4);
    const maxv = (1 << bd) - 1;
    const sample = (y, idx) => {
        if (bd === 8) return out[y * rowBytes + idx];
        const bit = idx * bd;
        return (out[y * rowBytes + (bit >> 3)] >> (8 - bd - (bit & 7))) & maxv;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (ct === 3) {
                const i = sample(y, x);
                rgba[o] = plte[i * 3]; rgba[o + 1] = plte[i * 3 + 1]; rgba[o + 2] = plte[i * 3 + 2];
                rgba[o + 3] = trns && i < trns.length ? trns[i] : 255;
            } else if (ct === 0) {
                const g = Math.round((sample(y, x) / maxv) * 255);
                rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = 255;
            } else if (ct === 4) {
                rgba[o] = rgba[o + 1] = rgba[o + 2] = sample(y, x * 2); rgba[o + 3] = sample(y, x * 2 + 1);
            } else if (ct === 2) {
                rgba[o] = sample(y, x * 3); rgba[o + 1] = sample(y, x * 3 + 1); rgba[o + 2] = sample(y, x * 3 + 2); rgba[o + 3] = 255;
            } else {
                for (let c = 0; c < 4; c++) rgba[o + c] = sample(y, x * 4 + c);
            }
        }
    }
    return { w, h, rgba };
}

// ── 공통 도구 ──────────────────────────────────────────────────────────────
const isGreen = (r, g, b) => g > r + 30 && g > b + 30;
const A = (img, x, y) => img.rgba[(y * img.w + x) * 4 + 3];

/**
 * D-1 정정 — 크로마키 초록 잔류를 이웃 색으로 덮는다.
 * ★ 투명으로 지우지 않는다. 초록 화소는 배경이 새어 든 자리가 아니라
 *   그림의 화소가 초록으로 물든 자리다(전부 형태 안쪽에 있다). 지우면 구멍이 뚫린다.
 *   반경 2 안의 초록 아닌 불투명 이웃의 평균으로 덮는다.
 */
function despill(img) {
    const { w, h, rgba } = img;
    const src = Buffer.from(rgba);
    let n = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (src[o + 3] === 0 || !isGreen(src[o], src[o + 1], src[o + 2])) continue;
            let sr = 0, sg = 0, sb = 0, cnt = 0;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const q = (ny * w + nx) * 4;
                    if (src[q + 3] === 0 || isGreen(src[q], src[q + 1], src[q + 2])) continue;
                    sr += src[q]; sg += src[q + 1]; sb += src[q + 2]; cnt++;
                }
            }
            if (!cnt) { rgba[o + 3] = 0; n++; continue; }
            rgba[o] = Math.round(sr / cnt); rgba[o + 1] = Math.round(sg / cnt); rgba[o + 2] = Math.round(sb / cnt);
            n++;
        }
    }
    return n;
}

/** 칸 하나의 불투명 bbox */
function bboxCell(img, ox, oy, cw, ch) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            if (A(img, ox + x, oy + y) === 0) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * 칸 안의 그림을 칸 중심에 다시 놓는다.
 * ★ 왜 필요한가 — 「혼탄」 4프레임의 그림 중심이 6.5 ~ 8.5 로 2px 흔들린다.
 *   맥동은 제자리에서 부풀었다 줄어드는 것이라, 중심이 흔들리면 튄다로 읽힌다.
 *   docs/33 §3.4 가 회전 프레임에 대해 못 박은 것과 같은 이유다(여백 좌=우, 상=하).
 */
function recenterCell(img, ox, oy, cw, ch) {
    const bb = bboxCell(img, ox, oy, cw, ch);
    if (!bb) return [0, 0];
    const dx = Math.round((cw - 1 - bb.x1 - bb.x0) / 2);
    const dy = Math.round((ch - 1 - bb.y1 - bb.y0) / 2);
    if (!dx && !dy) return [0, 0];
    const cell = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
        img.rgba.copy(cell, y * cw * 4, ((oy + y) * img.w + ox) * 4, ((oy + y) * img.w + ox + cw) * 4);
        img.rgba.fill(0, ((oy + y) * img.w + ox) * 4, ((oy + y) * img.w + ox + cw) * 4);
    }
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
            cell.copy(img.rgba, ((oy + ny) * img.w + ox + nx) * 4, (y * cw + x) * 4, (y * cw + x) * 4 + 4);
        }
    }
    return [dx, dy];
}

/**
 * D-2 복구 — 큰 -alpha 마스터에서 그림만 잘라 목표 칸에 area 축소한다.
 *
 * ★ 왜 마스터로 되돌아가는가
 *   수령 축소본 2장이 같은 사고로 망가져 있다. 축소가 「그림」이 아니라 「캔버스 전체」를
 *   대상으로 돌아서, 큰 여백까지 같이 줄어들며 그림이 몇 화소로 뭉갰다.
 *     enemy-arrow-14   : 그림 581x161 이 4x1 로 (불투명 4화소)
 *     boss-soul-bolt   : 4프레임 261/374/514/334 이 2x3 / 9x9 / 11x9 / 4x6 으로 —
 *                        커야 할 4번째가 첫 번째보다 작아져 맥동 순서가 뒤집혔다
 *   마스터 안의 그림 자체는 멀쩡하다. 그래서 그리지 않고 「다시 자른다」.
 *
 * ★ 알파를 반투명으로 남기지 않는다. proj-*.png 10장이 전부 알파 0 아니면 255 다
 *   (실측: 반투명 화소 0). 픽셀아트에 안티에일리어싱이 섞이면 회전할 때 가장자리가 번진다.
 *   그래서 커버리지 0.5 를 문턱으로 자르고, 색은 알파 가중 평균만 쓴다.
 */

/** 마스터에서 유효 화소(알파 128 이상 · 초록 아님)만 본다 */
function solid(m, x, y) {
    const o = (y * m.w + x) * 4;
    return m.rgba[o + 3] >= 128 && !isGreen(m.rgba[o], m.rgba[o + 1], m.rgba[o + 2]);
}

/**
 * 마스터를 세로 열 프로파일로 갈라 프레임 덩어리를 찾는다.
 * ★ 폭을 n등분하지 않는 이유 — 등분선이 덩어리를 스쳐 지나가면 그 프레임만 잘린다.
 *   실측에서 「혼탄」 마스터는 등분(495.75)과 덩어리 경계가 어긋나 있었다.
 *   덩어리를 직접 찾으면 등분 오차가 원천적으로 없다.
 */
function clusters(m, minRun) {
    const col = new Int32Array(m.w);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (solid(m, x, y)) col[x]++;
    const out = [];
    let s = -1;
    for (let x = 0; x < m.w; x++) {
        const on = col[x] > 0;
        if (on && s < 0) s = x;
        if ((!on || x === m.w - 1) && s >= 0) { out.push([s, on ? x : x - 1]); s = -1; }
    }
    return out.filter(([a, b]) => b - a + 1 >= minRun).map(([x0, x1]) => {
        let y0 = 1e9, y1 = -1;
        for (let y = 0; y < m.h; y++) for (let x = x0; x <= x1; x++) if (solid(m, x, y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
        return { x0, y0, x1, y1 };
    });
}

/** 마스터 영역 하나를 dw x dh 로 area 축소해 칸 중앙에 놓는다 */
function drawScaled(m, bb, out, cellW, cellH, ox, dw, dh) {
    const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1;
    const offX = ox + Math.floor((cellW - dw) / 2), offY = Math.floor((cellH - dh) / 2);
    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            const sx0 = bb.x0 + Math.floor((x * bw) / dw), sx1 = Math.max(bb.x0 + Math.floor(((x + 1) * bw) / dw), sx0 + 1);
            const sy0 = bb.y0 + Math.floor((y * bh) / dh), sy1 = Math.max(bb.y0 + Math.floor(((y + 1) * bh) / dh), sy0 + 1);
            let sr = 0, sg = 0, sb = 0, sa = 0, cnt = 0;
            for (let sy = sy0; sy < sy1; sy++) {
                for (let sx = sx0; sx < sx1; sx++) {
                    cnt++;
                    if (!solid(m, sx, sy)) continue;
                    const o = (sy * m.w + sx) * 4, a = m.rgba[o + 3];
                    sr += m.rgba[o] * a; sg += m.rgba[o + 1] * a; sb += m.rgba[o + 2] * a; sa += a;
                }
            }
            if (!cnt || sa / (cnt * 255) < 0.5) continue;   // 커버리지 문턱
            const o = ((offY + y) * out.w + offX + x) * 4;
            out.rgba[o] = Math.round(sr / sa);
            out.rgba[o + 1] = Math.round(sg / sa);
            out.rgba[o + 2] = Math.round(sb / sa);
            out.rgba[o + 3] = 255;
        }
    }
}

/**
 * 마스터 -> n칸 시트.
 * ★ 배율을 프레임마다 따로 잡지 않는다. 하나의 공통 배율 k 로 줄여야 맥동의 크기 비가 산다.
 *   프레임별로 칸을 꽉 채우면 4프레임이 전부 같은 크기가 되어 맥동이 사라진다.
 */
function bakeSheet(masterPath, cell, inset, expect) {
    const m = decodePng(masterPath);
    despill(m);
    const cs = clusters(m, 20);
    if (expect && cs.length !== expect) throw new Error("프레임 덩어리 " + cs.length + "개 — " + expect + "개를 기대했다: " + masterPath);
    const span = Math.max(...cs.map((b) => Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)));
    const k = (cell - inset * 2) / span;
    const out = { w: cell * cs.length, h: cell, rgba: Buffer.alloc(cell * cs.length * cell * 4) };
    const log = [];
    cs.forEach((bb, i) => {
        const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1;
        const dw = Math.max(1, Math.round(bw * k)), dh = Math.max(1, Math.round(bh * k));
        drawScaled(m, bb, out, cell, cell, i * cell, dw, dh);
        log.push(bw + "x" + bh + "->" + dw + "x" + dh);
    });
    out.src = log.join(" · ");
    return out;
}

// ── 검수 출력 (docs/32 §7 · docs/33 §8 의 항목만 추린다) ────────────────────
function verify(img, cw, ch) {
    const cols = img.w / cw, rows = img.h / ch;
    const pal = new Set();
    let opaque = 0, green = 0, semi = 0, chroma = 0;
    for (let i = 0; i < img.w * img.h; i++) {
        const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2], a = img.rgba[i * 4 + 3];
        if (a === 0) continue;
        opaque++;
        if (a < 255) semi++;
        if (isGreen(r, g, b)) green++;
        if (r !== g || g !== b) chroma++;
        pal.add((r << 24) | (g << 16) | (b << 8) | a);
    }
    const corners = [A(img, 0, 0), A(img, img.w - 1, 0), A(img, 0, img.h - 1), A(img, img.w - 1, img.h - 1)];
    console.log("   V-1 치수 " + img.w + "x" + img.h + " RGBA · 칸 " + cw + "x" + ch + " x " + cols * rows);
    console.log("   V-3 네 모서리 alpha " + corners.join("/") + " " + (corners.every((v) => v === 0) ? "통과" : "★실패"));
    console.log("   V-6 불투명 " + opaque + " · 고유 RGBA " + pal.size + " · 유채색 " + chroma + " · 반투명 " + semi);
    console.log("   D-1 초록 잔류 " + green + " " + (green === 0 ? "통과" : "★실패"));
    for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
            const bb = bboxCell(img, rx * cw, ry * ch, cw, ch);
            if (!bb) { console.log("   V-4 칸[" + (ry * cols + rx) + "] 공백"); continue; }
            const l = bb.x0, r = cw - 1 - bb.x1, t = bb.y0, b = ch - 1 - bb.y1;
            console.log("   V-4 칸[" + (ry * cols + rx) + "] 그림 " + (bb.x1 - bb.x0 + 1) + "x" + (bb.y1 - bb.y0 + 1) +
                " · 여백 L" + l + " R" + r + " T" + t + " B" + b +
                " " + (Math.abs(l - r) <= 1 && Math.abs(t - b) <= 1 ? "중심 정렬 통과" : "★중심 어긋남"));
        }
    }
}

/** 수령본 폴더 밖에만 쓴다. 같은 내용이면 건드리지 않는다 */
function write(rel, buf) {
    const file = resolve(PUB, rel);
    assertNotReceipt(file);
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file) && readFileSync(file).equals(buf)) {
        console.log("   = 내용이 같다. 그대로 둔다 -> " + rel);
        return;
    }
    writeFileSync(file, buf);
    console.log("   -> " + rel);
}

// ── ① 대시 버튼 아이콘 (docs/32 §11.1 · 예비칸 38 ui_dash) ─────────────────
console.log("[ui-dash] 32x32 · 갈매기 잔상 3줄");
{
    const img = decodePng(resolve(SRC, "ui-dash-32.png"));
    console.log("   D-1 초록 잔류 " + despill(img) + "개 정정");
    const d = recenterCell(img, 0, 0, 32, 32);
    console.log("   중심 보정 dx=" + d[0] + " dy=" + d[1]);
    verify(img, 32, 32);
    write("icons/ui-dash.png", encodePng(img.w, img.h, img.rgba));
}

// ── ② 보스 실탄 「혼탄」 (docs/32 §11.2 B · 16x16 4프레임 맥동) ─────────────
console.log("\n[proj-soul-bolt] 64x16 · 16px 4프레임 · -alpha 마스터에서 재단");
{
    const img = bakeSheet(resolve(SRC, "boss-soul-bolt-alpha.png"), 16, 1, 4);
    console.log("   마스터 재단 " + img.src);
    // 커버리지 문턱이 가장자리 한 줄을 잘라 낼 수 있다. 맥동은 제자리에서 부푸는 것이라
    // 칸 중심이 1px 만 흔들려도 「튄다」로 읽힌다 — 칸마다 다시 가운데로 민다.
    for (let i = 0; i < 4; i++) recenterCell(img, i * 16, 0, 16, 16);
    verify(img, 16, 16);
    write("projectile/proj-soul-bolt.png", encodePng(img.w, img.h, img.rgba));
}

// ── ③ 적 궁수 화살 (docs/32 §11.2 C · 14x14 단일 프레임) ───────────────────
console.log("\n[proj-arrow-bone] 14x14 · -alpha 마스터에서 재단(수령 14px 은 파손)");
{
    const img = bakeSheet(resolve(SRC, "enemy-arrow-alpha.png"), 14, 1, 1);
    console.log("   마스터 재단 " + img.src);
    verify(img, 14, 14);
    write("projectile/proj-arrow-bone.png", encodePng(img.w, img.h, img.rgba));
}

// ── ④ 「봉인된 궤」 발밑 표식 (docs/33 §9 · 시트A 예비칸 05 mark_chest) ─────
console.log("\n[mark-chest-48] 48x48 · 무채색 그대로 옮긴다");
{
    const img = decodePng(resolve(SRC, "mark-chest-48.png"));
    console.log("   D-1 초록 잔류 " + despill(img) + "개 정정");
    verify(img, 48, 48);
    write("decal/mark-chest-48.png", encodePng(img.w, img.h, img.rgba));
}

console.log("\n★ 등록은 public/assets.json 만 고친다. PreloadScene.js 는 건드리지 않는다.");
console.log("★ public/assets/generated/ 아래는 한 바이트도 쓰지 않았다(assertNotReceipt).");
