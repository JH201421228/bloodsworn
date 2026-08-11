/**
 * UI 아트 파이프라인 — store/_raw/ 원본에서 FE/public/img/ 의 UI 조각을 다시 굽고,
 * 그중 "Phaser 캔버스가 그리는 것"만 골라 HUD 아틀라스 1장으로 묶는다.
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md 4(가공 파이프라인) / 10-UIUX-LANDSCAPE.md 4·5.2
 * 실행: npm run build:ui   (FE/ 에서)
 *
 * ★ 왜 이 스크립트가 새로 필요한가 — 기존 산출물 3개가 규격을 벗어나 있었다.
 *   1) bar-hp-frame.png  : 캔버스는 120x12 인데 실제 그림은 81x12 뿐이고 나머지 39px 가 투명이다.
 *                          그대로 쓰면 HP 바가 왼쪽 19px 이 빈 채로 그려진다.
 *   2) bar-exp-frame.png : 같은 사고. 200x8 중 53x8 만 그림이다.
 *   3) seal-ascension.png: 192x192. 원본이 1024 이므로 1024/192 = 5.33 배 — 정수배가 아니다.
 *                          나머지 인장 6종은 전부 128(=1024/8) 이다. 혼자만 크고 혼자만 뭉개져 있었다.
 *
 * ★ 축소 필터 규약(build-icons.mjs 와 동일)
 *   축소는 Lanczos, 확대는 Point. 픽셀아트라고 축소까지 최근접으로 하면 1px 디테일이
 *   통째로 사라져 오히려 뭉갠 것처럼 보인다. 여기서는 전부 축소이므로 Lanczos 만 쓴다.
 *
 * ★ 바 프레임을 "쓸 크기 그대로" 굽지 않는 이유
 *   HP 120px / EXP 640px / 보스 400px 는 길이가 제각각인데 프레임의 양끝 브래킷은
 *   늘어나면 안 된다. 그래서 자연 비율(원본 601x89)로만 굽고, 길이는 Phaser NineSlice 가
 *   가운데 레일만 늘려서 맞춘다. 브래킷 폭을 CAP 상수로 함께 내보낸다.
 *
 * ★ 게이지 "채움"용 칩 2장(bar-fill / px)을 여기서 함께 굽는다.
 *   HudScene 이 채움을 Graphics.fillRect 로 그리면 그 순간 배치가 끊긴다 —
 *   Graphics 는 아틀라스 쿼드 사이에 끼어들어 앞뒤 배치를 둘로 쪼갠다.
 *   채움을 아틀라스 안의 작은 칩으로 바꾸고 길이는 displayWidth, 색은 tint 로 주면
 *   프레임·조이스틱·대시 버튼과 같은 배치에 들어간다.
 *   칩이 흑백인 이유가 그것이다 — 색은 코드가 tint 로 정한다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const RAW = resolve(ROOT, "store/_raw");
const IMG = resolve(FE, "public/img");

const MAGICK = (() => {
    const candidates = [
        "magick",
        "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe",
        "/usr/bin/magick",
        "/opt/homebrew/bin/magick",
    ];
    for (const c of candidates) {
        try {
            execFileSync(c, ["-version"], { stdio: "ignore" });
            return c;
        } catch {
            /* 다음 후보 */
        }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다. 설치 후 PATH에 넣을 것.");
})();

