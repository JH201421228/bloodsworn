/**
 * 보스 파이프라인 — asset/bosses/ 의 6개 팩을 게임이 쓰는 균일 격자 시트로 정규화한다.
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP 2 / 17-LICENSES-AND-CREDITS 5.4 / docs/26-STAGES-AND-BOSSES
 * 실행: node tools/build-bosses.mjs [--all]      (FE/ 에서)
 * 산출: public/assets/boss/boss2..boss7.png · public/assets/boss/boss-atlas.json
 *
 * ★ BOSS1(여명의 처형인)은 여기서 굽지 않는다.
 *   boss-executioner.png 는 build-assets.mjs buildBoss() 의 산출물이고 이미 배포에 들어가 있다.
 *   같은 파일을 두 스크립트가 쓰면 "어느 쪽을 돌렸느냐"에 따라 프레임 배치가 달라진다.
 *
 * ★ 왜 팩마다 크기를 그대로 두지 않고 몸 높이 80px 로 재정규화하는가
 *   원본 셀은 80(NightBorne) ~ 250(Evil Wizard) 로 3배 넘게 벌어져 있다. 그대로 쓰면
 *   스테이지 4 보스가 스테이지 5 보스의 3배로 보이는데, 그건 연출 의도가 아니라 팩 사정이다.
 *   BOSS1 의 정본 히트박스 h=80(05-COMBAT 6)을 기준으로 전 보스의 "몸 높이"를 맞추면
 *   6종이 같은 세계의 존재로 읽히고, 무엇보다 히트박스가 스프라이트와 어긋나지 않는다.
 *
 * ★ 왜 캔버스가 아니라 알파 바운딩박스로 히트박스를 재는가
 *   Evil Wizard 의 원본 셀은 250x250 인데 실제 몸통은 약 44x76 이다. 캔버스로 반경을 잡으면
 *   보스 몸에서 100px 떨어진 허공을 때려도 맞는다 — 보스전이 "때리는 게임"이 아니라
 *   "근처에 서 있는 게임"이 된다. build-monsters.mjs 가 150종에 쓴 방식과 같은 이유다.
 *
 * ★ 왜 애니메이션별이 아니라 보스 단위 합집합 bbox 로 자르는가
 *   애니메이션마다 따로 중앙 정렬하면 낫을 휘두르는 프레임에서 몸이 통째로 옆으로 튄다.
 *   전 프레임 합집합으로 한 번만 잘라 같은 오프셋을 먹이면 몸의 위치는 고정되고
 *   무기가 뻗는 상대 움직임만 남는다.
 *
 * ★ 라이선스 게이트 (17-LICENSES 5.4 / LC-07)
 *   동봉 근거가 없는 팩(NightBorne / Undead executioner / Mecha-stone Golem)은 정본에서
 *   🟥 배포 제외로 판정돼 있다. 기본 실행은 그 3팩을 건너뛰고, --all 을 줘야 굽는다.
 *   개발 중 화면을 채우기 위한 스위치이지 배포 승인이 아니다. 자세한 판정은 보고서/26번 문서.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SRC = resolve(ROOT, "asset/bosses");
const OUT = resolve(FE, "public/assets/boss");

/** 정규화 목표 몸 높이. BOSS1 정본 히트박스 h=80 (05-COMBAT 6) */
const BODY_H = 80;
/** 시트 열 수. 기존 boss-executioner.png 가 8열이라 눈으로 비교하기 좋게 맞춘다 */
const COLS = 8;
/** 셀 상한 — 640x360 화면에서 이보다 큰 프레임은 보스가 화면을 다 먹는다 */
const CELL_MAX = 160;

const ALL = process.argv.includes("--all");

const MAGICK = (() => {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 후보 */ }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다. 설치 후 PATH에 넣을 것.");
})();
const magick = (a) => execFileSync(MAGICK, a, { stdio: ["ignore", "pipe", "pipe"] });
const sizeOf = (p) => magick([p, "-format", "%wx%h", "info:"]).toString().trim();
const ensure = (p) => mkdirSync(p, { recursive: true });
const log = (...a) => console.log("  ", ...a);

