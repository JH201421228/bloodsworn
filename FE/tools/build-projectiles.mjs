/**
 * 투사체 스프라이트 파이프라인 — asset/projectile/ 원본에서 정규화 스프라이트시트를 굽는다.
 *
 * 실행: npm run build:projectiles   (FE/ 에서)
 * 산출: FE/public/assets/projectile/*.png  +  FE/src/data/projectiles.json 의 sheets 블록
 *
 * ★ 원본은 "격자"가 아니라 카탈로그다
 *   파일명이 16x16 이라고 640x400 을 40x25 로 자르면 안 된다. 실제로는
 *   상단 절반만 16px 격자이고 하단 우측은 32px 급 대형 스프라이트가 불규칙하게 놓여 있다.
 *   그래서 이 스크립트는 **알파 채널을 직접 읽어** 프레임 경계를 실측하고,
 *   그 결과를 콘솔과 projectiles.json 에 근거로 남긴다. 추측한 값은 하나도 쓰지 않는다.
 *
 * ★ 8장은 프레임이 아니라 팔레트다
 *   _00 ~ _07 의 알파 채널 SHA1 이 전부 동일하다(스크립트가 매번 검증한다).
 *   즉 같은 그림의 색만 다른 8벌이다. 같은 스트립을 팔레트만 바꿔 여러 번 굽는 이유가 이것이다.
 *
 * ★ 정규화 = "합집합 bbox 를 정사각 셀 중앙에"
 *   프레임마다 -trim 하면 애니메이션의 상대 위치가 무너진다(성장하는 혜성이 제자리 깜빡임이 된다).
 *   스트립 전체의 합집합 bbox 를 한 번만 구해 모든 프레임에 같은 창을 적용한다.
 *   셀을 정사각으로 만드는 이유는 진행 방향 회전 때 원점이 흔들리지 않게 하기 위해서다.
 *
 * ★ 라이선스: BDragon1727 "Fire Pixel Bullet 16x16". 상업적 사용/개조 허용, 재판매·재배포 금지.
 *   원본(asset/)은 커밋하지 않고 여기서 구운 산출물만 커밋한다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SRC = resolve(ROOT, "asset/projectile");
const OUT = resolve(FE, "public/assets/projectile");
const DATA = resolve(FE, "src/data/projectiles.json");
const TMP = resolve(FE, ".tmp-projectiles");

const SHEET_W = 640;
const SHEET_H = 400;

/** _00 ~ _07 이 어떤 색인지. 각 시트 (0,16) 셀의 히스토그램 실측값에서 이름을 붙였다. */
const PALETTES = [
    { id: "fire", file: 0, hint: "#FA6A0A 주황-노랑. 기본 화염" },
    { id: "rose", file: 1, hint: "#EA6262 살구-분홍" },
    { id: "ice", file: 2, hint: "#5ACBFD 하늘-흰색" },
    { id: "venom", file: 3, hint: "#5BA675 녹색" },
    { id: "gold", file: 4, hint: "#F4AA38 금-호박. 성수/신성" },
    { id: "void", file: 5, hint: "#7A09FA 보라. 심연" },
    { id: "ash", file: 6, hint: "#906C8F 회보라. 뼈/재" },
    { id: "blood", file: 7, hint: "#A6555F 탁한 적. 혈계" },
];

/**
 * 잘라 쓸 스트립. x,y 는 원본 좌상단, pitch 는 실측한 격자 간격, frames 는 기대 프레임 수.
 *
 * ★ 여기 좌표는 눈으로 고른 것이 아니라 알파 섬(연결 요소) 분석으로 확인한 값이다.
 *   스크립트가 매 실행마다 프레임 수와 셀별 bbox 를 다시 재고, 어긋나면 실패한다.
 *   원본이 바뀌면 조용히 이상한 그림이 나오는 대신 빌드가 멈춘다.
 *
 * ★ dir:"+x" = 원본이 오른쪽을 향한다. 런타임에서 rotation = 진행각 을 그대로 넣으면 맞는다.
 *   방향성이 없는 그림(구체/폭발)은 dir:null 이고 회전시키지 않는다.
 */
