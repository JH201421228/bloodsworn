/**
 * NPC 파이프라인 — asset/npcs/Lively_NPCs_v3.1 의 프레임 크기가 제각각인 시트 6장을
 * 단일 균일 격자 스프라이트시트로 다시 굽고, 종별 메타(npc-catalog.json)를 함께 생성한다.
 *
 * 근거: 30-ENCOUNTERS-AND-FIELD-EVENTS 3(조우 7종) 7.1(NPC 아트) / 09-ART-AUDIO-AND-ASSET-MAP 2
 * 실행: node tools/build-npcs.mjs   (FE/ 에서, npm run build:npcs)
 * 산출: public/assets/npc/npcs.png · src/data/npc-catalog.json
 *
 * 라이선스: chierit "Lively NPCs" (CC BY 4.0) — 크레딧 표기가 **의무**다.
 *   https://chierit.itch.io/lively-npcs · 17-LICENSES-AND-CREDITS 1 (12) / LC-06 참고.
 *
 * ★ 이 스크립트가 푸는 문제 — 원본이 균일 격자가 아니다
 *   Phaser 의 spritesheet 로더는 frameWidth/frameHeight 가 시트 전체에 일정할 때만 쓴다.
 *   그런데 원본 6장은 프레임 크기가 32x32 와 34x34 로 섞여 있고, 프레임 수도 4/5/6 으로 다르다.
 *     merchant 160x32(5x32) · witch 170x34(5x34) · seer 204x34(6x34)
 *     shady_guy 170x34(5x34) · elder 128x32(4x32) · trader 128x32(4x32)
 *   개별 spritesheet 6개로 로드하면 로더 항목 6개 + GL 텍스처 6개 + 드로우콜 분기가 생긴다.
 *   조우는 화면에 동시에 1~2개뿐이라 드로우콜은 사소하지만, **애니 등록과 카탈로그가 6갈래로
 *   갈라지는 것**이 더 비싸다. 한 장으로 구우면 registerAnims 가 카탈로그 한 벌만 루프하면 된다.
 *
 * ★ 왜 바닥 정렬(gravity south)인가 — 이 스크립트에서 가장 중요한 한 줄
 *   몸통 실측(알파 bbox 합집합)은 elder 20x24, witch 26x32 처럼 **키가 8px 이나 차이난다.**
 *   같은 40x40 셀에 가운데 정렬로 넣으면 키 작은 elder 는 발밑에 4px 공백이 생겨
 *   **공중에 떠 보인다.** 바닥을 셀 아래 변에 붙이면 6종이 같은 바닥선에 선다.
 *   → 이 시트를 쓰는 쪽은 setOrigin(0.5, 1) 을 쓰면 스프라이트 y 가 곧 발이 닿는 지점이 된다.
 *   (같은 이유로 build-assets.mjs:203 이 불꽃에 gravity south 를 쓴다. 몬스터 아틀라스가
 *    gravity center 인 것은 16x16 셀에 몸통이 꽉 차서 바닥 여백이 애초에 없기 때문이다.)
 *
 * ★ 왜 프레임별이 아니라 종 단위로 잘라내는가
 *   프레임마다 bbox 를 재서 각각 정렬하면 대기 애니의 상하 호흡이 통째로 지워져 정지 화면이 된다.
 *   그래서 프레임 전체의 합집합 bbox 로 한 번만 잘라 **같은 오프셋을 모든 프레임에 먹인다.**
 *   build-monsters.mjs 가 같은 이유로 같은 방식을 쓴다(거기 주석 참고).
 *
 * ★ 왜 셀 40x40 인가 — 실측에서 나온 값이다
 *   6종의 합집합 bbox 최대치는 폭 28(merchant), 높이 32(witch)다. 원본 캔버스는 최대 34x34.
 *   36 이면 딱 맞지만 여유가 2px 뿐이라, 나중에 같은 팩의 다른 종(49장 중 43장이 놀고 있다)을
 *   추가할 때 셀을 바꾸게 되고 그러면 프레임 인덱스가 전부 밀린다. 40 은 34x34 캔버스를
 *   통째로 넣고도 3px 씩 남아 **팩 안의 어떤 종을 추가해도 셀을 다시 잡을 일이 없다.**
 *   확대/축소를 전혀 하지 않는다는 것도 40 의 조건이다 — 픽셀아트를 비정수배로 줄이면 뭉갠다.
 *
 * ★ 왜 한 행 = 한 종(열 수 = 최대 프레임 수)인가
 *   프레임 수가 4~6 으로 다르므로 빽빽이 채우면 종이 행 경계를 넘나들어 시트를 눈으로 볼 때
 *   어느 칸이 누구인지 읽을 수 없다. 열 수를 "가장 프레임이 많은 종"(현재 seer 의 6)에 맞추면
 *   **한 행이 정확히 한 종**이 되고 frameStart = 종 인덱스 x 열수 로 떨어진다.
 *   낭비는 36칸 중 7칸(19%)이고 시트가 240x240(0.22MB VRAM)이라 절대량이 무의미하다.
 *   빽빽이 채워 320x160 으로 줄여도 아끼는 것은 0.07MB 다 — 읽을 수 없게 만들 값이 아니다.
 *
 * ★ 왜 fps 6 인가
 *   제작자가 배포 페이지에 "recommended setting of 6 fps" 라고 적어 두었다. 원본이 그 속도로
 *   그려졌다는 뜻이다. 30-ENCOUNTERS 는 "상인이 빠르게 씰룩거리면 이상하다"고만 요구하는데
 *   그 요구와 제작자 권장이 같은 값을 가리키므로 유도식을 만들 이유가 없다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SRC = resolve(ROOT, "asset/npcs/Lively_NPCs_v3.1/sprite sheets");
const OUT_TEX = resolve(FE, "public/assets/npc");
const OUT_DATA = resolve(FE, "src/data");

/** 셀 한 칸. 위 주석 "왜 40x40 인가" 참고 — 실측 최대 몸통 28x32 + 원본 캔버스 34x34 를 모두 담는다 */
const CELL = 40;
/** 제작자 권장 fps. 대기 애니 하나뿐이라 종별로 다르게 줄 이유가 없다 */
const FPS = 6;
/** 텍스처 키. assets.json 의 spritesheets 항목 key 와 반드시 같아야 한다 */
const TEXTURE = "npcs";

