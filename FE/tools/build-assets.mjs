/**
 * 에셋 파이프라인 — asset/ 원본에서 게임이 쓰는 것만 골라 FE/public/assets/ 로 가공한다.
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md 2(매핑 표) / 4(가공 파이프라인)
 * 태스크: T120 T121 T123 T124 T125 T126
 * 실행: npm run build:assets   (FE/ 에서)
 *
 * ★ sharp가 아니라 ImageMagick을 쓰는 이유
 *   sharp는 네이티브 의존성이라 CI(macOS 러너) 재설치 비용이 든다.
 *   이 스크립트는 로컬에서 1회 돌리고 산출물을 커밋하는 용도이므로
 *   후처리에 이미 쓰는 ImageMagick(문서 4)을 그대로 재사용한다.
 *
 * ★ 산출물은 커밋한다. 원본 asset/ 131MB는 커밋하지 않는다(07 6.4).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SRC = resolve(ROOT, "asset");
const OUT = resolve(FE, "public/assets");

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
const sizeOf = (p) => magick([p, "-format", "%wx%h", "info:"]).toString().trim();
const ensure = (p) => mkdirSync(p, { recursive: true });
const log = (...a) => console.log("  ", ...a);

// ── 1. 플레이어 — 96x80 x 8프레임, 4애니메이션 x 4방향 (T120/T121)
function buildPlayer() {
    console.log("[1/6] 플레이어");
    const base = resolve(SRC, "character/FREE_Adventurer 2D Pixel Art/Sprites");
    const dest = resolve(OUT, "player");
    ensure(dest);
    const anims = [
        { dir: "IDLE", prefix: "idle", out: "idle" },
        { dir: "RUN", prefix: "run", out: "run" },
        { dir: "ATTACK 1", prefix: "attack1", out: "atk1" },
        { dir: "ATTACK 2", prefix: "attack2", out: "atk2" },
    ];
    const dirs = ["up", "down", "left", "right"];
    let n = 0;
    for (const a of anims) {
        for (const d of dirs) {
            const from = resolve(base, a.dir, a.prefix + "_" + d + ".png");
            if (!existsSync(from)) {
                console.warn("   ! 원본 없음: " + from);
                continue;
            }
            // 산출 파일명은 전부 소문자-하이픈으로 정규화한다 (T121)
            copyFileSync(from, resolve(dest, "player-" + a.out + "-" + d + ".png"));
            n++;
        }
    }
    log(n + "장 복사 -> public/assets/player/");
}

// ── 2. 적 10종 -> 64x160 단일 시트 (T125)
const ENEMY_ORDER = [
    ["E1", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Vampire Bat/VampireBat.png"],
    ["E2", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Mutilated Stumbler/MutilatedStumbler.png"],
    ["E3", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Skittering Hand/SkitteringHand.png"],
    ["E4", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Decrepit Bones/DecrepitBones.png"],
    ["E5", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Grave Revenant/GraveRevenant.png"],
    ["E6", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Brittle Archer/BrittleArcher.png"],
    ["E7", "basic asset pack (6)/basic asset pack/Basic Vermin Animations/Plague Bat/PlagueBat.png"],
    ["E8", "basic asset pack (9)/basic asset pack/Basic Demon Animations/crimson imp/CrimsonImp.png"],
    ["EL1", "basic asset pack (8)/basic asset pack/Basic Undead Animations/Carcass Feeder/CarcassFeeder.png"],
    ["EL2", "basic asset pack (9)/basic asset pack/Basic Demon Animations/Depraved Blackguard/DepravedBlackguard.png"],
];

function buildEnemies() {
    console.log("[2/6] 적 10종 합본");
    const dest = resolve(OUT, "enemies");
    ensure(dest);
    const inputs = [];
    const kept = [];
    for (const [id, rel] of ENEMY_ORDER) {
        const p = resolve(SRC, "monsters", rel);
        if (!existsSync(p)) {
            console.warn("   ! " + id + " 원본 없음: " + rel);
            continue;
        }
        const s = sizeOf(p);
        if (s !== "64x16") {
            console.warn("   ! " + id + " 크기가 64x16이 아니다(" + s + "). 합본에서 제외");
            continue;
        }
        inputs.push(p);
        kept.push(id);
    }
    if (!inputs.length) throw new Error("적 스프라이트를 하나도 찾지 못했다");
    const out = resolve(dest, "enemies.png");
    // -append = 세로 결합. 전부 64x16이므로 결과는 64x(16*N)
    magick([...inputs, "-background", "none", "-append", out]);
    const s = sizeOf(out);
    log(kept.length + "종 -> enemies.png (" + s + ") · 프레임 16x16 x " + kept.length * 4 + "장");
    log("프레임 배정: " + kept.map((id, i) => id + "=" + i * 4 + "-" + (i * 4 + 3)).join(" "));
    if (s !== "64x" + kept.length * 16) console.warn("   ! 예상 크기와 다르다");
}

// ── 3. 보스 — 140x93 x 64칸 시트 그대로
function buildBoss() {
    console.log("[3/6] 보스");
    const from = resolve(SRC, "bosses/Bringer-Of-Death/Bringer-Of-Death/SpriteSheet/Bringer-of-Death-SpritSheet.png");
    const dest = resolve(OUT, "boss");
    ensure(dest);
    if (!existsSync(from)) {
        console.warn("   ! 보스 시트 원본 없음");
        return;
    }
    const out = resolve(dest, "boss-executioner.png");
    copyFileSync(from, out);
    log("boss-executioner.png (" + sizeOf(out) + ") · 프레임 140x93 x 64칸");
}

// ── 4. 타일셋 — AT-07 결과 반영
//    mainlevbuild.png는 측면뷰 플랫포머 세트라 아치/기둥/계단/벽감은 톱다운에 못 쓴다.
//    우측 평면 바닥 텍스처만 16px 정렬돼 있다(알파 전수 검출로 확인).
//    필요한 타일만 다시 패킹하면 Tiled 오프셋 문제가 구조적으로 사라진다.
const TILES = [
    { name: "void", x: 80, y: 64, solid: true },
    { name: "floor-slab-a", x: 736, y: 208, solid: false },
    { name: "floor-slab-b", x: 752, y: 208, solid: false },
    { name: "floor-brick", x: 736, y: 272, solid: false },
    { name: "floor-stone", x: 736, y: 320, solid: false },
    { name: "floor-rough", x: 736, y: 368, solid: false },
    { name: "floor-moss", x: 736, y: 416, solid: false },
    { name: "wall-masonry", x: 784, y: 272, solid: true },
];

function buildTiles() {
    console.log("[4/6] 타일셋 (AT-07 반영)");
    const dest = resolve(OUT, "tiles");
    ensure(dest);
    const sheet = resolve(SRC, "tilemap/mainlevbuild.png");
    if (!existsSync(sheet)) throw new Error("mainlevbuild.png 없음");
    const tmp = resolve(dest, "_tmp");
    ensure(tmp);
    const parts = [];
    TILES.forEach((t, i) => {
        const p = resolve(tmp, "t" + String(i).padStart(2, "0") + ".png");
        magick([sheet, "-crop", "16x16+" + t.x + "+" + t.y, "+repage", p]);
        parts.push(p);
    });
    const out = resolve(dest, "tiles-main.png");
    magick([...parts, "-background", "none", "+append", out]);
    rmSync(tmp, { recursive: true, force: true });
    log("tiles-main.png (" + sizeOf(out) + ") · " + TILES.length + "타일");
    const solids = TILES.map((t, i) => (t.solid ? i + ":" + t.name : null)).filter(Boolean);
    log("통행 불가 인덱스: " + solids.join(", "));
}

// ── 5. 소품 — 프레임마다 크기가 달라 bottom-align 패딩 필수 (T126)
const PROPS = [
    { key: "candle-a", files: ["candleA_01.png", "candleA_02.png", "candleA_03.png", "candleA_04.png"] },
    { key: "candle-b", files: ["candleB_01.png", "candleB_02.png", "candleB_03.png", "candleB_04.png"] },
    { key: "torch", files: ["torch_1.png", "torch_2.png", "torch_3.png", "torch_4.png"] },
    { key: "spike", files: ["spike_0.png", "spike_1.png", "spike_2.png", "spike_3.png", "spike_4.png"] },
];

function buildProps() {
    console.log("[5/6] 소품 (bottom-align 패딩)");
    const dest = resolve(OUT, "props");
    ensure(dest);
    const base = resolve(SRC, "tilemap");
    for (const prop of PROPS) {
        const tmp = resolve(dest, "_tmp_" + prop.key);
        ensure(tmp);
        const parts = [];
        let missing = false;
        prop.files.forEach((f, i) => {
            const from = resolve(base, f);
            if (!existsSync(from)) {
                console.warn("   ! " + prop.key + ": " + f + " 없음");
                missing = true;
                return;
            }
            const p = resolve(tmp, "f" + i + ".png");
            // gravity south = 바닥 기준 정렬. 이게 없으면 불꽃이 위아래로 튄다.
            magick([from, "-background", "none", "-gravity", "south", "-extent", "16x16", p]);
            parts.push(p);
        });
        if (parts.length) {
            const out = resolve(dest, prop.key + ".png");
            magick([...parts, "-background", "none", "+append", out]);
            log(prop.key + ".png (" + sizeOf(out) + ") · " + parts.length + "프레임" + (missing ? " !일부누락" : ""));
        }
        rmSync(tmp, { recursive: true, force: true });
    }
}

// ── 6. 이펙트 — 세로 9행은 프레임이 아니라 컬러 배리언트다. row 0만 크롭 (T124)
const EFFECTS = [{ key: "fx-slash", part: "Part 16", file: "766.png" }];

function buildEffects() {
    console.log("[6/6] 이펙트 (row 0만 크롭)");
    const dest = resolve(OUT, "fx");
    ensure(dest);
    for (const fx of EFFECTS) {
        const from = resolve(SRC, "effect/Free", fx.part, fx.file);
        if (!existsSync(from)) {
            console.warn("   ! " + fx.key + " 원본 없음: " + fx.part + "/" + fx.file);
            continue;
        }
        const out = resolve(dest, fx.key + ".png");
        magick([from, "-crop", "512x64+0+0", "+repage", out]);
        log(fx.key + ".png (" + sizeOf(out) + ") · 프레임 64x64 x 8장");
    }
    log("! 무기별 이펙트 선별은 Day 2 무기 구현 때 EFFECTS 배열에 추가한다");
}

console.log("에셋 파이프라인 시작");
console.log("  원본: " + SRC);
console.log("  산출: " + OUT);
console.log("  도구: " + MAGICK);
console.log("");
ensure(OUT);
buildPlayer();
buildEnemies();
buildBoss();
buildTiles();
buildProps();
buildEffects();
console.log("");
console.log("완료. 산출물은 커밋한다. 원본 asset/ 은 커밋하지 않는다.");
