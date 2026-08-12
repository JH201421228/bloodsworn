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
import { useState } from "react";
import { useStore } from "@/state/store";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import "./revive.css";

export default function ReviveOverlay() {
    const rv = useStore((s) => s.revive);
    /**
     * 「어느 제안에 대해 답했는가」. ResultScreen 의 claimedFor 와 같은 수법이다 —
     * 제안 객체가 바뀌는 순간 자동으로 미응답이 되므로 리셋 effect 가 필요 없다.
     * ★ 이게 필요해진 이유: 수락은 이제 **광고를 튼 뒤에** 끝난다(CombatSystem.resolveRevive).
     *   그 사이 화면을 그대로 두면 카운트다운 바가 계속 줄어들어 "씹혔다"로 읽히고,
     *   두 버튼이 살아 있어 광고 도중 「여기서 끝낸다」를 눌러 버릴 수 있다.
     */
    const [answeredFor, setAnsweredFor] = useState(null);
    const waiting = answeredFor === rv;
    if (!rv?.open) return null;

    const answer = (accepted) => {
        if (waiting) return;
        if (accepted) setAnsweredFor(rv); // 거절은 즉시 끝나므로 잠글 이유가 없다
        EventBus.emit(EVENTS.CMD_REVIVE, { accepted });
    };
    const cost = rv.humanityCost ?? 0;
    const afford = (rv.humanity ?? 0) >= cost;
    const hp = Math.round((rv.hpPct ?? 0.5) * 100);

    return (
        // ★ 좌표를 직접 주지 않고 .ui-stage 를 flex 컨테이너로 써서 가로·세로 모두 중앙에 놓는다.
        //   예전에는 left:50% + translateX 로 가로만 맞추고 세로는 top:84/360 고정이었다.
        //   그 84 는 "카드 높이가 정확히 192 일 때"만 중앙이라, 글자가 한 줄만 늘어도(번역·폰트 대체)
        //   카드가 아래로 자라며 중앙이 깨졌다. 크기가 변해도 중앙은 flex 가 알아서 지킨다.
        <div className="ui-stage revive-stage">
            <div className="revive-veil" />
            <div className="revive-card">
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

                {/* 남은 시간. transition 이 아니라 keyframes 라 리렌더 없이 줄어든다.
                    ★ 답을 한 뒤에는 멈춘다 — Phaser 쪽 8초 타임아웃도 그 순간 해제되므로
                      계속 줄어드는 바는 이제 화면에만 있는 거짓말이 된다. */}
                <div className="revive-timer">
                    <div
                        className="revive-timer__fill"
                        style={{
                            animationDuration: (rv.timeoutMs ?? 8000) + "ms",
                            animationPlayState: waiting ? "paused" : "running",
                        }}
                    />
                </div>

                <div className="revive-actions">
                    <button
                        className="btn btn--primary revive-yes"
                        disabled={!afford || waiting}
                        onClick={() => answer(true)}
                    >
                        {waiting ? "광고를 여는 중" : "▶ 광고 보고 부활"}
                    </button>
                    <button
                        className="btn btn--sm revive-no"
                        disabled={waiting}
                        onClick={() => answer(false)}
                    >
                        여기서 끝낸다
                    </button>
                </div>
            </div>
        </div>
    );
}
