/**
 * StageSelectScreen — 출정지 선택. (6개월 확장 / S-1)
 *
 * ★ 이 화면이 없으면 stages.json 의 스테이지 5종과 StageSystem 의 기믹·웨이브 곡선이
 *   전부 도달 불가능한 코드였다. 플레이어에게는 이 게임이 "맵 하나짜리"로 보인다.
 *
 * ★ 잠긴 칸에 자물쇠만 그리지 않는다.
 *   조건이 없는 자물쇠는 "언젠가 열린다"가 아니라 "막힌 벽"으로 읽힌다. 플레이어는 벽을 보면
 *   시도를 멈춘다. 그래서 unlock 조건을 사람이 읽는 문장으로 풀고, 지금 얼마나 왔는지(1/3)까지
 *   같이 적는다. 목표가 보이면 잠긴 칸이 오히려 다음에 할 일이 된다.
 *
 * ★ 해금 판정은 여기서 다시 구현하지 않는다.
 *   StageSystem.isUnlocked 를 그대로 부른다. 판정이 두 벌이 되면 "화면은 열렸는데 게임은
 *   기본 스테이지로 떨어진다" 같은 어긋남이 생기고, 그건 데이터가 아니라 코드를 고쳐야 낫는다.
 *   여기서 새로 쓰는 것은 **문구뿐**이다.
 *
 * 규격: 레이아웃 10-UIUX-LANDSCAPE.md 2.2 / 3.4(터치 48논리px) / 8.2(한글 최소 크기)
 */
import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { unlockProgress } from "@/state/metaSlice";
import { SCREENS } from "@/state/uiSlice";
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { StageSystem } from "@/game/systems/StageSystem";
import stagesData from "@/data/stages.json";
import bossData from "@/data/boss.json";
import { fmtTime } from "@/ui/screens/screenUtils";
import "@/ui/screens/stageSelect.css";

const STAGES = stagesData.stages ?? [];
const BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const BOSSES = bossData.bosses ?? {};

/**
 * 해금 판정기. StageSystem 은 Phaser 를 import 하지 않는다(constants / EventBus / JSON 뿐)
 * — 그래서 scene 없이 만들어도 isUnlocked 경로는 완전히 동작한다.
 * ★ 모듈 최상단에서 만들지 않고 지연 생성하는 이유: 생성자가 enemies.json 을 훑어
 *   계열 인덱스를 만든다. 타이틀만 보고 끄는 사용자에게까지 그 비용을 물릴 이유가 없다.
 */
let judge = null;
function unlockJudge() {
    if (!judge) judge = new StageSystem(null, {});
    return judge;
}

function bossName(bossId) {
    return BOSSES[bossId]?.name ?? bossData.boss?.name ?? "이름 없는 것";
}

function stageName(id) {
    return BY_ID[id]?.name ?? id;
}

/**
 * unlock 조건 하나 → 사람이 읽는 문장.
 *
 * ★ 문구를 두 벌(full / short)로 만드는 이유: 카드 폭이 논리 110px 남짓이라
 *   "「봉인묘」의 보스 여명의 처형인을 쓰러뜨려라" 를 넣으면 카드가 조건 문장으로 꽉 찬다.
 *   카드에는 짧은 쪽을, 선택 시 하단 띠에는 보스 이름까지 붙은 긴 쪽을 보여준다.
 * ★ progress 를 같이 적는다(1/3). "각성 3회"만 있으면 지금 몇 번인지 확인할 곳이 없다.
 *
 * @param {object} u  stages.json 의 unlock 노드
 * @param {{clears:Record<string,number>, awakenCount:number}} prog
 * @returns {{done:boolean, full:string, short:string}}
 */
function clauseOf(u, prog) {
    switch (u?.type) {
        case "always":
            return { done: true, full: "조건 없이 열려 있다", short: "조건 없음" };

        case "bossDefeated": {
            const n = prog.clears?.[u.stageId] ?? 0;
            const nm = stageName(u.stageId);
            return {
                done: n > 0,
                full: "「" + nm + "」의 보스 " + bossName(BY_ID[u.stageId]?.bossId) + " 처치",
                short: "「" + nm + "」 클리어",
            };
        }

        case "awakenCount": {
            const need = u.n ?? 0;
            const have = prog.awakenCount ?? 0;
            const at = " (" + Math.min(have, need) + "/" + need + ")";
            return {
                done: have >= need,
                full: "각성을 통틀어 " + need + "회 발동" + at,
                short: "각성 " + need + "회" + at,
            };
        }

        case "all":
        case "any": {
            // 중첩 조건. 재귀로 풀어 한 문장으로 잇는다 — 깊이가 늘어도 문구가 비지 않는다.
            const sub = (u.of ?? []).map((x) => clauseOf(x, prog));
            const sep = u.type === "all" ? " 그리고 " : " 또는 ";
            return {
                done: u.type === "all" ? sub.every((c) => c.done) : sub.some((c) => c.done),
                full: sub.map((c) => c.full).join(sep),
                short: sub.map((c) => c.short).join(sep),
            };
        }

        default:
            // ★ 모르는 조건을 "곧 열린다"로 그리면 거짓말이 된다. 모른다고 적는 편이 정직하다.
            //   StageSystem.evalUnlock 도 같은 경우 false 를 돌려주므로 화면과 게임이 일치한다.
            return {
                done: false,
                full: "해석할 수 없는 조건(" + (u?.type ?? "없음") + ")",
                short: "조건 불명",
            };
    }
}

