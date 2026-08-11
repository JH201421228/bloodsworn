/**
 * OptionsScreen — 옵션. (Day 6 / T603)
 *
 * 규격: 10-UIUX-LANDSCAPE.md 2.10 · 항목은 정본 03-GDD-CORE 13
 * ★ 타이틀에서도 일시정지에서도 **같은 컴포넌트**를 modal 로 띄운다. 닫으면 원래 자리로 돌아간다.
 * ★ 값 변경은 즉시 반영 + 즉시 저장. 확인 버튼을 두지 않는다 —
 *   "적용"을 누르지 않아 설정이 안 먹었다는 문의가 가장 흔한 옵션 화면 사고다.
 */
import { useStore, persistSave, wipeSave } from "@/state/store";
import { APP_VERSION, BUILD_DATE } from "@/ui/screens/screenUtils";
import { SAVE_VERSION } from "@/save/save";

function StepVolume({ label, value, onChange }) {
    const pct = Math.round(value * 100);
    const step = (d) => onChange(Math.min(1, Math.max(0, Math.round((value + d) * 10) / 10)));
    return (
        <div className="row">
            <span className="row__label">{label}</span>
            {/* ★ 드래그 슬라이더가 아니라 10% 스텝 버튼이다. 가로 화면 드래그는 오조작이 많고
                히트박스 48px 를 확보하기도 어렵다(10-UIUX 2.10). */}
            <button className="step" onClick={() => step(-0.1)} aria-label={label + " 낮추기"}>
                ◀
            </button>
            <div className="meter">
                <div className="meter__fill" style={{ width: pct + "%" }} />
            </div>
            <button className="step" onClick={() => step(0.1)} aria-label={label + " 높이기"}>
                ▶
            </button>
            <span className="row__value">{pct}%</span>
        </div>
    );
}

function Toggle({ label, value, onChange, on = "ON", off = "OFF" }) {
    return (
        <div className="row">
            <span className="row__label">{label}</span>
            <div className="toggle">
                <button className={value ? "is-on" : ""} onClick={() => onChange(true)}>
                    {on}
                </button>
                <button className={!value ? "is-on" : ""} onClick={() => onChange(false)}>
                    {off}
                </button>
            </div>
        </div>
    );
}

export default function OptionsScreen({ onClose }) {
    const settings = useStore((s) => s.settings);
    const setSetting = useStore((s) => s.setSetting);
    const openConfirm = useStore((s) => s.openConfirm);
    const closeConfirm = useStore((s) => s.closeConfirm);
    const gold = useStore((s) => s.gold);

    const set = (patch) => {
        setSetting(patch);
        persistSave(); // 저장 시점 3곳 중 하나(08-DATA-SCHEMA 4.1)
    };

    const askWipe = () =>
        openConfirm({
            title: "저장 데이터를 삭제할까",
            body: "골드·성소 강화·각성 도감이 전부 사라진다. 되돌릴 수 없다.",
            confirmLabel: "삭제한다",
            danger: true,
            onConfirm: () => {
                closeConfirm();
                wipeSave();
            },
        });

    return (
        <div className="screen options">
            <div className="topbar">
                <button className="btn btn--ghost btn--sm" onClick={onClose}>
                    ◀ 닫기
                </button>
                <h2 className="topbar__title">⚙ 옵 션</h2>
            </div>

            <div className="options__grid">
                <section className="panel">
                    <h3 className="panel__title">사 운 드</h3>
                    <StepVolume
                        label="BGM"
                        value={settings.bgmVolume}
                        onChange={(v) => set({ bgmVolume: v })}
                    />
                    <StepVolume
                        label="SFX"
                        value={settings.sfxVolume}
                        onChange={(v) => set({ sfxVolume: v })}
                    />
                </section>

                {/* ★ 「조작」1줄 + 「화면/접근성」3줄 이던 것을 2줄씩으로 다시 나눴다.
                    가로 화면의 세로 예산으로는 한 패널에 44논리px 줄이 두 개까지만 들어간다.
                    3줄짜리 패널 하나 때문에 아래 행 전체가 화면 밖으로 밀려 있었다(screens.css 주석).
                    저사양 모드는 접근성이 아니라 성능 설정이라 「조작」쪽에 붙여 제목을 「조작 / 성능」으로 고쳤다. */}
                <section className="panel">
                    <h3 className="panel__title">조 작 / 성 능</h3>
                    <Toggle
                        label="조이스틱"
                        value={settings.joystickFloating}
                        onChange={(v) => set({ joystickFloating: v })}
                        on="플로팅"
                        off="고정"
                    />
                    <Toggle
                        label="저사양 모드"
                        value={settings.lowQuality}
                        onChange={(v) => set({ lowQuality: v })}
                    />
                </section>

                <section className="panel">
                    <h3 className="panel__title">접 근 성</h3>
                    {/* 화면 흔들림 OFF 는 취향이 아니라 접근성이다 — 모바일 멀미 대응(10-UIUX 9.2) */}
                    <Toggle
                        label="화면 흔들림"
                        value={settings.screenShake}
                        onChange={(v) => set({ screenShake: v })}
                    />
                    <Toggle
                        label="데미지 숫자"
                        value={settings.damageNumbers}
                        onChange={(v) => set({ damageNumbers: v })}
                    />
                </section>

                <section className="panel">
                    <h3 className="panel__title">데 이 터</h3>
                    <button className="btn btn--danger btn--sm" onClick={askWipe}>
                        ✖ 저장 데이터 삭제
                    </button>
                    <div className="options__meta">
                        빌드 v{APP_VERSION} ({BUILD_DATE})
                        <br />
                        세이브 v{SAVE_VERSION} · {gold.toLocaleString("ko-KR")} 골드
                    </div>
                </section>
            </div>
        </div>
    );
}
