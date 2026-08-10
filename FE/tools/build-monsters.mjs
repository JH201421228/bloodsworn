/**
 * 몬스터 파이프라인 — asset/monsters/ 의 10계열 x 15종 = 150종을 단일 아틀라스로 굽고,
 * 종별 메타(monster-catalog.json)와 스탯(enemies.json)을 함께 생성한다.
 *
 * 근거: 05-COMBAT-AND-BALANCE 4(적 상세표) 5(스폰) / 09-ART-AUDIO-AND-ASSET-MAP 2
 * 실행: node tools/build-monsters.mjs   (FE/ 에서)
 * 산출: public/assets/enemies/monsters.png · src/data/monster-catalog.json · src/data/enemies.json
 *
 * ★ 왜 build-assets.mjs 의 "세로 병합"을 150종에 그대로 쓰지 않는가
 *   10종이면 64x160 한 장으로 끝난다. 150종을 같은 방식으로 이으면 64x2400 이 된다.
 *   폭 64 짜리 세로 스트립은 (a) 한 행에 1종만 들어가서 프레임 인덱스가 시트 폭과 얽히고
 *   (b) 모바일 GPU 가 텍스처를 타일 단위로 캐시하는데 세로로만 긴 배치는 캐시 적중이 최악이다.
 *   32열(512px) 격자로 바꾸면 한 행 = 32칸 = 8종 x 4프레임이라 종이 행 경계에서 쪼개지지 않고,
 *   종 i 의 프레임 시작 인덱스가 정확히 i*4 로 떨어진다. 계산이 폭에 의존하지 않는다.
 *
 * ★ 왜 150장 개별 텍스처가 아니라 아틀라스 1장인가 — 드로우콜과 텍스처 메모리
 *   Phaser 의 Multi Pipeline 은 같은 텍스처가 연속으로 그려질 때만 배치를 유지한다.
 *   적 150체가 종을 섞어 깔리면 깊이 정렬 순서대로 텍스처가 계속 바뀌므로 최악의 경우
 *   프레임당 150회 배치가 끊긴다. 13-QA 6 의 차단선(적 150체 1% Low >= 40fps)은
 *   픽셀 채우기가 아니라 이 드로우콜에서 먼저 깨진다 — 640x360 은 채울 픽셀 자체가 적다.
 *   아틀라스 1장이면 텍스처 바인드가 1회로 고정되어 종이 150이든 1500이든 배치가 안 끊긴다.
 *   메모리도 아틀라스가 유리하다. 512x304 RGBA8888 = 622,592B ≈ 0.59MB 한 덩어리인 반면
 *   개별 텍스처 150장은 원본 바이트 합이 비슷해도 GL 텍스처 오브젝트 150개 +
 *   로드 요청 150회가 되고, 텍스처마다 드라이버 정렬 패딩이 따로 붙는다.
 *
 * ★ 왜 Phaser atlas(JSON) 가 아니라 균일 격자 spritesheet 인가
 *   JSON 아틀라스는 프레임 600개의 좌표 객체를 파싱해 Map 에 올린다. 균일 격자는 좌표가
 *   인덱스 산술로 나오므로 JSON 이 0바이트다. 프레임 크기가 전부 16x16 로 정규화되는 마당에
 *   좌표표를 따로 들고 다닐 이유가 없다. PreloadScene 의 spritesheets 항목만 하나 늘면 된다.
 *
 * ★ 왜 알파 바운딩박스를 재는가 — 히트박스
 *   16x16 캔버스에 실제 몸통이 11x9 인 종이 흔하다(흡혈박쥐 실측). 캔버스 크기로 반경을 8 로 잡으면
 *   허공에서 맞는다. 그래서 프레임 4장의 알파 bbox 를 재서 중앙값을 몸통으로 본다.
 *   중앙값을 쓰는 이유: 합집합은 날갯짓 한 프레임 때문에 부풀고, 최소값은 웅크린 프레임 때문에 쪼그라든다.
 *
 * ★ 왜 프레임마다가 아니라 종 단위로 재중심을 잡는가
 *   프레임별로 bbox 를 중앙 정렬하면 걷기 애니메이션의 상하 바운스가 통째로 지워져 제자리 정지처럼 보인다.
 *   그래서 4프레임 합집합 bbox 로 한 번만 잘라내 4프레임에 같은 오프셋을 먹인다.
 *   몸통 중심 = 셀 중심이 되면서 프레임 간 상대 움직임은 원본 그대로 남는다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const SRC = resolve(ROOT, "asset/monsters");
const OUT_TEX = resolve(FE, "public/assets/enemies");
const OUT_DATA = resolve(FE, "src/data");

/** 셀 한 칸. 논리 해상도 640x360 에서 16px 는 플레이어(96x80 중 실체 약 20px)와 어울리는 크기다 */
const CELL = 16;
/** 격자 열 수. 32 = 8종 x 4프레임 → 종이 행 경계에서 쪼개지지 않는 유일하게 깔끔한 값 */
const COLS = 32;
const FRAMES = 4;
const SPECIES_PER_ROW = COLS / FRAMES;

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

// ── 1. 계열 정의 ────────────────────────────────────────────
/**
 * 배열 순서가 곧 아틀라스 배치 순서이자 프레임 인덱스 순서다.
 * 스테이지 진행(묘지 → 들판 → 늪 → 첨탑 → 지옥문 → 성채) 순으로 늘어놓아
 * 아틀라스를 눈으로 열었을 때 런의 순서가 그대로 보이게 했다.
 */
const FAMILIES = [
    { key: "undead",    code: "UD", ko: "언데드",   dir: "Basic Undead Animations" },
    { key: "vermin",    code: "VM", ko: "해충",     dir: "Basic Vermin Animations" },
    { key: "animal",    code: "AN", ko: "야수",     dir: "Basic Animal Animations" },
    { key: "monster",   code: "MN", ko: "거수",     dir: "Basic Monster Animations" },
    { key: "humanoid",  code: "HU", ko: "인간형",   dir: "Basic Humanoid Animations" },
    { key: "humanoid2", code: "HX", ko: "이종족",   dir: "Basic Humanoid II Animations" },
    { key: "magical",   code: "MG", ko: "마법생물", dir: "basic magical animations" },
    { key: "demon",     code: "DM", ko: "악마",     dir: "Basic Demon Animations" },
    { key: "dragon",    code: "DR", ko: "용족",     dir: "Basic Dragon Animations" },
    { key: "holy",      code: "HL", ko: "천상",     dir: "Basic Holy Animations" },
];

/** 폴더명 대소문자가 팩마다 다르다(basic magical animations). 소문자로 맞춰 비교한다 */
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** asset/monsters/*(팩)/*(팩)/<계열 폴더>/<종 폴더>/<종>.png 를 전수 스캔한다 */
function scanFamilies() {
    const found = new Map();
    for (const pack of readdirSync(SRC)) {
        const inner = resolve(SRC, pack);
        if (!statSync(inner).isDirectory()) continue;
        for (const sub of readdirSync(inner)) {
            const lvl2 = resolve(inner, sub);
            if (!statSync(lvl2).isDirectory()) continue;
            for (const famDir of readdirSync(lvl2)) {
                const famPath = resolve(lvl2, famDir);
                if (!statSync(famPath).isDirectory()) continue;
                const fam = FAMILIES.find((f) => norm(f.dir) === norm(famDir));
                if (!fam) continue;
                found.set(fam.key, famPath);
            }
        }
    }
    return found;
}

