/**
 * 전 애니메이션 키 등록 단일 지점. (T122)
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md 2 (애니 키 / fps 표)
 * 호출: PreloadScene.create()에서 1회
 *
 * ★ 키를 여기 한 곳에서만 만드는 이유
 *   씬마다 anims.create를 흩뿌리면 같은 키를 두 번 만들어 Phaser가 조용히 무시하고,
 *   "애니메이션이 안 바뀐다"를 몇 시간 쫓게 된다.
 */

const DIRS = ["up", "down", "left", "right"];

/** 적 프레임 배정 — tools/build-assets.mjs 의 ENEMY_ORDER와 반드시 일치한다. */
const ENEMY_ANIMS = [
    { key: "e1", start: 0, fps: 10 },
    { key: "e2", start: 4, fps: 6 },
    { key: "e3", start: 8, fps: 14 },
    { key: "e4", start: 12, fps: 8 },
    { key: "e5", start: 16, fps: 8 },
    { key: "e6", start: 20, fps: 8 },
    { key: "e7", start: 24, fps: 12 },
    { key: "e8", start: 28, fps: 10 },
    { key: "el1", start: 32, fps: 8 },
    { key: "el2", start: 36, fps: 6 },
];

/** 보스 8x8=64칸 선형 배치. 09-ART 2.3 실측표. */
const BOSS_ANIMS = [
    { key: "idle", from: 0, to: 7, fps: 8, repeat: -1 },
    { key: "walk", from: 8, to: 15, fps: 10, repeat: -1 },
    { key: "attack", from: 16, to: 25, fps: 14, repeat: 0 },
    { key: "hurt", from: 26, to: 28, fps: 12, repeat: 0 },
    { key: "death", from: 29, to: 38, fps: 10, repeat: 0 },
    { key: "cast", from: 39, to: 47, fps: 12, repeat: 0 },
    { key: "spell", from: 48, to: 63, fps: 12, repeat: 0 },
];

const PROP_ANIMS = [
    { key: "candleA", tex: "candle-a", frames: 4, fps: 8 },
    { key: "torch", tex: "torch", frames: 4, fps: 10 },
];

/**
 * @param {Phaser.Scene} scene
 * @returns {{created: number, skipped: string[]}}
 */
export function registerAnims(scene) {
    const created = [];
    const skipped = [];

    /** 텍스처가 없으면 만들지 않는다. 에셋 1개가 빠졌다고 부팅이 죽으면 안 된다. */
    const make = (key, texture, cfg) => {
        if (!scene.textures.exists(texture)) {
            skipped.push(key);
            return;
        }
        if (scene.anims.exists(key)) return; // 이중 등록 방지
        scene.anims.create({ key, ...cfg });
        created.push(key);
    };

    // ── 플레이어: 4애니메이션 x 4방향
    const playerSets = [
        { name: "idle", tex: "idle", fps: 8, repeat: -1 },
        { name: "run", tex: "run", fps: 12, repeat: -1 },
        { name: "atk1", tex: "atk1", fps: 16, repeat: 0 },
        { name: "atk2", tex: "atk2", fps: 16, repeat: 0 },
    ];
    for (const s of playerSets) {
        for (const d of DIRS) {
            const tex = "player-" + s.tex + "-" + d;
            make("player." + s.name + "." + d, tex, {
                frames: scene.anims.generateFrameNumbers(tex, { start: 0, end: 7 }),
                frameRate: s.fps,
                repeat: s.repeat,
            });
        }
    }

    // ── 적 10종: 합본 시트에서 4프레임씩
    for (const e of ENEMY_ANIMS) {
        make("enemy." + e.key, "enemies", {
            frames: scene.anims.generateFrameNumbers("enemies", {
                start: e.start,
                end: e.start + 3,
            }),
            frameRate: e.fps,
            repeat: -1,
        });
    }

    // ── 보스
    for (const b of BOSS_ANIMS) {
        make("boss." + b.key, "boss", {
            frames: scene.anims.generateFrameNumbers("boss", { start: b.from, end: b.to }),
            frameRate: b.fps,
            repeat: b.repeat,
        });
    }

    // ── 소품
    for (const p of PROP_ANIMS) {
        make("deco." + p.key, p.tex, {
            frames: scene.anims.generateFrameNumbers(p.tex, { start: 0, end: p.frames - 1 }),
            frameRate: p.fps,
            repeat: -1,
        });
    }

    if (skipped.length) {
        console.warn("[registerAnims] 텍스처가 없어 건너뛴 애니메이션 " + skipped.length + "개:", skipped.join(", "));
    }
    return { created: created.length, skipped };
}

export default registerAnims;
