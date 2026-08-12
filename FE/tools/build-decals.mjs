/**
 * 바닥 데칼 절차 생성 — 좌판 받침 · 잠긴 좌판 · 조우 마커 · 「피의 제단」 마법진.
 *
 * 정본: docs/33-FLOOR-DECAL-IMAGE-PROMPTS.md   실행: npm run build:decals   (FE/ 에서)
 *
 * ★ 이것은 「임시」가 아니라 「폴백」이다.
 *   docs/33 이 Codex 에 의뢰한 것과 **완전히 같은 격자·같은 칸 순서**로 굽는다.
 *   손그림 시트가 오면 같은 경로에 덮어쓰기만 하면 되고, 코드는 한 줄도 안 바뀐다.
 *   gen-item-icons.mjs 가 아이템 아이콘에 대해 하는 역할과 정확히 같다(29 §9.1).
 *
 * ★ 왜 절차 생성이 여기서는 통하는가
 *   마법진과 원반은 **기하학**이다. 원·고리·등간격 눈금·오각별은 좌표 계산으로 정확히 나온다.
 *   캐릭터 아트와 달리 "손맛"이 필요한 자리가 아니다. 오히려 손으로 그리면 중심이 어긋나
 *   회전할 때 흔들린다(33 §3.4).
 *
 * ★ 무채색으로 굽는다 (33 §5)
 *   모든 화소가 R=G=B 다. 색은 EncounterSystem 이 tint 로 준다 —
 *   등급 5종·룬 등급 3종·잠김·제단이 전부 같은 그림에 색만 다르다.
 *   build-ui.mjs 의 게이지 칩과 같은 규약이다("칩이 흑백인 이유가 그것이다").
 *
 * ★ 형태는 밝기가 아니라 **알파**가 만든다 (33 §5.2)
 *   테두리 알파 230 / 속 알파 70. 지금 코드의 strokeAlpha 0.9 / fillAlpha 0.26 을 그림에 구웠다.
 *   바닥 데칼이 불투명해지면 그 위를 지나는 적과 투사체가 안 보인다.
 *
 * ★ PNG 를 직접 쓴다 — ImageMagick 을 안 쓴다
 *   이 저장소에서 magick -crop 격자 재단에 오프셋이 캔버스 메타로 남는 문제가 있었다
 *   (build-ui.mjs:105 의 +repage 사고). 원형 데칼은 중심이 1px 만 밀려도 회전이 떨리므로
 *   화소를 손으로 놓고 zlib 로 바로 인코딩한다. 외부 의존 0, 결과가 결정적이다.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../public/assets/decal");

// ── 알파 사다리 (33 §5.2) ──────────────────────────────────────────────────
const SHADOW = { v: 0x14, a: 200 };   // 바깥 그림자 테 — 바닥에서 데칼을 떼어 놓는다
const RING = { v: 0xff, a: 230 };   // 테두리 — tint 색이 가장 진하게 나오는 자리
const MARK = { v: 0xff, a: 200 };   // 룬 눈금 · 문양 선
const FILL = { v: 0xff, a: 70 };   // 원반 속 — 옅게 유지한다
const GROOVE = { v: 0x6e, a: 110 };   // 홈 · 균열

// ── PNG 인코더 (zlib 만 쓴다) ──────────────────────────────────────────────
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

/** RGBA 생바이트 -> PNG 버퍼. 필터는 전부 0(None) — 픽셀아트라 예측 필터의 이득이 없다 */
function encodePng(w, h, rgba) {
    const raw = Buffer.alloc(h * (w * 4 + 1));
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;    // bit depth
    ihdr[9] = 6;    // RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

// ── 칸 캔버스와 그리기 도구 ────────────────────────────────────────────────
/**
 * ★ 중심을 (C-1)/2 로 잡는다. 칸 48 이면 23.5, 72 면 35.5 다.
 *   Phaser 의 setOrigin(0.5, 0.5) 회전 원점이 정확히 이 점이고,
 *   여기서 1px 만 어긋나면 고리가 돌 때 흔들린다(33 §3.4 / 검수 V-8).
 */
const cell = (C) => ({ C, c: (C - 1) / 2, buf: Buffer.alloc(C * C * 4) });

/** 화소 하나. 나중에 칠한 것이 이긴다(픽셀아트라 알파 합성을 하지 않는다) */
function px(k, x, y, col) {
    if (x < 0 || y < 0 || x >= k.C || y >= k.C) return;
    const i = (y * k.C + x) * 4;
    k.buf[i] = col.v; k.buf[i + 1] = col.v; k.buf[i + 2] = col.v; k.buf[i + 3] = col.a;
}

/** 칸 전체를 훑으며 조건에 맞는 화소를 칠한다. 48x48 = 2304칸이라 비용이 없다 */
function paint(k, fn) {
    for (let y = 0; y < k.C; y++) {
        for (let x = 0; x < k.C; x++) {
            const dx = x - k.c, dy = y - k.c;
            const col = fn(Math.hypot(dx, dy), Math.atan2(dy, dx), x, y);
            if (col) px(k, x, y, col);
        }
    }
}

const ring = (k, r0, r1, col) => paint(k, (d) => (d >= r0 && d <= r1 ? col : null));
const disc = (k, r, col) => paint(k, (d) => (d <= r ? col : null));

/** 중심에서 뻗는 방사 눈금. a 는 라디안, w 는 호 방향 반폭(px) */
function tick(k, a, r0, r1, w, col) {
    paint(k, (d, th) => {
        if (d < r0 || d > r1) return null;
        let dt = th - a;
        while (dt > Math.PI) dt -= Math.PI * 2;
        while (dt < -Math.PI) dt += Math.PI * 2;
        return Math.abs(dt) * d <= w ? col : null;
    });
}

/** 직선 (Bresenham). 오각별과 균열에 쓴다 */
function line(k, x0, y0, x1, y1, col) {
    let x = Math.round(x0), y = Math.round(y0);
    const ex = Math.round(x1), ey = Math.round(y1);
    const dx = Math.abs(ex - x), dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 512; guard++) {
        px(k, x, y, col);
        if (x === ex && y === ey) return;
        const e2 = err * 2;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
}

const dot = (k, cx, cy, n, col) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px(k, Math.round(cx) + x, Math.round(cy) + y, col);
};