/** 경로 구분자. 이 파일 안에서 역슬래시 리터럴을 쓰지 않기 위해 코드포인트로 만든다 */
const SEP = String.fromCharCode(92);
const SEP_RE = new RegExp("[" + SEP + SEP + "/]");
const relSrc = (p) => p.slice(ROOT.length + 1).split(SEP).join("/");

/** 종 폴더 안에서 png 를 찾는다. .aseprite/.gif 는 원본 작업 파일이라 건너뛴다 */
function speciesPng(dir) {
    const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png"));
    if (!files.length) return null;
    // 이름이 폴더와 같은 것을 우선한다. 시트가 여러 장인 팩에 대비한 안전장치다
    const want = norm(dir.split(SEP_RE).pop()).replace(/\s/g, "");
    return join(dir, files.find((f) => norm(f).replace(/\s|\.png/g, "") === want) ?? files[0]);
}

// ── 2. 알파 bbox 실측 ───────────────────────────────────────
/**
 * 프레임 4장의 알파 바운딩박스를 한 번의 magick 호출로 뽑는다.
 * -crop WxH (오프셋 없음) 는 이미지를 타일로 쪼개고, 뒤따르는 연산은 시퀀스 전체에 적용된다.
 * -alpha extract 로 알파를 회색조로 꺼낸 뒤 -threshold 0 이면 불투명 픽셀만 흰색이 된다.
 * %@ 는 그 상태의 트림 bbox 다. 원본을 건드리지 않고 좌표만 얻는다.
 */
function measure(png, fw, fh) {
    let out;
    try {
        out = magick([png, "-crop", `${fw}x${fh}`, "+repage", "-alpha", "extract",
            "-threshold", "0", "-format", "%@\n", "info:"]).toString();
    } catch {
        return null;
    }
    const boxes = [];
    for (const line of out.split("\n")) {
        const m = /^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/.exec(line.trim());
        // 완전히 빈 프레임은 %@ 가 0x0 이거나 파싱에 실패한다. 캔버스 전체로 폴백한다
        if (!m) continue;
        const [w, h, x, y] = [+m[1], +m[2], +m[3], +m[4]];
        boxes.push(w > 0 && h > 0 ? { w, h, x, y } : { w: fw, h: fh, x: 0, y: 0 });
    }
    if (!boxes.length) return null;
    // 중앙값 = 몸통(히트박스용). 짝수 개면 아래쪽 중앙값을 택한다 — 히트박스는 과대보다 과소가 안전하다
    const mid = (arr) => arr.slice().sort((a, b) => a - b)[(arr.length - 1) >> 1];
    const bodyW = mid(boxes.map((b) => b.w));
    const bodyH = mid(boxes.map((b) => b.h));
    // 합집합 = 재중심용. 4프레임 어느 것도 잘리지 않는 최소 사각형
    const ux = Math.min(...boxes.map((b) => b.x));
    const uy = Math.min(...boxes.map((b) => b.y));
    const uw = Math.max(...boxes.map((b) => b.x + b.w)) - ux;
    const uh = Math.max(...boxes.map((b) => b.y + b.h)) - uy;
    return { boxes, bodyW, bodyH, union: { x: ux, y: uy, w: uw, h: uh } };
}

// ── 3. 계열 아키타입 ────────────────────────────────────────
/**
 * 150종을 손으로 나열하지 않는다. 계열 기준선 x 역할 배수 x 등급 배수 x 몸통 크기 로 유도한다.
 * 밸런싱 노브가 150개가 아니라 아래 표 세 개로 줄어드는 것이 이 구조의 전부다.
 *
 * 기준선은 05-COMBAT 4.2 의 E1~E8 곡선이다. 플레이어 이동속도 70px/s 를 기준으로
 * "따라잡는 놈"과 "키팅이 통하는 놈"의 비율(정본 3:5)을 계열 단위로 재현한다.
 *   추격형 계열(해충 118 / 야수 96)  = 플레이어보다 빠름
 *   나머지 8계열(42~76)              = 느림 → 키팅 성립
 */
const ARCHETYPES = {
    //                     hp  spd  dmg   kb   기본역할     성격
    undead:    { hp: 20, spd: 55, dmg: 7,  kb: 0.25, role: "chase" },
    vermin:    { hp: 6,  spd: 118, dmg: 4, kb: 0,    role: "overshoot" },
    animal:    { hp: 14, spd: 96, dmg: 6,  kb: 0.10, role: "chase" },
    monster:   { hp: 40, spd: 42, dmg: 13, kb: 0.50, role: "stagger" },
    humanoid:  { hp: 20, spd: 68, dmg: 8,  kb: 0.15, role: "chase" },
    humanoid2: { hp: 18, spd: 76, dmg: 7,  kb: 0.10, role: "chase" },
    magical:   { hp: 16, spd: 72, dmg: 9,  kb: 0.05, role: "ranged" },
    demon:     { hp: 30, spd: 62, dmg: 12, kb: 0.20, role: "charge" },
    dragon:    { hp: 36, spd: 58, dmg: 11, kb: 0.40, role: "ranged" },
    holy:      { hp: 28, spd: 66, dmg: 10, kb: 0.35, role: "chase" },
};

/**
 * 역할 배수. ai 값은 EnemyAISystem 이 실제로 분기하는 문자열과 1:1 이다
 * (chase/stagger/overshoot/zigzag/ranged/charge/shockwave). 새 값을 만들면 조용히 chase 로 떨어진다.
 * behavior 는 설계 문서용 라벨이고 swarm 만 ai 와 다르다 — 구현상 무리는 zigzag + swarmOnly 다.
 */
const ROLES = {
    chase:     { ai: "chase",     hp: 1.00, spd: 1.00, dmg: 1.00 },
    stagger:   { ai: "stagger",   hp: 1.35, spd: 0.68, dmg: 1.10 },
    overshoot: { ai: "overshoot", hp: 0.70, spd: 1.10, dmg: 1.00 },
    zigzag:    { ai: "zigzag",    hp: 0.80, spd: 1.08, dmg: 0.95 },
    // 원거리는 접촉 데미지를 대폭 깎는다. 위협은 투사체가 준다(05-COMBAT 4.2 E6 근거)
    ranged:    { ai: "ranged",    hp: 0.70, spd: 0.74, dmg: 0.42 },
    charge:    { ai: "charge",    hp: 1.05, spd: 0.88, dmg: 1.25 },
    shockwave: { ai: "shockwave", hp: 1.50, spd: 0.76, dmg: 1.20 },
    swarm:     { ai: "zigzag",    hp: 0.50, spd: 1.16, dmg: 0.72, swarmOnly: true },
};

