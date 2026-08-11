/**
 * gen-item-icons.mjs — 아이템 아이콘 66종을 **절차적으로** 생성한다.
 *
 * ★ 왜 그리는가
 *   Raven Fantasy 무료판은 수익화 프로젝트에서 쓸 수 없고(itch 원문 "released for free
 *   with no microtransactions and/or paid advertisement/ad"), asset/item/pixel items 는
 *   제작자를 특정할 수 없다. 예산은 0이다.
 *   남은 선택지는 직접 만드는 것뿐이고, 32x32 실루엣은 도형 조합으로 충분히 알아볼 수 있다.
 *
 * ★ 품질보다 **구분 가능성**이 목표다
 *   플레이어가 토스트에서 0.5초 보는 그림이다. 세밀한 묘사보다 "물약인지 검인지 왕관인지"가
 *   즉시 갈리는 것이 훨씬 중요하다. 카테고리별로 실루엣을 고정하고 색으로 개체를 가른다.
 *
 * ★ 팔레트는 게임 것을 쓴다(09-ART). 새 색을 만들면 UI 와 따로 논다.
 * ★ 외부 에셋 의존이 0이라 라이선스 리스크도 0이다.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const OUT = resolve(FE, "public/assets/items");
const TMP = resolve(FE, ".tmp-gen");
const S = 32;

function magick() {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 후보 */ }
    }
    throw new Error("ImageMagick 을 찾지 못했다");
}
const MG = magick();
const run = (a) => execFileSync(MG, a, { stdio: ["ignore", "pipe", "pipe"] });

/** 09-ART 팔레트 */
const P = {
    blood: "#8e1220", bloodLt: "#d6203a", candle: "#35c9b4", candleLt: "#7fe8dc",
    parch: "#c9b792", bone: "#e8e0d0", stone: "#7b7488", stoneDk: "#3a3345",
    gold: "#e8b44c", goldLt: "#ffd98a", voidC: "#241e2e", moss: "#6a8f4a",
    amber: "#e07b39", ice: "#8ecbe8", violet: "#a86ede",
};

const draw = (parts) => ["-size", S + "x" + S, "xc:none", ...parts.flat()];
const fill = (c) => ["-fill", c];
const stroke = (c, w) => ["-stroke", c, "-strokewidth", String(w || 1)];
const none = ["-stroke", "none"];
const rect = (a, b, c, d) => ["-draw", "rectangle " + a + "," + b + " " + c + "," + d];
const rrect = (a, b, c, d, r) => ["-draw", "roundrectangle " + a + "," + b + " " + c + "," + d + " " + (r || 3) + "," + (r || 3)];
const circ = (x, y, r) => ["-draw", "circle " + x + "," + y + " " + x + "," + (y - r)];
const poly = (pts) => ["-draw", "polygon " + pts.map((p) => p.join(",")).join(" ")];
const line = (a, b, c, d) => ["-draw", "line " + a + "," + b + " " + c + "," + d];

