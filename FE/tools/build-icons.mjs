/**
 * 배포 아이콘·스플래시 파이프라인 — store/_raw/ 원본 3장에서 양 스토어 산출물 전부를 굽는다.
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md §3(G4/G5/G6/G7/G11) / 14-BUILD-AND-DEPLOY.md §8.5.1
 * 태스크: T710 T711 T714 T715
 * 실행: npm run build:icons   (FE/ 에서)
 *
 * ★ T715 — 신규 이미지를 만들지 않는다. 전부 기존 원본의 후처리 파생물이다.
 *   입력은 딱 3개다:
 *     store/_raw/icon-1024.png       완성된 정사각 아이콘(배경 포함)
 *     store/_raw/icon-fg-1024.png    적응형 아이콘 전경(투명 배경)
 *     store/_raw/splash-1920x1280.png 스플래시 원본
 *     store/_raw/logo-2048.png       워드마크(피처 그래픽 합성용)
 *
 * ★ Android 와 iOS 가 정확히 한 지점에서 갈린다 — 알파 채널.
 *   Play 512 아이콘은 32비트 PNG(알파 포함)를 요구하고,
 *   App Store 1024 아이콘은 알파가 있으면 업로드 자체를 거부한다.
 *   같은 그림에서 후처리만 갈라지므로 이 스크립트 하나로 양쪽을 만든다.
 *
 * ★ sharp 가 아니라 ImageMagick 을 쓰는 이유는 build-assets.mjs 와 같다.
 *   네이티브 의존성을 늘리지 않고, 이미 설치된 도구를 재사용한다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");
const RAW = resolve(ROOT, "store/_raw");
const STORE = resolve(ROOT, "store");
const RES = resolve(FE, "android/app/src/main/res");
const XCA = resolve(FE, "ios/App/App/Assets.xcassets");

/** 정본 팔레트 VOID. 아이콘 평탄화 배경과 레터박스 색이 다르면 부팅 순간 경계선이 보인다. */
const VOID = "#0b0710";

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

/** PNG 헤더만 읽어 크기·컬러타입을 확인한다. identify 를 매번 부르는 것보다 훨씬 빠르다. */
function pngInfo(p) {
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], bytes: b.length };
}

function requireSource(p) {
    if (!existsSync(p)) throw new Error(`원본이 없다: ${p}`);
    return p;
}

const SRC_ICON = requireSource(resolve(RAW, "icon-1024.png"));
const SRC_FG = requireSource(resolve(RAW, "icon-fg-1024.png"));
const SRC_SPLASH = requireSource(resolve(RAW, "splash-1920x1280.png"));
const SRC_LOGO = requireSource(resolve(RAW, "logo-2048.png"));

const made = [];
const note = (p, extra = "") => {
    const i = pngInfo(p);
    made.push(`${p.replace(ROOT + "\\", "").replace(ROOT + "/", "")}  ${i.w}x${i.h}  ${(i.bytes / 1024).toFixed(0)}KB ${extra}`);
};

// ═══════════════════════════════════════════════════════════════
//  1. Android 런처 아이콘 (T710)
// ═══════════════════════════════════════════════════════════════
//  ★ 픽셀아트 원본이므로 축소는 -filter Lanczos, 확대는 -filter Point 로 나눠야 한다.
//    여기서는 1024 → 48~192 즉 항상 축소라 Lanczos 고정이다.
//    Point(최근접)로 축소하면 1px 디테일이 통째로 사라져 뭉개진 것처럼 보인다.
const LAUNCHER_DPI = [
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
];

// 적응형 아이콘 전경 캔버스는 108dp, 실제로 보이는 안전영역은 중앙 66dp 뿐이다.
// 원본 icon-fg-1024.png 는 캔버스를 꽉 채우므로 그대로 쓰면 마스크에 잘린다.
const ADAPTIVE_DP = 108;
const SAFE_RATIO = 0.62; // 66/108 ≈ 0.611 — 여기에 여유 1% 만 더 준다