/**
 * 등급 배수. 엘리트 hp x12 는 EL1(E4 18 x 20 = 360)보다 낮게 잡은 값인데,
 * EL1/EL2 는 이벤트로 등장하는 지명 엘리트라 일반 풀의 엘리트보다 무거워야 하기 때문이다.
 * scale 은 16px 셀을 렌더 배율로 키운다. 히트박스는 캔버스가 아니라 몸통 x scale 로 뽑는다
 * — 여기서 캔버스를 쓰면 정확히 "허공에서 맞는" 버그가 된다.
 */
const TIERS = {
    normal:   { hp: 1,  spd: 1.00, dmg: 1.0, kb: null, scale: 1 },
    elite:    { hp: 12, spd: 0.86, dmg: 1.7, kb: 1,    scale: 1.75 },
    miniboss: { hp: 26, spd: 0.80, dmg: 2.2, kb: 1,    scale: 2.1 },
};

/**
 * 이름 키워드 → 역할. 위에서부터 먼저 맞는 규칙이 이긴다.
 * 스프라이트를 눈으로 보고 150줄을 채우는 대신 이름이 이미 담고 있는 정보를 쓴다.
 */
const ROLE_RULES = [
    { role: "ranged", re: /archer|sharpshooter|slinger|javelineer|occultist|necromancer|sorceress|pyromancer|witch|mystic|enchanter|druid|cleric|priest|acolyte|aquamancer|bard|wisp|pixie|fairy|warp skull|shrieker/i },
    { role: "shockwave", re: /balor|planetar|archon|deva|angel|golem|treant|ettin|cyclops|ogre|troll|elemental|adult |mature |humongous|crushing/i },
    { role: "charge", re: /wolf|boar|rider|assassin|rogue|stalker|impaler|bladedancer|gladiator|crusader|imp\b|scamp|gremlin|hound|abomination|gouger|skewering|porcupine|rhino|soldier|fanatic|blackguard|feeder/i },
    { role: "swarm", re: /\bant\b|tick|bedbug|cockroach|scarab|maggot/i },
    { role: "zigzag", re: /bat\b|frog|toad|goose|chick|cherub|floating|swooping|leaping|scout|wayfarer|eye\b|watcher|hand|pixie|drake|wyvern/i },
    { role: "stagger", re: /slime|jelly|stumbler|cadaver|turtle|mole|beaver|bones|crawler|sheep|\bpig\b|myconid|mushroom|grimlock|ghoul|villager|shepard|friar|kid\b|child|youth|adolescent/i },
];

/** 종 이름 해시 — 같은 계열 안에서 수치가 완전히 똑같아지지 않게 ±7% 를 결정적으로 흔든다 */
function jitter(key, spread = 0.07) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 1 + (((h >>> 0) % 2001) / 1000 - 1) * spread;
}

// ── 4. 기존 10종 고정 ───────────────────────────────────────
/**
 * E1~E8/EL1/EL2 는 05-COMBAT 4.2/4.4 의 정본 수치이고 phases.json 12구간 가중치가 이 ID 를 참조한다.
 * 150종이 들어와도 6분 런의 곡선이 무너지면 안 되므로 이 10종만은 유도식에 태우지 않고 원문 그대로 박는다.
 * (확장 전 enemies.json 과 값이 완전히 같다. 달라지는 것은 anim 이 통합 아틀라스를 가리키는 것뿐이고,
 *  그건 registerAnims 가 카탈로그를 읽어 처리한다.)
 */
const LEGACY = {
    "Vampire Bat":         { id: "E1",  name: "흡혈박쥐",      baseHp: 8,   contactDamage: 4,  moveSpeed: 95,  hitbox: 12, expValue: 1, unlockAt: 0,   ai: "chase",     knockbackResist: 0 },
    "Mutilated Stumbler":  { id: "E2",  name: "썩은 비틀거림", baseHp: 26,  contactDamage: 8,  moveSpeed: 38,  hitbox: 14, expValue: 2, unlockAt: 0,   ai: "stagger",   knockbackResist: 0.3, params: { moveDuration: 0.8, pauseDuration: 0.2 } },
    "Skittering Hand":     { id: "E3",  name: "기어오는 손",   baseHp: 4,   contactDamage: 5,  moveSpeed: 135, hitbox: 10, expValue: 1, unlockAt: 30,  ai: "overshoot", knockbackResist: 0, params: { retarget: 0.5 } },
    "Decrepit Bones":      { id: "E4",  name: "낡은 해골",     baseHp: 18,  contactDamage: 6,  moveSpeed: 62,  hitbox: 14, expValue: 2, unlockAt: 90,  ai: "chase",     knockbackResist: 0, params: { separation: 14 } },
    "Grave Revenant":      { id: "E5",  name: "무덤 망령",     baseHp: 22,  contactDamage: 7,  moveSpeed: 70,  hitbox: 14, expValue: 3, unlockAt: 90,  ai: "zigzag",    knockbackResist: 0, params: { amplitude: 40, period: 1.2 } },
    "Brittle Archer":      { id: "E6",  name: "부서진 궁수",   baseHp: 14,  contactDamage: 3,  moveSpeed: 48,  hitbox: 14, expValue: 3, unlockAt: 180, ai: "ranged",    knockbackResist: 0, params: { keep: 160, tooClose: 130, tooFar: 220, cooldown: 2.2, windup: 0.45, projSpeed: 130, projDamage: 9, maxRange: 260 } },
    "Plague Bat":          { id: "E7",  name: "역병 박쥐 떼",  baseHp: 5,   contactDamage: 3,  moveSpeed: 110, hitbox: 10, expValue: 1, unlockAt: 180, ai: "zigzag",    knockbackResist: 0, swarmOnly: true, params: { amplitude: 25, period: 0.8 } },
    "crimson imp":         { id: "E8",  name: "진홍 임프",     baseHp: 30,  contactDamage: 12, moveSpeed: 55,  hitbox: 16, expValue: 5, unlockAt: 270, ai: "charge",    knockbackResist: 0, params: { detect: 200, windup: 0.6, dashSpeed: 260, dashDuration: 0.7, cooldown: 3.5, dashDamage: 12, recover: 0.4 } },
    "Carcass Feeder":      { id: "EL1", name: "시체 포식자",   baseHp: 360, contactDamage: 14, moveSpeed: 44,  hitbox: 28, expValue: 40, goldValue: 26, unlockAt: 90,  ai: "chase",     knockbackResist: 1, tier: "elite", scale: 1.75, dropsChest: true },
    "Depraved Blackguard": { id: "EL2", name: "타락한 흑기사", baseHp: 720, contactDamage: 20, moveSpeed: 50,  hitbox: 32, expValue: 60, goldValue: 51, unlockAt: 270, ai: "shockwave", knockbackResist: 1, tier: "elite", scale: 2, params: { radius: 110, damage: 18, windup: 0.8, cooldown: 6.0, knockback: 80 } },
};
const LEGACY_TIER = { E1: "normal", E2: "normal", E3: "normal", E4: "normal", E5: "normal", E6: "normal", E7: "normal", E8: "normal", EL1: "elite", EL2: "elite" };

