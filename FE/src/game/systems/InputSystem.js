/**
 * InputSystem — 조이스틱(기본 「고정」 / 옵션 「플로팅」) + 대시 버튼 + 키보드 폴백. (T133/T134)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 5.1(플로팅) / 5.2(시각) / 4(HUD 좌표) / 3.2(히트박스 레터박스 확장)
 *
 * ★ 싱글턴인 이유
 *   입력 UI는 HudScene이 그리고, 그 값을 쓰는 것은 GameScene이다.
 *   씬끼리 서로를 참조하면 결합이 생기므로 두 씬이 이 모듈만 본다. (EventBus와 같은 이유)
 *
 * ★ 좌표는 640 고정이 아니다 (config.js 좌표계 주석)
 *   논리 세로만 360 으로 고정이고 가로는 기기 비율을 따라 640~864 로 늘어난다.
 *   대시 버튼은 "x=556"이 아니라 "우측에서 84"이고, 조이스틱 영역은 "x<320"이 아니라
 *   "화면 좌측 절반"이다. 폭을 그대로 두면 20:9 기기에서 대시 버튼이 화면 한가운데쯤에
 *   떠 있게 된다. 실제 폭이 바뀔 때마다 layout() 이 다시 계산한다.
 */
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";
import { EventBus } from "../EventBus";
import { EVENTS } from "../constants";

/** 정본 3.2 */
export const JOY_RADIUS = 48;
export const JOY_DEADZONE = 8;

/**
 * 고정 모드 조이스틱 원점 (10-UIUX 5.3).
 *
 * ★ 값의 근거 — 「왼손 엄지」 아크
 *   10-UIUX 2.2 / screens.css 에 적힌 스윕 아크 x≈420~600 / y≈150~300 은 **오른손** 기준이다.
 *   왼손 데이터는 문서에 없으므로 640 폭을 기준으로 좌우 반전해 근거로 삼는다
 *   → 왼손 엄지 아크 ≈ x 40~220 / y 150~300. (좌우 반전이 성립하는 이유: 양손 파지에서
 *      왼손은 화면 **왼쪽 끝**을 잡으므로 x 는 좌측 절대값이고 화면 폭이 640~864 로 늘어나도
 *      변하지 않는다. 그래서 x 만 상수로 두고 폭을 곱하지 않는다.)
 *
 * ★ 아크 안에서 다시 좁힌 조건 (전부 실측으로 확인했다)
 *   - 반경 48 이 화면 밖으로 나가면 안 된다 → x ≥ 48, 48 ≤ y ≤ 312
 *   - 중앙 시야 금지 구역 x ≥ 200 (10-UIUX 2.4) 을 침범하면 안 된다 → x + 48 ≤ 200 → x ≤ 152
 *   - 좌상단 HUD 와 겹치면 안 된다. EXP 바 y 0~4 / HP 바 y 12~22 / HP 숫자 y 26 /
 *     인간성 심장 y 38~62 (x 16~120) / 녹턴 초상 y 66~131 (x 6~58) → y − 48 ≥ 131 이면 전부 안전
 *   - 우하단 대시 버튼(우측에서 84, 히트 72x72)과는 화면 반대편이라 겹칠 수 없다
 *   교집합은 x ∈ [106, 152] / y ∈ [179, 300] 이고, 그 안에서 「우 상단」쪽으로 (120, 200) 을 잡았다.
 *
 * ★★ 2026-08-12 재조정 — (120, 200) → **(145, 165)**
 *   실기기 제보: "조이스틱이 너무 좌측 하단에 있다. 조금 더 우측 상단으로."
 *   위 교집합의 y 하한 179 는 **녹턴 초상(y 66~131)** 을 피하려고 잡은 값인데,
 *   초상은 **PACT 화면에서만** 뜨고 그때는 씬이 멈춰 조이스틱을 쓰지 않는다.
 *   전투 중 좌상단의 실제 최하단은 **인간성 심장 y 62** 다. 그래서 y 하한이 62 + 48 = 110 까지
 *   내려간다(위로 올라간다). x 상한 152 는 중앙 시야 금지 구역(x ≥ 200)에서 온 값이라 그대로다.
 *     새 링 범위: x 97~193 (금지선 200 까지 7 여유) / y 117~213 (심장 아래끝 62 에서 55 여유)
 *   왼손 엄지 아크(오른손 x 420~600 을 640 폭 기준 반전한 x 40~220 / y 150~300) 안에도 남는다.
 *
 * ★ y 는 바닥 앵커로 둔다. 논리 세로는 360 고정이지만 엄지가 닿는 기준은 언제나 화면 아래쪽이라,
 *   세로가 바뀌는 날이 와도 손 위치를 따라가는 쪽이 맞다. x 는 좌측 앵커라 절대값 그대로다.
 */
