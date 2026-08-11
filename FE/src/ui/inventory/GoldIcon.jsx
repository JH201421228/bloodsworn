/**
 * GoldIcon — 골드(재화) 표식 하나. 타이틀 · 성소 · 출정지 · 결과 · PACT 가 전부 이것을 쓴다.
 *
 * ★ 왜 컴포넌트로 묶는가
 *   같은 표식이 7곳에 흩어져 있었다(TitleScreen / SanctumScreen 3곳 / StageSelectScreen 2곳 /
 *   ResultScreen / PactOverlay). 전용 금화 아이콘(docs/32)이 오면 7곳을 고쳐야 했고,
 *   그러면 반드시 한두 곳이 빠져 화면마다 재화 표식이 달라진다. 출처를 하나로 만든다.
 *
 * ★ 폴백을 지우지 않는다
 *   아틀라스에 프레임이 없으면 원래 글리프 ⬤ 로 떨어진다. ⬤ 는 컬러 이모지가 아니라
 *   단색 기하 기호라 기기마다 같은 그림이 나온다 — 급히 없애야 할 결함이 아니다.
 *
 * ★ 크기 기본값이 11인 이유
 *   이 표식이 붙는 글자가 화면마다 10~13논리px 다. 글자보다 크면 줄 높이를 밀어
 *   화면 하단이 잘린다(성소·결과의 세로 예산이 한 자리 px 단위로 빡빡하다).
 */
import ItemIcon from "./ItemIcon";
import { hasFrame } from "./itemAtlas";
import "./inventory.css";

/**
 * 아틀라스 프레임 이름. 여기 한 줄만 고치면 5개 화면이 같이 바뀐다.
 *
 * ★ itm_coin 을 쓰지 않은 이유: 실물이 은빛 문장 원반이라 11px 에서 회색 덩어리로 읽힌다.
 *   itm_charm_02(호박빛 원반)가 이 크기에서 유일하게 "둥근 금붙이"로 읽힌다.
 *   itm_pouch(금화 주머니)는 24px 에서는 훌륭하지만 11px 에서 갈색 덩어리가 된다.
 */
const GOLD_FRAME = "itm_charm_02";

/** @param {{ size?: number }} props  size 는 논리px(640x360 기준) */
export default function GoldIcon({ size = 11 }) {
    if (!hasFrame(GOLD_FRAME)) {
        return (
            <span className="gold-mark" aria-hidden="true">
                ⬤
            </span>
        );
    }
    return <ItemIcon frame={GOLD_FRAME} size={size} className="gold-ico" />;
}