function buildAndroidLauncher() {
    for (const [dpi, px] of LAUNCHER_DPI) {
        const dir = resolve(RES, `mipmap-${dpi}`);
        ensure(dir);

        // ① 레거시 정사각 아이콘 — 원본이 이미 라운드 코너를 품고 있어 그대로 축소한다.
        const sq = resolve(dir, "ic_launcher.png");
        run([SRC_ICON, "-filter", "Lanczos", "-resize", `${px}x${px}`, "-strip", sq]);
        note(sq);

        // ② 원형 아이콘 — 원형 마스크를 알파로 곱한다.
        //   ⚠ -alpha set 없이 마스크를 곱하면 알파 채널이 없는 이미지에서 조용히 무시된다.
        const rd = resolve(dir, "ic_launcher_round.png");
        run([
            SRC_ICON,
            "-filter", "Lanczos", "-resize", `${px}x${px}`,
            "-alpha", "set",
            "(", "+clone", "-alpha", "extract", "-fill", "black", "-colorize", "100",
            "-fill", "white", "-draw", `circle ${px / 2},${px / 2} ${px / 2},0`, ")",
            "-compose", "CopyOpacity", "-composite", "-strip", rd,
        ]);
        note(rd);

        // ③ 적응형 전경 — 108dp 캔버스, 내용은 안전영역 안에만.
        const fgPx = Math.round((px / 48) * ADAPTIVE_DP);
        const inner = Math.round(fgPx * SAFE_RATIO);
        const fg = resolve(dir, "ic_launcher_foreground.png");
        run([
            SRC_FG,
            "-trim", "+repage",                       // 원본 여백을 먼저 걷어내야 비율 계산이 맞는다
            "-filter", "Lanczos", "-resize", `${inner}x${inner}`,
            "-background", "none", "-gravity", "center", "-extent", `${fgPx}x${fgPx}`,
            "-strip", fg,
        ]);
        note(fg);
    }
}

// ═══════════════════════════════════════════════════════════════
//  2. iOS 앱 아이콘 (T715) — 알파 채널 제거가 핵심
// ═══════════════════════════════════════════════════════════════
function buildIosIcon() {
    const dir = resolve(XCA, "AppIcon.appiconset");
    ensure(dir);
    const out = resolve(dir, "AppIcon-512@2x.png");

    // ★ -alpha remove 만 하면 "전부 불투명한 알파 채널"이 남는다. 눈으로는 구분되지 않고
    //   App Store Connect 만 거부한다. -alpha off 로 채널 자체를 없애야 한다.
    //   png:color-type=2 = truecolor(RGB), 알파 없음.
    run([
        SRC_ICON,
        "-filter", "Lanczos", "-resize", "1024x1024",
        "-background", VOID, "-alpha", "remove", "-alpha", "off",
        "-define", "png:color-type=2",
        "-strip", out,
    ]);

    const i = pngInfo(out);
    if (i.colorType !== 2) {
        throw new Error(`iOS 아이콘에 알파가 남았다(colorType=${i.colorType}). App Store Connect 가 거부한다.`);
    }
    if (i.w !== 1024 || i.h !== 1024) throw new Error(`iOS 아이콘 크기 오류: ${i.w}x${i.h}`);
    note(out, "(alpha 없음 검증 통과)");

    // App Store Connect 업로드용 사본도 store/ 에 남긴다.
    ensure(resolve(STORE, "appstore"));
    const copy = resolve(STORE, "appstore/icon-1024.png");
    run([out, copy]);
    note(copy);
}

