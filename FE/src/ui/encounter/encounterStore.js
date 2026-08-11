/**
 * encounterStore — 조우 UI 전용 초소형 스토어. (ui/encounter 소유)
 *
 * ★ 왜 Zustand 전역이 아닌가 — itemStore.js 와 정확히 같은 이유다.
 *   배너는 "1.8초 뒤에 저절로 사라지는" 값이라 만료 타이머가 붙는다. 그 타이머를 전역
 *   슬라이스에 얹으면 슬라이스가 시간을 갖게 되고, 그때부터 "누가 이 값을 지우는가"를
 *   추적할 수 없다. 한 파일에 가두는 편이 낫다.
 *
 * ★ 06-TECH 3.3 금지 규칙은 그대로 지킨다 — **매 프레임 바뀌는 값이 하나도 없다.**
 *   조우의 좌표와 남은 시간은 여기 오지 않는다. 방향 화살표는 Phaser 가 직접 그린다
 *   (EncounterSystem.drawArrow — setScrollFactor(0)). 여기서 도는 것은 조우 1건당
 *   이벤트 2~3개와 만료 타이머 1개뿐이다. rAF 도 interval 도 없다.
 *
 * ★ 예언자 미리보기만 수명이 다르다. 배너는 1.8초, 미리보기는 **그 레벨업까지** 남는다
 *   (30 §3.3). 그래서 RUN_LEVELUP 에서 지운다 — 시간이 아니라 사건이 지우는 값이다.
 */
import { useSyncExternalStore } from "react";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";

/** 30 §4.3 — 등장 배너는 1.8초 후 사라진다 */
const BANNER_MS = 1800;
/** 결과·상자 알림. 등장보다 짧다 — 이미 일어난 일이라 읽을 시간이 덜 든다 */
const RESULT_MS = 2200;

const EMPTY = [];

let uid = 0;
let state = { banner: null, preview: null };
const listeners = new Set();

function emit() { for (const fn of [...listeners]) fn(); }
function setState(patch) { state = { ...state, ...patch }; emit(); }
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let timer = 0;
function showBanner(b, ms) {
    if (timer) { clearTimeout(timer); timer = 0; }
    setState({ banner: { ...b, uid: ++uid } });
    // ★ setInterval 로 폴링하지 않는다. 사라지는 순간 딱 한 번만 리렌더한다(itemStore 와 같은 규약)
    timer = setTimeout(() => { timer = 0; setState({ banner: null }); }, ms);
}

/** 종류별 말투. "나타났다"를 전부에 붙이면 제단·궤가 사람처럼 읽힌다 */
const APPEAR = {
    merchant: (n) => "「" + n + "」이 나타났다",
    witch: (n) => "「" + n + "」가 나타났다",
    seer: (n) => "「" + n + "」가 나타났다",
    shady: (n) => "「" + n + "」가 나타났다",
    altar: (n) => "「" + n + "」이 열렸다",
    fieldboss: (n) => "「" + n + "」이 배회한다",
    chest: (n) => "「" + n + "」를 찾았다",
};

function onSpawned(p) {
    if (!p?.kind) return;
    const f = APPEAR[p.kind] ?? ((n) => "「" + n + "」");
    showBanner({ tone: p.kind, text: f(p.name ?? p.id), sub: null }, BANNER_MS);
}

function onResolved(p) {
    if (!p) return;
    showBanner({ tone: p.kind, text: p.label ?? "", sub: "얻었다" }, RESULT_MS);
}

/**
 * ★ 30 §3.7 이 지적한 세 문제 중 두 번째 — CHEST_OPENED 는 쏘고 있는데 구독자가 0이었다.
 *   여기가 그 유일한 구독자다. 새 이벤트를 만들지 않고 죽은 이벤트를 살렸다.
 */
const CHEST_TONE = { blessing: "축복", rune: "룬", items: "전리품" };
function onChest(p) {
    showBanner({ tone: "chest", text: p?.label ?? "축복", sub: CHEST_TONE[p?.kind] ?? "축복" }, RESULT_MS);
}

/**
 * 체류 시간이 끝나 조우가 그냥 사라졌다. ★ 이 구독이 없으면 ENCOUNTER_EXPIRED 는
 * 30 §3.7 이 지적한 CHEST_OPENED 와 똑같은 "쏘는데 아무도 안 듣는 이벤트"가 된다.
 * 떠났다는 말을 해 줘야 플레이어가 "내가 놓쳤다"를 안다 — 조용히 사라지면 버그로 읽힌다.
 */
const LEAVE = {
    merchant: "상인이 떠났다", witch: "마녀가 떠났다", seer: "예언자가 떠났다",
    shady: "그자가 사라졌다", altar: "제단이 닫혔다", fieldboss: "그것이 떠났다",
};
function onExpired(p) {
    const t = LEAVE[p?.kind];
    if (t) showBanner({ tone: p.kind, text: t, sub: null }, BANNER_MS);
}

function onSeer(p) {
    if (!p?.cards?.length) return;
    setState({
        preview: {
            atLevel: p.atLevel ?? 0,
            names: p.cards.map((c) => c?.blessing?.name ?? "?"),
            tolls: p.cards.map((c) => c?.toll?.name ?? null),
        },
    });
}

/** 미리보기는 "그 레벨업까지" 남는다. 카드가 실제로 뜬 순간이 수명의 끝이다 */
function onLevelUp() { if (state.preview) setState({ preview: null }); }

function onRunReset() {
    if (timer) { clearTimeout(timer); timer = 0; }
    setState({ banner: null, preview: null });
}

/** 부팅 시 1회. key 를 주므로 StrictMode 이중 마운트에서도 핸들러는 항상 1개다(T107b) */
export function installEncounterBridge() {
    const offs = [
        EventBus.on(EVENTS.ENCOUNTER_SPAWNED, onSpawned, { key: "encounter:spawned" }),
        EventBus.on(EVENTS.ENCOUNTER_RESOLVED, onResolved, { key: "encounter:resolved" }),
        EventBus.on(EVENTS.ENCOUNTER_EXPIRED, onExpired, { key: "encounter:expired" }),
        EventBus.on(EVENTS.CHEST_OPENED, onChest, { key: "encounter:chest" }),
        EventBus.on(EVENTS.SEER_PREVIEW, onSeer, { key: "encounter:seer" }),
        EventBus.on(EVENTS.RUN_LEVELUP, onLevelUp, { key: "encounter:levelup" }),
        EventBus.on(EVENTS.RUN_STARTED, onRunReset, { key: "encounter:run-started" }),
        EventBus.on(EVENTS.RUN_ENDED, onRunReset, { key: "encounter:run-ended" }),
    ];
    return () => offs.forEach((off) => off());
}

// import 시점에 바로 건다. 컴포넌트 마운트를 기다리면 그 사이의 조우를 놓친다.
installEncounterBridge();

export const useEncounterBanner = () =>
    useSyncExternalStore(subscribe, () => state.banner, () => state.banner);
export const useSeerPreview = () =>
    useSyncExternalStore(subscribe, () => state.preview, () => state.preview);

/** 디버그/테스트용 */
export const __encounterStoreDebug = { getSnapshot: () => state, onSpawned, onChest, EMPTY };