/**
 * unlock 트리 → 화면에 줄 단위로 그릴 목록.
 * all 은 각 항목을 따로 세워 체크리스트로 보여준다 — 어디까지 왔는지가 한눈에 보인다.
 */
function describeUnlock(u, prog) {
    if (!u || u.type === "always") return { mode: "always", items: [] };
    if (u.type === "all" || u.type === "any") {
        return { mode: u.type, items: (u.of ?? []).map((x) => clauseOf(x, prog)) };
    }
    return { mode: "all", items: [clauseOf(u, prog)] };
}

const MODE_LABEL = { all: "아래를 모두 만족하면 열린다", any: "아래 중 하나만 만족하면 열린다" };

/**
 * 카드 1장. 카드 자체가 버튼이다 — 잠긴 카드도 누를 수 있게 둔다.
 * ★ 잠긴 것을 disabled 로 만들면 탭이 아무 반응도 없어 "고장난 화면"으로 읽힌다.
 *   누르면 선택되어 하단 띠에 조건 전문이 뜨고, [출정]만 막힌다.
 */
function StageCard({ st, prog, unlocked, active, onSelect }) {
    const info = describeUnlock(st.unlock, prog);
    const clears = prog.clears?.[st.id] ?? 0;

    const cls =
        "stagesel__card" +
        (active ? " is-active" : "") +
        (unlocked ? "" : " is-locked");

    return (
        <button
            type="button"
            className={cls}
            onClick={() => onSelect(st.id)}
            aria-pressed={active}
            aria-label={
                st.name +
                (unlocked ? " 해금됨" : " 잠김 — " + info.items.map((c) => c.full).join(", "))
            }
        >
            <span className="stagesel__no">{String(st.order ?? 0).padStart(2, "0")}</span>
            <span className="stagesel__name">{st.name}</span>
            <span className="stagesel__sub">{st.subtitle}</span>
            <span className="stagesel__rule" />

            <span className="stagesel__meta">
                <span className="stagesel__kv">
                    <i>길이</i>
                    {fmtTime(st.runSec ?? 0)}
                </span>
                <span className="stagesel__kv">
                    <i>보스</i>
                    {bossName(st.bossId)}
                </span>
                <span className="stagesel__kv">
                    <i>기믹</i>
                    {st.gimmick?.name ?? "없음"}
                </span>
            </span>

            {unlocked ? (
                <span className="stagesel__state">
                    {clears > 0 ? "✔ 클리어 " + clears + "회" : "· 미클리어"}
                </span>
            ) : (
                <span className="stagesel__lock">
                    {info.items.map((c, i) => (
                        <span
                            key={i}
                            className={"stagesel__cond" + (c.done ? " is-done" : "")}
                        >
                            {(c.done ? "✔ " : "🔒 ") + c.short}
                        </span>
                    ))}
                </span>
            )}
        </button>
    );
}

