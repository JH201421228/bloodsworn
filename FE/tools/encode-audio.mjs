/**
 * BGM 재인코딩 — asset/bgm 원본 27.5MB 중 실제로 쓰는 13곡만 뽑아 압축한다. (T610b)
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md 4.1(용량 목표) 5.1(원본 실측) 5.3(배정)
 * 목록·비트레이트의 정본은 FE/src/data/audio.json 이다. 이 스크립트는 거기 적힌 것만 만든다.
 * 실행: node tools/encode-audio.mjs   (FE/ 에서. package.json 에 "build:audio" 로 등록 권장)
 *   --dry-run  실제 인코딩 없이 계획과 예상 용량만 출력
 *   --force    이미 있는 산출물도 다시 만든다
 *
 * ★ 이걸 돌리지 않으면 AAB 가 목표(10MB)를 크게 넘긴다.
 *   원본은 21곡 전부 256kbps 이고, 그중 2쌍은 md5 가 같은 완전 중복이다(아래에서 재확인한다).
 *
 * ★ 페이드아웃을 duration 계산 없이 areverse 로 거는 이유
 *   ffprobe 가 없는 환경이 있고, 길이를 잘못 넣으면 루프 이음매가 오히려 튄다.
 *   areverse → 앞 5ms 페이드인 → 다시 areverse 하면 정확히 "끝 5ms 페이드아웃"이 된다.
 *   09-ART 규칙 A4(이음매 클릭 방지)의 목적을 길이 정보 없이 달성한다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE = resolve(HERE, "..");
const ROOT = resolve(FE, "..");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");

const cfgAll = JSON.parse(readFileSync(resolve(FE, "src/data/audio.json"), "utf8"));
const ENC = cfgAll.encode;
const TRACKS = cfgAll.tracks;

const SRC = resolve(ROOT, ENC.srcDir);
const OUT = resolve(ROOT, ENC.outDir);

/** ffmpeg 탐색. Windows 설치본은 PATH 에 안 잡히는 경우가 흔하다 */
function findFfmpeg() {
    const candidates = [
        "ffmpeg",
        "C:/ffmpeg/bin/ffmpeg.exe",
        "C:/Program Files/ffmpeg/bin/ffmpeg.exe",
        "C:/ProgramData/chocolatey/bin/ffmpeg.exe",
        join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Links/ffmpeg.exe"),
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
    ];
    for (const c of candidates) {
        if (!c) continue;
        try {
            execFileSync(c, ["-version"], { stdio: "ignore" });
            return c;
        } catch { /* 다음 후보 */ }
    }
    return null;
}

const mb = (bytes) => (bytes / 1048576).toFixed(2) + "MB";
const kb = (bytes) => Math.round(bytes / 1024) + "KB";

/** 원본 중복 검출. 문서가 주장하는 md5 동일 2쌍을 매번 재확인한다 — 원본이 바뀌면 알아야 한다 */
function reportDuplicates() {
    if (!existsSync(SRC)) return;
    const byHash = new Map();
    for (const f of readdirSync(SRC)) {
        if (!f.toLowerCase().endsWith(".mp3")) continue;
        const h = createHash("md5").update(readFileSync(join(SRC, f))).digest("hex");
        if (!byHash.has(h)) byHash.set(h, []);
        byHash.get(h).push(f);
    }
    const dups = [...byHash.values()].filter((v) => v.length > 1);
    if (!dups.length) {
        console.log("  중복 없음");
        return;
    }
    for (const g of dups) console.log("  중복: " + g.join("  ==  "));
}

function encodeArgs(track, fmt, outPath) {
    const bitrate = track.bitrate ?? ENC.bitrate;
    const ch = track.channels ?? ENC.channels;
    const fade = (ENC.fadeMs ?? 5) / 1000;
    // 앞 5ms 페이드인 → 뒤집어서 다시 앞 5ms 페이드인 → 원복 = 앞뒤 5ms 페이드
    const af = `afade=t=in:st=0:d=${fade},areverse,afade=t=in:st=0:d=${fade},areverse`;
    const codec = fmt === "ogg" ? ["-c:a", "libvorbis"] : ["-c:a", "aac", "-movflags", "+faststart"];
    return [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", resolve(SRC, track.src),
        "-vn", "-map_metadata", "-1", // 앨범아트/태그가 통째로 따라 들어오는 사고를 막는다
        "-ac", String(ch), "-ar", String(ENC.sampleRate ?? 44100),
        ...codec, "-b:a", bitrate,
        "-af", af,
        outPath,
    ];
}

