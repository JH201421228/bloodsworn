/**
 * itemStore — 아이템 UI 전용 초소형 스토어. (ui/inventory 소유)
 *
 * ★ 왜 Zustand 전역 스토어에 넣지 않는가
 *   1) uiSlice.js / bridge.js 는 다른 소유다. 두 파일을 동시에 고치면 충돌한다.
 *   2) 토스트는 "1.4~4.2초 뒤에 저절로 사라지는" 값이라 만료 타이머가 붙는다.
 *      그 타이머까지 전역 슬라이스에 얹으면 슬라이스가 시간을 갖게 되고, 그때부터
 *      "누가 이 값을 지우는가"를 추적할 수 없다. 여기 한 파일에 가두는 편이 낫다.
 *   3) 그래도 store.js 규칙(06-TECH 3.4 / T112)은 그대로 지킨다 —
 *      **매 프레임 바뀌는 값은 하나도 없다.** 갱신은 아이템을 주운 순간과
 *      토스트가 만료되는 순간, 딱 두 종류의 이벤트뿐이다. rAF 도 interval 도 돌지 않는다.
 *
 * ★ 구독은 이 파일이 직접 한다 (EventBus key 사용)
 *   bridge.js 는 현재 EVENTS.ITEM_PICKED 를 구독하지 않는다(확인함). 굳이 거쳐 갈 이유도 없다 —
 *   이 데이터를 읽는 것은 ui/inventory 세 컴포넌트뿐이라 전역을 경유하면 리렌더 범위만 넓어진다.
 *   key 를 주므로 StrictMode 이중 마운트/HMR 에서도 핸들러는 항상 1개다(EventBus.on 계약).
 *   ※ bridge.js 로 중앙집중하고 싶다면 보고서의 패치를 쓰되, 아래 installItemBridge() 호출을
 *     반드시 지워라. 둘 다 살아 있으면 같은 획득이 두 번 세어진다.
 */
import { useSyncExternalStore } from "react";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { baseOf, descOf, displayLabel } from "./itemText";
import { haloFrame } from "./itemAtlas";

// ── 토스트 정책 ────────────────────────────────────────────────
/**
 * ★ 상한과 합치기 (임무 1의 핵심)
 *   P4 후반에는 초당 여러 개가 들어온다. 개수 상한만 두면 물약 4개가 legendary 유물을
 *   밀어내는 사고가 난다. 그래서 두 축으로 막는다.
 *     - 개수 상한 MAX_TOASTS
 *     - **무게 예산** WEIGHT_BUDGET — 유물은 2칸, 나머지는 1칸을 먹는다.
 *   넘치면 "우선도가 낮은 것 중 가장 오래된 것"부터 버린다. 방금 들어온 것은 절대 안 버린다.
 */
const MAX_TOASTS = 4;
const WEIGHT_BUDGET = 5;

/**
 * 무게 차등 (임무 1의 두 번째 요구). 물약과 전설 유물이 같은 크기로 뜨면 유물의 순간이 죽는다.
 *   minor : 소모품/골드 — 한 줄, 아이콘 14, 1.4초. "먹었다"만 전달하면 끝이다.
 *   equip : 장비 — 두 줄(이름 + 슬롯), 아이콘 20, 2.4초. 갈아입었다는 사실이 중요하다.
 *   relic : 유물 — 세 줄(등급/이름/규칙), 아이콘 32 + 후광, 3.6초(전설 4.2초).
 *           유물은 수치가 아니라 **규칙**을 바꾼다. 무엇이 바뀌었는지 읽을 시간을 줘야 한다.
 */
const TIER = {
    minor: { weight: 1, prio: 1, ttl: 1400, icon: 14 },
    equip: { weight: 1, prio: 2, ttl: 2400, icon: 20 },
    relic: { weight: 2, prio: 3, ttl: 3600, icon: 32 },
};
/** 전설 유물만 조금 더 머문다. 런에 한두 번뿐인 사건이다 */
const LEGENDARY_TTL = 4200;
/** 요약 목록 상한. 접사 조합까지 세면 이론상 수백 줄이 되므로 잘라 둔다 */
const MAX_PICKED_ROWS = 64;

const EMPTY_EQUIP = { fang: null, hide: null, charm: null };

let uid = 0;
let state = {
    toasts: [],
    equipped: EMPTY_EQUIP,
    relics: [],
    /** 요약용 집계. [{ key, id, label, rarity, category, icon, count }] */
    picked: [],
    totals: { use: 0, gold: 0, equip: 0, relic: 0 },
};

const listeners = new Set();

function emit() {
    for (const fn of [...listeners]) fn();
}

