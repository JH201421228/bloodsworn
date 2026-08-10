/**
 * useGameEvent — EventBus 구독을 useEffect 생명주기에 안전하게 묶는다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.6
 *
 * handler를 ref에 담는 이유: 매 렌더마다 새 클로저가 생겨도 구독을 다시 걸지 않기 위해서다.
 * (다시 걸면 StrictMode에서 중복 등록 위험이 생긴다 — T107b)
 */
import { useEffect, useRef } from "react";
import { EventBus } from "@/game/EventBus";

export function useGameEvent(event, handler) {
    const ref = useRef(handler);

    // ⚠ 06-TECH-DESIGN.md 3.6의 예제는 렌더 중에 ref.current를 직접 대입하는데,
    //    최신 eslint-plugin-react-hooks의 react-hooks/refs 규칙이 이를 에러로 잡는다.
    //    동작은 같으므로 대입을 effect로 옮겼다. (문서 예제보다 이쪽이 맞다)
    useEffect(() => {
        ref.current = handler;
    });

    useEffect(() => {
        return EventBus.on(event, (payload) => ref.current?.(payload));
    }, [event]);
}

export default useGameEvent;
