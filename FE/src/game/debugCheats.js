/**
 * 치트 콘솔. (T231)
 *
 * ★ Day 6이 아니라 Day 2에 만드는 이유 (11-ROADMAP 4)
 *   이게 없으면 Day 4에 각성 6종을 하나씩 검증하는 데 매번 몇 분씩 실제 플레이를 해야 하고,
 *   Day 6 밸런싱은 "느낌"으로 하게 된다. 30분을 여기 쓰면 Day 3~6에서 몇 시간이 돌아온다.
 *
 * 사용: ?debug=1 로 열고 브라우저 콘솔에서 BS.xxx()
 *       실기기에서는 DebugPanel 버튼을 쓴다(Day 6).
 */
export function installCheats(scene) {
    const BS = {
        /** 적 n체 즉시 스폰 */
        spawn: (n = 50) => { scene.spawnSystem.forceSpawn(n); return scene.spawnSystem.pool.activeCount; },
        /** 무적 토글 */
        god: () => { const c = scene.combatSystem; c.godMode = !c.godMode; return c.godMode; },
        /** 시간 배속 */
        speed: (v = 1) => { scene.timeScale = v; return v; },
        /** 웨이브 구간 점프 (0~11) */
        /** 구간 점프. jumpTo 는 지나친 특수 이벤트를 "소비만" 하고 발화시키지 않는다 —
         *  elapsed 를 직접 밀면 엘리트 3체 + 무리 18파도가 한 프레임에 쏟아진다. */
        wave: (i) => { const s = scene.spawnSystem; return s.jumpTo(s.segments[Math.max(0, Math.min(i, s.segments.length - 1))].t); },
        /** 즉사 */
        kill: () => scene.combatSystem.hurt(9999),
        /** 체력 회복 + 부활. 사망 상태도 푼다 */
        heal: (v) => { const c = scene.combatSystem; c.hp = v ?? c.maxHp; c.dead = false; return c.hp; },
        /** 즉시 레벨업 — 각성 6종을 Day 4에 10초 만에 검증하려면 필수다 */
        levelup: (n = 1) => { const c = scene.combatSystem; for (let i = 0; i < n; i++) { c.exp = c.expToNext; c.checkLevelUp(); } return c.level; },
        /** 특정 대가 태그를 n중첩 주입 — 각성 직전 상태를 즉시 만든다 */
        toll: (tag, n = 2) => { const p2 = scene.pact; p2.tagCounts[tag] = n; return p2.tagCounts; },
        /** 무기 획득/레벨업 — BS.weapon('W3',5) */
        weapon: (id, lv = 1) => { const w = scene.combatSystem.addWeapon(id, lv); return w ? { id: w.id, level: w.level, ...w.s } : 'unknown ' + id; },
        /** 보유 무기 목록 */
        weapons: () => scene.combatSystem.weaponList.map((w) => w.id + ' Lv' + w.level),
        /** ★ R-1 검증용 — weapons.json 원본이 오염되지 않았는지 밖에서 대조하기 위한 창구.
         *  룬은 w.s(=이 객체)를 절대 건드리지 않으므로 런 전후 값이 같아야 한다. */
        weaponDefs: () => scene.combatSystem.wdef,

        // ── 룬 (31-RUNE-EVOLUTION-TREE) ────────────────────────────────
        // ★ 조우(EncounterSystem)가 아직 없어 인게임에서 룬을 얻을 방법이 없다.
        //   T3 진화 6종을 눈으로 확인하려면 runeForce / runeMax 를 쓴다.
        /** 무기별 룬 슬롯 상태 — 일시정지 화면이 그리는 것과 같은 데이터 */
        runes: () => scene.runes?.snapshot() ?? '룬 시스템 없음',
        /** 지금 제시 가능한 룬 (게이트 G-1~G-4 전부 적용) */
        runeOffers: () => (scene.runes?.offerable() ?? []).map((r) => r.id + ' T' + r.tier + ' ' + r.name),
        /** 좌판 추첨 시뮬 — 조우가 붙기 전에 pick() 의 분포를 눈으로 본다 */
        runePick: (n = 3) => (scene.runes?.pick(n) ?? []).map((r) => r.weapon + ' ' + r.id),
        /** 게이트를 지켜 새긴다. 조건이 안 맞으면 false — 게이트 검증(R-2/R-4)이 이걸로 된다 */
        rune: (id) => scene.runes?.engrave(id) ?? false,
        /**
         * 게이트를 만족시킨 뒤 새긴다. 무기를 요건 레벨까지 올리고 선행 단계를 아무거나 채운다.
         * BS.runeForce('rn_w1_circle') -> W1 Lv5 + T1 + T2 + 「선혈의 원」
         */
        runeForce: (id) => {
            const rs = scene.runes;
            const def = rs?.byId(id);
            if (!def) return '알 수 없는 룬 ' + id;
            const c = scene.combatSystem;
            const need = def.requires?.weaponLevel ?? 1;
            c.addWeapon(def.weapon, Math.max(need, c.weapons[def.weapon]?.level ?? 1));
            for (let t = 1; t < def.tier; t++) {
                if (c.weapons[def.weapon].runes['t' + t]) continue;
                const pre = rs.offerable().find((r) => r.weapon === def.weapon && r.tier === t);
                if (pre) rs.engrave(pre.id);
            }
            rs.engrave(id);
            return rs.snapshot().find((s) => s.weaponId === def.weapon);
        },
        /** 무기 하나를 만렙 + T1~T3 로 완성한다(각 단계 첫 번째 룬). BS.runeMax('W2') */
        runeMax: (wid, tierMax = 3) => {
            const rs = scene.runes;
            scene.combatSystem.addWeapon(wid, 5);
            for (let t = 1; t <= tierMax; t++) {
                const r = rs.offerable().find((x) => x.weapon === wid && x.tier === t);
                if (r) rs.engrave(r.id);
            }
            return rs.snapshot().find((s) => s.weaponId === wid);
        },
        // ── 조우 (30-ENCOUNTERS-AND-FIELD-EVENTS) ───────────────────────
        /** 지금 즉시 그 조우를 띄운다. id 또는 kind 둘 다 받는다.
         *  BS.enc('merchant') BS.enc('enc_witch') BS.enc('fieldboss') BS.enc('altar') */
        enc: (k) => scene.encounters?.force(k) ?? '조우 시스템 없음',
        /** 지금 떠 있는 조우 상태 — 좌판 좌표·가격·잠김까지 그대로 본다 */
        encState: () => {
            const es = scene.encounters;
            if (!es) return '조우 시스템 없음';
            const a = es.active;
            return {
                paused: scene.scene.isPaused(),   // ★ E-1 — 조우 중에도 항상 false 여야 한다
                act: a ? { id: a.id, kind: a.kind, life: +a.life.toFixed(1), x: Math.round(a.x), y: Math.round(a.y) } : null,
                fieldBoss: es.fb.on ? { hp: es.fb.e?.hp, maxHp: es.fb.e?.maxHp, life: +es.fb.life.toFixed(1), leashR: es.fb.e?.__leashR } : null,
                suppressed: scene.spawnSystem.suppressed,  // ★ E-4 — 필드보스는 이걸 켜지 않는다
                slots: es.slots.filter((s) => s.on).map((s) => ({
                    kind: s.kind, label: s.label, pricePct: Math.round(s.price * 100),
                    priceHp: Math.round(es.priceHp(s.price)), locked: s.locked,
                    x: Math.round(s.x), y: Math.round(s.y),
                })),
            };
        },
        /** 창 스케줄(초). 디렉터가 언제 무엇을 띄울지의 시간축이다 */
        encWindows: () => {
            const es = scene.encounters;
            if (!es) return '조우 시스템 없음';
            if (!es.schedule) es.buildSchedule();
            return es.schedule.map((w) => w.id + ' @' + Math.round(w.at) + 's [' + w.pool.join(',') + ']');
        },
        /** ★ E-6 — 디렉터 규칙 검증. 100런 시뮬레이션에서 같은 조우 연속 배치가 0회여야 한다.
         *  씬을 만지지 않는 순수 함수라 몇 번을 돌려도 런 상태가 오염되지 않는다. */
        encSim: (n = 100, offers = 6) => scene.encounters?.simulate(n, offers) ?? '조우 시스템 없음',
        /** 좌판을 밟은 것으로 친다 — 걸어가지 않고 구매 판정만 본다. BS.encBuy(0) */
        encBuy: (i = 0) => {
            const es = scene.encounters;
            const s = es?.slots?.filter((x) => x.on)[i];
            if (!s) return '그 좌판이 없다';
            if (s.locked) return '잠김 — 체력이 가격 이하다 (E-3)';
            scene.player.setPosition(s.x, s.y);
            return { moved: [Math.round(s.x), Math.round(s.y)], label: s.label };
        },
        /** 보물상자를 발밑에 떨군다. 30 §3.7 보상 3종 추첨을 눈으로 본다 */
        chest: (n = 1) => {
            for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 * i) / n;
                scene.spawnSystem.dropChest(scene.player.x + Math.cos(a) * 24, scene.player.y + Math.sin(a) * 24, 'cheat');
            }
            return scene.spawnSystem.chests.activeCount;
        },
        /** 보스 즉시 소환 — 6분을 기다리지 않고 보스전을 검증한다 */
        boss: () => { scene.spawnSystem.elapsed = 360; return !!scene.bossSystem.spawn(); },
        /** 보스 HP 직접 설정 — 페이즈 전환/처치 연출을 10초 만에 본다 */
        bossHp: (v) => { const b = scene.bossSystem.boss; if (b) b.hp = v; return v; },
        /** 스탯 스냅샷 */
        stats: () => ({ ...scene.stats.all }),
        /** 적 전멸 */
        clear: () => { const s = scene.spawnSystem; while (s.pool.active.length) s.kill(s.pool.active[0], false); return 0; },
        /** 현재 상태 스냅샷 */
        stat: () => ({
            hp: scene.combatSystem.hp,
            exp: scene.combatSystem.exp,
            kills: scene.spawnSystem.killCount,
            enemies: scene.spawnSystem.pool.activeCount,
            projectiles: scene.combatSystem.projectiles.activeCount,
            orbs: scene.combatSystem.orbs.activeCount,
            elapsed: Math.floor(scene.spawnSystem.elapsed),
            segment: scene.spawnSystem.segIndex + 1,
        }),
    };
    if (typeof window !== "undefined") {
        window.BS = BS;
        console.log("[치트] BS.spawn(50) BS.god() BS.speed(3) BS.wave(6) BS.stat() BS.heal() BS.kill()");
        console.log("[치트·룬] BS.runeOffers() BS.rune('rn_w2_twin') BS.runeForce('rn_w2_chain') BS.runeMax('W3') BS.runes()");
        console.log("[치트·조우] BS.enc('merchant') BS.encState() BS.encBuy(0) BS.encWindows() BS.encSim(100) BS.chest(2)");
    }
    return BS;
}