function setState(patch) {
    state = { ...state, ...patch };
    emit();
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function getSnapshot() {
    return state;
}

const now = () => performance.now();

// ── 만료 ───────────────────────────────────────────────────────
/**
 * ★ setInterval 을 쓰지 않는다.
 *   200ms 폴링이면 토스트가 떠 있는 내내 초당 5회 리렌더가 돈다. 후반에는 토스트가
 *   거의 상시 떠 있으므로 그건 사실상 상시 리렌더다. 대신 **가장 이른 만료 시각 하나**에만
 *   타이머를 건다. 리렌더 횟수 = 토스트가 사라지는 횟수 = 최소값이다.
 */
let timer = 0;

function schedule() {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!state.toasts.length) return;
    let next = Infinity;
    for (const t of state.toasts) if (t.expires < next) next = t.expires;
    timer = setTimeout(sweep, Math.max(16, next - now()));
}

function sweep() {
    timer = 0;
    const t = now();
    const keep = state.toasts.filter((x) => x.expires > t);
    if (keep.length !== state.toasts.length) setState({ toasts: keep });
    schedule();
}

/**
 * 예산 초과분을 덜어낸다. keepUid(방금 들어온 것)는 후보에서 뺀다 —
 * 새 토스트가 자기 자신 때문에 즉시 사라지면 플레이어는 아무것도 못 본다.
 */
function trim(list, keepUid) {
    const weight = (a) => a.reduce((s, x) => s + x.weight, 0);
    while (list.length > 1 && (list.length > MAX_TOASTS || weight(list) > WEIGHT_BUDGET)) {
        let worst = -1;
        for (let i = 0; i < list.length; i++) {
            if (list[i].uid === keepUid) continue;
            if (worst < 0) { worst = i; continue; }
            const a = list[i], b = list[worst];
            // 우선도가 낮은 쪽 → 같으면 먼저 뜬 쪽(born 이 작은 쪽)
            if (a.prio < b.prio || (a.prio === b.prio && a.born < b.born)) worst = i;
        }
        if (worst < 0) break;
        list.splice(worst, 1);
    }
    return list;
}

/**
 * 토스트 추가 · 합치기.
 * ★ 합치기 기준은 **화면에 보이는 이름**(category + label)이다. id 로 묶으면
 *   접사가 다른 「굶주린 송곳니」와 「갈증의 송곳니」가 한 줄로 합쳐져 거짓말이 된다.
 * ★ 합쳐질 때 위치를 바꾸지 않는다. 목록이 튀면 눈이 다시 처음부터 읽어야 한다.
 *   대신 count 를 올리고 수명을 리셋하고 bump 로 숫자만 한 번 튕긴다.
 */
function pushToast(t) {
    const cur = state.toasts;
    const i = cur.findIndex((x) => x.key === t.key);
    if (i >= 0) {
        const merged = { ...cur[i], count: cur[i].count + 1, expires: now() + cur[i].ttl, bump: cur[i].bump + 1 };
        const next = cur.slice();
        next[i] = merged;
        setState({ toasts: next });
        schedule();
        return;
    }
    // 새 것이 맨 위다. 맨 위 자리는 항상 같은 y 라서 "새로 뜬 것"을 볼 곳이 고정된다.
    const next = trim([t, ...cur], t.uid);
    setState({ toasts: next });
    schedule();
}

// ── 상시 상태 (장비 3슬롯 / 유물 / 요약) ──────────────────────
/**
 * ★ ItemSystem 은 ITEM_EVENTS.EQUIPPED / RELICS 를 **선언만 하고 쏘지 않는다**(확인함).
 *   그래서 장착 현황은 ITEM_PICKED 로부터 유도한다. 이게 정확한 이유:
 *   ItemSystem.pickup() 은 taken === true 일 때만 ITEM_PICKED 를 쏜다. 그리고 장비는
 *   applyEquip() 이 "점수가 더 높을 때만" true 를 돌려준다(650행). 즉 equip 이벤트가
 *   왔다는 것은 **실제로 그 슬롯을 갈아입었다**는 뜻이다. 이벤트를 늘릴 이유가 없다.
 */
function mergePicked(key, row) {
    const cur = state.picked;
    const i = cur.findIndex((x) => x.key === key);
    if (i >= 0) {
        const next = cur.slice();
        next[i] = { ...cur[i], count: cur[i].count + 1 };
        return next;
    }
    if (cur.length >= MAX_PICKED_ROWS) return cur; // 줄 수만 자른다. totals 에는 계속 쌓인다
    return [...cur, row];
}