// ── 1. 팩 기술서 ────────────────────────────────────────────
/**
 * cell 은 원본 시트의 한 칸 크기(정사각). 팩마다 다르지만 전부 W%cell==0 && H%cell==0 이라
 * 격자 판정이 산술로 끝난다 — 프레임 좌표표를 손으로 적을 필요가 없다.
 *
 * 애니 키는 BossSystem 이 부르는 이름과 1:1 이다(idle/walk/attack/cast/spell/hurt/death).
 * 원본에 없는 키는 만들지 않는다. BossSystem 은 anims.exists 로 감싸 부르므로
 * 없는 애니는 조용히 건너뛰고 직전 애니가 유지된다 — 부팅이 죽지 않는다.
 *
 * license.gate: "clear" 동봉 근거 + 상업 허용 / "conditional" 조건부 / "blocked" 근거 없음(LC-07)
 */
const BOSSES = [
    {
        id: "BOSS2", key: "boss2", name: "재의 집행자", stage: "stage2",
        dir: "Undead executioner/Undead executioner puppet/png", cell: 100,
        license: { gate: "blocked", holder: "미상", file: null, terms: "동봉 근거 없음 (17-LICENSES LC-07)" },
        files: [
            { key: "idle", src: "idle.png" },
            { key: "walk", src: "idle2.png" },
            { key: "attack", src: "attacking.png" },
            { key: "cast", src: "skill1.png" },
            { key: "spell", src: "summon.png" },
            { key: "death", src: "death.png" },
        ],
    },
    {
        id: "BOSS3", key: "boss3", name: "늪의 낭인", stage: "stage3",
        dir: "FREE_Samurai 2D Pixel Art v1.2/FREE_Samurai 2D Pixel Art v1.2/Sprites", cell: 96,
        license: { gate: "clear", holder: "xzany", file: "License.txt", terms: "개인·상업 프로젝트 사용 가능 / 게임 에셋으로 재판매·재배포 금지 / 크레딧 권장 / NFT 금지" },
        files: [
            { key: "idle", src: "IDLE.png" },
            { key: "walk", src: "RUN.png" },
            { key: "attack", src: "ATTACK 1.png" },
            { key: "hurt", src: "HURT.png" },
        ],
    },
    {
        id: "BOSS4", key: "boss4", name: "첨탑의 마도사", stage: "stage4",
        dir: "EVil Wizard 2/EVil Wizard 2/Sprites", cell: 250,
        license: { gate: "clear", holder: "미상(팩 동봉)", file: "License.txt", terms: "CC0 — 상업·비상업 무제한" },
        files: [
            { key: "idle", src: "Idle.png" },
            { key: "walk", src: "Run.png" },
            { key: "attack", src: "Attack1.png" },
            { key: "cast", src: "Attack2.png" },
            { key: "hurt", src: "Take hit.png" },
            { key: "death", src: "Death.png" },
        ],
    },
    {
        id: "BOSS5", key: "boss5", name: "나이트본", stage: "stage5",
        dir: "NightBorne", cell: 80,
        license: { gate: "blocked", holder: "미상", file: null, terms: "동봉 근거 없음 (17-LICENSES LC-07 / 정본 컷 후보 1순위)" },
        sheet: "NightBorne.png",
        rows: [
            { key: "idle", row: 0 },
            { key: "walk", row: 1 },
            { key: "attack", row: 2 },
            { key: "hurt", row: 3 },
            { key: "death", row: 4 },
        ],
    },
    {
        id: "BOSS6", key: "boss6", name: "석조 수호자", stage: "stage6",
        dir: "Mecha-stone Golem 0.1/Mecha-stone Golem 0.1/PNG sheet", cell: 100,
        license: { gate: "blocked", holder: "미상", file: null, terms: "동봉 근거 없음 (17-LICENSES LC-07)" },
        sheet: "Character_sheet.png",
        // 10x10 격자. 행마다 애니가 다르고 오른쪽은 빈 칸이라 실제 프레임 수는 자동으로 잘린다.
        rows: [
            { key: "idle", row: 0 },
            { key: "walk", row: 1 },
            { key: "attack", row: 2 },   // 팔을 사출한다 — 원거리 패턴에 그대로 쓴다
            { key: "cast", row: 3 },
            { key: "hurt", row: 4 },
            { key: "spell", row: 6 },
            { key: "death", row: 7 },
        ],
    },
    {
        id: "BOSS7", key: "boss7", name: "무명", stage: null,
        dir: "MainCharacter(FreePack)/MainCharacter(FreePack)", cell: 128,
        license: { gate: "conditional", holder: "KBPixelArt", file: "License.txt", terms: "개인·상업 사용 및 수정 허용 / 재판매·재배포 금지 / NFT·AI 학습 금지 / 크레딧 권장" },
        files: [{ key: "idle", src: "Idle.png" }],
    },
];

