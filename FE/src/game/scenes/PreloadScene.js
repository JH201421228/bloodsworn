/**
 * PreloadScene — 매니페스트 기반 전 에셋 로드.
 *
 * 규격 출처: 06-TECH-DESIGN.md 8.4 / T113 / T114
 *
 * ★ 하드코딩하지 않고 assets.json을 읽는 이유(T114)
 *   블록 B의 에셋 파이프라인 작업이 이 파일을 건드리지 않고 매니페스트만 고치면 끝나게 하기 위해서다.
 *   에셋이 늘 때마다 씬 코드를 고치면 충돌 지점이 늘어난다.
 *
 * ★ 로딩바를 여기서 그리지 않는 이유 (로딩바가 2개로 보이던 버그)
 *   예전에는 이 씬이 캔버스에 진행바를 직접 그렸고, React 의 UiLayer 도 같은 진행률로
 *   `.ui-loading` 바를 그렸다. 둘은 같은 값을 두 군데에 그린 것이라 화면에는 로딩바가 2개였다.
 *   남긴 쪽은 **React** 다. 근거는 세 가지다.
 *     1) Phaser 게임 인스턴스가 만들어지기 전(모듈 로드 ~ Boot) 구간은 캔버스가 아예 없다.
 *        그 공백을 덮을 수 있는 건 React 뿐이고, 캔버스 바를 남기면 로딩이 "늦게 시작"돼 보인다.
 *     2) 진행률의 정확도는 잃지 않는다 — 아래 EVENTS.ASSET_PROGRESS 가 실제 로더 진행률을
 *        그대로 스토어(setLoadProgress)로 넘긴다. 그리는 위치만 옮겼을 뿐 출처는 여기 그대로다.
 *     3) 폰트가 이미 로드돼 있고 9-slice 프레임(bar-hp-frame.png)을 입힐 수 있어 아트가 붙는다.
 *        캔버스 쪽은 로드 전이라 monospace 폴백으로 그릴 수밖에 없었다.
 */
import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { EVENTS, SCENES } from "../constants";
import { registerAnims } from "../anims/registerAnims";

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super(SCENES.PRELOAD);
    }

    preload() {
        // ★ 진행률의 출처는 여전히 여기다. 화면에 그리는 일만 React 가 맡는다.
        this.load.on("progress", (p) => {
            EventBus.emit(EVENTS.ASSET_PROGRESS, { progress: p, file: "" });
        });

        this.load.on("loaderror", (file) => {
            // 에셋 1개가 없다고 게임 전체를 죽이지 않는다. 무엇이 빠졌는지만 남긴다.
            console.warn(`[PreloadScene] 로드 실패: ${file?.key} (${file?.url})`);
        });

        this.queueFromManifest(this.cache.json.get("manifest"));
    }

    /** 매니페스트를 Phaser 로더 호출로 변환한다. 형식은 FE/public/assets.json 참조. */
    queueFromManifest(manifest) {
        if (!manifest) {
            console.warn("[PreloadScene] 매니페스트가 비어 있다. 로드할 에셋이 없다.");
            return;
        }

        for (const e of manifest.images ?? []) {
            this.load.image(e.key, e.url);
        }
        for (const e of manifest.spritesheets ?? []) {
            this.load.spritesheet(e.key, e.url, {
                frameWidth: e.frameWidth,
                frameHeight: e.frameHeight,
                margin: e.margin ?? 0,
                spacing: e.spacing ?? 0,
            });
        }
        for (const e of manifest.atlases ?? []) {
            this.load.atlas(e.key, e.texture, e.data);
        }
        for (const e of manifest.json ?? []) {
            this.load.json(e.key, e.url);
        }
        for (const e of manifest.tilemaps ?? []) {
            this.load.tilemapTiledJSON(e.key, e.url);
        }
        for (const e of manifest.bitmapFonts ?? []) {
            this.load.bitmapFont(e.key, e.texture, e.data);
        }
        for (const e of manifest.audio ?? []) {
            this.load.audio(e.key, e.urls);
        }
    }

    create() {
        const anims = registerAnims(this);
        console.log("[Preload] 애니메이션 " + anims.created + "개 등록" + (anims.skipped.length ? " / " + anims.skipped.length + "개 건너뜀" : ""));

        // ★ 완료 신호를 명시적으로 한 번 더 쏜다. 절대 지우지 마라.
        //   Phaser의 progress 이벤트는 로드 대상이 0개면 아예 발화하지 않는다.
        //   그 경우 React 로딩 오버레이가 영원히 남는다(실제로 겪은 버그).
        //   로딩바를 React 한쪽만 남긴 지금은 이 신호가 로딩 화면을 끝내는 **유일한** 경로다.
        EventBus.emit(EVENTS.ASSET_PROGRESS, { progress: 1, file: "" });
        // ★ 여기서 GameScene 을 시작하지 않는다. 타이틀 -> [런 시작] -> CMD_START_RUN 이 시작한다.
        //   자동 시작하면 타이틀 화면 뒤에서 런이 굴러가 타이머와 스폰이 낭비되고,
        //   타이틀을 보는 동안 플레이어가 죽는 일까지 생긴다.
    }
}