const STRIPS = [
    // ── 탄환 (16px 격자 영역)
    { id: "dart", x: 0, y: 256, pitch: 16, frames: 5, kind: "bullet", dir: "+x", fps: 14, desc: "화염 다트. 꼬리가 펄럭이는 5프레임 루프" },
    { id: "spear", x: 0, y: 272, pitch: 16, frames: 5, kind: "bullet", dir: "+x", fps: 14, desc: "화염 창. 다트보다 길다 — 관통탄용" },
    { id: "orb", x: 0, y: 16, pitch: 16, frames: 5, kind: "bullet", dir: null, fps: 10, desc: "맥동하는 구체. 방향이 없다" },
    { id: "star", x: 0, y: 96, pitch: 16, frames: 5, kind: "bullet", dir: null, fps: 12, desc: "4각 별. 커졌다 작아진다" },
    { id: "shuriken", x: 96, y: 80, pitch: 16, frames: 4, kind: "bullet", dir: null, fps: 16, desc: "회전 수리검. 궤도 무기용" },
    // ── 탄환 (32px 격자 영역)
    { id: "comet", x: 448, y: 192, pitch: 32, frames: 5, kind: "bullet", dir: "+x", fps: 12, desc: "대형 혜성. 프레임이 커지는 성장 시퀀스라 yoyo 재생이 맞다" },
    // ── 명중 이펙트
    { id: "burst", x: 208, y: 288, pitch: 16, frames: 4, kind: "impact", dir: null, fps: 20, desc: "구체 -> 불티 링. 소형 명중" },
    { id: "ring", x: 448, y: 224, pitch: 32, frames: 4, kind: "impact", dir: null, fps: 18, desc: "초승달 소용돌이. 대형 폭발" },
    { id: "spin", x: 448, y: 256, pitch: 32, frames: 4, kind: "impact", dir: null, fps: 20, desc: "회전하는 고리. 관통 명중" },
];

/**
 * 실제로 구울 (스트립 x 팔레트) 조합.
 * ★ 8팔레트 x 9스트립 = 72장을 전부 굽지 않는 이유: 매니페스트 항목과 GPU 텍스처가 그만큼 늘어난다.
 *   무기가 늘면 여기에 한 줄 추가하고 다시 돌리면 된다 — 그게 이 표의 존재 이유다.
 */
const BUILDS = [
    ["dart", "fire"],      // W2 화염탄 Lv1~2
    ["spear", "fire"],     // W2 Lv3~5 (관통)
    ["comet", "fire"],     // W2 각성/대형탄
    ["dart", "blood"],     // 혈계 변형 (각성)
    ["burst", "fire"],     // W2 명중
    ["ring", "fire"],      // 폭발(aoe) 명중
    ["spin", "ash"],       // 관통 명중
    ["shuriken", "ash"],   // W3 뼈 회오리
    ["star", "gold"],      // W4 성수
    ["burst", "gold"],     // W4 명중
];

const MAGICK = (() => {
    const candidates = ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"];
    for (const c of candidates) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 후보 */ }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다. 설치 후 PATH에 넣을 것.");
})();

const magick = (args) => execFileSync(MAGICK, args, { stdio: ["ignore", "pipe", "pipe"] });
const ensure = (p) => mkdirSync(p, { recursive: true });
const log = (...a) => console.log("  ", ...a);
const srcFile = (n) => resolve(SRC, "All_Fire_Bullet_Pixel_16x16_0" + n + ".png");

// ── 1. 알파 추출 + 8장이 같은 레이아웃인지 검증 ─────────────────
/** @returns {Buffer} 640x400 알파 1바이트/픽셀 */
function alphaOf(n) {
    const raw = resolve(TMP, "alpha" + n + ".gray");
    magick([srcFile(n), "-alpha", "extract", "-depth", "8", "gray:" + raw]);
    const buf = readFileSync(raw);
    if (buf.length !== SHEET_W * SHEET_H) {
        throw new Error(`_0${n}.png 의 크기가 ${SHEET_W}x${SHEET_H} 이 아니다 (알파 ${buf.length}바이트)`);
    }
    return buf;
}

function verifyPalettes() {
    console.log("[1/5] 원본 검증 — 8장이 같은 레이아웃인가");
    const hashes = [];
    let base = null;
    for (const p of PALETTES) {
        if (!existsSync(srcFile(p.file))) throw new Error("원본 없음: " + srcFile(p.file));
        const a = alphaOf(p.file);
        if (p.file === 0) base = a;
        hashes.push(createHash("sha1").update(a).digest("hex").slice(0, 12));
    }
    const same = hashes.every((h) => h === hashes[0]);
    log("알파 SHA1: " + hashes.join(" "));
    if (!same) {
        // 여기서 멈추는 이유: 레이아웃이 다르면 팔레트별로 좌표를 따로 잡아야 한다.
        // 한 좌표표를 8장에 그대로 쓰면 조용히 엉뚱한 그림이 나온다.
        throw new Error("8장의 알파가 다르다. 팔레트 배리언트 가정이 깨졌으니 좌표표를 다시 잡아라.");
    }
    log("동일 -> 8장은 같은 그림의 팔레트 배리언트다. 좌표표 1벌로 충분하다.");
    return base;
}