/** 칸을 시트의 col 번째 자리에 붙인다 */
function blit(sheet, W, k, col) {
    for (let y = 0; y < k.C; y++) {
        k.buf.copy(sheet, (y * W + col * k.C) * 4, y * k.C * 4, (y + 1) * k.C * 4);
    }
}

// ── 시트 A — 좌판·마커 (칸 48, 그림 44, 반지름 상한 21.5) ──────────────────
/**
 * ★ 왜 반지름 21.5 인가 (33 §2.1)
 *   좌판 사이 간격이 46px 이다(encounters.json spawn.pedestalGap). 지름이 46 을 넘으면
 *   옆 좌판과 겹친다. 그래서 그림은 44 안, 칸은 여백 2 를 더해 48 이다.
 *   지금 코드의 반지름 16(지름 32)은 그 위에 얹히는 32x32 아이템 아이콘에 통째로 가려진다 —
 *   원반이 초라해 보이는 진짜 이유가 알파가 아니라 이것이었다.
 */
const RA = 21.5;
const TAU = Math.PI * 2;

function pedBase() {
    const k = cell(48);
    disc(k, RA, FILL);
    ring(k, 17.8, 18.8, GROOVE);
    ring(k, 18.8, 20.7, RING);
    ring(k, 20.7, RA, SHADOW);
    for (let i = 0; i < 8; i++) tick(k, (i * TAU) / 8, 15.4, 18.8, 1.1, MARK);
    return k;
}

/**
 * 잠긴 좌판 — ★ 색이 아니라 **형태**로 "못 산다"를 말한다 (30 §5 / 33 §4.1).
 * tint 가 #4a4650(밝기 30%)이라 색으로는 아무것도 못 전한다. 갈라진 금과 빗장은 어두워져도 남는다.
 */
function pedLocked() {
    const k = cell(48);
    disc(k, RA, { v: 0xff, a: 40 });
    ring(k, 17.8, 18.8, { v: 0x6e, a: 90 });
    ring(k, 18.8, 20.7, { v: 0xff, a: 140 });
    ring(k, 20.7, RA, SHADOW);
    for (const i of [0, 1, 3, 4, 6]) tick(k, (i * TAU) / 8, 15.4, 18.8, 1.1, MARK);
    // 균열 2줄
    const crack = { v: 0x14, a: 210 };
    for (const a of [1.05, 3.75]) {
        line(k, k.c, k.c, k.c + Math.cos(a) * 20, k.c + Math.sin(a) * 20, crack);
        line(k, k.c + Math.cos(a) * 9, k.c + Math.sin(a) * 9,
            k.c + Math.cos(a + 0.8) * 19, k.c + Math.sin(a + 0.8) * 19, crack);
    }
    // 빗장 — 원반을 가로지르는 굵은 막대. 실루엣만으로 "잠겼다"가 읽히는 부분이다
    for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
            const d = Math.hypot(x - k.c, y - k.c);
            if (d > RA) continue;
            const dy = Math.abs(y - k.c);
            if (dy <= 1.5) px(k, x, y, { v: 0xff, a: 215 });
            else if (dy <= 2.6) px(k, x, y, { v: 0x14, a: 210 });
        }
    }
    return k;
}

