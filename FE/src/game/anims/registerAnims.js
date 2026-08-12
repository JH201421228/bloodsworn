/**
 * 전 애니메이션 키 등록 단일 지점. (T122)
 *
 * 근거: 09-ART-AUDIO-AND-ASSET-MAP.md 2 (애니 키 / fps 표) · 30-ENCOUNTERS 7.1 (NPC)
 * 호출: PreloadScene.create()에서 1회
 *
 * ★ 키를 여기 한 곳에서만 만드는 이유
 *   씬마다 anims.create를 흩뿌리면 같은 키를 두 번 만들어 Phaser가 조용히 무시하고,
 *   "애니메이션이 안 바뀐다"를 몇 시간 쫓게 된다.
 */

import monsterCatalog from "../../data/monster-catalog.json";
import enemiesData from "../../data/enemies.json";
import npcCatalog from "../../data/npc-catalog.json";

const DIRS = ["up", "down", "left", "right"];

/**
 * 적 150종 — 프레임 배정은 monster-catalog.json 이 유일한 출처다.
 *
 * ★ 여기에 150줄을 적지 않는 이유는 위 "키를 한 곳에서만 만든다"와 같은 규약의 반대편이다.
 *   프레임 인덱스를 손으로 옮겨 적으면 아틀라스를 다시 구울 때마다 두 곳이 어긋나고,
 *   어긋나도 예외가 안 난다 — 150종이 조용히 남의 그림으로 나온다.
 *   카탈로그는 tools/build-monsters.mjs 가 아틀라스와 같은 루프에서 찍는다.
 *   frameStart = 종 인덱스 x 4, 한 행 32칸(= 8종). 실측 검증: 아틀라스 셀의 알파 bbox
 *   중앙값과 카탈로그 bodyW/bodyH 가 150종 중 144종에서 정확히 일치했다
 *   (나머지 6종은 원본이 셀보다 커서 축소된 것들 — 인덱스가 아니라 크기 차이다).
 *
 * ★ 구 enemies 시트(10종)의 enemy.e1~el2 등록을 지운 이유
 *   카탈로그가 E1~E8/EL1/EL2 를 같은 키(enemy.e1 …)로 이미 갖고 있는데 프레임은 다르다
 *   (예: E1 은 구 시트 0번, monsters 아틀라스 56번). 둘 다 등록하면 make() 의 중복 가드가
 *   "먼저 등록한 쪽"을 남겨 10종만 옛 그림으로 재생된다. 프레임 출처는 카탈로그 하나여야 한다.
 */
const clampFps = (v) => (v < 5 ? 5 : v > 14 ? 14 : v);

/** 정본 10종 fps — 09-ART 2 의 실측표. 유도식에 태우지 않는다 */
const LEGACY_FPS = { e1: 10, e2: 6, e3: 14, e4: 8, e5: 8, e6: 8, e7: 12, e8: 10, el1: 8, el2: 6 };

/** id -> moveSpeed. 빠른 놈이 빨리 움직여야 속도가 눈에 읽힌다 */
const SPEED_BY_ID = new Map(enemiesData.enemies.map((e) => [e.id, e.moveSpeed]));

/** 종 하나의 애니 fps. 정본 10종은 실측값, 나머지는 이동속도에서 유도한다 */
function speciesFps(id) {
    const legacy = LEGACY_FPS[id.toLowerCase()];
    if (legacy) return legacy;
    return clampFps(Math.round(4 + (SPEED_BY_ID.get(id) ?? 60) / 12));
}

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

/**
 * 소품 애니 — 09-ART 2.6 실측표. GroundSystem 이 청크에 심는다(T132).
 *
 * ★ candle-b 를 뒤늦게 넣은 이유
 *   구워는 뒀는데 매니페스트에도 여기에도 없어 실행 중에 존재하지 않는 에셋이었다.
 *   촛불이 한 종류뿐이면 묘지 전체의 불꽃이 같은 프레임에 같은 모양으로 흔들린다 —
 *   두 종을 섞어야 "여러 개의 촛불"로 보인다. 그게 이 파일이 두 줄인 이유다.
 *
 * ★ spike(가시 함정, assets/props/spike.png 5프레임)는 일부러 빠져 있다.
 *   장식이 아니라 "밟으면 5 피해 + 0.5초 무적"인 게임플레이 오브젝트이고(03-GDD 8.4 / 06 오브젝트표,
 *   둘 다 COULD 등급), 플레이어 전용 겹침 판정 + 피해 + 예고 연출이 함께 있어야 성립한다.
 *   그 시스템이 아직 없다. 여기에 한 줄 넣으면 아무도 재생하지 않는 애니 키와
 *   아무도 그리지 않는 텍스처가 하나씩 늘 뿐이다 — 판정이 생기는 날 같이 넣는다.
 *   ★ 그리고 GroundSystem 의 확정 규약은 "소품에 충돌을 걸지 않는다"(적은 벽을 통과하는데
 *     플레이어만 막히면 소품이 카이팅 걸림만 된다)이다. 함정은 그 규약의 예외라서
 *     소품 배치 경로에 그냥 끼워 넣을 수도 없다.
 */