export default function StageSelectScreen() {
    const gold = useStore((s) => s.gold);
    const stats = useStore((s) => s.stats);
    const closeStageSelect = useStore((s) => s.closeStageSelect);
    const setSelectedStage = useStore((s) => s.setSelectedStage);

    // stats 는 스토어에서 참조가 안정적이라(런 종료·성소 구매 때만 교체된다) 메모가 실제로 먹는다.
    const prog = useMemo(() => unlockProgress(stats), [stats]);

    const unlockedIds = useMemo(() => {
        const j = unlockJudge();
        return new Set(STAGES.filter((st) => j.isUnlocked(st.id, prog)).map((st) => st.id));
    }, [prog]);

    /**
     * 처음 열 때의 기본 선택.
     * ★ 매번 1번 스테이지에 커서가 돌아가면, 5번을 반복하는 플레이어는 매 런마다 네 번을 더 누른다.
     *   저장된 선택이 있으면 그것을, 없으면 **가장 멀리 열린 곳**을 잡는다.
     */
    const [pick, setPick] = useState(() => {
        const stored = useStore.getState().selectedStageId;
        if (stored && BY_ID[stored] && stored !== (stagesData.defaultStageId ?? "stage1")) {
            return stored;
        }
        const j = unlockJudge();
        const p = unlockProgress(useStore.getState().stats);
        for (let i = STAGES.length - 1; i >= 0; i--) {
            if (j.isUnlocked(STAGES[i].id, p)) return STAGES[i].id;
        }
        return STAGES[0]?.id ?? null;
    });

    const cur = BY_ID[pick] ?? STAGES[0];
    const curUnlocked = cur ? unlockedIds.has(cur.id) : false;
    const curInfo = cur ? describeUnlock(cur.unlock, prog) : { mode: "always", items: [] };

    const select = (id) => {
        setPick(id);
        setSelectedStage(id);
    };

    /**
     * 출정.
     * ★ bridge.requestStartRun 을 쓰지 않는 이유: 그 함수는 stageId 를 실어 보내지 않는다.
     *   같은 순서(resetRun → PLAYING → CMD_START_RUN)를 그대로 지키고 payload 만 늘렸다.
     * ★ registry 주입은 GameManager 가 한다(보고서의 패치). 여기서 Phaser 를 직접 만지지 않는다 —
     *   React 가 Phaser 를 import 하는 순간 번들 분리(06-TECH 14.1)가 깨진다.
     */
    const start = () => {
        if (!cur || !curUnlocked) return;
        const s = useStore.getState();
        s.setSelectedStage(cur.id);
        s.resetRun();
        s.setScreen(SCREENS.PLAYING); // setScreen 이 stageSelect 도 함께 닫는다
        EventBus.emit(EVENTS.CMD_START_RUN, {
            stageId: cur.id,
            meta: { upgrades: { ...s.upgrades } },
        });
    };

    return (
        <div className="screen stagesel">
            <div className="topbar">
                <button className="btn btn--ghost btn--sm" onClick={closeStageSelect}>
                    ◀ 뒤로
                </button>
                <h2 className="topbar__title">✦ 출 정 지</h2>
                <span className="topbar__gold">⬤ {gold.toLocaleString("ko-KR")}</span>
            </div>

            {/* 5장을 flex:1 로 나눠 갖는다 — 가로 화면에서 세로 스크롤은 엄지 이동이 길고 오조작이 많다 */}
            <div className="stagesel__row">
                {STAGES.map((st) => (
                    <StageCard
                        key={st.id}
                        st={st}
                        prog={prog}
                        unlocked={unlockedIds.has(st.id)}
                        active={cur?.id === st.id}
                        onSelect={select}
                    />
                ))}
            </div>

            <div className="stagesel__foot">
                <div className="stagesel__brief" aria-live="polite">
                    {!cur ? (
                        <span className="stagesel__warn">스테이지 데이터가 비어 있다</span>
                    ) : curUnlocked ? (
                        /* 카드에서 잘려 나간 정보(보스 전체 이름·보상)를 여기서 완성한다.
                           .stagesel__brief 가 세로 flex 라 직계 자식 하나가 한 줄이다. */
                        <>
                            <span>
                                <b>{cur.name}</b>
                                <span className="stagesel__dim">{" · " + cur.subtitle}</span>
                            </span>
                            <span className="stagesel__dim">
                                {"보스 " + bossName(cur.bossId) +
                                    " · " + fmtTime(cur.runSec ?? 0) +
                                    " · 기믹 " + (cur.gimmick?.name ?? "없음") +
                                    " · 클리어 보상 ⬤ " + (cur.goldOnClear ?? 0)}
                            </span>
                        </>
                    ) : (
                        <>
                            <span>
                                <b className="stagesel__warn">🔒 {cur.name}</b>
                                <span className="stagesel__dim">
                                    {" — " +
                                        (curInfo.items.length > 1
                                            ? MODE_LABEL[curInfo.mode] ?? "조건을 만족하면 열린다"
                                            : "아래 조건을 만족하면 열린다")}
                                </span>
                            </span>
                            {curInfo.items.map((c, i) => (
                                <span
                                    key={i}
                                    className={
                                        "stagesel__condline" + (c.done ? " is-done" : "")
                                    }
                                >
                                    {(c.done ? "✔ " : "· ") + c.full}
                                </span>
                            ))}
                        </>
                    )}
                </div>

                <button
                    className="btn btn--primary stagesel__go"
                    onClick={start}
                    disabled={!curUnlocked}
                >
                    ▶ 출 정
                </button>
            </div>
        </div>
    );
}
