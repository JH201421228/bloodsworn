/**
 * 출고 번들에서 **수령본(작업용 원본)** 을 뺀다.
 *
 * ★ 왜 필요한가 (2026-08-13 실측)
 *   코덱스 아트를 받으면 `public/assets/generated/` 에 3벌이 들어온다 —
 *   `-source`(크로마키 원본, ~1MB) · `-alpha`(배경 제거본, ~400KB) · 게임 격자용 낱장.
 *   게임이 로드하는 것은 이걸 `tools/bake-*.mjs` 가 **재단해 구운 결과물**이고
 *   (`assets/icons/`, `assets/projectile/`, `assets/decal/`), 수령본 자체는 런타임에
 *   단 한 장도 안 쓴다. 그런데 Vite 는 `public/` 을 통째로 `dist/` 로 복사하고
 *   Capacitor 는 `dist/` 를 통째로 APK 에 넣는다.
 *   그 결과 **APK 19.03MB → 23.83MB. 늘어난 4.9MB 전부가 안 쓰는 원본이었다**(APK 의 20%).
 *
 * ★ 왜 파일을 지우지 않고 여기서 거르나
 *   수령본은 코덱스에 다시 의뢰해야 만들 수 있어 재생성 비용이 있다. 재단 기준이 틀리면
 *   (실제로 화살·혼탄 2건이 그랬다) 원본에서 **다시 잘라야** 한다. 그래서 디스크에는 남기고
 *   **출고본에서만** 뺀다. 디스크 정리와 출고 용량은 서로 다른 문제다.
 *
 * ★ 이름으로 지우지 않는다 — **매니페스트에 없는 것만** 지운다
 *   "`-source` 로 끝나면 지운다" 같은 규칙은, 나중에 누가 `generated/` 안의 파일을
 *   assets.json 에 직접 물리는 순간 **빌드가 조용히 그 파일을 훔쳐 가고 게임은 404 로 죽는다.**
 *   그래서 `dist/assets.json` 이 실제로 부르는 경로를 먼저 모으고, 거기 없는 것만 지운다.
 *   혹시 걸리면 지우지 않고 **경고를 띄운다** — 그때는 이 규칙을 다시 볼 때다.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** 출고에서 빼는 후보 폴더. dist 루트 기준 상대경로. */
const RECEIPT_DIRS = ["assets/generated"];

const ASSET_EXT = /\.(png|jpe?g|webp|gif|mp3|ogg|m4a|wav|json|xml|fnt|ttf|woff2?)$/i;

/** JSON 안의 모든 문자열 잎 중 **자산 확장자로 끝나는 것**만 모은다.
 *  (assets.json 의 설명용 주석 문자열이 경로처럼 보여도 걸리지 않게 하는 장치다.) */
function collectAssetPaths(node, out) {
    if (typeof node === "string") {
        if (ASSET_EXT.test(node)) out.add(node.replace(/^\.?\//, "").split("\\").join("/"));
        return out;
    }
    if (Array.isArray(node)) {
        for (const v of node) collectAssetPaths(v, out);
        return out;
    }
    if (node && typeof node === "object") {
        for (const v of Object.values(node)) collectAssetPaths(v, out);
    }
    return out;
}

function walk(dir, out) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

export default function stripReceipts() {
    return {
        name: "bsw-strip-receipts",
        apply: "build",
        closeBundle() {
            const dist = resolve(process.cwd(), "dist");
            const manifest = join(dist, "assets.json");
            if (!existsSync(manifest)) {
                this.warn("[수령본] dist/assets.json 이 없어 아무것도 지우지 않았다.");
                return;
            }

            let referenced;
            try {
                referenced = collectAssetPaths(JSON.parse(readFileSync(manifest, "utf8")), new Set());
            } catch (e) {
                // 매니페스트를 못 읽으면 "참조가 없다"가 아니라 "모른다"이다. 지우지 않는다.
                this.warn(`[수령본] assets.json 을 못 읽어 아무것도 지우지 않았다: ${e.message}`);
                return;
            }

            let bytes = 0, dropped = 0;
            for (const rel of RECEIPT_DIRS) {
                const dir = join(dist, rel);
                if (!existsSync(dir)) continue;
                for (const file of walk(dir, [])) {
                    const key = relative(dist, file).split("\\").join("/");
                    if (referenced.has(key)) {
                        this.warn(
                            `[수령본] ${key} 는 assets.json 이 실제로 부른다 — 지우지 않았다.\n` +
                            `         수령본 폴더에 런타임 자산이 들어왔다는 뜻이다. ` +
                            `구운 결과물로 옮기거나 RECEIPT_DIRS 를 다시 보라.`
                        );
                        continue;
                    }
                    bytes += statSync(file).size;
                    unlinkSync(file);
                    dropped++;
                }
            }
            if (dropped) {
                console.log(
                    `[수령본] 출고본에서 ${dropped}개 / ${(bytes / 1048576).toFixed(2)}MB 를 뺐다 ` +
                    `(${RECEIPT_DIRS.join(", ")} — 디스크 원본은 그대로).`
                );
            }
        },
    };
}
