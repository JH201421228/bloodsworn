/**
 * BLOODSWORN 게임 전역 설정
 *
 * ★ 좌표계는 두 개다. 이 분리를 모르면 아래 상수를 반드시 잘못 쓴다.
 *
 *   1) 월드(Phaser 캔버스) — 세로 360 고정, 가로 가변.
 *      캔버스는 뷰포트를 꽉 채운다. 논리 세로는 항상 360 이고 논리 가로만
 *      기기 비율을 따라 640~864 사이에서 늘어난다. 20:9 기기는 16:9 보다
 *      가로로 더 넓게 본다. 실행 중의 진짜 폭은 언제나 `scene.scale.width` 다.
 *      LOGICAL_WIDTH(640) 는 작성 기준값일 뿐 실행 폭이 아니다.
 *
 *   2) UI 스테이지(React 오버레이 .ui-stage) — 640x360 16:9 중앙 고정.
 *      PACT 카드·각성 배너는 pct(x, 640) 으로 배치돼 있어 폭을 늘리면 좌표가
 *      통째로 틀어진다. 넓힐 이유도 없다 — 카드 3장이 초광폭에 흩어지면
 *      오히려 읽기 어렵다. index.css 의 --stage-w/--stage-h 가 이 박스를 만든다.
 *
 *   따라서 "화면 전체를 덮는 것"(바닥 타일·플래시·안개 띠)과 "화면 가장자리에
 *   붙는 것"(EXP 바·킬 수·대시 버튼)은 640 이 아니라 scale.width 를 봐야 하고,
 *   PACT/각성/장비 슬롯 같은 React UI 는 640 을 그대로 쓴다.
 *
 * 규격 출처: 06-TECH-DESIGN.md 1.3
 * 이전 프로젝트 잔재(세로 375x667, Scale.RESIZE, AUDIENCE_LAYOUT)는 전량 폐기했다. (T104/T105)
 */
import Phaser from "phaser";

/**
 * 작성 기준 논리 해상도.
 * ★ WIDTH 는 최소 폭이자 UI 스테이지의 폭이다. 월드의 실행 폭이 아니다 —
 *   런타임에 화면을 덮거나 가장자리에 붙는 것은 scene.scale.width 를 써라.
 */
export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;

/**
 * 논리 가로 하한 — 640(16:9).
 * ★ 이보다 좁히지 않는 이유: HUD·보스 HP바(400px)·PACT 스테이지가 전부 640 폭으로
 *   재단돼 있다. 4:3 태블릿처럼 세로가 긴 기기에서 폭을 480 으로 줄이면 보스 HP바가
 *   화면 폭의 83%를 먹고 UI 스테이지가 캔버스보다 커진다. 세로가 긴 기기는 폭을
 *   640 에 고정하고 상하 레터박스를 남긴다 — 이쪽이 정상 동작이다.
 */
export const MIN_LOGICAL_WIDTH = 640;

/**
 * 논리 가로 상한 — 864(21.6:9).
 *
 * ★ 왜 상한이 필요한가: 논리 폭은 곧 한 번에 보이는 월드 면적이다. 상한이 없으면
 *   폴더블 펼침·태블릿·데스크톱 32:9 에서 면적이 2배가 되어, 640x360 에서 실측·튜닝한
 *   스폰 압력과 회피 난이도가 전부 무의미해진다.
 * ★ 왜 하필 864 인가:
 *   - 출시된 폰 중 가장 넓은 21:9(Xperia 1 계열, 2.333)가 논리 840 이다. 864 면
 *     현행 폰 비율(16:9~21:9)이 전부 검은 띠 없이 들어온다. 실측 20:9 기기는 800.
 *   - 864 = 16px 타일 정확히 54칸. 바닥 타일/청크 계산이 정수로 떨어진다.
 *   - 640 대비 면적 +35%. 스폰 링을 화면에 비례시키는 SpawnSystem.ringRadius 와
 *     함께 써야 "적은 언제나 화면 밖에서 온다"는 공정성 규약이 유지된다.
 *   이보다 넓은 비율은 캔버스가 좌우 레터박스된다 — 의도한 동작이다.
 */
export const MAX_LOGICAL_WIDTH = 864;

