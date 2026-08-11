/**
 * SanctumSystem — 성소 영구 업그레이드를 런에 적용한다. (T601 배선)
 *
 * ★ 왜 별도 파일인가
 *   성소는 "런 밖에서 산 것을 런 안으로 들여오는" 유일한 통로다. 그 변환을 한 곳에 모아
 *   두지 않으면 업그레이드를 하나 추가할 때마다 StatSystem·PactSystem·CombatSystem 을
 *   각각 고쳐야 한다. 여기가 sanctum.json 과 게임 시스템 사이의 유일한 접점이다.
 *
 * ★ 왜 지금까지 안 붙어 있었나
 *   구매·레벨은 저장되는데 `effectPerLevel` 을 읽는 코드가 어디에도 없었다.
 *   검증기가 잡기 전까지 "골드를 썼는데 아무 변화가 없는" 상태였다 —
 *   크래시가 아니라 조용한 손실이라 눈치채기 어려웠다.
 *
 * ★ 데이터의 스탯 이름이 코드와 다르다
 *   sanctum.json 은 `damageMult`/`goldMult` 라고 적는데 StatSystem 은 `damage`/`goldMult` 다.
 *   데이터를 고치지 않고 여기서 매핑한다 — 08-DATA-SCHEMA 가 데이터 쪽 이름을 정본으로
 *   삼고 있고, 문서와 데이터를 동시에 고치는 것보다 접점 한 줄이 싸다.
 *
 * ── 통합 계약 ──
 *   applySanctum(scene, upgrades) : { [id]: level } 를 받아 런 시작 시 1회 적용
 *   sanctumSummary(upgrades)      : UI 표시용 요약(적용 전 미리보기)
 */
import sanctumData from "@/data/sanctum.json";

/** sanctum.json 의 스탯 이름 -> StatSystem 의 실제 키 */
const STAT_ALIAS = { damageMult: "damage", speedMult: "moveSpeed" };

/** 성소 모디파이어의 src 접두. 런 재시작 시 removeBySrc 로 한 번에 걷는다 */
const SRC = "sanctum:";

const LIST = sanctumData.upgrades ?? [];
const BY_ID = Object.fromEntries(LIST.map((u) => [u.id, u]));

/**
 * @param {Phaser.Scene} scene GameScene
 * @param {Record<string, number>} upgrades { meta_tough: 3, ... }
 * @returns {{stats:number, specials:string[]}} 적용 요약
 */
export function applySanctum(scene, upgrades) {
    const stats = scene.stats;
    const pact = scene.pact;
    if (!stats || !upgrades) return { stats: 0, specials: [] };

    // 재시작 대비. 같은 씬 인스턴스가 재사용되면 이전 런의 모디파이어가 남는다.
    for (const u of LIST) stats.removeBySrc?.(SRC + u.id);

    let n = 0;
    const specials = [];
    for (const [id, lvRaw] of Object.entries(upgrades)) {
        const def = BY_ID[id];
        if (!def) { console.warn("[Sanctum] 알 수 없는 업그레이드:", id); continue; }
        const lv = Math.max(0, Math.min(lvRaw | 0, def.maxLevel ?? 0));
        if (lv <= 0) continue;
        const e = def.effectPerLevel;
        if (!e) continue;

        if (e.op === "special") {
            specials.push(applySpecial(e, lv, { scene, pact }) ?? e.id);
            continue;
        }
        const key = STAT_ALIAS[e.stat] ?? e.stat;
        // ★ 반드시 StatSystem 을 거친다. 직접 수치를 만지면 계산 순서
        //   (기본→가산→곱연산→대가→각성→하한)가 무너진다.
        stats.add(key, e.op ?? "add", (e.value ?? 0) * lv, SRC + id);
        n++;
    }
    return { stats: n, specials };
}

/**
 * 수치가 아니라 **규칙**을 바꾸는 업그레이드.
 * ★ 스탯으로 표현할 수 없는 것만 여기 온다. 스탯으로 되는 것을 특수로 만들면
 *   하한(S1)과 계산 순서를 우회하게 되어 밸런스 안전장치가 무력해진다.
 */
function applySpecial(e, lv, { pact }) {
    const p = e.params ?? {};
    switch (e.id) {
        case "reroll_plus":
            // 런당 리롤 횟수. PactSystem 이 생성자에서 2로 잡아 둔다.
            if (pact) pact.rerollLeft += (p.delta ?? 1) * lv;
            return `리롤 +${(p.delta ?? 1) * lv}`;

        case "awaken_threshold_reduce": {
            // 각성 필요 중첩을 낮춘다. AWAKEN_STACKS 는 상수라 못 바꾸므로
            // PactSystem 에 인스턴스 오버라이드를 둔다(없으면 상수를 쓰는 기존 동작).
            const d = (p.delta ?? -0.2) * lv;
            if (pact) pact.awakenStacksOverride = (pact.awakenStacksOverride ?? 3) + d;
            return `각성 임계 ${d.toFixed(1)}`;
        }
        default:
            console.warn("[Sanctum] 처리하지 않는 special:", e.id);
            return null;
    }
}

/** 구매 화면에서 "지금 사면 무엇이 붙는가"를 보여줄 때 쓴다 */
export function sanctumSummary(upgrades = {}) {
    const out = [];
    for (const u of LIST) {
        const lv = upgrades[u.id] ?? 0;
        if (lv <= 0) continue;
        out.push({ id: u.id, name: u.name, level: lv, max: u.maxLevel, desc: u.desc });
    }
    return out;
}
