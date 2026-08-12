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
 *   지금은 전용 아이콘 6종을 쓴다(docs/32 §3.4 · runes 시트 칸 32~37).
 *
 * ★ 여기는 Phaser 가 아니다 — CSS 가 png 를 직접 읽는다
 *   성소는 React(DOM) 화면이라 캔버스 텍스처가 아니라 background-image 로 그린다
 *   (src/ui/icons/runeSheet.css). assets.json 에서 runes 를 빼도 이 화면은 그대로 그려진다.
 *   그러므로 **이쪽의 롤백 스위치는 매니페스트가 아니라 데이터**다 — sanctum.json 의
 *   iconCell 을 null 로 바꾸면 items 아틀라스로, 그것도 없으면 이모지로 내려간다.
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
import RuneIcon from "@/ui/icons/RuneIcon";
import { hasCell } from "@/ui/icons/runeSheet";

/**
 * 타일 아이콘. 아틀라스 프레임이 있으면 픽셀 아트, 없으면 데이터의 글리프.
 * ★ 크기 20논리px — 제목 글자가 12px 이라 24px 를 넣으면 머리 줄이 11px 자라고,
 *   타일 세로 예산(screens.css .sanctum__grid 주석: 여유 6px)을 넘겨 구매 버튼이 잘린다.
 *   20px 이면 +7px 라 예산 안에서 버틴다. 실제 화면에서 재고 정한 값이다.
 */
function TileIcon({ def }) {
    // ★ 3단 폴백. 전용 아이콘 -> 빌려 쓰던 items 프레임 -> 이모지. 아래 두 줄을 지우지 마라
    //   (32 §0.2). 이모지가 마지막에 남아 있어야 그림이 통째로 없어져도 화면이 안 빈다.
    if (hasCell(def.iconCell)) return <RuneIcon cell={def.iconCell} size={20} />;
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
            // ★ 골드가 모자라면 여기서 끝난다 — 확인 모달도 뜨지 않는다.
            //   "물어본 뒤에 못 산다고 하는" 흐름은 거절을 두 번 당하는 것과 같다.
            setDenied(true);
            setTimeout(() => setDenied(false), 240);
            return;
        }
        // 여기서 바로 사지 않는다 — 되돌릴 수 없는 골드 소비라 확인을 한 번 받는다.
        onBuy(def, level, cost);
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
    const openConfirm = useStore((s) => s.openConfirm);
    const closeConfirm = useStore((s) => s.closeConfirm);

    /**
     * 구매 확인 (사용자 요청).
     *
     * ★ 새 모달을 만들지 않는다. UiLayer 의 ConfirmDialog + uiSlice.openConfirm 을 그대로 쓴다 —
     *   런 포기가 이미 쓰는 물건이라, 확인창의 생김새와 버튼 순서가 게임 안에서 하나로 유지된다.
     * ★ danger 는 false 다. 골드 소비는 되돌릴 수 없지만 **잃는 조작이 아니라 얻는 조작**이다.
     *   붉은 버튼은 「런 포기」·「저장 데이터 삭제」처럼 진행이 사라지는 곳에만 쓴다.
     *   여기까지 붉게 칠하면 그 색이 경고로 안 읽히기 시작한다.
     * ★ 본문에 "몇 단계에서 몇 단계로", "무엇이 오르는지", "얼마를 내고 얼마가 남는지"를 넣는다.
     *   수치는 전부 sanctum.json 에서 온다 — 화면에 숫자를 적지 않는다는 이 파일의 규약 그대로다.
     *   desc 의 "/ 단계" 꼬리는 떼어 낸다. "3단계 → 4단계 · 최대 체력 +10 / 단계" 는
     *   한 줄에 「단계」가 세 번 나와서 읽히지 않는다.
     */
    const askBuy = (def, level, cost) => {
        const gain = def.desc.split(" / 단계")[0];
        openConfirm({
            title: "「" + def.name + "」 강화",
            body:
                level + "단계 → " + (level + 1) + "단계 · " + gain + "\n" +
                "비용 " + cost.toLocaleString("ko-KR") + " 골드 · 남는 골드 " +
                (gold - cost).toLocaleString("ko-KR"),
            confirmLabel: "강화한다",
            danger: false,
            onConfirm: () => {
                closeConfirm();
                // ★ 스토어의 buyUpgrade 가 상한·잔액을 다시 검사한다. 확인창을 띄워 둔 사이에
                //   골드가 줄어드는 경로(광고 실패 롤백 등)가 있어도 마이너스가 되지 않는다.
                buyUpgrade(def.id, cost);
                // 저장 시점 3곳 중 하나(08-DATA-SCHEMA 4.1). 여기서 안 쓰면 앱이 죽었을 때 골드만 사라진다.
                persistSave();
            },
        });
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
                        onBuy={askBuy}
                    />
                ))}
            </div>

            <div className="sanctum__foot">
                {/* 헌납 — 하루 상한이 있고(shop.json caps.perDay) 유저가 눌러야만 뜬다.
                    ★ 성소는 "시간을 사는" 자리다. 전투력을 직접 파는 것이 아니라
                      영구 성장을 앞당길 뿐이라 P2W 경계선(20-MONETIZATION 2)을 넘지 않는다.
                    ★ 여기에는 확인창을 붙이지 않는다(사용자 요청 검토 결과).
                      강화 확인창의 이유는 "골드를 잃는다"인데 헌납은 잃는 것이 없다 —
                      광고를 보면 골드가 늘고, 보기 싫으면 광고 화면에서 닫으면 그만이다.
                      잃을 것이 없는 조작에까지 확인을 붙이면 정작 강화 확인창을 안 읽게 된다. */}
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