const FIXED_JOY_X = 145;
const FIXED_JOY_MARGIN_B = 195; // y = h − 195 → 360 화면에서 165

/**
 * 고정 모드에서 조이스틱을 「잡을 수 있는」 반경 (10-UIUX 5.3 활성 영역 80px).
 * ★ 이게 없으면 좌측 절반 아무 데나 눌러도 원점이 고정점으로 잡혀, 링이 **그려진 자리**와
 *   **먹히는 자리**가 달라진다. 고정 모드의 의도(정본 5.3)이기도 하다.
 */
export const FIXED_JOY_GRAB = 80;

/** 대시 버튼 가장자리 여백 — 640x360 원안의 (556, 292) 를 앵커로 환산한 값이다 (10-UIUX 4) */
const DASH_MARGIN_R = LOGICAL_WIDTH - 556;   // 84
const DASH_MARGIN_B = LOGICAL_HEIGHT - 292;  // 68

/**
 * HUD 좌표 (10-UIUX 4).
 * ★ 값이 실행 중에 바뀐다. import 한 쪽에서 구조분해로 복사하지 말고 항상 DASH_BTN.x 로 읽어라.
 */
export const DASH_BTN = { x: LOGICAL_WIDTH - DASH_MARGIN_R, y: LOGICAL_HEIGHT - DASH_MARGIN_B, hit: 72 };

class InputSystemImpl {
    constructor() {
        /** 정규화된 이동 벡터. 길이 0~1 */
        this.vector = { x: 0, y: 0 };
        /** 조이스틱이 눌려 있는가 (HUD 렌더용) */
        this.active = false;
        this.origin = { x: 0, y: 0 };
        /**
         * 조이스틱 모드. false = 고정(**기본**). 링이 늘 같은 자리에 있어 눈으로 찾지 않아도 되고,
         * 근육 기억이 기기·런을 넘어 유지된다.
         * true = 플로팅(옵션). 손가락을 댄 자리가 원점이 된다.
         * ★ settingsSlice.SETTINGS_INIT.joystickFloating 과 반드시 같은 값이어야 한다 —
         *   설정 이벤트가 오기 전 1프레임 동안 이 값이 그대로 쓰인다.
         */
        this.floating = false;
        this.fixedOrigin = { x: FIXED_JOY_X, y: LOGICAL_HEIGHT - FIXED_JOY_MARGIN_B };
        /** 현재 논리 화면 크기. layout() 이 채운다 */
        this.screenW = LOGICAL_WIDTH;
        this.screenH = LOGICAL_HEIGHT;
        /** 조이스틱 활성 영역 — 좌측 절반. 레터박스까지 확장한다(10-UIUX 3.2) */
        this.joyZoneRight = LOGICAL_WIDTH / 2;
        EventBus.on(EVENTS.CMD_SETTINGS, (st) => {
            if (typeof st?.joystickFloating !== "boolean") return;
            this.floating = st.joystickFloating;
            // 옵션을 바꾼 즉시 링을 제자리로 옮긴다. 안 하면 모드를 바꾼 뒤 첫 터치 전까지
            // 예전 모드의 원점에 링이 남아 있다.
            this.syncIdleOrigin();
        }, { key: "input:settings" });
        this.knob = { x: 0, y: 0 };
        /** 이번 프레임에 대시가 요청됐는가. consumeDash()로 꺼내 쓴다 */
        this.dashQueued = false;
        /** 조이스틱을 잡고 있는 포인터 id. 멀티터치에서 대시와 섞이지 않게 한다 */
        this.joyPointerId = null;
        /**
         * 대시 버튼을 누르고 있는 포인터 id.
         * ★ dashQueued(1프레임짜리 요청)와 다르다. 이건 "지금 손가락이 버튼 위에 얹혀 있는가"이고
         *   HUD 가 눌린 판(btn-pressed)을 그릴지 정하는 데만 쓴다. 게임 로직은 보지 않는다.
         */
        this.dashPointerId = null;
        this.keys = null;
    }

