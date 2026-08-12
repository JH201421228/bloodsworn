/**
 * loopGuard — Phaser 게임 루프 전체를 감싸는 예외 그물. (F-1)
 *
 * ── 왜 필요한가 (실측) ────────────────────────────────────────────────
 *   React ErrorBoundary 는 렌더 중 예외만 잡는다. 게임 루프는 rAF 콜백이라
 *   React 와 아무 관계가 없다. 그리고 Phaser 의 rAF 는 이렇게 생겼다:
 *
 *       this.step = function step (time) {
 *           _this.callback(time);                       // ← 여기서 던지면
 *           if (_this.isRunning) {
 *               _this.timeOutID = window.requestAnimationFrame(step);   // ← 여기에 못 온다
 *           }
 *       };
 *       (node_modules/phaser/src/dom/RequestAnimationFrame.js)
 *
 *   즉 **다음 프레임 예약이 콜백 뒤에 있다.** 씬의 update 가 한 번만 던져도
 *   rAF 체인이 그 자리에서 끊기고 게임은 영원히 얼어붙는다. 예외는 window 로
 *   빠져나가므로 오류 화면은 뜨지만, 그 뒤의 캔버스는 두 번 다시 움직이지 않는다.
 *
 * ── 대책 ──────────────────────────────────────────────────────────────
 *   TimeStep.callback(= Game.step) 을 try/catch 로 감싼다. 예외가 rAF 콜백 밖으로
 *   나가지 못하므로 **rAF 체인이 살아남는다.** 그래서 「타이틀로 돌아가기」가
 *   실제로 동작할 수 있다(씬만 정리하면 그 다음 런이 정상적으로 돈다).
 *   ★ 씬 하나하나에 try/catch 를 다는 방식은 택하지 않았다. 씬이 5개인 데다,
 *     무엇보다 예외는 update 만이 아니라 렌더·물리·플러그인 어디서든 난다.
 *     루프 콜백은 그 전부가 반드시 지나가는 **단 하나의 길목**이다.
 *
 * ── 반복 예외 ─────────────────────────────────────────────────────────
 *   매 프레임 던지는 코드라면 catch 도 매 프레임 돈다. 그래서 처음 잡은 순간
 *   stepping 을 끊는다(루프는 계속 돌되 Game.step 을 부르지 않는다). 로그는 한 번,
 *   화면도 한 번이다.
 *
 * ★ 이 파일이 ui/error 아래 있는 이유는 소유 경계 때문이다. 내용은 게임 쪽이지만
 *   React 를 하나도 import 하지 않으므로 번들 분리(06 §14.1)를 깨지 않는다.
 */
import { EventBus } from "@/game/EventBus";
import { EVENTS, SCENES } from "@/game/constants";

/** 이번 프레임부터 Game.step 을 부르지 않는다. 「타이틀로 돌아가기」가 다시 false 로 되돌린다. */
let stopped = false;

function stopScenes(game) {
    // ★ 순서: GAME 을 먼저 내린다. HUD/DEBUG 는 GAME 을 참조하므로 반대로 하면
    //   내리는 도중에 또 죽는다.
    //
    // ★★ 멈춘 씬을 resume() 한 뒤 stop() 하지 마라. 실측으로 잡은 함정이다.
    //   ScenePlugin.resume 은 **언제나 queueOp** 다 — 그 자리에서 실행되지 않고
    //   다음 SceneManager 업데이트로 밀린다(scene/ScenePlugin.js 564행).
    //   반면 SceneManager.stop 은 scene.sys.shutdown() 을 **즉시** 부른다(1286행).
    //   그래서 resume -> stop 순으로 쓰면 stop 이 먼저 끝나 상태가 SHUTDOWN 이 됐다가,
    //   한 프레임 뒤 밀려 있던 resume 이 도착해 죽인 씬을 RUNNING 으로 되살린다.
    //   (실측: GameScene 6 -> 8 -> 5. HUD/DEBUG 는 PAUSED 가 아니라 정상적으로 8 로 남았다.)
    //   stop 은 PAUSED 상태에서도 그대로 먹으므로 resume 자체가 애초에 필요 없다.
    for (const key of [SCENES.GAME, SCENES.HUD, SCENES.DEBUG]) {
        try {
            if (!game.scene.getScene(key)) continue;
            game.scene.stop(key);
        } catch (e) {
            console.error("[치명] 씬 정리 실패: " + key, e);
        }
    }
}

/**
 * 부팅 직후 1회. 두 번 불러도 안전하다.
 * ★ 루프가 아직 시작되지 않았어도 상관없다 — 접근자로 걸기 때문에 시점 의존이 없다.
 * @param {object|null} game Phaser.Game
 */
export function installLoopGuard(game) {
    if (!game) return;
    const loop = game.loop;
    if (!loop || loop.__bswGuarded) return;
    loop.__bswGuarded = true;

    /**
     * ★ 왜 loop.callback 을 그냥 덮어쓰지 않고 접근자로 바꾸는가 — 실측으로 잡은 함정이다.
     *
     *   TimeStep 은 생성 시 callback 을 NOOP 으로 채워 둔다(core/TimeStep.js 231행).
     *   즉 「함수가 들어 있다」는 것이 「루프가 시작됐다」를 뜻하지 않는다.
     *   그리고 Phaser 는 READY 를 **Game.start() 보다 먼저** 쏜다. 그래서 부팅 훅에서
     *   단순히 loop.callback 을 감싸면 NOOP 을 감싸게 되고, 곧이어 도착한 start() 의
     *   this.callback = callback 한 줄이 그물을 조용히 걷어낸다.
     *   ★ 이 상태는 「가드가 걸린 것처럼 보이는데 실제로는 안 걸린」 최악의 모양이다.
     *     실측에서 HudScene.update 예외가 그대로 window 로 새어 나가고 rAF 가 멈췄다
     *     (frame 3414 에서 정지, kind 가 "game" 이 아니라 "window" 로 잡혔다).
     *
     *   접근자로 바꾸면 이후 **몇 번을 다시 꽂든** 들어오는 함수는 inner 로 들어가고
     *   TimeStep 이 읽어 가는 것은 언제나 그물이다. 순서 문제 자체가 사라진다.
     */
    let inner = typeof loop.callback === "function" ? loop.callback : null;

    const guarded = function (...args) {
        if (stopped || !inner) return;
        try {
            inner.apply(this, args);
        } catch (e) {
            // ★ 먼저 끊고 나서 보고한다. 보고 도중 다음 프레임이 들어와도 두 번 잡지 않는다.
            stopped = true;
            EventBus.emit(EVENTS.FATAL_ERROR, { kind: "game", error: e, where: "Phaser 루프" });
        }
    };

    Object.defineProperty(loop, "callback", {
        configurable: true,
        enumerable: true,
        get: () => guarded,
        set: (fn) => {
            inner = typeof fn === "function" ? fn : null;
        },
    });

    // 「타이틀로 돌아가기」의 게임 쪽 절반. index.html 의 정적 화면이 직접 부른다.
    // ★ 이 훅이 꽂혀 있다는 것 자체가 「루프가 그물에 감싸여 살아 있다」는 증거이고,
    //   오류 화면은 그것을 보고 소프트 복구 버튼을 보일지 정한다(index.html paint 주석).
    if (typeof window !== "undefined" && window.__BSW_FATAL__) {
        window.__BSW_FATAL__.gameRecover = () => {
            stopScenes(game);
            stopped = false; // 씬을 내렸으니 이제 빈 루프를 다시 돌려도 안전하다
        };
    }
}