// ── 2. 격자 실측 ────────────────────────────────────────────────
/** 전 열/행이 투명인 구간. 원본이 블록으로 나뉘어 있다는 증거를 남긴다 */
function blockReport(a) {
    const emptyCol = [];
    for (let x = 0; x < SHEET_W; x++) {
        let on = false;
        for (let y = 0; y < SHEET_H && !on; y++) if (a[y * SHEET_W + x] > 8) on = true;
        if (!on) emptyCol.push(x);
    }
    const runs = [];
    for (const x of emptyCol) {
        const last = runs[runs.length - 1];
        if (last && last[1] === x - 1) last[1] = x;
        else runs.push([x, x]);
    }
    return runs;
}

/** 셀 하나의 내용 bbox. 비어 있으면 null */
function cellBox(a, cx, cy, w, h) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
            if (a[y * SHEET_W + x] <= 8) continue;
            n++;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    }
    return n ? { x0, y0, x1, y1, n } : null;
}

/**
 * 스트립의 프레임 경계를 실측한다.
 * - 셀이 비어 있으면 실패시킨다 (프레임 수를 잘못 잡았다는 뜻)
 * - 셀 경계를 가로지르는 픽셀은 경고만 한다 (스프라이트가 셀을 꽉 채워 서로 맞닿는 경우가 있다)
 */
function measure(a, s) {
    const boxes = [];
    for (let i = 0; i < s.frames; i++) {
        const b = cellBox(a, s.x + i * s.pitch, s.y, s.pitch, s.pitch);
        if (!b) throw new Error(`스트립 ${s.id}: ${i}번 프레임 셀이 비었다. x=${s.x + i * s.pitch} y=${s.y} pitch=${s.pitch}`);
        boxes.push(b);
    }
    // 스트립 바로 다음 셀이 또 차 있으면 frames 를 덜 잡았을 가능성이 있다 — 알려만 준다
    const next = cellBox(a, s.x + s.frames * s.pitch, s.y, s.pitch, s.pitch);
    // 합집합 bbox: 프레임 간 상대 위치를 보존하는 유일한 창
    const u = {
        x0: Math.min(...boxes.map((b, i) => b.x0 - i * s.pitch)),
        y0: Math.min(...boxes.map((b) => b.y0)),
        x1: Math.max(...boxes.map((b, i) => b.x1 - i * s.pitch)),
        y1: Math.max(...boxes.map((b) => b.y1)),
    };
    const uw = u.x1 - u.x0 + 1;
    const uh = u.y1 - u.y0 + 1;
    // 정사각 셀 + 짝수 — 회전 원점이 정수 좌표에 떨어져야 픽셀이 흔들리지 않는다
    const cell = Math.max(uw, uh) + ((Math.max(uw, uh) & 1) ? 1 : 0);
    return { boxes, union: { x: u.x0, y: u.y0, w: uw, h: uh }, cell, tailBusy: !!next };
}

// ── 3. 굽기 ────────────────────────────────────────────────────
/**
 * 스트립 하나를 정규화 스프라이트시트로 굽는다.
 * 프레임마다 같은 크기의 창(union)을 떼어 정사각 셀 중앙에 놓고 가로로 잇는다.
 */
function bake(strip, m, palette) {
    const key = "proj-" + strip.id + "-" + palette.id;
    const out = resolve(OUT, key + ".png");
    const parts = [];
    for (let i = 0; i < strip.frames; i++) {
        const p = resolve(TMP, key + "-" + i + ".png");
        magick([
            srcFile(palette.file),
            "-crop", `${m.union.w}x${m.union.h}+${m.union.x + i * strip.pitch}+${m.union.y}`,
            "+repage",
            "-background", "none", "-gravity", "center", "-extent", `${m.cell}x${m.cell}`,
            p,
        ]);
        parts.push(p);
    }
    magick([...parts, "-background", "none", "+append", out]);
    for (const p of parts) rmSync(p, { force: true });
    return { key, out, bytes: statSync(out).size };
}

// ── 4. projectiles.json 갱신 ───────────────────────────────────
/**
 * sheets 블록만 스크립트가 소유한다. projectiles / impacts 는 손으로 쓰는 거동 데이터라
 * 있으면 그대로 보존한다 — 스프라이트를 다시 굽는다고 밸런스가 날아가면 안 된다.
 */