// ── 5. 스테이지 배분 ────────────────────────────────────────
/**
 * 150종을 한 스테이지에 다 쏟으면 6개 스테이지가 전부 똑같이 읽힌다.
 * 계열을 스테이지의 정체성으로 쓰고, 경계 계열(해충/거수/이종족/용족)만 둘 이상으로 쪼개
 * 인접 스테이지가 서로 이어지게 했다. 배열 순서(=종 알파벳 순)를 앞에서부터 잘라 배분한다.
 * 결과는 스테이지당 23~28종. 20종 밑이면 몇 판만 돌려도 다 본 느낌이 든다.
 */
const STAGE_PLAN = {
    undead:    [["stage1", 15]],
    vermin:    [["stage1", 8], ["stage2", 7]],
    animal:    [["stage2", 15]],
    monster:   [["stage2", 3], ["stage3", 4], ["stage4", 3], ["stage5", 5]],
    humanoid:  [["stage3", 15]],
    humanoid2: [["stage3", 5], ["stage4", 10]],
    magical:   [["stage4", 15]],
    demon:     [["stage5", 15]],
    dragon:    [["stage5", 4], ["stage6", 11]],
    holy:      [["stage6", 15]],
};

// ── 6. 한글 이름 ────────────────────────────────────────────
/**
 * 영문 종명을 그대로 두면 킬 로그와 도감이 읽히지 않는다. 단어 단위 사전으로 치환한다.
 * 문장 단위 번역표(150줄)를 두지 않는 이유: 단어는 재사용되지만 조합은 재사용되지 않는다.
 * 사전에 없는 단어는 원문을 남긴다 — 조용히 빈칸이 되는 것보다 낫다.
 */
const KO_WORDS = [
    ["Acid", "산성"], ["Adept", "숙련"], ["Adolescent", "청년"], ["Adult", "성체"], ["Adventurous", "모험심 강한"],
    ["Angel", "천사"], ["Ant", "개미"], ["Antlered", "뿔 달린"], ["Aqua", "물"], ["Aquamancer", "물술사"],
    ["Archer", "궁수"], ["Archon", "아콘"], ["Assassin", "암살자"], ["Baby", "새끼"], ["Balor", "발로르"],
    ["Bard", "음유시인"], ["Bat", "박쥐"], ["Beaver", "비버"], ["Bedbug", "빈대"], ["Beetle", "딱정벌레"],
    ["Bestial", "야성의"], ["Bladedancer", "검무사"], ["Blessed", "축복받은"], ["Blinded", "눈먼"], ["Bloated", "부푼"],
    ["Bloodshot", "충혈된"], ["Boar", "멧돼지"], ["Boisterous", "떠들썩한"], ["Bold", "대담한"], ["Bones", "해골"],
    ["Bound", "결박된"], ["Brass", "황동"], ["Brawny", "억센"], ["Brittle", "부서진"], ["Bronze", "청동"],
    ["Cadaver", "송장"], ["Cap", "모자"], ["Carcass", "시체"], ["Cat", "고양이"], ["Cherub", "케루빔"],
    ["Chick", "병아리"], ["Chicken", "닭"], ["Child", "아이"], ["Clawed", "발톱의"], ["Cleric", "성직자"],
    ["Clucking", "꼬꼬"], ["Cockroach", "바퀴벌레"], ["Copper", "구리"], ["Coral", "산호"], ["Corrupted", "타락한"],
    ["Crab", "게"], ["Crawler", "기는 것"], ["Crimson", "진홍"], ["Croaking", "개굴"], ["Crusader", "성전사"],
    ["Crushing", "짓뭉개는"], ["Cyclops", "키클롭스"], ["Dainty", "앙증맞은"], ["Death", "죽음"], ["Decrepit", "낡은"],
    ["Deft", "능란한"], ["Demon", "악마"], ["Demonling", "꼬마 악마"], ["Demonspawn", "악마 자손"], ["Depraved", "타락한"],
    ["Determined", "결연한"], ["Deva", "데바"], ["Devout", "독실한"], ["Dismembered", "찢긴"], ["Divine", "신성한"],
    ["Dragon", "드래곤"], ["Drake", "드레이크"], ["Druid", "드루이드"], ["Dung", "똥"], ["Earth", "대지"],
];
KO_WORDS.push(
    ["Elemental", "정령"], ["Elf", "엘프"], ["Enchanter", "마도사"], ["Engorged", "포식한"], ["Ettin", "에틴"],
    ["Expert", "숙달된"], ["Eye", "눈알"], ["Fairy", "요정"], ["Famished", "굶주린"], ["Fanatic", "광신도"],
    ["Favored", "총애받는"], ["Feeder", "포식자"], ["Fighter", "전사"], ["Fire", "화염"], ["Fledgling", "갓 태어난"],
    ["Floating", "부유하는"], ["Fluttering", "팔랑이는"], ["Foraging", "먹이 찾는"], ["Foul", "역겨운"], ["Fox", "여우"],
    ["Friar", "수사"], ["Frog", "개구리"], ["Fungal", "균류"], ["Gentle", "온화한"], ["Giant", "거대"],
    ["Gladiator", "검투사"], ["Glowing", "빛나는"], ["Goblin", "고블린"], ["Golem", "골렘"], ["Goose", "거위"],
    ["Gouger", "후벼파는 놈"], ["Grave", "무덤"], ["Green", "녹색"], ["Gremlin", "그렘린"], ["Grimlock", "그림록"],
    ["Grinning", "히죽이는"], ["Grizzled", "고목"], ["Halfling", "하플링"], ["Hand", "손"], ["Holy", "성스러운"],
    ["Honking", "꽥꽥"], ["Hound", "사냥개"], ["Humongous", "거대한"], ["Ice", "얼음"], ["Imp", "임프"],
    ["Impaler", "꿰뚫는 자"], ["Infected", "감염된"], ["Iron", "강철"], ["Javelineer", "투창병"], ["Jelly", "젤리"],
    ["Jovial", "쾌활한"], ["Joyful", "즐거운"], ["Juvenile", "준성체"], ["Kid", "꼬마"], ["Lava", "용암"],
    ["Leaping", "도약하는"], ["Lizardfolk", "리자드맨"], ["Lord", "군주"], ["Mad", "미친"], ["Maggot", "구더기"],
    ["Magical", "마법"], ["Man-at-Arms", "종사"], ["Mature", "완숙"], ["Mawing", "아귀"], ["Merfolk", "인어"],
    ["Meowing", "야옹"], ["Mole", "두더지"], ["Mouse", "생쥐"], ["Mud", "진흙"], ["Murky", "탁한"],
    ["Mushroom", "버섯"], ["Mutilated", "훼손된"], ["Myconid", "마이코니드"], ["Mystic", "신비가"], ["Nefarious", "사악한"],
    ["Necromancer", "강령술사"], ["Novice", "초보"], ["Ochre", "황토"], ["Occultist", "밀교도"], ["Ocular", "안구"],
    ["Ogre", "오우거"], ["Overworked", "혹사당한"], ["Pasturing", "풀 뜯는"], ["Pig", "돼지"], ["Pit", "심연"],
);
KO_WORDS.push(
    ["Pixie", "픽시"], ["Plague", "역병"], ["Planetar", "플라네타르"], ["Playful", "장난치는"], ["Pointed", "뾰족한"],
    ["Poison", "맹독"], ["Porcupine", "호저"], ["Priest", "사제"], ["Pygmy", "왜소"], ["Pyromancer", "화염술사"],
    ["Ranger", "레인저"], ["Rascal", "말썽꾼"], ["Rascally", "짓궂은"], ["Red", "붉은"], ["Revenant", "망령"],
    ["Rhino", "코뿔소"], ["Rider", "기수"], ["Righteous", "정의로운"], ["Rogue", "도적"], ["Royal", "왕실"],
    ["Sand", "모래"], ["Scamp", "장난꾸러기"], ["Scarab", "풍뎅이"], ["Scout", "정찰병"], ["Sharpshooter", "명사수"],
    ["Sheep", "양"], ["Shepard", "목자"], ["Shrieker", "비명"], ["Skewering", "꿰는"], ["Skittering", "기어오는"],
    ["Skunk", "스컹크"], ["Slaad", "슬라드"], ["Slime", "슬라임"], ["Slinger", "투석병"], ["Slow", "느린"],
    ["Snow", "설원"], ["Soldier", "병사"], ["Sorceress", "마녀"], ["Spearman", "창병"], ["Spikey", "가시"],
    ["Stalker", "추적자"], ["Stinky", "악취"], ["Stone", "석재"], ["Stumbler", "비틀거림"], ["Swamp", "늪"],
    ["Sword", "검"], ["Swordsman", "검사"], ["Swooping", "급강하"], ["Tainted", "오염된"], ["Timber", "숲"],
    ["Tick", "진드기"], ["Tiny", "작은"], ["Toad", "두꺼비"], ["Toxic", "맹독"], ["Treant", "트렌트"],
    ["Troll", "트롤"], ["Tunneling", "굴 파는"], ["Turtle", "거북"], ["Unraveling", "풀려나는"], ["Veteran", "역전의"],
    ["Vampire", "흡혈"], ["Vile", "비열한"], ["Villager", "마을 사람"], ["Viridian", "청록"], ["Warp", "뒤틀린"],
    ["Watcher", "감시자"], ["Water", "물"], ["Wayfarer", "방랑자"], ["White", "백색"], ["Wisp", "도깨비불"],
    ["Witch", "마녀"], ["Wolf", "늑대"], ["Young", "어린"], ["Youth", "청년"], ["Zealous", "열광적인"],
);
KO_WORDS.push(
    ["Abomination", "혐오체"], ["Acolyte", "수련사제"], ["Ghastly", "섬뜩한"], ["Ghoul", "구울"],
    ["Resolute", "굳건한"], ["Scoundrel", "악당"], ["Skull", "해골"], ["Wyvern", "와이번"],
);
const KO_MAP = new Map(KO_WORDS.map(([en, ko]) => [en.toLowerCase(), ko]));
const toKo = (name) => name.split(/[\s_]+/).map((w) => KO_MAP.get(w.toLowerCase()) ?? w).join(" ");

