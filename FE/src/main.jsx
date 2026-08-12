/**
 * 엔트리. StrictMode를 유지한다 — 이중 마운트를 견디는 것이 GameManager의 요구사항이다.
 *
 * T101: @tanstack/react-query / react-router-dom 제거
 * F-1: 치명 오류 배선. 흰 화면 대신 index.html 의 정적 오류 화면이 뜬다.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import ErrorBoundary from "@/ui/error/ErrorBoundary";
import { installFatalGuard, reportFatal } from "@/ui/error/fatal";
import "./index.css";
// ★ index.css 다음이어야 한다. 앞에 오면 레이아웃 기본값이 아트를 덮어쓴다.
import "@/ui/art.css";

// ★ render() **전**이어야 한다. 첫 렌더가 던지는 예외도 잡아야 하고,
//   index.html 의 정적 관문에 sink/uiRecover 를 꽂는 것이 이 호출이다.
installFatalGuard();

createRoot(document.getElementById("root"), {
    // 어떤 경계에도 안 걸린 예외(경계 자신의 렌더 등). 잡을 곳이 여기밖에 없다.
    onUncaughtError: (error, errorInfo) => {
        const where = String(errorInfo?.componentStack ?? "")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)[0];
        reportFatal("react", error, where);
    },
}).render(
    <StrictMode>
        {/* ★ 경계는 StrictMode 안쪽이다. 바깥에 두면 StrictMode 가 만드는
            이중 렌더의 두 번째 통과가 경계를 우회한다. */}
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
