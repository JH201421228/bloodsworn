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

    release(s) {
        s.setVisible(false).setActive(false).setPosition(-9999, -9999);
        this.freeSprites.push(s);
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
            this.chunks?.clear?.();
            for (const s2 of this.props?.active ?? []) this.release(s2);
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