const PROP_ANIMS = [
    { key: "candleA", tex: "candle-a", frames: 4, fps: 8 },
    { key: "candleB", tex: "candle-b", frames: 4, fps: 8 },
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

    // ── 적 150종: monsters 아틀라스에서 종별 4프레임씩
    //   키는 enemies.json 의 anim 필드와 같은 규칙(enemy.<id 소문자>)으로 만든다.
    //   SpawnSystem.reset() 의 anims.exists(def.anim) 가드가 여기서 만든 키를 그대로 찾는다.
    const tex = monsterCatalog.texture;
    for (const sp of monsterCatalog.species) {
        make("enemy." + sp.id.toLowerCase(), tex, {
            frames: scene.anims.generateFrameNumbers(tex, {
                start: sp.frameStart,
                end: sp.frameStart + sp.frames - 1,
            }),
            frameRate: speciesFps(sp.id),
            repeat: -1,
        });
    }

    // ── 조우 NPC 6종: npcs 시트에서 종별 대기 애니 1개
    //   적 150종과 같은 규약이다 — 프레임 배정은 npc-catalog.json 하나만 갖고 여기는 읽기만 한다.
    //   ★ NPC 는 걷거나 싸우지 않는다. 원본이 대기 애니 하나뿐이고(4~6프레임), 조우는
    //     "제자리에 서서 좌판을 연다"가 전부라 방향별/상태별 키를 만들 이유가 없다.
    //   ★ fps 는 카탈로그가 들고 있다(제작자 권장 6). 여기서 유도하지 않는 이유는
    //     "상인이 빠르게 씰룩거리면 이상하다"가 데이터가 아니라 아트의 성질이기 때문이다.
    for (const n of npcCatalog.npcs) {
        make(npcCatalog.animPrefix + n.id, npcCatalog.texture, {
            frames: scene.anims.generateFrameNumbers(npcCatalog.texture, {
                start: n.frameStart,
                end: n.frameStart + n.frameCount - 1,
            }),
            frameRate: n.fps ?? npcCatalog.fps,
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

    // ── 「피의 제단」 발동 섬광 (docs/33 §4.3)
    //   ★ 4프레임 · 16fps · repeat 0 = 250ms. 프레임 수와 재생 규칙의 출처는 33 §4.3 하나다.
    //   회전(고리)은 여기 없다 — 애니가 아니라 EncounterSystem 이 rotation 값만 더한다.
    make("enc_altar_flash", "enc-decal-72", {
        frames: scene.anims.generateFrameNumbers("enc-decal-72", { start: 3, end: 6 }),
        frameRate: 16,
        repeat: 0,
    });

    // ── 보스 실탄 「혼탄」 맥동 (docs/32 §11.2 B)
    //   ★ 4프레임이 7 / 10 / 13 / 9 px 로 부풀었다 줄어든다. 12fps = 한 맥동 333ms —
    //     보스 탄속(150px/s)에서 화면을 가로지르는 동안 6~7번 뛴다. 이보다 빠르면 떨림으로 읽힌다.
    //   ★ 텍스처가 없으면 make() 가 건너뛰고, BossSystem 은 boltArt=false 로 원을 그린다.
    //     즉 이 한 줄은 폴백을 막지 않는다.
    make("boss_soul_bolt", "proj-soul-bolt", {
        frames: scene.anims.generateFrameNumbers("proj-soul-bolt", { start: 0, end: 3 }),
        frameRate: 12,
        repeat: -1,
    });

    if (skipped.length) {
        console.warn("[registerAnims] 텍스처가 없어 건너뛴 애니메이션 " + skipped.length + "개:", skipped.join(", "));
    }
    return { created: created.length, skipped };
}

export default registerAnims;