// ── 7. 스탯 유도 ────────────────────────────────────────────
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * 몸통 면적 → 크기 계수. 150px^2(약 13x12)이 이 팩의 중앙값이라 1.0 이 되게 잡았다.
 * 지수 0.55 는 면적이 4배 벌어져도 계수는 2.1배까지만 벌어지게 눌러 준다 —
 * 선형으로 두면 성체 드래곤 HP 가 개미의 16배가 되어 같은 웨이브에 못 섞인다.
 */
const sizeFactor = (w, h) => clamp((w * h / 150) ** 0.55, 0.6, 1.6);

/**
 * 등급별 상한/하한. 유도식은 크기 x 지터로 자유롭게 벌어지므로 정본 곡선 밖으로 나가는 것을 여기서 막는다.
 *   일반  HP 50  = E2(26)의 약 2배. 이 위로 가면 hpMult 5.64 구간에서 일반 적이 엘리트처럼 단단해진다.
 *   일반 속도 140 = E3(135) 근처. 플레이어 70 의 두 배를 넘으면 대시(120px/3s)로도 못 뿌리친다.
 *   일반 속도 32  = E2(38) 근처. 이보다 느리면 플레이어를 영원히 못 따라잡아 화면 밖 장식이 된다.
 *   엘리트 HP 700 = EL2(720) 바로 아래. 이벤트로 등장하는 지명 엘리트가 항상 더 무거워야 한다.
 */
const CAPS = {
    normal:   { hp: [3, 50],    spd: [32, 140], dmg: [1, 16] },
    elite:    { hp: [60, 700],  spd: [30, 90],  dmg: [8, 24] },
    miniboss: { hp: [400, 1800], spd: [24, 80], dmg: [14, 40] },
};

/** 원거리 프로파일. 계열마다 "무엇을 쏘는가"가 다르므로 투사체 속도/쿨을 따로 준다 */
const RANGED_PROFILE = {
    dragon:  { keep: 190, tooClose: 150, tooFar: 250, cooldown: 3.0, windup: 0.70, projSpeed: 150, maxRange: 300, dmgFactor: 1.6 },
    magical: { keep: 175, tooClose: 140, tooFar: 235, cooldown: 2.6, windup: 0.55, projSpeed: 115, maxRange: 275, dmgFactor: 1.35 },
    holy:    { keep: 165, tooClose: 135, tooFar: 225, cooldown: 2.4, windup: 0.50, projSpeed: 140, maxRange: 265, dmgFactor: 1.20 },
    // 기본값은 E6 부서진 궁수의 정본 수치 그대로다(05-COMBAT 4.3)
    _default:{ keep: 160, tooClose: 130, tooFar: 220, cooldown: 2.2, windup: 0.45, projSpeed: 130, maxRange: 260, dmgFactor: 1.10 },
};

/** 계열별 미니보스 지명. 자동 선정(몸통 최대)이 계열 정체성과 어긋나는 곳만 손으로 박는다 */
const MINIBOSS = new Set([
    "Ghastly Eye", "Rhino Beetle", "Mad Boar", "Humongous Ettin", "Goblin Wolf Rider",
    "Elf Lord", "Iron Golem", "Pit Balor", "Adult White Dragon", "Divine Planetar",
].map((s) => s.toLowerCase()));

/** 계열당 12 일반 / 2 엘리트 / 1 미니보스. 레거시 등급을 먼저 소진하고 남는 자리를 몸통 큰 순으로 채운다 */
function assignTiers(list) {
    const quota = { elite: 2, miniboss: 1 };
    for (const s of list) {
        if (!s.legacy) continue;
        s.tier = LEGACY_TIER[s.legacy.id];
        if (quota[s.tier] != null) quota[s.tier]--;
    }
    // 스프라이트가 큰 놈이 화면에서 실제로 위협적으로 보인다. 등급을 몸통에 맞추면 설명이 필요 없다
    for (const s of list) {
        if (s.tier || !MINIBOSS.has(s.name.toLowerCase()) || quota.miniboss <= 0) continue;
        s.tier = "miniboss";
        quota.miniboss--;
    }
    const rest = list.filter((s) => !s.tier).sort((a, b) => b.bodyW * b.bodyH - a.bodyW * a.bodyH);
    let i = 0;
    for (; quota.miniboss > 0 && i < rest.length; quota.miniboss--, i++) rest[i].tier = "miniboss";
    for (; quota.elite > 0 && i < rest.length; quota.elite--, i++) rest[i].tier = "elite";
    for (; i < rest.length; i++) rest[i].tier = "normal";
}

