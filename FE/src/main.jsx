/**
 * 엔트리. StrictMode를 유지한다 — 이중 마운트를 견디는 것이 GameManager의 요구사항이다.
 *
 * T101: @tanstack/react-query / react-router-dom 제거
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "./index.css";
// ★ index.css 다음이어야 한다. 앞에 오면 레이아웃 기본값이 아트를 덮어쓴다.
import "@/ui/art.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <App />
    </StrictMode>
);
