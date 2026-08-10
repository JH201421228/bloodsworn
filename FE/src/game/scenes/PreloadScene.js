/**
 * PreloadScene — 매니페스트 기반 전 에셋 로드 + 로딩바.
 *
 * 규격 출처: 06-TECH-DESIGN.md 8.4 / T113 / T114
 *
 * ★ 하드코딩하지 않고 assets.json을 읽는 이유(T114)
 *   블록 B의 에셋 파이프라인 작업이 이 파일을 건드리지 않고 매니페스트만 고치면 끝나게 하기 위해서다.
 *   에셋이 늘 때마다 씬 코드를 고치면 충돌 지점이 늘어난다.
 */
import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { EVENTS, SCENES } from "../constants";
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "../config";

const BAR_W = 320;
const BAR_H = 8;

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super(SCENES.PRELOAD);
    }

    preload() {
        this.buildLoadingBar();

        this.load.on("progress", (p) => {
            this.drawProgress(p);
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

    buildLoadingBar() {
        const cx = LOGICAL_WIDTH / 2;
        const cy = LOGICAL_HEIGHT / 2;

        this.add
            .text(cx, cy - 24, "봉인을 여는 중", {
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#c9b792",
            })
            .setOrigin(0.5);

        // 테두리는 석조색, 채움은 심홍 — 정본 팔레트(09-ART 1)
        this.add
            .rectangle(cx, cy, BAR_W + 2, BAR_H + 2)
            .setStrokeStyle(1, 0x4a4454)
            .setFillStyle(0x16121c);

        this.barFill = this.add
            .rectangle(cx - BAR_W / 2, cy, 0, BAR_H, 0x8b0f1d)
            .setOrigin(0, 0.5);

        this.pctText = this.add
            .text(cx, cy + 20, "0%", {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#7b7488",
            })
            .setOrigin(0.5);
    }

    drawProgress(p) {
        if (this.barFill) this.barFill.width = Math.round(BAR_W * p);
        if (this.pctText) this.pctText.setText(`${Math.round(p * 100)}%`);
    }

    create() {
        // 블록 B에서 registerAnims(this)가 여기 들어온다.

        // ★ 완료 신호를 명시적으로 한 번 더 쏜다.
        //   Phaser의 progress 이벤트는 로드 대상이 0개면 아예 발화하지 않는다.
        //   그 경우 React 로딩 오버레이가 영원히 남는다(실제로 겪은 버그).
        EventBus.emit(EVENTS.ASSET_PROGRESS, { progress: 1, file: "" });

        this.scene.start(SCENES.GAME);
    }
}