function assignRole(sp) {
    let role = ARCHETYPES[sp.family].role;
    for (const r of ROLE_RULES) if (r.re.test(sp.name)) { role = r.role; break; }
    // 광역 충격파를 일반 등급에 주면 상한 150체 중 수십이 동시에 장판을 깐다. 회피가 성립하지 않는다
    if (role === "shockwave" && sp.tier === "normal") role = "charge";
    // 무리는 8체 동시 스폰 전용이다. 엘리트를 8체 부르면 동시 상한 예측이 통째로 깨진다
    if (role === "swarm" && sp.tier !== "normal") role = "zigzag";
    return role;
}

/**
 * 계열 기준선 x 역할 배수 x 등급 배수 x 크기 계수 x 결정적 지터 → 종 스탯.
 * 골드/EXP 환산 계수는 정본에서 역산한 값이다.
 *   EXP  : EL1 360/40 = 9 → 엘리트 이상은 hp/9
 *   골드 : EL1 360/14 = 26, EL2 720/14 = 51 → 엘리트 이상은 hp/14 (05-COMBAT 4.4 실측 일치)
 *   일반 적은 goldValue 필드를 두지 않는다. 03-GDD 9 골드식의 "처치수x1" 을 CombatSystem 이 이미 준다.
 */
function deriveStats(sp) {
    const A = ARCHETYPES[sp.family];
    const R = ROLES[sp.role];
    const T = TIERS[sp.tier];
    const sf = sizeFactor(sp.bodyW, sp.bodyH);
    const j = jitter(sp.key);

    const C = CAPS[sp.tier];
    const baseHp = clamp(Math.round(A.hp * R.hp * T.hp * sf * j), C.hp[0], C.hp[1]);
    // 큰 몸통은 느리다. 지터도 뒤집어 먹여 "HP 가 높게 뽑힌 개체는 느리다"가 항상 성립하게 한다
    const moveSpeed = clamp(Math.round(A.spd * R.spd * T.spd / sf ** 0.35 * (2 - j)), C.spd[0], C.spd[1]);
    const contactDamage = clamp(Math.round(A.dmg * R.dmg * T.dmg * sf ** 0.5 * j), C.dmg[0], C.dmg[1]);
    // ★ 캔버스(16px)가 아니라 실측 몸통에서 뽑는다. 캔버스로 잡으면 정확히 허공에서 맞는다
    const hitbox = clamp(Math.round((sp.bodyW + sp.bodyH) / 2 * T.scale), 6, 42);

    const st = {
        baseHp, contactDamage, moveSpeed, hitbox,
        expValue: sp.tier === "normal"
            ? clamp(Math.round(baseHp / 7), 1, 9)
            : clamp(Math.round(baseHp / 9), sp.tier === "elite" ? 25 : 60, sp.tier === "elite" ? 70 : 130),
        knockbackResist: T.kb ?? A.kb,
    };
    if (sp.tier !== "normal") st.goldValue = Math.round(baseHp / 14);
    st.params = roleParams(sp, st, sf, j);
    return st;
}

/** 역할별 파라미터. 값의 뼈대는 전부 05-COMBAT 4.3/4.4 의 정본 수치이고 크기/속도로만 변주한다 */
function roleParams(sp, st, sf, j) {
    switch (sp.role) {
        case "stagger":
            // 클수록 오래 멈춘다. 실효속도 = moveSpeed x moveDuration/(move+pause)
            return { moveDuration: r2(0.9 - sf * 0.1), pauseDuration: r2(0.12 + sf * 0.1) };
        case "overshoot":
            // 빠를수록 늦게 조향해야 오버슛이 생겨 회피가 성립한다(정본 E3)
            return { retarget: r2(clamp(70 / st.moveSpeed, 0.35, 0.8)) };
        case "zigzag":
        case "swarm":
            return { amplitude: Math.round((sp.role === "swarm" ? 25 : 40) * j), period: r2((sp.role === "swarm" ? 0.8 : 1.2) * (2 - j)) };
        case "ranged": {
            const p = RANGED_PROFILE[sp.family] ?? RANGED_PROFILE._default;
            const A = ARCHETYPES[sp.family];
            return {
                keep: p.keep, tooClose: p.tooClose, tooFar: p.tooFar,
                cooldown: r2(p.cooldown * (2 - j)), windup: p.windup, projSpeed: p.projSpeed,
                projDamage: clamp(Math.round(A.dmg * TIERS[sp.tier].dmg * sf ** 0.5 * j * p.dmgFactor), 3, 60),
                maxRange: p.maxRange,
            };
        }
        case "charge":
            return {
                detect: 200, windup: r2(0.48 + sf * 0.14),
                // 정본 E8: 이동 55 → 돌진 260 (약 4.7배). 그 비율을 유지한다
                dashSpeed: Math.round(st.moveSpeed * 4.7), dashDuration: 0.7,
                cooldown: r2(3.5 * (2 - j)), dashDamage: st.contactDamage, recover: 0.4,
            };
        case "shockwave":
            // 정본 EL2: hitbox 32 → 반경 110, 접촉 20 → 충격파 18. 두 관계를 그대로 일반화했다
            return {
                radius: Math.round(60 + st.hitbox * 1.55), damage: Math.round(st.contactDamage * 0.9),
                windup: 0.8, cooldown: r2(6.0 * (2 - j)), knockback: 80,
            };
        default:
            // chase — 몸집이 있는 놈만 분리 반경을 준다. 겹쳐서 1체처럼 보이는 것이 문제인 크기다
            return st.hitbox >= 13 ? { separation: st.hitbox } : null;
    }
}

/** 런 내 등장 시각 기본값. 스테이지 시스템이 덮어쓸 수 있는 힌트다 */
function unlockAt(sp, st) {
    if (sp.tier === "miniboss") return 270;
    if (sp.tier === "elite") return 180;
    const hp = st.baseHp;
    return hp < 12 ? 0 : hp < 22 ? 30 : hp < 32 ? 90 : hp < 45 ? 180 : 270;
}

/** 애니 fps. 빠른 놈은 빨리 움직여야 속도가 눈에 읽힌다. 레거시 10종은 09-ART 실측값을 유지한다 */
const LEGACY_FPS = { E1: 10, E2: 6, E3: 14, E4: 8, E5: 8, E6: 8, E7: 12, E8: 10, EL1: 8, EL2: 6 };
const animFps = (sp, st) => (sp.legacy ? LEGACY_FPS[sp.legacy.id] : clamp(Math.round(4 + st.moveSpeed / 12), 5, 14));

/** enemies 배열만 한 줄 한 종으로 찍는다. 150종을 4칸 들여쓰기로 펴면 2,000줄이 되어 diff 를 못 읽는다 */
function writeJsonInlineRows(path, obj, arrayKey) {
    const rows = obj[arrayKey].map((r) => "        " + JSON.stringify(r)).join(",\n");
    const s = JSON.stringify({ ...obj, [arrayKey]: "@@ROWS@@" }, null, 4)
        .replace('"@@ROWS@@"', "[\n" + rows + "\n    ]");
    writeFileSync(path, s + "\n", "utf8");
    return Buffer.byteLength(s);
}