// ═══════════════════════════════════════════════════════════════
//  3. Play Console 그래픽 자산 (T710 / T711)
// ═══════════════════════════════════════════════════════════════
function buildPlayAssets() {
    ensure(resolve(STORE, "play"));

    // ① 앱 아이콘 512x512 — 32비트 PNG(알파 채널 있어야 함), 1024KB 이하.
    //   ★ iOS 와 정반대다. RGB 24비트로 올리면 Play Console 이 "32-bit PNG" 를 요구하며 반려한다.
    const icon = resolve(STORE, "play/icon-512.png");
    run([
        SRC_ICON,
        "-filter", "Lanczos", "-resize", "512x512",
        "-alpha", "set",
        "-define", "png:color-type=6",   // truecolor + alpha = 32bit
        "-define", "png:compression-level=9",
        "-strip", icon,
    ]);
    const ii = pngInfo(icon);
    if (ii.colorType !== 6) throw new Error(`Play 아이콘이 32비트가 아니다(colorType=${ii.colorType}).`);
    if (ii.bytes > 1024 * 1024) throw new Error(`Play 아이콘이 1024KB 를 넘었다(${(ii.bytes / 1024).toFixed(0)}KB).`);
    note(icon, "(32bit + 1MB 이하 검증 통과)");

    // ② 피처 그래픽 1024x500 — JPEG 또는 24비트 PNG. 알파 금지.
    //   스플래시 원본(3:2)을 1024x500(≈2.05:1)에 맞추려면 상하가 크게 잘린다.
    //   ★ 중앙 크롭이 아니라 위쪽 기준(North) 크롭이다. 스플래시 원본은 아래쪽이 바닥/돌무더기라
    //     중앙 크롭하면 성당 아치가 잘려나가고 바닥만 남는다.
    const feature = resolve(STORE, "play/feature-1024x500.png");
    run([
        SRC_SPLASH,
        "-filter", "Lanczos", "-resize", "1024x500^",
        "-gravity", "north", "-extent", "1024x500",
        // ★ 원본 스플래시는 게임 중 눈이 어둠에 적응한 상태를 전제로 칠해졌다.
        //   Play 스토어 목록에서는 밝은 UI 사이에 끼어 거의 검은 사각형으로 보인다.
        //   밝기 145% / 채도 115% 는 "스토어에서 형태가 보이는" 최소치다.
        "-modulate", "145,115,100",
        // 워드마크 합성 — 피처 그래픽에 게임 이름이 없으면 목록에서 무엇인지 알 수 없다.
        "(", SRC_LOGO, "-filter", "Lanczos", "-resize", "660x", ")",
        // -20 은 중앙보다 살짝 위. Play 가 카드 하단에 앱 이름을 겹쳐 그리는 레이아웃 대비다.
        "-gravity", "center", "-geometry", "+0-20", "-composite",
        "-background", VOID, "-alpha", "remove", "-alpha", "off",
        "-define", "png:color-type=2",
        "-strip", feature,
    ]);
    const fi = pngInfo(feature);
    if (fi.colorType !== 2) throw new Error(`피처 그래픽에 알파가 남았다(colorType=${fi.colorType}). Play 는 알파 있는 피처 그래픽을 거부한다.`);
    if (fi.w !== 1024 || fi.h !== 500) throw new Error(`피처 그래픽 크기 오류: ${fi.w}x${fi.h} (1024x500 이어야 한다)`);
    note(feature, "(24bit + 1024x500 검증 통과)");
}

// ═══════════════════════════════════════════════════════════════
//  4. 스플래시 (T714)
// ═══════════════════════════════════════════════════════════════
//  ★ 스플래시의 요구사항은 단 하나다 — "흰 플래시가 없을 것".
//    그림이 잘려도 상관없지만 배경색이 VOID 가 아니면 즉시 눈에 띈다.
//    그래서 전부 -background VOID 로 평탄화하고 알파를 없앤다.
//
//  ★ 2026-08-12 — 세로(drawable-port-*) 5장을 **의도적으로 만들지 않는다.**
//    이 게임은 가로 고정이다(AndroidManifest 의 screenOrientation="landscape" +
//    resizeableActivity="false", APK 로 검증됨). 세로 스플래시가 화면에 나오려면
//    회전 잠금이 걸리기 전 한 프레임을 스쳐야 하는데, 그 한 프레임조차
//    밀도 없는 기본 `drawable/splash.png` 가 폴백으로 받아준다.
//    (Android 리소스 해석: -port 한정자가 없으면 한정자 없는 drawable/ 이 매칭된다.)
//    대가는 APK 3.21MB 였다 — 스플래시 총량 6.24MB 의 절반, APK 17.8MB 의 18%.
//
//  ★ 되살리는 법 — 아래 PORTRAIT_SPLASH 를 ANDROID_SPLASH 에 이어붙이고
//    `npm run build:icons` 를 돌리면 그대로 복구된다. 세로를 지원하게 되는 날
//    (예: Android 16 대화면 적응형 대응으로 세로 UI 를 만들 때) 그렇게 한다.
//    ⚠ res/drawable-port-* 를 만드는 도구는 이 스크립트 하나뿐이다.
//      @capacitor/assets 는 이 프로젝트에 설치돼 있지 않고, `npx cap sync` 도
//      res/ 의 이미지 리소스는 건드리지 않는다. 즉 지운 것은 다시 안 생긴다.
const PORTRAIT_SPLASH = [
    ["drawable-port-mdpi", 320, 480],
    ["drawable-port-hdpi", 480, 720],
    ["drawable-port-xhdpi", 640, 960],
    ["drawable-port-xxhdpi", 960, 1440],
    ["drawable-port-xxxhdpi", 1280, 1920],
];
void PORTRAIT_SPLASH; // 참조 보존용. 위 주석의 "되살리는 법" 참조.

