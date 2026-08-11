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
import RunLootSummary from "@/ui/inventory/RunLootSummary";
import { resolveAdPlacement, showRewarded } from "@/monetization";
import { persistSave } from "@/state/store";

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

    // 광고 골드 2배.
    // ★ effect 로 초기화하지 않는다 — "어느 결과에 대해 수령했는가"를 상태로 들면
    //   결과가 바뀌는 순간 자동으로 미수령이 된다. 리셋 effect 자체가 필요 없어진다.
    const [claimedFor, setClaimedFor] = useState(null);
    const claimed = claimedFor === r;
    const dbl = resolveAdPlacement("gold_double");
    const claimDouble = async (e) => {
        e.stopPropagation();  // 루트가 포인터로 카운트다운을 건너뛴다 — 버블을 막는다
        if (claimed) return;
        setClaimedFor(r);
        const { rewarded } = await showRewarded("gold_double");
        if (!rewarded) { setClaimedFor(null); return; }
        const mult = dbl?.reward?.mult ?? 2;
        useStore.getState().addGold(Math.floor(gold * (mult - 1)));
        persistSave();
    };
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

            <div className="result__panels has-loot">
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
                    {/* 보상형 광고 — 유저가 스스로 누른 것만 띄운다(shop.json _adRule).
                        ★ bridge 가 이미 addGold(result.gold) 를 했으므로 여기서는 **차액만** 더한다.
                          전액을 또 더하면 3배가 된다.
                        ★ 광고가 준비 안 됐거나 실패하면 버튼이 없거나 아무 일도 안 일어난다 —
                          실패는 "보상 없음"이지 "진행 불가"가 아니다. */}
                    {!claimed && dbl?.ready && gold > 0 && (
                        <button className="btn btn--sm result__dbl" onClick={claimDouble}>
                            ▶ 광고 보고 골드 x{dbl.reward?.mult ?? 2}
                        </button>
                    )}
                </section>
                {/* 이번 판 전리품. result__panels 가 1fr 1fr 격자라 세 번째 칸을 그냥 넣으면
                        2행이 되어 360px 를 넘는다 — has-loot 토큰이 3열로 바꾼다 */}
                    <RunLootSummary />
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
