/**
 * RunLootSummary — "이번 판에 뭘 얻었나". 결과 화면용. (임무 3)
 *
 * ★ ResultScreen.jsx 는 다른 소유라 마운트하지 않는다. 컴포넌트만 제공하고
 *   붙이는 패치는 보고서에 있다. .result__panels 안에 <section> 하나로 들어가는 크기다.
 *
 * ★ 왜 획득 목록 전체를 나열하지 않는가
 *   한 런에서 밟는 드롭은 수십~수백 개다. 전부 적으면 스크롤이 생기고, 스크롤이 생기면
 *   "재시작 3초 규칙"(03-GDD-CORE 12)을 지키는 화면이 아니게 된다.
 *   남은 것(장비 3 · 유물 n)은 이름으로, 사라진 것(소모품 · 골드)은 개수로만 적는다.
 *
 * ★ 여기서는 색 + 기호 + 한글 등급명을 전부 쓴다. 게임이 멈춰 있어 읽을 시간이 있다.
 */
import ItemIcon from "./ItemIcon";
import { useEquipped, useItemTotals, useRelics } from "./itemStore";
import { SLOT_META, SLOT_ORDER, rarityClass, rarityMark, rarityName } from "./itemText";
import "./inventory.css";

function SlotRow({ slotId, item }) {
    const meta = SLOT_META[slotId] ?? { mark: "·", name: slotId };
    if (!item) {
        return (
            <div className="inv-rarity loot__row is-empty">
                <span className="loot__slot">{meta.mark} {meta.name}</span>
                <span className="loot__name">— 끝까지 비어 있었다</span>
            </div>
        );
    }
    return (
        <div className={"inv-rarity loot__row " + rarityClass(item.rarity)}>
            <span className="loot__slot">{meta.mark} {meta.name}</span>
            <ItemIcon frame={item.icon} size={14} halo={item.rarity} />
            <span className="loot__name">{item.label}</span>
            <span className="loot__grade">{rarityMark(item.rarity)} {rarityName(item.rarity)}</span>
        </div>
    );
}

export default function RunLootSummary() {
    const equipped = useEquipped();
    const relics = useRelics();
    const totals = useItemTotals();

    return (
        <section className="loot">
            <div className="loot__head">전 리 품</div>

            {SLOT_ORDER.map((id) => (
                <SlotRow key={id} slotId={id} item={equipped[id]} />
            ))}

            <div className="loot__head">유물 {relics.length} / 6</div>
            <div className="loot__relics">
                {relics.length === 0 && <span className="loot__none">유물은 하나도 나오지 않았다</span>}
                {relics.map((r) => (
                    <span
                        key={r.id}
                        className={"inv-rarity loot__relic " + rarityClass(r.rarity)}
                        title={r.desc}
                    >
                        <ItemIcon frame={r.icon} size={14} halo={r.rarity} />
                        {r.label}
                    </span>
                ))}
            </div>

            {/* 소모품·골드는 사라진 물건이다. 이름이 아니라 "몇 번 밟았나"가 정보다 */}
            <div className="loot__tally">
                <span>소모품 <b>{totals.use}</b></span>
                <span>핏값 <b>{totals.gold}</b></span>
                <span>장비 교체 <b>{totals.equip}</b></span>
                {/* 환급은 개수가 아니라 골드 합계다. 자동 폐기가 얼마를 벌어 줬는지가 정보다 */}
                {totals.salvage > 0 && <span>환급 <b>{totals.salvage}</b></span>}
            </div>
        </section>
    );
}
