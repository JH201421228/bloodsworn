/**
 * ItemSystem — 드롭 / 획득 / 자동 장착 / 접두·접미. (6개월 확장 / I-1)
 *
 * 설계 정본: docs/23-ITEM-SYSTEM.md · 데이터: data/{items,affixes,droptables}.json
 *
 * ★ 왜 아이템을 붙이는가 — 「런 안의 변주」
 *   런 밖 성장은 성소(sanctum.json)가 이미 맡고 있다. 같은 일을 하는 시스템이 둘이면
 *   플레이어는 "골드를 성소에 쓸까 장비에 쓸까"라는, 재미도 없고 되돌릴 수도 없는 계산을
 *   강요당한다. 그래서 여기서 나오는 것은 전부 런과 함께 사라진다. 남는 건 골드뿐이다.
 *
 * ★ PACT 와 역할이 겹치지 않게 하는 불변식 (23 문서 2 — 이 파일에서 가장 중요한 주석)
 *   I-1 인간성을 읽지도 쓰지도 않는다.
 *   I-2 스탯을 깎지 않는다 — op 는 add/mul 뿐이다. toll/tollAdd 는 PACT 의 전유물이다.
 *       대가가 붙는 순간 "안 밟는 게 이득인 드롭"이 생기고, 그 순간 자동 획득 전제가 무너진다.
 *   I-3 게임을 멈추지 않는다 — scene.pause() 를 부르지 않는다. 긴장이 끊기는 지점은 PACT 하나다.
 *   I-4 무기를 주지 않는다 — combat.addWeapon 을 부르지 않는다. 빌드의 뼈대가 운으로 정해지면 안 된다.
 *   I-5 각성에 관여하지 않는다 — 대가 태그를 쌓지 않는다.
 *   수치 축은 겹친다. 그러나 축복은 +20~50%를 대가와 함께 영구히 주고, 아이템은 +3~12%를
 *   말없이 얹었다 더 좋은 게 나오면 사라진다. 전자는 결정이고 후자는 날씨다.
 *
 * ★ 조작 예산 0탭 (23 문서 3)
 *   자석 반경 안이면 끌려오고 닿으면 먹는다. 소모품은 즉시 발동하고 장비는 점수를 비교해
 *   알아서 갈아 끼운다. 아이템 때문에 화면을 탭하는 경우는 없다. UI 는 알림만 한다.
 *
 * ★ 런 중 new 금지 (06-TECH 5.1)
 *   드롭은 스프라이트 풀 64칸이 전부고, 각 칸은 base/prefix/suffix/rarity **인덱스 정수**만 든다.
 *   이름 문자열("굶주린 송곳니 · 갈증의")은 React 가 표시할 때 조립한다(ui/inventory/itemText.js).
 *   장비 기록 12칸, 버프 슬롯(베이스당 1칸), src 문자열까지 전부 생성자에서 만들어 둔다.
 *
 * ★ 스탯은 반드시 stats.add(stat, op, value, src) 로만 넣는다
 *   직접 수치를 만지면 계산 순서(기본→가산→곱연산→대가→각성→하한)가 무너진다.
 *   src 규약은 "item:" + base.id 이고, 해제는 stats.removeBySrc(src) 한 줄이다.
 *
 * ★ 피해는 combat.queueDamage 로만 넣는다
 *   hp 를 직접 깎으면 한 프레임에 여러 소스가 때렸을 때 사망이 중복 처리되어 EXP 가 2배 드롭된다.
 *
 * ── 통합 계약 (GameScene / CombatSystem 이 이대로 부른다) ──
 *   new ItemSystem(scene, { player, combat, stats, spawn })
 *   .rollDrop(enemy)         : 적 처치 시 호출. 드롭 테이블을 굴려 월드에 떨군다
 *   .update(dt)              : 자석 / 획득 / 수명 / 버프 만료 / 유물 규칙
 *   .equip(itemId) / .unequip(slot)
 *   .inventory               : 현재 런의 보유 아이템(장비 3 + 유물 n)
 *   .clear()
 */
import { Pool } from "../pools/Pool";
import { DEPTH, EVENTS } from "../constants";
import { EventBus } from "../EventBus";
import { dist2, swapPop } from "../utils/math";
import itemsData from "@/data/items.json";
import affixData from "@/data/affixes.json";
import dropData from "@/data/droptables.json";

