/**
 * GroundSystem — 끝없는 묘지 바닥 + 청크 기반 소품 배치.
 *
 * 규격: docs/18-MAP-IMAGE-PROMPT.md (4차 개정)
 *
 * ★ 왜 이 구조인가
 *   벽을 없애면 그림과 충돌을 맞출 것이 사라진다. 맵 마스크가 3번 실패한 원인이 벽이었다.
 *   바닥은 이음매 없는 512 타일 1장을 TileSprite로 무한 반복하고,
 *   소품은 게임이 시드 고정 RNG로 배치한다. 좌표를 게임이 정하므로 어긋날 수가 없다.
 *
 * ★ 소품에 충돌을 걸지 않는다
 *   06-TECH-DESIGN 998행 "적은 벽을 통과한다". 적이 통과하는데 플레이어만 막히면
 *   소품은 전술적 이득 0에 카이팅 걸림만 만든다.
 */
import { DEPTH } from "../constants";
import { LOGICAL_HEIGHT, MAX_LOGICAL_WIDTH } from "../config";

const CHUNK = 256;
/**
 * 카메라 주변 몇 청크까지 채울 것인가.
 * ★ 2 면 256*5 = 1280px 격자가 깔린다. 논리 가로 상한 864 에서도 카메라 반폭 432 를
 *   최악의 정렬(중심이 청크 끝)에서까지 덮는다 — 넓은 화면 때문에 늘릴 필요가 없다.
 */
const RADIUS = 2;
const MAX_PROPS = 360;

/**
 * 불 켜진 소품 (T132 — 09-ART 2.6 촛불A/촛불B/횃불).
 *
 * ★ 왜 props-grave 시트가 아니라 따로인가
 *   묘비·나무는 정지 이미지 한 장이면 끝이지만 불꽃은 4프레임 애니다. Phaser 에서
 *   애니는 Sprite 만 재생할 수 있고 Image 는 못 한다. 그래서 풀을 따로 둔다.
 *
 * ★ 왜 개수를 16 으로 묶는가
 *   불꽃은 매 프레임 프레임 번호가 바뀌는 유일한 배경 요소다. 밀도를 올리면
 *   묘지가 축제처럼 보이기도 하고(정본 2.1 "묘실의 어둠"), 애니 갱신 비용도 개수에 비례한다.
 *   청크당 0.5개면 반경 2청크(25칸)에 12개 안팎이 깔린다 — 16 이면 상한에 안 걸린다.
 */
const LIGHT_ANIMS = ["deco.candleA", "deco.candleB", "deco.torch"];
const LIGHT_DENSITY = 0.5;
const MAX_LIGHTS = 16;

/** 등급별 청크당 개수 — 밀도는 이미지를 다시 받지 않고 여기서 조절한다 */
const DENSITY = { large: 0.35, tree: 0.9, medium: 1.6, fence: 0.3, small: 2.2, fog: 0.25 };

