/**
 * validateData — 개발 모드 JSON 검증. (T322)
 *
 * ★ 왜 필요한가: 데이터를 JSON으로 뺀 이유는 밸런싱을 코드 수정 없이 하기 위해서다.
 *   그런데 오타 하나(쉼표 누락이 아니라 `damge: 12` 같은 키 오타)는 JSON 파서를 통과하고
 *   런타임에 `undefined` 가 되어 데미지가 NaN 이 된다. NaN 은 비교가 전부 false 라
 *   "적이 죽지 않는다"로 나타나고, 원인을 찾는 데 반나절이 든다.
 *   그래서 부팅 시 한 번, 필수 키와 타입을 전수 검사한다.
 *
 * ★ 예외를 던지지 않는다. 게임이 아예 안 켜지면 밸런싱 작업 자체가 막힌다.
 *   콘솔에 모아서 크게 찍고 계속 진행한다. 프로덕션 빌드에서는 호출되지 않는다.
 */
import weapons from "./weapons.json";
import enemies from "./enemies.json";
import blessings from "./blessings.json";
import tolls from "./tolls.json";
import phases from "./phases.json";
import nocturne from "./nocturneLines.json";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string" && v.length > 0;

/** 한 객체에 대해 {키: 검사함수} 표를 돌린다 */
function checkShape(errors, where, obj, shape) {
    if (!obj || typeof obj !== "object") { errors.push(`${where}: 객체가 아니다`); return; }
    for (const [key, test] of Object.entries(shape)) {
        if (!test(obj[key])) errors.push(`${where}.${key} = ${JSON.stringify(obj[key])} (형식 위반)`);
    }
}

export function validateData() {
    const errors = [];

    // ── 무기: 레벨 배열이 maxLevel과 길이가 같아야 한다.
    //    짧으면 만렙 근처에서 levels[lv-1] 이 undefined 가 되어 조용히 죽는다.
    for (const w of weapons.weapons) {
        checkShape(errors, `weapon ${w.id}`, w, { id: isStr, name: isStr, type: isStr, maxLevel: isNum });
        if (!Array.isArray(w.levels) || w.levels.length !== w.maxLevel) {
            errors.push(`weapon ${w.id}: levels 길이 ${w.levels?.length} != maxLevel ${w.maxLevel}`);
            continue;
        }
        const required = {
            melee_arc: ["damage", "cooldown", "radius", "arcDeg", "knockback"],
            projectile: ["damage", "cooldown", "range", "count", "pierce", "speed", "knockback"],
            orbit: ["damage", "radius", "count", "degPerSec", "rehit", "knockback"],
            zone: ["damage", "cooldown", "drops", "radius", "duration", "tick", "scatter"],
        }[w.type] ?? [];
        w.levels.forEach((lv, i) => {
            for (const k of required) if (!isNum(lv[k])) errors.push(`weapon ${w.id} Lv${i + 1}.${k} 누락/비숫자`);
        });
    }

    // ── 적
    for (const e of enemies.enemies ?? []) {
        checkShape(errors, `enemy ${e.id}`, e, { id: isStr, hp: isNum, speed: isNum, damage: isNum });
    }

    // ── 축복: 등급 3단계(common/rare/epic) 값이 모두 있어야 한다.
    //    2개만 있으면 Epic 카드가 undefined 배율로 적용된다.
    for (const b of blessings.blessings) {
        checkShape(errors, `blessing ${b.id}`, b, { id: isStr, name: isStr, op: isStr, maxLevel: isNum });
        if (b.op === "weapon") {
            if (!isStr(b.target)) errors.push(`blessing ${b.id}: weapon 인데 target 이 없다`);
            else if (!weapons.weapons.some((w) => w.id === b.target)) errors.push(`blessing ${b.id}: target ${b.target} 무기가 없다`);
        } else {
            if (!isStr(b.stat)) errors.push(`blessing ${b.id}: stat 이 없다`);
            if (!Array.isArray(b.value) || b.value.length !== 3 || !b.value.every(isNum)) {
                errors.push(`blessing ${b.id}: value 는 [common, rare, epic] 숫자 3개여야 한다`);
            }
        }
    }

    // ── 대가: 안전장치 S1 — 하한 없는 대가가 하나라도 있으면 밸런스가 붕괴한다
    for (const t of tolls.tolls ?? []) {
        checkShape(errors, `toll ${t.tag}`, t, { tag: isStr, stat: isStr });
        if (!isNum(t.amount) && !Array.isArray(t.amount)) errors.push(`toll ${t.tag}: amount 누락`);
    }

    // ── 페이즈: 시간 순서가 단조 증가해야 한다. 뒤집히면 구간이 영원히 안 온다.
    const segs = phases.phases ?? phases.segments ?? [];
    let prev = -1;
    segs.forEach((p, i) => {
        const t = p.startSec ?? p.start ?? p.at;
        if (!isNum(t)) { errors.push(`phase[${i}]: 시작 시각이 없다`); return; }
        if (t <= prev) errors.push(`phase[${i}]: 시작 시각 ${t} 가 직전 ${prev} 이하다`);
        prev = t;
    });

    // ── 녹턴: 1줄 22자 초과는 UI에서 잘린다 (10-UIUX §1340)
    const lines = [...nocturne.pool, nocturne.first, ...nocturne.awaken];
    if (nocturne.pool.length < 12) errors.push(`nocturne: 대사가 ${nocturne.pool.length}개 (최소 12)`);
    for (const l of lines) if (l.length > 22) errors.push(`nocturne: "${l}" 가 22자를 넘는다 (${l.length}자)`);

    if (errors.length) {
        console.error(`%c[데이터 검증] ${errors.length}건 위반`, "color:#c4182b;font-weight:bold");
        errors.forEach((e) => console.error("  ·", e));
    } else {
        console.info("%c[데이터 검증] 통과", "color:#35c9b4");
    }
    return errors;
}