const run = (args) => execFileSync(MAGICK, args, { stdio: ["ignore", "pipe", "pipe"] });
const ensure = (p) => mkdirSync(p, { recursive: true });
const src = (n) => {
    const p = resolve(RAW, n);
    if (!existsSync(p)) throw new Error(`원본이 없다: ${p}`);
    return p;
};
/** PNG 헤더만 읽는다. identify 를 매번 부르는 것보다 빠르다. */
const png = (p) => {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const made = [];
const note = (p, why) => {
    const i = png(p);
    made.push(`${p.replace(FE + "\\", "").replace(FE + "/", "").split("\\").join("/")}  ${i.w}x${i.h}  ${why}`);
};

// ── 1. UI 시트에서 다시 자르는 조각 ────────────────────────────────────────
// crop 은 store/_raw/ui-sheet-1536x1024.png 위의 실제 불투명 bbox 다(-trim 으로 실측).
// out 크기는 자연 비율을 유지한 값이다. 비율을 어기면 브래킷이 찌그러진다.
// ★ 높이를 왜 8 이 아니라 10 으로 잡는가 — 원본 바의 세로 단면은 [레일20 / 빈속40 / 레일20] 이다.
// 89px 를 8px 로 줄이면 Lanczos 가 레일을 번지게 해 빈 속이 2px 밖에 남지 않는다(채움이 안 보인다).
// 10px 이면 4px 이 남아 정본 10-UIUX 4.1 H6 의 "EXP 640x4" 를 프레임 안에 그대로 담을 수 있다.
const SHEET_CUTS = [
    {
        out: "ui/bar-hp-frame.png",
        crop: "601x89+829+377",
        size: "108x16",
        why: "HP 바 프레임. NineSlice 로 120px 까지 늘려 쓴다",
    },
    {
        out: "ui/bar-exp-frame.png",
        crop: "601x91+829+514",
        size: "66x10",
        why: "EXP·보스 바 프레임. NineSlice 로 640px·400px 까지 늘려 쓴다",
    },
];

function buildSheetCuts() {
    console.log("[1/5] UI 시트 재단");
    const sheet = src("ui-sheet-1536x1024.png");
    for (const c of SHEET_CUTS) {
        const out = resolve(IMG, c.out);
        ensure(dirname(out));
        // +repage 를 빠뜨리면 crop 오프셋이 캔버스 메타로 남아 다시 투명 여백이 생긴다.
        // 이번 사고(120x12 중 81x12만 그림)의 원인이 정확히 이것이다.
        run([sheet, "-crop", c.crop, "+repage", "-filter", "Lanczos", "-resize", c.size + "!", "-strip", out]);
        note(out, c.why);
    }
}

// ── 2. 낱장 원본에서 다시 뽑는 조각 ────────────────────────────────────────
/**
 * ★ store/_raw 의 파일명에 적힌 숫자를 믿지 마라. 전부 틀렸다.
 *   seal-ascension-1024.png 은 실제로 1254x1254, nocturne-768x960.png 은 1122x1402,
 *   joystick-knob-352.png 은 1254x1254 다. 즉 이 원본들은 "정수배 축소" 자체가 불가능하다.
 *   인장이 혼자 192x192 로 남아 있던 것도 파일명(1024)을 믿고 1024/5.33 을 계산한 결과다.
 *   그래서 여기서 지키는 규약은 정수배가 아니라 다음 둘이다.
 *     (1) 목표 크기는 원본이 아니라 게임 규격에서 온다 — 인장 128, 노브 32, 초상 48x60.
 *     (2) 원본 종횡비를 1% 넘게 어기지 않는다. 어기면 스크립트가 멈춘다(찌그러진 채 커밋 방지).
 */
const RESIZED = [
    {
        out: "seal/seal-ascension.png",
        from: "seal-ascension-1024.png",
        size: [128, 128],
        why: "192x192 사고 복구. 나머지 인장 6종과 같은 128",
    },
    {
        out: "ui/joystick-knob.png",
        from: "joystick-knob-352.png",
        size: [32, 32],
        why: "노브는 작게(10-UIUX 5.2 원칙2). 베이스 96 대비 1:3",
    },
    {
        out: "portrait/nocturne-sm.png",
        from: "nocturne-768x960.png",
        size: [48, 60],
        why: "PACT 좌측 초상. 카드1(x=64)을 침범하지 않는 최대 크기",
    },
];

function buildResized() {
    console.log("[2/5] 낱장 축소");
    for (const e of RESIZED) {
        const from = src(e.from);
        const i = png(from);
        const [w, h] = e.size;
        const drift = Math.abs(w / h / (i.w / i.h) - 1);
        if (drift > 0.01) {
            throw new Error(
                `${e.from}(${i.w}x${i.h}) 를 ${w}x${h} 로 줄이면 종횡비가 ${(drift * 100).toFixed(1)}% 어긋난다`
            );
        }
        const out = resolve(IMG, e.out);
        ensure(dirname(out));
        run([from, "-filter", "Lanczos", "-resize", `${w}x${h}!`, "-strip", out]);
        note(out, `${i.w}x${i.h} → ${w}x${h} · ${e.why}`);
    }
}

// ── 3. 게이지 칩 ───────────────────────────────────────────────────────────
/**
 * ★ 왜 흑백 8x8 / 4x4 인가
 *   bar-fill 은 세로 그라디언트다. 게이지의 "속이 빛나는" 단면을 1장으로 만들고,
 *   HP(빨강)·EXP(청록)·보스(핏빛)는 같은 칩에 tint 만 달리 걸어 쓴다.
 *   px 는 완전 단색이다 — 트랙 바닥과 보스 페이즈 눈금처럼 그라디언트가
 *   오히려 방해되는 2px 폭 요소에 쓴다.
 * ★ 세로만 8px 인 이유: 게이지 높이는 4(EXP)~10(HP)px 이라 8행이면 충분하고,
 *   가로는 늘려 쓰므로 폭이 클 이유가 없다(아틀라스 자리 낭비).
 */
const CHIPS = [
    {
        out: "ui/bar-fill.png",
        args: ["-size", "8x8", "gradient:#ffffff-#5e5e5e"],
        why: "게이지 채움 칩. tint 로 색을 입힌다",
    },
    {
        out: "ui/px.png",
        args: ["-size", "4x4", "xc:#ffffff"],
        why: "단색 칩. 트랙 바닥 / 보스 페이즈 눈금",
    },
];

function buildChips() {
    console.log("[3/5] 게이지 칩");
    for (const c of CHIPS) {
        const out = resolve(IMG, c.out);
        ensure(dirname(out));
        run([...c.args, "-strip", out]);
        note(out, c.why);
    }
}

// ── 4. HUD 아틀라스 ────────────────────────────────────────────────────────
/**
 * ★ 왜 아틀라스인가
 *   HudScene 은 매 프레임 조이스틱 2장 + 바 프레임 3개 + 대시 버튼 + 게이지 채움 5개를 그린다.
 *   각각이 별도 텍스처면 Phaser MultiPipeline 의 텍스처 유닛(실측 16칸)을 그만큼 잡아먹고,
 *   17번째 텍스처가 필요해지는 순간 배치가 강제로 flush 된다. 한 장으로 묶으면
 *   HUD 전체가 유닛 1칸만 쓰고 전부 한 배치에 들어간다.
 *   DOM(React)이 그리는 배경·카드·인장은 여기에 넣지 않는다 — GPU 에 올릴 이유가 없다.
 *
 * ★ 2px 간격을 두는 이유: NineSlice 는 가운데를 비정수 배율로 늘리므로
 *   프레임 경계에서 옆 칸 픽셀을 한 줄 물어올 수 있다(텍스처 블리딩).
 */
const ATLAS_W = 256;
const ATLAS_H = 160;
const ATLAS_PLACE = [
    { key: "joy-base", file: "ui/joystick-base.png", x: 2, y: 2 },
    { key: "joy-knob", file: "ui/joystick-knob.png", x: 102, y: 2 },
    { key: "bar-hp", file: "ui/bar-hp-frame.png", x: 102, y: 38 },
    { key: "bar-exp", file: "ui/bar-exp-frame.png", x: 102, y: 58 },
    // ★ 대시 버튼 — 여태 아트가 없어 HudScene 이 도형(fillCircle)으로 그리던 유일한 조작계다.
    //   btn-normal/btn-pressed 는 React 버튼이 CSS border-image 로 쓰던 것과 같은 파일이다.
    //   같은 그림을 캔버스가 쓰려면 GPU 텍스처가 필요하므로 여기 아틀라스에 넣는다.
    { key: "btn-normal", file: "ui/btn-normal.png", x: 102, y: 72 },
    { key: "btn-pressed", file: "ui/btn-pressed.png", x: 102, y: 104 },
    { key: "bar-fill", file: "ui/bar-fill.png", x: 2, y: 102 },
    { key: "px", file: "ui/px.png", x: 14, y: 102 },
];

function buildAtlas() {
    console.log("[4/5] HUD 아틀라스");
    const outPng = resolve(IMG, "ui/hud-atlas.png");
    const outJson = resolve(IMG, "ui/hud-atlas.json");

    const args = ["-size", `${ATLAS_W}x${ATLAS_H}`, "xc:none"];
    const frames = {};
    for (const p of ATLAS_PLACE) {
        const f = resolve(IMG, p.file);
        const i = png(f);
        if (p.x + i.w > ATLAS_W || p.y + i.h > ATLAS_H) {
            throw new Error(`${p.key} 가 아틀라스 밖으로 나간다 (${p.x}+${i.w}, ${p.y}+${i.h})`);
        }
        args.push(f, "-geometry", `+${p.x}+${p.y}`, "-composite");
        frames[p.key] = {
            frame: { x: p.x, y: p.y, w: i.w, h: i.h },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: i.w, h: i.h },
            sourceSize: { w: i.w, h: i.h },
        };
    }
    args.push("-strip", outPng);
    run(args);

    // Phaser 는 JSON Hash / JSON Array 를 자동 판별한다. Hash 가 사람이 읽기 쉽다.
    writeFileSync(
        outJson,
        JSON.stringify(
            {
                frames,
                meta: {
                    app: "FE/tools/build-ui.mjs",
                    image: "hud-atlas.png",
                    format: "RGBA8888",
                    size: { w: ATLAS_W, h: ATLAS_H },
                    scale: "1",
                    note: "손으로 고치지 말 것. npm run build:ui 로 다시 굽는다.",
                },
            },
            null,
            2
        ) + "\n"
    );
    note(outPng, `프레임 ${Object.keys(frames).length}개`);
}

