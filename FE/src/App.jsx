/**
 * App — 게임 셸. Phaser 캔버스 1개 + 그 위의 UI 오버레이.
 *
 * T102: Vite 기본 템플릿을 전량 제거하고 게임 셸로 교체했다.
 * T103: react-router를 쓰지 않는다. 화면 전환은 Zustand의 uiSlice.screen이 결정한다.
 *       (기존 router는 App을 레이아웃으로 쓰면서 <Outlet/>이 없어 자식 라우트가 렌더된 적이 없었다)
 * T550/T632/T633: 세이브 하이드레이트와 네이티브 연동(뒤로가기·백그라운드 일시정지)을 여기서 건다.
 */
import { useEffect } from "react";
import GameCanvas from "@/ui/GameCanvas";
import { gameManager } from "@/game/GameManager";
import UiLayer from "@/ui/UiLayer";
import { installBridge } from "@/state/bridge";
import { installPlatform } from "@/state/platform";
import { useStore, hydrateStore, persistSave } from "@/state/store";
import { initMonetization } from "@/monetization";
import { initAnalytics } from "@/analytics";
import { installLoopGuard } from "@/ui/error/loopGuard";

/**
 * 보류 지급을 스토어에 반영한다.
 * ★ 반드시 true 를 반환해야 ack 된다. false/예외면 다음 부팅에 다시 흘러나온다 —
 *   구매 도중 앱이 죽어도 결제한 것을 잃지 않게 하는 장치다.
 */
async function onGrant(g) {
    const s = useStore.getState();
    if (g.type === "gold") { s.addGold(g.amount ?? 0); persistSave(); return true; }
    return g.type === "entitlement" || g.type === "cosmetic"; // 원장이 이미 정본이다
}

export default function App() {
    useEffect(() => {
        // EventBus P→R 구독을 스토어에 연결한다. key 기반이라 StrictMode 이중 실행에도 1개만 남는다.
        return installBridge();
    }, []);

    useEffect(() => {
        // 안드로이드 뒤로가기 / 앱 백그라운드 전환. 웹에서는 조용히 아무것도 하지 않는다.
        return installPlatform();
    }, []);

    useEffect(() => {
        // F-1 게임 루프 예외 그물. ★ 여기가 맞는 자리인 이유:
        //   자식 effect 가 부모보다 먼저 돈다 — 즉 이 시점에 GameCanvas 의 gameManager.boot()
        //   가 이미 끝나 있어 game 인스턴스가 존재한다. 그리고 부팅 직후이므로
        //   BootScene/PreloadScene 이 던지는 예외까지 그물 안에 들어온다.
        //   ★ 여기서 Phaser 를 새로 import 하지 않는다. GameCanvas 가 이미 끌고 온 것을 쓸 뿐이다.
        installLoopGuard(gameManager.game);
    }, []);

    useEffect(() => {
        // ★ 세이브 로드는 비동기(Preferences)라 부팅을 막지 않는다. 로딩 화면이 떠 있는 동안 끝난다.
        //   실패해도 throw 하지 않는다 — 세이브 하나 때문에 게임이 안 켜지면 그게 최악의 사고다(T551).
        //
        // ★ 순서가 중요하다: 하이드레이트 -> 분석 -> 수익화.
        //   수익화의 보류 지급(drainGrants)이 하이드레이트보다 먼저 끝나면
        //   metaSlice.hydrate() 의 하드 set() 이 방금 지급한 골드를 덮어쓴다.
        let cancelled = false;
        hydrateStore().then(async () => {
            if (cancelled) return;
            // 둘 다 실패해도 게임은 그대로 돈다. 광고·분석이 진행을 막아서는 안 된다.
            try {
                await initAnalytics({
                    endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "",
                    sampleRate: 1,
                });
            } catch (e) { console.warn("[App] 분석 초기화 실패 — 무시하고 계속한다", e); }
            if (cancelled) return;
            try {
                await initMonetization({
                    onGrant,
                    rewardedUnitId: import.meta.env.VITE_ADMOB_REWARDED_ANDROID ?? "",
                    revenueCatApiKey: import.meta.env.VITE_RC_ANDROID_KEY ?? "",
                    remoteConfigUrl: import.meta.env.VITE_RC_URL ?? "",
                });
            } catch (e) { console.warn("[App] 수익화 초기화 실패 — 무료로 계속한다", e); }
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="app-root">
            <GameCanvas />
            <UiLayer />
        </div>
    );
}