/** 청크 좌표를 시드로 — 같은 청크는 언제 와도 같은 배치가 나온다 */
function chunkRng(cx, cy, salt) {
    let a = (cx * 374761393 + cy * 668265263 + salt * 2246822519) >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class GroundSystem {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // key -> sprite[]
        this.freeSprites = [];
        this.spriteCount = 0;
        this.byKind = {};

        // ── 바닥: 화면 크기 TileSprite를 카메라에 고정하고 tilePosition만 굴린다.
        //    월드 크기만 한 TileSprite를 만들면 텍스처 메모리가 폭증한다.
        // ★ 폭을 640 이 아니라 논리 가로 상한(864)으로 잡는다 (config.js 좌표계 주석).
        //   화면 폭은 기기 비율마다 다르고 회전으로도 바뀐다. 640 으로 굳히면 20:9 에서
        //   우측 160px 가 바닥 없는 검은 띠가 된다. 매번 setSize 로 따라가게 하는 대신
        //   처음부터 상한만큼 깔고 넘치는 부분은 카메라가 잘라내게 한다 —
        //   쿼드 1장이라 초과분의 렌더 비용은 측정되지 않는 수준이고, 리사이즈 훅이 사라진다.
        this.ground = scene.add
            .tileSprite(0, 0, MAX_LOGICAL_WIDTH, LOGICAL_HEIGHT, "ground_grave")
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH.GROUND);

        this.registerFrames();
        this.buildLightPool();
    }

    /**
     * 불 켜진 소품 풀. ★ 런 중에는 new 하지 않는다 — 생성자에서 다 만들고 보이기/숨기기만 한다.
     *   애니가 하나도 등록 안 됐으면(에셋 누락) 풀 자체를 안 만든다. 초록 체크무늬보다 없는 게 낫다.
     */
    buildLightPool() {
        const scene = this.scene;
        this.lightDefs = LIGHT_ANIMS.filter((k) => scene.anims.exists(k));
        this.freeLights = [];
        if (!this.lightDefs.length) return;
        const tex = scene.anims.get(this.lightDefs[0]).frames[0].textureKey;
        for (let i = 0; i < MAX_LIGHTS; i++) {
            const s = scene.add
                .sprite(-9999, -9999, tex)
                .setOrigin(0.5, 0.9)
                .setDepth(DEPTH.DECO)
                .setVisible(false)
                .setActive(false);
            s.__light = true;
            this.freeLights.push(s);
        }
    }

    /** props-grave.json의 바운딩 박스를 Phaser 프레임으로 등록한다 */
    registerFrames() {
        const data = this.scene.cache.json.get("props_grave");
        const tex = this.scene.textures.get(this.propsKey ?? "props_grave");
        if (!data?.frames || !tex) {
            console.warn("[GroundSystem] 소품 데이터가 없다");
            return;
        }
        for (const f of data.frames) {
            const name = "p" + f.id;
            if (!tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h);
            (this.byKind[f.kind] ??= []).push({ name, ...f });
        }
    }

    obtain() {
        let s = this.freeSprites.pop();
        if (!s) {
            if (this.spriteCount >= MAX_PROPS) return null;
            s = this.scene.add.image(0, 0, "props_grave");
            this.spriteCount++;
        }
        return s.setVisible(true).setActive(true);
    }

    /** 불 켜진 소품 1개. 풀이 비면 null — 청크는 그냥 촛불 없이 만들어진다 */
    obtainLight() {
        const s = this.freeLights?.pop();
        return s ? s.setVisible(true).setActive(true) : null;
    }

    release(s) {
        s.setVisible(false).setActive(false).setPosition(-9999, -9999);
        // ★ 두 풀을 섞으면 안 된다. Image 풀로 돌아간 Sprite 는 setTexture(propsKey, 'p12') 를
        //   맞아 묘비가 되고, 그 순간 촛불 풀은 영영 줄어든다.
        if (s.__light) {
            s.anims.stop();
            this.freeLights.push(s);
        } else {
            this.freeSprites.push(s);
        }
    }

    buildChunk(cx, cy) {
        const list = [];
        for (const kind in DENSITY) {
            const defs = this.byKind[kind];
            if (!defs?.length) continue;
            const rng = chunkRng(cx, cy, kind.length * 31 + kind.charCodeAt(0));
            // 소수 밀도는 확률로 처리한다 (0.35 -> 35% 확률로 1개)
            const n = Math.floor(DENSITY[kind]) + (rng() < DENSITY[kind] % 1 ? 1 : 0);
            for (let i = 0; i < n; i++) {
                const d = defs[(rng() * defs.length) | 0];
                const s = this.obtain();
                if (!s) return list;
                const x = cx * CHUNK + rng() * CHUNK;
                const y = cy * CHUNK + rng() * CHUNK;
                s.setTexture(this.propsKey ?? "props_grave", d.name).setPosition(Math.round(x), Math.round(y));
                // 발밑을 기준점으로 — 위아래 겹칠 때 y 정렬이 자연스럽다
                s.setOrigin(0.5, 0.9);
                if (kind === "fog") {
                    s.setDepth(DEPTH.FX).setAlpha(0.5);
                } else {
                    // y가 큰 것이 앞에 오도록 — 캐릭터와 자연스럽게 겹친다
                    s.setDepth(DEPTH.DECO).setAlpha(1);
                }
                list.push(s);
            }
        }

        // 불 켜진 소품 — 청크당 0.5개. salt 는 위 kind 들과 겹치지 않는 값이면 된다
        if (this.lightDefs?.length) {
            const rng = chunkRng(cx, cy, 97);
            if (rng() < LIGHT_DENSITY) {
                const s = this.obtainLight();
                if (s) {
                    const anim = this.lightDefs[(rng() * this.lightDefs.length) | 0];
                    s.setPosition(Math.round(cx * CHUNK + rng() * CHUNK), Math.round(cy * CHUNK + rng() * CHUNK));
                    // ★ 시작 프레임을 흩는다. 안 그러면 화면의 모든 불꽃이 한 몸처럼 같이 깜빡인다.
                    s.play(anim, true);
                    s.anims.setProgress(rng());
                    list.push(s);
                }
            }
        }
        return list;
    }
    /**
     * 스테이지 테마 전환. StageSystem 이 부른다.
     * ★ 텍스처가 없으면 호출자가 이미 폴백으로 바꿔 넘긴다. 여기서는 존재만 한 번 더 확인하고
     *   없으면 조용히 유지한다 — 없는 키를 setTexture 하면 Phaser 가 초록 체크무늬를 그린다.
     * ★ 소품은 이미 배치된 청크를 전부 버리고 다시 만든다. 텍스처만 갈면
     *   이전 테마의 프레임 이름을 그대로 참조해 깨진 프레임이 남는다.
     */
    setTheme(groundTex, propsTex, tint = 0xffffff) {
        if (groundTex && this.scene.textures.exists(groundTex)) this.ground.setTexture(groundTex);
        this.ground.setTint(tint);
        if (propsTex && propsTex !== this.propsKey && this.scene.textures.exists(propsTex)) {
            this.propsKey = propsTex;
            this.registerFrames();
            // ★ 반납이 먼저다. Map 만 비우면 이전 테마의 스프라이트가 화면에 남은 채
            //   풀에서도 사라져 회수할 방법이 없어진다(MAX_PROPS 에 걸려 새 소품이 안 나온다).
            for (const list of this.chunks.values()) for (const s2 of list) this.release(s2);
            this.chunks.clear();
        }
    }


    update() {
        const cam = this.scene.cameras.main;
        // 바닥 스크롤 — 카메라가 움직인 만큼 타일 위치를 민다
        this.ground.tilePositionX = cam.scrollX;
        this.ground.tilePositionY = cam.scrollY;

        // ★ 640 이 아니라 cam.width 다. 카메라 폭은 기기 비율을 따라간다(config.js 좌표계).
        //   굳혀 두면 넓은 화면에서 청크 중심이 왼쪽으로 치우쳐 우측 소품이 늦게 뜬다.
        const ccx = Math.floor((cam.scrollX + cam.width / 2) / CHUNK);
        const ccy = Math.floor((cam.scrollY + cam.height / 2) / CHUNK);

        // 멀어진 청크 회수
        for (const [key, list] of this.chunks) {
            const [kx, ky] = key.split(",").map(Number);
            if (Math.abs(kx - ccx) > RADIUS + 1 || Math.abs(ky - ccy) > RADIUS + 1) {
                for (const s of list) this.release(s);
                this.chunks.delete(key);
            }
        }
        // 새 청크 생성
        for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            for (let dx = -RADIUS; dx <= RADIUS; dx++) {
                const kx = ccx + dx, ky = ccy + dy;
                const key = kx + "," + ky;
                if (this.chunks.has(key)) continue;
                this.chunks.set(key, this.buildChunk(kx, ky));
            }
        }
    }

    get propCount() {
        let n = 0;
        for (const l of this.chunks.values()) n += l.length;
        return n;
    }
}
