/**
 * itemText — 아이템 표시용 조회표. ItemSystem 주석이 지정한 자리다(ItemSystem.js 27행).
 *
 * ★ ITEM_PICKED 페이로드는 { id, name, category, rarity, label } 뿐이다.
 *   슬롯(fang/hide/charm)·아이콘 프레임·유물 설명은 실려 오지 않는다. 그런데 그 값들은
 *   전부 items.json 에 있고 런 중에 변하지 않는다. 그러니 이벤트를 늘려 Phaser 를
 *   고치는 대신, id 로 이 표를 한 번 찾으면 된다. Phaser 쪽 계약을 건드리지 않는 게 핵심이다.
 *
 * ★ 색맹 대응 (10-UIUX 9.1 "색만으로 구분하지 않기")
 *   등급은 색 + **기호** + (큰 표시에서는) 한글 라벨 세 겹으로 전달한다.
 *   기호는 채움 정도가 단조 증가하도록 골랐다: ○ → ◇ → ◈ → ◆ → ★.
 *   PactOverlay 가 쓰는 ○/◇/◆ 와 어긋나지 않게, 겹치는 등급은 같은 글자를 쓴다.
 */
import itemsData from "@/data/items.json";

/** id -> base. 66개짜리 표라 부팅 때 한 번 만들어 두면 그만이다 */
const BY_ID = Object.create(null);
for (const b of itemsData.bases) BY_ID[b.id] = b;

const RARITY_BY_ID = Object.create(null);
for (let i = 0; i < itemsData.rarities.length; i++) {
    RARITY_BY_ID[itemsData.rarities[i].id] = { ...itemsData.rarities[i], rank: i };
}

/** 등급 표기. mark 가 색맹 대응의 1차 수단이고 색은 보조다 */
const RARITY_MARK = {
    common: "○",
    uncommon: "◇",
    rare: "◈",
    epic: "◆",
    legendary: "★",
};

/** 슬롯 기호. 아이콘이 작아 못 알아볼 때도 이 글자로 "어느 칸인가"가 읽힌다 */
export const SLOT_META = {
    fang: { mark: "⚔", name: "송곳니" },
    hide: { mark: "⛨", name: "가죽" },
    charm: { mark: "☾", name: "부적" },
};

/** 슬롯 표시 순서 — 공격 / 생존 / 운영. items.json slots 순서와 같다 */
export const SLOT_ORDER = itemsData.slots.map((s) => s.id);

/** 분류 기호. 유물만 다른 세계의 물건이라는 인상을 주려고 ✦ 를 쓴다 */
export const CATEGORY_MARK = {
    use: "⚗",
    gold: "⬤",
    equip: "◈",
    relic: "✦",
};

export function baseOf(id) {
    return BY_ID[id] ?? null;
}

export function rarityOf(id) {
    return RARITY_BY_ID[id] ?? RARITY_BY_ID.common;
}

export function rarityMark(id) {
    return RARITY_MARK[id] ?? RARITY_MARK.common;
}

export function rarityName(id) {
    return rarityOf(id).name;
}

/** 등급별 CSS 클래스. 색은 여기서만 갈린다 — JSX 안에 hex 를 흩뿌리지 않는다 */
export function rarityClass(id) {
    return "is-" + (RARITY_BY_ID[id] ? id : "common");
}

/**
 * 소모품 설명의 {v} 치환. items.json 은 "체력 {v} 회복" 처럼 값을 비워 둔다.
 * 값을 문자열에 박아 두면 밸런스 조정 때 두 군데를 고쳐야 하고 반드시 한 쪽을 잊는다.
 */
export function descOf(base) {
    if (!base?.desc) return "";
    const v = base.effect?.value;
    return v === undefined ? base.desc : base.desc.replace("{v}", String(v));
}

/**
 * 화면에 띄울 최종 이름. label 은 ItemSystem 이 접두·접미까지 붙여 보낸 완성품이라
 * 그대로 쓰는 게 맞다. 없을 때만 base.name 으로 되돌아간다.
 */
export function displayLabel(p) {
    return p?.label || p?.name || baseOf(p?.id)?.name || "???";
}
