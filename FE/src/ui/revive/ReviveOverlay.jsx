/**
 * ReviveOverlay — 사망 직후 "한 번 더 서약한다" 제안. (M-1)
 *
 * ★ 이 화면의 정체는 **8초짜리 결정**이다. Phaser 가 씬을 멈추고 CMD_REVIVE 를 기다리며,
 *   8초가 지나면 스스로 거절 처리해 런을 끝낸다. UI 가 죽어도 게임은 반드시 진행된다 —
 *   여기서 하는 일은 "그 8초를 사람이 쓸 수 있게 만드는 것"이지 진행을 책임지는 것이 아니다.
 *
 * ★ 남은 시간을 반드시 보여준다. 카운트다운 없이 사라지면 "버튼을 눌렀는데 씹혔다"로 읽힌다.
 *   0.1초마다 setState 하지 않고 CSS 애니메이션으로 바를 줄인다 — 8초 동안 80번 리렌더할 이유가 없다.
 *
 * ★ 기본 동작은 **거절**이다. 아무것도 안 하면 런이 끝난다.
 *   그래서 [거절]이 아니라 [부활]에 시선이 가야 하고, 실수로 부활을 누르는 것보다
 *   실수로 거절하는 쪽이 덜 아프다(광고를 안 봤을 뿐 잃은 것이 없다).
 */
import { useStore } from "@/state/store";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import "./revive.css";

const pct = (v, total) => (v / total) * 100 + "%";

export default function ReviveOverlay() {
    const rv = useStore((s) => s.revive);
    if (!rv?.open) return null;

    const answer = (accepted) => EventBus.emit(EVENTS.CMD_REVIVE, { accepted });
    const cost = rv.humanityCost ?? 0;
    const afford = (rv.humanity ?? 0) >= cost;
    const hp = Math.round((rv.hpPct ?? 0.5) * 100);

    return (
        <div className="ui-stage revive-stage">
            <div className="revive-veil" />
            <div
                className="revive-card"
                style={{ left: pct(160, 640), top: pct(84, 360), width: pct(320, 640), height: pct(192, 360) }}
            >
                <p className="revive-kicker">쓰 러 졌 다</p>
                <h2 className="revive-title">한 번 더 서약한다</h2>
                <p className="revive-body">
                    그 자리에서 일어난다. 체력 {hp}% · 무적 2초.
                </p>
                {cost > 0 && (
                    <p className={"revive-cost" + (afford ? "" : " is-short")}>
                        인간성 −{cost} <span className="revive-have">(보유 {rv.humanity})</span>
                    </p>
                )}

                {/* 남은 시간. transition 이 아니라 keyframes 라 리렌더 없이 줄어든다 */}
                <div className="revive-timer">
                    <div
                        className="revive-timer__fill"
                        style={{ animationDuration: (rv.timeoutMs ?? 8000) + "ms" }}
                    />
                </div>

                <div className="revive-actions">
                    <button
                        className="btn btn--primary revive-yes"
                        disabled={!afford}
                        onClick={() => answer(true)}
                    >
                        ▶ 광고 보고 부활
                    </button>
                    <button className="btn btn--sm revive-no" onClick={() => answer(false)}>
                        여기서 끝낸다
                    </button>
                </div>
            </div>
        </div>
    );
}
