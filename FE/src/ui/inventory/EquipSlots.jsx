/**
 * EquipSlots — 장착 중인 fang / hide / charm 3칸과 보유 유물. 상시 표시. (임무 2)
 *
 * ★ 조작을 늘리지 않는다 (23 문서 3 "0탭" · 10-UIUX 5)
 *   탭해서 여는 인벤토리를 만들지 않았다. 아이템은 자동 장착이라 열어도 누를 것이 없고,
 *   조이스틱/대시 말고 세 번째 조작이 생기는 순간 이 게임의 조작 예산이 깨진다.
 *   대신 22x22 짜리 칸 3개를 화면 구석에 항상 켜 둔다. pointer-events: none 이라
 *   손가락이 지나가도 게임 입력을 먹지 않는다.
 *
 * ★ 자리 (10-UIUX 2.4 표에서 이미 쓰인 칸을 전부 뺀 결과 — inventory.css 상단 주석에 근거 전문)
 *   x 564~636, y 56~78 (장비) / y 82~96 (유물).
 *   - y 56 위: 상단 밴드(HP·Lv·타이머·킬수·심장·EXP바 y<44)와 일시정지 버튼(y 24~52)
 *   - x 564 왼쪽: 중앙 시야 금지 구역 (200,96)~(440,264)
 *   - y 268 아래: 대시 버튼 히트박스
 *   좌측 절반(x<320)은 플로팅 조이스틱 활성 존이라 애초에 후보가 아니다.
 *
 * ★ 빈 칸도 그린다
 *   채워질 때만 나타나면 칸 수가 변해 아이콘 위치가 흔들리고, "부적이 아직 없다"는
 *   정보 자체가 사라진다. 빈 칸에는 슬롯 기호(⚔ ⛨ ☾)를 흐리게 남긴다.
 */
import ItemIcon from "./ItemIcon";
import { useEquipped, useRelics } from "./itemStore";
import { SLOT_META, SLOT_ORDER, rarityClass } from "./itemText";
import "./inventory.css";

/** 우측 레일에 그리는 유물 아이콘 최대 개수. 14px x 6 + gap = 94px → x 542 에서 시작한다 */
const RAIL_RELICS = 6;

function Slot({ slotId, item }) {
    const meta = SLOT_META[slotId] ?? { mark: "·", name: slotId };
    if (!item) {
        return (
            <div className="inv-rarity inv-slot" title={meta.name + " — 비어 있다"}>
                <span className="inv-slot__mark">{meta.mark}</span>
            </div>
        );
    }
    return (
        <div
            className={"inv-rarity inv-slot is-filled is-fresh " + rarityClass(item.rarity)}
            title={meta.name + " · " + item.label}
        >
            <ItemIcon frame={item.icon} size={16} halo={item.rarity} />
        </div>
    );
}

export default function EquipSlots() {
    const equipped = useEquipped();
    const relics = useRelics();

    return (
        <div className="inv-rail">
            <div className="inv-slots">
                {SLOT_ORDER.map((id) => (
                    // ★ key 에 아이템 id 를 섞는다. 갈아입으면 key 가 바뀌어 노드가 새로 붙고
                    //   is-fresh 애니메이션(테두리 1회 번쩍)이 다시 돈다. 상태 변수 없이 끝난다.
                    <Slot key={id + ":" + (equipped[id]?.id ?? "-")} slotId={id} item={equipped[id]} />
                ))}
            </div>

            {/* 유물은 0개일 때 줄 자체를 숨긴다. 대부분의 런 초반은 0개고, 빈 줄은 정보가 아니다 */}
            {relics.length > 0 && (
                <div className="inv-relics">
                    <span className="inv-relics__count">✦{relics.length}</span>
                    {/* ★ 6칸까지만 그린다. ItemSystem.applyRelic 은 maxRelics(6)를 강제하지 않아서
                        이론상 더 들어올 수 있고, 그러면 줄이 왼쪽으로 자라 중앙 시야 금지 구역을 침범한다.
                        넘치는 만큼은 위의 ✦n 숫자가 이미 말해 준다. */}
                    {relics.slice(0, RAIL_RELICS).map((r) => (
                        <span
                            key={r.id}
                            className={"inv-rarity inv-relic " + rarityClass(r.rarity)}
                            title={r.label + (r.desc ? " — " + r.desc : "")}
                        >
                            <ItemIcon frame={r.icon} size={14} halo={r.rarity} />
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