/** 애니 키별 재생 규격. 루프하는 것과 한 번만 도는 것을 여기서 한 번에 정한다 */
const ANIM_SPEC = {
    idle: { fps: 8, repeat: -1 },
    walk: { fps: 10, repeat: -1 },
    attack: { fps: 12, repeat: 0 },
    cast: { fps: 12, repeat: 0 },
    spell: { fps: 12, repeat: 0 },
    hurt: { fps: 12, repeat: 0 },
    death: { fps: 10, repeat: 0 },
};

// ── 2. 알파 bbox 실측 ───────────────────────────────────────
/**
 * 시트를 cell 격자로 쪼개 칸마다 알파 바운딩박스를 잰다. magick 호출 1회로 전 칸을 끝낸다.
 * -alpha extract 로 알파를 회색조로 꺼내고 -threshold 0 이면 불투명 픽셀만 흰색이 되므로
 * 그 상태의 트림 좌표(%@)가 곧 몸 경계다. 원본은 건드리지 않는다.
 *
 * @returns {({w,h,x,y}|null)[]} 행 우선 순서. 빈 칸은 null (팩마다 오른쪽에 빈 칸이 남는다)
 */
function measureGrid(png, cell) {
    const [W, H] = sizeOf(png).split("x").map(Number);
    if (W % cell || H % cell) throw new Error(`${png}: ${W}x${H} 가 셀 ${cell} 로 나뉘지 않는다`);
    const out = magick([png, "-crop", `${cell}x${cell}`, "+repage", "-alpha", "extract",
        "-threshold", "0", "-format", "%@\n", "info:"]).toString();
    const boxes = [];
    for (const line of out.split("\n")) {
        const s = line.trim();
        if (!s) continue;
        const m = /^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/.exec(s);
        // 완전히 투명한 칸은 0x0 이거나 파싱 불가다. 둘 다 "칸 없음"으로 본다
        if (!m || +m[1] === 0 || +m[2] === 0) { boxes.push(null); continue; }
        boxes.push({ w: +m[1], h: +m[2], x: +m[3], y: +m[4] });
    }
    return { cols: W / cell, rows: H / cell, boxes };
}

/** 짝수 개면 아래쪽 중앙값. 히트박스는 과대보다 과소가 안전하다(build-monsters 와 같은 규칙) */
const median = (a) => a.slice().sort((x, y) => x - y)[(a.length - 1) >> 1];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * 보스 하나의 프레임 목록을 만든다.
 * 프레임 = { png, cell, index(원본 격자 인덱스), box }
 * 빈 칸은 여기서 이미 걸러져 나오므로 시트에 투명 프레임이 섞이지 않는다.
 */
