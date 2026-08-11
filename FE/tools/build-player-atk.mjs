/**
 * build-player-atk — 플레이어 공격 시트의 「참격 궤적」을 피색으로 다시 굽는다.
 *
 * ★ 왜 필요한가
 *   원본(FREE_Adventurer)의 attack1/attack2 시트에는 참격 궤적이 **순백색으로 구워져** 있다.
 *   그 시트를 실제로 재생하도록 배선한 뒤 화면을 보니 궤적이 캐릭터보다 크고 밝아
 *   화면을 지배했고, 피·재·검정 팔레트(09-ART)와도 정면으로 어긋났다.
 *
 * ★ 왜 런타임 틴트로 안 되는가
 *   Phaser 의 setTint 는 스프라이트 **전체**에 곱해진다. 궤적이 적당해질 만큼 어둡게 하면
 *   캐릭터가 단색 빨강 덩어리가 되어 디테일이 죽는다. 실제로 두 값을 시도해 확인했다.
 *   궤적과 캐릭터가 같은 텍스처에 있는 한 런타임에는 분리할 수 없다. 그래서 굽는다.
 *
 * ★ 궤적 픽셀을 어떻게 가리는가 (실측 근거)
 *   idle/run 시트와 색 분포를 대조해서 정했다. 실측값(down 방향, 8프레임 합계):
 *     player-idle-down   순백 96   / 고휘도저채도 96
 *     player-run-down    순백 39   / 고휘도저채도 47
 *     player-atk1-down   순백 1290 / 고휘도저채도 1997
 *   프레임별로 쪼개 보면 더 분명하다 — atk1-down 의 고휘도 픽셀은
 *     f0:12  f1:1173  f2:604  f3~f7:41~42
 *   즉 **궤적은 1~2번 프레임에만 있는 2프레임 섬광**이고, 나머지 프레임의 41개는
 *   캐릭터 자신의 하이라이트다. 그 41개의 bbox 는 (51-63, 30-47) 로 캐릭터 몸통 안이다.
 *
 *   판별식: 휘도 >= 190 AND 채도차(max-min) <= 30.
 *   - 피부(230,156,105)는 휘도 172 라 걸리지 않는다
 *   - 궤적의 두 색(255,255,255 / 199,207,221)은 둘 다 걸린다
 *   - 캐릭터 하이라이트 41개/프레임도 같이 걸린다. **그대로 둔다** — 궤적 대비 18% 이고,
 *     피 팔레트 게임에 순백 하이라이트가 남는 편이 더 어색하다
 *
 * ★ 원본을 덮어쓰지 않는다. asset/ 에서 읽어 public/assets/player/ 에 **같은 파일명**으로 쓴다.
 *   파일명이 같으므로 public/assets.json 을 고칠 필요가 없다.
 *   build-assets.mjs 가 원본을 그대로 복사하므로, 이 스크립트는 그 **뒤에** 돌아야 한다.
 *
 * 사용: npm run build:player-atk   (build:all-assets 체인에 포함)
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SRC = resolve(ROOT, "asset/character/FREE_Adventurer 2D Pixel Art/Sprites");
const OUT = resolve(ROOT, "FE/public/assets/player");

const CANDIDATES = [
    "magick",
    "C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe",
    "/usr/bin/magick",
];
let MAGICK = null;
for (const c of CANDIDATES) {
    try {
        execFileSync(c, ["-version"], { stdio: "ignore" });
        MAGICK = c;
        break;
    } catch {
        /* 다음 후보 */
    }
}
if (!MAGICK) throw new Error("ImageMagick(magick)을 찾지 못했다. 설치 후 PATH에 넣을 것.");

const W = 96;
const H = 80;
const FRAMES = 8;

/** 궤적 판별 — 위 주석의 실측 근거 참조 */
const LUM_MIN = 190;
const SAT_MAX = 30;

/**
 * 피색 램프. 원래 궤적의 명암 단계를 보존해야 입체감이 산다 — 단색으로 칠하면 납작해진다.
 * 휘도 190(어두운 쪽) -> 255(칼끝) 를 아래 두 색 사이로 선형 매핑한다.
 */
const RAMP_DARK = [0x9e, 0x2b, 0x22];
const RAMP_BRIGHT = [0xcf, 0x56, 0x44];
/** 궤적 알파. 불투명하면 시선을 뺏는다 */
const TRAIL_ALPHA = 122;

const anims = [
    { dir: "ATTACK 1", prefix: "attack1", out: "atk1" },
    { dir: "ATTACK 2", prefix: "attack2", out: "atk2" },
];
const dirs = ["up", "down", "left", "right"];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

let files = 0;
let trailPx = 0;
let charPx = 0;

for (const a of anims) {
    for (const d of dirs) {
        const from = resolve(SRC, a.dir, a.prefix + "_" + d + ".png");
        if (!existsSync(from)) {
            console.warn("   ! 원본 없음: " + from);
            continue;
        }
        const buf = execFileSync(MAGICK, [from, "-depth", "8", "RGBA:-"], { maxBuffer: 1 << 28 });
        const n = buf.length / 4;
        if (n !== W * FRAMES * H) {
            throw new Error("치수가 예상과 다르다: " + from + " — 픽셀 " + n + ", 기대 " + W * FRAMES * H);
        }
        // 프레임별 히트 수를 로그로 남긴다. 값이 크게 달라지면 원본이 바뀐 것이므로
        // 판별식을 다시 봐야 한다는 신호다.
        const perFrame = new Array(FRAMES).fill(0);
        for (let i = 0; i < n; i++) {
            const o = i * 4;
            if (buf[o + 3] < 8) continue;
            const r = buf[o], g = buf[o + 1], b = buf[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < LUM_MIN) continue;
            if (Math.max(r, g, b) - Math.min(r, g, b) > SAT_MAX) continue;

            const t = Math.min(1, Math.max(0, (lum - LUM_MIN) / (255 - LUM_MIN)));
            buf[o] = lerp(RAMP_DARK[0], RAMP_BRIGHT[0], t);
            buf[o + 1] = lerp(RAMP_DARK[1], RAMP_BRIGHT[1], t);
            buf[o + 2] = lerp(RAMP_DARK[2], RAMP_BRIGHT[2], t);
            buf[o + 3] = Math.min(buf[o + 3], TRAIL_ALPHA);

            perFrame[Math.floor((i % (W * FRAMES)) / W)]++;
        }
        const big = perFrame.filter((c) => c > 200).reduce((s, c) => s + c, 0);
        trailPx += big;
        charPx += perFrame.reduce((s, c) => s + c, 0) - big;

        const tmp = resolve(OUT, "__tmp_atk.rgba");
        writeFileSync(tmp, buf);
        execFileSync(MAGICK, [
            "-size", W * FRAMES + "x" + H, "-depth", "8", "RGBA:" + tmp,
            resolve(OUT, "player-" + a.out + "-" + d + ".png"),
        ]);
        rmSync(tmp, { force: true });

        console.log("   player-" + a.out + "-" + d + "  프레임별 " + perFrame.join("/"));
        files++;
    }
}
console.log("\n   " + files + "장 재채색 -> public/assets/player/");
console.log("   궤적 " + trailPx + "px · 캐릭터 하이라이트 " + charPx + "px ("
    + Math.round((charPx / (trailPx + charPx)) * 100) + "%)");