    /**
     * 화면 폭이 바뀔 때마다 앵커를 다시 잡는다.
     * ★ 세로(360)는 불변이라 y 는 사실상 상수지만, 폭만 인자로 받으면 나중에
     *   누가 세로를 건드렸을 때 조용히 어긋난다. 둘 다 받아 둔다.
     */
    layout(w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT) {
        this.screenW = w;
        this.screenH = h;
        DASH_BTN.x = w - DASH_MARGIN_R;
        DASH_BTN.y = h - DASH_MARGIN_B;
        // 고정 조이스틱 — 좌측 앵커라 x 는 그대로, 바닥에서 FIXED_JOY_MARGIN_B 만 유지한다.
        this.fixedOrigin.y = h - FIXED_JOY_MARGIN_B;
        this.joyZoneRight = w / 2;
        this.syncIdleOrigin();
    }

    /**
     * 손을 떼고 있을 때의 링 위치를 고정점에 맞춘다.
     * ★ 고정 모드는 상시 표시(10-UIUX 5.3)라 「안 눌린 동안의 origin」이 그림 좌표가 된다.
     *   잡고 있는 중에는 절대 건드리지 않는다 — 드래그 중에 링이 튄다.
     */
    syncIdleOrigin() {
        if (this.active || this.floating) return;
        this.origin.x = this.fixedOrigin.x;
        this.origin.y = this.fixedOrigin.y;
        this.knob.x = this.fixedOrigin.x;
        this.knob.y = this.fixedOrigin.y;
    }

    /** HudScene에서 1회 호출 */
    attach(scene) {
        this.detach();
        this.scene = scene;
        this.layout(scene.scale.width, scene.scale.height);

        // 조이스틱 + 대시를 동시에 누를 수 있어야 한다
        scene.input.addPointer(2);

        this.onDown = (p) => this.handleDown(p);
        this.onMove = (p) => this.handleMove(p);
        this.onUp = (p) => this.handleUp(p);
        scene.input.on("pointerdown", this.onDown);
        scene.input.on("pointermove", this.onMove);
        scene.input.on("pointerup", this.onUp);
        scene.input.on("pointerupoutside", this.onUp);

        // 회전·폴더블 펼침으로 논리 폭이 바뀌면 버튼 앵커도 따라가야 한다.
        this.onResize = (size) => this.layout(size.width, size.height);
        scene.scale.on("resize", this.onResize);

        // 키보드 — 개발 중 PC 브라우저 확인 전용 (정본 3.2)
        this.keys = scene.input.keyboard?.addKeys({
            up: "W", down: "S", left: "A", right: "D",
            aup: "UP", adown: "DOWN", aleft: "LEFT", aright: "RIGHT",
            dash: "SPACE",
        });
    }

    /** 대시 버튼이 눌려 있는가 — HUD 렌더 전용. 키보드 SPACE 도 같이 본다 */
    get dashHeld() {
        return this.dashPointerId !== null || !!this.spaceHeld;
    }

    detach() {
        if (!this.scene) return;
        this.scene.input.off("pointerdown", this.onDown);
        this.scene.input.off("pointermove", this.onMove);
        this.scene.input.off("pointerup", this.onUp);
        this.scene.input.off("pointerupoutside", this.onUp);
        if (this.onResize) this.scene.scale.off("resize", this.onResize);
        // 씬이 죽는 순간 누르고 있었으면 pointerup 이 안 온다. 다음 런에 눌린 채로 시작한다.
        this.dashPointerId = null;
        this.scene = null;
    }

    inDashButton(p) {
        const h = DASH_BTN.hit / 2;
        // 우측 레터박스까지 확장 — 화면 끝을 눌러도 먹히게 한다(10-UIUX 3.2)
        const px = Math.min(p.x, this.screenW);
        return Math.abs(px - DASH_BTN.x) <= h && Math.abs(p.y - DASH_BTN.y) <= h;
    }