function collectFrames(b) {
    const dir = resolve(SRC, b.dir);
    const anims = [];
    if (b.sheet) {
        const png = join(dir, b.sheet);
        const g = measureGrid(png, b.cell);
        for (const r of b.rows) {
            const frames = [];
            for (let c = 0; c < g.cols; c++) {
                const box = g.boxes[r.row * g.cols + c];
                if (!box) break;   // 행은 왼쪽 정렬이다. 빈 칸이 나오면 그 행은 끝난 것이다
                frames.push({ png, cell: b.cell, index: r.row * g.cols + c, box });
            }
            if (frames.length) anims.push({ key: r.key, frames });
            else console.warn(`   ! ${b.id} ${r.key}: 행 ${r.row} 이 비어 있다`);
        }
    } else {
        for (const f of b.files) {
            const png = join(dir, f.src);
            if (!existsSync(png)) { console.warn(`   ! 파일 없음: ${f.src}`); continue; }
            const g = measureGrid(png, b.cell);
            const frames = [];
            g.boxes.forEach((box, i) => { if (box) frames.push({ png, cell: b.cell, index: i, box }); });
            if (frames.length) anims.push({ key: f.key, frames });
        }
    }
    return anims;
}

// ── 3. 굽기 ─────────────────────────────────────────────────
/**
 * ★ 배율은 idle 프레임의 몸 높이 중앙값으로 정한다.
 *   전 프레임으로 재면 낫·팔 사출 프레임이 중앙값을 끌어올려 보스가 통째로 작아진다.
 *   "가만히 서 있을 때의 키"가 플레이어가 인지하는 크기이므로 그것을 80px 로 맞춘다.
 *
 * ★ 잘라내는 상자는 전 애니 합집합이다.
 *   idle 만으로 자르면 공격 프레임의 무기가 셀 밖으로 나가 잘린 낫이 보인다.
 */
