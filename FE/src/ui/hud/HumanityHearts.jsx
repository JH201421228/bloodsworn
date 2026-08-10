/**
 * HumanityHearts — 인간성 5칸 심장. (Day 5 / T510·T511)
 *
 * 인간성은 레벨업 시점에만 바뀌므로 60fps 값이 아니다 -> React 오버레이가 맞다.
 * 규격: 04-PACT-SYSTEM.md 8 (초기 100 / 회복 없음 / 20%마다 1개씩 검게) · 03-GDD-CORE 3.1 배치
 *
 * ★ 색만으로 구분하지 않는다(10-UIUX 9.1). 채운 심장 ♥ / 빈 심장 ♡ / 금 간 심장 ♥̸ 를
 *   모양으로 구분하고, 숫자를 항상 함께 적는다. 적록색약 사용자에게 붉은 심장의 농담은 안 보인다.
 */

const STEP = 20; // 심장 1개 = 인간성 20

/** @param {{ value: number, ascended?: boolean, showNumber?: boolean }} props */
export default function HumanityHearts({ value = 100, ascended = false, showNumber = true }) {
    const v = Math.max(0, Math.min(100, Math.round(value)));

    // T511 — 완전 흡혈귀화. 심장이 하나도 남지 않은 상태를 "빈 심장 5개"로 그리면
    // 그냥 체력이 없는 것처럼 보인다. 다른 기호로 바꿔 상태가 질적으로 변했음을 알린다.
    if (ascended || v <= 0) {
        return (
            <div className="humanity is-ascended" aria-label="완전 흡혈귀화">
                <span className="humanity__mark">✖</span>
                <span className="humanity__label">완전 흡혈귀화</span>
            </div>
        );
    }

    const hearts = [0, 1, 2, 3, 4].map((i) => {
        const full = v >= (i + 1) * STEP;
        const partial = !full && v > i * STEP;
        return { key: i, cls: full ? "is-full" : partial ? "is-cracked" : "is-empty", ch: full ? "♥" : partial ? "♥" : "♡" };
    });

    return (
        <div className="humanity" aria-label={"인간성 " + v}>
            {hearts.map((h) => (
                <span key={h.key} className={"humanity__heart " + h.cls}>
                    {h.ch}
                </span>
            ))}
            {showNumber && <span className="humanity__num">{v}</span>}
        </div>
    );
}
