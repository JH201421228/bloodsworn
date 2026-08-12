/**
 * ItemToasts — 획득 알림. (임무 1)
 *
 * ★ 이 컴포넌트가 푸는 문제
 *   ItemSystem 은 완전히 동작하는데 UI 가 없어서, 물약을 밟아도 유물을 밟아도
 *   화면에서는 아무 일도 일어나지 않는다. damage 가 1 → 1.2 로 바뀌어도 플레이어는 모른다.
 *
 * ★ 상한과 합치기 (정책의 실체는 itemStore.js 에 있다)
 *   - 동시 표시 최대 4개, 그리고 **무게 예산 5** — 유물은 2칸을 먹는다.
 *   - 같은 이름이 연속으로 들어오면 자리를 유지한 채 ×n 으로 합치고 수명만 리셋한다.
 *   - 넘치면 우선도가 낮은(소모품 → 장비 → 유물) 것 중 가장 오래된 것부터 버린다.
 *     그래서 후반에 물약이 쏟아져도 전설 유물 토스트는 절대 밀려나지 않는다.
 *
 * ★ 무게 차등
 *   소모품 한 줄(9px) / 장비 두 줄(10px) / 유물 세 줄 + 후광 + 맥동(11px).
 *   물약과 유물이 같은 크기로 뜨면 유물의 순간이 죽는다.
 */
import ItemIcon from "./ItemIcon";
import { useItemToasts } from "./itemStore";
import { CATEGORY_MARK, SLOT_META, rarityClass, rarityMark, rarityName } from "./itemText";
import "./inventory.css";

/** 이름 아래 한 줄. "무엇이 바뀌었는가"를 적는다 — 이름만으로는 아무것도 안 읽힌다 */
function subLine(t) {
    if (t.tier === "relic") return "✦ " + rarityName(t.rarity) + " 유물 · " + t.desc;
    if (t.tier === "equip") {
        const s = SLOT_META[t.slot];
        const head = (s ? s.mark + " " + s.name : "장비") + " 장착 · " + rarityName(t.rarity);
        // 교체로 밀려난 장비의 환급액. "무엇을 잃었나"까지 한 줄로 끝난다
        return t.salvage > 0 ? head + " · 환급 +" + t.salvage : head;
    }
    // 점수가 낮아 안 갈아입은 장비는 category 가 gold 로 와서 여기로 떨어진다.
    // desc 가 없으므로(장비에는 desc 가 없다) 환급액이 유일한 정보다.
    if (t.salvage > 0) return (t.desc ? t.desc + " · " : "") + "환급 +" + t.salvage + " 골드";
    return t.desc;
}

function Toast({ t }) {
    const minor = t.tier === "minor";
    const sub = subLine(t);
    // 퇴장 애니메이션 시작 시각. DOM 제거(만료)와 정확히 같은 순간에 끝난다.
    const style = { "--out": Math.max(0, t.ttl - 240) + "ms" };
    const count =
        t.count > 1 ? (
            // key 를 bump 로 바꿔 합쳐질 때마다 숫자만 한 번 튕기게 한다
            <span className="inv-toast__x" key={t.bump}>
                ×{t.count}
            </span>
        ) : null;

    return (
        <div
            className={["inv-rarity", "inv-toast", "is-" + t.tier, rarityClass(t.rarity)].join(" ")}
            style={style}
        >
            <ItemIcon frame={t.icon} size={t.iconSize} halo={t.tier === "relic" ? t.rarity : null} />
            <div className="inv-toast__body">
                <div className="inv-toast__top">
                    {/* 등급 기호 — 색맹 대응 1차 수단(10-UIUX 9.1) */}
                    <span className="inv-toast__mark">
                        {minor ? CATEGORY_MARK[t.category] : rarityMark(t.rarity)}
                    </span>
                    <span className="inv-toast__name">{t.label}</span>
                    {count}
                    {/* 소모품은 한 줄이 원칙이다. 개수 다음에 효과를 같은 줄로 붙인다 */}
                    {minor && sub ? <span className="inv-toast__sub">{sub}</span> : null}
                </div>
                {!minor && sub ? <div className="inv-toast__sub">{sub}</div> : null}
            </div>
        </div>
    );
}

export default function ItemToasts() {
    const toasts = useItemToasts();
    if (!toasts.length) return null;
    return (
        <div className="inv-toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
                <Toast key={t.uid} t={t} />
            ))}
        </div>
    );
}