function bakeBoss(b) {
    const anims = collectFrames(b);
    if (!anims.length) { console.warn(`   ! ${b.id}: 프레임이 하나도 없다`); return null; }

    const all = anims.flatMap((a) => a.frames);
    const idle = (anims.find((a) => a.key === "idle") ?? anims[0]).frames;
    const bodyW = median(idle.map((f) => f.box.w));
    const bodyH = median(idle.map((f) => f.box.h));
    // ★ 셀의 중심에 놓을 기준점 = idle 몸통의 중심이다.
    //   합집합 상자의 중심에 맞추면 칼을 오른쪽으로 뻗는 보스는 몸이 셀 왼쪽으로 밀리고,
    //   스프라이트 원점(0.5)은 셀 중심이므로 히트박스가 몸에서 통째로 어긋난다.
    //   "보이는 몸"과 "맞는 자리"가 다르면 그건 히트박스를 잰 의미가 없다.
    const cx = median(idle.map((f) => f.box.x + f.box.w / 2));
    const cy = median(idle.map((f) => f.box.y + f.box.h / 2));

    const ux = Math.min(...all.map((f) => f.box.x));
    const uy = Math.min(...all.map((f) => f.box.y));
    const uw = Math.max(...all.map((f) => f.box.x + f.box.w)) - ux;
    const uh = Math.max(...all.map((f) => f.box.y + f.box.h)) - uy;
    // 몸 중심을 셀 중심에 두면서 합집합을 전부 담으려면 먼 쪽 반경의 2배가 필요하다
    const hx = Math.max(cx - ux, ux + uw - cx);
    const hy = Math.max(cy - uy, uy + uh - cy);

    // 몸 높이 80px 이 목표지만, 무기를 포함한 셀이 상한을 넘으면 배율을 깎는다.
    // 잘린 낫보다 조금 작은 보스가 낫다.
    const want = BODY_H / bodyH;
    const scale = Math.min(want, CELL_MAX / (2 * hx), CELL_MAX / (2 * hy));
    // 셀은 짝수로. 홀수면 중심이 반픽셀에 놓여 프레임마다 1px 씩 흔들린다
    const cw = Math.min(CELL_MAX, Math.ceil(hx * scale) * 2);
    const ch = Math.min(CELL_MAX, Math.ceil(hy * scale) * 2);
    const sw = Math.max(1, Math.round(uw * scale));
    const sh = Math.max(1, Math.round(uh * scale));
    // 합집합을 셀 안에 놓을 좌상단 오프셋. 몸 중심(cx,cy)이 셀 중심에 오도록 역산한다
    const ox = Math.max(0, Math.round(cw / 2 - (cx - ux) * scale));
    const oy = Math.max(0, Math.round(ch / 2 - (cy - uy) * scale));

    ensure(OUT);
    const tmp = resolve(OUT, "_tmp_" + b.key);
    rmSync(tmp, { recursive: true, force: true });
    ensure(tmp);

    const cells = [];
    let n = 0;
    const table = [];
    for (const a of anims) {
        const from = n;
        for (const f of a.frames) {
            const out = resolve(tmp, "f" + String(n).padStart(3, "0") + ".png");
            const cols = sizeOfCols(f.png, f.cell);
            const gx = (f.index % cols) * f.cell + ux;
            const gy = Math.floor(f.index / cols) * f.cell + uy;
            // -splice 로 왼쪽/위에 여백을 넣고 -extent 로 오른쪽/아래를 채운다.
            // 이 두 단계가 "임의 오프셋 배치"를 magick 호출 한 번으로 끝내는 방법이다.
            magick([f.png,
                "-crop", `${uw}x${uh}+${gx}+${gy}`, "+repage",
                "-background", "none", "-filter", "point", "-resize", `${sw}x${sh}!`,
                "-gravity", "NorthWest", "-splice", `${ox}x${oy}`,
                "-extent", `${cw}x${ch}`, out]);
            cells.push(out);
            n++;
        }
        const spec = ANIM_SPEC[a.key] ?? { fps: 10, repeat: 0 };
        table.push({ key: a.key, from, to: n - 1, frames: a.frames.length, fps: spec.fps, repeat: spec.repeat });
    }

    // 행 단위로 가로 병합 후 세로 병합. 마지막 행은 왼쪽 정렬로 폭을 채운다(빈 칸은 투명 프레임)
    const rows = [];
    for (let r = 0; r * COLS < cells.length; r++) {
        const part = cells.slice(r * COLS, (r + 1) * COLS);
        const out = resolve(tmp, "r" + String(r).padStart(2, "0") + ".png");
        magick([...part, "-background", "none", "+append", "-gravity", "west", "-extent", `${COLS * cw}x${ch}`, out]);
        rows.push(out);
    }
    const dest = resolve(OUT, b.key + ".png");
    magick([...rows, "-background", "none", "-append", dest]);
    rmSync(tmp, { recursive: true, force: true });

    const bytes = statSync(dest).size;
    const [aw, ah] = sizeOf(dest).split("x").map(Number);
    return {
        id: b.id, key: b.key, name: b.name, stage: b.stage,
        file: `assets/boss/${b.key}.png`,
        frameWidth: cw, frameHeight: ch, columns: COLS, frames: n,
        sheet: { width: aw, height: ah, bytes },
        srcCell: b.cell, scale: Math.round(scale * 1000) / 1000,
        // ★ 히트박스는 실측 몸통 x 배율이다. 캔버스(cw x ch)가 아니다
        hitbox: { w: Math.max(8, Math.round(bodyW * scale)), h: Math.max(8, Math.round(bodyH * scale)) },
        body: { w: bodyW, h: bodyH },
        trim: `${uw}x${uh}+${ux}+${uy}`,
        anims: table,
        license: b.license,
        src: "asset/bosses/" + b.dir,
    };
}

/** 시트별 열 수 캐시. 프레임마다 magick 을 다시 부르면 굽는 시간이 배로 든다 */
const COLS_CACHE = new Map();
function sizeOfCols(png, cell) {
    const k = png + "|" + cell;
    if (!COLS_CACHE.has(k)) COLS_CACHE.set(k, Number(sizeOf(png).split("x")[0]) / cell);
    return COLS_CACHE.get(k);
}

// ── 4. 파이프라인 ───────────────────────────────────────────
console.log("보스 파이프라인 시작");
console.log("  원본: " + SRC);
console.log("  도구: " + MAGICK);
if (!ALL) console.log("  ★ 라이선스 게이트 ON — 근거 없는 팩(blocked)은 건너뛴다. 개발용으로 다 굽으려면 --all");