const ANDROID_SPLASH = [
    // ★ 한정자 없는 drawable/ 은 지우지 마라. 세로 구성의 유일한 폴백이다.
    ["drawable", 480, 320],
    ["drawable-land-mdpi", 480, 320],
    ["drawable-land-hdpi", 720, 480],
    ["drawable-land-xhdpi", 960, 640],
    ["drawable-land-xxhdpi", 1440, 960],
    ["drawable-land-xxxhdpi", 1920, 1280],
];

function buildSplash() {
    for (const [dir, w, h] of ANDROID_SPLASH) {
        const d = resolve(RES, dir);
        ensure(d);
        const out = resolve(d, "splash.png");
        // ^ = 짧은 변 기준으로 맞춘 뒤 중앙 크롭.
        //   가로 전용 게임이라 세로 밀도별 산출물은 만들지 않는다(위 PORTRAIT_SPLASH 주석).
        run([
            SRC_SPLASH,
            "-filter", "Lanczos", "-resize", `${w}x${h}^`,
            "-gravity", "center", "-extent", `${w}x${h}`,
            "-background", VOID, "-alpha", "remove", "-alpha", "off",
            "-define", "png:color-type=2", "-strip", out,
        ]);
        note(out);
    }

    // iOS 런치스크린 — 2732x2732 정사각 ×3 (파일명 고정, Contents.json 이 이 이름을 참조한다).
    // ★ 화면 비율에 맞춰 중앙이 크롭되므로 원본을 "채우는" 게 아니라 "중앙에 얹고 여백은 VOID" 다.
    //   채우기(^)로 하면 3:2 원본이 1:1 에서 좌우 60% 가 날아간다.
    const sdir = resolve(XCA, "Splash.imageset");
    ensure(sdir);
    for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
        const out = resolve(sdir, name);
        run([
            SRC_SPLASH,
            "-filter", "Lanczos", "-resize", "2732x2732>",
            "-background", VOID, "-gravity", "center", "-extent", "2732x2732",
            "-alpha", "remove", "-alpha", "off",
            "-define", "png:color-type=2", "-strip", out,
        ]);
        note(out);
    }
}

// ═══════════════════════════════════════════════════════════════
const t0 = Date.now();
console.log(`[build-icons] magick = ${MAGICK}`);
buildAndroidLauncher();
buildIosIcon();
buildPlayAssets();
buildSplash();
console.log(`\n[build-icons] 생성 ${made.length}개 / ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const m of made) console.log("  " + m);
console.log(`
다음 할 일:
  1) npx cap sync   — 아이콘/스플래시는 res/ 와 xcassets/ 에 직접 쓰므로 sync 는 웹 자산 때문에만 필요하다
  2) store/play/icon-512.png + store/play/feature-1024x500.png → Play Console 스토어 등록정보
  3) store/appstore/icon-1024.png → 이미 ios/App/App/Assets.xcassets 에 반영됨(별도 업로드 불필요)`);
