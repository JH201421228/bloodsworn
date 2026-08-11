/**
 * UiLayer — 캔버스 위 오버레이 루트. 화면(screen)과 오버레이(modal)를 여기서 한 번에 배치한다.
 *
 * 규격: 화면 상태 머신 10-UIUX-LANDSCAPE.md 10.4 · 세이프 인셋 계약 3.3.3
 *
 * ★ 화면은 라우터가 아니라 uiSlice.screen 이 결정한다. Phaser 캔버스는 절대 언마운트하지 않고
 *   그 위에 오버레이를 얹기만 한다 — 화면 전환마다 WebGL 컨텍스트를 다시 만들면 실기기에서 수 초가 든다.
 * ★ 전면 화면은 .ui-screen(스테이지 크기 + 세이프 인셋), PACT 는 .ui-stage(스테이지 크기, 패딩 없음).
 *   PACT 에 패딩을 주면 카드 좌표가 Phaser 와 어긋난다(index.css 주석 참조).
 */
import { useStore } from "@/state/store";
import { SCREENS, MODALS } from "@/state/uiSlice";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import PactOverlay from "@/ui/pact/PactOverlay";
import ReviveOverlay from "@/ui/revive/ReviveOverlay";
import AwakeningBanner from "@/ui/awakening/AwakeningBanner";
import HumanityHearts from "@/ui/hud/HumanityHearts";
import EquipSlots from "@/ui/inventory/EquipSlots";
import ItemToasts from "@/ui/inventory/ItemToasts";
import TitleScreen from "@/ui/screens/TitleScreen";
import SanctumScreen from "@/ui/screens/SanctumScreen";
import OptionsScreen from "@/ui/screens/OptionsScreen";
import CreditsScreen from "@/ui/screens/CreditsScreen";
import ResultScreen from "@/ui/screens/ResultScreen";
import "@/ui/screens/screens.css";

/** 일시정지 (10-UIUX 2.7). 「계속」이 최상단인 이유: 가장 자주 누르는 버튼이다. */
function PauseOverlay({ onClose }) {
    const humanity = useStore((s) => s.humanity);
    const ascended = useStore((s) => s.ascended);
    const level = useStore((s) => s.level);
    const rerollLeft = useStore((s) => s.rerollLeft);
    const awakenings = useStore((s) => s.awakenings);
    const setModal = useStore((s) => s.setModal);
    const openConfirm = useStore((s) => s.openConfirm);
    const closeConfirm = useStore((s) => s.closeConfirm);

    const abandon = () =>
        openConfirm({
            title: "런을 포기할까",
            body: "지금까지 모은 골드는 그대로 받는다.",
            confirmLabel: "포기한다",
            danger: true,
            onConfirm: () => {
                closeConfirm();
                EventBus.emit(EVENTS.CMD_ABANDON);
            },
        });

    return (
        <div className="screen pause">
            <div className="pause__menu">
                <button className="btn btn--primary" onClick={onClose}>
                    ▶ 계 속
                </button>
                <button className="btn" onClick={() => setModal(MODALS.OPTIONS)}>
                    ⚙ 옵 션
                </button>
                <button className="btn btn--danger" onClick={abandon}>
                    ✖ 포 기
                </button>
            </div>
            {/* 이 게임에서 빌드 전체를 조망하는 유일한 화면이다. 별도 인벤토리 화면을 만들지 않는다. */}
            <div className="pause__info">
                <div className="stat-row">
                    <span className="stat-row__k">레벨</span>
                    <span className="stat-row__v">Lv.{level}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-row__k">인간성</span>
                    <span className="stat-row__v">
                        <HumanityHearts value={humanity} ascended={ascended} />
                    </span>
                </div>
                <div className="stat-row">
                    <span className="stat-row__k">각성 / 리롤</span>
                    <span className="stat-row__v">
                        {awakenings.length} / 2 · 리롤 {rerollLeft}
                    </span>
                </div>
            </div>
        </div>
    );
}

