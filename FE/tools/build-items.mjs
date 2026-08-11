/**
 * ⚠ DEPRECATED — tools/gen-item-icons.mjs 로 대체됐다.
 *   이 스크립트는 Raven Fantasy(무료판은 수익화 불가)와 pixel items(제작자 미상)에 의존한다.
 *   예산 0 + 수익화 방향이 확정되어 아이콘을 절차적으로 생성하는 쪽으로 바꿨다.
 *   나중에 Raven 프리미엄을 구매하면 이 스크립트와 item-icon-map.json 을 되살릴 수 있다.
 *
 * build-items.mjs — 아이템 아이콘 아틀라스 생성.
 *
 * ★ 왜 448+2192 장을 전부 넣지 않는가
 *   실제로 쓰는 아이콘은 items.json 의 66종뿐이다. 시트를 통째로 넣으면
 *   텍스처 메모리를 수 MB 낭비하고 모바일에서 그대로 부담이 된다.
 *   필요한 것만 잘라 한 장으로 묶는다.
 *
 * ★ 왜 스프라이트시트가 아니라 아틀라스(이름 있는 프레임)인가
 *   items.json 이 아이콘을 `itm_potion_s` 같은 **이름**으로 참조한다.
 *   숫자 인덱스로 바꾸면 아이템을 하나 추가·삭제할 때마다 전 인덱스가 밀린다.
 *   이름이면 데이터만 고치면 되고 코드는 그대로다.
 *
 * ★ 출처 두 곳
 *   - asset/item/pixel items{0..6}.png — 8x8 격자 32px. 전부 무기·장비류다.
 *   - asset/icons/.../IconSet.png      — RPG Maker MV 규격 16열 32px. 소모품·보석·룬이 여기 있다.
 *   매핑은 tools/item-icon-map.json 에 분리했다 — 아이콘 교체는 데이터 수정이지 코드 수정이 아니다.
 *
 * 사용: node tools/build-items.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const OUT_DIR = resolve(FE, "public/assets/items");
const TMP = resolve(FE, ".tmp-items");
const CELL = 32;
const COLS = 12; // 71프레임 -> 12x6. 2의 거듭제곱이 아니어도 되지만 폭 384는 안전한 크기다

function magick() {
    for (const c of ["magick", "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe", "/usr/bin/magick"]) {
        try { execFileSync(c, ["-version"], { stdio: "ignore" }); return c; } catch { /* 다음 후보 */ }
    }
    throw new Error("ImageMagick(magick)을 찾지 못했다. 설치 후 PATH에 넣을 것.");
}

const MG = magick();
const run = (args) => execFileSync(MG, args, { stdio: ["ignore", "pipe", "pipe"] });

const items = JSON.parse(readFileSync(resolve(FE, "src/data/items.json"), "utf8"));
const map = JSON.parse(readFileSync(resolve(HERE, "item-icon-map.json"), "utf8"));

const SRC = {
    px: (n) => resolve(ROOT, `asset/item/pixel items${n}.png`),
    rv: resolve(ROOT, "asset/icons/Free - Raven Fantasy Icons/RPG Maker MV and MZ/IconSet.png"),
};

/** 출처 표기 "px3:17" / "rv:272" -> 크롭 좌표 */
function cropOf(spec) {
    const [src, idxStr] = spec.split(":");
    const idx = Number(idxStr);
    if (src.startsWith("px")) {
        const sheet = Number(src.slice(2));
        return { file: SRC.px(sheet), x: (idx % 8) * CELL, y: ((idx / 8) | 0) * CELL };
    }
    return { file: SRC.rv, x: (idx % 16) * CELL, y: ((idx / 16) | 0) * CELL };
}

mkdirSync(OUT_DIR, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// ── 1) 필요한 아이콘 키를 items.json 순서대로 모은다
const keys = [];
for (const b of items.bases) if (!keys.includes(b.icon)) keys.push(b.icon);
const missing = keys.filter((k) => !map.icons[k]);
if (missing.length) {
    console.warn(`⚠ 매핑이 없는 아이콘 ${missing.length}개 — 대체 아이콘으로 채운다:`, missing.slice(0, 8).join(", "));
}

// ── 2) 등급 후광. 아이콘이 아니라 절차적으로 그린다 —
//      아트 의뢰를 늘리지 않으면서 등급을 색이 아닌 '밝기 + 크기'로도 구분할 수 있다.
const halos = items.rarities.map((r) => ({ key: "itm_halo_" + r.id, color: r.color, tier: items.rarities.indexOf(r) }));

const cells = [];
for (const k of keys) {
    const spec = map.icons[k] ?? map.fallback;
    const c = cropOf(spec);
    const out = resolve(TMP, `${k}.png`);
    if (!existsSync(c.file)) throw new Error("원본이 없다: " + c.file);
    run([c.file, "-crop", `${CELL}x${CELL}+${c.x}+${c.y}`, "+repage", out]);
    cells.push({ key: k, file: out });
}
for (const h of halos) {
    const out = resolve(TMP, `${h.key}.png`);
    const r = 12 + h.tier;                       // 등급이 높을수록 후광이 크다(색맹 대응)
    const a = (0.18 + h.tier * 0.07).toFixed(2); // 그리고 밝다
    run(["-size", `${CELL}x${CELL}`, "xc:none", "-fill", h.color, "-draw",
         `circle ${CELL / 2},${CELL / 2} ${CELL / 2},${CELL / 2 - r}`,
         "-channel", "A", "-evaluate", "multiply", a, "+channel",
         "-blur", "0x2", out]);
    cells.push({ key: h.key, file: out });
}

// ── 3) 한 장으로 묶는다
const rows = Math.ceil(cells.length / COLS);
const atlasPng = resolve(OUT_DIR, "items.png");
run(["montage", ...cells.map((c) => c.file), "-tile", `${COLS}x${rows}`,
     "-geometry", `${CELL}x${CELL}+0+0`, "-background", "none", atlasPng]);

// ── 4) Phaser 아틀라스 JSON (JSONHash)
const frames = {};
cells.forEach((c, i) => {
    frames[c.key] = {
        frame: { x: (i % COLS) * CELL, y: ((i / COLS) | 0) * CELL, w: CELL, h: CELL },
        rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
        sourceSize: { w: CELL, h: CELL },
    };
});
writeFileSync(resolve(OUT_DIR, "items.json"), JSON.stringify({
    frames,
    meta: { app: "tools/build-items.mjs", image: "items.png", size: { w: COLS * CELL, h: rows * CELL }, scale: "1" },
}, null, 2) + "\n");

rmSync(TMP, { recursive: true, force: true });
const bytes = readFileSync(atlasPng).length;
console.log(`아이템 아틀라스: ${cells.length}프레임 (아이콘 ${keys.length} + 후광 ${halos.length})`);
console.log(`  ${COLS * CELL}x${rows * CELL}px / ${(bytes / 1024).toFixed(1)}KB -> public/assets/items/items.{png,json}`);
if (missing.length) console.log(`  ⚠ 매핑 미지정 ${missing.length}개는 대체 아이콘이다 — item-icon-map.json 을 채우면 바로 반영된다`);
