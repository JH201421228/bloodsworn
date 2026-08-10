/**
 * InputSystem — 플로팅 조이스틱 + 대시 버튼 + 키보드 폴백. (T133/T134)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 5.1(플로팅) / 5.2(시각) / 4(HUD 좌표) / 3.2(히트박스 레터박스 확장)
 *
 * ★ 싱글턴인 이유
 *   입력 UI는 HudScene이 그리고, 그 값을 쓰는 것은 GameScene이다.
 *   씬끼리 서로를 참조하면 결합이 생기므로 두 씬이 이 모듈만 본다. (EventBus와 같은 이유)
 */
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";
import { EventBus } from "../EventBus";
import { EVENTS } from "../constants";

/** 정본 3.2 */
export const JOY_RADIUS = 48;
export const JOY_DEADZONE = 8;

/** HUD 좌표 (10-UIUX 4) */
export const DASH_BTN = { x: 556, y: 292, hit: 72 };

/** 조이스틱 활성 영역 — 좌측 절반. 레터박스까지 확장한다(10-UIUX 3.2) */
const JOY_ZONE_RIGHT = 320;

class InputSystemImpl {
    constructor() {
        /** 정규화된 이동 벡터. 길이 0~1 */
        this.vector = { x: 0, y: 0 };
        /** 조이스틱이 눌려 있는가 (HUD 렌더용) */
        this.active = false;
        this.origin = { x: 0, y: 0 };
        /**
         * 조이스틱 모드. true = 손가락을 댄 자리에 생긴다(기본, 모바일에서 눈으로 찾을 필요가 없다).
         * false = 좌하단 고정. 손가락이 화면을 가리는 것을 싫어하는 사람이 있어 옵션으로 둔다.
         */
        this.floating = true;
        this.fixedOrigin = { x: 84, y: LOGICAL_HEIGHT - 76 };
        EventBus.on(EVENTS.CMD_SETTINGS, (st) => {
            if (typeof st?.joystickFloating === "boolean") this.floating = st.joystickFloating;
        }, { key: "input:settings" });
        this.knob = { x: 0, y: 0 };
        /** 이번 프레임에 대시가 요청됐는가. consumeDash()로 꺼내 쓴다 */
        this.dashQueued = false;
        /** 조이스틱을 잡고 있는 포인터 id. 멀티터치에서 대시와 섞이지 않게 한다 */
        this.joyPointerId = null;
        this.keys = null;
    }

    /** HudScene에서 1회 호출 */
    attach(scene) {
        this.detach();
        this.scene = scene;

        // 조이스틱 + 대시를 동시에 누를 수 있어야 한다
        scene.input.addPointer(2);

        this.onDown = (p) => this.handleDown(p);
        this.onMove = (p) => this.handleMove(p);
        this.onUp = (p) => this.handleUp(p);
        scene.input.on("pointerdown", this.onDown);
        scene.input.on("pointermove", this.onMove);
        scene.input.on("pointerup", this.onUp);
        scene.input.on("pointerupoutside", this.onUp);

        // 키보드 — 개발 중 PC 브라우저 확인 전용 (정본 3.2)
        this.keys = scene.input.keyboard?.addKeys({
            up: "W", down: "S", left: "A", right: "D",
            aup: "UP", adown: "DOWN", aleft: "LEFT", aright: "RIGHT",
            dash: "SPACE",
        });
    }

    detach() {
        if (!this.scene) return;
        this.scene.input.off("pointerdown", this.onDown);
        this.scene.input.off("pointermove", this.onMove);
        this.scene.input.off("pointerup", this.onUp);
        this.scene.input.off("pointerupoutside", this.onUp);
        this.scene = null;
    }

    inDashButton(p) {
        const h = DASH_BTN.hit / 2;
        // 우측 레터박스까지 확장 — 화면 끝을 눌러도 먹히게 한다(10-UIUX 3.2)
        const px = Math.min(p.x, LOGICAL_WIDTH);
        return Math.abs(px - DASH_BTN.x) <= h && Math.abs(p.y - DASH_BTN.y) <= h;
    }

    handleDown(p) {
        if (this.inDashButton(p)) {
            this.dashQueued = true;
            return;
        }
        if (this.joyPointerId !== null) return;
        // 좌측 절반. x<0(레터박스)도 0으로 클램프해 받는다
        if (p.x > JOY_ZONE_RIGHT || p.y < 0 || p.y > LOGICAL_HEIGHT) return;
        this.joyPointerId = p.id;
        this.active = true;
        // 고정 모드면 손가락 위치와 무관하게 항상 같은 자리를 원점으로 쓴다.
        this.origin.x = this.floating ? Math.max(0, p.x) : this.fixedOrigin.x;
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
        if (p.id !== this.joyPointerId) return;
        this.joyPointerId = null;
        this.active = false;
        this.vector.x = 0;
        this.vector.y = 0;
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