// ── 카테고리별 실루엣 ─────────────────────────────────────────
/** 물약 — 목이 좁은 병. 액체 색과 양으로 종류를 가른다 */
const potion = (liq, amt) => [
    ...none, ...fill(P.stoneDk), rect(13, 4, 18, 8),
    ...fill(P.bone), rect(14, 7, 17, 11),
    ...fill("#2a2333"), rrect(9, 11, 22, 27, 5),
    ...fill(liq), rrect(11, Math.round(25 - 12 * amt), 20, 25, 4),
    ...fill("#ffffff40"), rect(12, 14, 13, 22),
];
/** 보석 — 마름모 + 하이라이트 */
const gem = (c, lt) => [
    ...none, ...fill(c), poly([[16, 5], [26, 15], [16, 28], [6, 15]]),
    ...fill(lt), poly([[16, 5], [21, 14], [16, 18], [11, 14]]),
];
/** 검 — 날 색으로 등급을 가른다 */
const sword = (blade, guard) => [
    ...none, ...fill(blade), poly([[16, 2], [19, 8], [19, 20], [16, 24], [13, 20], [13, 8]]),
    ...fill("#ffffff66"), rect(15, 4, 16, 20),
    ...fill(guard), rect(9, 20, 23, 23),
    ...fill("#4a3524"), rect(14, 23, 18, 29),
    ...fill(guard), circ(16, 30, 2),
];
const armor = (c, trim) => [
    ...none, ...fill(c), poly([[8, 8], [16, 5], [24, 8], [25, 20], [16, 28], [7, 20]]),
    ...fill(trim), poly([[8, 8], [16, 5], [24, 8], [24, 11], [16, 8], [8, 11]]),
    ...fill("#00000055"), rect(15, 11, 17, 24),
];
const shield = (c, trim) => [
    ...none, ...fill(trim), poly([[16, 3], [27, 8], [25, 21], [16, 29], [7, 21], [5, 8]]),
    ...fill(c), poly([[16, 6], [24, 10], [22, 20], [16, 26], [10, 20], [8, 10]]),
];
const crown = (c, jewel) => [
    ...none, ...fill(c), poly([[5, 24], [7, 10], [12, 17], [16, 8], [20, 17], [25, 10], [27, 24]]),
    ...fill(c), rect(5, 23, 27, 27),
    ...fill(jewel), circ(16, 22, 2), ...fill(jewel), circ(9, 22, 2), ...fill(jewel), circ(23, 22, 2),
];
/** 고리 — 채운 원 두 개로는 구멍이 안 뚫린다(뒤 원이 앞을 덮을 뿐).
 *  굵은 선(stroke)으로 그려야 실제로 가운데가 비어 반지·톱니로 읽힌다. */
