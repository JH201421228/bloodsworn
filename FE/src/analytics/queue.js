/**
 * queue — 분석 이벤트의 오프라인 큐 + 배치 전송. (A-1)
 *
 * ★ 이 파일이 지키는 것:
 *   1) **게임을 절대 방해하지 않는다.** 모든 경로가 try/catch 로 닫혀 있고, 전송은 비동기다.
 *   2) **디스크 쓰기를 이벤트마다 하지 않는다.** track() 마다 JSON.stringify 하면
 *      런 중에 프레임 스파이크가 난다. 쓰기는 throttle 로 최대 5초에 한 번이다.
 *   3) **무한히 자라지 않는다.** 오프라인이 며칠 이어져도 상한(maxQueue)에서 오래된 것부터 버린다.
 *      분석 데이터가 유저의 저장 공간을 먹는 건 그 자체로 사고다.
 *   4) **엔드포인트가 없으면 아무것도 저장하지 않는다.** 이 앱의 기본 상태는 "네트워크 전송 0건"이고,
 *      전송 대상이 정해지기 전까지 그 상태를 그대로 유지한다.
 */
import { loadJson, saveJson, removeJson } from "@/monetization/kv";

const Q_KEY = "bloodsworn.evq.v1";
const PERSIST_THROTTLE_MS = 5000;

let queue = [];
let endpoint = "";
let maxQueue = 500;
let batchSize = 20;
let dropped = 0;
let sending = false;
let dirty = false;
let lastPersist = 0;
let persistTimer = null;

export function configureQueue(opts) {
    endpoint = opts.endpoint ?? "";
    maxQueue = opts.maxQueue ?? maxQueue;
    batchSize = opts.batchSize ?? batchSize;
}

export function queueStats() {
    return { size: queue.length, dropped, endpoint: endpoint ? "set" : "none", sending };
}

/** 저장된 큐를 복원한다. 엔드포인트가 없으면 남은 찌꺼기를 지우고 끝낸다. */
export async function restoreQueue() {
    if (!endpoint) {
        await removeJson(Q_KEY).catch(() => {});
        return 0;
    }
    try {
        const raw = await loadJson(Q_KEY, null);
        if (Array.isArray(raw)) queue = raw.slice(-maxQueue).filter((e) => e && typeof e.n === "string");
    } catch {
        queue = [];
    }
    return queue.length;
}

function schedulePersist() {
    if (!endpoint) return;
    dirty = true;
    const now = Date.now();
    if (persistTimer) return;
    const wait = Math.max(0, PERSIST_THROTTLE_MS - (now - lastPersist));
    persistTimer = setTimeout(() => {
        persistTimer = null;
        persistNow();
    }, wait);
}

export function persistNow() {
    if (!endpoint || !dirty) return;
    dirty = false;
    lastPersist = Date.now();
    saveJson(Q_KEY, queue).catch(() => {});
}

/** 큐에 넣는다. 동기이고 O(1) 이다 — 여기서 무거운 일을 하면 안 된다. */
export function enqueue(evt) {
    if (!endpoint) return false; // 전송 대상이 없으면 애초에 모으지 않는다
    queue.push(evt);
    if (queue.length > maxQueue) {
        // ★ 오래된 것부터 버린다. 최신 이벤트(이탈 직전)가 분석 가치가 더 높다.
        dropped += queue.length - maxQueue;
        queue = queue.slice(-maxQueue);
    }
    schedulePersist();
    return true;
}

/**
 * 배치 전송. 실패하면 큐를 되돌려 다음 기회에 다시 보낸다.
 * ★ keepalive 를 쓰는 이유: 앱이 백그라운드로 갈 때 보낸 요청이 중간에 잘리지 않게 하기 위해서다.
 * @returns {Promise<boolean>} 실제로 보냈으면 true
 */
export async function flushQueue({ force = false } = {}) {
    if (!endpoint || sending) return false;
    if (!queue.length) return false;
    if (!force && queue.length < batchSize) return false;

    sending = true;
    const batch = queue.slice(0, Math.max(batchSize, 1) * 5); // 한 번에 너무 크게 보내지 않는다
    const rest = queue.slice(batch.length);
    queue = rest;

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: batch, dropped }),
            keepalive: true,
            credentials: "omit",
            // ★ 리퍼러·쿠키를 보내지 않는다. 익명 UUID 외의 식별 수단을 만들지 않기 위해서다.
            referrerPolicy: "no-referrer",
        });
        if (!res.ok) throw new Error("http " + res.status);
        dropped = 0;
        schedulePersist();
        return true;
    } catch {
        // 오프라인이 정상 상태다. 앞에 되돌려 순서를 유지한다.
        queue = batch.concat(queue).slice(-maxQueue);
        schedulePersist();
        return false;
    } finally {
        sending = false;
    }
}

/** 데이터 삭제 요청 대응. 큐와 저장본을 모두 비운다. */
export async function clearQueue() {
    queue = [];
    dropped = 0;
    dirty = false;
    await removeJson(Q_KEY).catch(() => {});
}