const sizeOf = (p) => magick([p, "-format", "%wx%h", "info:"]).toString().trim();

// ── 8. 파이프라인 ───────────────────────────────────────────
console.log("몬스터 파이프라인 시작");
console.log("  원본: " + SRC);
console.log("  도구: " + MAGICK);

const famPaths = scanFamilies();
const all = [];

for (const fam of FAMILIES) {
    const dir = famPaths.get(fam.key);
    if (!dir) { console.warn(`   ! 계열 폴더 없음: ${fam.dir}`); continue; }
    const names = readdirSync(dir)
        .filter((d) => statSync(join(dir, d)).isDirectory())
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const list = [];
    for (const name of names) {
        const png = speciesPng(join(dir, name));
        if (!png) { console.warn(`   ! png 없음: ${name}`); continue; }
        const [w, h] = sizeOf(png).split("x").map(Number);
        const fw = Math.round(w / FRAMES);
        const m = measure(png, fw, h);
        if (!m) { console.warn(`   ! bbox 측정 실패: ${name}`); continue; }
        if (m.union.w > CELL || m.union.h > CELL) {
            // 천상 계열 4종(64x18)이 여기 걸린다. -resize 16x16> 로 줄여 넣는다.
            // 잘라내면 천사의 머리나 발이 사라지는데, 1px 축소가 그보다 덜 눈에 띈다
            console.warn(`   ! ${name}: 몸통 ${m.union.w}x${m.union.h} 가 ${CELL}px 셀보다 크다 → 축소 후 배치`);
        }
        list.push({
            family: fam.key, famCode: fam.code, famKo: fam.ko,
            name, key: fam.key + "/" + name, png, srcW: w, srcH: h, frameW: fw, frameH: h,
            bodyW: m.bodyW, bodyH: m.bodyH, union: m.union,
            legacy: LEGACY[name] ?? null,
        });
    }
    assignTiers(list);
    // 스테이지 배분 — 계열 알파벳 순서를 앞에서부터 잘라 나눈다
    // ★ 알파벳 순이 아니라 몸통이 작은 순으로 자른다.
    //   용족을 알파벳으로 자르면 Adult 두 마리가 앞 스테이지로 가고 뒤 스테이지에 Baby 만 남는다.
    //   작은 놈이 앞 스테이지, 큰 놈이 뒤 스테이지 — 스테이지 진행이 실루엣으로 읽히게 된다.
    const plan = STAGE_PLAN[fam.key] ?? [];
    const bySize = list.slice().sort((a, b) => a.bodyW * a.bodyH - b.bodyW * b.bodyH);
    let cursor = 0;
    for (const [stage, n] of plan) {
        for (let k = 0; k < n && cursor < bySize.length; k++, cursor++) bySize[cursor].stage = stage;
    }
    for (; cursor < bySize.length; cursor++) bySize[cursor].stage = plan.at(-1)?.[0] ?? "stage1";
    let n = 0;
    for (const sp of list) {
        sp.role = sp.legacy ? Object.keys(ROLES).find((k) => ROLES[k].ai === sp.legacy.ai && !!ROLES[k].swarmOnly === !!sp.legacy.swarmOnly) ?? sp.legacy.ai : assignRole(sp);
        sp.id = sp.legacy ? sp.legacy.id : fam.code + String(++n).padStart(2, "0");
        // 레거시 10종은 현재 런(stage1)의 구성원이다. 계열 배분과 별개로 stage1 을 반드시 갖는다
        sp.stages = sp.legacy && sp.stage !== "stage1" ? ["stage1", sp.stage] : [sp.stage];
        all.push(sp);
    }
    log(`${fam.ko}(${fam.key}) ${list.length}종`);
}

if (all.length !== 150) console.warn(`   ! 종 수가 150이 아니다: ${all.length}`);

// ── 9. 아틀라스 굽기 ────────────────────────────────────────
ensure(OUT_TEX);
const tmp = resolve(OUT_TEX, "_tmp");
rmSync(tmp, { recursive: true, force: true });
ensure(tmp);

const strips = [];
all.forEach((sp, i) => {
    const u = sp.union;
    const out = resolve(tmp, "s" + String(i).padStart(3, "0") + ".png");
    // -crop WxH(오프셋 없음) 로 4프레임 타일로 쪼갠 뒤, 같은 합집합 bbox 로 한 번 더 잘라
    // 4프레임에 동일한 오프셋을 먹인다. 프레임별로 잘랐다면 걷기 바운스가 지워진다.
    magick([sp.png,
        "-crop", `${sp.frameW}x${sp.frameH}`, "+repage",
        "-crop", `${u.w}x${u.h}+${u.x}+${u.y}`, "+repage",
        "-background", "none", "-filter", "point", "-resize", `${CELL}x${CELL}>`,
        "-gravity", "center", "-extent", `${CELL}x${CELL}`,
        "+append", out]);
    strips.push(out);
    sp.frameStart = i * FRAMES;
});

const rows = [];
for (let r = 0; r * SPECIES_PER_ROW < strips.length; r++) {
    const part = strips.slice(r * SPECIES_PER_ROW, (r + 1) * SPECIES_PER_ROW);
    const out = resolve(tmp, "r" + String(r).padStart(2, "0") + ".png");
    // 마지막 행은 종이 모자라므로 왼쪽 정렬로 폭을 채운다. 빈 칸은 투명 프레임이 된다
    magick([...part, "-background", "none", "+append",
        "-gravity", "west", "-extent", `${COLS * CELL}x${CELL}`, out]);
    rows.push(out);
}
const ATLAS = resolve(OUT_TEX, "monsters.png");
magick([...rows, "-background", "none", "-append", ATLAS]);
rmSync(tmp, { recursive: true, force: true });

const atlasSize = sizeOf(ATLAS);
const atlasBytes = statSync(ATLAS).size;
const [aw, ah] = atlasSize.split("x").map(Number);
log(`monsters.png (${atlasSize}) · 프레임 ${CELL}x${CELL} x ${all.length * FRAMES}장 · ` +
    `파일 ${(atlasBytes / 1024).toFixed(1)}KB · VRAM ${(aw * ah * 4 / 1048576).toFixed(2)}MB(RGBA8888)`);

