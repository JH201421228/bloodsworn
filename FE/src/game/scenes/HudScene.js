/**
 * HudScene — 조작 UI(조이스틱·대시)와 60fps HUD.
 *
 * ★ 이 씬이 별도로 존재하는 이유: 60fps로 바뀌는 값은 Zustand에 넣지 않는다(T112).
 *   HP/EXP/타이머는 React 리렌더 없이 여기서 직접 그린다. 06-TECH-DESIGN.md 3.3
 *
 * ★ 화면 폭은 640 고정이 아니다 (config.js 좌표계 주석)
 *   논리 세로만 360 으로 고정이고 가로는 기기 비율을 따라 640~864 로 늘어난다.
 *   그래서 이 씬의 좌표는 세 종류로 나뉜다.
 *     - 좌상단 앵커(HP 바, HP 숫자)     : 상수 그대로 쓴다
 *     - 우측/중앙 앵커(킬 수, 타이머)    : this.scale.width 로 매번 계산한다
 *     - 화면 전체 폭(EXP 바)            : this.scale.width 를 그대로 쓴다
 *   폭이 바뀔 수 있으므로 상수로 굳혀 두면 20:9 기기에서 킬 수가 화면 한가운데 뜬다.
 *   좌표를 다시 잡는 일은 전부 layout(w,h) 한 곳에 모여 있고 resize 로 다시 불린다.
 *
 * ★ HUD 는 이제 도형이 아니라 아트다 — 전부 hud 아틀라스 한 장에서 나온다 (T623).
 *   구조는 셋뿐이다.
 *     1) 프레임(테두리)  : NineSlice. 길이가 제각각이라 가운데 레일만 늘린다
 *     2) 채움/트랙       : bar-fill · px 칩 1장을 tint 로 색만 갈아 쓴다.
 *                          길이는 매 프레임 displayWidth 로만 바꾼다(텍스처 크롭 없음)
 *     3) 조이스틱·대시   : joy-base/joy-knob · btn-normal/btn-pressed
 *   Graphics 는 아틀라스가 통째로 없을 때의 폴백 전용으로만 남았다 —
 *   정상 경로에서는 한 번도 그리지 않는다. HUD 가 배치를 끊는 지점이 0 이라는 뜻이다.
 *
 * ★ 아틀라스 프레임이 하나라도 없으면 그 요소만 예전 도형으로 되돌아간다.
 *   에셋 1장이 빠졌다고 조작 UI 가 통째로 사라지면 안 된다(PreloadScene 의 loaderror 와 같은 원칙).
 *
 * 규격: 10-UIUX-LANDSCAPE.md 5.2(조이스틱 시각) / 4(HUD 좌표)
 *   손가락 가림 최소화 3원칙 — 베이스는 링만, 노브는 작게, 캐릭터는 화면 중앙
 */
import Phaser from "phaser";
import { SCENES, DEPTH } from "../constants";
import { input, JOY_RADIUS, DASH_BTN } from "../systems/InputSystem";

const PARCHMENT = 0xc9b792;
/** 어두운 잉크. 양피지 판 위에 얹는 것은 이 색이다(29·32 §4 외곽선) */
const INK = 0x1a1216;
const CANDLE = 0x35c9b4;

/** HUD 아트 아틀라스 키. public/assets.json 의 atlases 항목과 같아야 한다 */
const ATLAS = "hud";
/** 대시 버튼 아이콘. 없으면 글리프 「≫」 로 떨어진다 (docs/32 §11.1) */
const DASH_ICON = "ui-dash";

/** 우측 끝에서 킬 수까지의 여백. 640 기준 원안(x=632)을 앵커로 환산한 값이다 */
const KILLS_MARGIN_R = 8;
/** HP 바 규격 (09-ART A-13). 좌상단 앵커라 화면 폭과 무관하다 */
const HP_BAR = { x: 16, y: 12, w: 120, h: 10 };
/** EXP 바 높이 (10-UIUX 4.1 H6). 폭은 언제나 화면 전체다 */
const EXP_H = 4;
/** 보스 HP 바 규격 (10-UIUX 4.1 H13). 폭은 고정이고 위치만 화면 중앙을 따라간다 */
const BOSS_BAR = { w: 400, h: 8, y: 30 };
/**
 * 보스 페이즈 눈금 (정본 4.3 / docs/26).
 * "언제 광폭화가 오는가"를 숫자가 아니라 바 위의 위치로 알려준다. 지우면 안 된다.
 */