/** 살 수 있는 좌판의 회전 후광. 안쪽은 완전히 비운다 — 원반이 비쳐야 한다 */
function pedHalo() {
    const k = cell(48);
    paint(k, (d, th) => {
        if (d < 20.4 || d > RA) return null;
        return Math.floor(((th + Math.PI) / TAU) * 24) % 2 === 0 ? MARK : null;
    });
    for (let i = 0; i < 12; i++) tick(k, (i * TAU) / 12, 18.2, RA, 0.9, RING);
    return k;
}

/**
 * 필드보스 지점 — ★ 지금 저장소에 **아무 표시도 없다**(33 §2.3).
 * 좌판의 매끈한 원과 한눈에 갈라져야 해서 안쪽으로 뾰족한 이빨 8개를 둔다.
 */
function markBoss() {
    const k = cell(48);
    ring(k, 20.2, RA, RING);
    ring(k, 13.4, 14.4, { v: 0xff, a: 170 });
    paint(k, (d, th) => {
        if (d < 14.4 || d > 20.2) return null;
        const seg = TAU / 8;
        let dt = ((th % seg) + seg) % seg;
        if (dt > seg / 2) dt -= seg;
        return Math.abs(dt) * d <= (d - 14.4) * 0.62 ? { v: 0xff, a: 190 } : null;
    });
    return k;
}

/** 조우 NPC 발밑. 테두리 없이 옅은 웅덩이 하나 — 그림자와 지점 표시를 겸한다 */
function markNpc() {
    const k = cell(48);
    paint(k, (d, th) => {
        const r = 19.4 + Math.sin(th * 3) * 0.45 + Math.sin(th * 7 + 1.2) * 0.3;
        if (d > r) return null;
        return d > r - 2 ? { v: 0x6e, a: 100 } : { v: 0xff, a: 60 };
    });
    return k;
}

// ── 시트 B — 「피의 제단」 (칸 72, 그림 68, 반지름 상한 33.5) ───────────────
/**
 * ★ 반지름 34 는 그림 크기가 아니라 **판정 반지름**이다 (33 §2.2).
 *   encounters.json enc_altar.radius: 34 를 tickAltar() 가 "안에 서 있는가" 판정에 그대로 쓴다.
 *   그림이 그보다 크면 "밟았는데 안 차오른다", 작으면 "밖인데 차오른다"가 된다.
 *   칸 안에서 낼 수 있는 최대 반지름이 33.5 이고(중심 35.5, 안전 영역 2..69), 오차 0.5px 다.
 */
const RB = 33.5;

function altarRing() {
    const k = cell(72);
    ring(k, 31.6, RB, RING);
    ring(k, 31.0, 31.6, SHADOW);
    ring(k, 26.0, 28.0, RING);
    // 룬 12개 — 글자가 아니라 새김 기호다(33 §4.2 / 네거티브의 chinese characters 금지)
    for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        if (i % 3 === 0) {
            tick(k, a, 28.4, 31.0, 1.1, MARK);
        } else if (i % 3 === 1) {
            tick(k, a - 0.055, 28.4, 30.3, 0.8, MARK);
            tick(k, a + 0.055, 28.4, 30.3, 0.8, MARK);
        } else {
            tick(k, a, 29.6, 31.0, 1.7, MARK);
            tick(k, a, 28.4, 29.4, 0.7, MARK);
        }
    }
    return k;
}

/** 안쪽 정지 문양. ★ 안 돈다 — 도는 고리와의 대비가 "마법"으로 읽히는 지점이다 */
function altarSigil() {
    const k = cell(72);
    ring(k, 21.5, 22.4, { v: 0xff, a: 180 });
    const pt = (i) => {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        return [k.c + Math.cos(a) * 21, k.c + Math.sin(a) * 21];
    };
    for (let i = 0; i < 5; i++) {
        const [x0, y0] = pt(i);
        const [x1, y1] = pt((i + 2) % 5);
        line(k, x0, y0, x1, y1, MARK);
    }
    for (let i = 0; i < 5; i++) {
        const [x, y] = pt(i);
        dot(k, x - 0.5, y - 0.5, 2, RING);
        const a = -Math.PI / 2 + 0.6283 + (i * TAU) / 5;
        dot(k, k.c + Math.cos(a) * 8 - 0.5, k.c + Math.sin(a) * 8 - 0.5, 2, RING);
    }
    return k;
}