function main() {
    console.log("BLOODSWORN BGM 인코더 (T610b)");
    console.log("  원본 : " + SRC);
    console.log("  산출 : " + OUT);
    console.log("  포맷 : " + ENC.formats.join(", ") + " / 기본 " + ENC.bitrate + " " + ENC.channels + "ch");
    console.log("");

    if (!existsSync(SRC)) {
        console.error("원본 폴더가 없다: " + SRC);
        console.error("asset/ 는 git 제외 대상이다. 백업에서 복원한 뒤 다시 실행할 것.");
        process.exit(1);
    }

    console.log("[1/3] 원본 중복 검사 (md5)");
    reportDuplicates();
    console.log("");

    const ffmpeg = findFfmpeg();
    console.log("[2/3] 인코딩");
    if (!ffmpeg) {
        console.error("  ffmpeg 을 찾지 못했다. 설치 후 다시 실행할 것.");
        console.error("    winget install Gyan.FFmpeg     (Windows)");
        console.error("    brew install ffmpeg            (macOS)");
        console.error("  설치했는데도 못 찾으면 이 파일의 findFfmpeg() 후보 목록에 경로를 추가하면 된다.");
    } else {
        console.log("  ffmpeg: " + ffmpeg);
    }

    let expected = 0;
    let produced = 0;
    let missing = 0;
    let failed = 0;

    if (!DRY && ffmpeg) mkdirSync(OUT, { recursive: true });

    for (const t of TRACKS) {
        const srcPath = resolve(SRC, t.src);
        const bitrate = parseInt(t.bitrate ?? ENC.bitrate, 10);
        const est = (t.sec ?? 0) * bitrate * 125; // kbps → bytes/s (1000/8)
        expected += est * ENC.formats.length;

        if (!existsSync(srcPath)) {
            console.warn("  [없음] " + t.src);
            missing++;
            continue;
        }

        for (const fmt of ENC.formats) {
            const outPath = resolve(OUT, t.key + "." + fmt);
            const label = t.key + "." + fmt + "  " + (t.bitrate ?? ENC.bitrate) + " " + (t.channels ?? ENC.channels) + "ch";
            if (DRY || !ffmpeg) {
                console.log("  [계획] " + label + "  예상 " + kb(est));
                continue;
            }
            if (existsSync(outPath) && !FORCE) {
                produced += statSync(outPath).size;
                console.log("  [유지] " + label + "  " + kb(statSync(outPath).size));
                continue;
            }
            const r = spawnSync(ffmpeg, encodeArgs(t, fmt, outPath), { stdio: ["ignore", "inherit", "inherit"] });
            if (r.status !== 0 || !existsSync(outPath)) {
                console.error("  [실패] " + label);
                failed++;
                continue;
            }
            const size = statSync(outPath).size;
            produced += size;
            console.log("  [완료] " + label + "  " + kb(size));
        }
    }

    console.log("");
    console.log("[3/3] 결과");
    const total = (DRY || !ffmpeg) ? expected : produced;
    console.log("  트랙 " + TRACKS.length + "곡 / 합계 " + mb(total) + (DRY || !ffmpeg ? " (예상)" : ""));
    if (missing) console.log("  원본 누락 " + missing + "곡");
    if (failed) console.log("  인코딩 실패 " + failed + "건");
    const budget = (ENC.budgetMB ?? 4.5) * 1048576;
    if (total > budget) {
        console.log("  ⚠ 오디오 예산 " + ENC.budgetMB + "MB 초과. audio.json 의 encode.bitrate 또는");
        console.log("    개별 track.bitrate/channels 를 낮추거나 트랙을 줄일 것.");
    } else {
        console.log("  예산 " + ENC.budgetMB + "MB 이내");
    }

    // PreloadScene 은 FE/public/assets.json 만 읽는다(T114). 손으로 옮겨 붙이도록 그대로 출력한다.
    console.log("");
    console.log("── FE/public/assets.json 의 \"audio\" 배열에 넣을 내용 ──");
    const entries = TRACKS.map((t) => ({
        key: t.key,
        urls: ENC.formats.map((f) => "assets/audio/bgm/" + t.key + "." + f),
    }));
    console.log(JSON.stringify(entries, null, 4));
}

main();
