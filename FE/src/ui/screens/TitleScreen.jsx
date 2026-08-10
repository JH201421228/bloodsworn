/**
 * TitleScreen — 타이틀. (Day 6 / T602)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.2
 * ★ 로고는 왼쪽(정보), 액션 버튼은 오른쪽(조작)으로 좌우 역할을 분리한다.
 *   가로 파지에서 오른손 엄지가 닿는 영역이 우측이라, 주 버튼을 왼쪽에 두면 화면을 가로질러야 한다.
 */
import { useStore } from "@/state/store";
import { SCREENS, MODALS } from "@/state/uiSlice";
import { requestStartRun } from "@/state/bridge";
import { APP_VERSION, fmtTime } from "@/ui/screens/screenUtils";

export default function TitleScreen() {
    const gold = useStore((s) => s.gold);
    const stats = useStore((s) => s.stats);
    const setScreen = useStore((s) => s.setScreen);
    const setModal = useStore((s) => s.setModal);

    const best = stats?.bestTimeSec ?? 0;
    const cleared = (stats?.clears ?? 0) > 0;

    return (
        <div className="screen title">
            <div className="title__brand">
                <h1 className="title__logo">✦ BLOODSWORN ✦</h1>
                <p className="title__sub">피 의 서 약</p>
                <div className="title__rule" />
                <p className="title__tagline">새벽까지 버텨라. 대가는 나중에 치른다.</p>
            </div>

            <div className="title__menu">
                <button className="btn btn--primary btn--wide" onClick={requestStartRun}>
                    ▶ 런 시작
                </button>
                <button className="btn btn--wide" onClick={() => setScreen(SCREENS.SANCTUM)}>
                    ⛨ 성 소
                </button>
                <div className="title__row">
                    <button className="btn btn--sm" onClick={() => setModal(MODALS.OPTIONS)}>
                        ⚙ 옵션
                    </button>
                    <button className="btn btn--sm" onClick={() => setModal(MODALS.CREDITS)}>
                        ⓘ 크레딧
                    </button>
                </div>
            </div>

            <div className="title__foot">
                {/* 버전은 버그 리포트를 받으려면 반드시 화면에 있어야 한다(10-UIUX 2.2) */}
                <span>
                    최고 기록 {best > 0 ? fmtTime(best) : "—"}
                    {cleared ? " 클리어" : ""}
                </span>
                <span className="title__gold">보유 골드 ⬤ {gold.toLocaleString("ko-KR")}</span>
                <span>v{APP_VERSION}</span>
            </div>
        </div>
    );
}
