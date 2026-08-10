/**
 * UiLayer — 캔버스 위 오버레이 루트. 세이프에어리어 패딩을 여기서 한 번만 적용한다.
 *
 * ⚠ 블록 A 시점에는 로딩 진행률만 표시한다.
 *   TitleScreen / SanctumScreen / ResultScreen / PactOverlay 는 Day 3~6에서 채운다.
 *
 * 세이프 인셋 계약: 10-UIUX-LANDSCAPE.md 3.3.3
 */
import { useStore } from "@/state/store";
import { SCREENS } from "@/state/uiSlice";
import PactOverlay from "@/ui/pact/PactOverlay";

export default function UiLayer() {
    const screen = useStore((s) => s.screen);
    const loadProgress = useStore((s) => s.loadProgress);
    const lastResult = useStore((s) => s.lastResult);

    return (
        <div className="ui-layer">
            <PactOverlay />
            {screen === SCREENS.LOADING && (
                <div className="ui-loading">
                    <p className="ui-loading__label">봉인을 여는 중</p>
                    <div className="ui-loading__bar">
                        <div
                            className="ui-loading__fill"
                            style={{ width: `${Math.round(loadProgress * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {screen === SCREENS.RESULT && (
                <div className="ui-result">
                    <p className="ui-result__title">여명을 보지 못했다</p>
                    <p className="ui-result__stat">
                        생존 {Math.floor((lastResult?.time ?? 0) / 60)}분 {(lastResult?.time ?? 0) % 60}초
                        {" · "}처치 {lastResult?.kills ?? 0}
                    </p>
                    <button className="ui-result__btn" onClick={() => location.reload()}>
                        다시 하기
                    </button>
                </div>
            )}
        </div>
    );
}