function onPicked(p) {
    if (!p?.id) return;
    const base = baseOf(p.id);
    const category = p.category ?? base?.category ?? "use";
    const rarity = p.rarity ?? base?.rarity ?? "common";
    const label = displayLabel(p);
    const icon = base?.icon ?? null;
    const key = category + "|" + label;

    const tier = category === "relic" ? "relic" : category === "equip" ? "equip" : "minor";
    const cfg = TIER[tier];
    const ttl = tier === "relic" && rarity === "legendary" ? LEGENDARY_TTL : cfg.ttl;
    const t = now();

    // 1) 상시 상태 먼저. 토스트가 사라져도 남아야 하는 값들이다.
    const patch = {
        totals: { ...state.totals, [category]: (state.totals[category] ?? 0) + 1 },
        picked: mergePicked(key, { key, id: p.id, label, rarity, category, icon, slot: base?.slot ?? null, count: 1 }),
    };
    if (category === "equip" && base?.slot) {
        patch.equipped = { ...state.equipped, [base.slot]: { id: p.id, label, rarity, icon, slot: base.slot } };
    }
    if (category === "relic" && !state.relics.some((r) => r.id === p.id)) {
        patch.relics = [...state.relics, { id: p.id, label, rarity, icon, desc: base?.desc ?? "", rule: base?.rule ?? null }];
    }
    setState(patch);

    // 2) 토스트. React 18 이 두 갱신을 한 렌더로 합친다.
    pushToast({
        uid: ++uid, key, tier, weight: cfg.weight, prio: cfg.prio, iconSize: cfg.icon,
        id: p.id, label, rarity, category,
        slot: base?.slot ?? null,
        icon,
        halo: rarity === "common" ? null : haloFrame(rarity),
        desc: category === "relic" ? (base?.desc ?? "") : descOf(base),
        count: 1, bump: 0, born: t, ttl, expires: t + ttl,
    });
}

/** 런 시작 — 전부 비운다. 아이템은 런과 함께 사라지는 물건이다(23 문서 2) */
function onRunStarted() {
    if (timer) { clearTimeout(timer); timer = 0; }
    setState({ toasts: [], equipped: EMPTY_EQUIP, relics: [], picked: [], totals: { use: 0, gold: 0, equip: 0, relic: 0 } });
}

/**
 * 런 종료 — 토스트만 지운다. 장비/유물/요약은 결과 화면이 읽어야 하므로 남긴다.
 * (지우지 않으면 결과 화면 위에 "물약 x3" 같은 게 떠 있다가 사라진다.)
 */
function onRunEnded() {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (state.toasts.length) setState({ toasts: [] });
}

/**
 * 부팅 시 1회. 두 번 불러도 안전하다 — EventBus 가 key 로 기존 핸들러를 교체한다(T107b).
 * @returns {() => void} 해제 함수
 */
export function installItemBridge() {
    const offs = [
        EventBus.on(EVENTS.ITEM_PICKED, onPicked, { key: "inventory:picked" }),
        EventBus.on(EVENTS.RUN_STARTED, onRunStarted, { key: "inventory:run-started" }),
        EventBus.on(EVENTS.RUN_ENDED, onRunEnded, { key: "inventory:run-ended" }),
    ];
    return () => offs.forEach((off) => off());
}

// import 시점에 바로 건다. 컴포넌트 마운트를 기다리면 그 사이에 주운 것이 유실된다.
installItemBridge();

// ── 훅 ─────────────────────────────────────────────────────────
// ★ 조각별로 나눈 이유: useSyncExternalStore 는 getSnapshot 이 매번 **같은 참조**를
//   돌려줘야 한다. { equipped, relics } 처럼 객체를 새로 만들어 돌려주면 무한 렌더가 난다.
// ★ 세 번째 인자(getServerSnapshot)는 SSR 용이 아니라 보험이다. 없으면 서버/테스트 렌더에서
//   React 가 즉시 throw 한다 — 이 앱은 CSR 전용이지만 공짜로 막을 수 있는 사고다.
export const useItemToasts = () => useSyncExternalStore(subscribe, () => state.toasts, () => state.toasts);
export const useEquipped = () => useSyncExternalStore(subscribe, () => state.equipped, () => state.equipped);
export const useRelics = () => useSyncExternalStore(subscribe, () => state.relics, () => state.relics);
export const usePickedItems = () => useSyncExternalStore(subscribe, () => state.picked, () => state.picked);
export const useItemTotals = () => useSyncExternalStore(subscribe, () => state.totals, () => state.totals);

/** 디버그/테스트용. 콘솔에서 토스트를 흉내 낼 때 쓴다 */
export const __itemStoreDebug = { getSnapshot, onPicked, TIER, MAX_TOASTS, WEIGHT_BUDGET };

/**
 * 런 전리품 스냅샷. 결과 화면을 Zustand 경유로 그리고 싶거나(보고서의 uiSlice 패치),
 * 텔레메트리에 "무엇을 끼고 죽었나"를 실어 보낼 때 쓴다.
 * ★ 매번 새 객체를 만든다 — 훅에서 직접 쓰면 무한 렌더가 난다. 이벤트 핸들러 안에서만 불러라.
 */
export function lootSnapshot() {
    const { equipped, relics, picked, totals } = state;
    return { equipped, relics, picked, totals };
}