/**
 * 아이템 전용 이벤트.
 * ★ EQUIPPED / RELICS 는 제거했다 — 선언만 하고 한 번도 쏘지 않는 죽은 코드였고,
 *   UI 는 PICKED 하나로 전부 유도한다. pickup() 이 taken===true 일 때만 쏘고
 *   장비는 applyEquip() 이 "점수가 더 높을 때만" true 를 돌려주므로
 *   **PICKED = 실제로 갈아입음**이 성립하기 때문이다. 이벤트를 늘릴 이유가 없었다.
 * ★ 문자열은 constants.js 의 EVENTS.ITEM_PICKED 와 같아야 한다. 두 곳에 적으면 어긋난다.
 */
export const ITEM_EVENTS = { PICKED: EVENTS.ITEM_PICKED };

/** 23 문서 8. 풀 64칸은 P4 정상치(≈13개)의 5배 — 엘리트/보스 폭발 대비다 */
const MAX_DROPS = 64;
/** 장비 3 + 유물 6 = 9. 12 는 교체 순간 새 기록과 옛 기록이 동시에 살아 있는 한 프레임 대비 */
const MAX_RECORDS = 12;
const ATLAS = "items";
const FALLBACK_TEX = "item-fallback";
/** 유물 아이콘은 32px, 나머지는 16px. 크기 차이가 그대로 정보 위계다(23 문서 7.2) */
const RELIC_ICON = 32;
/** 바닥에 남는 시간(초). 짧으면 놓치고 길면 화면이 지저분해진다 */
const DROP_LIFE = 25;
/** 자석 반경 기본값(px). magnet 스탯이 곱해진다 */
const PICK_MAGNET = 56;
/** 획득 판정 거리의 제곱 */
const PICK_R2 = 12 * 12;
/** 끌려오는 속도(px/s) */
const PICK_SPEED = 190;
/** 「탐욕의 왕관」 전체 흡인 주기(초) */
const MAGNET_PULSE_EVERY = 6;
/** 「중력의 사슬」 감속 오라 반경(px)과 배율 */
const SLOW_AURA_R = 110;
const SLOW_AURA_MULT = 0.7;
const EMPTY_ARR = [];

