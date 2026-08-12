/**
 * useAdPlacement — 광고 배치를 **준비 상태 변화까지 따라가며** 읽는다.
 *
 * ★ 왜 필요한가 (실기기에서 잡은 버그)
 *   `resolveAdPlacement(id)` 를 컴포넌트 본문에서 그냥 부르면 **그 렌더 시점의 값**만 잡힌다.
 *   광고는 비동기로 나중에 준비되므로, 화면이 뜬 뒤에 로드가 끝나면 아무도 다시 그리지 않아
 *   **버튼이 영영 안 나타난다.**
 *
 *   에뮬레이터 실측(2026-08-12): `onRewardedVideoAdLoaded` 가 2회 발생하고 실패는 0회인데도
 *   결과 화면 버튼이 `["다시 하기","성소로","타이틀"]` 뿐이었다 — 광고는 준비됐는데 화면이
 *   그 사실을 모르는 상태였다.
 *
 * ★ 모듈은 이미 알림 수단을 주고 있었다 — `onAdReadyChange(cb)` 가 해제 함수를 돌려준다.
 *   쓰지 않고 있었을 뿐이다.
 *
 * ★ useEffect + setState 를 쓰지 않는 이유
 *   이 저장소 규약이 "효과 안에서 setState 를 동기로 부르지 않는다"이고(ResultScreen 주석),
 *   lint 도 막는다. `useSyncExternalStore` 가 정확히 이 모양(구독 + 스냅샷)을 위한 것이고
 *   **마운트 시점에 이미 준비된 경우**도 추가 렌더 없이 자연스럽게 잡는다.
 *
 * ★ 스냅샷으로 **불린**(isAdReady)을 쓴다. `resolveAdPlacement` 는 객체를 돌려주므로
 *   호출마다 참조가 달라지면 useSyncExternalStore 가 무한 루프에 빠진다. 정책 판정
 *   (빈도 상한·동의·엔타이틀먼트)은 렌더 본문에서 그대로 통과시킨다.
 *
 * @param {string} id `shop.json` 의 adPlacements[].id
 * @returns {object|null} 지금 보여줄 수 있는 배치, 없으면 null
 */
import { useCallback, useSyncExternalStore } from "react";
import { resolveAdPlacement, isAdReady, onAdReadyChange } from "@/monetization";

export function useAdPlacement(id) {
    const snapshot = useCallback(() => Boolean(isAdReady(id)), [id]);
    // 서버 렌더는 없지만 세 번째 인자를 주면 SSR 경고 경로를 원천 차단한다
    const ready = useSyncExternalStore(onAdReadyChange, snapshot, () => false);
    return ready ? resolveAdPlacement(id) : null;
}
