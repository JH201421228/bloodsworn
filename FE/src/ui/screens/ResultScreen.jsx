/**
 * ResultScreen — 결과 화면. (Day 5 / T530 · T531 · T532)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.8(승리) / 2.9(패배) · 엔딩 분기 01-CONCEPT-AND-STORY.md 6
 * 페이로드: EVENTS.RUN_ENDED = { reason, time, kills, level, gold, awakenings, humanity }
 *
 * ★ T531 「재시작 3초 규칙」(정본 03-GDD-CORE 12)
 *   [다시 하기]는 **최좌측**에 둔다. 결과 화면이 뜬 직후 엄지가 이미 놓여 있는 자리다.
 *   골드 카운트업이 도는 동안에도 즉시 눌린다 — 애니메이션을 기다리게 만들면 규칙이 깨진다.
 *   재시작은 location.reload() 가 아니라 CMD_START_RUN 이다. 리로드는 에셋 재파싱만으로 3~5초다.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/state/store";
import { SCREENS } from "@/state/uiSlice";
import { requestStartRun } from "@/state/bridge";
import { fmtTime, awakenLabel, pickEnding } from "@/ui/screens/screenUtils";

/**
 * 골드 카운트업 700ms. 화면 아무 데나 탭하면 즉시 최종값으로 건너뛴다(2회 탭을 요구하지 않는다).
 * ★ setInterval 이 아니라 rAF 다. 저사양 기기에서 interval 은 눈에 띄게 끊긴다.
 * ★ 효과 안에서 setState 를 동기로 부르지 않는다(연쇄 렌더). 값 갱신은 전부 rAF 콜백 안에서만 한다.
 */
function useCountUp(target, ms = 700) {
    const [v, setV] = useState(0);
    const doneRef = useRef(false);

    useEffect(() => {
        doneRef.current = false;
        if (!target) return;
        const t0 = performance.now();
        let raf = 0;
        const tick = (now) => {
            if (doneRef.current) return;
            const p = Math.min(1, (now - t0) / ms);
            setV(Math.round(target * p));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);

    const skip = () => {
        doneRef.current = true;
        setV(target);
    };
    return [v, skip];
}

function Row({ k, v }) {
    return (
        <div className="stat-row">
            <span className="stat-row__k">{k}</span>
            <span className="stat-row__v">{v}</span>
        </div>
    );
}

export default function ResultScreen() {
    const r = useStore((s) => s.lastResult);
    const setScreen = useStore((s) => s.setScreen);

    const gold = r?.gold ?? 0;
    const [shownGold, skipCount] = useCountUp(gold);

    const awakenings = r?.awakenings ?? [];
    const humanity = r?.humanity ?? 0;
    const ending = pickEnding({ reason: r?.reason, humanity, awakenCount: awakenings.length });

    return (
        <div
            className={"screen result " + (ending.win ? "is-win" : "is-lose")}
            onPointerDown={skipCount}
        >
            <h2 className="result__head">{ending.head}</h2>
            <p className="result__ending">{ending.name}</p>
            <div className="result__rule" />
            <p className="result__line">{ending.line}</p>

            <div className="result__panels">
                <section>
                    <Row k="생존 시간" v={fmtTime(r?.time ?? 0) + (ending.win ? " (클리어)" : "")} />
                    <Row k="최종 레벨" v={"Lv." + (r?.level ?? 1)} />
                    <Row k="처치 수" v={(r?.kills ?? 0).toLocaleString("ko-KR")} />
                    <Row k="남은 인간성" v={humanity + " / 100"} />
                    <Row
                        k="종료 사유"
                        v={r?.reason === "abandon" ? "포기" : ending.win ? "보스 처치" : "사망"}
                    />
                </section>

                <section>
                    <div className="stat-row__k">각성</div>
                    <ul className="result__awakens">
                        {awakenings.length === 0 && <li className="stat-row__k">—</li>}
                        {awakenings.map((a, i) => (
                            <li key={i}>{awakenLabel(a)}</li>
                        ))}
                    </ul>
                    <div className="result__gold">
                        획득 골드 ⬤ {shownGold.toLocaleString("ko-KR")}
                    </div>
                </section>
            </div>

            {/* ★ 순서를 바꾸지 말 것. 최좌측 = 사망 직후 엄지가 이미 놓여 있는 자리다(T531) */}
            <div className="result__actions">
                <button className="btn btn--primary" onClick={requestStartRun}>
                    ↻ 다시 하기
                </button>
                <button className="btn" onClick={() => setScreen(SCREENS.SANCTUM)}>
                    ⛨ 성 소 로
                </button>
                <button className="btn btn--ghost" onClick={() => setScreen(SCREENS.TITLE)}>
                    ⌂ 타이틀
                </button>
            </div>
        </div>
    );
}
