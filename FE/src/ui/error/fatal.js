/**
 * fatal — 번들 쪽 치명 오류 관문. (F-1)
 *
 * ★ 이 파일은 「화면을 그리는 곳」이 아니다. 화면은 index.html 의 정적 DOM 이 그린다.
 *   여기는 그 정적 DOM(window.__BSW_FATAL__)과 앱 내부(EventBus / Zustand)를 잇는 배선이다.
 *
 * ── 왜 이렇게 나눴는가 (06-TECH-DESIGN.md 16장) ────────────────────────
 *   치명 오류 화면이 필요한 순간은 정의상 「React 트리가 죽은 순간」이다. 죽은 트리로
 *   죽음을 알릴 수는 없다. 게다가 흰 화면의 대표 원인은 **번들이 아예 안 뜨는 것**인데
 *   (청크 404 · 문법 에러 · import 실패) 그때는 이 파일조차 실행되지 않는다.
 *   그래서 「보여주기」는 의존성 0 인 index.html 이 전담하고, 이 파일은
 *   살아 있을 때만 할 수 있는 일 — 이벤트 배선과 소프트 복구 — 만 맡는다.
 *
 * ── 흐름 ───────────────────────────────────────────────────────────────
 *   window error / unhandledrejection  → index.html 핸들러 → __BSW_FATAL__.report()
 *   React 렌더 예외                    → ErrorBoundary     → reportFatal()
 *   Phaser 루프/씬 예외                → EventBus FATAL_ERROR → 이 파일의 구독 → report()
 *                                                     ↘ report() 가 sink 로 되쏜다
 *                                                       → bridge.js 의 FATAL_ERROR 구독(기존 계약)
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { useStore, hydrateStore } from "@/state/store";
import { SCREENS } from "@/state/uiSlice";

/** index.html 이 심어 둔 최종 방어선. 이론상 언제나 있지만 없다고 죽지는 않는다. */
function core() {
    return typeof window !== "undefined" ? window.__BSW_FATAL__ : null;
}

/**
 * 치명 오류 보고. 어디서 불러도 안전하다(관문이 없으면 콘솔로만 남긴다).
 * @param {"window"|"promise"|"react"|"game"} kind
 * @param {*} err
 * @param {string} [where] 사람이 읽을 위치 힌트. ★ 세이브 내용·개인정보를 넣지 마라.
 */
export function reportFatal(kind, err, where) {
    const c = core();
    if (c && typeof c.report === "function") return c.report(kind, err, where);
    console.error("[치명] " + kind, err, where ?? "");
    return null;
}

/**
 * ★ 되쏘기 루프 차단.
 *   report() 는 sink 로 EVENTS.FATAL_ERROR 를 emit 하고, 이 파일은 같은 이벤트를 구독한다.
 *   가드가 없으면 emit → 구독 → report → emit 이 무한히 돈다.
 *   report() 가 첫 보고에만 sink 를 부르므로 실제로는 1회로 끝나지만,
 *   「그 규칙에 기대야만 안 도는 코드」를 남기지 않는다.
 */
let echoing = false;

/** ErrorBoundary 가 자기 자신을 되살리는 함수를 여기 맡긴다. */
let resetBoundary = null;

export function setBoundaryReset(fn) {
    resetBoundary = fn;
}

/**
 * 진행도를 잃지 않는 복구. 「타이틀로 돌아가기」가 이걸 부른다.
 *
 * ★ 순서가 계약이다.
 *   1) 런 오버레이를 전부 내리고 런 상태를 비운다 — 깨진 런의 잔재가 타이틀 뒤에 남으면 안 된다
 *   2) 화면을 타이틀로 — Phaser 캔버스를 덮는 불투명 암막이 함께 깔린다(.ui-scrim)
 *   3) React 트리를 다시 세운다 — 스토어를 먼저 고쳐야 다시 그릴 때 타이틀이 나온다
 *   4) **디스크의 마지막 정상 세이브로 메모리를 되돌린 뒤에야** 저장 잠금을 푼다
 *      = 예외 직전의 메모리 상태는 한 바이트도 디스크로 나가지 못한다
 * @returns {boolean} false 면 index.html 이 재시작으로 떨어뜨린다
 */
function uiRecover() {
    const s = useStore.getState();
    s.closeRevive?.();
    s.closePact?.();
    s.hideAwakening?.();
    s.closeConfirm?.();
    s.resetRun?.();
    s.setScreen(SCREENS.TITLE);
    try {
        resetBoundary?.();
    } catch (e) {
        console.error("[치명] 트리 재구성 실패", e);
    }

    hydrateStore()
        .then(() => {
            // ★ 되돌리는 사이에 **또 죽었으면** 풀지 않는다.
            //   실측으로 잡은 경합이다: 원인이 그대로인 채 「타이틀로 돌아가기」를 누르면
            //   다시 그리는 순간 같은 예외가 나서 잠금이 다시 걸리는데, 그 뒤에 이 비동기
            //   완료가 도착해 잠금을 조용히 풀어 버렸다. 그러면 「깨진 상태를 저장하지
            //   않는다」가 무너진다.
            if (core()?.shown) {
                console.warn("[치명] 복구 도중 또 죽었다. 저장은 잠근 채로 둔다");
                return;
            }
            // 여기서부터 메모리의 meta/settings 는 디스크와 같다. 이제 써도 안전하다.
            window.__BSW_SAVE_LOCKED__ = false;
            console.info("[치명] 세이브를 다시 읽었다. 저장을 재개한다");
        })
        .catch((e) => {
            // 못 읽었으면 잠긴 채로 둔다. 안 쓰는 것이 잘못 쓰는 것보다 언제나 낫다.
            console.error("[치명] 세이브 재적재 실패 — 저장은 잠근 채로 둔다", e);
        });
    return true;
}

let installed = false;

/**
 * 부팅 시 1회. main.jsx 가 render() **전에** 부른다 — 렌더 도중 터지는 예외도 잡아야 한다.
 * 두 번 불러도 안전하다.
 */
export function installFatalGuard() {
    if (installed) return;
    installed = true;

    const c = core();
    if (c) {
        // 정적 DOM 이 받은 오류를 앱 안쪽(EventBus)으로 흘려보낸다.
        // ★ bridge.js 의 EVENTS.FATAL_ERROR 구독이 기다리던 바로 그 신호다.
        c.sink = (info) => {
            echoing = true;
            try {
                EventBus.emit(EVENTS.FATAL_ERROR, info);
            } finally {
                echoing = false;
            }
        };
        c.uiRecover = uiRecover;
    }

    // Phaser 쪽이 쏘는 FATAL_ERROR 를 받아 정적 DOM 으로 넘긴다.
    // ★ Phaser 는 React 를 모른다. 그래서 게임 쪽 보고 경로는 EventBus 하나뿐이다.
    EventBus.on(
        EVENTS.FATAL_ERROR,
        (p) => {
            if (echoing) return; // 우리가 방금 쏜 것이 되돌아온 것이다
            reportFatal(p?.kind ?? "game", p?.error ?? p?.message ?? p, p?.where);
        },
        { key: "fatal:report" }
    );
}
