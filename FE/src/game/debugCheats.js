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
    }
    return BS;
}
