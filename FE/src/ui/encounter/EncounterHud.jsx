/**
 * EncounterHud — 조우 등장 배너 + 예언자 미리보기. (ui/encounter 소유)
 *
 * ★ 여기 없는 것 — **방향 화살표**.
 *   화살표는 조우의 화면 좌표를 매 프레임 다시 계산해야 한다. 그 값을 스토어에 실으면
 *   06-TECH 3.3 의 금지 규칙("60fps 값을 Zustand 에 넣지 않는다")을 정면으로 어긴다.
 *   그래서 화살표만 Phaser 가 그린다(EncounterSystem.drawArrow — setScrollFactor(0)).
 *   배너와 미리보기는 런당 5~10회라 React 가 맞다. 같은 UI 를 둘로 나눈 이유가 그것이다.
 *
 * ★ 자리 (10-UIUX 2.4 의 빈칸 계산 — inventory.css 머리 주석과 같은 표)
 *   상단 밴드 y<44 는 HP바·Lv·타이머·킬수·인간성·EXP바가 이미 채웠고,
 *   중앙 시야 금지 구역은 (200,96)~(440,264) 다. 배너는 그 사이 y 48~68 에 눕는다.
 *   미리보기는 그 바로 아래 y 72~86. 둘 다 pointer-events:none 이라 조작을 0개 늘린다.
 *
 * ★ ItemToasts 를 재사용하지 않은 이유
 *   그쪽은 우측 세로 스택(x 460~636)이고 등급 색·무게 예산·합치기 정책이 아이템 전용이다.
 *   조우 배너는 화면 중앙 상단 가로 한 줄이고 한 번에 하나뿐이라, 같은 컴포넌트에 넣으면
 *   itemStore 의 trim/무게 규칙에 조우가 밀려 사라지는 사고가 난다.
 *   대신 상자 획득 알림은 이쪽으로 모았다 — 상자는 아이템이 아니라 조우다.
 */
import { useEncounterBanner, useSeerPreview } from "./encounterStore";
import "./encounter.css";

function Banner({ b }) {
    return (
        <div className={"enc-banner is-" + b.tone} key={b.uid}>
            {b.sub ? <span className="enc-banner__sub">{b.sub}</span> : null}
            <span className="enc-banner__text">{b.text}</span>
        </div>
    );
}

/** 30 §3.3 — 미리보기가 주는 것은 「계획」이다. 다음 카드를 알아야 지금 무엇을 살지가 정해진다 */
function SeerPreview({ p }) {
    return (
        <div className="enc-preview" role="status">
            <span className="enc-preview__tag">예언 Lv.{p.atLevel}</span>
            {p.names.map((n, i) => (
                <span className="enc-preview__card" key={i}>
                    {n}
                    {p.tolls[i] ? <em className="enc-preview__toll">{p.tolls[i]}</em> : null}
                </span>
            ))}
        </div>
    );
}

export default function EncounterHud() {
    const banner = useEncounterBanner();
    const preview = useSeerPreview();
    if (!banner && !preview) return null;
    return (
        <div className="enc-layer" role="status" aria-live="polite">
            {banner ? <Banner b={banner} /> : null}
            {preview ? <SeerPreview p={preview} /> : null}
        </div>
    );
}
