/**
 * SanctumScreen — 성소. 영구 업그레이드 6종 + 골드 소비. (Day 6 / T601)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.3 · 수치는 정본 03-GDD-CORE 9.1 → `@/data/sanctum.json`
 * ★ 6종을 3×2 그리드로 한 화면에 다 넣어 스크롤을 없앤다. 가로 화면에서 세로 스크롤은
 *   엄지 이동 거리가 길어 손실이 크고, 오조작도 늘어난다.
 * ★ 수치를 JSX에 적지 않는다. 전부 sanctum.json 에서 읽는다 — 밸런스 조정이 데이터 한 줄로 끝나야 한다.
 *
 * ★ 아이콘도 JSX에 적지 않는다 (2026-08 개선)
 *   6종이 컬러 이모지(🛡 ⚔ 👟 📜)를 쓰고 있었다. 컬러 이모지는 **기기 서체가 그린다** —
 *   삼성·구글·애플이 각자 다른 그림을 내놓아 같은 게임이 폰마다 다르게 보였고, 알록달록한
 *   그림 6개가 피·재·검정 팔레트(09-ART) 한복판에 박혀 있었다.
 *   이미 있는 items 아틀라스(public/assets/items/items.png, 71프레임)에서 프레임을 골라
 *   ItemIcon 의 CSS 스프라이트로 그린다 — 새 에셋도, Phaser 매니페스트 변경도 필요 없다.
 *   프레임이 없으면 sanctum.json 의 `icon` 글리프로 떨어진다. 전용 아이콘(docs/32 칸 32~37)이
 *   오면 그때 갈아탄다.
 */
import { useState } from "react";
import { useStore, persistSave } from "@/state/store";
import { SANCTUM_UPGRADES, nextCost } from "@/state/metaSlice";
import { SCREENS } from "@/state/uiSlice";
import { requestStartRun } from "@/state/bridge";
import { resolveAdPlacement, showRewarded } from "@/monetization";
import ItemIcon from "@/ui/inventory/ItemIcon";
import GoldIcon from "@/ui/inventory/GoldIcon";
import { hasFrame } from "@/ui/inventory/itemAtlas";

/**
 * 타일 아이콘. 아틀라스 프레임이 있으면 픽셀 아트, 없으면 데이터의 글리프.
 * ★ 크기 20논리px — 제목 글자가 12px 이라 24px 를 넣으면 머리 줄이 11px 자라고,
 *   타일 세로 예산(screens.css .sanctum__grid 주석: 여유 6px)을 넘겨 구매 버튼이 잘린다.
 *   20px 이면 +7px 라 예산 안에서 버틴다. 실제 화면에서 재고 정한 값이다.
 */
function TileIcon({ def }) {
    if (hasFrame(def.iconFrame)) return <ItemIcon frame={def.iconFrame} size={20} />;
    return <span aria-hidden="true">{def.icon}</span>;
}

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
                <TileIcon def={def} />
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
                {maxed ? "MAX" : <><GoldIcon /> {cost.toLocaleString("ko-KR")}</>}
            </button>
        </div>
    );
}

export default function SanctumScreen() {
    const gold = useStore((s) => s.gold);
    const offer = resolveAdPlacement("sanctum_offering");
    const takeOffering = async () => {
        const { rewarded } = await showRewarded("sanctum_offering");
        if (!rewarded) return;   // 실패는 조용히 넘어간다. 보상이 없을 뿐 진행은 막지 않는다.
        useStore.getState().addGold(offer?.reward?.amount ?? 120);
        persistSave();
    };
    const upgrades = useStore((s) => s.upgrades);
    const buyUpgrade = useStore((s) => s.buyUpgrade);
    const setScreen = useStore((s) => s.setScreen);

    const buy = (id, cost) => {
        buyUpgrade(id, cost);
        // 저장 시점 3곳 중 하나(08-DATA-SCHEMA 4.1). 여기서 안 쓰면 앱이 죽었을 때 골드만 사라진다.
        persistSave();
    };

    return (
        <div className="screen sanctum">
            <div className="topbar">
                <button className="btn btn--ghost btn--sm" onClick={() => setScreen(SCREENS.TITLE)}>
                    ◀ 뒤로
                </button>
                <h2 className="topbar__title">⛨ 성 소</h2>
                <span className="topbar__gold">
                    <GoldIcon /> {gold.toLocaleString("ko-KR")}
                </span>
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
                {/* 헌납 — 하루 상한이 있고(shop.json caps.perDay) 유저가 눌러야만 뜬다.
                    ★ 성소는 "시간을 사는" 자리다. 전투력을 직접 파는 것이 아니라
                      영구 성장을 앞당길 뿐이라 P2W 경계선(20-MONETIZATION 2)을 넘지 않는다. */}
                {offer?.ready && (
                    <button className="btn" onClick={takeOffering}>
                        <GoldIcon /> 헌납한다 (+{offer.reward?.amount ?? 120})
                    </button>
                )}
                <button className="btn btn--primary" onClick={requestStartRun}>
                    ▶ 출 정
                </button>
            </div>
        </div>
    );
}
