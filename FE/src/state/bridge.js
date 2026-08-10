/**
 * bridge — EventBus의 P→R 이벤트를 스토어에 연결하는 **단일 지점**.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 3.6
 *
 * ★ 왜 한 파일에 모으는가
 *   구독이 컴포넌트마다 흩어지면 "이 값이 어디서 바뀌는가"를 추적할 수 없고,
 *   StrictMode 이중 마운트에서 어디가 두 번 등록됐는지 찾을 수 없다.
 *
 * ★ T107b — 모든 구독에 key를 준다.
 *   EventBus.on()은 key가 같으면 기존 핸들러를 교체하므로, 몇 번 호출되어도 핸들러는 1개다.
 *   이게 없으면 StrictMode에서 PACT 축복이 2번 적용되어 밸런스가 조용히 오염된다.
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { useStore } from "./store";
import { SCREENS } from "./uiSlice";

let installed = false;

/**
 * 앱 부팅 시 1회 호출. 두 번 불러도 안전하다.
 * @returns {() => void} 해제 함수 (테스트/HMR용)
 */
export function installBridge() {
    const s = () => useStore.getState();
    const offs = [];
    const sub = (event, fn, key) => offs.push(EventBus.on(event, fn, { key }));

    sub(
        EVENTS.ASSET_PROGRESS,
        (p) => {
            const progress = p?.progress ?? 0;
            s().setLoadProgress(progress);
            // 로드가 끝나면 로딩 화면에서 빠져나온다.
            // 이게 없으면 GameScene이 떠 있는데도 로딩 오버레이가 화면을 덮은 채 남는다.
            if (progress >= 1 && s().screen === SCREENS.LOADING) s().setScreen(SCREENS.TITLE);
        },
        "bridge:progress"
    );

    sub(
        EVENTS.BOOT_READY,
        () => {
            // 로딩 화면이 이미 떠 있으므로 화면 전환은 하지 않는다.
        },
        "bridge:boot"
    );

    sub(EVENTS.RUN_STARTED, (p) => {
        // rerollLeft는 성소 업그레이드로 늘어날 수 있으므로 Phaser가 계산해 실어 보낸다.
        s().resetRun(p?.rerollLeft);
        s().setScreen(SCREENS.PLAYING);
    }, "bridge:run-started");

    sub(EVENTS.RUN_LEVELUP, (p) => s().openPact(p ?? {}), "bridge:levelup");

    sub(EVENTS.PACT_APPLIED, (p) => {
        s().applyPactResult(p);
        s().closePact();
    }, "bridge:pact-applied");

    sub(EVENTS.AWAKENING_TRIGGERED, (a) => {
        s().pushAwakening(a);
        s().showAwakening(a);
        if (a?.awakeningId) s().addCodex(a.awakeningId);
    }, "bridge:awakening");

    sub(EVENTS.BOSS_HP, (hp) => s().setBossHp(hp), "bridge:boss-hp");

    sub(EVENTS.RUN_ENDED, (result) => {
        // T232 텔레메트리 — 밸런스를 "느낌"이 아니라 숫자로 조정하기 위한 유일한 수단
        console.log("[텔레메트리] 런 종료", JSON.stringify(result));
        s().setResult(result);
        if (typeof result?.gold === "number") s().addGold(result.gold);
        s().setScreen(SCREENS.RESULT);
    }, "bridge:run-ended");

    sub(EVENTS.RUN_PAUSED, () => s().setModal("pause"), "bridge:paused");
    sub(EVENTS.RUN_RESUMED, () => s().setModal(null), "bridge:resumed");

    sub(EVENTS.FATAL_ERROR, (e) => {
        console.error("[bridge] 게임에서 치명적 오류가 보고됐다", e);
    }, "bridge:fatal");

    installed = true;
    return () => {
        offs.forEach((off) => off());
        installed = false;
    };
}

export function isBridgeInstalled() {
    return installed;
}
