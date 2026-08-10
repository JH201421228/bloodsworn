/**
 * 스토어 문안 글자 수 검증 — 초과하면 Play Console 이 저장 자체를 거부한다.
 * 실행: node docs/store/check-length.mjs   (저장소 루트에서)
 *
 * ★ 스토어의 글자 수는 UTF-16 코드유닛이 아니라 "글자" 기준이다.
 *   한글 1자 = 1자로 센다. JS 의 String.length 가 그대로 맞는다(BMP 범위 내).
 *   단 이모지는 2로 세지므로 [...str].length 로 코드포인트를 센다.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIMITS = { "앱 이름": 30, "App name": 30, "짧은 설명": 80, "Short description": 80, "자세한 설명": 4000, "Full description": 4000 };

let failed = 0;
for (const file of ["listing-ko.md", "listing-en.md"]) {
    const md = readFileSync(resolve(HERE, file), "utf8");
    console.log(`\n── ${file}`);
    // "## 제목 (…)" 다음의 첫 코드블록을 그 항목의 문안으로 본다.
    const re = /^## ([^\n(]+?)\s*\([^)]*\)\s*$\n+```\n([\s\S]*?)\n```/gm;
    for (const m of md.matchAll(re)) {
        const name = m[1].trim();
        const limit = LIMITS[name];
        if (!limit) continue;
        const n = [...m[2]].length;
        const ok = n <= limit;
        if (!ok) failed++;
        console.log(`  ${ok ? "OK  " : "FAIL"} ${name.padEnd(20)} ${String(n).padStart(4)} / ${limit}`);
    }
}
if (failed) {
    console.error(`\n${failed}개 항목이 한도를 넘었다.`);
    process.exit(1);
}
console.log("\n전 항목 한도 이내.");
