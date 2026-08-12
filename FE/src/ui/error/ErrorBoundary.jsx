/**
 * ErrorBoundary — 렌더/커밋 중 예외로 트리가 통째로 죽는 경로를 잡는다. (F-1)
 *
 * ★ 이 경계는 **오류 화면을 그리지 않는다.** fallback 이 null 이다.
 *   화면은 index.html 의 정적 DOM 이 이미 덮고 있다. 여기서 또 그리면
 *   「트리가 죽어서 띄우는 화면」을 죽은 트리로 그리는 자기모순이 된다 —
 *   fallback 자체가 예외를 던지면(스토어가 깨진 경우가 흔하다) 다시 흰 화면이다.
 *   경계의 일은 **부러진 가지를 잘라내는 것**뿐이고, 알리는 일은 정적 DOM 이 한다.
 *
 * ★ React 는 경계가 잡은 예외를 「처리됨」으로 보고 window.onerror 를 쏘지 않는다.
 *   그래서 이 파일이 없으면 렌더 예외는 어떤 전역 핸들러에도 안 걸리고
 *   화면만 텅 빈 채 남는다. 전역 핸들러와 이 경계는 대체재가 아니라 짝이다.
 *
 * ★ 복구는 fatal.uiRecover 가 setBoundaryReset 으로 맡긴 함수로 이뤄진다.
 *   스토어를 타이틀로 되돌린 **뒤**에 다시 그려야 같은 예외가 재발하지 않는다.
 */
import { Component } from "react";
import { reportFatal, setBoundaryReset } from "./fatal";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidMount() {
        // 「타이틀로 돌아가기」가 트리를 다시 세울 수 있도록 되살리기 함수를 맡긴다.
        setBoundaryReset(() => this.setState({ failed: false }));
    }

    componentDidCatch(error, info) {
        // componentStack 의 첫 줄이 곧 터진 컴포넌트 이름이다. 스택 전체는 실기기에서 너무 길다.
        const where = String(info?.componentStack ?? "")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)[0];
        reportFatal("react", error, where);
    }

    render() {
        // ★ StrictMode 는 개발 모드에서 렌더를 두 번 돌린다. 두 번째에서도 같은 예외가
        //   나오므로 failed 는 그대로 true 다 — 상태가 흔들리지 않는다.
        return this.state.failed ? null : this.props.children;
    }
}