    handleDown(p) {
        if (this.inDashButton(p)) {
            this.dashQueued = true;
            this.dashPointerId = p.id;
            return;
        }
        if (this.joyPointerId !== null) return;
        // 좌측 절반. x<0(레터박스)도 0으로 클램프해 받는다
        if (p.x > this.joyZoneRight || p.y < 0 || p.y > this.screenH) return;
        const px = Math.max(0, p.x);
        // 고정 모드는 링 근처(반경 80)를 잡아야 활성이다 — 5.3. 그 밖의 좌측 절반 터치는 무시한다.
        if (!this.floating
            && Math.hypot(px - this.fixedOrigin.x, p.y - this.fixedOrigin.y) > FIXED_JOY_GRAB) return;
        this.joyPointerId = p.id;
        this.active = true;
        // 고정 모드면 손가락 위치와 무관하게 항상 같은 자리를 원점으로 쓴다.
        this.origin.x = this.floating ? px : this.fixedOrigin.x;
        this.origin.y = this.floating ? p.y : this.fixedOrigin.y;
        this.knob.x = this.origin.x;
        this.knob.y = this.origin.y;
        this.vector.x = 0;
        this.vector.y = 0;
    }

    handleMove(p) {
        if (p.id !== this.joyPointerId) return;
        const px = Math.max(0, p.x);
        let dx = px - this.origin.x;
        let dy = p.y - this.origin.y;
        let d = Math.hypot(dx, dy);

        // 드리프트 — 반경을 넘으면 원점을 손가락 쪽으로 끌어당긴다(5.1)
        // 원점 드리프트는 부동 모드에서만 한다. 고정 모드에서 원점이 따라 움직이면
        // "고정"이라는 약속이 깨져 오히려 더 혼란스럽다.
        if (d > JOY_RADIUS && this.floating) {
            const k = 1 - JOY_RADIUS / d;
            this.origin.x += dx * k;
            this.origin.y += dy * k;
            dx = px - this.origin.x;
            dy = p.y - this.origin.y;
            d = Math.hypot(dx, dy);
        }

        this.knob.x = this.origin.x + dx;
        this.knob.y = this.origin.y + dy;

        // 데드존을 뺀 뒤 재정규화. 이게 없으면 경계에서 속도가 튄다(5.1)
        if (d <= JOY_DEADZONE) {
            this.vector.x = 0;
            this.vector.y = 0;
            return;
        }
        const mag = Math.min((d - JOY_DEADZONE) / (JOY_RADIUS - JOY_DEADZONE), 1);
        this.vector.x = (dx / d) * mag;
        this.vector.y = (dy / d) * mag;
    }

    handleUp(p) {
        // ★ 조이스틱 검사보다 먼저다. 대시 포인터는 joyPointerId 가 아니라서
        //   아래 return 에 걸리면 눌린 상태가 영원히 안 풀린다.
        if (p.id === this.dashPointerId) this.dashPointerId = null;
        if (p.id !== this.joyPointerId) return;
        this.joyPointerId = null;
        this.active = false;
        this.vector.x = 0;
        this.vector.y = 0;
        // 손을 떼면 고정 모드 링은 제자리로 돌아간다(드리프트는 플로팅 전용이라 사실상 무변화지만,
        // 노브가 마지막 위치에 남는 것을 막는다).
        this.syncIdleOrigin();
    }

    /** 키보드 입력을 벡터에 합성한다. 매 프레임 호출 */
    pollKeyboard() {
        if (!this.keys || this.active) return;
        const k = this.keys;
        let x = 0, y = 0;
        if (k.left.isDown || k.aleft.isDown) x -= 1;
        if (k.right.isDown || k.aright.isDown) x += 1;
        if (k.up.isDown || k.aup.isDown) y -= 1;
        if (k.down.isDown || k.adown.isDown) y += 1;
        if (k.dash.isDown && !this.spaceHeld) this.dashQueued = true;
        this.spaceHeld = k.dash.isDown;

        if (x || y) {
            const d = Math.hypot(x, y);
            this.vector.x = x / d;
            this.vector.y = y / d;
        } else {
            this.vector.x = 0;
            this.vector.y = 0;
        }
    }

    consumeDash() {
        const d = this.dashQueued;
        this.dashQueued = false;
        return d;
    }
}

export const input = new InputSystemImpl();
