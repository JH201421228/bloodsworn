/**
 * SanctumScreen — 성소. 영구 업그레이드 6종 + 골드 소비. (Day 6 / T601)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.3 · 수치는 정본 03-GDD-CORE 9.1 → `@/data/sanctum.json`
 * ★ 6종을 3×2 그리드로 한 화면에 다 넣어 스크롤을 없앤다. 가로 화면에서 세로 스크롤은
 *   엄지 이동 거리가 길어 손실이 크고, 오조작도 늘어난다.
 * ★ 수치를 JSX에 적지 않는다. 전부 sanctum.json 에서 읽는다 — 밸런스 조정이 데이터 한 줄로 끝나야 한다.
 */
import { useState } from "react";
import { useStore, persistSave } from "@/state/store";
import { SANCTUM_UPGRADES, nextCost } from "@/state/metaSlice";
import { SCREENS } from "@/state/uiSlice";
import { requestStartRun } from "@/state/bridge";

function Tile({ def, level, gold, onBuy }) {
    const [denied, setDenied] = useState(false);
    const cost = nextCost(def, level);
    const maxed = cost === null;
    const affordable = !maxed && gold >= cost;

    const click = () => {
        if (maxed) return;
        if (!affordable) {
            // 비활성 버튼은 "왜 안 되는지"를 알려주지 못한다. 눌리되 흔들려서 거절을 표현한다.
            setDenied(true);
            setTimeout(() => setDenied(false), 240);
            return;
        }
        onBuy(def.id, cost);
    };

    return (
        <div className={"sanctum__tile" + (maxed ? " is-max" : "")}>
            <div className="sanctum__head">
                <span aria-hidden="true">{def.icon}</span>
                <span>{def.name}</span>
            </div>
            <div className="sanctum__desc">{def.desc}</div>
            <div className="sanctum__gauge">
                {Array.from({ length: def.maxLevel }, (_, i) => (
                    <span key={i} className={i < level ? "" : "is-off"}>
                        {i < level ? "■" : "□"}
                    </span>
                ))}
                <small>
                    {level}/{def.maxLevel}
                </small>
            </div>
            <button
                className={"sanctum__buy" + (denied ? " is-denied" : "")}
                onClick={click}
                aria-label={maxed ? def.name + " 최대 단계" : def.name + " 강화 " + cost + " 골드"}
            >
                {maxed ? "MAX" : "⬤ " + cost.toLocaleString("ko-KR")}
            </button>
        </div>
    );
}

export default function SanctumScreen() {
    const gold = useStore((s) => s.gold);
    const upgrades = useStore((s) => s.upgrades);
    const buyUpgrade = useStore((s) => s.buyUpgrade);
    const setScreen = useStore((s) => s.setScreen);

    const buy = (id, cost) => {
        buyUpgrade(id, cost);
        // 저장 시점 3곳 중 하나(08-DATA-SCHEMA 4.1). 여기서 안 쓰면 앱이 죽었을 때 골드만 사라진다.
        persistSave();
    };

    return (
        <div className="screen">
            <div className="topbar">
                <button className="btn btn--ghost btn--sm" onClick={() => setScreen(SCREENS.TITLE)}>
                    ◀ 뒤로
                </button>
                <h2 className="topbar__title">⛨ 성 소</h2>
                <span className="topbar__gold">⬤ {gold.toLocaleString("ko-KR")}</span>
            </div>

            <div className="sanctum__grid">
                {SANCTUM_UPGRADES.map((def) => (
                    <Tile
                        key={def.id}
                        def={def}
                        level={upgrades[def.id] ?? 0}
                        gold={gold}
                        onBuy={buy}
                    />
                ))}
            </div>

            <div className="sanctum__foot">
                <button className="btn btn--primary" onClick={requestStartRun}>
                    ▶ 출 정
                </button>
            </div>
        </div>
    );
}
