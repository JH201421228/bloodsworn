/**
 * GameCanvas — 앱 수명 내내 단 한 번 마운트되는 Phaser 컨테이너.
 * 화면 전환(title/sanctum/result)에도 절대 언마운트하지 않는다. CSS로 숨기기만 한다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.7
 *
 * ★ 캔버스 폭의 소유자다. 그리고 --canvas-w/--canvas-h(React HUD 가 읽는 캔버스 실측 크기)의
 *   갱신 시점도 여기가 정한다 — fitCanvasToViewport 안에서 함께 쓴다(config.js 참조).
 *   Phaser 는 640x360 으로 부팅하지만 실제 논리 폭은 기기 비율이 정한다(config.js 좌표계 주석).
 *   여기서 부팅 직후 한 번, 그리고 뷰포트가 바뀔 때마다 fitCanvasToViewport 를 불러
 *   캔버스가 화면을 꽉 채우게 한다. 이 훅이 없으면 20:9 기기에서 좌우 91px 씩 검게 남는다.
 */
import { useEffect, useRef } from "react";
import { gameManager } from "@/game/GameManager";
import { fitCanvasToViewport, watchCanvasMetrics } from "@/game/config";

export default function GameCanvas({ hidden = false }) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        const game = gameManager.boot(el);

        // ★ rAF 로 한 번만 접는다.
        //   회전 중에는 resize 가 수십 번 연달아 오고, 매번 setGameSize 하면 그때마다
        //   캔버스 버퍼가 재할당되어 안드로이드 WebView 에서 눈에 띄게 튄다.
        let raf = 0;
        const apply = () => {
            raf = 0;
            if (gameManager.game) fitCanvasToViewport(gameManager.game, el);
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(apply);
        };

        // 부팅 직후 즉시 1회. Phaser 가 아직 첫 프레임을 그리기 전이라 깜빡임이 없다.
        if (game) fitCanvasToViewport(game, el);
        // ★ 위 호출 시점에 game.canvas 가 아직 없을 수 있다(document.readyState 에 따라
        //   Phaser 의 boot 가 한 틱 미뤄진다). 그러면 fitCanvasToViewport 가 --canvas-w/h 를
        //   못 써서 React HUD 가 16:9 폴백 폭으로 한동안 남는다. 'ready' 에서 한 번 더 접는다.
        game?.events?.once?.("ready", schedule);

        // ★ Phaser 가 자기 경로(자체 resize 리스너 / step() 의 부모 박스 폴링)로
        //   캔버스를 다시 재단하는 경우까지 --canvas-w/h 에 반영시킨다. 이 구독이 없으면
        //   그 경로에서만 값이 낡아 .ui-hud-stage 가 캔버스와 어긋난다(config.js 주석).
        const unwatch = watchCanvasMetrics(game);

        window.addEventListener("resize", schedule);
        // ★ orientationchange 는 resize 보다 먼저 오고, 그 시점의 innerWidth/Height 는
        //   아직 회전 전 값이다. 그래서 별도로 듣되 계산은 rAF 뒤로 미룬다.
        window.addEventListener("orientationchange", schedule);
        // 안드로이드 소프트 키보드/제스처 바가 뜨고 지면 window resize 없이 여기만 바뀐다.
        window.visualViewport?.addEventListener("resize", schedule);

        // 부모 박스 자체가 바뀌는 경우(스플릿 스크린, 폴더블 펼침)는 window 이벤트로 안 잡힌다.
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
        if (ro && el) ro.observe(el);

        const onPageHide = () => gameManager.destroy();
        window.addEventListener("pagehide", onPageHide);

        return () => {
            if (raf) cancelAnimationFrame(raf);
            unwatch();
            ro?.disconnect();
            window.removeEventListener("resize", schedule);
            window.removeEventListener("orientationchange", schedule);
            window.visualViewport?.removeEventListener("resize", schedule);
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
