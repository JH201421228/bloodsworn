/**
 * PactOverlay — 계약서 3장. 이 게임의 핵심 훅이다.
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.5 / 2.5.1 · 04-PACT-SYSTEM 3
 *   카드 160x240, x = 64 / 240 / 416, y = 52 (논리 640x360 기준)
 *
 * ★ 좌표를 % 로 쓰는 이유
 *   Phaser가 Scale.FIT으로 640x360(16:9)을 중앙 배치한다.
 *   React 오버레이도 같은 16:9 박스를 만들면 두 좌표계가 저절로 맞는다.
 */
import { useStore } from "@/state/store";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import "./nocturne.css";

const pct = (v, total) => (v / total) * 100 + "%";

const RARITY = {
    common: { label: "COMMON", mark: "○", cls: "is-common" },
    rare: { label: "RARE", mark: "◇", cls: "is-rare" },
    epic: { label: "EPIC", mark: "◆", cls: "is-epic" },
};

/** 중첩 인디케이터 ●●○ — 색맹 대응으로 색이 아니라 채움으로 구분한다 */
function Stacks({ before, after }) {
    const dots = [0, 1, 2].map((i) => {
        if (i < before) return "filled";
        if (i < after) return "gain";
        return "empty";
    });
    return (
        <div className="pact-card__stacks">
            중첩{" "}
            {dots.map((d, i) => (
                <span key={i} className={"pact-dot is-" + d}>
                    {d === "empty" ? "○" : "●"}
                </span>
            ))}
        </div>
    );
}

function Card({ card }) {
    const r = RARITY[card.rarity] ?? RARITY.common;
    const t = card.toll;
    const awaken = t?.triggersAwakening;

    return (
        <button
            className={"pact-card " + r.cls + (awaken ? " is-awakening" : "")}
            style={{ left: pct([64, 240, 416][card.index], 640), top: pct(52, 360), width: pct(160, 640), height: pct(240, 360) }}
            onClick={() => EventBus.emit(EVENTS.CMD_PACT_CHOOSE, { index: card.index })}
        >
            <span className="pact-card__rarity">{r.mark} {r.label}</span>

            <span className="pact-card__name">{card.blessing.name}</span>
            <span className="pact-card__effect">{card.blessing.desc}</span>
            <span className="pact-card__lv">Lv.{card.blessing.level}</span>

            {t ? (
                <>
                    <span className="pact-card__divider">✖ 대 가</span>
                    <span className="pact-card__toll">[{t.name}]</span>
                    <span className="pact-card__tollv">{t.desc}</span>
                    <Stacks before={t.stacksBefore} after={t.stacksAfter} />
                    {awaken && <span className="pact-card__awaken">✦ 이 계약으로 각성한다</span>}
                </>
            ) : (
                <span className="pact-card__divider pact-card__divider--none">— 대가 없음 —</span>
            )}

            <span className="pact-card__humanity">
                인간성 {card.humanityCost ? "−" + card.humanityCost : "0"}
            </span>
        </button>
    );
}

export default function PactOverlay() {
    const pact = useStore((s) => s.pact);
    const rerollLeft = useStore((s) => s.rerollLeft);
    if (!pact.open) return null;

    return (
        <div className="ui-stage pact-stage">
            {/* 녹턴 대사 — 화자가 있어야 카드 3장이 '시스템'이 아니라 '거래'로 읽힌다 */}
            {/* 녹턴 초상 — 대사 옆에 화자가 보여야 카드 3장이 '시스템'이 아니라 '거래'로 읽힌다 */}
            {pact.nocturneLine && <div className="pact-nocturne-portrait" aria-hidden="true" />}
            {pact.nocturneLine && (
                <p className="pact-nocturne" key={pact.nocturneLine}>“{pact.nocturneLine}”</p>
            )}
            {pact.cards.map((c) => (
                <Card key={c.index} card={c} />
            ))}
            {/* T540 리롤 — 런당 2회(+성소 「재계약」). 대가만 리롤은 제공하지 않는다(04-PACT 6.1) */}
            <button
                className="pact-reroll"
                disabled={rerollLeft <= 0}
                style={{ left: pct(136, 640), top: pct(300, 360), width: pct(160, 640) }}
                onClick={() => EventBus.emit(EVENTS.CMD_PACT_REROLL)}
            >
                ↻ 다시 뽑는다 ({rerollLeft})
            </button>

            {/* T541 스킵 — 인간성이 줄지 않는 유일한 선택지다. 보상을 문구에 적어야 선택지로 읽힌다 */}
            <button
                className="pact-skip"
                disabled={!pact.canSkip}
                style={{ left: pct(344, 640), top: pct(300, 360), width: pct(160, 640) }}
                onClick={() => EventBus.emit(EVENTS.CMD_PACT_SKIP)}
            >
                거절 (HP +25% · ⬤30)
            </button>
        </div>
    );
}