function writeData(sheets) {
    let prev = {};
    if (existsSync(DATA)) {
        try { prev = JSON.parse(readFileSync(DATA, "utf8")); }
        catch (e) { throw new Error("기존 projectiles.json 파싱 실패 — 덮어쓰면 거동 데이터를 잃는다: " + e.message); }
    }
    const next = {
        _comment: [
            "투사체 정의. sheets 블록은 tools/build-projectiles.mjs 가 생성한다 — 손으로 고치지 마라.",
            "projectiles / impacts 는 손으로 쓰는 거동 데이터이며 스크립트가 보존한다.",
            "원본 라이선스: BDragon1727 'Fire Pixel Bullet 16x16' — 상업 사용/개조 가능, 재판매·재배포 금지.",
        ],
        schemaVersion: 1,
        sheets,
        projectiles: prev.projectiles ?? [],
        impacts: prev.impacts ?? [],
    };
    writeFileSync(DATA, JSON.stringify(next, null, 4) + "\n", "utf8");
}

// ── 5. 실행 ────────────────────────────────────────────────────
console.log("투사체 파이프라인 시작");
console.log("  원본: " + SRC);
console.log("  산출: " + OUT);
console.log("  도구: " + MAGICK);
console.log("");
ensure(TMP);
ensure(OUT);

const alpha = verifyPalettes();

console.log("");
console.log("[2/5] 격자 실측");
const runs = blockReport(alpha);
log("전열 투명 구간(열): " + runs.map((r) => (r[0] === r[1] ? r[0] : r[0] + "-" + r[1])).join(", "));
log("-> 원본은 균일 격자가 아니라 블록 카탈로그다. 아래 스트립 좌표는 전부 실측값이다.");

const measured = {};
for (const s of STRIPS) {
    const m = measure(alpha, s);
    measured[s.id] = m;
    const bb = m.boxes.map((b, i) => `${b.x0 - s.x - i * s.pitch},${b.y0 - s.y} ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1}`).join(" | ");
    log(`${s.id.padEnd(9)} @(${s.x},${s.y}) pitch${s.pitch} x${s.frames} -> 셀 ${m.cell}x${m.cell}  union ${m.union.w}x${m.union.h}`);
    log(`          프레임 bbox(셀 기준): ${bb}${m.tailBusy ? "  ! 다음 셀도 차 있다(프레임 수 확인)" : ""}`);
}

console.log("");
console.log("[3/5] 굽기");
const sheets = {};
let total = 0;
for (const [stripId, paletteId] of BUILDS) {
    const s = STRIPS.find((v) => v.id === stripId);
    const p = PALETTES.find((v) => v.id === paletteId);
    if (!s || !p) throw new Error("BUILDS 항목이 잘못됐다: " + stripId + "/" + paletteId);
    const m = measured[s.id];
    const r = bake(s, m, p);
    total += r.bytes;
    sheets[r.key] = {
        key: r.key,
        url: "assets/projectile/" + r.key + ".png",
        frameWidth: m.cell,
        frameHeight: m.cell,
        frames: s.frames,
        fps: s.fps,
        kind: s.kind,
        dir: s.dir,
        strip: s.id,
        palette: p.id,
        desc: s.desc,
        src: { file: "All_Fire_Bullet_Pixel_16x16_0" + p.file + ".png", x: s.x, y: s.y, pitch: s.pitch, union: [m.union.x - s.x, m.union.y - s.y, m.union.w, m.union.h] },
    };
    log(`${r.key.padEnd(22)} ${m.cell}x${m.cell} x${s.frames}  ${r.bytes}B`);
}
rmSync(TMP, { recursive: true, force: true });

console.log("");
console.log("[4/5] 미사용 산출물 점검");
const known = new Set(Object.keys(sheets).map((k) => k + ".png"));
for (const f of readdirSync(OUT)) {
    if (f.endsWith(".png") && !known.has(f)) log("! BUILDS 에 없는 파일이 남아 있다: " + f);
}

console.log("");
console.log("[5/5] src/data/projectiles.json 갱신 (sheets 블록만)");
writeData(sheets);
log("sheets " + Object.keys(sheets).length + "종 기록");

console.log("");
console.log("총 " + (total / 1024).toFixed(1) + "KB / " + Object.keys(sheets).length + "장");
console.log("");
console.log("public/assets.json 의 spritesheets 에 붙여 넣을 항목:");
console.log(JSON.stringify(Object.values(sheets).map((s) => ({ key: s.key, url: s.url, frameWidth: s.frameWidth, frameHeight: s.frameHeight })), null, 4));
