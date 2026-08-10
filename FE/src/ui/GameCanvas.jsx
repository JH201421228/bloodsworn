/**
 * GameCanvas — 앱 수명 내내 단 한 번 마운트되는 Phaser 컨테이너.
 * 화면 전환(title/sanctum/result)에도 절대 언마운트하지 않는다. CSS로 숨기기만 한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.7
 */
import { useEffect, useRef } from "react";
import { gameManager } from "@/game/GameManager";

export default function GameCanvas({ hidden = false }) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        gameManager.boot(el);

        const onPageHide = () => gameManager.destroy();
        window.addEventListener("pagehide", onPageHide);

        return () => {
            window.removeEventListener("pagehide", onPageHide);
            // ★ StrictMode 이중 언마운트에서 destroy 하지 않는다. 카운터만 되돌린다.
            gameManager.release();
        };
    }, []);

    return (
        <div
            id="game-root"
            ref={ref}
            // display:none 은 일부 안드로이드 WebView에서 WebGL 컨텍스트 로스를 유발하므로 쓰지 않는다.
            style={{ visibility: hidden ? "hidden" : "visible" }}
        />
    );
}
