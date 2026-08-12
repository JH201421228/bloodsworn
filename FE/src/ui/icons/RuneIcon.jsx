/**
 * RuneIcon — runes 시트(docs/32) 한 칸을 CSS 스프라이트로 잘라 그린다.
 * 좌표 계산과 폴백 판정은 runeSheet.js 가 갖는다(ItemIcon / itemAtlas 와 같은 갈래다).
 *
 * ★ 호출하기 전에 hasCell 로 걸러라. 이 컴포넌트는 칸이 맞는지 다시 보지 않는다 —
 *   폴백(이모지·글리프)을 무엇으로 할지는 부르는 쪽이 안다.
 */
import { cellStyle } from "./runeSheet";

export default function RuneIcon({ cell, size = 20, className = "" }) {
    const box = `calc(${size} * var(--u))`;
    return (
        <span className={"rune-ico " + className} style={{ width: box, height: box }} aria-hidden="true">
            <span className="rune-icon" style={cellStyle(cell, size)} />
        </span>
    );
}