const ring = (c, teeth) => [
    ...stroke(c, 5), "-fill", "none", ["-draw", "circle 16,16 16,5"],
    ...(teeth ? [...none, ...fill(c),
        rect(15, 1, 18, 6), rect(15, 26, 18, 31), rect(1, 15, 6, 18), rect(26, 15, 31, 18)] : []),
];
const book = (cover, edge) => [
    ...none, ...fill(cover), rrect(6, 5, 26, 27, 2),
    ...fill(edge), rect(9, 5, 11, 27), ...fill(P.parch), rect(12, 8, 24, 24),
];
const star = (c, lt) => [
    ...none, ...fill(c), poly([[16, 3], [19, 13], [29, 16], [19, 19], [16, 29], [13, 19], [3, 16], [13, 13]]),
    ...fill(lt), poly([[16, 8], [18, 15], [16, 21], [14, 15]]),
];
const heart = (c, lt) => [
    ...none, ...fill(c), circ(11, 12, 6), ...fill(c), circ(21, 12, 6),
    ...fill(c), poly([[5, 14], [27, 14], [16, 29]]),
    ...fill(lt), circ(11, 10, 2),
];
const herb = (c, stem) => [
    ...none, ...fill(stem), rect(15, 14, 17, 29),
    ...fill(c), poly([[16, 14], [4, 10], [10, 3], [16, 9]]),
    ...fill(c), poly([[16, 16], [28, 12], [22, 5], [16, 11]]),
];
const coin = (c, lt) => [
    ...none, ...fill(c), circ(16, 16, 11), ...fill(lt), circ(16, 16, 8),
    ...stroke(c, 2), line(13, 11, 13, 21), line(19, 11, 19, 21),
];
const pouch = (c, tie) => [
    ...none, ...fill(c), circ(16, 20, 10), ...fill(c), rect(11, 8, 21, 20),
    ...fill(tie), rect(10, 8, 22, 11), ...fill(P.gold), circ(16, 21, 3),
];
const hourglass = (frame, sand) => [
    ...none, ...fill(frame), rect(7, 4, 25, 7), ...fill(frame), rect(7, 25, 25, 28),
    ...fill(sand), poly([[10, 8], [22, 8], [17, 16], [22, 24], [10, 24], [15, 16]]),
];
const boot = (c, sole) => [
    ...none, ...fill(c), rect(10, 4, 18, 20), ...fill(c), rect(10, 20, 26, 26),
    ...fill(sole), rect(9, 25, 27, 28),
];
const glove = (c, cuff) => [
    ...none, ...fill(c), rrect(10, 10, 22, 26, 3),
    ...fill(c), rect(11, 5, 13, 12), ...fill(c), rect(14, 3, 16, 12), ...fill(c), rect(17, 4, 19, 12),
    ...fill(cuff), rect(9, 24, 23, 28),
];
const wing = (c, lt) => [
    ...none, ...fill(c), poly([[16, 6], [4, 12], [8, 20], [16, 26]]),
    ...fill(lt), poly([[16, 6], [28, 12], [24, 20], [16, 26]]),
];
const bomb = (c, fuse) => [
    ...none, ...fill(c), circ(15, 19, 10), ...fill(P.stoneDk), rect(13, 6, 17, 10),
    ...fill(fuse), rect(17, 4, 24, 6), ...fill(P.amber), circ(26, 5, 2),
];
/** 자석 — U 자. 위쪽 반원을 굵은 선으로 그리고 다리 두 개를 세운다 */
const magnet = (c, tip) => [
    ...stroke(c, 6), "-fill", "none", ["-draw", "arc 6,6 26,26 180,360"],
    ...none, ...fill(c), rect(4, 16, 9, 26), ...fill(c), rect(23, 16, 28, 26),
    ...fill(tip), rect(4, 24, 9, 29), ...fill(tip), rect(23, 24, 28, 29),
];
const bell = (c, lip) => [
    ...none, ...fill(c), poly([[16, 4], [25, 22], [7, 22]]), ...fill(c), circ(16, 8, 4),
    ...fill(lip), rect(5, 21, 27, 25), ...fill(P.gold), circ(16, 27, 2),
];
const bolt = (c, lt) => [
    ...none, ...fill(c), poly([[19, 2], [8, 17], [15, 17], [12, 30], [25, 13], [17, 13]]),
    ...fill(lt), poly([[18, 5], [12, 15], [16, 15]]),
];
const cross = (c, lt) => [
    ...none, ...fill(c), rect(14, 3, 18, 29), ...fill(c), rect(6, 11, 26, 15),
    ...fill(lt), rect(15, 5, 16, 27),
];
const clover = (c, lt) => [
    ...none, ...fill(c), circ(11, 11, 6), ...fill(c), circ(21, 11, 6),
    ...fill(c), circ(11, 21, 6), ...fill(c), circ(21, 21, 6), ...fill(lt), circ(16, 16, 3),
];
const dice = (c, pip) => [
    ...none, ...fill(c), rrect(5, 5, 27, 27, 4),
    ...fill(pip), circ(11, 11, 2), ...fill(pip), circ(21, 11, 2), ...fill(pip), circ(16, 16, 2),
    ...fill(pip), circ(11, 21, 2), ...fill(pip), circ(21, 21, 2),
];
const shard = (c, lt) => [
    ...none, ...fill(c), poly([[16, 2], [24, 14], [18, 30], [10, 16]]),
    ...fill(lt), poly([[16, 2], [20, 13], [16, 17]]),
];
/** 목걸이 — 곡선 사슬 + 아래 매달린 보석 */
const pendant = (chain, jewel) => [
    ...stroke(chain, 2), "-fill", "none", ["-draw", "arc 5,2 27,26 200,340"],
    ...none, ...fill(jewel), poly([[16, 18], [22, 24], [16, 31], [10, 24]]),
    ...fill("#ffffff66"), circ(14, 22, 1),
];
const bird = (c, lt) => [
    ...none, ...fill(c), poly([[16, 4], [26, 16], [20, 16], [24, 28], [16, 22], [8, 28], [12, 16], [6, 16]]),
    ...fill(lt), circ(16, 10, 3),
];