const PHASE_CUTS = [0.66, 0.33];

/**
 * 대시 버튼 판 크기.
 * ★ 히트박스(InputSystem.DASH_BTN.hit = 72)와 별개다. 그림은 작아도 누르는 영역은
 *   72x72 그대로여야 한다 — 엄지로 누르는 버튼이라 시각 크기에 맞춰 줄이면 헛손질이 난다.
 *   원본 btn-normal 이 96x28 이므로 56x32 는 가로만 살짝 줄인 자연스러운 비율이다.
 */
const DASH_PLATE = { w: 56, h: 32 };

/** NineSlice 캡 — tools/build-ui.mjs 의 [5/5] 실측 출력값이다. 눈대중으로 고치지 마라 */
const CAP_HP = 9;
const CAP_EXP = 6;

/**
 * 고정 모드 조이스틱의 대기 알파 (10-UIUX 5.3 「상시 표시 0.22」).
 * ★ 베이스는 a*0.85 로 그려지므로 0.26 → 0.221 이 되어 정본 값과 맞는다.
 *   이보다 진하면 전투 화면에서 링이 시선을 끌고, 옅으면 어두운 배경에서 안 보인다.
 */
const JOY_IDLE_ALPHA = 0.26;

export default class HudScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENES.HUD, active: false });
    }

    create() {
        this.scene.bringToTop();
        input.attach(this);

        const tex = this.textures.exists(ATLAS) ? this.textures.get(ATLAS) : null;
        const has = (frame) => !!tex && tex.has(frame);

        /** 아틀라스 칩 1장. 색은 tint 로, 길이는 displayWidth 로 준다 */
        const chip = (frame, tint, alpha, depth = DEPTH.HUD) =>
            has(frame)
                ? this.add.image(-999, -999, ATLAS, frame)
                    .setOrigin(0, 0).setDepth(depth).setScrollFactor(0).setTint(tint).setAlpha(alpha)
                : null;
        /** 프레임(테두리). 브래킷은 그대로 두고 가운데 레일만 늘린다 */
        const nine = (frame, w, h, cap) =>
            has(frame)
                ? this.add.nineslice(-999, -999, ATLAS, frame, w, h, cap, cap, 0, 0)
                    .setOrigin(0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0)
                : null;

        // ── 게이지 ─────────────────────────────────────────
        // 트랙 -> 채움 -> 프레임 순으로 겹친다. 깊이를 나눠 두면 폭이 변해도 순서가 안 흔들린다.
        this.hpTrack = chip("px", 0x3a3345, 0.9);
        this.hpFill = chip("bar-fill", 0x8e1220, 1);
        this.hpFrame = nine("bar-hp", HP_BAR.w + 4, HP_BAR.h + 4, CAP_HP);

        this.expTrack = chip("px", 0x16121c, 0.9);
        this.expFill = chip("bar-fill", 0x2fbfa8, 1);
        this.expFrame = nine("bar-exp", this.scale.width, EXP_H + 2, CAP_EXP);

        // T526 보스 HP 바 — 보스전에만 보인다. 통째로 숨기면 되므로 배열로 들고 있는다
        this.bossTrack = chip("px", 0x241e2e, 0.95);
        this.bossFill = chip("bar-fill", 0x8e1220, 0.95);
        // 남은 HP의 앞머리를 밝게 — 400px 바에서 잔량 1%의 변화를 눈으로 잡을 수 있게 한다
        this.bossHead = chip("px", 0xd6203a, 0.95);
        this.bossTicks = PHASE_CUTS.map(() => chip("px", 0x0b0710, 0.8, DEPTH.HUD + 1));
        this.bossFrame = nine("bar-exp", BOSS_BAR.w + 8, BOSS_BAR.h + 6, CAP_EXP);
        this.bossParts = [this.bossTrack, this.bossFill, this.bossHead, ...this.bossTicks, this.bossFrame]
            .filter(Boolean);
        for (const p of this.bossParts) p.setVisible(false);

        // ── 조이스틱 ───────────────────────────────────────
        // 베이스는 링만 있는 그림이다 — 채우면 화면의 5%가 손가락 아래로 사라진다 (5.2 원칙 1)
        // 노브는 작게 — 손가락 밖으로 삐져나오면 시각적 노이즈다 (5.2 원칙 2)
        const joy = (frame, r, depth) =>
            has(frame)
                ? this.add.image(-999, -999, ATLAS, frame)
                    .setDepth(depth).setScrollFactor(0).setDisplaySize(r * 2, r * 2).setVisible(false)
                : null;
        this.joyBase = joy("joy-base", JOY_RADIUS, DEPTH.HUD);
        this.joyKnob = joy("joy-knob", 15, DEPTH.HUD + 1);
        /** 조이스틱 페이드 상태. 릴리즈 150ms / 터치 80ms (5.1). 고정 모드는 0 대신 대기 알파로 수렴한다 */
        this.joyAlpha = 0;

        // ── 대시 버튼 ──────────────────────────────────────
        // ★ 눌림 상태를 두 장으로 만든다. 텍스처를 갈아끼우는 것보다 visible 토글이 싸고,
        //   런 중에 new 를 하지 않는다는 규약도 지킨다.
        const plate = (frame) =>
            has(frame)
                ? this.add.nineslice(-999, -999, ATLAS, frame, DASH_PLATE.w, DASH_PLATE.h, 12, 12, 8, 8)
                    .setDepth(DEPTH.HUD + 1).setScrollFactor(0).setVisible(false)
                : null;
        this.dashUp = plate("btn-normal");
        this.dashDown = plate("btn-pressed");
        /**
         * 쿨다운 덮개 — 판 위를 왼쪽부터 걷어내며 차오른다.
         * ★ 예전에는 반지름 24 의 호(Graphics.arc)였다. 버튼이 원(r=20)이던 시절의 그림이고,
         *   판이 56x32 인 지금은 호가 판을 가로질러 지나가 무엇을 감싼 것인지 안 읽힌다.
         *   덮개로 바꾸면 (1) 사각 버튼과 모양이 맞고 (2) 아틀라스 칩이라 Graphics 가
         *   아예 필요 없어져 HUD 가 배치를 끊는 지점이 사라진다.
         */
        this.dashCool = has("px")
            ? this.add.image(-999, -999, ATLAS, "px")
                .setOrigin(0, 0).setDepth(DEPTH.HUD + 1).setScrollFactor(0)
                .setTint(0x0b0710).setAlpha(0.62).setVisible(false)
            : null;

        // ★ HP/타이머/킬은 60fps로 바뀐다 -> Zustand에 넣지 않고 여기서 직접 그린다 (T112)
        // ★ 깊이를 아트보다 2 위로 둔다. 글자는 캔버스 텍스처라 아틀라스와 배치를 공유할 수 없다 —
        //   아트 사이에 끼면 배치가 셋으로 쪼개진다. 맨 위에 몰아 두면 한 번만 끊긴다.
        const t = (x, y, size, color, origin) =>
            this.add.text(x, y, "", { fontFamily: "monospace", fontSize: size + "px", color })
                .setOrigin(origin ?? 0, 0).setDepth(DEPTH.HUD + 2).setScrollFactor(0);
        this.txtTimer = t(0, 8, 14, "#c9b792", 0.5);
        this.txtKills = t(0, 10, 10, "#9a94a3", 1);
        this.txtHp = t(18, 26, 9, "#c7c2ce", 0);
        /**
         * 대시 버튼 표식 — 판만 있으면 "무슨 버튼인지"를 아무도 모른다.
         *
         * ★ 아트가 있으면 아이콘, 없으면 글리프 「≫」 로 떨어진다 (docs/32 §11.1 · 예비칸 38 ui_dash).
         *   두 갈래가 같은 변수(dashMark)를 쓰므로 아래 layout()·drawDash() 는 어느 쪽인지 모른다 —
         *   assets.json 에서 ui-dash 한 줄을 빼면 글리프로 정확히 되돌아간다. 그것이 롤백 절차다.
         * ★ 배율 1 로 쓴다 — 축소하지 않는다.
         *   docs/32 §11.1 은 "1/2 축소하면 16px"을 예상했지만, 수령본은 32x32 칸 안에 그림이
         *   **22x13** 로 들어와 여백이 크다. 즉 1:1 로 놓아도 화면에 찍히는 표식은 22x13 이고
         *   이것이 판 얼굴(44x20)에 정확히 들어간다. 굳이 0.5 로 줄이면 1px 갈매기 획이
         *   최근접 표본화에 솎여 나가 세 줄이 점 몇 개로 흩어진다(실측 8배 확대에서 확인).
         *   정수배 축소가 안전한 것은 획이 2px 이상일 때 이야기다(docs/32 §2.1 의 전제).
         * ★ 색은 tint 로 준다 — 시트는 양피지색 단색 한 가지로 구워져 있다.
         *   ⚠ 그런데 곱할 색은 양피지색이 **아니다.** docs/32 §11.1 은 "판(어두운 금속) 위에
         *   얹히므로 밝은 양피지색"이라고 적었는데, 실제 `btn-normal` 은 **어두운 금속 테 안에
         *   양피지 판**이다(실측: 판 얼굴 rgb 230,215,178). 그 위에 양피지색을 얹으면 아무것도
         *   안 보인다 — 헤드리스 8배 확대에서 아이콘이 통째로 사라졌다.
         *   그래서 어두운 잉크(29·32 §4 의 외곽선 색)를 곱한다. 같은 이유로 아래 글리프 폴백의
         *   색도 함께 내렸다 — 글리프가 안 보이던 것은 아트가 오기 전부터 있던 문제다.
         */
        this.dashMark = !this.dashUp
            ? null
            : this.textures.exists(DASH_ICON)
                ? this.add.image(-999, -999, DASH_ICON)
                    .setOrigin(0.5, 0.5).setTint(INK)
                    .setDepth(DEPTH.HUD + 2).setScrollFactor(0)
                : this.add.text(-999, -999, "≫", { fontFamily: "monospace", fontSize: "16px", color: "#1a1216" })
                    .setOrigin(0.5, 0.5).setDepth(DEPTH.HUD + 2).setScrollFactor(0);

        /**
         * 남은 Graphics 하나 — 아틀라스가 통째로 없을 때의 폴백 전용이다.
         * ★ 정상 경로에서는 아무것도 그리지 않는다(매 프레임 clear 만 한다).
         *   Graphics 가 한 획이라도 그리면 그 지점에서 배치가 쪼개지므로, 도형이 필요한
         *   마지막 요소였던 대시 쿨다운까지 아틀라스 칩으로 옮겨 여기를 비웠다.
         *   그래도 지우지 않는 이유는 에셋 1장이 빠졌다고 조작 UI 가 사라지면 안 되기 때문이다.
         */
        this.g = this.add.graphics().setDepth(DEPTH.HUD + 2).setScrollFactor(0);

        this.layout(this.scale.width, this.scale.height);
        // 회전·폴더블 펼침으로 논리 폭이 바뀌면 우측/중앙 앵커를 다시 잡는다.
        this.onResize = (size) => this.layout(size.width, size.height);
        this.scale.on("resize", this.onResize);

        this.events.once("shutdown", () => {
            this.scale.off("resize", this.onResize);
            input.detach();
        });
    }

    /**
     * 폭이 바뀔 때만 하는 일을 모아 둔다.
     * ★ update() 안에서 매 프레임 setPosition 하지 않는 이유: 텍스트 위치 변경은
     *   내부적으로 바운드 재계산을 부르고 NineSlice 는 정점을 다시 만든다.
     *   폭은 회전할 때만 바뀌므로 그때만 하면 된다.
     * ★ 매 프레임 바뀌는 것은 채움의 displayWidth 하나뿐이다(drawStats / drawBossBar).
     */
    layout(w, h) {
        this.txtTimer?.setX(Math.round(w / 2));
        this.txtKills?.setX(w - KILLS_MARGIN_R);

        // HP — 좌상단 고정
        this.hpTrack?.setPosition(HP_BAR.x, HP_BAR.y).setDisplaySize(HP_BAR.w, HP_BAR.h);
        this.hpFill?.setPosition(HP_BAR.x, HP_BAR.y).setDisplaySize(HP_BAR.w, HP_BAR.h);
        this.hpFrame?.setPosition(HP_BAR.x - 2, HP_BAR.y - 2);

        // EXP — 화면 최상단 전체 폭. 얇게 깔아 시선을 뺏지 않는다
        // ★ 640 이 아니라 실제 논리 폭이다. 굳히면 20:9 에서 우측 160px 가 비어 보인다.
        this.expTrack?.setPosition(0, 0).setDisplaySize(w, EXP_H);
        this.expFill?.setPosition(0, 0).setDisplaySize(w, EXP_H);
        this.expFrame?.setPosition(0, 0).setSize(w, EXP_H + 2);

        // 보스 — 폭은 고정, 위치만 화면 중앙을 따라간다.
        // ★ 원안의 x=120 은 "640 화면의 중앙"이라는 뜻이었다. 640 에서는 정확히 120 으로 떨어진다.
        const bx = Math.round((w - BOSS_BAR.w) / 2);
        this.bossX = bx;
        this.bossTrack?.setPosition(bx, BOSS_BAR.y).setDisplaySize(BOSS_BAR.w, BOSS_BAR.h);
        this.bossFill?.setPosition(bx, BOSS_BAR.y).setDisplaySize(BOSS_BAR.w, BOSS_BAR.h);
        this.bossHead?.setPosition(bx, BOSS_BAR.y).setDisplaySize(2, BOSS_BAR.h);
        this.bossFrame?.setPosition(bx - 4, BOSS_BAR.y - 3);
        this.bossTicks?.forEach((t, i) =>
            t?.setPosition(Math.round(bx + BOSS_BAR.w * PHASE_CUTS[i]) - 1, BOSS_BAR.y - 1)
                .setDisplaySize(2, BOSS_BAR.h + 2)
        );

        // 대시 버튼 — DASH_BTN 은 InputSystem.layout 이 먼저 갱신한다(attach 가 먼저 구독했다)
        this.dashUp?.setPosition(DASH_BTN.x, DASH_BTN.y);
        this.dashDown?.setPosition(DASH_BTN.x, DASH_BTN.y);
        this.dashMark?.setPosition(DASH_BTN.x, DASH_BTN.y);
        // 덮개는 판 안쪽만 덮는다 — 테두리 장식까지 덮으면 버튼이 사라진 것처럼 보인다
        this.dashCool?.setPosition(DASH_BTN.x - DASH_PLATE.w / 2 + 4, DASH_BTN.y - DASH_PLATE.h / 2 + 5)
            .setDisplaySize(DASH_PLATE.w - 8, DASH_PLATE.h - 10);
        void h;
    }

    update() {
        // Graphics 는 하나뿐이라 프레임 머리에서 한 번만 지운다.
        this.g.clear();
        this.drawJoystick();
        this.drawDash();
        this.drawStats();
        this.drawBossBar();
    }

    drawStats() {
        const gs = this.scene.get(SCENES.GAME);
        const c = gs?.combatSystem;
        const sp = gs?.spawnSystem;
        if (!c || !sp) return;

        const hpRatio = Math.max(0, Math.min(1, c.hp / c.maxHp));
        const w = this.scale.width;
        const need = 5 + c.level * 5;
        const expRatio = Math.max(0, Math.min(1, c.exp / need));

        if (this.hpFill) {
            // ★ 폭만 바꾼다. 텍스처를 크롭하지 않으므로 60fps 경로에 추가 비용이 없다.
            this.hpFill.displayWidth = HP_BAR.w * hpRatio;
            this.hpFill.setVisible(hpRatio > 0);
            this.expFill.displayWidth = w * expRatio;
            this.expFill.setVisible(expRatio > 0);
        } else {
            // 아틀라스가 없을 때의 폴백 — 예전 도형 HUD 그대로다
            const g = this.g;
            g.fillStyle(0x3a3345, 0.9).fillRect(HP_BAR.x, HP_BAR.y, HP_BAR.w, HP_BAR.h);
            g.fillStyle(0x8e1220, 1).fillRect(HP_BAR.x, HP_BAR.y, HP_BAR.w * hpRatio, HP_BAR.h);
            g.lineStyle(1, 0x7b7488, 0.8).strokeRect(HP_BAR.x, HP_BAR.y, HP_BAR.w, HP_BAR.h);
            g.fillStyle(0x16121c, 0.9).fillRect(0, 0, w, EXP_H);
            g.fillStyle(0x2fbfa8, 1).fillRect(0, 0, w * expRatio, EXP_H);
        }

        const m = Math.floor(sp.elapsed / 60);
        const s2 = Math.floor(sp.elapsed % 60);
        this.txtTimer.setText(m + ":" + String(s2).padStart(2, "0"));
        this.txtKills.setText(sp.killCount + " kills");
        this.txtHp.setText(Math.ceil(c.hp) + " / " + c.maxHp);
    }

    drawJoystick() {
        // 릴리즈 시 150ms 페이드 아웃 / 터치 시 80ms 페이드 인 (5.1)
        // ★ 고정 모드는 상시 표시다 (10-UIUX 5.3: 대기 0.22 / 터치 중 진하게).
        //   링이 안 보이면 새 사용자는 어디를 눌러야 하는지 알 방법이 없다 — 고정이 기본값이 된
        //   지금은 더 그렇다. 활성 반경도 링을 중심으로 잡히므로 링 자체가 안내다.
        //   플로팅은 손가락 댄 자리가 원점이라 대기 표시가 의미 없다 → 예전대로 0 으로 사라진다.
        const target = input.active ? 1 : (input.floating ? 0 : JOY_IDLE_ALPHA);
        const step = input.active ? 1 / 5 : 1 / 9; // 약 80ms / 150ms @60fps
        this.joyAlpha = Phaser.Math.Linear(this.joyAlpha, target, step);
        const a = this.joyAlpha;
        if (target === 0 && a < 0.02) {
            // 다 사라졌으면 확실히 숨긴다 — 안 그러면 조이스틱이 화면에 박힌 채 남는다
            this.joyBase?.setVisible(false);
            this.joyKnob?.setVisible(false);
            return;
        }

        const { origin, knob } = input;
        if (this.joyBase) {
            this.joyBase.setPosition(origin.x, origin.y).setAlpha(a * 0.85).setVisible(true);
            this.joyKnob.setPosition(knob.x, knob.y).setAlpha(a).setVisible(true);
            return;
        }

        // 폴백 — 링 + 8방향 눈금 + 노브를 도형으로 그린다
        const g = this.g;
        g.lineStyle(2, PARCHMENT, 0.3 * a);
        g.strokeCircle(origin.x, origin.y, 40);
        g.lineStyle(2, PARCHMENT, 0.15 * a);
        for (let i = 0; i < 8; i++) {
            const ang = (Math.PI / 4) * i;
            const cs = Math.cos(ang), sn = Math.sin(ang);
            g.lineBetween(origin.x + cs * 34, origin.y + sn * 34, origin.x + cs * 38, origin.y + sn * 38);
        }
        g.lineStyle(1, PARCHMENT, 0.2 * a);
        g.lineBetween(origin.x, origin.y, knob.x, knob.y);
        g.fillStyle(CANDLE, 0.55 * a);
        g.fillCircle(knob.x, knob.y, 14);
        g.lineStyle(1, CANDLE, 0.8 * a);
        g.strokeCircle(knob.x, knob.y, 14);
    }

    drawDash() {
        const ps = this.scene.get(SCENES.GAME)?.playerSystem;
        const ready = ps ? ps.dashReady : true;
        const progress = ps ? ps.dashProgress : 1;
        const held = input.dashHeld;

        // 쿨 중에는 흐리게 (10-UIUX 4: 0.45 / 쿨 중 0.25)
        // ★ DASH_BTN.x 는 InputSystem.layout 이 화면 폭에 맞춰 갱신한다. 복사해 두면 안 된다.
        //   위치는 layout() 이 이미 잡았고 여기서는 상태만 바꾼다.
        if (this.dashUp) {
            const alpha = ready ? 0.9 : 0.45;
            this.dashUp.setVisible(!held).setAlpha(alpha);
            this.dashDown.setVisible(held).setAlpha(alpha);
            // 눌린 판은 1px 내려앉는다 — 실제로 눌렸다는 신호가 색 변화만으로는 약하다
            this.dashMark?.setPosition(DASH_BTN.x, DASH_BTN.y + (held ? 1 : 0)).setAlpha(alpha);
            if (this.dashCool) {
                // 왼쪽부터 걷힌다. progress 1 이면 덮개가 없다
                const innerW = DASH_PLATE.w - 8;
                this.dashCool.setVisible(!ready)
                    .setX(DASH_BTN.x - DASH_PLATE.w / 2 + 4 + innerW * progress);
                this.dashCool.displayWidth = innerW * (1 - progress);
            }
        } else {
            const g = this.g;
            g.fillStyle(PARCHMENT, ready ? 0.45 : 0.25);
            g.fillCircle(DASH_BTN.x, DASH_BTN.y, 20);
            g.lineStyle(2, PARCHMENT, ready ? 0.7 : 0.3);
            g.strokeCircle(DASH_BTN.x, DASH_BTN.y, 20);

            // 폴백에서만 링을 그린다 — 도형 버튼은 원(r=20)이라 호가 맞아떨어진다
            if (!ready) {
                g.lineStyle(3, CANDLE, 0.8);
                g.beginPath();
                g.arc(DASH_BTN.x, DASH_BTN.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.strokePath();
            }
        }
    }

    /**
     * T526 보스 HP 바 — 10-UIUX 4.1 H13 (400x8 / 알파 0.95 / 매 프레임 / 보스전에서만).
     *
     * ★ React가 아니라 여기서 직접 그린다.
     *   보스 HP는 60fps로 변한다. Zustand에 넣으면 초당 60회 리렌더가 돌아
     *   보스전이라는 가장 무거운 구간에서 프레임이 깎인다. 이 프로젝트의 확정 규약(T112)이다.
     *   BossSystem은 별도로 200ms 스로틀된 BOSS_HP 이벤트를 쏘지만 그건 React 소비자용이고,
     *   폭을 결정하는 건 아래 displayWidth 한 줄뿐이다.
     *
     * ★ 페이즈 눈금 2개(66% / 33%)는 반드시 남는다.
     *   "언제 광폭화가 오는가"를 숫자가 아니라 바 위의 위치로 알려준다 — 정본 4.3.
     *   지나간 눈금은 금색으로 바꿔 "2페이즈를 넘겼다"를 계속 보여준다.
     */
    drawBossBar() {
        const bs = this.scene.get(SCENES.GAME)?.bossSystem;
        const b = bs?.active ? bs.boss : null;
        // 킬 카운터는 보스전에 무의미하다 (10-UIUX 4.3). 값이 바뀔 때만 건드린다
        if (this.txtKills && this.txtKills.visible === !!b) this.txtKills.setVisible(!b);

        if (!b) {
            if (this.bossParts?.length && this.bossParts[0].visible) {
                for (const p of this.bossParts) p.setVisible(false);
            }
            return;
        }

        const W = BOSS_BAR.w, H = BOSS_BAR.h, Y = BOSS_BAR.y;
        const X = this.bossX ?? Math.round((this.scale.width - W) / 2);
        const ratio = Math.max(0, Math.min(1, b.hp / b.maxHp));
        // 페이즈 전환 무적 중에는 바를 점멸시킨다. "때려도 안 깎이는" 1.2초의 이유를 알려준다
        const blink = bs.invulnerable ? ((this.time.now / 60) % 2 < 1 ? 0.45 : 1) : 1;

        if (!this.bossParts?.length) {
            const g = this.g;
            g.fillStyle(0x241e2e, 0.95 * blink).fillRect(X, Y, W, H);
            g.fillStyle(0x8e1220, 0.95 * blink).fillRect(X, Y, W * ratio, H);
            if (ratio > 0) g.fillStyle(0xd6203a, 0.95 * blink).fillRect(X + W * ratio - 2, Y, 2, H);
            for (const cut of PHASE_CUTS) {
                const passed = ratio <= cut;
                g.fillStyle(passed ? 0xe8b44c : 0x0b0710, (passed ? 0.95 : 0.8) * blink);
                g.fillRect(X + W * cut - 1, Y - 1, 2, H + 2);
            }
            g.lineStyle(1, 0x6e6478, 0.9 * blink).strokeRect(X, Y, W, H);
            return;
        }

        for (const p of this.bossParts) p.setVisible(true);
        this.bossTrack.setAlpha(0.95 * blink);
        this.bossFrame.setAlpha(blink);
        this.bossFill.displayWidth = W * ratio;
        this.bossFill.setVisible(ratio > 0).setAlpha(0.95 * blink);
        this.bossHead.setVisible(ratio > 0).setX(X + W * ratio - 2).setAlpha(0.95 * blink);
        for (let i = 0; i < this.bossTicks.length; i++) {
            const passed = ratio <= PHASE_CUTS[i];
            this.bossTicks[i].setTint(passed ? 0xe8b44c : 0x0b0710).setAlpha((passed ? 0.95 : 0.8) * blink);
        }
    }
}