/**
 * 채널링 차오름. ★ 가장자리가 흐리면 안 된다 —
 * 코드가 이 한 장을 배율 0 -> 1 로 3초에 걸쳐 키우므로 흐린 가장자리는 커지면서 뭉개진다.
 */
function altarFill() {
    const k = cell(72);
    disc(k, RB, FILL);
    for (const r of [11, 20, 28]) ring(k, r - 0.6, r + 0.6, GROOVE);
    ring(k, 32.5, RB, { v: 0xff, a: 130 });
    return k;
}

/** 발동 섬광 4프레임. 16fps · repeat 0 · 총 250ms (33 §4.3) */
function altarFlash(step) {
    const k = cell(72);
    if (step === 0) {
        ring(k, 32.0, RB, { v: 0xff, a: 230 });
    } else if (step === 1) {
        ring(k, 29.6, RB, { v: 0xff, a: 230 });
        for (let i = 0; i < 8; i++) tick(k, (i * TAU) / 8, 12, 29.6, 1.0, { v: 0xff, a: 200 });
    } else if (step === 2) {
        ring(k, 32.6, RB, { v: 0xff, a: 120 });
        for (let i = 0; i < 8; i++) tick(k, (i * TAU) / 8, 3, 32.6, 0.9, { v: 0xff, a: 160 });
        disc(k, 4, { v: 0xff, a: 230 });
    } else {
        const frag = [[0.3, 9], [1.1, 26], [1.9, 15], [2.7, 30], [3.5, 11], [4.3, 24], [5.1, 19], [5.9, 29]];
        for (const [a, r] of frag) {
            dot(k, k.c + Math.cos(a) * r - 0.5, k.c + Math.sin(a) * r - 0.5, r > 20 ? 2 : 1, { v: 0xff, a: 90 });
        }
    }
    return k;
}

// ── 자기 검증 — docs/33 §8 의 V-4 · V-6 · V-8 · V-9 를 굽는 즉시 돌린다 ────
/**
 * ★ 받은 그림을 검사하는 규칙으로 **내가 구운 그림을 먼저 검사한다.**
 *   여기서 통과하지 못하는 절차 생성본을 내보내면, 나중에 Codex 시트를 반려할 명분이 없다.
 */
function verify(name, sheet, W, C, empty, spin) {
    const A = (x, y) => sheet[(y * W + x) * 4 + 3];
    const fail = [];
    let hue = 0;
    for (let y = 0; y < C; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (sheet[i + 3] && (sheet[i] !== sheet[i + 1] || sheet[i + 1] !== sheet[i + 2])) hue++;
        }
    }
    if (hue) fail.push(`V-6 무채색 위반 ${hue}개`);

    for (let c = 0; c < W / C; c++) {
        const ox = c * C;
        let leak = 0, x0 = C, y0 = C, x1 = -1, y1 = -1, n = 0;
        for (let y = 0; y < C; y++) {
            for (let x = 0; x < C; x++) {
                if (!A(ox + x, y)) continue;
                n++;
                if (x < 2 || y < 2 || x >= C - 2 || y >= C - 2) leak++;
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
        }
        if (leak) fail.push(`V-4 칸 ${c}: 여백 침범 ${leak}개`);
        if (empty.includes(c)) { if (n) fail.push(`V-5 칸 ${c}: 비어야 한다`); continue; }
        if (!n) { fail.push(`칸 ${c}: 비었다`); continue; }
        if (spin.includes(c) && (x0 !== C - 1 - x1 || y0 !== C - 1 - y1)) {
            fail.push(`V-8 칸 ${c}: 중심 어긋남 (좌${x0} 우${C - 1 - x1} 상${y0} 하${C - 1 - y1})`);
        }
    }
    // V-9 반경 프로파일 — 회전하는 마법진 고리만
    if (C === 72) {
        let min = 99, max = 0;
        for (let deg = 0; deg < 360; deg++) {
            const a = (deg * Math.PI) / 180;
            let hit = 0;
            for (let r = 34; r >= 1; r -= 0.5) {
                const x = Math.round(35.5 + Math.cos(a) * r), y = Math.round(35.5 + Math.sin(a) * r);
                if (x < 0 || y < 0 || x >= C || y >= C) continue;
                if (A(x, y)) { hit = r; break; }
            }
            if (hit < min) min = hit;
            if (hit > max) max = hit;
        }
        // ★ 하한이 32.5 인 이유: 광선 표본이 Math.round 로 화소에 붙으므로 대각선 방향에서
        //   최대 0.7px 바깥을 짚어 한 칸을 흘린다. 칸 안에서 낼 수 있는 최대 반지름 자체가
        //   33.5 다(중심 35.5, 안전 영역 2..69). 그래서 판정 창은 32.5~35 다.
        if (min < 32.5 || max > 35) fail.push(`V-9 최외곽 반경 ${min}~${max} (32.5~35)`);
        else console.log(`   V-9 통과 — 최외곽 반경 ${min}~${max}`);
    }
    if (fail.length) throw new Error(`${name} 검증 실패:\n  ` + fail.join("\n  "));
    console.log(`   검증 통과 — V-4 여백 0 · V-6 무채색 · V-8 중심 정렬`);
}

