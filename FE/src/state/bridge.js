/**
 * bridge — EventBus의 P→R 이벤트를 스토어에 연결하는 **단일 지점**.
 *
 * 규격 출처: 06-TECH-DESIGN.md 3.4 / 3.6
 *
 * ★ 왜 한 파일에 모으는가
 *   구독이 컴포넌트마다 흩어지면 "이 값이 어디서 바뀌는가"를 추적할 수 없고,
 *   StrictMode 이중 마운트에서 어디가 두 번 등록됐는지 찾을 수 없다.
 *
 * ★ T107b — 모든 구독에 key를 준다.
 *   EventBus.on()은 key가 같으면 기존 핸들러를 교체하므로, 몇 번 호출되어도 핸들러는 1개다.
 *   이게 없으면 StrictMode에서 PACT 축복이 2번 적용되어 밸런스가 조용히 오염된다.
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS } from "@/game/constants";
import { onRunStart } from "@/monetization";
import { track, flush, ANALYTICS_EVENTS as A } from "@/analytics";
import { useStore, persistSave } from "./store";
import { SCREENS } from "./uiSlice";

let installed = false;

/** 패배가 아닌 종료 사유. 이 목록에 없으면 전부 패배로 그린다(모르는 사유를 승리로 오인하지 않는다). */
export const WIN_REASONS = ["clear", "boss", "victory", "win"];

export function isWin(reason) {
    return WIN_REASONS.includes(reason);
}

/**
 * 앱 부팅 시 1회 호출. 두 번 불러도 안전하다.
 * @returns {() => void} 해제 함수 (테스트/HMR용)
 */