// ── 10. 카탈로그 ────────────────────────────────────────────
const catalog = {
    _comment: [
        "tools/build-monsters.mjs 생성물. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌린다.",
        "texture=monsters, 균일 격자 spritesheet. frameWidth=frameHeight=16, 한 행 32칸.",
        "frameStart = 종 인덱스 x 4. 애니메이션은 frameStart ~ frameStart+3.",
        "bodyW/bodyH 는 4프레임 알파 bbox 의 중앙값(실측). hitbox 는 그 평균 x 등급 배율.",
        "anim 키는 registerAnims 가 이 파일을 읽어 만든다 — 프레임 배정을 두 곳에 적지 않는다.",
    ],
    schemaVersion: 1,
    texture: "monsters",
    frameWidth: CELL, frameHeight: CELL, columns: COLS,
    atlas: { file: "assets/enemies/monsters.png", width: aw, height: ah, frames: all.length * FRAMES, bytes: atlasBytes },
    families: FAMILIES.map((f) => ({ key: f.key, code: f.code, ko: f.ko, count: all.filter((s) => s.family === f.key).length })),
    species: all.map((sp) => ({
        id: sp.id, key: sp.key, name: sp.name, nameKo: sp.legacy ? sp.legacy.name : toKo(sp.name),
        family: sp.family, tier: sp.tier, frameStart: sp.frameStart, frames: FRAMES,
        srcSize: `${sp.srcW}x${sp.srcH}`, bodyW: sp.bodyW, bodyH: sp.bodyH,
        trim: `${sp.union.w}x${sp.union.h}+${sp.union.x}+${sp.union.y}`,
        src: relSrc(sp.png),
    })),
};
const catBytes = writeJsonInlineRows(resolve(OUT_DATA, "monster-catalog.json"), catalog, "species");
log(`monster-catalog.json · ${all.length}종 · ${(catBytes / 1024).toFixed(1)}KB`);

// ── 11. enemies.json ────────────────────────────────────────
/**
 * 계열 아키타입 표를 JSON 에도 함께 실어 보낸다.
 * 엔진은 flat 한 enemies 배열만 읽는다 — 런타임 상속 해석을 넣으면 스폰마다 객체가 생기고
 * "런 중 new 금지"(06-TECH 5.1)가 깨진다. 상속은 여기(빌드 타임)서 이미 풀렸다.
 * families 블록은 밸런서가 "이 계열이 원래 뭐였나"를 JSON 안에서 바로 읽기 위한 것이다.
 */
const enemies = [];
for (const sp of all) {
    if (sp.legacy) {
        // 정본 수치를 그대로 복사하고 확장 필드만 덧붙인다. 값은 한 자리도 건드리지 않는다
        enemies.push({
            ...sp.legacy,
            anim: "enemy." + sp.id.toLowerCase(),
            tier: sp.tier, family: sp.family, behavior: sp.role,
            stageAffinity: sp.stages, frameStart: sp.frameStart,
        });
        continue;
    }
    const st = deriveStats(sp);
    const e = {
        id: sp.id, name: toKo(sp.name),
        baseHp: st.baseHp, contactDamage: st.contactDamage, moveSpeed: st.moveSpeed,
        hitbox: st.hitbox, expValue: st.expValue,
    };
    if (st.goldValue) e.goldValue = st.goldValue;
    e.unlockAt = unlockAt(sp, st);
    e.ai = ROLES[sp.role].ai;
    e.anim = "enemy." + sp.id.toLowerCase();
    e.knockbackResist = st.knockbackResist;
    e.tier = sp.tier;
    e.family = sp.family;
    e.behavior = sp.role;
    e.stageAffinity = sp.stages;
    e.frameStart = sp.frameStart;
    if (ROLES[sp.role].swarmOnly) e.swarmOnly = true;
    if (sp.tier !== "normal") e.scale = TIERS[sp.tier].scale;
    if (sp.tier === "elite") e.dropsChest = true;
    if (st.params) e.params = st.params;
    enemies.push(e);
}

const ids = new Set();
for (const e of enemies) {
    if (ids.has(e.id)) console.warn(`   ! ID 중복: ${e.id}`);
    ids.add(e.id);
}

const enemiesJson = {
    _comment: [
        "적 스탯 150종. tools/build-monsters.mjs 생성물 — 손으로 고치지 말고 스크립트를 고쳐 다시 돌린다.",
        "출처 05-COMBAT-AND-BALANCE 4(적 상세표) / 08-DATA-SCHEMA 3.4.",
        "E1~E8/EL1/EL2 는 정본 수치 원문 그대로다. 나머지 140종은 families 아키타입에서 유도했다.",
        "hitbox 는 스프라이트 알파 bbox 실측 기반. radius = hitbox/2 로 쓴다.",
        "  캔버스(16px)가 아니라 몸통을 재는 이유: 16x16 안에 11x9 몸통이 흔해서 캔버스로 잡으면 허공에서 맞는다.",
        "goldValue = 03-GDD 9 골드식의 '처치수x1' + 05-COMBAT 4.4 의 엘리트 보너스(hp/14).",
        "  일반 적은 필드를 두지 않는다 - CombatSystem 의 (e.goldValue ?? 1) 이 곧 '처치수x1' 이다.",
        "scale 은 16x16 시트를 정본 히트박스까지 키우는 렌더 배율(엘리트/미니보스 전용).",
        "swarmOnly 는 일반 스폰 가중치 풀에서 제외한다는 뜻(05-COMBAT 5.3 각주).",
        "behavior 는 설계 라벨, ai 는 EnemyAISystem 이 실제로 분기하는 값. swarm 만 둘이 다르다(ai=zigzag).",
        "stageAffinity 는 어느 스테이지 풀에 들어가는가. 실제 웨이브 가중치는 phases.json 이 정한다.",
        "frameStart 는 monsters 아틀라스의 프레임 인덱스. 애니 등록은 monster-catalog.json 이 담당한다.",
    ],
    schemaVersion: 3,
    families: Object.fromEntries(FAMILIES.map((f) => [f.key, {
        ko: f.ko, code: f.code, ...ARCHETYPES[f.key],
        count: all.filter((s) => s.family === f.key).length,
    }])),
    roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { ...v }])),
    tiers: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, { ...v }])),
    enemies,
};
const enBytes = writeJsonInlineRows(resolve(OUT_DATA, "enemies.json"), enemiesJson, "enemies");
log(`enemies.json · ${enemies.length}종 · ${(enBytes / 1024).toFixed(1)}KB`);

// ── 12. 요약 ────────────────────────────────────────────────
const byStage = {};
for (const e of enemies) for (const s of e.stageAffinity) (byStage[s] ??= []).push(e.id);
const byTier = {};
for (const e of enemies) byTier[e.tier] = (byTier[e.tier] ?? 0) + 1;
const byBehavior = {};
for (const e of enemies) byBehavior[e.behavior] = (byBehavior[e.behavior] ?? 0) + 1;
console.log("");
log("등급: " + Object.entries(byTier).map(([k, v]) => `${k} ${v}`).join(" / "));
log("행동: " + Object.entries(byBehavior).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" / "));
log("스테이지: " + Object.keys(byStage).sort().map((s) => `${s} ${byStage[s].length}종`).join(" / "));
const norms = enemies.filter((e) => e.tier === "normal");
const stat = (f) => { const v = norms.map(f).sort((a, b) => a - b); return `${v[0]}~${v.at(-1)} (중앙 ${v[v.length >> 1]})`; };
log("일반 baseHp: " + stat((e) => e.baseHp));
log("일반 moveSpeed: " + stat((e) => e.moveSpeed));
log("일반 hitbox: " + stat((e) => e.hitbox));
console.log("");
console.log("완료. 산출물은 커밋한다. 원본 asset/ 은 커밋하지 않는다.");
