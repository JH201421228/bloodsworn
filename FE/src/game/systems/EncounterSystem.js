/**
 * EncounterSystem — 전투 화면 「안」에서 일어나는 사건. 조우 7종 + 디렉터. (6개월 확장 / E-1)
 *
 * 설계 정본: docs/30-ENCOUNTERS-AND-FIELD-EVENTS.md · 데이터: data/encounters.json
 * 연관 정본: 31(룬이 나오는 문) · 23(좌판이 파는 물건) · 26(필드보스가 갈라져 나온 원본)
 *
 * ★ 이 시스템이 푸는 문제 (30 §0)
 *   런의 60초~10분 사이에 플레이어가 하는 일은 이동과 회피 두 가지뿐이었다. 그 사이를 끊는
 *   것은 레벨업 PACT 카드 하나이고, 그것마저 게임을 멈추고 화면을 덮는다. 즉 전투 화면 안에서
 *   일어나는 사건이 "적이 나온다" 하나뿐이었다. 여기서 사건을 만든다 — 멈추지 않고, 조작을 늘리지 않고.
 *
 * ★ 두 불변식 — 이 파일에서 가장 중요한 주석 (30 §1)
 *   I-3  게임을 멈추지 않는다. 이 파일 어디에도 scene.pause() 가 없다.
 *        멈추는 것은 PACT 하나다(ItemSystem.js:15 와 같은 규약). 조우가 멈추면 그것은
 *        "PACT 카드가 하나 더 있는 것"이고, 10분 런에 정지 화면이 15회 뜨는 게임이 된다.
 *   탭0  조작을 늘리지 않는다. 입력 핸들러를 하나도 등록하지 않는다 —
 *        아래 코드에 scene.input / addEventListener / setInteractive 가 한 번도 나오지 않는다.
 *        조작은 조이스틱과 대시가 전부다(검증 E-2 는 주석을 걷어낸 뒤 이 세 낱말을 센다).
 *
 * ★ 그 둘을 동시에 지키는 답 — 「선택을 공간으로 바꾼다」 (30 §1.3)
 *   고를 것이 3개면 화면에 3개를 놓는다. 플레이어는 원하는 것 위로 걸어간다.
 *   정지 0 · 조작 0 추가 · 읽는 시간이 곧 위험 · 거리가 곧 비용.
 *   그래서 이 파일의 UI 는 전부 월드 좌표의 오브젝트(원 + 아이콘 + 가격 글자)다.
 *
 * ★ 런 중 new 금지 (06-TECH 5.1 / 검증 E-8)
 *   NPC 1 · 좌판 3(원/아이콘/글리프/가격) · 제단 원 1 · 화살표 2 — 전부 생성자에서 만든다.
 *   필드보스는 SpawnSystem 의 적 풀에서, 좌판이 파는 물건은 ItemSystem 의 드롭 풀에서 나온다.
 *   ⚠ 예외는 저빈도 문자열·이벤트 페이로드뿐이다(런당 5회 안팎). ItemSystem.pickup 이
 *     획득마다 페이로드 객체를 만드는 것과 같은 급이고, 매 프레임 경로에는 하나도 없다.
 *
 * ★ 60fps 값을 스토어에 넣지 않는다 (06 §3.3)
 *   배너와 예언자 미리보기는 저빈도라 React(EventBus)로 보낸다. 그러나 **방향 화살표는
 *   매 프레임 좌표가 바뀌므로 여기서 직접 그린다** — setScrollFactor(0) 로 화면에 고정한다.
 *   좌판 위치·남은 시간도 마찬가지로 이벤트에 싣지 않는다.
 *
 * ★ 필드보스는 BossSystem 을 부르지 않는다 (30 §3.6 — 부르면 런이 끝난다)
 *   BossSystem.spawn() 은 세 가지를 한꺼번에 한다: spawner.suppressed = true (잡몹 영구 정지),
 *   purgeMinions() (화면 전멸), onDefeat() -> endRun() (런 종료). 필드보스는 셋 전부를 피해야 한다.
 *   그래서 enemies.json 의 tier:"miniboss" 10종 + SpawnSystem.spawnElite 를 그대로 재사용한다.
 *
 * ── 통합 계약 (GameScene 이 이대로 부른다) ──
 *   new EncounterSystem(scene, { player, combat, stats, spawn, items, runes, pact, boss })
 *   .update(dt)              : 디렉터 + 조우 진행 + 좌판 판정 + 화살표
 *   .rollChestReward(x, y)   : SpawnSystem.openChest 가 부른다. 보상 3종 추첨(30 §3.7)
 *   .force(kindOrId)         : 치트 — 지금 즉시 그 조우를 띄운다
 *   .simulate(runs)          : 치트 — 디렉터 규칙 검증용 순수 시뮬레이션(E-6)
 *   .active                  : 현재 조우 상태(읽기 전용). 없으면 null
 *   .clear()
 */
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2 } from "../utils/math";
import encData from "@/data/encounters.json";
import npcCatalog from "@/data/npc-catalog.json";
import enemiesData from "@/data/enemies.json";

/** 좌판 최대 개수. 상인·마녀가 3개로 가장 많다(30 §3.1/§3.2) */
const MAX_SLOTS = 3;
/** 조우는 한 번에 하나다. 창(window)이 5개이고 서로 겹치지 않는다(30 §4.1) */
const EMPTY = [];
const EMPTY_SET = new Set();

/**
 * 화살표 종류 표시. ⚠ 임시다 — docs/32 C-4 의 조우 마커 아이콘 6종이 오면
 * 이 표를 지우고 아틀라스 프레임으로 갈아 끼운다. 지금은 도형보다 글리프가 낫다(30 §7.2).
 */
const KIND_MARK = {
    merchant: "\u2696",   // 저울
    witch: "\u2727",      // 별
    seer: "\u25C9",       // 눈
    shady: "?",
    altar: "\u2020",      // 십자
    fieldboss: "\u2620",  // 해골
    chest: "\u25AC",      // 궤
};

/** 등급 색. items.json 의 rarities[].color 와 같은 값이다(문자열 파싱을 피해 숫자로 굳혔다) */
const RARITY_COLOR = {
    common: 0x7b7488, uncommon: 0xc7c2ce, rare: 0x35c9b4, epic: 0xc4182b, legendary: 0xc9a227,
};
/** 살 수 없는 좌판의 색. 30 §5 "현재 체력이 가격 이하면 좌판이 회색으로 잠긴다" */
const LOCKED_COLOR = 0x4a4650;

const byId = (arr, key) => Object.fromEntries(arr.map((x) => [x[key], x]));

/** 가중치 추첨. weight 합이 0이면 첫 항목 */
function rollWeighted(list, rng = Math.random) {
    let total = 0;
    for (const o of list) total += o.weight ?? 0;
    if (total <= 0) return list[0] ?? null;
    let r = rng() * total;
    for (const o of list) { const w = o.weight ?? 0; if (r < w) return o; r -= w; }
    return list[list.length - 1];
}