// ── 66종 매핑 ──────────────────────────────────────────────
const ICONS = {
    itm_potion_s: potion(P.blood, 0.45), itm_potion_m: potion(P.blood, 0.75), itm_potion_l: potion(P.bloodLt, 1),
    itm_heart: heart(P.blood, P.bloodLt), itm_herb: herb(P.moss, "#4a5a2a"), itm_bomb: bomb(P.stoneDk, P.amber),
    itm_cross: cross(P.bone, "#ffffff"), itm_magnet: magnet(P.stone, P.blood), itm_zzz: bell(P.stone, P.stoneDk),
    itm_lightning: bolt(P.gold, P.goldLt), itm_shield: shield(P.stone, P.bone), itm_clover: clover(P.moss, P.candle),
    itm_flask_blue: potion(P.ice, 0.85), itm_flask_pink: potion(P.violet, 0.85), itm_flask_green: potion(P.moss, 0.85),
    itm_gem_teal: gem(P.candle, P.candleLt),
    itm_coin: coin(P.gold, P.goldLt), itm_pouch: pouch("#6b5030", "#4a3524"),
};
const FANG = [P.bone, "#c0c8d0", "#8fa0b0", P.parch, "#d8d0b8", P.bloodLt, "#e0e0e8", P.goldLt, "#b0b8ff", "#e8e8f0"];
FANG.forEach((c, i) => { ICONS["itm_fang_" + String(i + 1).padStart(2, "0")] = sword(c, i > 6 ? P.gold : P.stone); });
const HIDE = ["#6b5030", P.moss, "#8a6a9a", P.gold, "#5a5060", "#909aa8", P.bone, "#a0a8b0", P.stoneDk, P.stone];
HIDE.forEach((c, i) => {
    ICONS["itm_hide_" + String(i + 1).padStart(2, "0")] =
        i === 9 ? shield(c, P.gold) : armor(c, i > 5 ? P.bone : P.stoneDk);
});
const CHARM = [P.blood, P.amber, P.ice, P.moss, P.violet, P.bone, P.candle, "#4a8f7a"];
CHARM.forEach((c, i) => { ICONS["itm_charm_" + String(i + 1).padStart(2, "0")] = gem(c, "#ffffffaa"); });
ICONS.itm_charm_09 = ring(P.gold, false);
ICONS.itm_charm_10 = pendant(P.stone, P.blood);
Object.assign(ICONS, {
    itm_relic_crown_gold: crown(P.gold, P.bloodLt), itm_relic_crown_iron: crown(P.stone, P.ice),
    itm_relic_crown_red: crown(P.blood, P.goldLt), itm_relic_gear_iron: ring(P.stone, true),
    itm_relic_gear_gold: ring(P.gold, true), itm_relic_shard_ice: shard(P.ice, "#d8f0ff"),
    itm_relic_crystal: shard(P.violet, "#e0c8ff"), itm_relic_hourglass: hourglass(P.gold, P.parch),
    itm_relic_glove: glove("#6b5030", P.stoneDk), itm_relic_boot: boot(P.stoneDk, P.stone),
    itm_relic_book: book(P.blood, P.gold), itm_relic_burst_amber: star(P.amber, P.goldLt),
    itm_relic_burst_void: star(P.violet, "#d8b0ff"), itm_relic_wing: wing(P.stone, P.bone),
    itm_relic_pendant: pendant(P.bone, P.candle), itm_relic_spark: star(P.goldLt, "#ffffff"),
    itm_relic_dice: dice(P.bone, P.voidC), itm_relic_phoenix: bird(P.amber, P.goldLt),
});