// ── 4. NineSlice 브래킷 폭 실측 ────────────────────────────────────────────
/**
 * 바 프레임의 양끝 브래킷이 몇 px 인지 알아야 HudScene 이 NineSlice 캡을 정할 수 있다.
 * 눈대중으로 적으면 늘였을 때 브래킷이 같이 늘어나거나 잘린다. 여기서 실측해 출력한다.
 * (상수는 HudScene 에 박아 둔다 — 매 프레임 도는 코드가 JSON 을 파싱할 이유는 없다.)
 */
function measureCaps() {
    console.log("[5/5] NineSlice 캡 실측");
    for (const name of ["bar-hp-frame", "bar-exp-frame"]) {
        const f = resolve(IMG, `ui/${name}.png`);
        const { w, h } = png(f);
        const txt = run([f, "-depth", "8", "txt:-"]).toString();
        const opaque = Array.from({ length: w }, () => 0);
        for (const line of txt.split("\n")) {
            const m = line.match(/^(\d+),(\d+):\s*\((\d+),(\d+),(\d+),(\d+)\)/);
            if (m && +m[6] > 40) opaque[+m[1]]++;
        }
        // 브래킷 = 세로로 꽉 찬 열. 가운데 레일은 위아래 2줄뿐이라 확연히 구분된다.
        const railMax = Math.min(...opaque.slice(Math.floor(w / 2) - 2, Math.floor(w / 2) + 2));
        let left = 0;
        while (left < w && opaque[left] > railMax) left++;
        let right = 0;
        while (right < w && opaque[w - 1 - right] > railMax) right++;
        console.log(`   ${name} ${w}x${h} → 캡 좌 ${left} / 우 ${right} (레일 두께 ${railMax})`);
    }
}

buildSheetCuts();
buildResized();
buildChips();
buildAtlas();
measureCaps();
console.log("\n생성:");
for (const m of made) console.log("  " + m);