const MAGICK = (() => {
    const candidates = [
        "magick",
        "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe",
        "/usr/bin/magick",
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
const magick = (args) => execFileSync(MAGICK, args, { stdio: ["ignore", "pipe", "pipe"] });
const ensure = (p) => mkdirSync(p, { recursive: true });
const log = (...a) => console.log("  ", ...a);

// ── 1. 배역 정의 ────────────────────────────────────────────
/**
 * id 는 30-ENCOUNTERS 3 의 "스프라이트" 열을 그대로 쓴다. 조우 정의(encounters.json)가
 * 스프라이트 이름을 적을 때 변환표를 한 번 더 거치지 않게 하기 위한 것이다.
 * 순서가 곧 프레임 배치 순서이므로 **중간에 끼워 넣지 말고 뒤에 붙인다** — 끼우면 인덱스가 밀린다.
 */
const NPCS = [
    { id: "merchant", nameKo: "떠돌이 상인", role: "merchant", encounter: "enc_merchant", file: "medieval/merchant.png" },
    { id: "witch", nameKo: "재의 마녀", role: "witch", encounter: "enc_witch", file: "medieval/witch.png" },
    { id: "seer", nameKo: "눈먼 예언자", role: "seer", encounter: "enc_seer", file: "medieval/seer.png" },
    { id: "shady_guy", nameKo: "수상한 자", role: "shady", encounter: "enc_shady", file: "medieval/shady_guy.png" },
    { id: "elder", nameKo: "노인", role: "spare", encounter: null, file: "medieval/elder.png" },
    { id: "trader", nameKo: "장사꾼", role: "spare", encounter: null, file: "steampunk/trader.png" },
];

// ── 2. 실측 ─────────────────────────────────────────────────
const sizeOf = (p) => magick([p, "-format", "%wx%h", "info:"]).toString().trim();

/**
 * 프레임별 알파 바운딩박스를 magick 한 번으로 뽑는다.
 * -crop WxH (오프셋 없음) 는 이미지를 타일로 쪼개고, 뒤 연산은 시퀀스 전체에 적용된다.
 * -alpha extract 로 알파를 회색조로 꺼낸 뒤 -threshold 0 이면 불투명 픽셀만 흰색이 된다.
 * %@ 는 그 상태의 트림 bbox — 원본을 건드리지 않고 좌표만 얻는다.
 *
 * ⚠ 이 타일링이 4장만 내놓는다는 보고가 있었으나 ImageMagick 7.1.2-29 에서 5프레임·6프레임 모두
 *   정확히 나오는 것을 확인했다(merchant 5줄 / seer 6줄). 그래도 아래에서 줄 수를 세어 검증한다.
 */
function measure(png, fw, fh, expect) {
    const out = magick([png, "-crop", `${fw}x${fh}`, "+repage", "-alpha", "extract",
        "-threshold", "0", "-format", "%@\n", "info:"]).toString();
    const boxes = [];
    for (const line of out.split("\n")) {
        const m = /^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/.exec(line.trim());
        if (!m) continue;
        const [w, h, x, y] = [+m[1], +m[2], +m[3], +m[4]];
        // 완전히 빈 프레임은 0x0 이 된다. 캔버스 전체로 폴백해야 합집합이 어긋나지 않는다
        boxes.push(w > 0 && h > 0 ? { w, h, x, y } : { w: fw, h: fh, x: 0, y: 0 });
    }
    if (boxes.length !== expect) {
        throw new Error(`${png}: 프레임 타일이 ${expect}장이어야 하는데 ${boxes.length}장 나왔다. `
            + "ImageMagick 의 -crop 타일링을 신뢰할 수 없다 — Node 로 직접 자르도록 고칠 것.");
    }
    // 중앙값 = 몸통. 합집합은 팔을 뻗은 한 프레임 때문에 부풀고, 최소값은 웅크린 프레임 때문에 쪼그라든다
    const mid = (arr) => arr.slice().sort((a, b) => a - b)[(arr.length - 1) >> 1];
    const bodyW = mid(boxes.map((b) => b.w));
    const bodyH = mid(boxes.map((b) => b.h));
    // 합집합 = 잘라내기용. 어느 프레임도 잘리지 않는 최소 사각형
    const ux = Math.min(...boxes.map((b) => b.x));
    const uy = Math.min(...boxes.map((b) => b.y));
    const uw = Math.max(...boxes.map((b) => b.x + b.w)) - ux;
    const uh = Math.max(...boxes.map((b) => b.y + b.h)) - uy;
    return { boxes, bodyW, bodyH, union: { x: ux, y: uy, w: uw, h: uh } };
}

// ── 3. 원본 읽기 ────────────────────────────────────────────
console.log("NPC 파이프라인 시작");
console.log("  원본: " + SRC);
console.log("  도구: " + MAGICK);

for (const npc of NPCS) {
    const png = resolve(SRC, npc.file);
    if (!existsSync(png)) throw new Error(`원본이 없다: ${png}`);
    const [w, h] = sizeOf(png).split("x").map(Number);
    // 이 팩은 가로 1행 스트립이고 프레임이 정사각이다. 프레임 수 = 폭 / 높이 로 유도한다.
    // 나누어떨어지지 않으면 가정이 깨진 것이므로 조용히 넘기지 않고 던진다.
    if (w % h !== 0) throw new Error(`${npc.file}: ${w}x${h} — 폭이 높이로 나누어떨어지지 않는다`);
    const frameCount = w / h;
    const m = measure(png, h, h, frameCount);
    if (m.union.w > CELL || m.union.h > CELL) {
        throw new Error(`${npc.file}: 몸통 ${m.union.w}x${m.union.h} 가 ${CELL}px 셀보다 크다. CELL 을 키울 것.`);
    }
    Object.assign(npc, {
        png, srcW: w, srcH: h, frameW: h, frameH: h, frameCount,
        bodyW: m.bodyW, bodyH: m.bodyH, union: m.union,
    });
    log(`${npc.id.padEnd(10)} ${String(w + "x" + h).padStart(7)} · ${frameCount}프레임(${h}x${h})`
        + ` · 몸통 ${m.bodyW}x${m.bodyH} · 합집합 ${m.union.w}x${m.union.h}+${m.union.x}+${m.union.y}`);
}

/** 열 수 = 가장 프레임이 많은 종. 한 행이 정확히 한 종이 된다 */
const COLS = Math.max(...NPCS.map((n) => n.frameCount));
const ROWS = NPCS.length;

// ── 4. 굽기 ─────────────────────────────────────────────────
ensure(OUT_TEX);
const tmp = resolve(OUT_TEX, "_tmp");
rmSync(tmp, { recursive: true, force: true });
ensure(tmp);

const rows = [];
NPCS.forEach((npc, i) => {
    const u = npc.union;
    const out = resolve(tmp, "r" + i + ".png");
    // 1) 프레임 타일로 쪼갠다  2) 모든 프레임을 같은 합집합 bbox 로 잘라 동일 오프셋을 먹인다
    // 3) gravity south 로 40x40 에 넣는다 — 가로 가운데, 세로는 **바닥에 붙인다**
    // 4) 가로로 이어 붙이고, 프레임이 모자란 종은 왼쪽 정렬로 빈 칸(투명)을 채운다
    magick([npc.png,
        "-crop", `${npc.frameW}x${npc.frameH}`, "+repage",
        "-crop", `${u.w}x${u.h}+${u.x}+${u.y}`, "+repage",
        "-background", "none", "-gravity", "south", "-extent", `${CELL}x${CELL}`,
        "+append",
        "-gravity", "west", "-extent", `${COLS * CELL}x${CELL}`, out]);
    rows.push(out);
    npc.frameStart = i * COLS;
});

const SHEET = resolve(OUT_TEX, "npcs.png");
magick([...rows, "-background", "none", "-append", SHEET]);
rmSync(tmp, { recursive: true, force: true });

const sheetBytes = statSync(SHEET).size;
const [sw, sh] = sizeOf(SHEET).split("x").map(Number);
if (sw !== COLS * CELL || sh !== ROWS * CELL) {
    throw new Error(`시트 크기가 예상과 다르다: ${sw}x${sh} (기대 ${COLS * CELL}x${ROWS * CELL})`);
}
log(`npcs.png (${sw}x${sh}) · 프레임 ${CELL}x${CELL} x ${COLS * ROWS}칸(실사용 ${NPCS.reduce((a, n) => a + n.frameCount, 0)})`
    + ` · 파일 ${(sheetBytes / 1024).toFixed(1)}KB · VRAM ${(sw * sh * 4 / 1048576).toFixed(2)}MB(RGBA8888)`);

// ── 5. 카탈로그 ─────────────────────────────────────────────
/**
 * 한 줄에 한 종씩 찍는다. JSON.stringify(…, 4) 는 npcs 배열을 종당 20줄짜리 블록으로 부풀려
 * diff 에서 어느 종이 바뀌었는지 안 보인다. monster-catalog.json 과 같은 방침이다.
 */
function writeJsonInlineRows(path, obj, arrayKey) {
    const lines = obj[arrayKey].map((r) => "        " + JSON.stringify(r));
    const text = JSON.stringify({ ...obj, [arrayKey]: "@@ROWS@@" }, null, 4)
        .replace('"@@ROWS@@"', "[\n" + lines.join(",\n") + "\n    ]") + "\n";
    writeFileSync(path, text);
    return Buffer.byteLength(text);
}

const catalog = {
    _comment: [
        "tools/build-npcs.mjs 생성물. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌린다.",
        `texture=${TEXTURE}, 균일 격자 spritesheet. frameWidth=frameHeight=${CELL}, 한 행 ${COLS}칸.`,
        "★ 한 행 = 한 종이다. frameStart = 종 인덱스 x 열수, 애니는 frameStart ~ frameStart+frameCount-1.",
        "  행 뒤쪽 남는 칸은 투명 프레임이다 — frameCount 를 넘겨 재생하면 NPC 가 사라진 것처럼 보인다.",
        "★ 셀 안에서 스프라이트는 바닥 정렬(가로 가운데 / 세로 아래 변)이다.",
        "  쓰는 쪽은 setOrigin(0.5, 1) 을 권장한다 — 그러면 스프라이트 y 가 곧 발이 닿는 지점이 된다.",
        "  기본 origin(0.5,0.5)으로 써도 6종의 발이 서로 같은 높이에 서기는 한다(셀 기준이 같으므로).",
        "bodyW/bodyH 는 프레임별 알파 bbox 의 중앙값(실측). 셀 크기가 아니라 이 값으로 접촉 판정을 잡는다.",
        "padTop 은 셀 위쪽 투명 여백(px). CELL - 합집합 높이 이며 바닥 정렬의 결과다.",
        "anim 키는 registerAnims 가 이 파일을 읽어 만든다 — 프레임 배정을 두 곳에 적지 않는다.",
        "라이선스: chierit 'Lively NPCs' CC BY 4.0 — 크레딧 표기 의무. 17-LICENSES-AND-CREDITS LC-06.",
    ],
    schemaVersion: 1,
    texture: TEXTURE,
    frameWidth: CELL,
    frameHeight: CELL,
    columns: COLS,
    align: "bottom-center",
    animPrefix: "npc.",
    fps: FPS,
    source: {
        pack: "Lively NPCs v3.1",
        author: "chierit",
        url: "https://chierit.itch.io/lively-npcs",
        license: "CC BY 4.0",
        creditRequired: true,
    },
    sheet: {
        file: "assets/npc/npcs.png",
        width: sw, height: sh,
        cells: COLS * ROWS,
        usedFrames: NPCS.reduce((a, n) => a + n.frameCount, 0),
        bytes: sheetBytes,
    },
    npcs: NPCS.map((n) => ({
        id: n.id,
        nameKo: n.nameKo,
        role: n.role,
        encounter: n.encounter,
        anim: "npc." + n.id,
        frameStart: n.frameStart,
        frameCount: n.frameCount,
        fps: FPS,
        bodyW: n.bodyW,
        bodyH: n.bodyH,
        padTop: CELL - n.union.h,
        srcSize: `${n.srcW}x${n.srcH}`,
        srcFrame: `${n.frameW}x${n.frameH}`,
        trim: `${n.union.w}x${n.union.h}+${n.union.x}+${n.union.y}`,
        src: "asset/npcs/Lively_NPCs_v3.1/sprite sheets/" + n.file,
    })),
};
const catBytes = writeJsonInlineRows(resolve(OUT_DATA, "npc-catalog.json"), catalog, "npcs");
log(`npc-catalog.json · ${NPCS.length}종 · ${(catBytes / 1024).toFixed(1)}KB`);

// ── 6. 요약 ─────────────────────────────────────────────────
console.log("");
console.log("   종         프레임  시작  몸통     여백  배역");
for (const n of NPCS) {
    console.log("   " + n.id.padEnd(11) + String(n.frameCount).padStart(4)
        + String(n.frameStart).padStart(6) + "  " + `${n.bodyW}x${n.bodyH}`.padEnd(8)
        + String(CELL - n.union.h).padStart(4) + "  " + n.nameKo);
}
console.log("");
console.log("완료. public/assets.json 의 spritesheets 에 다음 항목이 있어야 한다:");
console.log(`  { "key": "${TEXTURE}", "url": "assets/npc/npcs.png", "frameWidth": ${CELL}, "frameHeight": ${CELL} }`);