/** 아틀라스가 아직 안 구워졌어도 게임이 죽으면 안 된다. 양피지색 점 하나로라도 굴린다 */
function buildFallback(scene) {
    if (scene.textures.exists(FALLBACK_TEX)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xc9b792, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture(FALLBACK_TEX, 8, 8);
    g.destroy();
}

/** id -> 배열 인덱스. 런 중에는 문자열 대신 이 정수만 들고 다닌다 */
function indexById(arr) {
    const m = Object.create(null);
    for (let i = 0; i < arr.length; i++) m[arr[i].id] = i;
    return m;
}

export class ItemSystem {
    constructor(scene, ctx = {}) {
        this.scene = scene;
        this.player = ctx.player;
        this.combat = ctx.combat;
        this.stats = ctx.stats;
        this.spawn = ctx.spawn;

        this.bases = itemsData.bases;
        this.rarities = itemsData.rarities;
        this.slotIds = itemsData.slots.map((s) => s.id);
        this.maxRelics = itemsData.maxRelics ?? 6;
        this.prefixes = affixData.prefixes;
        this.suffixes = affixData.suffixes;
        this.weights = affixData.weights;
        this.tune = dropData.tuning;

        this.baseOf = indexById(this.bases);
        this.rarityOf = indexById(this.rarities);
        // 문자열은 전부 부팅 시점에 만든다. 런 중 문자열 생성 0 (23 문서 8)
        this.srcOf = this.bases.map((b) => "item:" + b.id);
        this.haloFrame = this.rarities.map((r) => "itm_halo_" + r.id);

        this.buildIndex();
        this.buildAffixTable();

        buildFallback(scene);
        this.hasAtlas = scene.textures.exists(ATLAS);
        if (!this.hasAtlas) console.warn("[ItemSystem] 아이템 아틀라스가 없다 — npm run build:items 를 돌려라");
        const tex = this.hasAtlas ? ATLAS : FALLBACK_TEX;

        // 후광이 아이콘보다 한 겹 아래. 같은 아틀라스라 깊이가 둘로 갈려도 배칭은 2회로 끝난다
        this.halos = new Pool(MAX_DROPS, () => {
            const s = scene.add.sprite(-999, -999, tex);
            s.setDepth(DEPTH.ORB).setVisible(false);
            return s;
        });
        this.drops = new Pool(MAX_DROPS, (i) => {
            const s = scene.add.sprite(-999, -999, tex);
            s.setDepth(DEPTH.ORB + 1).setVisible(false);
            s.__halo = this.halos.items[i]; // 1:1 고정 짝. 매번 짝을 찾으면 그것도 비용이다
            return s;
        });

        /** 장비/유물 기록. 런 중 객체를 만들지 않으려고 미리 파 둔 칸이다 */
        this.records = new Array(MAX_RECORDS);
        for (let i = 0; i < MAX_RECORDS; i++) {
            this.records[i] = { used: false, base: -1, prefix: -1, suffix: -1, rarity: 0, score: 0 };
        }

        /** @type {object[]} 계약상 노출되는 보유 목록 = 장비 3 + 유물 n */
        this.inventory = [];
        this.equipped = { fang: null, hide: null, charm: null };
        this.relics = [];

        this.buildBuffSlots();
        this.resetRules();

        // 매 프레임 배열을 새로 만들지 않기 위한 재사용 버퍼
        this.queryBuf = [];
        this.slowMarked = [];
        this.pulseT = 0;
        this.pulseUntil = 0;
        this.auraT = 0;
        this.secondWindUsed = false;
    }

    /** 카테고리·슬롯·유물등급별 인덱스 목록. 추첨할 때마다 filter 를 돌리지 않으려는 표다 */
    buildIndex() {
        this.byCat = { use: [], gold: [], equip: [], relic: [] };
        this.bySlot = Object.create(null);
        for (const s of this.slotIds) this.bySlot[s] = [];
        this.relicByRarity = Object.create(null);
        for (const r of this.rarities) this.relicByRarity[r.id] = [];

        for (let i = 0; i < this.bases.length; i++) {
            const b = this.bases[i];
            (this.byCat[b.category] ??= []).push(i);
            if (b.category === "equip" && this.bySlot[b.slot]) this.bySlot[b.slot].push(i);
            if (b.category === "relic") this.relicByRarity[b.rarity ?? "rare"].push(i);
        }
    }

    /**
     * 베이스마다 붙을 수 있는 접두·접미를 미리 걸러 둔다.
     *   R1 태그 교집합 — base.affixTags ∩ affix.tags ≠ ∅ 여야 붙는다.
     *      「가죽(방어)」에 「머나먼(사거리)」 같은 무의미 조합을 여기서 끊는다.
     *   R4 분류 제한 — use/gold/relic 에는 아예 표를 만들지 않는다.
     * ★ 매 드롭마다 32종을 훑으면 P4 초당 드롭 × 32 × 2 회다. 부팅 때 한 번이면 0회가 된다.
     */
    buildAffixTable() {
        this.prefixFor = new Array(this.bases.length);
        this.suffixFor = new Array(this.bases.length);
        this.prefixTotal = new Float64Array(this.bases.length);
        this.suffixTotal = new Float64Array(this.bases.length);

        for (let i = 0; i < this.bases.length; i++) {
            const b = this.bases[i];
            if (b.category !== "equip" || !b.affixTags) {
                this.prefixFor[i] = EMPTY_ARR;
                this.suffixFor[i] = EMPTY_ARR;
                continue;
            }
            this.prefixFor[i] = this.matchAffixes(this.prefixes, b.affixTags, i, this.prefixTotal);
            this.suffixFor[i] = this.matchAffixes(this.suffixes, b.affixTags, i, this.suffixTotal);
        }
    }

    matchAffixes(pool, tags, baseIdx, totals) {
        const out = [];
        let total = 0;
        for (let k = 0; k < pool.length; k++) {
            const a = pool[k];
            let hit = false;
            for (const t of a.tags) if (tags.includes(t)) { hit = true; break; }
            if (!hit) continue;
            out.push(k);
            total += a.weight;
        }
        totals[baseIdx] = total;
        return out;
    }

    /**
     * 버프 슬롯. 소모품 중 effect.type === "buff" 인 베이스마다 **정확히 한 칸**을 판다.
     * ★ 같은 물약을 연속으로 먹으면 중첩이 아니라 지속시간 갱신이다.
     *   중첩을 허용하면 「격노의 정수」 5개를 모아 밟는 순간 damage +175% 가 되어
     *   PACT 축복 전체보다 세진다 — 아이템은 작은 변주여야 한다(23 문서 2).
     *   슬롯이 하나면 src 도 "item:"+id 하나라 removeBySrc 로 깔끔하게 지워진다.
     */
    buildBuffSlots() {
        this.buffs = [];
        this.buffSlotOf = new Int8Array(this.bases.length).fill(-1);
        for (let i = 0; i < this.bases.length; i++) {
            const e = this.bases[i].effect;
            if (!e || e.type !== "buff") continue;
            this.buffSlotOf[i] = this.buffs.length;
            this.buffs.push({ base: i, until: 0, active: false });
        }
    }

    /** 유물 규칙 플래그. 수치가 아니라 '규칙'을 바꾸는 것이 유물의 정체성이다(23 문서 4) */
    resetRules() {
        this.rule = {
            magnetPulse: false, slowAura: false, secondWind: false,
            goldSalvage: false, burstOnUse: false,
        };
    }

    // ── 드롭 ────────────────────────────────────────────────
    /**
     * 적 처치 시 CombatSystem.flushDamage 가 부른다.
     * @returns {number} 실제로 떨어뜨린 개수 (0 이면 꽝)
     */
    rollDrop(enemy) {
        if (!enemy || this.combat?.dead) return 0;
        const x = enemy.x, y = enemy.y;

        if (enemy.isBoss) return this.dropBundle(dropData.boss, x, y);
        if (enemy.isElite) return this.dropBundle(dropData.elite, x, y);

        const t = this.normalTable();
        // itemFind 는 '확률'만 민다. 등급까지 밀면 luck 과 두 축으로 곱해져 후반이 통제 불능이 된다
        const find = this.stats?.get("itemFind") ?? 1;
        if (Math.random() >= t.chance * find) return 0;
        return this.spawnOne(t, x, y) ? 1 : 0;
    }

    /** 현재 페이즈의 일반 적 테이블. spawn 이 없으면(디버그 씬) P1 로 본다 */
    normalTable() {
        const n = this.spawn?.phase?.phase ?? 1;
        const list = dropData.normal;
        return list[Math.min(list.length - 1, Math.max(0, n - 1))];
    }

    /** 엘리트/보스 — 확률 없이 정해진 개수를 준다. 보스는 legendary 유물 1개를 보장한다 */
    dropBundle(t, x, y) {
        let n = 0;
        const forced = t.guaranteedLegendaryRelics ?? 0;
        for (let i = 0; i < forced; i++) if (this.spawnRelic(x, y, "legendary")) n++;
        for (let i = n; i < t.count; i++) if (this.spawnOne(t, x, y)) n++;
        return n;
    }

    /** 한 개 굴린다. 유물 판정 → 카테고리 → 베이스 → 등급 → 접사 순서다 */
    spawnOne(t, x, y) {
        if (Math.random() < (t.relicChance ?? 0)) {
            const r = this.spawnRelic(x, y, this.rollRarity(t.rarityWeights));
            if (r) return r;
            // 그 등급의 유물이 이미 전부 나왔으면 조용히 일반 드롭으로 떨어진다
        }
        const cat = this.rollCategory(t.categoryWeights ?? dropData.categoryWeights);
        const list = this.byCat[cat];
        if (!list?.length) return null;
        const base = list[(Math.random() * list.length) | 0];
        const rarity = cat === "equip" ? this.rarityOf[this.rollRarity(t.rarityWeights)] : 0;
        return this.place(base, rarity, x, y);
    }

    /**
     * 유물은 베이스 자신이 등급을 갖는다(items.json rarity). 같은 유물을 두 번 주지 않는다 —
     * 규칙은 중첩할 수 없고, 「탐욕의 왕관」이 두 개여도 오브는 한 번만 끌려온다.
     */
    spawnRelic(x, y, rarityId) {
        const pool = this.relicByRarity[rarityId];
        if (!pool?.length) return null;
        // 이미 가진 것과 이미 바닥에 있는 것을 뺀 나머지에서 고른다
        let n = 0;
        for (let i = 0; i < pool.length; i++) if (!this.relicTaken(pool[i])) n++;
        if (n === 0) return null;
        let pick = (Math.random() * n) | 0;
        for (let i = 0; i < pool.length; i++) {
            if (this.relicTaken(pool[i])) continue;
            if (pick-- === 0) return this.place(pool[i], this.rarityOf[rarityId], x, y);
        }
        return null;
    }

    relicTaken(baseIdx) {
        for (const r of this.relics) if (r.base === baseIdx) return true;
        const list = this.drops.active;
        for (let i = 0; i < list.length; i++) if (list[i].__base === baseIdx) return true;
        return false;
    }

    /**
     * 등급 추첨. luck 은 PACT 와 **같은 방식으로** common 가중치를 상위로 '옮긴다'.
     * 더하지 않고 옮기는 이유: 더하면 총합이 커져 luck 이 커질수록 체감이 줄어든다(수확체감).
     * 새 스탯을 만들지 않고 기존 luck 을 재사용해야 성소·축복·아이템이 한 지표로 모인다.
     */
    rollRarity(w) {
        if (!w) return "common";
        const luck = Math.min(0.5, this.stats?.get("luck") ?? 0);
        const shift = (w.common ?? 0) * luck;
        const map = this.tune.luckShiftTo;
        // 옮겨 갈 곳이 없는 등급(일반 적의 legendary=0)에 배분된 몫은 버리지 않고
        // 열려 있는 등급에 다시 나눈다. 버리면 총합이 줄어 common 이 반사이익을 본다.
        let share = 0, total = 0;
        for (const r of this.rarities) {
            const v = w[r.id] ?? 0;
            total += v;
            if (v > 0 && r.id !== "common") share += map[r.id] ?? 0;
        }
        if (total <= 0) return "common";
        const move = share > 0 ? shift : 0;
        let roll = Math.random() * total;
        for (const r of this.rarities) {
            const base = w[r.id] ?? 0;
            if (base <= 0) continue;
            const v = base + (r.id === "common" ? -move : (move * (map[r.id] ?? 0)) / share);
            if (roll < v) return r.id;
            roll -= v;
        }
        return "common";
    }

    rollCategory(w) {
        let total = 0;
        for (const k in w) total += w[k];
        let roll = Math.random() * total;
        for (const k in w) { if (roll < w[k]) return k; roll -= w[k]; }
        return "use";
    }

    /**
     * 바닥에 실제로 놓는다. 여기서만 스프라이트를 꺼내므로 상한(MAX_DROPS)이 한 곳에서 지켜진다.
     * ★ 가득 차면 가장 오래된 것을 회수한다. 드롭이 안 나오는 것보다 낫다 —
     *   후반 페이즈에서 조용히 아무것도 안 떨어지면 플레이어는 "운이 나쁘다"고 오해한다.
     */
    place(baseIdx, rarityIdx, x, y) {
        const b = this.bases[baseIdx];
        if (!b) return null;
        let s = this.drops.obtain();
        if (!s) {
            const list = this.drops.active;
            if (!list.length) return null;
            this.despawn(list[0]);
            s = this.drops.obtain();
            if (!s) return null;
        }

        const noRecord = b.category === "use" || b.category === "gold";
        const rec = noRecord ? -1 : this.takeRecord(baseIdx, rarityIdx);
        // 기록 칸이 없으면 장비/유물을 만들 수 없다. 소모품으로 떨어뜨리지 않고 그냥 포기한다 —
        // 다른 것으로 바꿔 주면 플레이어는 무엇을 놓쳤는지 영영 알 수 없다.
        if (!noRecord && rec < 0) { this.drops.release(s); return null; }

        s.__base = baseIdx;
        s.__rec = rec;
        s.__rarity = rarityIdx;
        s.__life = DROP_LIFE;
        s.__bob = Math.random() * Math.PI * 2; // 위상을 흩어 전부 같은 박자로 흔들리지 않게
        if (this.hasAtlas) s.setTexture(ATLAS, b.icon);
        s.setPosition(x, y).setVisible(true).setAlpha(1).setScale(1);

        const halo = s.__halo;
        halo.setPosition(x, y).setVisible(rarityIdx > 0);
        if (rarityIdx > 0 && this.hasAtlas) halo.setTexture(ATLAS, this.haloFrame[rarityIdx]);
        return s;
    }

    /** 미리 파 둔 기록 칸 하나를 쓴다. 런 중 객체를 만들지 않기 위한 장치다 */
    takeRecord(baseIdx, rarityIdx) {
        for (let i = 0; i < MAX_RECORDS; i++) {
            const r = this.records[i];
            if (r.used) continue;
            r.used = true;
            r.base = baseIdx;
            r.rarity = rarityIdx;
            r.prefix = -1;
            r.suffix = -1;
            r.score = 0;
            this.rollAffixes(r, baseIdx, rarityIdx);
            return i;
        }
        return -1;
    }

    /**
     * 접두·접미를 굴린다. 등급이 슬롯 수를 정한다 — common 0개, rare 1개, epic 이상 2개.
     * ★ 의미 없는 조합을 막으려고 베이스의 affixTags 와 겹치는 접사만 후보가 된다.
     *   "공격" 태그가 없는 방어구에 "치명타 피해 +x%" 가 붙으면 숫자만 늘고 빌드가 안 갈린다.
     */
    rollAffixes(rec, baseIdx, rarityIdx) {
        const slots = this.rarities[rarityIdx]?.affixCount ?? 0;
        if (slots <= 0) return;
        if (slots >= 1) rec.prefix = this.pickAffix(this.prefixFor[baseIdx], this.prefixes, this.prefixTotal[baseIdx]);
        if (slots >= 2) rec.suffix = this.pickAffix(this.suffixFor[baseIdx], this.suffixes, this.suffixTotal[baseIdx]);
    }

    pickAffix(idxList, pool, total) {
        if (!idxList?.length || total <= 0) return -1;
        let roll = Math.random() * total;
        for (const k of idxList) {
            const w = pool[k].weight;
            if (roll < w) return k;
            roll -= w;
        }
        return idxList[idxList.length - 1];
    }

    freeRecord(i) {
        if (i < 0) return;
        this.records[i].used = false;
    }

    despawn(s) {
        this.freeRecord(s.__rec);
        s.__rec = -1;
        s.setVisible(false).setPosition(-999, -999);
        s.__halo.setVisible(false).setPosition(-999, -999);
        this.drops.release(s);
    }

    // ── 매 프레임 ────────────────────────────────────────────
    update(dt) {
        if (this.combat?.dead) return;
        this.updateDrops(dt);
        this.updateBuffs(dt);
        this.updateRules(dt);
    }

    /**
     * 자석·획득·수명. 상한이 64개라 전수 순회해도 값이 싸다 —
     * EXP 오브(수백 개)와 달리 병합이 필요 없는 이유다.
     */
    updateDrops(dt) {
        const list = this.drops.active;
        if (!list.length) return;
        const px = this.player.x, py = this.player.y;
        const magnet = PICK_MAGNET * (this.stats?.get("magnet") ?? 1);
        const magnet2 = magnet * magnet;
        const now = this.scene.time.now;

        for (let i = list.length - 1; i >= 0; i--) {
            const s = list[i];
            s.__life -= dt;
            if (s.__life <= 0) { this.despawn(s); continue; }
            // 사라지기 2초 전부터 깜빡인다 — 예고 없이 없어지면 플레이어는 버그로 읽는다
            if (s.__life < 2) s.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(now * 0.012)));

            const d2 = dist2(s.x, s.y, px, py);
            if (d2 < PICK_R2) { this.pickup(s); continue; }

            if (d2 < magnet2 || this.pulseUntil > now) {
                const d = Math.sqrt(d2) || 1;
                const sp = PICK_SPEED * dt;
                s.x += ((px - s.x) / d) * sp;
                s.y += ((py - s.y) / d) * sp;
            } else {
                // 제자리 부유. sin 하나면 충분하고, 트윈을 64개 만드는 것보다 훨씬 싸다
                s.__bob += dt * 3;
                s.y += Math.sin(s.__bob) * 6 * dt;
            }
            const halo = s.__halo;
            if (halo.visible) halo.setPosition(s.x, s.y);
        }
    }

    /** 물약류 지속시간. 슬롯이 하나뿐이라 만료 처리도 한 번이면 끝난다 */
    updateBuffs(dt) {
        if (!this.buffs.length) return;
        const now = this.scene.time.now;
        for (const b of this.buffs) {
            if (!b.active || now < b.until) continue;
            b.active = false;
            this.stats?.removeBySrc(this.srcOf[b.base]);
        }
        void dt;
    }

    /**
     * 유물 규칙. 수치가 아니라 규칙을 바꾸는 것이 유물의 정체성이다(23 문서 4).
     * ★ 매 프레임 전수 검사를 하지 않는다 — 주기가 있는 규칙은 타이머로,
     *   범위 규칙은 0.15s 간격 재선정으로 돌린다. 적 150체에서 이게 차이를 만든다.
     */
    updateRules(dt) {
        const now = this.scene.time.now;

        if (this.rule.magnetPulse) {
            this.pulseT -= dt;
            if (this.pulseT <= 0) {
                this.pulseT = MAGNET_PULSE_EVERY;
                this.pulseUntil = now + 900; // 0.9초 동안 화면의 드롭이 전부 끌려온다
                this.combat?.magnetAll?.();
                this.scene.audio?.sfx("pickup");
            }
        }

        if (this.rule.slowAura) {
            this.auraT -= dt;
            if (this.auraT <= 0) {
                this.auraT = 0.15;
                // 이전 대상의 슬로우를 먼저 풀어야 범위를 벗어난 적이 계속 느려지지 않는다
                for (const e of this.slowMarked) if (e.__active) e.slowMult = 1;
                this.slowMarked.length = 0;
                const cands = this.combat?.hash?.query(this.player.x, this.player.y, SLOW_AURA_R, this.queryBuf) ?? EMPTY_ARR;
                const r2 = SLOW_AURA_R * SLOW_AURA_R;
                for (const e of cands) {
                    if (dist2(e.x, e.y, this.player.x, this.player.y) > r2) continue;
                    e.slowMult = Math.min(e.slowMult ?? 1, SLOW_AURA_MULT);
                    this.slowMarked.push(e);
                }
            }
        }
    }

    // ── 획득 ────────────────────────────────────────────────
    /**
     * ★ 자동 획득·자동 장착이 원칙이다(23 문서 2). 이 게임의 조작은 조이스틱과 대시가 전부다.
     *   밟으면 바로 적용되고, 장비는 점수가 높을 때만 갈아입는다. 선택 UI 를 띄우지 않는다.
     */
    pickup(s) {
        const baseIdx = s.__base;
        const b = this.bases[baseIdx];
        const rec = s.__rec;
        let taken = true;

        // ★ 카테고리를 else 로 받으면 안 된다. gold 가 applyEquip 으로 새어 들어가
        //   equipped[undefined] 라는 유령 슬롯을 만들고, 골드는 골드대로 안 들어온다.
        //   분기는 반드시 전 카테고리를 명시해야 한다(use/gold/relic/equip).
        if (b.category === "use") this.applyUse(b);
        else if (b.category === "gold") this.applyGold(b);
        else if (b.category === "relic") this.applyRelic(rec);
        else if (b.category === "equip") taken = this.applyEquip(rec);
        else { console.warn("[ItemSystem] 알 수 없는 카테고리:", b.category); taken = false; }

        if (taken) {
            EventBus.emit(EVENTS.ITEM_PICKED, {
                id: b.id, name: b.name, category: b.category,
                rarity: this.rarities[s.__rarity]?.id ?? "common",
                label: this.labelOf(rec, baseIdx),
            });
            this.scene.audio?.sfx("pickup");
            this.scene.fxSystem?.itemPop?.(s.x, s.y);
        }
        // 갈아입지 않기로 했으면 기록 칸을 돌려주고 바닥에서만 치운다.
        // 그대로 두면 같은 자리를 계속 밟아 토스트가 도배된다.
        if (!taken) this.freeRecord(rec);
        s.__rec = -1;
        s.setVisible(false).setPosition(-999, -999);
        s.__halo.setVisible(false).setPosition(-999, -999);
        this.drops.release(s);
    }

    /** 통화 — 런 중 골드에 더한다. 「고물상」 유물이 있으면 회수량이 는다 */
    applyGold(b) {
        const v = b.effect?.value ?? 0;
        const mult = this.rule.goldSalvage ? 1.5 : 1;
        if (this.combat) this.combat.gold += v * mult;
    }

    /** 소모품 — 즉시 효과 또는 버프 갱신 */
    applyUse(b) {
        const e = b.effect;
        if (!e) return;
        // ★ 분기에 없는 type 은 "먹었는데 아무 일도 안 일어나는" 아이템이 된다.
        //   taken 은 true 라 토스트까지 떠서 플레이어는 효과가 있었다고 믿는다 —
        //   가장 조용하고 가장 나쁜 종류의 버그다. 마지막 else 에서 반드시 경고를 낸다.
        if (e.type === "healPct") {
            // 절대값이 아니라 최대체력 비율. FRAIL 로 maxHp 가 깎여도 쓸모가 유지된다.
            const c = this.combat;
            if (c) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * (e.value ?? 0.25));
            return;
        }
        if (e.type === "slow") {
            // 화면 안 전원을 잠시 늦춘다. 적 객체의 slowMult 는 SpawnSystem.reset 이
            // 매번 1 로 되돌리므로 풀 재사용으로 새지 않는다.
            const until = this.scene.time.now + (e.duration ?? 4) * 1000;
            const mult = 1 - (e.value ?? 0.45);
            for (const en of this.spawn?.enemies ?? EMPTY_ARR) {
                if (!en.__active) continue;
                en.slowMult = Math.min(en.slowMult ?? 1, mult);
                en.slowUntil = Math.max(en.slowUntil ?? 0, until);
            }
            return;
        }
        if (e.type === "exp") {
            // EXP 를 직접 준다. expMult 를 곱하는 것은 오브 흡수 경로와 같은 규약이다.
            const c = this.combat;
            if (c) { c.exp += (e.value ?? 0) * (this.stats?.get("expMult") ?? 1); c.checkLevelUp(); }
            return;
        }
        if (e.type === "heal") {
            const c = this.combat;
            if (c) c.hp = Math.min(c.maxHp, c.hp + e.value);
            return;
        }
        if (e.type === "buff") {
            const slot = this.buffSlotOf[this.baseOf[b.id]];
            const buf = this.buffs[slot];
            if (!buf) return;
            // ★ 중첩이 아니라 갱신이다. 중첩을 허용하면 물약 5개로 PACT 축복 전체보다 세진다.
            if (!buf.active) {
                buf.active = true;
                for (const m of b.mods ?? EMPTY_ARR) this.stats?.add(m.stat, m.op, m.value, this.srcOf[buf.base]);
            }
            buf.until = this.scene.time.now + (e.duration ?? 10) * 1000;
            return;
        }
        if (e.type === "bomb") {
            const r2 = (e.radius ?? 90) * (e.radius ?? 90);
            const cands = this.combat?.hash?.query(this.player.x, this.player.y, e.radius ?? 90, this.queryBuf) ?? EMPTY_ARR;
            for (const en of cands) {
                if (dist2(en.x, en.y, this.player.x, this.player.y) > r2) continue;
                this.combat.queueDamage(en, e.value ?? 40, e.knockback ?? 20);
            }
            this.scene.fxSystem?.hitStop?.(40);
        }
        console.warn("[ItemSystem] 처리하지 않는 effect.type:", e.type, "-", b.id);
    }

    /** 유물 — 규칙 플래그를 켜고 스탯을 얹는다. 같은 유물은 두 번 나오지 않는다 */
    applyRelic(rec) {
        if (rec < 0) return;
        const r = this.records[rec];
        const b = this.bases[r.base];
        this.relics.push(r);
        this.inventory.push(r);
        if (b.rule && this.rule[b.rule] !== undefined) this.rule[b.rule] = true;
        for (const m of b.mods ?? EMPTY_ARR) this.stats?.add(m.stat, m.op, m.value, this.srcOf[r.base]);
    }

    /**
     * 장비 — 슬롯당 하나. **점수가 더 높을 때만** 갈아입는다.
     * 점수를 쓰는 이유: 등급만 보면 접사가 붙은 rare 가 맨몸 epic 보다 나은 경우를 놓친다.
     * @returns {boolean} 실제로 장착했는가
     */
    applyEquip(rec) {
        if (rec < 0) return false;
        const r = this.records[rec];
        const b = this.bases[r.base];
        r.score = this.scoreOf(r);
        const cur = this.equipped[b.slot];
        if (cur && cur.score >= r.score) return false;
        if (cur) this.removeRecord(cur);
        this.equipped[b.slot] = r;
        this.inventory.push(r);
        this.addRecordMods(r);
        return true;
    }

    /** 등급 가중치 + 접사 가중치. 절대적 세기가 아니라 '갈아입을 가치'의 비교값이다 */
    scoreOf(r) {
        let v = (this.rarities[r.rarity]?.scoreBonus ?? 0) + r.rarity * 10;
        if (r.prefix >= 0) v += 6;
        if (r.suffix >= 0) v += 6;
        return v;
    }

    addRecordMods(r) {
        const src = this.srcOf[r.base];
        for (const m of this.bases[r.base].mods ?? EMPTY_ARR) this.stats?.add(m.stat, m.op, m.value, src);
        if (r.prefix >= 0) for (const m of this.prefixes[r.prefix].mods ?? EMPTY_ARR) this.stats?.add(m.stat, m.op, m.value, src);
        if (r.suffix >= 0) for (const m of this.suffixes[r.suffix].mods ?? EMPTY_ARR) this.stats?.add(m.stat, m.op, m.value, src);
    }

    /** 해제. 반드시 removeBySrc 로 지운다 — 직접 수치를 되돌리면 계산 순서가 무너진다 */
    removeRecord(r) {
        this.stats?.removeBySrc(this.srcOf[r.base]);
        const i = this.inventory.indexOf(r);
        if (i >= 0) swapPop(this.inventory, i);
        r.used = false;
    }

    labelOf(rec, baseIdx) {
        const b = this.bases[baseIdx];
        if (rec < 0) return b.name;
        const r = this.records[rec];
        const pre = r.prefix >= 0 ? this.prefixes[r.prefix].name + " " : "";
        const suf = r.suffix >= 0 ? " " + this.suffixes[r.suffix].name : "";
        return pre + b.name + suf;
    }

    // ── 계약 API ────────────────────────────────────────────
    equip(itemId) {
        const idx = this.baseOf[itemId];
        if (idx === undefined) return false;
        const rec = this.takeRecord(idx, 0);
        return rec >= 0 ? this.applyEquip(rec) : false;
    }

    unequip(slot) {
        const r = this.equipped[slot];
        if (!r) return false;
        this.removeRecord(r);
        this.equipped[slot] = null;
        return true;
    }

    clear() {
        for (const s of this.drops.active.slice()) this.despawn(s);
        for (const r of this.inventory) this.stats?.removeBySrc(this.srcOf[r.base]);
        for (const b of this.buffs) { if (b.active) this.stats?.removeBySrc(this.srcOf[b.base]); b.active = false; b.until = 0; }
        for (const e of this.slowMarked) if (e.__active) e.slowMult = 1;
        this.slowMarked.length = 0;
        this.inventory.length = 0;
        this.relics.length = 0;
        this.equipped.fang = this.equipped.hide = this.equipped.charm = null;
        for (const r of this.records) r.used = false;
        this.resetRules();
        this.pulseUntil = 0;
        this.secondWindUsed = false;
    }
}