// ── 굽기 ───────────────────────────────────────────────────────────────────
/** ★ 칸 순서는 docs/33 §4 매니페스트가 절대 기준이다. 바꾸면 프레임 인덱스가 전부 밀린다 */
const SHEET_A = [pedBase, pedLocked, pedHalo, markBoss, markNpc, null];
const SHEET_B = [
    altarRing, altarSigil, altarFill,
    () => altarFlash(0), () => altarFlash(1), () => altarFlash(2), () => altarFlash(3),
    null,
];

function bake(name, frames, C) {
    const W = frames.length * C;
    const sheet = Buffer.alloc(W * C * 4);
    frames.forEach((f, i) => { if (f) blit(sheet, W, f(), i); });
    return { name, sheet, W, C };
}

mkdirSync(OUT, { recursive: true });
const jobs = [
    { ...bake("enc-decal-48", SHEET_A, 48), empty: [5], spin: [2, 3] },
    { ...bake("enc-decal-72", SHEET_B, 72), empty: [7], spin: [0] },
];
/**
 * ★ 덮어쓰기 가드 — 사람이 넣은 그림을 스크립트가 지우지 못하게 한다.
 *
 * ⚠ 사고 이력(2026-08-12): 사용자가 docs/33 의뢰서로 받은 Codex 데칼 2장을 바로 이 산출
 *   경로에 넣어 두었는데, 이 스크립트를 다시 돌려 **두 번 덮어썼다.** dist/ 에 사본이
 *   남아 있어 복구했지만 그것은 운이었다. build-items.mjs 가 큐레이션 아이콘을 덮어썼던
 *   커밋 131d554 와 같은 사고이고, 그때 넣은 가드를 여기에도 넣는다.
 *
 * ★ 채널(srgba/graya)로 판정하지 않는다 — 규약이 바뀌면 조용히 뚫린다.
 *   **내용이 다른 파일이 이미 있으면 무조건 건너뛴다.** 다시 굽고 싶으면 사람이 먼저 지운다.
 *   절차 생성본은 "아트가 없을 때의 폴백"이지 "정답"이 아니다(33 §0.3).
 * @returns {boolean} 실제로 썼으면 true
 */
function writeGuarded(file, buf, name) {
    if (existsSync(file)) {
        if (readFileSync(file).equals(buf)) {
            console.log("   = 내용이 같다. 그대로 둔다");
            return false;
        }
        console.log("   ⚠ 건너뜀 — " + name + " 이 이미 있고 내용이 다르다.");
        console.log("      사람이 넣은 그림(Codex 수령본)일 수 있다. 다시 구우려면 그 파일을 먼저 지워라.");
        return false;
    }
    writeFileSync(file, buf);
    return true;
}

for (const j of jobs) {
    console.log(`[${j.name}] ${j.W}x${j.C} · ${j.W / j.C}칸`);
    verify(j.name, j.sheet, j.W, j.C, j.empty, j.spin);
    const file = resolve(OUT, j.name + ".png");
    if (writeGuarded(file, encodePng(j.W, j.C, j.sheet), j.name + ".png")) console.log("   -> " + file);
}
console.log("\n★ 매니페스트 등록은 public/assets.json 만 고친다. PreloadScene.js 는 건드리지 않는다.");
