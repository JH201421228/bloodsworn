/**
 * App — 게임 셸. Phaser 캔버스 1개 + 그 위의 UI 오버레이.
 *
 * T102: Vite 기본 템플릿을 전량 제거하고 게임 셸로 교체했다.
 * T103: react-router를 쓰지 않는다. 화면 전환은 Zustand의 uiSlice.screen이 결정한다.
 *       (기존 router는 App을 레이아웃으로 쓰면서 <Outlet/>이 없어 자식 라우트가 렌더된 적이 없었다)
 */
import { useEffect } from "react";
import GameCanvas from "@/ui/GameCanvas";
import UiLayer from "@/ui/UiLayer";
import { installBridge } from "@/state/bridge";

export default function App() {
    useEffect(() => {
        // EventBus P→R 구독을 스토어에 연결한다. key 기반이라 StrictMode 이중 실행에도 1개만 남는다.
        return installBridge();
    }, []);

    return (
        <div className="app-root">
            <GameCanvas />
            <UiLayer />
        </div>
    );
}