/**
 * 뷰포트 크기로 논리 가로를 정한다. 세로는 언제나 360 이다.
 *
 * ★ floor 인 이유: FIT 은 min(뷰포트W/논리W, 뷰포트H/360) 을 배율로 쓴다. 논리 폭을
 *   내림하면 가로 배율이 세로 배율보다 항상 크거나 같아져 세로가 정확히 꽉 찬다.
 *   올림하면 반대로 상하에 띠가 생긴다 — 세로는 절대 잘리거나 남으면 안 된다.
 *   남는 것은 좌우 합쳐 1 논리px 미만(실측 1.2 CSS px 미만)이다.
 */
export function logicalWidthFor(viewportW, viewportH) {
    if (!(viewportW > 0) || !(viewportH > 0)) return MIN_LOGICAL_WIDTH;
    const w = Math.floor((viewportW / viewportH) * LOGICAL_HEIGHT);
    return Math.max(MIN_LOGICAL_WIDTH, Math.min(MAX_LOGICAL_WIDTH, w));
}

/**
 * 캔버스의 **실측 CSS 사각형**을 --canvas-w / --canvas-h 로 흘려보낸다.
 *
 * ★ 왜 필요한가: .ui-stage 는 16:9 고정이라 20:9 기기에서 캔버스보다 좌우 91px 씩 좁다.
 *   React HUD(인간성 심장·장비 슬롯·토스트)를 물리적 화면 끝에 붙이려면 캔버스와 1:1 인
 *   박스가 따로 있어야 한다. 그 박스가 index.css 의 .ui-hud-stage 이고, 크기를 여기서 준다.
 *   ★ 이 값을 읽는 곳은 .ui-hud-stage 하나뿐이다. PACT·각성은 .ui-stage(16:9)를 쓰고
 *     (넓히면 카드 좌표가 흩어진다), 전면 화면(.ui-screen)은 뷰포트 전체를 쓴다 —
 *     캔버스가 레터박스되는 비율에서 전면 화면까지 같이 잘리면 안 되기 때문이다
 *     (index.css "전면 화면 박스" 주석).
 * ★ 왜 CSS 만으로는 못 하나: 논리 폭이 floor() 정수 내림이라 순수 CSS 로는 최대 2~3 CSS px
 *   어긋나고, CSS floor() 는 빌드 타깃(chrome87 / safari14)에 없다. 캔버스의 진짜 크기를
 *   아는 곳은 여기뿐이므로 여기서 한 번 쓰고 CSS 는 읽기만 한다.
 * ★ 세로는 언제나 캔버스 높이 == .ui-stage 높이다(둘 다 논리 360 에 같은 배율). 그래서
 *   --u 는 양쪽에서 같은 값이고, HUD 크기는 화면비가 바뀌어도 변하지 않는다.
 */
function publishCanvasMetrics(game) {
    if (typeof document === "undefined") return;
    const el = game?.canvas;
    const root = document.documentElement;
    if (!el || !root) return;

    const rect = el.getBoundingClientRect?.();
    const ds = game.scale?.displaySize;
    // 레이아웃 전이라 rect 가 0 인 구간에서는 Phaser 가 계산해 둔 표시 크기로 폴백한다.
    const w = rect?.width > 0 ? rect.width : (ds?.width ?? 0);
    const h = rect?.height > 0 ? rect.height : (ds?.height ?? 0);
    if (!(w > 0) || !(h > 0)) return;

    root.style.setProperty("--canvas-w", w + "px");
    root.style.setProperty("--canvas-h", h + "px");
}

/**
 * Phaser 가 **스스로** 캔버스를 다시 재단할 때도 --canvas-w/h 를 따라 갱신시킨다.
 *
 * ★ 왜 필요한가: ScaleManager 는 GameCanvas 의 이벤트와 별개로 움직이는 경로가 둘 있다.
 *   자체 window resize 리스너와, step() 이 resizeInterval(기본 500ms)마다 부모 박스를
 *   다시 재는 폴링이다. 둘 중 하나로 refresh() 가 돌면 canvas.style.width/height 는
 *   바뀌는데 publishCanvasMetrics 는 안 불린다 — 그 순간 --canvas-w/h 가 낡는다.
 *   낡은 값을 읽는 것은 이제 .ui-hud-stage 뿐이지만, 그 박스가 어긋나면 인간성 심장·
 *   장비 슬롯이 Phaser 가 그린 HP바와 어긋나 보인다. RESIZE 이벤트에 붙여 두면
 *   "캔버스가 바뀌었으면 반드시 다시 쓴다"가 경로와 무관하게 성립한다.
 * ★ 60fps 값이 아니다. RESIZE 는 실제로 크기가 바뀔 때만 발화한다.
 *
 * @returns {() => void} 구독 해제
 */
