/**
 * 전면 화면들이 공유하는 상수와 순수 함수.
 *
 * ★ 컴포넌트 파일에 함께 두지 않는 이유: Vite의 react-refresh 는 "컴포넌트만 export 하는 파일"만
 *   빠르게 갱신한다. 상수를 같이 내보내면 HMR 이 통째로 리로드로 떨어진다(eslint 가 에러로 잡는다).
 */
import awakeningsData from "@/data/awakenings.json";
import { isWin } from "@/state/bridge";

/**
 * 화면에 표시하는 빌드 정보.
 * ★ 버그 리포트는 버전 없이는 재현이 불가능하다. 타이틀·옵션 양쪽에 노출한다(10-UIUX 2.2 / 2.10).
 */
export const APP_VERSION = "0.1.0";
export const BUILD_DATE = "2026-08-11";

const AWAKEN_BY_TAG = Object.fromEntries(
    (awakeningsData.awakenings ?? []).filter((a) => a.tag).map((a) => [a.tag, a])
);

/** mm:ss */
export function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/** 각성 페이로드는 태그 문자열일 수도, { tag, name } 객체일 수도 있다. 양쪽 다 받는다. */
export function awakenLabel(a) {
    const tag = typeof a === "string" ? a : (a?.tag ?? null);
    const def = tag ? AWAKEN_BY_TAG[tag] : null;
    const name = (typeof a === "object" && a?.name) || def?.name || tag || "각성";
    return tag ? "✦ 「" + name + "」 (" + tag + "×3)" : "✦ 「" + name + "」";
}

/**
 * 엔딩 분기 (T532). 정본 01-CONCEPT-AND-STORY.md 6.
 *
 * ★ 우선순위를 C → A → B 로 둔 이유: 조건이 겹칠 수 있는데(인간성 35 이상이면서 각성 2개),
 *   희소한 쪽을 먼저 보여줘야 플레이어가 "달성했다"고 느낀다.
 *   C는 진엔딩(인간성 0), A는 도전 목표(인간성 35 이상), B가 기본 클리어다.
 * ★ 정본이 "인간성 1~34 · 각성 0~1" 구간을 규정하지 않았다. 클리어했는데 엔딩이 없을 수는 없으므로
 *   B로 떨어뜨린다. 정식 조건(각성 2개 이상)을 만족했는지는 `canonical` 로 구분해 둔다.
 */
export function pickEnding({ reason, humanity = 0, awakenCount = 0 }) {
    if (!isWin(reason)) {
        return {
            win: false,
            canonical: true,
            head: "✖ 실 패",
            name: "「 먹 이 」",
            line:
                reason === "abandon"
                    ? '녹턴 —— "벌써 지쳤나. 사슬은 기다려 준다."'
                    : '녹턴 —— "아깝군. 다음 그릇을 기다려야겠어."',
        };
    }
    if (humanity <= 0) {
        return {
            win: true,
            canonical: true,
            head: "☀ 여 명",
            name: "엔딩 C —— 「 진 조 」",
            line: "새벽이 온다. 에일라는 사슬 앞에 선다. 녹턴이 웃으며 자리를 비켜준다.",
        };
    }
    if (humanity >= 35) {
        return {
            win: true,
            canonical: true,
            head: "☀ 여 명",
            name: "엔딩 A —— 「 인 간 」",
            line: "성촉이 다시 타오른다. 에일라는 살아남았고, 아직 사람이다.",
        };
    }
    return {
        win: true,
        canonical: awakenCount >= 2,
        head: "☀ 여 명",
        name: "엔딩 B —— 「 서 약 자 」",
        line: "봉인은 유지됐다. 하지만 거울 속 얼굴이 낯설다.",
    };
}