// ── 출력 ───────────────────────────────────────────────────
const items = JSON.parse(readFileSync(resolve(FE, "src/data/items.json"), "utf8"));
const keys = [...new Set(items.bases.map((b) => b.icon))];
const missing = keys.filter((k) => !ICONS[k]);
if (missing.length) throw new Error("아이콘 정의 누락: " + missing.join(", "));


// ── ★ 덮어쓰기 방지 ────────────────────────────────────────────
//   지금 실려 있는 public/assets/items/items.png 는 이 스크립트의 산출물이 아니다.
//   (둘 다 돌려 픽셀 비교로 확인했다 — 완전히 다른 그림이 나온다.)
//   그런데 npm run build:all-assets 는 build:items 를 부르므로, 아무 생각 없이
//   전체 에셋을 다시 구우면 손으로 큐레이션한 아이콘 71종이 조용히 사라진다.
//   그래서 아틀라스의 meta.app 이 이 스크립트가 아니면 멈춘다. 정말 갈아엎을 때만 --force.
{
    const guardOut = resolve(FE, "public/assets/items/items.json");
    if (existsSync(guardOut) && !process.argv.includes("--force")) {
        const cur = JSON.parse(readFileSync(guardOut, "utf8"))?.meta?.app ?? "(불명)";
        if (cur !== "tools/gen-item-icons.mjs") {
            console.warn("⚠ 건너뛴다 — 지금 실린 아이템 아틀라스는 \"" + cur + "\" 가 만든 것이다.");
            console.warn("  이 스크립트로 덮으면 손으로 큐레이션한 아이콘 71종이 사라진다.");
            console.warn("  정말 다시 구우려면 --force 를 붙여라. (build:all-assets 를 막지 않으려고 0 으로 끝낸다)");
            process.exit(0);
        }
    }
}
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const cells = [];
for (const k of keys) {
    const f = resolve(TMP, k + ".png");
    run([...draw(ICONS[k]), f]);
    cells.push({ key: k, file: f });
}
// 등급 후광 — 크기와 밝기로도 등급이 갈린다(색맹 대응, 10-UIUX 9.1)
items.rarities.forEach((r, tier) => {
    const f = resolve(TMP, "itm_halo_" + r.id + ".png");
    const rad = 12 + tier;
    const a = (0.18 + tier * 0.07).toFixed(2);
    run(["-size", S + "x" + S, "xc:none", "-fill", r.color, "-draw",
         "circle " + (S / 2) + "," + (S / 2) + " " + (S / 2) + "," + (S / 2 - rad),
         "-channel", "A", "-evaluate", "multiply", a, "+channel", "-blur", "0x2", f]);
    cells.push({ key: "itm_halo_" + r.id, file: f });
});

const COLS = 12;
const rows = Math.ceil(cells.length / COLS);
run(["montage", ...cells.map((c) => c.file), "-tile", COLS + "x" + rows,
     "-geometry", S + "x" + S + "+0+0", "-background", "none", resolve(OUT, "items.png")]);

const frames = {};
cells.forEach((c, i) => {
    frames[c.key] = {
        frame: { x: (i % COLS) * S, y: ((i / COLS) | 0) * S, w: S, h: S },
        rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: S, h: S }, sourceSize: { w: S, h: S },
    };
});
writeFileSync(resolve(OUT, "items.json"), JSON.stringify({
    frames,
    meta: { app: "tools/gen-item-icons.mjs", image: "items.png",
            size: { w: COLS * S, h: rows * S }, scale: "1" },
}, null, 2) + "\n");
rmSync(TMP, { recursive: true, force: true });
console.log("절차 생성 아이콘 " + keys.length + " + 후광 " + items.rarities.length + " = " + cells.length + "프레임");
console.log("  " + (COLS * S) + "x" + (rows * S) + "px -> public/assets/items/items.{png,json}  (외부 에셋 의존 0)");
