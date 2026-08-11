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
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID = resolve(HERE, "..", "android");

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("[gradle] 태스크 이름이 필요하다. 예: node tools/gradle.mjs bundleRelease");
    process.exit(2);
}

// ── 1) JDK 21 확인 ────────────────────────────────────────────────────────
const javaHome = process.env.JAVA_HOME;
const javaBin = javaHome ? join(javaHome, "bin", "java") : "java";
const v = spawnSync(javaBin, ["-version"], { encoding: "utf8" });
if (v.error) {
    console.error(`[gradle] java 를 실행할 수 없다 (${javaBin}). JAVA_HOME 을 확인하라. → 14 §6.0`);
    process.exit(2);
}
// java -version 은 stderr 로 나온다. 'openjdk version "21.0.12"' 에서 앞 숫자만 본다.
const raw = `${v.stderr || ""}${v.stdout || ""}`;
const m = raw.match(/version "([0-9]+)/);
const major = m ? Number(m[1]) : NaN;
if (major !== 21) {
    console.error(`[gradle] 🔴 JDK 21 이 필요하다. 지금은 ${m ? m[1] : "알 수 없음"} 이다.`);
    console.error(`         Capacitor 7 의 :capacitor-android 가 소스 레벨 21 이라 그 아래로는`);
    console.error(`         'error: invalid source release: 21' 로 죽는다. 근거: docs/14 §6.0`);
    console.error(`         JAVA_HOME=${javaHome || "(미설정)"}`);
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
});
if (r.error) {
    console.error(`[gradle] 실행 실패: ${r.error.message}`);
    process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
