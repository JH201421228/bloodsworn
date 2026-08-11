#!/usr/bin/env node
/**
 * validate-data.mjs — 브라우저 없이 데이터 검증. `npm run validate` / CI 용.
 *
 * ★ 왜 노드판이 따로 있나: 브라우저판(src/data/validate.js)은 게임을 켜야 돈다.
 *   그런데 데이터 불일치는 **커밋 시점**에 잡아야 싸다. 게임을 켜서 stage3 까지
 *   플레이해야 발견되는 종류의 사고를 여기서 0.2초에 잡는다.
 *
 * ★ 규칙은 여기 없다. src/data/validate.js 의 runRules 한 벌을 그대로 쓴다.
 *   두 벌로 쓰면 반드시 어긋나고, 어긋난 검증기는 오탐을 낸다(실제로 460건 냈다).
 *   이 파일이 하는 일은 **묶음 만들기**뿐이다 — 브라우저는 정적 import,
 *   여기는 fs 로 읽는다. 대신 번들 밖 파일(public/assets.json, 아이템 아틀라스)까지
 *   읽을 수 있어서 검사 범위가 더 넓다.
 *
 * ★ 위반이 있으면 exit 1. CI 에 그대로 걸 수 있다.
 *   경고(warn)는 exit code 를 바꾸지 않는다 — 폴백이 있어 굴러는 가는 것들이라
 *   여기서 빌드를 막으면 사람들이 --no-verify 를 배운다. `--strict` 로 올릴 수 있다.
 *
 * 사용법:
 *   node tools/validate-data.mjs            위반만 exit 1
 *   node tools/validate-data.mjs --strict   경고도 exit 1
 *   node tools/validate-data.mjs --quiet    경고 출력 생략
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, relative, sep } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const DATA = resolve(FE, "src/data");

const STRICT = process.argv.includes("--strict");
const QUIET = process.argv.includes("--quiet");

/** 읽기 실패·파싱 실패 자체가 위반 1건이다. 여기서 던지면 나머지 파일을 못 본다. */
const loadErrors = [];
function readJson(abs, { optional = false } = {}) {
    const rel = relative(FE, abs).split(sep).join("/");
    if (!existsSync(abs)) {
        if (!optional) loadErrors.push(`${rel}: 파일이 없다`);
        return null;
    }
    try {
        return JSON.parse(readFileSync(abs, "utf8"));
    } catch (e) {
        loadErrors.push(`${rel}: JSON 파싱 실패 — ${e.message}`);
        return null;
    }
}

const d = (name) => readJson(resolve(DATA, name));

/**
 * 아이템 아틀라스 프레임 표를 {이름: {x,y,w,h}} 로 통일한다.
 * 두 사본이 형식이 다르다 —
 *   public/assets/items/items.json  : {frames: {name: {frame: {x,y,w,h}}}}  (Phaser 아틀라스)
 *   src/ui/inventory/itemFrames.json: {frames: {name: [x,y,w,h]}}           (React 용 압축본)
 * 좌표 중복 검사는 이 정규화된 표 위에서 돈다.
 */
function normFrames(raw) {
    if (!raw?.frames) return null;
    const out = {};
    for (const [name, v] of Object.entries(raw.frames)) {
        if (Array.isArray(v)) out[name] = { x: v[0], y: v[1], w: v[2], h: v[3] };
        else if (v?.frame) out[name] = { x: v.frame.x, y: v.frame.y, w: v.frame.w, h: v.frame.h };
        else if (typeof v?.x === "number") out[name] = { x: v.x, y: v.y, w: v.w, h: v.h };
    }
    return out;
}

const bundle = {
    weapons: d("weapons.json"),
    enemies: d("enemies.json"),
    blessings: d("blessings.json"),
    tolls: d("tolls.json"),
    phases: d("phases.json"),
    nocturne: d("nocturneLines.json"),
    stages: d("stages.json"),
    boss: d("boss.json"),
    bossAtlas: d("boss-atlas.json"),
    items: d("items.json"),
    affixes: d("affixes.json"),
    droptables: d("droptables.json"),
    projectiles: d("projectiles.json"),
    awakenings: d("awakenings.json"),
    sanctum: d("sanctum.json"),
    audio: d("audio.json"),
    // ── 번들 밖. 브라우저판은 이 셋을 못 보므로 여기서만 검사된다 ──
    manifest: readJson(resolve(FE, "public/assets.json"), { optional: true }),
    itemAtlas: normFrames(readJson(resolve(FE, "public/assets/items/items.json"), { optional: true })),
    itemFrames: normFrames(readJson(resolve(FE, "src/ui/inventory/itemFrames.json"), { optional: true })),
};

const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const OFF = "\u001b[0m";

function report(errors, warns) {
    if (errors.length) {
        console.error(`${RED}[데이터 검증] 위반 ${errors.length}건${OFF}`);
        errors.forEach((e, i) => console.error(`  ${String(i + 1).padStart(3)}. ${e}`));
    }
    if (warns.length && !QUIET) {
        console.error(`${YELLOW}[데이터 검증] 경고 ${warns.length}건 (폴백이 있어 굴러는 간다)${OFF}`);
        warns.forEach((w, i) => console.error(`  ${String(i + 1).padStart(3)}. ${w}`));
    }
    if (!errors.length && !warns.length) console.log(`${GREEN}[데이터 검증] 통과 — 위반 0건${OFF}`);
    else console.error(`요약: 위반 ${errors.length} / 경고 ${warns.length}`);
}

// ★ 규칙 본체는 파싱이 전부 통과한 뒤에 부른다.
//   validate.js 는 브라우저용으로 JSON 을 정적 import 하므로, 깨진 JSON 이 하나라도
//   있으면 import 단계에서 스택만 뱉고 끝난다 — "어느 파일이 깨졌는지"를 먼저 알려준다.
if (loadErrors.length) {
    report(loadErrors, []);
    process.exit(1);
}

const { runRules } = await import(pathToFileURL(resolve(DATA, "validate.js")).href);
const { errors, warns } = runRules(bundle);
report(errors, warns);

// 경고는 기본적으로 통과시킨다 — 위 주석의 --no-verify 근거를 보라.
process.exit(errors.length || (STRICT && warns.length) ? 1 : 0);
