/**
 * Gradle 러너 — package.json 의 release:aab / release:apk 가 부른다.
 *
 * ★ 왜 이 파일이 있나
 *   `npm run release:aab` 는 "npm run build:android && node tools/gradle.mjs bundleRelease" 다.
 *   이 파일이 없어서 릴리스 npm 스크립트가 실제로는 동작하지 않았다(2026-08-12 발견·복구).
 *
 * ★ 하는 일은 두 가지뿐이다
 *   1) 릴리스 빌드가 **JDK 21 에서만** 출발하게 막는다.
 *      Capacitor 7 의 :capacitor-android 가 소스 레벨 21 이라 17 이면
 *      `error: invalid source release: 21` 로 죽는다. 14-BUILD-AND-DEPLOY.md §6.0.
 *      릴리스 빌드는 5분 이상 걸리므로 5초 만에 걸러주는 편이 낫다.
 *   2) FE/android 의 gradlew 를 그대로 실행하고 종료 코드를 그대로 넘긴다.
 *
 * ⚠ versionCode 는 여기서 만지지 않는다. android/app/build.gradle 의 [T243] 블록이
 *   릴리스 태스크를 감지해 version.properties 를 +1 한다(14 §11.1).
 *
 * 사용: node tools/gradle.mjs bundleRelease [추가 gradle 인자...]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID = resolve(HERE, "..", "android");

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("[gradle] 태스크 이름이 필요하다. 예: node tools/gradle.mjs bundleRelease");
    process.exit(2);
}

// ── 1) JDK 21 확인 ────────────────────────────────────────
/** `<home>/bin/java -version` 을 실제로 실행해 메이저 버전을 얻는다. 안 되면 NaN. */
function majorOf(home) {
    const r = spawnSync(home ? join(home, "bin", "java") : "java", ["-version"], { encoding: "utf8" });
    if (r.error) return NaN;
    // java -version 은 stderr 로 나온다. 'openjdk version "21.0.12"' 에서 앞 숫자만 본다.
    const m = `${r.stderr || ""}${r.stdout || ""}`.match(/version "([0-9]+)/);
    return m ? Number(m[1]) : NaN;
}

/**
 * JAVA_HOME 이 없을 때 표준 설치 위치를 뒤진다.
 *
 * ★ 폴더 이름이 아니라 **java -version 을 실행해** 고른다. 이름은 거짓말을 한다 —
 *   Android Studio 의 jbr 은 폴더명에 버전이 아예 없고, 배포판마다 표기가 다르다.
 * ★ 이름에 "21" 이 든 후보를 먼저 보는 것은 **순서일 뿐 판정 기준이 아니다.**
 */
function findJdk21() {
    const win = process.platform === "win32";
    const PF = process.env.ProgramFiles || "C:\Program Files";
    const LA = process.env.LOCALAPPDATA || "";
    const roots = win
        ? ["Eclipse Adoptium", "Java", "Microsoft", "Zulu", "Amazon Corretto", "BellSoft"].map((d) => join(PF, d))
        : ["/usr/lib/jvm", "/Library/Java/JavaVirtualMachines",
           join(process.env.HOME || "", ".sdkman", "candidates", "java")];
    const fixed = win
        ? [join(PF, "Android", "Android Studio", "jbr"), LA && join(LA, "Programs", "Android Studio", "jbr")]
        : ["/Applications/Android Studio.app/Contents/jbr/Contents/Home"];

    const cands = [];
    for (const root of roots) {
        if (!root || !existsSync(root)) continue;
        for (const name of readdirSync(root)) {
            cands.push(join(root, name));
            // macOS 의 .jdk 번들은 Contents/Home 이 진짜 JAVA_HOME 이다.
            cands.push(join(root, name, "Contents", "Home"));
        }
    }
    for (const p of fixed) if (p) cands.push(p);

    const real = cands.filter((p) => existsSync(join(p, "bin")));
    real.sort((a, b) => (b.includes("21") ? 1 : 0) - (a.includes("21") ? 1 : 0));
    for (const p of real) if (majorOf(p) === 21) return p;
    return null;
}

let javaHome = process.env.JAVA_HOME || null;
let major = majorOf(javaHome); // javaHome 이 null 이면 PATH 의 java 를 본다

// ★ JAVA_HOME 이 **명시돼 있으면 절대 갈아치지 않는다.** 명시적 설정은 의도의 선언이고,
//   조용히 다른 JDK 로 빌드하면 "왜 내 JDK 가 안 쓰였나"에 답할 수 없게 된다.
//   대신 실패할 때 쓸 만한 21 을 찾아 **알려만 준다.**
// ⚠ 이 자동 탐색이 있는 이유: 이 스크립트의 존재 이유가 JDK 버전 관문인데,
//   JAVA_HOME 미설정만으로 관문 자체가 못 서는 것은 앞뒤가 안 맞는다(2026-08-13 실측).
if (!javaHome && major !== 21) {
    const found = findJdk21();
    if (found) {
        javaHome = found;
        major = 21;
        console.log(`[gradle] JAVA_HOME 이 없어 JDK 21 을 자동으로 찾았다 — ${found}`);
    }
}

if (major !== 21) {
    const hint = javaHome ? findJdk21() : null;
    console.error(`[gradle] 🔴 JDK 21 이 필요하다. 지금은 ${Number.isNaN(major) ? "java 를 실행조차 못 한다" : major} 이다.`);
    console.error(`         Capacitor 7 의 :capacitor-android 가 소스 레벨 21 이라 그 아래로는`);
    console.error(`         'error: invalid source release: 21' 로 죽는다. 근거: docs/14 §6.0`);
    console.error(`         JAVA_HOME=${process.env.JAVA_HOME || "(미설정)"}`);
    if (hint) console.error(`         ⓘ 이 컴퓨터에 JDK 21 이 있다: ${hint}`);
    console.error(`         ⚠ 바꿔도 안 먹으면 android/gradlew --stop 으로 데몬을 죽여라.`);
    process.exit(2);
}
console.log(`[gradle] JDK ${major} OK — ${javaHome || "PATH 의 java"}`);

// ── 2) gradlew 실행 ───────────────────────────────────────────────────────
const isWin = process.platform === "win32";
const Q = String.fromCharCode(34);
const wrapper = isWin ? "gradlew.bat" : "gradlew";
const wrapperPath = join(ANDROID, wrapper);
if (!existsSync(wrapperPath)) {
    console.error(`[gradle] ${wrapperPath} 가 없다. 'npx cap add android' 가 안 된 상태인지 확인하라.`);
    process.exit(2);
}

console.log(`[gradle] ${wrapper} ${args.join(" ")}  (cwd=${ANDROID})`);
// ⚠ Windows 에서 .bat 은 shell 없이 spawn 하면 Node 20+ 가 EINVAL 로 거부한다(CVE-2024-27980 대응).
// 경로에 공백·한글이 있어 shell 경유 시 반드시 따옴표로 감싼다(바탕 화면 아래 프로젝트).
const cmd = isWin ? Q + wrapperPath + Q : wrapperPath;
const r = spawnSync(cmd, args, {
    cwd: ANDROID,
    stdio: "inherit",
    shell: isWin,
    // ★ gradlew 는 자기가 다시 JAVA_HOME/PATH 로 java 를 찾는다.
    //   위에서 자동 탐색해 놓고 이걸 안 넘기면 **검사만 통과하고 빌드는 그대로 죽는다** —
    //   "ERROR: JAVA_HOME is not set" 으로. 실제로 한 번 그랬다(2026-08-13).
    env: javaHome ? { ...process.env, JAVA_HOME: javaHome } : process.env,
});
if (r.error) {
    console.error(`[gradle] 실행 실패: ${r.error.message}`);
    process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