const built = [];
const skipped = [];
for (const b of BOSSES) {
    if (b.license.gate === "blocked" && !ALL) {
        skipped.push(`${b.id} ${b.name} (${b.license.terms})`);
        continue;
    }
    const meta = bakeBoss(b);
    if (!meta) continue;
    built.push(meta);
    const gate = b.license.gate === "clear" ? "OK" : b.license.gate === "conditional" ? "조건부" : "근거없음";
    log(`${meta.key}.png ${meta.sheet.width}x${meta.sheet.height} · 프레임 ${meta.frameWidth}x${meta.frameHeight} x ${meta.frames}칸 · ` +
        `히트박스 ${meta.hitbox.w}x${meta.hitbox.h} (배율 ${meta.scale}) · ${(meta.sheet.bytes / 1024).toFixed(1)}KB · 라이선스 ${gate}`);
    log("   애니: " + meta.anims.map((a) => `${a.key}[${a.from}-${a.to}]`).join(" "));
}

if (skipped.length) {
    console.log("");
    console.log("  게이트에 걸려 굽지 않은 팩 (17-LICENSES 5.4 LC-07):");
    for (const s of skipped) log("   · " + s);
}

// ── 5. 아틀라스 메타 ────────────────────────────────────────
/**
 * ★ 이 파일은 public/ 에 둔다 — src/data 가 아니다.
 *   프레임 배정은 PNG 와 한 몸이라 PNG 를 다시 구우면 같이 바뀐다. 밸런스 수치(boss.json)와
 *   같은 폴더에 두면 "스크립트가 덮어써도 되는 파일"과 "손으로 고치는 파일"이 섞인다.
 *   registerAnims 는 이걸 읽어 boss2.idle 같은 키를 만든다(assets.json 의 json 항목에 등록).
 */
if (built.length) {
    const atlas = {
        _comment: [
            "tools/build-bosses.mjs 생성물. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌린다.",
            "각 보스는 균일 격자 spritesheet 1장. frameWidth/frameHeight/columns 로 좌표가 산술로 나온다.",
            "hitbox 는 idle 프레임 알파 bbox 중앙값 x 정규화 배율(실측). 캔버스 크기가 아니다.",
            "anims[].from/to 는 프레임 인덱스. registerAnims 가 이 표로 <key>.<anim> 을 만든다.",
            "license.gate 가 blocked 인 항목은 배포 금지다 — 17-LICENSES-AND-CREDITS 5.4 / LC-07.",
        ],
        schemaVersion: 1,
        bosses: built,
    };
    writeFileSync(resolve(OUT, "boss-atlas.json"), JSON.stringify(atlas, null, 4) + "\n", "utf8");
    log(`boss-atlas.json · ${built.length}종`);
}

// ── 6. 배선용 조각 ──────────────────────────────────────────
/**
 * assets.json / boss.json 은 다른 작업자 소유다. 여기서 고치지 않고 붙여넣을 조각만 찍는다.
 * 콘솔로 내보내는 이유: 스크립트를 돌린 사람이 곧 배선하는 사람이라 파일을 또 열게 만들 이유가 없다.
 */
if (built.length) {
    console.log("");
    console.log("── public/assets.json 의 spritesheets 에 추가 ──");
    console.log(JSON.stringify(built.map((m) => ({
        key: m.key, url: m.file, frameWidth: m.frameWidth, frameHeight: m.frameHeight,
    })), null, 4));
    console.log("");
    console.log("── boss.json 히트박스 실측값 ──");
    for (const m of built) log(`${m.id} ${m.name}: "hitbox": { "w": ${m.hitbox.w}, "h": ${m.hitbox.h} }  // 몸통 ${m.body.w}x${m.body.h} x ${m.scale}`);
}

console.log("");
console.log("완료. 산출물은 커밋한다. 원본 asset/ 은 커밋하지 않는다.");