export class EncounterSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.spawn = ctx.spawn;
        this.items = ctx.items;
        this.runes = ctx.runes;
        this.pact = ctx.pact;
        this.boss = ctx.boss;

        this.cfg = encData;
        this.defs = encData.encounters;
        this.defOf = byId(this.defs, "id");
        this.npcOf = byId(npcCatalog.npcs, "id");
        this.spawnCfg = encData.spawn;

        /** tier 별 적 목록. 필드보스(miniboss)와 「수상한 자」의 함정(elite)이 여기서 나온다 */
        this.miniboss = enemiesData.enemies.filter((e) => e.tier === "miniboss");
        this.elites = enemiesData.enemies.filter((e) => e.tier === "elite");

        this.hasNpcTex = scene.textures.exists(npcCatalog.texture);
        if (!this.hasNpcTex) console.warn("[EncounterSystem] npcs 시트가 없다 — NPC 없이 좌판만 뜬다");
        this.hasItemAtlas = scene.textures.exists("items");

        this.buildObjects();
        this.resetState();
    }

    // ══ 오브젝트 (전부 생성자에서 — 런 중 new 금지) ═══════════════
    /**
     * ★ StageSystem.obtainCircle() 을 쓰지 않은 이유 (30 §7.3 과 다른 판단이라 적어 둔다)
     *   그 원 풀은 gimmick.type 이 sanctuary/rockfall 인 스테이지에서만 만들어진다
     *   (StageSystem.resetGimmick 의 switch). stage2(haze)·stage3(mire)·stage5(emberwind) 에서는
     *   free 가 비어 있어 obtainCircle 이 **null 을 돌려준다** — 좌판 바닥이 통째로 사라진다.
     *   게다가 상한 MAX_GIMMICK(8)을 기믹과 나눠 쓰므로, 빌린 만큼 낙석·성수가 안 뜬다.
     *   조우는 스테이지를 가리지 않으므로 자기 원을 자기가 갖는 것이 맞다.
     */
    buildObjects() {
        const s = this.scene;
        const mk = (x, y) => s.add.circle(x, y, 16, 0xffffff, 0.2).setDepth(DEPTH.ORB).setVisible(false);

        /** 좌판 3칸. 칸마다 바닥 원 · 아이콘 · 글리프 폴백 · 가격 글자를 1:1 로 고정 짝지어 둔다 */
        this.slots = new Array(MAX_SLOTS);
        for (let i = 0; i < MAX_SLOTS; i++) {
            this.slots[i] = {
                // ★ 필드를 전부 여기서 선언한다. 나중에 붙이면 히든클래스가 갈려 접근이 느려진다
                //   (RuneSystem 생성자와 같은 규약).
                on: false, x: 0, y: 0, locked: false,
                kind: "", label: "", price: 0, color: 0xffffff,
                frame: null, glyphTxt: null,
                base: -1, rarity: 0, runeId: null, outcome: null,
                circle: mk(-9999, -9999),
                icon: this.hasItemAtlas
                    ? s.add.sprite(-9999, -9999, "items").setDepth(DEPTH.ORB + 1).setVisible(false)
                    : null,
                // 룬 아이콘은 아직 없다 -> 유니코드 글리프 폴백(31 §7 / 30 §7.3).
                // 「수상한 자」의 뒷면(?)도 같은 오브젝트를 쓴다.
                glyph: s.add.text(-9999, -9999, "", { fontFamily: "monospace", fontSize: "15px", color: "#f2e8d5" })
                    .setOrigin(0.5, 0.5).setDepth(DEPTH.ORB + 2).setVisible(false),
                priceTxt: s.add.text(-9999, -9999, "", { fontFamily: "monospace", fontSize: "9px", color: "#c4182b" })
                    .setOrigin(0.5, 0).setDepth(DEPTH.ORB + 2).setVisible(false),
            };
        }

        // NPC — setOrigin(0.5, 1). 셀이 바닥 정렬이라 y 가 곧 발이 닿는 지점이다(npc-catalog 주석)
        this.npc = this.hasNpcTex
            ? s.add.sprite(-9999, -9999, npcCatalog.texture, 0).setOrigin(0.5, 1)
                .setDepth(DEPTH.ENEMY + 1).setVisible(false)
            : null;

        // 「피의 제단」 — NPC 없이 바닥 원 하나(30 §3.5)
        this.altarRing = mk(-9999, -9999);
        this.altarFill = mk(-9999, -9999);

        // 방향 화살표 — ★ setScrollFactor(0). 매 프레임 좌표가 바뀌는 값이라 React 에 안 보낸다
        this.arrow = s.add.triangle(-9999, -9999, 0, 10, 5, -6, -5, -6, 0xc9b792)
            .setScrollFactor(0).setDepth(DEPTH.HUD).setVisible(false);
        this.arrowMark = s.add.text(-9999, -9999, "", { fontFamily: "monospace", fontSize: "11px", color: "#c9b792" })
            .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH.HUD).setVisible(false);
    }

    resetState() {
        /** 활성 조우. 하나뿐이다 — 창 5개가 서로 겹치지 않는다(30 §4.1) */
        this.act = {
            on: false, def: null, id: "", kind: "", name: "",
            x: 0, y: 0, life: 0, slots: 0, resolved: false,
        };
        /** 마녀 좌판 추첨 결과. fillWitch 가 i===0 에서 한 번만 뽑고 나머지 칸이 나눠 갖는다 */
        this.witchPick = null;
        /** 제단 채널링(30 §3.5 — 3초간 서 있어야 발동. 실수로 밟는 사고를 막는다) */
        this.channel = 0;
        /**
         * 필드보스. 적 풀의 스프라이트를 빌려 쓰므로 토큰으로 동일성을 확인한다.
         * lastHp/engaged 는 교전 판정용이다 — tickFieldBoss 주석 참조.
         */
        this.fb = { on: false, e: null, token: 0, life: 0, lastHp: 0, engaged: 0 };
        this.fbToken = 0;
        /** 창 스케줄. bossAt 을 알아야 만들 수 있어 첫 update 에서 굽는다 */
        this.schedule = null;
        this.winIndex = 0;
        this.prevKind = null;
        this.usedCount = Object.create(null);
    }

    get active() { return this.act.on ? this.act : null; }

    // ══ 디렉터 (30 §4) ═══════════════════════════════════════════
    /**
     * ★ 순수 확률 등장을 거부한다 (30 §4.1).
     *   매 프레임 주사위를 굴리면 어떤 런에는 조우가 0회, 어떤 런에는 6회 나온다.
     *   그러면 조우는 설계가 아니라 운이 되고 밸런싱이 불가능해진다.
     *   런 시간축에 창 5개를 고정하고, 각 창에서 **무엇이 나올지만** 추첨한다.
     * ★ 창의 위치는 bossAt 대비 비율이다. 런 길이가 300~450초로 다르기 때문이다.
     *   그래서 bossAt 이 확정된 뒤(StageSystem.load 이후)에 굽는다 — 첫 update 가 그 시점이다.
     */
    buildSchedule() {
        const bossAt = this.spawn?.bossAt ?? 360;
        this.schedule = this.cfg.windows.map((w) => ({
            id: w.id,
            pool: w.pool,
            // ±jitter — 매 런 정확히 같은 초에 나오면 외워지고, 외워지면 사건이 아니다(30 §4.1)
            at: Math.max(8, bossAt * w.at + (Math.random() * 2 - 1) * (w.jitter ?? 0)),
        }));
        this.schedule.sort((a, b) => a.at - b.at);
        this.winIndex = 0;
    }

    /**
     * 추첨 규칙 4가지 (30 §4.2). ★ 이 함수는 씬을 만지지 않는다 —
     * 그래서 simulate() 가 100런을 돌려 E-6 를 숫자로 검증할 수 있다.
     * @param {string[]} pool 창의 후보 목록
     * @param {{prev: string|null, used: object, runeOffers: number}} st 디렉터 상태
     */
    drawKind(pool, st, rng = Math.random) {
        const rules = this.cfg.rules ?? {};
        const cand = [];
        for (const id of pool) {
            const def = this.defOf[id];
            if (!def) continue;
            // 규칙 1 — 직전 창에 나온 종류는 제외한다. 상인이 연달아 두 번이면 사건이 아니다
            if (rules.noRepeatPrevWindow && def.kind === st.prev) continue;
            // 규칙 2/4 — 필드보스 런당 1회, 제단 런당 2회
            const cap = rules.maxPerRun?.[id];
            if (cap !== undefined && (st.used[id] ?? 0) >= cap) continue;
            // 규칙 3 — 마녀는 제시할 룬이 1개 이상일 때만. 없으면 그 창에서 재추첨한다
            if (def.kind === "witch" && st.runeOffers < 1) continue;
            // 규칙 5 — 제단은 **줄 대가가 남아 있을 때만** 나온다(마녀와 같은 형태다).
            // ★ 이 규칙이 없으면 제단이 후반에 「공짜 epic 축복」이 된다. PactSystem.pickToll 은
            //   각성 상한 도달 후 남은 태그가 전부 3중첩에 닿으면 후보가 0이 되어 null 을
            //   돌려주고(그 자체는 의도된 설계다 — "녹턴이 더 가져갈 게 없다"), 제단은 대가가
            //   null 이면 인간성도 0 을 받는다. 실측: 후반 런의 42.9~49.1% 에서 제단이 대가
            //   없이 지나갔다(800런 x2 시뮬). 그러면 2026-08-11 의 제단 밸런스 수정이
            //   후반에 절반쯤 되돌아간다 — 제단은 PACT 를 찾아가는 곳이지 공짜 상자가 아니다.
            if (def.kind === "altar" && !st.tollAvail) continue;
            cand.push(def);
        }
        // 규칙이 전부를 걷어냈으면 직전 제외만 풀고 다시 본다. 창을 빈손으로 넘기지 않는다 —
        // 창 5개는 "런에 사건이 5번 있다"는 약속이고, 그 약속이 규칙 때문에 깨지면 안 된다.
        if (!cand.length) {
            for (const id of pool) {
                const def = this.defOf[id];
                if (!def) continue;
                const cap = rules.maxPerRun?.[id];
                if (cap !== undefined && (st.used[id] ?? 0) >= cap) continue;
                if (def.kind === "witch" && st.runeOffers < 1) continue;
                if (def.kind === "altar" && !st.tollAvail) continue;
                cand.push(def);
            }
        }
        if (!cand.length) return null;
        return cand[(rng() * cand.length) | 0];
    }

    /** 치트/검증용 순수 시뮬레이션. 씬도 난수 시드도 건드리지 않는다(E-6) */
    simulate(runs = 100, runeOffers = 6, tollAvail = true) {
        let repeats = 0;
        const hist = Object.create(null);
        for (let r = 0; r < runs; r++) {
            const st = { prev: null, used: Object.create(null), runeOffers, tollAvail };
            for (const w of this.cfg.windows) {
                const def = this.drawKind(w.pool, st);
                if (!def) continue;
                if (def.kind === st.prev) repeats++;
                hist[def.id] = (hist[def.id] ?? 0) + 1;
                st.used[def.id] = (st.used[def.id] ?? 0) + 1;
                st.prev = def.kind;
            }
        }
        return { runs, repeats, hist };
    }

    // ══ 배치 ═════════════════════════════════════════════════════
    /**
     * ★ 화면 밖에 생성하는 것이 핵심이다 (30 §4.3).
     *   눈앞에 나타나면 "간다/안 간다"가 없다. 멀리 있어야 가는 데 드는 시간과 위험이
     *   비용이 되고, 그제서야 선택이 된다.
     * ⚠ 정본은 "200~260px"이라고만 적었는데, 640x360 의 가로 반폭은 320 이라
     *   좌우 방향으로는 260px 이 아직 **화면 안**이다. 그래서 그 각도에서 화면을 벗어나는
     *   최소 거리를 먼저 구하고, 둘 중 큰 값을 쓴다. 세로 방향에서는 정본 값이 그대로 산다.
     */
    placePoint() {
        const cam = this.scene.cameras.main;
        const a = Math.random() * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const pad = this.spawnCfg.offscreenPad ?? 28;
        // 각도 a 로 나갔을 때 카메라 사각형을 벗어나는 최소 거리
        const exit = Math.min(
            Math.abs(c) > 1e-4 ? (cam.width / 2) / Math.abs(c) : Infinity,
            Math.abs(s) > 1e-4 ? (cam.height / 2) / Math.abs(s) : Infinity,
        );
        const want = this.spawnCfg.distMin + Math.random() * (this.spawnCfg.distMax - this.spawnCfg.distMin);
        const d = Math.max(want, exit + pad);
        return { x: this.player.x + c * d, y: this.player.y + s * d };
    }

    /** 치트/디렉터 공용 진입점. 이미 조우가 떠 있으면 먼저 걷는다 */
    force(idOrKind) {
        const def = this.defOf[idOrKind] ?? this.defs.find((d) => d.kind === idOrKind);
        if (!def) return "알 수 없는 조우 " + idOrKind;
        if (this.act.on) this.expire(true);
        return this.beginEncounter(def) ? def.id : "배치 실패 " + def.id;
    }

    beginEncounter(def) {
        const at = this.placePoint();
        this.act.on = true;
        this.act.def = def;
        this.act.id = def.id;
        this.act.kind = def.kind;
        this.act.name = def.name;
        this.act.x = at.x;
        this.act.y = at.y;
        this.act.life = def.stay ?? 25;
        this.act.resolved = false;
        this.act.slots = 0;
        this.channel = 0;

        let ok = true;
        if (def.kind === "chest") ok = this.beginChest(at);
        else if (def.kind === "fieldboss") ok = this.beginFieldBoss(at);
        else ok = this.beginStall(def, at);

        if (!ok) { this.act.on = false; return false; }

        this.usedCount[def.id] = (this.usedCount[def.id] ?? 0) + 1;
        this.prevKind = def.kind;
        // 화면 상단 한 줄 배너 + 방향 화살표는 React 와 Phaser 가 나눠 맡는다(파일 머리 주석)
        EventBus.emit(EVENTS.ENCOUNTER_SPAWNED, {
            id: def.id, name: def.name, kind: def.kind, x: at.x, y: at.y,
        });
        this.scene.audio?.sfx?.("pickup");
        return true;
    }

    /** NPC + 좌판형(상인·마녀·예언자·수상한 자·제단) */
    beginStall(def, at) {
        if (def.npc && this.npc) {
            const n = this.npcOf[def.npc];
            if (n) {
                this.npc.setPosition(at.x, at.y).setVisible(true).setAlpha(1);
                // ★ 애니 키를 손으로 적지 않는다. frameCount 를 넘겨 재생하면 투명 프레임이 나와
                //   NPC 가 사라진 것처럼 보인다 — 프레임 배정의 출처는 npc-catalog 하나다.
                if (this.scene.anims.exists(n.anim)) this.npc.play(n.anim);
                else this.npc.setFrame(n.frameStart);
                this.npc.__body = n;
            }
        }
        if (def.kind === "altar") { this.showAltar(at); return true; }

        const n = def.pedestals ?? 0;
        const built = this.buildSlots(def, at, n);
        // 마녀가 줄 룬이 하나도 없거나 상인이 팔 것이 없으면 등장 자체를 취소한다(30 §4.2 규칙 3)
        if (!built) { this.hideAll(); return false; }
        this.act.slots = built;
        return true;
    }

    /**
     * 좌판을 판다. 정본의 그림 그대로 — NPC 뒤(플레이어 반대쪽)가 아니라 **앞**에 늘어놓는다.
     * 플레이어 쪽으로 pedestalAhead 만큼 내려놓아야 NPC 에 가려지지 않는다.
     */
    buildSlots(def, at, n) {
        const gap = this.spawnCfg.pedestalGap ?? 46;
        const ahead = this.spawnCfg.pedestalAhead ?? 34;
        // NPC -> 플레이어 방향. 좌판은 그 방향으로 한 걸음 나와 가로로 늘어선다
        const dx = this.player.x - at.x, dy = this.player.y - at.y;
        const d = Math.hypot(dx, dy) || 1;
        const fx = dx / d, fy = dy / d;
        const px = -fy, py = fx;   // 좌우 축

        let made = 0;
        for (let i = 0; i < n && i < MAX_SLOTS; i++) {
            const off = (i - (n - 1) / 2) * gap;
            const x = at.x + fx * ahead + px * off;
            const y = at.y + fy * ahead + py * off;
            const s = this.slots[made];
            if (!this.fillSlot(s, def, i)) continue;
            s.on = true;
            s.x = x;
            s.y = y;
            this.showSlot(s);
            made++;
        }
        return made;
    }

    /** 좌판 하나에 무엇을 올릴지 정한다. false 면 그 칸은 비운다 */
    fillSlot(s, def, i) {
        s.base = -1; s.rarity = 0; s.runeId = null; s.outcome = null; s.locked = false;
        if (def.kind === "merchant") return this.fillMerchant(s, i);
        if (def.kind === "witch") return this.fillWitch(s, i);
        if (def.kind === "seer") return this.fillSeer(s);
        if (def.kind === "shady") return this.fillShady(s);
        return false;
    }

    /**
     * 「떠돌이 상인」 — 좌판 3개를 **서로 다른 category** 로 뽑는다(30 §3.1).
     * 같은 종류 3개면 선택이 아니라 등급 비교가 된다.
     */
    fillMerchant(s, i) {
        const items = this.items;
        if (!items) return false;
        const cat = ["equip", "relic", "use"][i % 3];
        if (cat === "relic") {
            const rarity = this.relicRarityForPhase();
            const pool = items.relicByRarity[rarity] ?? EMPTY;
            const free = pool.filter((b) => !items.relicTaken(b));
            if (!free.length) return this.fillMerchant(s, i + 1); // 그 등급이 동나면 다음 분류로
            s.base = free[(Math.random() * free.length) | 0];
            s.rarity = items.rarityOf[rarity] ?? 0;
        } else {
            const pool = items.byCat[cat] ?? EMPTY;
            if (!pool.length) return false;
            s.base = pool[(Math.random() * pool.length) | 0];
            s.rarity = cat === "equip" ? items.rarityOf[this.equipRarityForPhase()] ?? 0 : 0;
        }
        const b = items.bases[s.base];
        const rarityId = items.rarities[s.rarity]?.id ?? "common";
        s.kind = "item";
        s.label = b.name;
        s.price = this.cfg.prices.merchant[rarityId] ?? 0.12;
        s.frame = b.icon;
        s.glyphTxt = null;
        s.color = RARITY_COLOR[rarityId] ?? RARITY_COLOR.common;
        return true;
    }

    /** 「재의 마녀」 — 지금 새길 수 있는 룬. 게이트 G-1~G-4 는 RuneSystem 이 이미 건다(31 §4) */
    fillWitch(s, i) {
        if (!this.runes) return false;
        if (i === 0) this.witchPick = this.runes.pick(MAX_SLOTS);
        const r = this.witchPick?.[i];
        if (!r) return false;
        s.kind = "rune";
        s.runeId = r.id;
        s.label = r.name;
        s.price = this.cfg.prices.witch[String(r.tier)] ?? 0.15;
        s.frame = r.icon ?? null;   // 룬 전용 아이콘이 오면 여기서 바로 쓰인다(31 §7)
        s.glyphTxt = r.glyph;       // 그때까지는 유니코드 글리프 폴백
        s.color = [0, 0x7b7488, 0x35c9b4, 0xc9a227][r.tier] ?? 0x7b7488;
        return true;
    }

    /**
     * 「눈먼 예언자」 — 유일한 무료 조우(30 §3.3).
     * ⚠ 정본은 미리보기와 리롤 +1 을 **둘 다** 준다고 적었다. 그래서 좌판을 2개로 갈라
     *   고르게 하지 않고 1개에 둘 다 담았다. 2개로 나누면 정본에 없는 "선택"이 생기고,
     *   무료 조우의 정체성("하나는 순수한 이득이어야 조우를 반기게 된다")이 흐려진다.
     *   대신 "갈 것인가"라는 공간의 선택은 그대로 남는다 — 25초 안에 걸어가야 한다.
     */
    fillSeer(s) {
        s.kind = "seer";
        s.label = "예언";
        s.price = 0;
        s.frame = null;
        s.glyphTxt = KIND_MARK.seer;
        s.color = 0x35c9b4;
        return true;
    }

    /** 「수상한 자」 — 좌판 2개 전부 뒷면. 가격이 같고 결과만 다르다(30 §3.4) */
    fillShady(s) {
        s.kind = "shady";
        s.outcome = rollWeighted(this.cfg.shady.outcomes);
        s.label = "?";
        s.price = this.cfg.prices.shady ?? 0.25;
        s.frame = null;
        s.glyphTxt = "?";
        s.color = 0x6b3fa0;
        return true;
    }

    /**
     * 「현재 페이즈 등급 이상」(30 §3.1). 페이즈 1~4 를 등급 색인에 그대로 태우고
     * 35% 확률로 한 칸 위를 준다 — 상인이 늘 같은 등급만 팔면 좌판이 표가 된다.
     */
    equipRarityForPhase() {
        const list = this.items.rarities;
        const p = this.spawn?.phase?.phase ?? 1;
        let i = Math.min(list.length - 1, Math.max(0, p - 1));
        if (Math.random() < 0.35) i = Math.min(list.length - 1, i + 1);
        return list[i].id;
    }

    /** 유물은 베이스 자신이 등급을 갖는다. 페이즈가 낮으면 rare, 높으면 epic 이상 */
    relicRarityForPhase() {
        const p = this.spawn?.phase?.phase ?? 1;
        if (p >= 4) return Math.random() < 0.4 ? "legendary" : "epic";
        if (p >= 3) return Math.random() < 0.3 ? "legendary" : "epic";
        return Math.random() < 0.35 ? "epic" : "rare";
    }

    // ══ 표시 ═════════════════════════════════════════════════════
    /** 가격을 체력 절대값으로 환산. 비율이 정본이다(30 §2.1) */
    priceHp(pct) { return (this.combat?.maxHp ?? 100) * (pct ?? 0); }

    /**
     * ★ E-3 — 조우로 죽는 일이 없어야 한다 (30 §2.1).
     *   "현재 체력이 가격보다 **적거나 같으면** 살 수 없다". 미만이 아니라 이하다 —
     *   같으면 체력이 정확히 0 이 되고 그건 죽는 것이다.
     */
    canPay(pct) {
        if (!pct) return true;
        return (this.combat?.hp ?? 0) > this.priceHp(pct);
    }

    showSlot(s) {
        const locked = !this.canPay(s.price);
        s.locked = locked;
        const col = locked ? LOCKED_COLOR : s.color;
        s.circle.setPosition(s.x, s.y).setRadius(16).setFillStyle(col, locked ? 0.14 : 0.26)
            .setStrokeStyle(1, col, locked ? 0.4 : 0.9).setVisible(true).setAlpha(1);

        if (s.frame && s.icon && this.hasItemAtlas) {
            s.icon.setTexture("items", s.frame).setPosition(s.x, s.y - 2)
                .setVisible(true).setAlpha(locked ? 0.45 : 1).setScale(1);
            s.glyph.setVisible(false);
        } else {
            s.icon?.setVisible(false);
            s.glyph.setText(s.glyphTxt ?? "?").setPosition(s.x, s.y - 2)
                .setColor(locked ? "#6b6675" : "#f2e8d5").setVisible(true);
        }

        if (s.price > 0) {
            // 문자열 조립은 좌판을 놓을 때 딱 한 번이다 — 매 프레임 경로가 아니다
            s.priceTxt.setText("-" + Math.round(s.price * 100) + "%")
                .setColor(locked ? "#6b6675" : "#c4182b")
                .setPosition(s.x, s.y + 12).setVisible(true);
        } else {
            s.priceTxt.setText("무료").setColor("#35c9b4").setPosition(s.x, s.y + 12).setVisible(true);
        }
    }

    hideSlot(s) {
        s.on = false;
        s.circle.setVisible(false).setPosition(-9999, -9999);
        s.icon?.setVisible(false).setPosition(-9999, -9999);
        s.glyph.setVisible(false).setPosition(-9999, -9999);
        s.priceTxt.setVisible(false).setPosition(-9999, -9999);
    }

    showAltar(at) {
        const d = this.act.def;
        const r = d.radius ?? 34;
        this.altarRing.setPosition(at.x, at.y).setRadius(r)
            .setFillStyle(d.color ?? 0xa21f2d, d.alpha ?? 0.3)
            .setStrokeStyle(1, 0xc4182b, 0.9).setVisible(true).setAlpha(1);
        // 안쪽 원이 3초에 걸쳐 차오른다 = "언제 발동하는가". 낙석 예고와 같은 규약이다
        this.altarFill.setPosition(at.x, at.y).setRadius(1)
            .setFillStyle(0xc4182b, 0.45).setStrokeStyle().setVisible(true).setAlpha(1);
    }

    hideAll() {
        for (const s of this.slots) this.hideSlot(s);
        this.npc?.setVisible(false).setPosition(-9999, -9999);
        this.altarRing.setVisible(false).setPosition(-9999, -9999);
        this.altarFill.setVisible(false).setPosition(-9999, -9999);
        this.arrow.setVisible(false);
        this.arrowMark.setVisible(false);
    }

    // ══ 매 프레임 ═════════════════════════════════════════════════
    /**
     * ★ 이 함수 안에서 scene.pause() 를 부르지 않는다(I-3 / 검증 E-1).
     *   조우가 진행되는 동안에도 몬스터는 계속 쫓아온다. 그것이 조우의 긴장 그 자체다.
     */
    update(dt) {
        if (this.combat?.dead) return;
        if (!this.schedule) this.buildSchedule();
        this.tickDirector();
        // 필드보스는 조우가 해소된 뒤에도 살아 있을 수 있다(잡으러 갈 때까지) — 먼저 본다
        if (this.fb.on) this.tickFieldBoss(dt);
        if (!this.act.on) return;

        this.act.life -= dt;
        if (this.act.life <= 0) { this.expire(false); return; }
        this.tickBlink();

        if (this.act.kind === "altar") this.tickAltar(dt);
        else if (this.act.kind !== "chest" && this.act.kind !== "fieldboss") this.tickSlots();

        this.drawArrow();
    }

    tickDirector() {
        if (this.act.on || !this.schedule) return;
        const t = this.spawn?.elapsed ?? 0;
        while (this.winIndex < this.schedule.length && t >= this.schedule[this.winIndex].at) {
            const w = this.schedule[this.winIndex++];
            // ⚠ 필드보스는 bossAt 이후에는 살 수 없다(30 §3.6 각주) — SpawnSystem.js:231 이
            //   elapsed >= bossAt 에서 suppressed 를 자동으로 켜기 때문이다. 창이 그 앞이라
            //   보통은 안 걸리지만, 지터·프레임 지연으로 넘칠 수 있어 여기서도 막는다.
            const st = {
                prev: this.prevKind,
                used: this.usedCount,
                runeOffers: this.runes?.offerable?.().length ?? 0,
                tollAvail: this.hasToll(),
            };
            const def = this.drawKind(w.pool, st);
            if (!def) continue;
            if (def.kind === "fieldboss" && t >= (this.spawn?.bossAt ?? 360) - 30) continue;
            if (this.beginEncounter(def)) return;
        }
    }

    /** 마지막 blinkLast 초 동안 점멸한다. 예고 없이 없어지면 플레이어는 버그로 읽는다 */
    tickBlink() {
        const d = this.act.def;
        const n = d.blinkLast ?? 0;
        if (!n || this.act.life > n) return;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(this.scene.time.now * 0.011));
        this.npc?.setAlpha(a);
        for (const s of this.slots) if (s.on) s.circle.setAlpha(a);
        // 제단은 점멸이 아니라 서서히 옅어진다(30 §4.4) — 붉은 원이 깜빡이면 낙석 예고로 읽힌다
        if (this.act.kind === "altar") {
            const k = Math.max(0, this.act.life / n);
            this.altarRing.setAlpha(k);
            this.altarFill.setAlpha(k);
        }
    }

    /** 좌판 밟기. 판정 반경은 ItemSystem 의 픽업(12px)과 같은 급이다 */
    tickSlots() {
        const r2 = (this.spawnCfg.pickRadius ?? 14) ** 2;
        const px = this.player.x, py = this.player.y;
        for (const s of this.slots) {
            if (!s.on) continue;
            // 잠긴 좌판은 밟아도 아무 일이 없다(30 §5). 매 프레임 다시 보는 이유는
            // 체력이 회복되면 그 순간부터 살 수 있어야 하기 때문이다.
            const locked = !this.canPay(s.price);
            if (locked !== s.locked) this.showSlot(s);
            if (dist2(s.x, s.y, px, py) > r2) continue;
            if (s.locked) continue;
            this.buy(s);
            return;
        }
    }

    /**
     * 「피의 제단」 — 3초간 서 있어야 발동한다(30 §3.5).
     * 밟자마자가 아닌 이유: 실수로 밟는 사고를 막고, 3초 동안 포위될 위험을 감수하게 하려는 것이다.
     */
    tickAltar(dt) {
        const d = this.act.def;
        const r = d.radius ?? 34;
        const inside = dist2(this.player.x, this.player.y, this.act.x, this.act.y) <= r * r;
        const need = d.channelSec ?? 3;
        // 나가면 처음부터 — 들락거리며 조금씩 채우면 "3초를 버틴다"가 아니게 된다
        this.channel = inside ? this.channel + dt : 0;
        this.altarFill.setRadius(Math.max(1, r * Math.min(1, this.channel / need)));
        if (this.channel < need) return;
        this.grantAltar();
    }

    // ══ 지불과 보상 ═══════════════════════════════════════════════
    /**
     * ★ combat.hurt() 를 부르지 않는다.
     *   hurt 는 방어율·무적프레임·각성 훅을 전부 태우고 hp<=0 이면 die() 를 부른다.
     *   피로 값을 치르는 것은 "피해"가 아니라 "지불"이라 정확히 그 값만 깎여야 하고,
     *   무엇보다 **조우로 죽는 일은 없어야 한다**(30 §2.1). 그래서 직접 감산하고 1 에서 막는다.
     *   (StageSystem.gimSanctuary 가 회복을 직접 쓰는 것과 같은 자리다)
     */
    pay(pct) {
        if (!pct) return true;
        const c = this.combat;
        const cost = this.priceHp(pct);
        if (!c || c.hp <= cost) return false;
        c.hp = Math.max(1, c.hp - cost);
        this.scene.cameras.main.flash(120, 160, 20, 40, false);
        return true;
    }

    buy(s) {
        if (!this.pay(s.price)) return;
        let label = s.label;
        if (s.kind === "item") label = this.grantItem(s);
        else if (s.kind === "rune") label = this.grantRune(s);
        else if (s.kind === "seer") label = this.grantSeer();
        else if (s.kind === "shady") label = this.grantShady(s);

        this.act.resolved = true;
        EventBus.emit(EVENTS.ENCOUNTER_RESOLVED, {
            id: this.act.id, kind: this.act.kind, choice: s.kind, label,
        });
        this.scene.audio?.sfx?.("pickup");
        // "하나만 살 수 있다"(30 §3.1) — 하나를 밟는 순간 나머지 좌판은 사라지고 NPC 는 떠난다.
        // "셋 중 하나"가 선택이고 "셋 다"는 선택이 아니다.
        if (this.act.def.onePurchaseOnly !== false) this.expire(true);
    }

    /**
     * 산 물건을 **플레이어 발밑에 떨군다**. 직접 장착시키지 않는 이유:
     * ItemSystem.pickup 이 자동 장착·점수 비교·유물 규칙·획득 토스트를 전부 갖고 있다.
     * 여기서 따로 구현하면 규칙이 두 벌이 되고, 반드시 어긋난다.
     * 좌표가 정확히 플레이어라 다음 items.update 에서 곧바로 주워진다(PICK_R2 = 12²).
     */
    grantItem(s) {
        const b = this.items?.bases?.[s.base];
        if (!b) return s.label;
        this.items.place(s.base, s.rarity, this.player.x, this.player.y);
        return b.name;
    }

    /**
     * 룬 + 대가 1개 (30 §3.2). ★ 마녀의 룬에는 대가가 하나 붙는다 —
     * 이 게임에서 강해지는 것은 언제나 대가를 동반한다는 PACT 의 문법을 조우가 그대로 쓴다.
     */
    grantRune(s) {
        if (!this.runes?.engrave(s.runeId)) return "새길 수 없다";
        const toll = this.applyToll(this.act.def.tollRarity ?? "common");
        return s.label + (toll ? " + " + toll.name : "");
    }

    /** 「눈먼 예언자」 — 다음 레벨업 카드 3장 미리보기 + 리롤 +1 */
    grantSeer() {
        const c = this.combat;
        const d = this.act.def;
        let cards = null;
        if (c && this.pact) {
            // ★ 보여준 카드가 실제로 나와야 예언이다. 그래서 지금 뽑아 두고 CombatSystem 이
            //   다음 레벨업에서 그대로 쓴다(CombatSystem.previewCards). 따로 뽑으면 거짓말이 된다.
            cards = this.pact.generate(c.level + 1);
            c.previewCards = cards;
            c.previewLine = this.pact.lastLine;
        }
        const cap = d.rerollCap ?? 4;
        if (this.pact) this.pact.rerollLeft = Math.min(cap, this.pact.rerollLeft + (d.rerollBonus ?? 1));
        EventBus.emit(EVENTS.SEER_PREVIEW, {
            cards, atLevel: (c?.level ?? 0) + 1, rerollLeft: this.pact?.rerollLeft ?? 0,
        });
        return "예언 + 리롤";
    }

    /** 「수상한 자」 — 대박 45 / 꽝 45 / 함정 10 (30 §3.4) */
    grantShady(s) {
        const o = s.outcome;
        if (!o) return "빈손";
        if (o.id === "jackpot") {
            const r = this.items?.spawnRelic(this.player.x, this.player.y, o.relicRarity ?? "legendary")
                ?? this.items?.spawnRelic(this.player.x, this.player.y, "epic");
            return r ? "전설 유물" : "빈손";
        }
        if (o.id === "trap") {
            this.summonElites(o.eliteCount ?? 3);
            return "매복";
        }
        return "빈손";
    }

    /** 함정 — 주변에 정예 n체. SpawnSystem 의 기존 경로를 그대로 쓴다(등장 이벤트·카메라 흔들림 포함) */
    summonElites(n) {
        const pool = this.stagePool(this.elites);
        if (!pool.length || !this.spawn) return;
        for (let i = 0; i < n; i++) {
            const def = pool[(Math.random() * pool.length) | 0];
            this.spawn.spawnElite(def.id);
        }
    }

    /**
     * 「피의 제단」 — 큰 축복 1개(epic 고정) + 대가 1개 (30 §3.5).
     * ★ 대가는 태그 중첩에 그대로 들어간다. 그래서 제단은 **각성을 앞당기는 유일한 조우**다.
     *
     * ★ 인간성을 받는다 (2026-08-11 수정 / 30 §2.3 · §3.5)
     *   고치기 전의 제단은 PACT epic 카드의 **순수 상위 호환**이었다. 같은 것(epic 축복 + 대가 1개)을
     *   주면서 체력도 인간성도 받지 않았고, 비용은 "포위된 채 3초 서 있기"뿐이며 런당 2회다.
     *   30 §2.3 「왜 인간성이 아닌가」와 부딪치지 않는다 — 그 절이 거부한 것은
     *   **구매 화폐로서의 인간성**(= 좌판에서 물건을 산다)이다. "대가를 받으면 인간성이 깎인다"는
     *   04-PACT §3 이 이미 정한 **기존 규칙**이고, 제단은 물건을 사는 게 아니라
     *   **PACT 를 스스로 찾아가는 것**이다. 새 소비처가 아니라 원래 있던 소비처다.
     *   그래서 마녀는 그대로 두었다 — 마녀는 산다(applyToll 주석).
     *   그래도 제단은 갈 값이 있다: 3장 무작위가 아니라 **epic 확정**이고 **스스로 고른 것**이다.
     * ★ 제단 전용 계산식을 만들지 않는다. 축복·대가·인간성을 카드 하나에 실어 pact.choose() 에
     *   넘긴다 — PactSystem.choose 의 `humanity = Math.max(0, humanity - card.humanityCost)` 그 줄이
     *   레벨업 카드가 지나는 바로 그 줄이다. 값도 tolls.json 의 humanityCost 를 그대로 쓴다.
     */
    grantAltar() {
        const d = this.act.def;
        const pact = this.pact;
        const combat = this.combat;
        if (!pact || !combat) { this.expire(true); return; }
        const pool = pact.candidates();
        if (!pool.length) { this.expire(true); return; }
        const b = pool[(Math.random() * pool.length) | 0];
        const rarity = d.blessingRarity ?? "epic";
        const tollRarity = d.tollRarity ?? "rare";
        // 대가를 먼저 고른다. 각성 상한 등으로 후보가 없으면 null 이고 그러면 인간성도 0 이다 —
        // "아무것도 안 잃었는데 인간성만 잃는다"를 막는 PactSystem.generate 의 규약과 같다.
        const toll = this.rollToll(tollRarity);
        // tollHumanity 는 데이터가 켠다(encounters.json). 마녀에게는 없다 — 마녀는 산다.
        const cost = toll && d.tollHumanity ? (pact.cfg.humanityCost[tollRarity] ?? 0) : 0;
        const card = {
            index: -1, rarity, blessing: pact.describeBlessing(b, rarity), toll, humanityCost: cost,
        };
        const r = pact.choose(card);
        if (r.weapon) combat.addWeapon(r.weapon.target, r.weapon.level);
        this.afterPact(toll, "altar", cost);
        EventBus.emit(EVENTS.ENCOUNTER_RESOLVED, {
            id: this.act.id, kind: "altar", choice: "altar",
            label: card.blessing.name + (toll ? " + " + toll.name : ""),
        });
        this.scene.cameras.main.flash(220, 190, 20, 45, false);
        this.expire(true);
    }

    /**
     * 대가 1개를 고르고 서술한다. PACT 카드와 **같은 문법**이다(30 §3.2/§3.5) —
     * pickToll -> describeToll 을 그대로 부르므로 태그 6종·등급 배율·중첩 수가 전부 같다.
     * ★ allowOverflow 는 false 로 고정한다. 각성 상한(2)을 넘겨 인간성만 −20 맞는 대가는
     *   04-PACT §6 이 "마지막 장에만" 허용한 것이고, 조우에는 마지막 장이 없다.
     *   그래서 제단이 아무리 여러 번 발동해도 상한이 깨지지 않는다.
     */
    /**
     * 지금 줄 수 있는 대가가 하나라도 있는가 (규칙 5 / 30 §3.5).
     * ★ 게임의 난수 흐름을 건드리지 않으려고 상수 rng 를 넘긴다 — pickToll 은 후보가 비면
     *   rng 를 쓰기 전에 null 을 돌려주므로, 여기서 중요한 "비었는가"는 rng 와 무관하다.
     */
    hasToll(rarityId = "rare") {
        const pact = this.pact;
        if (!pact?.pickToll) return false;
        return pact.pickToll(() => 0, EMPTY_SET, rarityId, false) != null;
    }

    rollToll(rarityId) {
        const pact = this.pact;
        if (!pact) return null;
        const t = pact.pickToll(Math.random, EMPTY_SET, rarityId, false);
        return t ? pact.describeToll(t, rarityId) : null;   // 후보가 없으면 대가 없이 지나간다
    }

    /**
     * 대가/축복을 적용한 뒤의 뒷정리. ★ CombatSystem.applyCard 와 **같은 순서**다 —
     * 현재 체력 클램프 → PACT_APPLIED → 각성 → 인간성 0 「완전 흡혈귀화」.
     * 순서를 바꾸면 HUD 가 한 박자 옛 값을 보여주거나 각성이 조용히 사라진다.
     * @param {object|null} toll describeToll 결과. 없으면 축복만 적용된 것이다
     * @param {number} humanityCharged 실제로 깎은 인간성. 0 이면 인간성 0 판정을 하지 않는다
     */
    afterPact(toll, source, humanityCharged) {
        const pact = this.pact;
        const combat = this.combat;
        // 최대 체력이 깎였으면 현재 체력도 따라 내려야 한다(CombatSystem.applyCard 와 같은 자리)
        if (combat) combat.hp = Math.min(combat.hp, combat.maxHp);
        EventBus.emit(EVENTS.PACT_APPLIED, {
            level: combat?.level ?? 1,
            humanity: pact?.humanity ?? 100,
            tagCounts: { ...(pact?.tagCounts ?? {}) },
            ownedBlessings: { ...(pact?.owned ?? {}) },
            source,
        });
        // 각성은 PACT 와 같은 경로로 터뜨린다. 대가를 쌓는 문이 둘인데 각성 문이 하나면
        // "조우로 3중첩을 채웠는데 각성이 안 온다"는 조용한 버그가 된다.
        if (toll?.triggersAwakening && combat?.awakening?.trigger(toll.tag)) {
            const def = combat.awakening.defs?.[toll.tag];
            EventBus.emit(EVENTS.AWAKENING_TRIGGERED, {
                tag: toll.tag, list: [...combat.awakening.list], awakeningId: def?.id,
                name: def?.name, quote: def?.quote, desc: def?.desc, sigil: def?.sigil,
                atLevel: combat.level,
            });
        }
        // ★ 인간성 0 「완전 흡혈귀화」 — CombatSystem.applyCard 의 T511 과 같은 자리다.
        //   여기서 안 쏘면 제단으로 인간성이 0 이 됐는데 각성도 엔딩 분기도 안 바뀐다.
        //   0 은 죽는 것이 아니라 최종 각성이다(04-PACT §5.4) — 제단이 플레이어를 죽이지 않는다.
        if (humanityCharged > 0 && (pact?.humanity ?? 1) <= 0 && combat && !combat.ascended) {
            combat.ascended = true;
            EventBus.emit(EVENTS.HUMANITY_ZERO, { humanity: 0 });
            combat.awakening?.triggerAscension?.();
        }
    }

    /**
     * 대가만 붙인다(마녀). ★ 여기서는 인간성을 깎지 않는다 —
     *   마녀는 **물건을 판다**. 30 §2.3 이 거부한 「구매 화폐로서의 인간성」이 정확히 이 자리다.
     *   값은 이미 체력으로 치렀고(30 §5 의 15/22/32%), 대가는 그 위에 얹히는 문법이다.
     *   인간성을 받는 것은 제단뿐이다(grantAltar 주석) — 제단은 사는 게 아니라 PACT 를
     *   스스로 찾아가는 것이고, 값을 치르는 수단이 대가 하나뿐이다.
     * ⚠ tagCounts/스탯 적용이 PactSystem.choose 와 겹쳐 보이지만 재사용할 수 없다 —
     *   choose 는 축복이 반드시 있어야 하고(owned 갱신), 마녀는 축복을 주지 않는다.
     */
    applyToll(rarityId) {
        const pact = this.pact;
        const d = this.rollToll(rarityId);
        if (!pact || !d) return null;
        pact.tagCounts[d.tag] = d.stacksAfter;
        for (let i = 0; i < d.stacks; i++) {
            pact.stats.add(d.stat, d.stat === "drain" ? "tollAdd" : "toll", d.amount, "toll:" + d.tag);
        }
        this.afterPact(d, "encounter", 0);
        return d;
    }

    // ══ 필드보스 (30 §3.6) ════════════════════════════════════════
    /** 스테이지 소속으로 거른다. 하나도 안 걸리면 전체로 내려간다(StageSystem 의 안전망과 같은 규약) */
    stagePool(list) {
        const id = this.scene.stages?.current?.id;
        if (!id) return list;
        const hit = list.filter((e) => !e.stageAffinity?.length || e.stageAffinity.includes(id));
        return hit.length ? hit : list;
    }

    /**
     * ★ BossSystem 을 부르지 않는다. 세 가지를 반드시 피해야 한다(30 §3.6 표):
     *   suppressed = true (잡몹 영구 정지) / purgeMinions (화면 전멸) / onDefeat -> endRun (런 종료).
     *   SpawnSystem.spawnElite 를 그대로 쓰면 셋 다 일어나지 않는다.
     */
    beginFieldBoss(at) {
        const pool = this.stagePool(this.miniboss);
        if (!pool.length || !this.spawn) return false;
        const def = pool[(Math.random() * pool.length) | 0];
        const e = this.spawn.spawnElite(def.id, at);
        if (!e) return false;

        const c = this.cfg.fieldboss;
        e.maxHp = Math.round(e.maxHp * (c.hpMult ?? 1));
        e.hp = e.maxHp;
        // ★ isElite 를 켠다. 이유는 연출이 아니라 **수명**이다 —
        //   miniboss tier 는 isElite 가 false 라 SpawnSystem.despawnFar 가 900px 밖에서 그냥 죽이고
        //   farthestNormal 이 풀이 꽉 차면 재활용해 버린다. 조우가 소리 없이 사라지는 경로 둘이 막힌다.
        e.isElite = true;
        // 회피 장치 1 — 반경 밖에서는 추적하지 않는다. EnemyAISystem 이 이 필드를 본다
        e.__leashR = c.leashRadius ?? 140;
        e.__leashMul = c.wanderMult ?? 0.28;
        e.__encToken = ++this.fbToken;

        this.fb.on = true;
        this.fb.e = e;
        this.fb.token = e.__encToken;
        this.fb.life = this.act.def.stay ?? 60;
        this.fb.lastHp = e.hp;
        this.fb.engaged = 0;
        // 죽은 이벤트를 살려 쓴다 — ELITE_SPAWNED 는 emit 되는데 구독자가 0이었다(30 §6)
        EventBus.emit(EVENTS.ELITE_SPAWNED, {
            id: def.id, name: this.act.def.name, hp: e.maxHp, x: e.x, y: e.y,
            timeSec: Math.floor(this.spawn.elapsed), field: true,
        });
        return true;
    }

    tickFieldBoss(dt) {
        const e = this.fb.e;
        // 처치 판정 — 풀이 회수했거나(사망) 다른 적으로 재사용됐으면 토큰이 어긋난다
        if (!e || !e.__active || e.__encToken !== this.fb.token) { this.defeatFieldBoss(e); return; }
        if (e.hp <= 0) { this.defeatFieldBoss(e); return; }
        // 조우 좌표를 따라가게 한다 — 화살표가 스폰 지점을 가리키면 거짓말이 된다
        if (this.act.on && this.act.kind === "fieldboss") { this.act.x = e.x; this.act.y = e.y; }
        // 회피 장치 3 — 60초 후 떠난다. 언제까지나 기다려주면 "나중에 강해지고 온다"가
        // 최적해가 되어 선택이 사라진다(30 §3.6)
        //
        // ★ 단, **교전 중이면 이 카운트다운이 멈춘다** (2026-08-11 수정)
        //   SpawnSystem.reset 이 이미 seg.hpMult 를 곱하고 있어(W3 x2.37 / W4 x3.30) 필드보스는
        //   그 시점 빌드로 60초 안에 못 잡는 개체가 있다. 그러면 "무시할 수 있다"를 만들려던
        //   60초가 "싸우기 시작했는데 다 못 잡고 뺏긴다"가 되어, 교전 자체가 손해가 된다.
        //   두 성질을 갈라 둘 다 지킨다 —
        //     안 가면  : 아무도 안 때리므로 60초가 그대로 흘러 떠난다 (E-5 회피 가능성 유지)
        //     가면     : 최근 engageGrace 초 안에 HP 가 줄었으면 타이머가 멈춘다. 끝까지 싸운다
        //   ★ HP 감소로 판정하는 이유: CombatSystem.flushDamage 는 매 프레임 수십 번 도는
        //     핫패스라 거기에 훅을 심으면 조우 하나 때문에 전투 전체가 느려진다.
        //     여기서 지난 프레임 HP 와 비교하면 비용이 0 이고, 무기·룬·각성 어느 경로로 때렸든
        //     빠짐없이 잡힌다(장판·도트 포함).
        const c = this.cfg.fieldboss;
        if (e.hp < this.fb.lastHp) this.fb.engaged = c.engageGrace ?? 5;
        this.fb.lastHp = e.hp;
        if (this.fb.engaged > 0) this.fb.engaged -= dt;
        else this.fb.life -= dt;
        // ★ 하드 상한 — 교전 중이어도 최종 보스 등장 직전에는 반드시 떠난다.
        //   타이머가 멈추는 이상 상한이 없으면 필드보스가 보스전까지 따라 들어와 연전이 된다.
        //   30 §3.6 각주가 "필드보스는 bossAt 이전에만 산다"고 정한 것과 같은 선이다.
        const mustLeave = (this.spawn?.elapsed ?? 0)
            >= (this.spawn?.bossAt ?? 360) - (c.leaveBeforeBoss ?? 15);
        if (this.fb.life > 0 && !mustLeave) return;
        e.__leashR = 0;
        this.spawn?.kill(e, false);   // counted=false — 처치가 아니라 퇴장이다
        this.endFieldBoss();
    }

    /** 보상: 룬 확정 1개 + 「봉인된 궤」 2개. 조우 중 최대 보상이다(30 §3.6) */
    defeatFieldBoss(e) {
        const c = this.cfg.fieldboss;
        const x = e?.x ?? this.act.x, y = e?.y ?? this.act.y;
        const labels = [];
        for (let i = 0; i < (c.rewardRunes ?? 1); i++) {
            const r = this.runes?.pick(1)?.[0];
            if (r && this.runes.engrave(r.id)) labels.push(r.name);
        }
        const spread = c.chestSpread ?? 26;
        for (let i = 0; i < (c.rewardChests ?? 2); i++) {
            const a = (Math.PI * 2 * i) / Math.max(1, c.rewardChests ?? 2) + Math.random();
            this.spawn?.dropChest(x + Math.cos(a) * spread, y + Math.sin(a) * spread, "fieldboss");
        }
        EventBus.emit(EVENTS.ENCOUNTER_RESOLVED, {
            id: "enc_fieldboss", kind: "fieldboss", choice: "kill",
            label: labels.length ? labels.join(" · ") + " + 봉인된 궤 2" : "봉인된 궤 2",
        });
        this.endFieldBoss();
    }

    endFieldBoss() {
        const e = this.fb.e;
        if (e) { e.__leashR = 0; e.__encToken = 0; }
        this.fb.on = false;
        this.fb.e = null;
        if (this.act.on && this.act.kind === "fieldboss") this.expire(true);
    }

    // ══ 봉인된 궤 (30 §3.7) ═══════════════════════════════════════
    /**
     * 이미 있는 것을 살린다. 상자는 SpawnSystem 이 이미 갖고 있었고(풀·드롭·밟기 판정),
     * 문제는 셋뿐이었다 — 노란 사각형 / CHEST_OPENED 구독자 0 / 보상이 축복 1개 고정.
     * 아트와 구독은 각각 SpawnSystem·ui/encounter 가 맡고, 여기서는 **보상 3종 추첨**만 한다.
     *
     * ★ SpawnSystem.openChest 가 부른다. 조우 시스템이 없으면 그쪽이 기존 동작으로 내려간다.
     * @returns {{kind: string, label: string, blessing: object|null}}
     */
    rollChestReward(x, y) {
        const pick = rollWeighted(this.cfg.chest.rewards ?? EMPTY);
        const kind = pick?.kind ?? "blessing";
        // ★ 폴백 **순서**가 확률표만큼 중요하다 (2026-08-11 수정 / 30 §3.7).
        //   고치기 전에는 룬을 못 주면 곧바로 축복으로 떨어졌다. 초반에는 룬 트리 게이트(31 §4)를
        //   통과하는 룬이 하나도 없어 룬 몫 25% 가 통째로 축복에 얹혔고, 400회 시뮬에서
        //   축복 313 / 아이템 82 / 룬 5 — 축복이 78% 였다. "룬 25%"는 표기만 있는 값이었다.
        //   이제 룬 → 아이템 → 축복 순으로 내려간다. 축복이 아니라 아이템이 먼저인 이유는
        //   축복이 이미 55% 로 가장 두껍기 때문이다. 흘러넘친 몫을 또 그쪽에 부으면
        //   상자가 "축복 자판기"가 되고, 세 종을 나눈 의미가 사라진다.
        const order = this.cfg.chest.fallback ?? EMPTY;
        for (let i = Math.max(0, order.indexOf(kind)); i < order.length; i++) {
            const r = this.grantChest(order[i], x, y);
            if (r) return r;
        }
        // 전부 실패했거나 order 에 없는 kind(데이터 오타)면 축복으로 내려간다.
        // 상자를 열었는데 아무 일도 안 일어나는 것이 가장 나쁜 결과다.
        return this.grantChest("blessing", x, y) ?? { kind: "blessing", label: "축복", blessing: null };
    }

    /** 궤 보상 한 종을 실제로 준다. 줄 수 없으면 null 을 돌려 폴백을 태운다 */
    grantChest(kind, x, y) {
        if (kind === "rune") {
            const r = this.runes?.pick(1)?.[0];
            return r && this.runes.engrave(r.id) ? { kind: "rune", label: r.name, blessing: null } : null;
        }
        if (kind === "items") {
            const t = this.items?.normalTable?.();
            if (!t) return null;
            // 개수는 확률표 쪽에 적혀 있다. 상자는 런당 몇 번뿐이라 여기서 찾아도 된다 —
            // 매 프레임 경로가 아니고, 표를 두 곳에 적으면 반드시 어긋난다.
            const n = (this.cfg.chest.rewards ?? EMPTY).find((o) => o.kind === "items")?.count ?? 3;
            let made = 0;
            for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 * i) / n;
                if (this.items.spawnOne(t, x + Math.cos(a) * 16, y + Math.sin(a) * 16)) made++;
            }
            return made ? { kind: "items", label: "아이템 " + made, blessing: null } : null;
        }
        const bl = this.spawn?.grantFreeBlessing?.() ?? null;
        return bl ? { kind: "blessing", label: bl.name, blessing: bl } : null;
    }

    /** 궤는 소멸하지 않는다(30 §4.4) — 배치만 하고 조우 자체는 곧바로 닫는다 */
    beginChest(at) {
        if (!this.spawn) return false;
        this.spawn.dropChest(at.x, at.y, "encounter");
        // 체류 시간을 짧게 잡아 화살표만 잠깐 남긴다. 상자는 그 자리에 그대로 있다.
        this.act.life = 12;
        return true;
    }

    // ══ 화살표 (30 §4.3) ══════════════════════════════════════════
    /**
     * ★ React 가 아니라 여기서 그린다. 좌표가 매 프레임 바뀌기 때문이다(06 §3.3 금지 규칙).
     *   setScrollFactor(0) 이므로 x/y 가 곧 화면 좌표다.
     * ★ 화면 안에 들어오면 숨긴다. 대상 위에 화살표가 겹치면 "저기 있다"가 아니라
     *   "무언가 가려져 있다"로 읽힌다 — 화살표의 용도는 **화면 밖**을 가리키는 것뿐이다.
     */
    drawArrow() {
        const cam = this.scene.cameras.main;
        const w = cam.width, h = cam.height;
        const sx = this.act.x - cam.scrollX;
        const sy = this.act.y - cam.scrollY;
        const m = 22;
        if (sx > m && sx < w - m && sy > m && sy < h - m) {
            this.arrow.setVisible(false);
            this.arrowMark.setVisible(false);
            return;
        }
        const cx = w / 2, cy = h / 2;
        const dx = sx - cx, dy = sy - cy;
        const d = Math.hypot(dx, dy) || 1;
        // 화면 사각형(안쪽 m)의 변에 닿는 지점까지의 배율
        const k = Math.min(
            Math.abs(dx) > 1e-4 ? (cx - m) / Math.abs(dx) : Infinity,
            Math.abs(dy) > 1e-4 ? (cy - m) / Math.abs(dy) : Infinity,
        );
        const ax = cx + dx * k, ay = cy + dy * k;
        this.arrow.setPosition(ax, ay).setRotation(Math.atan2(dy, dx) - Math.PI / 2).setVisible(true);
        // 종류를 알 수 있어야 "갈지 말지"를 정할 수 있다. 화살표만이면 정보가 반쪽이다
        this.arrowMark.setText(KIND_MARK[this.act.kind] ?? "?")
            .setPosition(ax - (dx / d) * 12, ay - (dy / d) * 12).setVisible(true);
    }

    // ══ 정리 ═════════════════════════════════════════════════════
    expire(resolved) {
        const id = this.act.id, kind = this.act.kind;
        this.act.on = false;
        this.act.def = null;
        this.channel = 0;
        this.hideAll();
        // 필드보스는 조우 표시가 끝나도 적으로서는 계속 살아 있다 — 여기서 죽이지 않는다.
        // 죽이면 "가는 중에 사라졌다"가 되고, 60초 체류가 의미를 잃는다.
        if (!resolved) EventBus.emit(EVENTS.ENCOUNTER_EXPIRED, { id, kind });
    }

    clear() {
        if (this.fb.e) { this.fb.e.__leashR = 0; this.fb.e.__encToken = 0; }
        this.fb.on = false;
        this.fb.e = null;
        this.act.on = false;
        this.hideAll();
        this.prevKind = null;
        this.usedCount = Object.create(null);
        this.schedule = null;
        this.winIndex = 0;
    }
}