export function installBridge() {
    const s = () => useStore.getState();
    const offs = [];
    const sub = (event, fn, key) => offs.push(EventBus.on(event, fn, { key }));

    sub(
        EVENTS.ASSET_PROGRESS,
        (p) => {
            const progress = p?.progress ?? 0;
            s().setLoadProgress(progress);
            // 로드가 끝나면 로딩 화면에서 빠져나온다.
            // 이게 없으면 GameScene이 떠 있는데도 로딩 오버레이가 화면을 덮은 채 남는다.
            if (progress >= 1 && s().screen === SCREENS.LOADING) s().setScreen(SCREENS.TITLE);
        },
        "bridge:progress"
    );

    sub(
        EVENTS.BOOT_READY,
        () => {
            // 로딩 화면이 이미 떠 있으므로 화면 전환은 하지 않는다.
        },
        "bridge:boot"
    );

    sub(EVENTS.RUN_STARTED, (p) => {
        onRunStart();  // 런 스코프 광고 상한 리셋 + 프리로드
        track(A.RUN_START, { stage_id: p?.stageId ?? "stage1" });
        // rerollLeft는 성소 업그레이드로 늘어날 수 있으므로 Phaser가 계산해 실어 보낸다.
        s().resetRun(p?.rerollLeft);
        s().setScreen(SCREENS.PLAYING);
        s().bumpStats({ runs: 1 });
    }, "bridge:run-started");

    // M-1 부활 제안. Phaser 가 씬을 멈추고 답을 기다린다(8초 타임아웃 있음).
    // ★ 이 두 줄은 원래 아래 RUN_LEVELUP 핸들러 **안**에 중첩돼 있었다. 그래서 구독이
    //   "첫 레벨업이 일어난 뒤"에야 걸렸고, 레벨 1에서 죽으면 부활 오버레이가 영원히
    //   안 떴다. EventBus 의 key 옵션이 중복 등록만 막아 줄 뿐 이 문제는 못 막는다.
    //   구독은 반드시 최상위에서 1회 등록한다.
    sub(EVENTS.REVIVE_OFFER, (p) => s().openRevive(p ?? {}), "bridge:revive-offer");

    // 결정이 나면 오버레이를 닫는다. 수락이면 RUN_RESUMED, 거절이면 RUN_ENDED 가 뒤따른다.
    sub(EVENTS.RUN_RESUMED, () => s().closeRevive(), "bridge:revive-close");

    sub(EVENTS.RUN_LEVELUP, (p) => {
        // 리롤 응답도 같은 이벤트로 온다(GameScene 패치). 카드를 새로 열고 남은 횟수를 맞춘다.
        if (typeof p?.rerollLeft === "number") s().setRerollLeft(p.rerollLeft);
        if (typeof p?.humanity === "number") s().setHumanity(p.humanity);
        s().openPact(p ?? {});
        s().bumpStats({ sumLevelUpCount: 1 });
    }, "bridge:levelup");

    sub(EVENTS.PACT_APPLIED, (p) => {
        s().applyPactResult(p);
        s().closePact();
    }, "bridge:pact-applied");

    // T511 — 인간성 0. Phaser가 별도로 쏘지 않아도 PACT_APPLIED 에서 파생되지만,
    // 각성 상한 초과 페널티(−20)처럼 카드 밖에서 깎이는 경로가 있어 전용 이벤트도 받는다.
    sub(EVENTS.HUMANITY_ZERO, () => s().setAscended(), "bridge:humanity-zero");

    sub(EVENTS.AWAKENING_TRIGGERED, (a) => {
        s().pushAwakening(a);
        s().showAwakening(a);
        if (a?.awakeningId) s().addCodex(a.awakeningId);
        s().bumpStats({ totalAwakenings: 1 });
        // 도감은 영구 진행도다. 런이 끝나기 전에 앱이 죽어도 남아야 한다.
        persistSave();
    }, "bridge:awakening");

    // 룬 조망. 룬을 새기거나 무기 레벨이 바뀔 때만 온다 — 일시정지 화면이 이걸 그린다(31 §6.2).
    sub(EVENTS.RUNES_CHANGED, (p) => s().setRunes(p?.weapons ?? []), "bridge:runes");

    // 「눈먼 예언자」가 리롤을 +1 한다(30 §3.3). 카드 미리보기 자체는 ui/encounter 가
    // 자기 스토어로 받는다 — 여기서는 전역 값인 rerollLeft 만 맞춘다.
    sub(EVENTS.SEER_PREVIEW, (p) => {
        if (typeof p?.rerollLeft === "number") s().setRerollLeft(p.rerollLeft);
    }, "bridge:seer-preview");

    sub(EVENTS.BOSS_HP, (hp) => s().setBossHp(hp), "bridge:boss-hp");

    sub(EVENTS.RUN_ENDED, (result) => {

        s().closeRevive();
        // T232 텔레메트리 — 밸런스를 "느낌"이 아니라 숫자로 조정하기 위한 유일한 수단
        console.log("[텔레메트리] 런 종료", JSON.stringify(result));
        const win = isWin(result?.reason);
        s().setResult(result);
        if (typeof result?.gold === "number") s().addGold(result.gold);

        // 08-DATA-SCHEMA 4.3 stats. 평균은 나중에 나눗셈으로 얻으므로 합계만 쌓는다.
        s().bumpStats({
            clears: win ? 1 : 0,
            deaths: result?.reason === "death" ? 1 : 0,
            totalKills: result?.kills ?? 0,
            sumDeathTime: result?.reason === "death" ? (result?.time ?? 0) : 0,
            sumFinalLevel: result?.level ?? 0,
            sumFinalHumanity: result?.humanity ?? 0,
            sumGoldEarned: result?.gold ?? 0,
        });
        s().setStatMax("bestTimeSec", result?.time ?? 0);
        if (win) s().unlock("stage2"); // 정본 03-GDD-CORE 9.2 — 보스 처치로 스테이지2 해금
        // 스테이지 클리어 기록 — 해금 판정(StageSystem.isUnlocked)이 이 값을 읽는다.
        // ★ 구독은 여기 한 곳에만 둔다. 화면 컴포넌트에도 걸면 클리어가 2회씩 쌓여
        //   해금은 멀쩡한데(>0 판정) 통계만 조용히 거짓이 된다.
        if (win) s().recordStageClear(result?.stageId ?? s().selectedStageId);

        s().setScreen(SCREENS.RESULT);
        // 저장 시점 3곳 중 하나(08-DATA-SCHEMA 4.1). 런 중에는 절대 쓰지 않는다.
        persistSave();
        track(A.RUN_END, {
            reason: result?.reason ?? "", duration_s: result?.time ?? 0,
            level: result?.level ?? 0, kills: result?.kills ?? 0,
            gold: result?.gold ?? 0, humanity: result?.humanity ?? 0,
            stage_id: result?.stageId ?? "",
            // ★ 배열은 sanitize 가 버린다. 개수로 보낸다.
            awakenings: (result?.awakenings ?? []).length,
        });
        flush();
    }, "bridge:run-ended");

    sub(EVENTS.RUN_PAUSED, () => s().setModal("pause"), "bridge:paused");
    sub(EVENTS.RUN_RESUMED, () => s().setModal(null), "bridge:resumed");

    sub(EVENTS.FATAL_ERROR, (e) => {
        console.error("[bridge] 게임에서 치명적 오류가 보고됐다", e);
    }, "bridge:fatal");

    installed = true;
    return () => {
        offs.forEach((off) => off());
        installed = false;
    };
}

export function isBridgeInstalled() {
    return installed;
}

/**
 * 런 시작 요청. 타이틀·성소·결과 화면이 모두 이걸 부른다.
 *
 * ★ location.reload() 를 쓰지 않는 이유(T531): 리로드는 Phaser 재부팅 + 에셋 재파싱이라
 *   실기기에서 3~5초가 걸린다. 정본 03-GDD-CORE 12의 "재시작 3초" 규칙을 지킬 수 없다.
 * ★ 화면을 낙관적으로 PLAYING 으로 넘긴다. Phaser 쪽 CMD_START_RUN 핸들러(보고서의 패치)가
 *   들어오면 RUN_STARTED 가 되돌아와 같은 상태로 다시 정착하므로 멱등이다.
 */
export function requestStartRun() {
    const s = useStore.getState();
    s.resetRun();
    s.setScreen(SCREENS.PLAYING);
    EventBus.emit(EVENTS.CMD_START_RUN, { meta: { upgrades: { ...s.upgrades } } });
}