export function watchCanvasMetrics(game) {
    const s = game?.scale;
    if (!s?.on) return () => {};
    const onResize = () => publishCanvasMetrics(game);
    s.on(Phaser.Scale.Events.RESIZE, onResize);
    return () => s.off(Phaser.Scale.Events.RESIZE, onResize);
}

/**
 * 캔버스를 뷰포트에 맞춰 다시 재단한다. GameCanvas 가 부팅 직후와 리사이즈마다 부른다.
 *
 * ★ Scale.FIT 을 유지한 채 게임 크기만 바꾸는 이유:
 *   Scale.RESIZE 나 카메라 zoom 으로 넓히면 zoom != 1 이 되고, 그 순간
 *   setScrollFactor(0) 오브젝트(HUD 전부)의 좌표가 논리 좌표가 아니게 된다
 *   (Phaser 는 카메라 원점 기준으로 zoom 을 곱한다). HUD 를 통째로 다시 짜야 한다.
 *   게임 크기 자체를 800x360 으로 바꾸면 zoom 은 1 로 남고 HUD 좌표계가 그대로 산다.
 *   FIT 은 그 800x360 을 뷰포트에 꽉 맞춰준다 — 한쪽 배율만 쓰므로 왜곡도 없다.
 *
 * @returns {number} 적용된 논리 가로
 */
export function fitCanvasToViewport(game, container) {
    const s = game?.scale;
    if (!s) return LOGICAL_WIDTH;

    // 부모 박스가 진짜 크기다. #game-root 는 inset:0 이라 곧 뷰포트지만,
    // 캡처 도구/에뮬레이터에서 innerWidth 가 먼저 갱신되는 경우가 있어 둘 중 큰 쪽을 안 쓴다 —
    // 부모가 0(아직 레이아웃 전)일 때만 window 로 폴백한다.
    const r = container?.getBoundingClientRect?.();
    const vw = r?.width > 0 ? r.width : window.innerWidth;
    const vh = r?.height > 0 ? r.height : window.innerHeight;

    const w = logicalWidthFor(vw, vh);
    if (s.width !== w || s.height !== LOGICAL_HEIGHT) {
        // setGameSize 는 카메라까지 같이 넓혀준다(CameraManager.onResize 가 RESIZE 를 듣는다).
        s.setGameSize(w, LOGICAL_HEIGHT);
    }
    // 부모 크기가 바뀌었을 수 있으니 배율·입력 좌표 변환을 다시 계산시킨다.
    s.refresh();
    // ★ refresh() 뒤여야 한다. Phaser 가 canvas.style.width/height 를 여기서 확정한다.
    publishCanvasMetrics(game);
    return w;
}

/** 월드(스테이지1 봉인묘) 크기. 정본 03-GDD-CORE 8.1 */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1200;

/** 타일 크기 */
export const TILE_SIZE = 16;

/** 런 길이(초). 정본 01 2 */
export const RUN_DURATION = 360;

/** 배경색 — 레터박스와 같은 색이어야 "묘실의 어둠"으로 읽힌다. 정본 03-GDD-CORE 2.1 */
export const VOID_COLOR = "#0b0710";

export const GAME_CONFIG = {
    type: Phaser.AUTO,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: VOID_COLOR,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    powerPreference: "high-performance",
    // 모바일 WebView에서 60fps 상한을 명시. forceSetTimeOut은 쓰지 않는다(rAF가 더 안정적).
    fps: { target: 60, min: 30, forceSetTimeOut: false },
    scale: {
        // ★ FIT 을 유지한다. 폭은 fitCanvasToViewport 가 setGameSize 로 바꾼다.
        //   여기 640x360 은 첫 프레임용 초기값일 뿐이다.
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        // ★ Phaser 자체 리사이즈 리스너를 끄지 않는다 — 부모 크기 변화를 감지해
        //   FIT 을 다시 계산해야 하고, 논리 폭 재계산은 GameCanvas 가 따로 건다.
    },
    render: {
        // 픽셀아트 텍스처가 씻겨나가지 않도록 프리멀티플라이 비활성
        premultipliedAlpha: false,
        // 스크린샷/공유 기능 없음 → 백버퍼 보존 불필요
        preserveDrawingBuffer: false,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            // 플레이어 vs 벽 타일맵 충돌에만 쓴다(06 5.2). 적/투사체는 공간해시로 직접 판정.
            fps: 60,
        },
    },
    audio: { disableWebAudio: false },
    // scene 배열은 GameManager가 주입한다.
};