/** 되돌릴 수 없는 조작 전용. 남발하면 아무도 안 읽는다. */
function ConfirmDialog() {
    const c = useStore((s) => s.confirm);
    const closeConfirm = useStore((s) => s.closeConfirm);
    if (!c) return null;
    return (
        <div className="confirm">
            <h3 className="confirm__title">{c.title}</h3>
            <p className="confirm__body">{c.body}</p>
            <div className="confirm__actions">
                <button className="btn btn--ghost btn--sm" onClick={closeConfirm}>
                    취소
                </button>
                <button
                    className={"btn btn--sm" + (c.danger ? " btn--danger" : "")}
                    onClick={c.onConfirm}
                >
                    {c.confirmLabel ?? "확인"}
                </button>
            </div>
        </div>
    );
}

export default function UiLayer() {
    const screen = useStore((s) => s.screen);
    const modal = useStore((s) => s.modal);
    const loadProgress = useStore((s) => s.loadProgress);
    const humanity = useStore((s) => s.humanity);
    const ascended = useStore((s) => s.ascended);
    const setModal = useStore((s) => s.setModal);

    const playing = screen === SCREENS.PLAYING;

    /** 옵션/크레딧을 닫으면 원래 있던 자리로 돌아간다. 일시정지 위에서 열었으면 일시정지로. */
    const closeOverlay = () => setModal(playing ? MODALS.PAUSE : null);

    const resume = () => {
        EventBus.emit(EVENTS.CMD_RESUME);
        setModal(null);
    };

    return (
        <div className="ui-layer">
            {/* PACT 는 항상 최우선. 게임이 멈춰 있으므로 다른 오버레이와 겹칠 일이 없다. */}
            <PactOverlay />

            <ReviveOverlay />
            {/* 각성 배너는 자체적으로 표시/해제를 관리한다. 여기서는 마운트만 해 준다(T422). */}
            <AwakeningBanner />

            {screen === SCREENS.LOADING && (
                <div className="ui-loading">
                    <p className="ui-loading__label">봉인을 여는 중</p>
                    <div className="ui-loading__bar">
                        <div
                            className="ui-loading__fill"
                            style={{ width: `${Math.round(loadProgress * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* T510 — 인간성 심장. 레벨업 때만 바뀌므로 React 오버레이가 맞다(HudScene 은 60fps 값 전담) */}
            {playing && !modal && (
                <div className="ui-stage">
                    <div className="hud-humanity">
                        <HumanityHearts value={humanity} ascended={ascended} />
                    </div>
                    {/* 장착 3슬롯 + 유물(상시) / 획득 토스트.
                        둘 다 pointer-events:none 이라 조작을 하나도 늘리지 않는다.
                        ★ .ui-stage 안이어야 한다 — .ui-layer 에 넣으면 --u 기준 절대좌표가
                        Phaser 캔버스와 어긋난다. */}
                    <EquipSlots />
                    <ItemToasts />
                </div>
            )}

            {screen === SCREENS.TITLE && (
                <>
                    <div className="ui-scrim" />
                    <div className="ui-screen">
                        <TitleScreen />
                    </div>
                </>
            )}

            {screen === SCREENS.SANCTUM && (
                <>
                    <div className="ui-scrim" />
                    <div className="ui-screen">
                        <SanctumScreen />
                    </div>
                </>
            )}

            {screen === SCREENS.RESULT && (
                <>
                    <div className="ui-scrim ui-scrim--dim" />
                    <div className="ui-screen">
                        <ResultScreen />
                    </div>
                </>
            )}

            {modal === MODALS.PAUSE && (
                <>
                    <div className="ui-scrim ui-scrim--dim" />
                    <div className="ui-screen">
                        <PauseOverlay onClose={resume} />
                    </div>
                </>
            )}

            {modal === MODALS.OPTIONS && (
                <>
                    <div className="ui-scrim" />
                    <div className="ui-screen">
                        <OptionsScreen onClose={closeOverlay} />
                    </div>
                </>
            )}

            {modal === MODALS.CREDITS && (
                <>
                    <div className="ui-scrim" />
                    <div className="ui-screen">
                        <CreditsScreen onClose={closeOverlay} />
                    </div>
                </>
            )}

            {modal === MODALS.CONFIRM && (
                <>
                    <div className="ui-scrim ui-scrim--dim" />
                    <div className="ui-screen">
                        <ConfirmDialog />
                    </div>
                </>
            )}
        </div>
    );
}
