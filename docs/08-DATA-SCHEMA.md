# 08. 데이터 스키마 & 샘플 데이터

> **문서 지위: 하위 규격.** 상위 정본은 `01-CONCEPT-AND-STORY.md`, `03-GDD-CORE.md`, `04-PACT-SYSTEM.md`.
> 이 문서의 모든 수치는 `05-COMBAT-AND-BALANCE.md`와 **1:1로 일치**한다. 한쪽을 고치면 반드시 양쪽을 고친다.
> 정본과의 차이/조정 제안은 `05-COMBAT-AND-BALANCE.md` §0 참조.
> 최종 수정: 2026-08-10

---

## 1. 파일 목록과 배치

모든 콘텐츠 데이터는 `FE/src/data/` 아래에 둔다. Vite가 정적 JSON을 번들에 인라인하므로 `import`만 하면 되고 fetch/로딩 순서 문제가 없다.

```
FE/src/data/
├── weapons.json         무기 W1~W6의 Lv1~5 전 수치
├── passives.json        패시브 P1~P4의 Lv1~5 전 수치
├── enemies.json         적 E1~E8 · 엘리트 EL1/EL2 · BOSS의 스탯과 AI 파라미터
├── waves.json           30초 × 12구간 스폰 테이블 + 보스 진입 규칙
├── blessings.json       PACT 축복 22종 + 폴백 1종
├── tolls.json           PACT 대가 6계열 + 등급배율 + 하한/상한
├── awakenings.json      각성 6종 + 최종 각성 「완전 흡혈귀화」
├── meta-upgrades.json   성소(Sanctum) 영구 강화 6종
├── strings.ko.json      모든 표시 문자열(i18n 키 → 한국어)
└── assets.json          Phaser preload 매니페스트 (§6)
```

| 파일 | 역할 (1줄) |
|---|---|
| `weapons.json` | 무기 6종의 레벨별 데미지·쿨다운·범위·타입별 파라미터 원장. |
| `passives.json` | 패시브 4종의 레벨별 스탯 모디파이어. 축복 ID와 1:1 대응. |
| `enemies.json` | 적 11종의 기본 스탯·히트박스·EXP/골드·AI 종류와 행동 파라미터. |
| `waves.json` | 시간대별 난이도 배율·스폰 간격·동시 상한·적 구성 가중치·특수 이벤트. |
| `blessings.json` | 레벨업 카드의 "축복" 면. 등급별 출현 조건과 효과 모디파이어. |
| `tolls.json` | 레벨업 카드의 "대가" 면. 6태그의 저주 수식과 안전 하한값. |
| `awakenings.json` | 태그 3중첩 시 발동하는 역전 능력 6종 + 인간성 0 최종 각성. |
| `meta-upgrades.json` | 런 밖에서 골드로 사는 영구 강화 6종과 단계별 비용. |
| `strings.ko.json` | UI·카드·적·녹턴 대사 등 전 텍스트. 영어 추가 시 `strings.en.json`만 늘린다. |
| `assets.json` | 스프라이트/오디오/타일맵 키·경로·타입. `PreloadScene`이 이 파일만 순회한다. |

---

## 2. 모디파이어 표현 규약 (모든 파일의 공통 기반)

축복·대가·각성·성소·패시브가 **전부 같은 형식**으로 효과를 표현한다.
코드는 `applyModifier(state, mod)` **한 함수만** 해석하면 된다 (`04-PACT` §10 데이터 주도 원칙).

### 2.1 모디파이어 객체

```json
{ "stat": "damageMult", "op": "add",       "value": 0.08 }
{ "stat": "maxHp",      "op": "add",       "value": 15 }
{ "stat": "moveSpeed",  "op": "mul",       "value": 1.20 }
{ "stat": "moveSpeed",  "op": "mulReduce", "value": 0.10 }
{ "stat": "expMult",    "op": "set",       "value": 1.50 }
{ "op": "levelUp",      "target": "W1",    "value": 1 }
{ "op": "special",      "id": "husk_revive", "params": { "hpPct": 0.5, "invulnSec": 2.0, "uses": 1 } }
```

### 2.2 지원하는 `op` (6종. 이것 외에는 만들지 않는다)

| op | 의미 | 적용 단계 | `stat` | `value` | 사용처 |
|---|---|---|---|---|---|
| `add` | 가산 버킷에 누적: `Σadd += value` | 1 | 필수 | number | 축복 대부분, 패시브, 성소 |
| `mul` | 곱연산 버킷에 누적: `Πmul *= value` | 2 | 필수 | number(>0) | 각성, 완전 흡혈귀화 |
| `mulReduce` | 곱연산 버킷에 감산 누적: `Πmul *= (1 − value × gradeMult)` | 2 | 필수 | number(0~1) | **대가 전용** |
| `set` | 지정값 고정 대입(가산/곱연산 무시) | 3 | 필수 | number | 각성이 페널티를 무효화할 때 |
| `levelUp` | 무기/패시브 레벨 상승 | 0 (스탯 파이프라인 밖) | 없음 | int | 무기·패시브 축복 |
| `special` | 코드 훅 호출. 수식으로 표현 불가한 것 | 4 (스탯 확정 후) | 없음 | 없음(`id`+`params`) | 각성 고유 효과, 각인 축복 |

> `gradeMult`는 대가에만 적용되며 `tolls.json > rarityMultipliers`에서 온다 (Common 1.0 / Rare 1.8 / Epic 1.4).
> `op`이 `mulReduce`가 **아닌** 모디파이어에는 `gradeMult`를 곱하지 않는다.

### 2.3 적용 순서 (03-GDD §4.2 준수, 절대 변경 금지)

```
0. levelUp        무기/패시브 레벨 반영 → 레벨별 기본값 확정
1. add            Σ가산 집계
2. mul / mulReduce  Π곱연산 집계
3. set            각성 보정 (해당 스탯의 add/mul 버킷을 폐기하고 고정값 대입)
4. clamp          tolls.json 의 floor / cap 강제 적용 ← 항상 마지막 수치 연산
5. special        코드 훅 실행 (스탯을 직접 읽되 파이프라인에는 재진입하지 않음)

최종값 = clamp( (기본값 + Σadd) × Πmul × 각성보정 , floor , cap )
```

**각성의 "페널티 완전 제거"(SLOW/MYOPIA/GREED) 처리:**
해당 태그가 만든 `mulReduce` 항목에는 `sourceTag`가 기록되어 있다.
각성 시 `Πmul` 버킷에서 `sourceTag === 이 태그`인 항목을 **제거하고 재계산**한다.
"유지"(FRAIL/BLIND/HUNGER)는 아무것도 제거하지 않는다.

### 2.4 스탯 키 화이트리스트

`03-GDD` §4.1과 동일. 이 목록 밖의 `stat` 값은 `validateData()`가 에러로 잡는다.

```
maxHp · moveSpeed · damageMult · attackSpeed · rangeMult · projectileAdd
critRate · critMult · lifesteal · pickupRadius · expMult · goldMult
visionRadius · humanity · hpDrain · areaMult
```

### 2.5 `special` 훅 ID 화이트리스트

| id | 출처 | 동작 |
|---|---|---|
| `w1_double_slash` | `bls_w1_x` | W1 참격을 0.15s 간격 2연타로 |
| `w2_pierce_plus` | `bls_w2_x` | W2 관통 +2 |
| `w3_orb_plus` | `bls_w3_x` | W3 유골 +2, 궤도 반경 +30% |
| `w4_duration_x2` | `bls_w4_x` | W4 장판 지속 ×2 (틱 수 4→8) |
| `w5_chain_double` | `bls_w5_x` | W5 연쇄 3→6 |
| `blood_crystal` | `bls_fallback` | HP 30 즉시 회복 |
| `husk_crit_heal` / `husk_revive` / `husk_lowhp_damage` | `awk_frail` | §4.7 |
| `weight_slow_aura` / `weight_bonus_vs_slowed` | `awk_slow` | §4.7 |
| `madness_close_damage` / `madness_close_attackspeed` | `awk_myopia` | §4.7 |
| `avarice_orb_projectile` | `awk_greed` | §4.7 |
| `nyx_offscreen_marker` / `nyx_offscreen_damage` / `nyx_offscreen_exp` | `awk_blind` | §4.7 |
| `thirst_kill_explosion` / `thirst_killstreak_speed` | `awk_hunger` | §4.7 |
| `ascension_visual` | `awk_ascension` | 붉은 틴트 + 채도 저하 |

---

## 3. 각 파일의 스키마와 샘플 데이터

### 3.1 `weapons.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `schemaVersion` | int | ✅ | 1 | — | 파일 포맷 버전 |
| `weapons[]` | array | ✅ | length 6 | — | 무기 목록 |
| `weapons[].id` | string | ✅ | `W1`~`W6` | — | 고유 ID |
| `weapons[].nameKey` | string | ✅ | `weapon.*.name` | — | `strings.ko.json` 키 |
| `weapons[].type` | string | ✅ | `melee_cone`·`projectile`·`orbit`·`ground_aoe`·`chain`·`summon` | — | 실행 로직 분기 |
| `weapons[].priority` | string | ✅ | `MUST`·`SHOULD`·`COULD` | — | 7일 컷라인 |
| `weapons[].blessingId` | string | ✅ | `bls_w1`~`bls_w6` | — | 이 무기를 올리는 축복 |
| `weapons[].maxLevel` | int | ✅ | 5 | 5 | MAX 판정 |
| `weapons[].spriteKey` | string | ✅ | `assets.json`의 key | — | 이펙트 스프라이트 |
| `weapons[].levels[]` | array | ✅ | length 5 | — | Lv1~5 |
| `levels[].lv` | int | ✅ | 1~5 | — | 레벨 |
| `levels[].damage` | number | ✅ | > 0 | — | 1히트 기본 데미지 |
| `levels[].cooldown` | number | ✅ | > 0 | — | 초. `orbit`은 재타격 쿨 |
| `levels[].range` | number | ✅ | > 0 | — | px. 사거리 또는 반경 |
| `levels[].knockback` | number | — | ≥ 0 | 0 | 넉백 세기 |
| `levels[].params` | object | ✅ | 타입별 (§3.1.1) | `{}` | 타입 고유 파라미터 |
| `levels[].specialKey` | string\|null | — | `strings` 키 또는 null | null | 레벨 특수 효과 설명 |
| `levels[].dpsSingle` | number | — | ≥ 0 | — | 문서화용 참고값. 런타임 미사용 |

##### 3.1.1 `params` 타입별 필드

| type | 필드 | 설명 |
|---|---|---|
| `melee_cone` | `angle`(deg), `pierce`(-1=무한), `afterimage`(s), `killResetChance` | W1 |
| `projectile` | `projectiles`, `pierce`, `speed`(px/s), `spread`(deg), `burstDelay`(s) | W2 |
| `orbit` | `orbCount`, `orbitRadius`(px), `orbitSpeed`(deg/s), `destroyProjectile`(bool) | W3 |
| `ground_aoe` | `puddles`, `puddleRadius`(px), `duration`(s), `tickInterval`(s), `tickCount`, `scatterRadius`(px) | W4 |
| `chain` | `chains`, `falloff`(0~1), `chainRange`(px), `seekRange`(px) | W5 |
| `summon` | `echoes`, `delays`(number[]), `hitCooldown`(s), `hitbox`{w,h} | W6 |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/weapons.json",
  "type": "object",
  "required": ["schemaVersion", "weapons"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "weapons": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "nameKey", "type", "priority", "blessingId", "maxLevel", "spriteKey", "levels"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^W[1-6]$" },
          "nameKey": { "type": "string" },
          "type": { "enum": ["melee_cone", "projectile", "orbit", "ground_aoe", "chain", "summon"] },
          "priority": { "enum": ["MUST", "SHOULD", "COULD"] },
          "blessingId": { "type": "string", "pattern": "^bls_w[1-6]$" },
          "maxLevel": { "type": "integer", "const": 5 },
          "spriteKey": { "type": "string" },
          "levels": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
              "type": "object",
              "required": ["lv", "damage", "cooldown", "range", "params"],
              "additionalProperties": false,
              "properties": {
                "lv": { "type": "integer", "minimum": 1, "maximum": 5 },
                "damage": { "type": "number", "exclusiveMinimum": 0 },
                "cooldown": { "type": "number", "exclusiveMinimum": 0 },
                "range": { "type": "number", "exclusiveMinimum": 0 },
                "knockback": { "type": "number", "minimum": 0, "default": 0 },
                "params": { "type": "object" },
                "specialKey": { "type": ["string", "null"], "default": null },
                "dpsSingle": { "type": "number", "minimum": 0 }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — 그대로 복사)

```json
{
  "schemaVersion": 1,
  "weapons": [
    {
      "id": "W1",
      "nameKey": "weapon.W1.name",
      "type": "melee_cone",
      "priority": "MUST",
      "blessingId": "bls_w1",
      "maxLevel": 5,
      "spriteKey": "fx_slash",
      "levels": [
        { "lv": 1, "damage": 12, "cooldown": 1.00, "range": 64, "knockback": 40, "params": { "angle": 90,  "pierce": -1, "afterimage": 0,    "killResetChance": 0 },    "specialKey": null,               "dpsSingle": 12.00 },
        { "lv": 2, "damage": 15, "cooldown": 0.95, "range": 70, "knockback": 40, "params": { "angle": 90,  "pierce": -1, "afterimage": 0,    "killResetChance": 0 },    "specialKey": null,               "dpsSingle": 15.79 },
        { "lv": 3, "damage": 18, "cooldown": 0.90, "range": 76, "knockback": 46, "params": { "angle": 110, "pierce": -1, "afterimage": 0.10, "killResetChance": 0 },    "specialKey": "weapon.W1.lv3",    "dpsSingle": 20.00 },
        { "lv": 4, "damage": 22, "cooldown": 0.85, "range": 82, "knockback": 46, "params": { "angle": 110, "pierce": -1, "afterimage": 0.10, "killResetChance": 0.20 }, "specialKey": "weapon.W1.lv4",    "dpsSingle": 25.88 },
        { "lv": 5, "damage": 27, "cooldown": 0.80, "range": 90, "knockback": 55, "params": { "angle": 160, "pierce": -1, "afterimage": 0.10, "killResetChance": 0.20 }, "specialKey": "weapon.W1.lv5",    "dpsSingle": 33.75 }
      ]
    },
    {
      "id": "W2",
      "nameKey": "weapon.W2.name",
      "type": "projectile",
      "priority": "MUST",
      "blessingId": "bls_w2",
      "maxLevel": 5,
      "spriteKey": "fx_firebullet",
      "levels": [
        { "lv": 1, "damage": 14, "cooldown": 1.20, "range": 200, "knockback": 12, "params": { "projectiles": 1, "pierce": 0, "speed": 220, "spread": 0,  "burstDelay": 0 },    "specialKey": "weapon.W2.lv1", "dpsSingle": 11.67 },
        { "lv": 2, "damage": 17, "cooldown": 1.15, "range": 210, "knockback": 12, "params": { "projectiles": 1, "pierce": 0, "speed": 220, "spread": 0,  "burstDelay": 0 },    "specialKey": null,            "dpsSingle": 14.78 },
        { "lv": 3, "damage": 20, "cooldown": 1.10, "range": 220, "knockback": 12, "params": { "projectiles": 2, "pierce": 0, "speed": 235, "spread": 0,  "burstDelay": 0.08 }, "specialKey": "weapon.W2.lv3", "dpsSingle": 18.18 },
        { "lv": 4, "damage": 24, "cooldown": 1.05, "range": 230, "knockback": 14, "params": { "projectiles": 2, "pierce": 1, "speed": 235, "spread": 0,  "burstDelay": 0.08 }, "specialKey": "weapon.W2.lv4", "dpsSingle": 22.86 },
        { "lv": 5, "damage": 29, "cooldown": 1.00, "range": 240, "knockback": 16, "params": { "projectiles": 3, "pierce": 1, "speed": 250, "spread": 10, "burstDelay": 0 },    "specialKey": "weapon.W2.lv5", "dpsSingle": 29.00 }
      ]
    },
    {
      "id": "W3",
      "nameKey": "weapon.W3.name",
      "type": "orbit",
      "priority": "MUST",
      "blessingId": "bls_w3",
      "maxLevel": 5,
      "spriteKey": "fx_bone_orb",
      "levels": [
        { "lv": 1, "damage": 8,  "cooldown": 0.60, "range": 46, "knockback": 8,  "params": { "orbCount": 2, "orbitRadius": 46, "orbitSpeed": 120, "destroyProjectile": false }, "specialKey": "weapon.W3.lv1", "dpsSingle": 13.33 },
        { "lv": 2, "damage": 9,  "cooldown": 0.60, "range": 46, "knockback": 8,  "params": { "orbCount": 3, "orbitRadius": 46, "orbitSpeed": 130, "destroyProjectile": false }, "specialKey": null,            "dpsSingle": 15.00 },
        { "lv": 3, "damage": 11, "cooldown": 0.55, "range": 54, "knockback": 10, "params": { "orbCount": 3, "orbitRadius": 54, "orbitSpeed": 140, "destroyProjectile": false }, "specialKey": null,            "dpsSingle": 20.00 },
        { "lv": 4, "damage": 13, "cooldown": 0.50, "range": 54, "knockback": 10, "params": { "orbCount": 4, "orbitRadius": 54, "orbitSpeed": 150, "destroyProjectile": true },  "specialKey": "weapon.W3.lv4", "dpsSingle": 26.00 },
        { "lv": 5, "damage": 16, "cooldown": 0.45, "range": 62, "knockback": 12, "params": { "orbCount": 5, "orbitRadius": 62, "orbitSpeed": 170, "destroyProjectile": true },  "specialKey": null,            "dpsSingle": 35.56 }
      ]
    },
    {
      "id": "W4",
      "nameKey": "weapon.W4.name",
      "type": "ground_aoe",
      "priority": "MUST",
      "blessingId": "bls_w4",
      "maxLevel": 5,
      "spriteKey": "fx_holy_pool",
      "levels": [
        { "lv": 1, "damage": 6,  "cooldown": 3.00, "range": 30, "knockback": 0, "params": { "puddles": 3, "puddleRadius": 30, "duration": 1.5, "tickInterval": 0.5, "tickCount": 4, "scatterRadius": 200 }, "specialKey": "weapon.W4.lv1", "dpsSingle": 7.20 },
        { "lv": 2, "damage": 7,  "cooldown": 3.00, "range": 34, "knockback": 0, "params": { "puddles": 3, "puddleRadius": 34, "duration": 1.5, "tickInterval": 0.5, "tickCount": 4, "scatterRadius": 210 }, "specialKey": null,            "dpsSingle": 8.40 },
        { "lv": 3, "damage": 8,  "cooldown": 3.00, "range": 34, "knockback": 0, "params": { "puddles": 4, "puddleRadius": 34, "duration": 1.5, "tickInterval": 0.5, "tickCount": 4, "scatterRadius": 220 }, "specialKey": null,            "dpsSingle": 12.80 },
        { "lv": 4, "damage": 9,  "cooldown": 2.80, "range": 38, "knockback": 0, "params": { "puddles": 4, "puddleRadius": 38, "duration": 1.5, "tickInterval": 0.5, "tickCount": 4, "scatterRadius": 230 }, "specialKey": null,            "dpsSingle": 15.43 },
        { "lv": 5, "damage": 11, "cooldown": 2.60, "range": 42, "knockback": 0, "params": { "puddles": 5, "puddleRadius": 42, "duration": 1.8, "tickInterval": 0.5, "tickCount": 4, "scatterRadius": 240 }, "specialKey": "weapon.W4.lv5", "dpsSingle": 25.38 }
      ]
    },
    {
      "id": "W5",
      "nameKey": "weapon.W5.name",
      "type": "chain",
      "priority": "SHOULD",
      "blessingId": "bls_w5",
      "maxLevel": 5,
      "spriteKey": "fx_chain_bolt",
      "levels": [
        { "lv": 1, "damage": 16, "cooldown": 2.00, "range": 160, "knockback": 6,  "params": { "chains": 3, "falloff": 0.70, "chainRange": 90,  "seekRange": 160 }, "specialKey": "weapon.W5.lv1", "dpsSingle": 8.00 },
        { "lv": 2, "damage": 19, "cooldown": 1.90, "range": 170, "knockback": 6,  "params": { "chains": 3, "falloff": 0.70, "chainRange": 95,  "seekRange": 170 }, "specialKey": null,            "dpsSingle": 10.00 },
        { "lv": 3, "damage": 23, "cooldown": 1.80, "range": 180, "knockback": 8,  "params": { "chains": 4, "falloff": 0.72, "chainRange": 100, "seekRange": 180 }, "specialKey": null,            "dpsSingle": 12.78 },
        { "lv": 4, "damage": 27, "cooldown": 1.70, "range": 190, "knockback": 8,  "params": { "chains": 4, "falloff": 0.74, "chainRange": 105, "seekRange": 190 }, "specialKey": null,            "dpsSingle": 15.88 },
        { "lv": 5, "damage": 33, "cooldown": 1.60, "range": 200, "knockback": 10, "params": { "chains": 5, "falloff": 0.78, "chainRange": 110, "seekRange": 200 }, "specialKey": null,            "dpsSingle": 20.63 }
      ]
    },
    {
      "id": "W6",
      "nameKey": "weapon.W6.name",
      "type": "summon",
      "priority": "COULD",
      "blessingId": "bls_w6",
      "maxLevel": 5,
      "spriteKey": "fx_umbral_echo",
      "levels": [
        { "lv": 1, "damage": 10, "cooldown": 0.60, "range": 24, "knockback": 0,  "params": { "echoes": 1, "delays": [2.0],           "hitCooldown": 0.60, "hitbox": { "w": 24, "h": 32 } }, "specialKey": "weapon.W6.lv1", "dpsSingle": 4.17 },
        { "lv": 2, "damage": 12, "cooldown": 0.60, "range": 24, "knockback": 0,  "params": { "echoes": 1, "delays": [2.0],           "hitCooldown": 0.60, "hitbox": { "w": 24, "h": 32 } }, "specialKey": null,            "dpsSingle": 5.00 },
        { "lv": 3, "damage": 13, "cooldown": 0.55, "range": 24, "knockback": 0,  "params": { "echoes": 2, "delays": [2.0, 3.0],      "hitCooldown": 0.55, "hitbox": { "w": 24, "h": 32 } }, "specialKey": null,            "dpsSingle": 11.82 },
        { "lv": 4, "damage": 15, "cooldown": 0.50, "range": 24, "knockback": 20, "params": { "echoes": 2, "delays": [2.0, 3.0],      "hitCooldown": 0.50, "hitbox": { "w": 24, "h": 32 } }, "specialKey": "weapon.W6.lv4", "dpsSingle": 15.00 },
        { "lv": 5, "damage": 18, "cooldown": 0.45, "range": 24, "knockback": 20, "params": { "echoes": 3, "delays": [1.5, 2.5, 3.5], "hitCooldown": 0.45, "hitbox": { "w": 24, "h": 32 } }, "specialKey": null,            "dpsSingle": 30.00 }
      ]
    }
  ]
}
```

> `dpsSingle`은 `05-COMBAT-AND-BALANCE.md` §2의 "단일 대상 DPS"(W4/W6은 명중·접촉 계수 반영 후)와 동일하다.
> 런타임에서는 읽지 않는다. **밸런싱 시 눈으로 비교하기 위한 필드**이며 `validateData()`가 재계산하여 불일치를 경고한다.

---

### 3.2 `passives.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `passives[].id` | string | ✅ | `P1`~`P4` | — | 고유 ID |
| `passives[].nameKey` | string | ✅ | — | — | 표시명 키 |
| `passives[].blessingId` | string | ✅ | `bls_hp`·`bls_dmg`·`bls_spd`·`bls_as` | — | 이 패시브를 올리는 축복 |
| `passives[].maxLevel` | int | ✅ | 5 | 5 | — |
| `passives[].iconKey` | string | ✅ | — | — | 아이콘 키 |
| `passives[].levels[].lv` | int | ✅ | 1~5 | — | — |
| `passives[].levels[].effects[]` | Modifier[] | ✅ | §2.1 | — | **누적값이 아닌 절대값**(레벨 교체 방식) |

> **누적이 아니라 교체:** Lv3의 `effects`는 "+24%"(누적 절대값)를 담는다. 레벨업 시 이전 레벨의 모디파이어를 제거하고 새 레벨 것을 넣는다. 부동소수 누적 오차가 생기지 않는다.

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/passives.json",
  "definitions": {
    "modifier": {
      "type": "object",
      "required": ["op"],
      "properties": {
        "stat": { "enum": ["maxHp","moveSpeed","damageMult","attackSpeed","rangeMult","projectileAdd","critRate","critMult","lifesteal","pickupRadius","expMult","goldMult","visionRadius","humanity","hpDrain","areaMult"] },
        "op": { "enum": ["add","mul","mulReduce","set","levelUp","special"] },
        "value": { "type": "number" },
        "target": { "type": "string" },
        "id": { "type": "string" },
        "params": { "type": "object" },
        "sourceTag": { "enum": ["FRAIL","SLOW","MYOPIA","GREED","BLIND","HUNGER"] }
      },
      "additionalProperties": false
    }
  },
  "type": "object",
  "required": ["schemaVersion", "passives"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "passives": {
      "type": "array",
      "minItems": 4,
      "items": {
        "type": "object",
        "required": ["id","nameKey","blessingId","maxLevel","iconKey","levels"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^P[1-4]$" },
          "nameKey": { "type": "string" },
          "blessingId": { "type": "string" },
          "maxLevel": { "type": "integer", "const": 5 },
          "iconKey": { "type": "string" },
          "levels": {
            "type": "array", "minItems": 5, "maxItems": 5,
            "items": {
              "type": "object",
              "required": ["lv","effects"],
              "additionalProperties": false,
              "properties": {
                "lv": { "type": "integer", "minimum": 1, "maximum": 5 },
                "effects": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/modifier" } }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본)

```json
{
  "schemaVersion": 1,
  "passives": [
    {
      "id": "P1", "nameKey": "passive.P1.name", "blessingId": "bls_hp", "maxLevel": 5, "iconKey": "icon_heart",
      "levels": [
        { "lv": 1, "effects": [ { "stat": "maxHp", "op": "add", "value": 15 } ] },
        { "lv": 2, "effects": [ { "stat": "maxHp", "op": "add", "value": 30 } ] },
        { "lv": 3, "effects": [ { "stat": "maxHp", "op": "add", "value": 45 } ] },
        { "lv": 4, "effects": [ { "stat": "maxHp", "op": "add", "value": 60 } ] },
        { "lv": 5, "effects": [ { "stat": "maxHp", "op": "add", "value": 75 } ] }
      ]
    },
    {
      "id": "P2", "nameKey": "passive.P2.name", "blessingId": "bls_dmg", "maxLevel": 5, "iconKey": "icon_claw",
      "levels": [
        { "lv": 1, "effects": [ { "stat": "damageMult", "op": "add", "value": 0.08 } ] },
        { "lv": 2, "effects": [ { "stat": "damageMult", "op": "add", "value": 0.16 } ] },
        { "lv": 3, "effects": [ { "stat": "damageMult", "op": "add", "value": 0.24 } ] },
        { "lv": 4, "effects": [ { "stat": "damageMult", "op": "add", "value": 0.32 } ] },
        { "lv": 5, "effects": [ { "stat": "damageMult", "op": "add", "value": 0.40 } ] }
      ]
    },
    {
      "id": "P3", "nameKey": "passive.P3.name", "blessingId": "bls_spd", "maxLevel": 5, "iconKey": "icon_cloak",
      "levels": [
        { "lv": 1, "effects": [ { "stat": "moveSpeed", "op": "add", "value": 4.2 } ] },
        { "lv": 2, "effects": [ { "stat": "moveSpeed", "op": "add", "value": 8.4 } ] },
        { "lv": 3, "effects": [ { "stat": "moveSpeed", "op": "add", "value": 12.6 } ] },
        { "lv": 4, "effects": [ { "stat": "moveSpeed", "op": "add", "value": 16.8 } ] },
        { "lv": 5, "effects": [ { "stat": "moveSpeed", "op": "add", "value": 21.0 } ] }
      ]
    },
    {
      "id": "P4", "nameKey": "passive.P4.name", "blessingId": "bls_as", "maxLevel": 5, "iconKey": "icon_watch",
      "levels": [
        { "lv": 1, "effects": [ { "stat": "attackSpeed", "op": "add", "value": 0.08 } ] },
        { "lv": 2, "effects": [ { "stat": "attackSpeed", "op": "add", "value": 0.16 } ] },
        { "lv": 3, "effects": [ { "stat": "attackSpeed", "op": "add", "value": 0.24 } ] },
        { "lv": 4, "effects": [ { "stat": "attackSpeed", "op": "add", "value": 0.32 } ] },
        { "lv": 5, "effects": [ { "stat": "attackSpeed", "op": "add", "value": 0.40 } ] }
      ]
    }
  ]
}
```

> P3의 `+6%/Lv`는 기본 `moveSpeed` 70 px/s 기준 절대값 `+4.2/Lv`로 전개했다.
> 이유: `add` 버킷을 **절대값 단일 타입**으로 통일해야 `applyModifier()`에 비율/절대 분기가 생기지 않는다.
> 결과값은 `05` §3.1의 절대값 표(Lv5 = 91.0 px/s)와 정확히 일치한다.

---

### 3.3 `enemies.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `id` | string | ✅ | `E1`~`E8`·`EL1`·`EL2`·`BOSS` | — | 고유 ID |
| `nameKey` | string | ✅ | — | — | 표시명 키 |
| `tier` | string | ✅ | `normal`·`elite`·`boss` | `normal` | HP바·아웃라인 연출 분기 |
| `baseHp` | number | ✅ | > 0 | — | hpMult 1.0 기준 HP |
| `contactDamage` | number | ✅ | ≥ 0 | — | dmgMult 미적용 기본 접촉 데미지 |
| `moveSpeed` | number | ✅ | ≥ 0 | — | px/s |
| `hitbox` | object | ✅ | `{w,h}` | — | 논리 픽셀 |
| `expValue` | int | ✅ | ≥ 0 | 0 | EXP 오브 값. 티어는 `orbTier` 규칙으로 자동 |
| `gold` | int | ✅ | ≥ 0 | 0 | **일반 적은 0** (골드 공식이 처치수×1로 커버) |
| `unlockAt` | number | ✅ | 0~360 | 0 | 등장 시각(초) |
| `ai` | string | ✅ | §3.3.1 | — | AI 종류 |
| `params` | object | — | AI별 | `{}` | 행동 파라미터 |
| `spriteKey` | string | ✅ | — | — | `assets.json` 키 |
| `knockbackResist` | number | — | 0~1 | 0 | 1 = 완전 저항 |
| `spawnable` | bool | — | — | true | false면 웨이브 가중치 풀에서 제외(E7/EL/BOSS) |
| `onDeath` | string\|null | — | `treasure_chest`·null | null | 처치 시 특수 보상 |
| `patterns[]` | array | — | 보스 전용 | — | §3.3.2 |

##### 3.3.1 `ai` 허용값

| ai | 사용 | 설명 |
|---|---|---|
| `chase_straight` | E1, E4, EL1, EL2, BOSS | 직선 추격 |
| `chase_stagger` | E2 | 직선 + 주기적 정지 |
| `chase_overshoot` | E3 | 저빈도 방향 재계산(오버슛) |
| `chase_zigzag` | E5 | 진행방향 수직 사인파 |
| `ranged_kite` | E6 | 거리 유지 + 투사체 |
| `swarm_wave` | E7 | 무리 대형 + 파도형 이동 |
| `charger` | E8 | 예비동작 후 돌진 |

##### 3.3.2 보스 `patterns[]` 필드

`phase`(1~3) · `id` · `damage` · `cooldown` · `windup` · `type`(`cone`/`projectile`/`summon`/`ground_aoe`) · `params`

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/enemies.json",
  "type": "object",
  "required": ["schemaVersion", "orbTiers", "enemies"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "orbTiers": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["maxExclusive", "key"],
        "properties": {
          "maxExclusive": { "type": ["number", "null"] },
          "key": { "type": "string" }
        }
      }
    },
    "enemies": {
      "type": "array", "minItems": 11,
      "items": {
        "type": "object",
        "required": ["id","nameKey","tier","baseHp","contactDamage","moveSpeed","hitbox","expValue","gold","unlockAt","ai","spriteKey"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^(E[1-8]|EL[12]|BOSS)$" },
          "nameKey": { "type": "string" },
          "tier": { "enum": ["normal","elite","boss"] },
          "baseHp": { "type": "number", "exclusiveMinimum": 0 },
          "contactDamage": { "type": "number", "minimum": 0 },
          "moveSpeed": { "type": "number", "minimum": 0 },
          "hitbox": {
            "type": "object", "required": ["w","h"], "additionalProperties": false,
            "properties": { "w": { "type": "number", "exclusiveMinimum": 0 }, "h": { "type": "number", "exclusiveMinimum": 0 } }
          },
          "expValue": { "type": "integer", "minimum": 0 },
          "gold": { "type": "integer", "minimum": 0 },
          "unlockAt": { "type": "number", "minimum": 0, "maximum": 360 },
          "ai": { "enum": ["chase_straight","chase_stagger","chase_overshoot","chase_zigzag","ranged_kite","swarm_wave","charger"] },
          "params": { "type": "object" },
          "spriteKey": { "type": "string" },
          "knockbackResist": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
          "spawnable": { "type": "boolean", "default": true },
          "onDeath": { "type": ["string","null"], "enum": ["treasure_chest", null], "default": null },
          "patterns": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["phase","id","cooldown","windup","type"],
              "properties": {
                "phase": { "type": "integer", "minimum": 1, "maximum": 3 },
                "id": { "type": "string" },
                "damage": { "type": "number", "minimum": 0 },
                "cooldown": { "type": "number", "exclusiveMinimum": 0 },
                "windup": { "type": "number", "minimum": 0.6 },
                "type": { "enum": ["cone","projectile","summon","ground_aoe"] },
                "params": { "type": "object" }
              }
            }
          },
          "phases": { "type": "array", "items": { "type": "object" } }
        }
      }
    }
  }
}
```

> `windup`의 `minimum: 0.6`은 정본 `03-GDD` §7.3 "모든 패턴은 0.6초 이상 예고"를 **스키마 레벨에서 강제**한 것이다.

#### 샘플 데이터 (완성본 — E1~E8 + EL1/EL2 + BOSS 전체)

```json
{
  "schemaVersion": 1,
  "orbTiers": [
    { "maxExclusive": 5,    "key": "orb_cyan" },
    { "maxExclusive": 20,   "key": "orb_blue" },
    { "maxExclusive": null, "key": "orb_purple" }
  ],
  "enemies": [
    {
      "id": "E1", "nameKey": "enemy.E1.name", "tier": "normal",
      "baseHp": 8, "contactDamage": 4, "moveSpeed": 95,
      "hitbox": { "w": 12, "h": 12 }, "expValue": 1, "gold": 0, "unlockAt": 0,
      "ai": "chase_straight", "params": {},
      "spriteKey": "enemy_vampire_bat", "knockbackResist": 0, "spawnable": true, "onDeath": null
    },
    {
      "id": "E2", "nameKey": "enemy.E2.name", "tier": "normal",
      "baseHp": 26, "contactDamage": 8, "moveSpeed": 38,
      "hitbox": { "w": 14, "h": 16 }, "expValue": 2, "gold": 0, "unlockAt": 0,
      "ai": "chase_stagger", "params": { "moveDuration": 0.8, "pauseDuration": 0.2 },
      "spriteKey": "enemy_mutilated_stumbler", "knockbackResist": 0.3, "spawnable": true, "onDeath": null
    },
    {
      "id": "E3", "nameKey": "enemy.E3.name", "tier": "normal",
      "baseHp": 4, "contactDamage": 5, "moveSpeed": 135,
      "hitbox": { "w": 10, "h": 10 }, "expValue": 1, "gold": 0, "unlockAt": 30,
      "ai": "chase_overshoot", "params": { "retargetInterval": 0.5 },
      "spriteKey": "enemy_skittering_hand", "knockbackResist": 0, "spawnable": true, "onDeath": null
    },
    {
      "id": "E4", "nameKey": "enemy.E4.name", "tier": "normal",
      "baseHp": 18, "contactDamage": 6, "moveSpeed": 62,
      "hitbox": { "w": 14, "h": 16 }, "expValue": 2, "gold": 0, "unlockAt": 90,
      "ai": "chase_straight", "params": { "separationRadius": 14 },
      "spriteKey": "enemy_decrepit_bones", "knockbackResist": 0, "spawnable": true, "onDeath": null
    },
    {
      "id": "E5", "nameKey": "enemy.E5.name", "tier": "normal",
      "baseHp": 22, "contactDamage": 7, "moveSpeed": 70,
      "hitbox": { "w": 14, "h": 16 }, "expValue": 3, "gold": 0, "unlockAt": 90,
      "ai": "chase_zigzag", "params": { "amplitude": 40, "period": 1.2 },
      "spriteKey": "enemy_grave_revenant", "knockbackResist": 0, "spawnable": true, "onDeath": null
    },
    {
      "id": "E6", "nameKey": "enemy.E6.name", "tier": "normal",
      "baseHp": 14, "contactDamage": 3, "moveSpeed": 48,
      "hitbox": { "w": 14, "h": 16 }, "expValue": 3, "gold": 0, "unlockAt": 180,
      "ai": "ranged_kite",
      "params": {
        "keepDistance": 160, "retreatBelow": 130, "approachAbove": 220,
        "fireCooldown": 2.2, "windup": 0.45,
        "projectileSpeed": 130, "projectileDamage": 9, "maxRange": 260,
        "projectileSpriteKey": "fx_bone_arrow"
      },
      "spriteKey": "enemy_brittle_archer", "knockbackResist": 0, "spawnable": true, "onDeath": null
    },
    {
      "id": "E7", "nameKey": "enemy.E7.name", "tier": "normal",
      "baseHp": 5, "contactDamage": 3, "moveSpeed": 110,
      "hitbox": { "w": 10, "h": 10 }, "expValue": 1, "gold": 0, "unlockAt": 180,
      "ai": "swarm_wave",
      "params": { "swarmSize": 8, "formationArc": 30, "waveAmplitude": 25, "wavePeriod": 0.8 },
      "spriteKey": "enemy_plague_bat", "knockbackResist": 0, "spawnable": false, "onDeath": null
    },
    {
      "id": "E8", "nameKey": "enemy.E8.name", "tier": "normal",
      "baseHp": 30, "contactDamage": 12, "moveSpeed": 55,
      "hitbox": { "w": 16, "h": 16 }, "expValue": 5, "gold": 0, "unlockAt": 270,
      "ai": "charger",
      "params": {
        "detectRange": 200, "windup": 0.60, "chargeSpeed": 260,
        "chargeDuration": 0.70, "chargeCooldown": 3.5,
        "chargeDamage": 12, "recoverTime": 0.4, "telegraphKey": "fx_charge_line"
      },
      "spriteKey": "enemy_crimson_imp", "knockbackResist": 0.5, "spawnable": true, "onDeath": null
    },
    {
      "id": "EL1", "nameKey": "enemy.EL1.name", "tier": "elite",
      "baseHp": 360, "contactDamage": 14, "moveSpeed": 44,
      "hitbox": { "w": 28, "h": 28 }, "expValue": 40, "gold": 25, "unlockAt": 90,
      "ai": "chase_straight", "params": { "hpMultiplierOf": "E4", "hpMultiplier": 20 },
      "spriteKey": "enemy_carcass_feeder", "knockbackResist": 1, "spawnable": false, "onDeath": "treasure_chest"
    },
    {
      "id": "EL2", "nameKey": "enemy.EL2.name", "tier": "elite",
      "baseHp": 720, "contactDamage": 20, "moveSpeed": 50,
      "hitbox": { "w": 32, "h": 32 }, "expValue": 60, "gold": 50, "unlockAt": 270,
      "ai": "chase_straight",
      "params": {
        "hpMultiplierOf": "E4", "hpMultiplier": 40,
        "shockwaveRadius": 110, "shockwaveDamage": 18, "shockwaveWindup": 0.80,
        "shockwaveCooldown": 6.0, "shockwaveKnockback": 80
      },
      "spriteKey": "enemy_depraved_blackguard", "knockbackResist": 1, "spawnable": false, "onDeath": null
    },
    {
      "id": "BOSS", "nameKey": "enemy.BOSS.name", "tier": "boss",
      "baseHp": 11000, "contactDamage": 16, "moveSpeed": 46,
      "hitbox": { "w": 56, "h": 80 }, "expValue": 0, "gold": 0, "unlockAt": 360,
      "ai": "chase_straight", "params": { "purgeMinionsOnSpawn": true, "phaseInvulnDuration": 1.2 },
      "spriteKey": "boss_bringer_of_death", "knockbackResist": 1, "spawnable": false, "onDeath": null,
      "phases": [
        { "phase": 1, "hpFrom": 1.00, "hpTo": 0.66, "moveSpeedMult": 1.0 },
        { "phase": 2, "hpFrom": 0.66, "hpTo": 0.33, "moveSpeedMult": 1.0 },
        { "phase": 3, "hpFrom": 0.33, "hpTo": 0.00, "moveSpeedMult": 1.4 }
      ],
      "patterns": [
        { "phase": 1, "id": "scythe",   "type": "cone",       "damage": 26, "cooldown": 3.20, "windup": 0.80, "params": { "angle": 130, "radius": 96, "knockback": 60 } },
        { "phase": 1, "id": "soulbolt", "type": "projectile", "damage": 18, "cooldown": 4.50, "windup": 0.60, "params": { "count": 3, "spread": 30, "speed": 150, "range": 400 } },
        { "phase": 2, "id": "scythe",   "type": "cone",       "damage": 26, "cooldown": 2.80, "windup": 0.80, "params": { "angle": 130, "radius": 96, "knockback": 60 } },
        { "phase": 2, "id": "soulbolt", "type": "projectile", "damage": 18, "cooldown": 4.50, "windup": 0.60, "params": { "count": 5, "spread": 50, "speed": 150, "range": 400 } },
        { "phase": 2, "id": "summon",   "type": "summon",     "damage": 0,  "cooldown": 12.0, "windup": 1.00, "params": { "enemyId": "E4", "count": 6, "ringRadius": 120, "hpMultOverride": 1.0 } },
        { "phase": 3, "id": "scythe",   "type": "cone",       "damage": 26, "cooldown": 1.68, "windup": 0.80, "params": { "angle": 130, "radius": 96, "knockback": 60 } },
        { "phase": 3, "id": "soulbolt", "type": "projectile", "damage": 18, "cooldown": 4.00, "windup": 0.60, "params": { "count": 5, "spread": 50, "speed": 170, "range": 400 } },
        { "phase": 3, "id": "summon",   "type": "summon",     "damage": 0,  "cooldown": 9.00, "windup": 1.00, "params": { "enemyId": "E4", "count": 6, "ringRadius": 120, "hpMultOverride": 1.0 } },
        { "phase": 3, "id": "bloodpool","type": "ground_aoe", "damage": 12, "cooldown": 5.00, "windup": 0.60, "params": { "radius": 70, "duration": 6.0, "tickInterval": 1.0, "maxActive": 4 } }
      ]
    }
  ]
}
```

---

### 3.4 `waves.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `globalMaxAlive` | int | ✅ | ≤ 150 | 150 | 동시 존재 상한 (성능 예산) |
| `ringSpawnRadius` | number | ✅ | > 0 | 400 | 카메라 밖 스폰 반경 |
| `despawnRadius` | number | ✅ | > 0 | 900 | 이 거리 초과 시 풀 반환 |
| `recycleOnCap` | bool | ✅ | — | true | 상한 도달 시 최원거리 적 텔레포트 재활용 |
| `curves` | object | — | — | — | 문서화용 배율 생성 공식. 런타임 미사용 |
| `segments[]` | array | ✅ | length 12 | — | 30초 구간 |
| `segments[].id` | string | ✅ | `S1`~`S12` | — | — |
| `segments[].start` / `end` | int | ✅ | 0~360 | — | 초 |
| `segments[].hpMult` / `dmgMult` | number | ✅ | ≥ 1 | — | 스폰 시 1회 적용 |
| `segments[].spawnInterval` | number | ✅ | > 0 | — | 초 |
| `segments[].maxAlive` | int | ✅ | ≤ 150 | — | 구간 동시 상한 |
| `segments[].weights` | object | ✅ | `{enemyId: int}` 합 100 | — | 스폰 가중치 |
| `segments[].events[]` | array | — | §3.4.1 | `[]` | 특수 이벤트 |
| `boss` | object | ✅ | — | — | 보스 진입 규칙 |

##### 3.4.1 이벤트 타입

| type | 필드 | 설명 |
|---|---|---|
| `preplacedOrbs` | `count`, `expValue`, `minRadius`, `maxRadius` | 런 시작 시 EXP 오브 선배치 |
| `spawnElite` | `at`(초), `enemyId` | 엘리트 1체 스폰 |
| `spawnSwarm` | `at`(초), `enemyId`, `count` | 무리 동시 스폰 |
| `screenTint` | `at`(초), `color`, `alpha`, `fadeIn` | 여명 직전 붉은 화면 연출 |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/waves.json",
  "type": "object",
  "required": ["schemaVersion","globalMaxAlive","ringSpawnRadius","despawnRadius","recycleOnCap","segments","boss"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "globalMaxAlive": { "type": "integer", "minimum": 1, "maximum": 150 },
    "ringSpawnRadius": { "type": "number", "exclusiveMinimum": 0 },
    "despawnRadius": { "type": "number", "exclusiveMinimum": 0 },
    "recycleOnCap": { "type": "boolean" },
    "curves": { "type": "object" },
    "segments": {
      "type": "array", "minItems": 12, "maxItems": 12,
      "items": {
        "type": "object",
        "required": ["id","start","end","hpMult","dmgMult","spawnInterval","maxAlive","weights"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^S([1-9]|1[0-2])$" },
          "start": { "type": "integer", "minimum": 0, "maximum": 360 },
          "end": { "type": "integer", "minimum": 0, "maximum": 360 },
          "hpMult": { "type": "number", "minimum": 1 },
          "dmgMult": { "type": "number", "minimum": 1 },
          "spawnInterval": { "type": "number", "exclusiveMinimum": 0 },
          "maxAlive": { "type": "integer", "minimum": 1, "maximum": 150 },
          "weights": {
            "type": "object",
            "minProperties": 1,
            "patternProperties": { "^E[1-8]$": { "type": "integer", "minimum": 0 } },
            "additionalProperties": false
          },
          "events": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": { "enum": ["preplacedOrbs","spawnElite","spawnSwarm","screenTint"] },
                "at": { "type": "number", "minimum": 0, "maximum": 360 },
                "enemyId": { "type": "string" },
                "count": { "type": "integer", "minimum": 1 },
                "expValue": { "type": "integer", "minimum": 1 },
                "minRadius": { "type": "number" },
                "maxRadius": { "type": "number" },
                "color": { "type": "string" },
                "alpha": { "type": "number" },
                "fadeIn": { "type": "number" }
              }
            }
          }
        }
      }
    },
    "boss": {
      "type": "object",
      "required": ["at","enemyId","purgeMinions","stopSpawning"],
      "properties": {
        "at": { "type": "integer", "const": 360 },
        "enemyId": { "type": "string", "const": "BOSS" },
        "purgeMinions": { "type": "boolean" },
        "stopSpawning": { "type": "boolean" },
        "flashColor": { "type": "string" },
        "flashDuration": { "type": "number" }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — 12구간 전체)

```json
{
  "schemaVersion": 1,
  "globalMaxAlive": 150,
  "ringSpawnRadius": 400,
  "despawnRadius": 900,
  "recycleOnCap": true,
  "curves": {
    "hpMult": "1.00 + Math.pow(t/60, 1.55) * 0.33",
    "dmgMult": "1.00 + Math.pow(t/60, 1.30) * 0.12",
    "note": "documentation only; runtime reads segments[] literally"
  },
  "segments": [
    {
      "id": "S1", "start": 0, "end": 30, "hpMult": 1.00, "dmgMult": 1.00,
      "spawnInterval": 1.20, "maxAlive": 15,
      "weights": { "E1": 60, "E2": 40 },
      "events": [ { "type": "preplacedOrbs", "count": 6, "expValue": 1, "minRadius": 80, "maxRadius": 160 } ]
    },
    {
      "id": "S2", "start": 30, "end": 60, "hpMult": 1.12, "dmgMult": 1.05,
      "spawnInterval": 1.05, "maxAlive": 22,
      "weights": { "E1": 50, "E2": 35, "E3": 15 },
      "events": []
    },
    {
      "id": "S3", "start": 60, "end": 90, "hpMult": 1.33, "dmgMult": 1.12,
      "spawnInterval": 0.90, "maxAlive": 30,
      "weights": { "E1": 45, "E2": 30, "E3": 25 },
      "events": []
    },
    {
      "id": "S4", "start": 90, "end": 120, "hpMult": 1.60, "dmgMult": 1.20,
      "spawnInterval": 0.75, "maxAlive": 40,
      "weights": { "E1": 30, "E2": 22, "E3": 18, "E4": 20, "E5": 10 },
      "events": [ { "type": "spawnElite", "at": 90, "enemyId": "EL1", "count": 1 } ]
    },
    {
      "id": "S5", "start": 120, "end": 150, "hpMult": 1.97, "dmgMult": 1.30,
      "spawnInterval": 0.66, "maxAlive": 50,
      "weights": { "E1": 26, "E2": 20, "E3": 18, "E4": 24, "E5": 12 },
      "events": []
    },
    {
      "id": "S6", "start": 150, "end": 180, "hpMult": 2.37, "dmgMult": 1.39,
      "spawnInterval": 0.55, "maxAlive": 64,
      "weights": { "E1": 22, "E2": 18, "E3": 16, "E4": 28, "E5": 16 },
      "events": []
    },
    {
      "id": "S7", "start": 180, "end": 210, "hpMult": 2.80, "dmgMult": 1.50,
      "spawnInterval": 0.45, "maxAlive": 80,
      "weights": { "E1": 18, "E2": 15, "E3": 15, "E4": 25, "E5": 17, "E6": 10 },
      "events": [
        { "type": "spawnElite", "at": 180, "enemyId": "EL1", "count": 1 },
        { "type": "spawnSwarm", "at": 180, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 195, "enemyId": "E7", "count": 8 }
      ]
    },
    {
      "id": "S8", "start": 210, "end": 240, "hpMult": 3.30, "dmgMult": 1.61,
      "spawnInterval": 0.39, "maxAlive": 95,
      "weights": { "E1": 16, "E2": 13, "E3": 15, "E4": 24, "E5": 19, "E6": 13 },
      "events": [
        { "type": "spawnSwarm", "at": 210, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 225, "enemyId": "E7", "count": 8 }
      ]
    },
    {
      "id": "S9", "start": 240, "end": 270, "hpMult": 3.83, "dmgMult": 1.73,
      "spawnInterval": 0.33, "maxAlive": 112,
      "weights": { "E1": 14, "E2": 13, "E3": 14, "E4": 23, "E5": 20, "E6": 16 },
      "events": [
        { "type": "spawnSwarm", "at": 240, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 250, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 260, "enemyId": "E7", "count": 8 }
      ]
    },
    {
      "id": "S10", "start": 270, "end": 300, "hpMult": 4.50, "dmgMult": 1.90,
      "spawnInterval": 0.28, "maxAlive": 130,
      "weights": { "E1": 12, "E2": 12, "E3": 12, "E4": 20, "E5": 18, "E6": 15, "E8": 11 },
      "events": [
        { "type": "spawnElite", "at": 270, "enemyId": "EL2", "count": 1 },
        { "type": "spawnSwarm", "at": 270, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 280, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 290, "enemyId": "E7", "count": 8 },
        { "type": "screenTint", "at": 270, "color": "#8b1a1a", "alpha": 0.18, "fadeIn": 6.0 }
      ]
    },
    {
      "id": "S11", "start": 300, "end": 330, "hpMult": 5.00, "dmgMult": 1.97,
      "spawnInterval": 0.25, "maxAlive": 140,
      "weights": { "E1": 10, "E2": 11, "E3": 12, "E4": 19, "E5": 18, "E6": 16, "E8": 14 },
      "events": [
        { "type": "spawnSwarm", "at": 300, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 307, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 315, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 322, "enemyId": "E7", "count": 8 }
      ]
    },
    {
      "id": "S12", "start": 330, "end": 360, "hpMult": 5.64, "dmgMult": 2.10,
      "spawnInterval": 0.22, "maxAlive": 150,
      "weights": { "E1": 8, "E2": 10, "E3": 12, "E4": 17, "E5": 18, "E6": 16, "E8": 19 },
      "events": [
        { "type": "spawnSwarm", "at": 330, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 337, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 345, "enemyId": "E7", "count": 8 },
        { "type": "spawnSwarm", "at": 352, "enemyId": "E7", "count": 8 }
      ]
    }
  ],
  "boss": {
    "at": 360,
    "enemyId": "BOSS",
    "purgeMinions": true,
    "stopSpawning": true,
    "flashColor": "#ff2b2b",
    "flashDuration": 0.45
  }
}
```

---

### 3.5 `blessings.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `id` | string | ✅ | `bls_*` | — | 정본 `04-PACT` §7과 **정확히 일치** |
| `nameKey` / `descKey` | string | ✅ | — | — | 표시 문자열 키 |
| `rarities` | string[] | ✅ | `common`·`rare`·`epic` 부분집합 | — | 이 축복이 나올 수 있는 등급 |
| `category` | string | ✅ | `weapon`·`weapon_engrave`·`stat`·`fallback` | — | 필터링/아이콘 분기 |
| `effects[]` | Modifier[] | ✅ | §2.1 | — | 적용 효과 |
| `requires` | object\|null | — | `{weapon, minLevel}` | null | 각인 축복 조건 |
| `maxStacks` | int\|null | — | ≥1 또는 null(무제한) | null | 중복 획득 상한 |
| `weight` | int | — | ≥0 | 100 | 후보 풀 내 상대 가중치 |
| `pool` | bool | — | — | true | false면 일반 롤에서 제외(폴백 전용) |
| `iconKey` | string | ✅ | — | — | Raven Fantasy 아이콘 키 |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/blessings.json",
  "type": "object",
  "required": ["schemaVersion","rarityWeights","blessings"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "rarityWeights": {
      "type": "object",
      "required": ["common","rare","epic"],
      "properties": {
        "common": { "type": "object", "required": ["base","perLevel"] },
        "rare": { "type": "object", "required": ["base","perLevel"] },
        "epic": { "type": "object", "required": ["base","perLevel"] }
      }
    },
    "guaranteeOneCommon": { "type": "boolean", "default": true },
    "noTollBelowLevel": { "type": "integer", "default": 4 },
    "rerollPerRun": { "type": "integer", "default": 2 },
    "skipReward": { "type": "object" },
    "blessings": {
      "type": "array", "minItems": 22,
      "items": {
        "type": "object",
        "required": ["id","nameKey","descKey","rarities","category","effects","iconKey"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^bls_[a-z0-9_]+$" },
          "nameKey": { "type": "string" },
          "descKey": { "type": "string" },
          "rarities": { "type": "array", "minItems": 1, "items": { "enum": ["common","rare","epic"] } },
          "category": { "enum": ["weapon","weapon_engrave","stat","fallback"] },
          "effects": { "type": "array", "minItems": 1 },
          "requires": {
            "type": ["object","null"],
            "properties": { "weapon": { "type": "string" }, "minLevel": { "type": "integer" } }
          },
          "maxStacks": { "type": ["integer","null"], "minimum": 1 },
          "weight": { "type": "integer", "minimum": 0, "default": 100 },
          "pool": { "type": "boolean", "default": true },
          "iconKey": { "type": "string" }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — 정본 §7의 22종 전체 + 폴백)

```json
{
  "schemaVersion": 1,
  "rarityWeights": {
    "common": { "base": 60, "perLevel": 0.0 },
    "rare":   { "base": 30, "perLevel": 1.2 },
    "epic":   { "base": 10, "perLevel": 0.8 }
  },
  "guaranteeOneCommon": true,
  "noTollBelowLevel": 4,
  "rerollPerRun": 2,
  "skipReward": { "healPctMaxHp": 0.25, "gold": 30, "humanityCost": 0 },
  "blessings": [
    { "id": "bls_w1",      "nameKey": "bls.w1.name",      "descKey": "bls.w1.desc",      "rarities": ["common","rare"], "category": "weapon",         "effects": [ { "op": "levelUp", "target": "W1", "value": 1 } ], "requires": null, "maxStacks": 5, "weight": 120, "pool": true, "iconKey": "icon_bloodfang" },
    { "id": "bls_w2",      "nameKey": "bls.w2.name",      "descKey": "bls.w2.desc",      "rarities": ["common","rare"], "category": "weapon",         "effects": [ { "op": "levelUp", "target": "W2", "value": 1 } ], "requires": null, "maxStacks": 5, "weight": 120, "pool": true, "iconKey": "icon_emberbolt" },
    { "id": "bls_w3",      "nameKey": "bls.w3.name",      "descKey": "bls.w3.desc",      "rarities": ["common","rare"], "category": "weapon",         "effects": [ { "op": "levelUp", "target": "W3", "value": 1 } ], "requires": null, "maxStacks": 5, "weight": 120, "pool": true, "iconKey": "icon_bone_orbit" },
    { "id": "bls_w4",      "nameKey": "bls.w4.name",      "descKey": "bls.w4.desc",      "rarities": ["rare"],          "category": "weapon",         "effects": [ { "op": "levelUp", "target": "W4", "value": 1 } ], "requires": null, "maxStacks": 5, "weight": 100, "pool": true, "iconKey": "icon_sanctum_rain" },
    { "id": "bls_w5",      "nameKey": "bls.w5.name",      "descKey": "bls.w5.desc",      "rarities": ["rare","epic"],   "category": "weapon",         "effects": [ { "op": "levelUp", "target": "W5", "value": 1 } ], "requires": null, "maxStacks": 5, "weight": 90,  "pool": true, "iconKey": "icon_chain_toll" },

    { "id": "bls_w1_x",    "nameKey": "bls.w1x.name",     "descKey": "bls.w1x.desc",     "rarities": ["epic"], "category": "weapon_engrave", "effects": [ { "op": "special", "id": "w1_double_slash", "params": { "delay": 0.15 } } ],                 "requires": { "weapon": "W1", "minLevel": 1 }, "maxStacks": 1, "weight": 60, "pool": true, "iconKey": "icon_engrave_slash" },
    { "id": "bls_w2_x",    "nameKey": "bls.w2x.name",     "descKey": "bls.w2x.desc",     "rarities": ["epic"], "category": "weapon_engrave", "effects": [ { "op": "special", "id": "w2_pierce_plus", "params": { "pierce": 2 } } ],                    "requires": { "weapon": "W2", "minLevel": 1 }, "maxStacks": 1, "weight": 60, "pool": true, "iconKey": "icon_engrave_pierce" },
    { "id": "bls_w3_x",    "nameKey": "bls.w3x.name",     "descKey": "bls.w3x.desc",     "rarities": ["epic"], "category": "weapon_engrave", "effects": [ { "op": "special", "id": "w3_orb_plus", "params": { "orbCount": 2, "radiusMult": 1.3 } } ], "requires": { "weapon": "W3", "minLevel": 1 }, "maxStacks": 1, "weight": 60, "pool": true, "iconKey": "icon_engrave_bone" },
    { "id": "bls_w4_x",    "nameKey": "bls.w4x.name",     "descKey": "bls.w4x.desc",     "rarities": ["epic"], "category": "weapon_engrave", "effects": [ { "op": "special", "id": "w4_duration_x2", "params": { "tickCountMult": 2 } } ],            "requires": { "weapon": "W4", "minLevel": 1 }, "maxStacks": 1, "weight": 60, "pool": true, "iconKey": "icon_engrave_water" },
    { "id": "bls_w5_x",    "nameKey": "bls.w5x.name",     "descKey": "bls.w5x.desc",     "rarities": ["epic"], "category": "weapon_engrave", "effects": [ { "op": "special", "id": "w5_chain_double", "params": { "chains": 6 } } ],                  "requires": { "weapon": "W5", "minLevel": 1 }, "maxStacks": 1, "weight": 60, "pool": true, "iconKey": "icon_engrave_chain" },

    { "id": "bls_hp",      "nameKey": "bls.hp.name",      "descKey": "bls.hp.desc",      "rarities": ["common"], "category": "stat", "effects": [ { "op": "levelUp", "target": "P1", "value": 1 } ], "requires": null, "maxStacks": 5,    "weight": 110, "pool": true, "iconKey": "icon_heart" },
    { "id": "bls_dmg",     "nameKey": "bls.dmg.name",     "descKey": "bls.dmg.desc",     "rarities": ["common"], "category": "stat", "effects": [ { "op": "levelUp", "target": "P2", "value": 1 } ], "requires": null, "maxStacks": 5,    "weight": 110, "pool": true, "iconKey": "icon_claw" },
    { "id": "bls_spd",     "nameKey": "bls.spd.name",     "descKey": "bls.spd.desc",     "rarities": ["common"], "category": "stat", "effects": [ { "op": "levelUp", "target": "P3", "value": 1 } ], "requires": null, "maxStacks": 5,    "weight": 110, "pool": true, "iconKey": "icon_cloak" },
    { "id": "bls_as",      "nameKey": "bls.as.name",      "descKey": "bls.as.desc",      "rarities": ["common"], "category": "stat", "effects": [ { "op": "levelUp", "target": "P4", "value": 1 } ], "requires": null, "maxStacks": 5,    "weight": 110, "pool": true, "iconKey": "icon_watch" },
    { "id": "bls_crit",    "nameKey": "bls.crit.name",    "descKey": "bls.crit.desc",    "rarities": ["rare"],   "category": "stat", "effects": [ { "stat": "critRate",     "op": "add", "value": 0.08 } ], "requires": null, "maxStacks": 6,    "weight": 90, "pool": true, "iconKey": "icon_eye" },
    { "id": "bls_critm",   "nameKey": "bls.critm.name",   "descKey": "bls.critm.desc",   "rarities": ["rare"],   "category": "stat", "effects": [ { "stat": "critMult",     "op": "add", "value": 0.40 } ], "requires": null, "maxStacks": 5,    "weight": 90, "pool": true, "iconKey": "icon_cruelty" },
    { "id": "bls_proj",    "nameKey": "bls.proj.name",    "descKey": "bls.proj.desc",    "rarities": ["rare"],   "category": "stat", "effects": [ { "stat": "projectileAdd","op": "add", "value": 1 } ],    "requires": null, "maxStacks": 3,    "weight": 70, "pool": true, "iconKey": "icon_split" },
    { "id": "bls_range",   "nameKey": "bls.range.name",   "descKey": "bls.range.desc",   "rarities": ["common"], "category": "stat", "effects": [ { "stat": "rangeMult",    "op": "add", "value": 0.12 } ], "requires": null, "maxStacks": 5,    "weight": 100, "pool": true, "iconKey": "icon_longarm" },
    { "id": "bls_ls",      "nameKey": "bls.ls.name",      "descKey": "bls.ls.desc",      "rarities": ["rare"],   "category": "stat", "effects": [ { "stat": "lifesteal",    "op": "add", "value": 1.5 } ],  "requires": null, "maxStacks": 5,    "weight": 90, "pool": true, "iconKey": "icon_lifesteal" },
    { "id": "bls_magnet",  "nameKey": "bls.magnet.name",  "descKey": "bls.magnet.desc",  "rarities": ["common"], "category": "stat", "effects": [ { "stat": "pickupRadius", "op": "add", "value": 9.6 } ],  "requires": null, "maxStacks": 5,    "weight": 100, "pool": true, "iconKey": "icon_hand" },
    { "id": "bls_area",    "nameKey": "bls.area.name",    "descKey": "bls.area.desc",    "rarities": ["rare"],   "category": "stat", "effects": [ { "stat": "areaMult",     "op": "add", "value": 0.18 } ], "requires": null, "maxStacks": 5,    "weight": 85, "pool": true, "iconKey": "icon_spread" },
    { "id": "bls_dmg_big", "nameKey": "bls.dmgbig.name",  "descKey": "bls.dmgbig.desc",  "rarities": ["epic"],   "category": "stat", "effects": [ { "stat": "damageMult",   "op": "add", "value": 0.22 } ], "requires": null, "maxStacks": null, "weight": 70, "pool": true, "iconKey": "icon_tyrant_claw" },

    { "id": "bls_fallback", "nameKey": "bls.fallback.name", "descKey": "bls.fallback.desc", "rarities": ["common"], "category": "fallback", "effects": [ { "op": "special", "id": "blood_crystal", "params": { "heal": 30 } }, { "stat": "damageMult", "op": "add", "value": 0.03 } ], "requires": null, "maxStacks": null, "weight": 0, "pool": false, "iconKey": "icon_blood_crystal" }
  ]
}
```

> **`bls_magnet` 값 `9.6`의 근거:** 정본은 "pickupRadius +30%"이나 `add` 버킷을 절대값으로 통일했으므로 기본값 32px의 30% = 9.6px로 전개했다(§3.2 P3와 동일 원칙).
> **`bls_w6`이 없는 이유:** 정본 §7에 W6 축복이 정의되어 있지 않다. W6은 COULD(컷 1순위)이므로 구현 시 `bls_w6`을 `rarities:["rare"]`로 추가하고 이 표를 23종으로 갱신한다.

---

### 3.6 `tolls.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 기본값 | 설명 |
|---|---|---|---|---|---|
| `rarityMultipliers` | object | ✅ | `{common,rare,epic}` | — | 등급배율 (정본 §4) |
| `rarityStacks` | object | ✅ | `{common,rare,epic}` | — | 등급별 부여 중첩 수 |
| `humanityCost` | object | ✅ | — | — | 등급별 인간성 감소 + 각성 상한 초과 |
| `awakenThreshold` | number | ✅ | 3 | 3 | 각성 필요 중첩 |
| `maxAwakeningsPerRun` | int | ✅ | 2 | 2 | 런당 각성 상한 |
| `tagWeightModifiers` | object | ✅ | — | — | 카드 생성 시 태그 가중치 보정 (정본 §6-3) |
| `tolls[].id` | string | ✅ | `T1`~`T6` | — | — |
| `tolls[].tag` | string | ✅ | 6종 | — | 각성의 단위 |
| `tolls[].effects[]` | Modifier[] | ✅ | `mulReduce` 또는 `add` | — | `value`에 `gradeMult`가 곱해짐 |
| `tolls[].clamp` | object | ✅ | `{stat, floor?, cap?}` | — | 안전장치 S1 |
| `tolls[].awakeningId` | string | ✅ | `awk_*` | — | 3중첩 시 발동할 각성 |
| `tolls[].auraColor` | string | ✅ | hex | — | 각성 후 오라 색 |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/tolls.json",
  "type": "object",
  "required": ["schemaVersion","rarityMultipliers","rarityStacks","humanityCost","awakenThreshold","maxAwakeningsPerRun","tagWeightModifiers","tolls"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "rarityMultipliers": {
      "type": "object", "required": ["common","rare","epic"], "additionalProperties": false,
      "properties": { "common": { "type": "number" }, "rare": { "type": "number" }, "epic": { "type": "number" } }
    },
    "rarityStacks": {
      "type": "object", "required": ["common","rare","epic"], "additionalProperties": false,
      "properties": { "common": { "type": "integer" }, "rare": { "type": "integer" }, "epic": { "type": "integer" } }
    },
    "humanityCost": {
      "type": "object", "required": ["common","rare","epic","awakenOverflow"], "additionalProperties": false,
      "properties": {
        "common": { "type": "number" }, "rare": { "type": "number" },
        "epic": { "type": "number" }, "awakenOverflow": { "type": "number" }
      }
    },
    "awakenThreshold": { "type": "number", "const": 3 },
    "maxAwakeningsPerRun": { "type": "integer", "const": 2 },
    "tagWeightModifiers": {
      "type": "object",
      "required": ["alreadyAwakened","nearThresholdAtCap","atFloor"],
      "properties": {
        "alreadyAwakened": { "type": "number" },
        "nearThresholdAtCap": { "type": "number" },
        "atFloor": { "type": "number" }
      }
    },
    "minDistinctTagsPerDraw": { "type": "integer", "default": 2 },
    "tolls": {
      "type": "array", "minItems": 6, "maxItems": 6,
      "items": {
        "type": "object",
        "required": ["id","tag","nameKey","descKey","effects","clamp","awakeningId","auraColor","iconKey"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^T[1-6]$" },
          "tag": { "enum": ["FRAIL","SLOW","MYOPIA","GREED","BLIND","HUNGER"] },
          "nameKey": { "type": "string" },
          "descKey": { "type": "string" },
          "baseWeight": { "type": "integer", "minimum": 0, "default": 100 },
          "effects": { "type": "array", "minItems": 1 },
          "clamp": {
            "type": "object", "required": ["stat"],
            "properties": { "stat": { "type": "string" }, "floor": { "type": "number" }, "cap": { "type": "number" } }
          },
          "awakeningId": { "type": "string", "pattern": "^awk_[a-z]+$" },
          "auraColor": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
          "iconKey": { "type": "string" }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — T1~T6 전체)

```json
{
  "schemaVersion": 1,
  "rarityMultipliers": { "common": 1.0, "rare": 1.8, "epic": 1.4 },
  "rarityStacks":      { "common": 1,   "rare": 1,   "epic": 2 },
  "humanityCost":      { "common": 3,   "rare": 6,   "epic": 12, "awakenOverflow": 20 },
  "awakenThreshold": 3,
  "maxAwakeningsPerRun": 2,
  "minDistinctTagsPerDraw": 2,
  "tagWeightModifiers": {
    "alreadyAwakened": 0.0,
    "nearThresholdAtCap": 0.2,
    "atFloor": 0.3
  },
  "tolls": [
    {
      "id": "T1", "tag": "FRAIL", "nameKey": "toll.FRAIL.name", "descKey": "toll.FRAIL.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "maxHp", "op": "mulReduce", "value": 0.12, "sourceTag": "FRAIL" } ],
      "clamp": { "stat": "maxHp", "floor": 25 },
      "awakeningId": "awk_frail", "auraColor": "#c0392b", "iconKey": "icon_toll_frail"
    },
    {
      "id": "T2", "tag": "SLOW", "nameKey": "toll.SLOW.name", "descKey": "toll.SLOW.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "moveSpeed", "op": "mulReduce", "value": 0.10, "sourceTag": "SLOW" } ],
      "clamp": { "stat": "moveSpeed", "floor": 32 },
      "awakeningId": "awk_slow", "auraColor": "#5b4a8a", "iconKey": "icon_toll_slow"
    },
    {
      "id": "T3", "tag": "MYOPIA", "nameKey": "toll.MYOPIA.name", "descKey": "toll.MYOPIA.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "rangeMult", "op": "mulReduce", "value": 0.18, "sourceTag": "MYOPIA" } ],
      "clamp": { "stat": "rangeMult", "floor": 0.35 },
      "awakeningId": "awk_myopia", "auraColor": "#b06a2c", "iconKey": "icon_toll_myopia"
    },
    {
      "id": "T4", "tag": "GREED", "nameKey": "toll.GREED.name", "descKey": "toll.GREED.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "expMult", "op": "mulReduce", "value": 0.15, "sourceTag": "GREED" } ],
      "clamp": { "stat": "expMult", "floor": 0.40 },
      "awakeningId": "awk_greed", "auraColor": "#c9a227", "iconKey": "icon_toll_greed"
    },
    {
      "id": "T5", "tag": "BLIND", "nameKey": "toll.BLIND.name", "descKey": "toll.BLIND.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "visionRadius", "op": "mulReduce", "value": 0.22, "sourceTag": "BLIND" } ],
      "clamp": { "stat": "visionRadius", "floor": 90 },
      "awakeningId": "awk_blind", "auraColor": "#2b2b3a", "iconKey": "icon_toll_blind"
    },
    {
      "id": "T6", "tag": "HUNGER", "nameKey": "toll.HUNGER.name", "descKey": "toll.HUNGER.desc",
      "baseWeight": 100,
      "effects": [ { "stat": "hpDrain", "op": "add", "value": 0.8, "sourceTag": "HUNGER" } ],
      "clamp": { "stat": "hpDrain", "cap": 4.0 },
      "awakeningId": "awk_hunger", "auraColor": "#8e1f3d", "iconKey": "icon_toll_hunger"
    }
  ]
}
```

**해석 규칙 (코드가 지켜야 할 3줄)**
1. 대가 적용 시 `value_eff = value × rarityMultipliers[rarity]`.
2. `mulReduce` → `Πmul *= (1 − value_eff)`. `add` → `Σadd += value_eff`.
3. `rarityStacks[rarity]`만큼 `tagCount[tag]` 증가. Epic은 **효과도 2회** 적용한다(중첩 2 = 저주 2회분).

> `visionRadius` 기본값은 정본 `03-GDD` §4.1에서 `∞`이므로, BLIND 최초 적용 시 **360**(화면 대각선 절반 + 여유)으로 초기화한 뒤 곱연산한다. 하한 90px까지 4중첩 가능.
> `T5 BLIND`는 정본 §11 구현 우선순위에서 P1(Day 5)이며, 컷 시 `baseWeight: 0`으로 내리면 코드 수정 없이 풀에서 빠진다.

---

### 3.7 `awakenings.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✅ | `awk_*` |
| `tag` | string\|null | ✅ | 6태그 또는 `null`(최종 각성) |
| `trigger` | object | ✅ | `{type:"tagStack", count:3}` 또는 `{type:"humanityZero"}` |
| `nameKey` / `quoteKey` / `descKey` | string | ✅ | 표시 문자열 |
| `removePenalty` | bool | ✅ | true면 해당 태그의 `mulReduce`를 곱연산 버킷에서 제거 |
| `effects[]` | Modifier[] | ✅ | §2.1 |
| `onTrigger` | object | ✅ | 발동 즉시 처리 (정본 §5.2 연출 + 안전장치 S6) |
| `auraColor` | string | ✅ | 파티클 오라 색 |
| `priority` | string | ✅ | `P0`·`P1`·`P2` (정본 §11 구현 순서) |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/awakenings.json",
  "type": "object",
  "required": ["schemaVersion","presentation","awakenings"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "presentation": {
      "type": "object",
      "required": ["hitstop","flashColor","invertDuration","shockwaveRadius","shockwaveStun"],
      "properties": {
        "hitstop": { "type": "number" },
        "flashColor": { "type": "string" },
        "invertDuration": { "type": "number" },
        "shockwaveRadius": { "type": "number" },
        "shockwaveStun": { "type": "number" },
        "shockwaveKnockback": { "type": "number" },
        "sfxKey": { "type": "string" }
      }
    },
    "awakenings": {
      "type": "array", "minItems": 7,
      "items": {
        "type": "object",
        "required": ["id","tag","trigger","nameKey","quoteKey","descKey","removePenalty","effects","onTrigger","auraColor","priority"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^awk_[a-z]+$" },
          "tag": { "type": ["string","null"], "enum": ["FRAIL","SLOW","MYOPIA","GREED","BLIND","HUNGER", null] },
          "trigger": {
            "type": "object", "required": ["type"],
            "properties": { "type": { "enum": ["tagStack","humanityZero"] }, "count": { "type": "integer" } }
          },
          "nameKey": { "type": "string" }, "quoteKey": { "type": "string" }, "descKey": { "type": "string" },
          "removePenalty": { "type": "boolean" },
          "effects": { "type": "array" },
          "onTrigger": {
            "type": "object",
            "properties": { "healPctMaxHp": { "type": "number" }, "codexUnlock": { "type": "boolean" }, "skipPresentation": { "type": "boolean" } }
          },
          "auraColor": { "type": "string" },
          "priority": { "enum": ["P0","P1","P2"] }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — 각성 6종 + 완전 흡혈귀화)

```json
{
  "schemaVersion": 1,
  "presentation": {
    "hitstop": 0.20,
    "flashColor": "#c8102e",
    "invertDuration": 0.15,
    "shockwaveRadius": 320,
    "shockwaveStun": 2.0,
    "shockwaveKnockback": 200,
    "sfxKey": "sfx_awakening_bell"
  },
  "awakenings": [
    {
      "id": "awk_frail", "tag": "FRAIL", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.frail.name", "quoteKey": "awk.frail.quote", "descKey": "awk.frail.desc",
      "removePenalty": false,
      "effects": [
        { "op": "special", "id": "husk_crit_heal",     "params": { "healPctMaxHp": 0.06 } },
        { "op": "special", "id": "husk_revive",        "params": { "hpPct": 0.5, "invulnSec": 2.0, "uses": 1 } },
        { "op": "special", "id": "husk_lowhp_damage",  "params": { "scale": 0.40 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#c0392b", "priority": "P0"
    },
    {
      "id": "awk_slow", "tag": "SLOW", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.slow.name", "quoteKey": "awk.slow.quote", "descKey": "awk.slow.desc",
      "removePenalty": true,
      "effects": [
        { "op": "special", "id": "weight_slow_aura",        "params": { "radius": 120, "enemySpeedMult": 0.60 } },
        { "op": "special", "id": "weight_bonus_vs_slowed",  "params": { "damageMult": 1.25 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#5b4a8a", "priority": "P0"
    },
    {
      "id": "awk_hunger", "tag": "HUNGER", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.hunger.name", "quoteKey": "awk.hunger.quote", "descKey": "awk.hunger.desc",
      "removePenalty": false,
      "effects": [
        { "stat": "lifesteal", "op": "add", "value": 4 },
        { "op": "special", "id": "thirst_kill_explosion",   "params": { "radius": 40, "damagePctBase": 0.60 } },
        { "op": "special", "id": "thirst_killstreak_speed", "params": { "windowSec": 3.0, "maxBonus": 0.35 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#8e1f3d", "priority": "P0"
    },
    {
      "id": "awk_myopia", "tag": "MYOPIA", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.myopia.name", "quoteKey": "awk.myopia.quote", "descKey": "awk.myopia.desc",
      "removePenalty": true,
      "effects": [
        { "op": "special", "id": "madness_close_damage",      "params": { "radius": 80, "damageMult": 2.0 } },
        { "op": "special", "id": "madness_close_attackspeed", "params": { "radius": 80, "maxBonus": 0.60 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#b06a2c", "priority": "P1"
    },
    {
      "id": "awk_greed", "tag": "GREED", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.greed.name", "quoteKey": "awk.greed.quote", "descKey": "awk.greed.desc",
      "removePenalty": true,
      "effects": [
        { "stat": "expMult",      "op": "mul", "value": 1.5 },
        { "stat": "pickupRadius", "op": "mul", "value": 4.0 },
        { "stat": "goldMult",     "op": "mul", "value": 2.0 },
        { "op": "special", "id": "avarice_orb_projectile", "params": { "damage": 10 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#c9a227", "priority": "P1"
    },
    {
      "id": "awk_blind", "tag": "BLIND", "trigger": { "type": "tagStack", "count": 3 },
      "nameKey": "awk.blind.name", "quoteKey": "awk.blind.quote", "descKey": "awk.blind.desc",
      "removePenalty": false,
      "effects": [
        { "op": "special", "id": "nyx_offscreen_marker", "params": { "color": "#ff3b3b" } },
        { "op": "special", "id": "nyx_offscreen_damage", "params": { "damageMult": 1.8 } },
        { "op": "special", "id": "nyx_offscreen_exp",    "params": { "expMult": 2.0 } }
      ],
      "onTrigger": { "healPctMaxHp": 0.30, "codexUnlock": true },
      "auraColor": "#2b2b3a", "priority": "P1"
    },
    {
      "id": "awk_ascension", "tag": null, "trigger": { "type": "humanityZero" },
      "nameKey": "awk.ascension.name", "quoteKey": "awk.ascension.quote", "descKey": "awk.ascension.desc",
      "removePenalty": false,
      "effects": [
        { "stat": "damageMult",  "op": "mul", "value": 1.5 },
        { "stat": "attackSpeed", "op": "mul", "value": 1.3 },
        { "stat": "moveSpeed",   "op": "mul", "value": 1.2 },
        { "stat": "hpDrain",     "op": "set", "value": 2.0 },
        { "op": "special", "id": "ascension_visual", "params": { "tint": "#ff4444", "saturation": 0.35, "tollPenaltyMult": 2.0 } }
      ],
      "onTrigger": { "healPctMaxHp": 0, "codexUnlock": true, "skipPresentation": false },
      "auraColor": "#ff2b2b", "priority": "P2"
    }
  ]
}
```

> `onTrigger.healPctMaxHp: 0.30`은 정본 `04-PACT` §9 안전장치 **S6**("각성 발동 시 HP 30% 회복")의 데이터화다.
> `awk_ascension`만 0인 이유: 정본 §5.4가 완전 흡혈귀화를 "이기기 쉬운 길이 아니라 도전 과제"로 규정했기 때문.
> `priority`는 정본 §11 구현 순서(P0 = Day 4, P1 = Day 5, P2 = Day 5)와 일치한다.

---

### 3.8 `meta-upgrades.json`

#### 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 설명 |
|---|---|---|---|---|
| `id` | string | ✅ | `meta_*` | 세이브의 `sanctum` 키와 동일 |
| `nameKey` / `descKey` | string | ✅ | — | 표시 문자열 |
| `maxLevel` | int | ✅ | 1~5 | 단계 수 |
| `costs` | int[] | ✅ | length == maxLevel | 1단계부터의 누진 비용 |
| `effectPerLevel` | Modifier | ✅ | §2.1 | **1단계당** 증분 |
| `applyAt` | string | ✅ | `runStart`·`cardGen`·`runtime` | 적용 시점 |
| `iconKey` | string | ✅ | — | 아이콘 |

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/meta-upgrades.json",
  "type": "object",
  "required": ["schemaVersion","goldFormula","upgrades"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "goldFormula": {
      "type": "object",
      "required": ["perKill","perSurvivedSecond","bossClear"],
      "properties": {
        "perKill": { "type": "number" },
        "perSurvivedSecond": { "type": "number" },
        "bossClear": { "type": "number" }
      }
    },
    "upgrades": {
      "type": "array", "minItems": 6, "maxItems": 6,
      "items": {
        "type": "object",
        "required": ["id","nameKey","descKey","maxLevel","costs","effectPerLevel","applyAt","iconKey"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^meta_[a-z_]+$" },
          "nameKey": { "type": "string" }, "descKey": { "type": "string" },
          "maxLevel": { "type": "integer", "minimum": 1, "maximum": 5 },
          "costs": { "type": "array", "items": { "type": "integer", "minimum": 1 } },
          "effectPerLevel": { "type": "object" },
          "applyAt": { "enum": ["runStart","cardGen","runtime"] },
          "iconKey": { "type": "string" }
        }
      }
    }
  }
}
```

#### 샘플 데이터 (완성본 — 성소 6종)

```json
{
  "schemaVersion": 1,
  "goldFormula": { "perKill": 1, "perSurvivedSecond": 0.5, "bossClear": 200 },
  "upgrades": [
    {
      "id": "meta_tough", "nameKey": "meta.tough.name", "descKey": "meta.tough.desc",
      "maxLevel": 5, "costs": [50, 120, 250, 500, 900],
      "effectPerLevel": { "stat": "maxHp", "op": "add", "value": 10 },
      "applyAt": "runStart", "iconKey": "icon_meta_tough"
    },
    {
      "id": "meta_sharp", "nameKey": "meta.sharp.name", "descKey": "meta.sharp.desc",
      "maxLevel": 5, "costs": [60, 140, 280, 550, 1000],
      "effectPerLevel": { "stat": "damageMult", "op": "add", "value": 0.04 },
      "applyAt": "runStart", "iconKey": "icon_meta_sharp"
    },
    {
      "id": "meta_swift", "nameKey": "meta.swift.name", "descKey": "meta.swift.desc",
      "maxLevel": 5, "costs": [50, 120, 250, 500, 900],
      "effectPerLevel": { "stat": "moveSpeed", "op": "add", "value": 2.1 },
      "applyAt": "runStart", "iconKey": "icon_meta_swift"
    },
    {
      "id": "meta_greed", "nameKey": "meta.greed.name", "descKey": "meta.greed.desc",
      "maxLevel": 5, "costs": [80, 180, 350, 650, 1200],
      "effectPerLevel": { "stat": "goldMult", "op": "add", "value": 0.10 },
      "applyAt": "runStart", "iconKey": "icon_meta_greed"
    },
    {
      "id": "meta_awaken_boost", "nameKey": "meta.awaken.name", "descKey": "meta.awaken.desc",
      "maxLevel": 2, "costs": [300, 800],
      "effectPerLevel": { "op": "special", "id": "awaken_threshold_reduce", "params": { "delta": -0.2 } },
      "applyAt": "runStart", "iconKey": "icon_meta_awaken"
    },
    {
      "id": "meta_recontract", "nameKey": "meta.recontract.name", "descKey": "meta.recontract.desc",
      "maxLevel": 3, "costs": [200, 500, 1000],
      "effectPerLevel": { "op": "special", "id": "reroll_plus", "params": { "delta": 1 } },
      "applyAt": "cardGen", "iconKey": "icon_meta_recontract"
    }
  ]
}
```

> `meta_swift`의 `+2.1`은 정본 "moveSpeed +3%"를 기본 70px/s 기준 절대값으로 전개한 값(§3.2 P3와 동일 원칙).
> **총 소요 골드 = 1,820 + 2,030 + 1,820 + 2,460 + 1,100 + 1,700 = 10,930.**
> `05-COMBAT-AND-BALANCE.md` §5.4의 "클리어 런당 약 1,318 골드" 기준 **약 9~11회 클리어**로 만렙.

---

### 3.9 `strings.ko.json`

#### 필드 규격

플랫(flat) 키-값 맵. **중첩 객체를 쓰지 않는다** — `t("bls.w1.name")` 조회가 `obj[key]` 한 줄로 끝난다.

| 키 네임스페이스 | 용도 |
|---|---|
| `ui.*` | 버튼·라벨·HUD |
| `weapon.W*.name` / `weapon.W*.lv*` | 무기명·레벨 특수효과 |
| `passive.P*.name` | 패시브명 |
| `enemy.*.name` | 적 이름(도감용) |
| `bls.*.name` / `bls.*.desc` | 축복 |
| `toll.*.name` / `toll.*.desc` | 대가 (`{v}` = 치환될 수치) |
| `awk.*.name` / `awk.*.quote` / `awk.*.desc` | 각성 |
| `meta.*.name` / `meta.*.desc` | 성소 |
| `nocturne.line.*` | 녹턴 대사 풀 (정본 §5.2, 12개) |
| `ending.*` | 엔딩 텍스트 |

플레이스홀더 규약: `{v}` (값), `{n}` (개수), `{lv}` (레벨). `String.replace`로 치환.

#### ★ 길이 제약 — PACT 카드가 좁다 (2026-08-10 추가)

카드 프레임 자산이 **160×240**으로 확정되면서(`10-UIUX-LANDSCAPE.md` 2.5.1) 카드 내부 콘텐츠 폭이 **136px**가 되었다.
아래 키는 **넘치면 잘린다.** 값을 쓸 때 글자 수를 지켜야 한다.

| 키 | 폰트 | 가용 폭 | 한글 한도 | 넘칠 때 |
|---|---|---|---|---|
| `bls.*.name` | **16px** | 136 | **약 8자** | ⚠ 가장 위험. 이름을 줄이지 말고 **14px 2줄**로 떨어뜨린다(세로 여유 있음) |
| `bls.*.desc` | 12px | 136 | 약 11자 × 2줄 | 2줄까지 허용. 3줄이면 문구를 줄인다 |
| `toll.*.name` | 14px | 칩 내부 | 약 6자 | 태그 칩이라 특히 좁다 |
| `toll.*.desc` | 12px | 136 | 약 11자 | `{v}` 치환 후 길이로 판정할 것 |
| `awk.*.name` | 각성 연출용 대형 | 화면 폭 | 제약 없음 | 카드가 아니라 전체 화면에 뜬다 |

> **검증 방법:** 데이터 작성 후 가장 긴 문자열로 한 번 렌더해 본다. `13-QA-TEST-PLAN.md`의 카드 UI 케이스에
> **"가장 긴 축복 이름으로 잘림 없음"** 을 포함시킨다. 눈으로 안 보면 Day 6에 발견한다.

#### JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/strings.ko.json",
  "type": "object",
  "propertyNames": { "pattern": "^[a-zA-Z0-9_.]+$" },
  "additionalProperties": { "type": "string" }
}
```

#### 샘플 데이터 (발췌 — 전 키의 구조를 보여주는 완성 조각)

```json
{
  "ui.title.start": "계약을 시작한다",
  "ui.title.sanctum": "성소",
  "ui.title.options": "설정",
  "ui.hud.level": "Lv.{lv}",
  "ui.hud.humanity": "인간성",
  "ui.hud.awakening": "각성:{n}",
  "ui.pact.header": "계 약 서",
  "ui.pact.blessing": "✦ 축복",
  "ui.pact.toll": "✖ 대가",
  "ui.pact.humanityCost": "인간성 -{v}",
  "ui.pact.reroll": "다시 뽑기 ({n})",
  "ui.pact.skip": "전부 거절 (HP 25% 회복 + 골드 30)",
  "ui.pact.awakenHint": "이 계약으로 각성한다",
  "ui.pact.stack": "{name} 중첩: {v}",
  "ui.result.retry": "다시",
  "ui.result.toTitle": "타이틀로",

  "weapon.W1.name": "피의 송곳니",
  "weapon.W1.lv3": "참격 잔상 유지",
  "weapon.W1.lv4": "처치 시 20% 확률로 즉시 재참격",
  "weapon.W1.lv5": "후방까지 베어낸다",
  "weapon.W2.name": "화염탄",
  "weapon.W2.lv1": "최근접 적 자동 조준",
  "weapon.W2.lv3": "2연사",
  "weapon.W2.lv4": "관통 1",
  "weapon.W2.lv5": "3발 확산",
  "weapon.W3.name": "뼈 회오리",
  "weapon.W3.lv1": "상시 발동",
  "weapon.W3.lv4": "적 투사체 1회 파괴",
  "weapon.W4.name": "성수 낙하",
  "weapon.W4.lv1": "3초마다 랜덤 낙하",
  "weapon.W4.lv5": "장판 지속 1.8초",
  "weapon.W5.name": "사슬 종",
  "weapon.W5.lv1": "3체 연쇄, 감쇠 70%",
  "weapon.W6.name": "그림자 메아리",
  "weapon.W6.lv1": "궤적을 따르는 분신",
  "weapon.W6.lv4": "분신이 적을 밀어낸다",

  "passive.P1.name": "꺼지지 않는 심장",
  "passive.P2.name": "진조의 발톱",
  "passive.P3.name": "밤의 망토",
  "passive.P4.name": "묘지기의 회중시계",

  "enemy.E1.name": "흡혈박쥐",
  "enemy.E2.name": "썩은 비틀거림",
  "enemy.E3.name": "기어오는 손",
  "enemy.E4.name": "낡은 해골",
  "enemy.E5.name": "무덤 망령",
  "enemy.E6.name": "부서진 궁수",
  "enemy.E7.name": "역병 박쥐 떼",
  "enemy.E8.name": "진홍 임프",
  "enemy.EL1.name": "시체 포식자",
  "enemy.EL2.name": "타락한 흑기사",
  "enemy.BOSS.name": "여명의 처형인",

  "bls.w1.name": "피의 송곳니", "bls.w1.desc": "피의 송곳니 획득 / 강화",
  "bls.w2.name": "화염탄", "bls.w2.desc": "화염탄 획득 / 강화",
  "bls.w3.name": "뼈 회오리", "bls.w3.desc": "뼈 회오리 획득 / 강화",
  "bls.w4.name": "성수 낙하", "bls.w4.desc": "성수 낙하 획득 / 강화",
  "bls.w5.name": "사슬 종", "bls.w5.desc": "사슬 종 획득 / 강화",
  "bls.w1x.name": "피의 송곳니 각인", "bls.w1x.desc": "참격이 2연타가 된다",
  "bls.w2x.name": "화염탄 각인", "bls.w2x.desc": "관통 +2",
  "bls.w3x.name": "뼈 회오리 각인", "bls.w3x.desc": "유골 +2, 궤도 반경 +30%",
  "bls.w4x.name": "성수 각인", "bls.w4x.desc": "장판 지속 ×2",
  "bls.w5x.name": "사슬 각인", "bls.w5x.desc": "연쇄 3 → 6",
  "bls.hp.name": "꺼지지 않는 심장", "bls.hp.desc": "최대 체력 +15",
  "bls.dmg.name": "진조의 발톱", "bls.dmg.desc": "공격력 +8%",
  "bls.spd.name": "밤의 망토", "bls.spd.desc": "이동 속도 +6%",
  "bls.as.name": "묘지기의 회중시계", "bls.as.desc": "공격 속도 +8%",
  "bls.crit.name": "처형자의 눈", "bls.crit.desc": "치명타 확률 +8%",
  "bls.critm.name": "잔혹", "bls.critm.desc": "치명타 배율 +0.4",
  "bls.proj.name": "분열의 인장", "bls.proj.desc": "모든 무기 투사체 +1",
  "bls.range.name": "긴 팔", "bls.range.desc": "사거리 +12%",
  "bls.ls.name": "흡혈", "bls.ls.desc": "처치당 체력 +1.5",
  "bls.magnet.name": "갈망의 손", "bls.magnet.desc": "자석 범위 +30%",
  "bls.area.name": "확산", "bls.area.desc": "광역 크기 +18%",
  "bls.dmgbig.name": "폭군의 손톱", "bls.dmgbig.desc": "공격력 +22%",
  "bls.fallback.name": "피의 결정", "bls.fallback.desc": "체력 30 회복, 공격력 +3%",

  "toll.FRAIL.name": "허약", "toll.FRAIL.desc": "최대 체력 -{v}%",
  "toll.SLOW.name": "둔족", "toll.SLOW.desc": "이동 속도 -{v}%",
  "toll.MYOPIA.name": "근시", "toll.MYOPIA.desc": "모든 무기 사거리 -{v}%",
  "toll.GREED.name": "탐욕", "toll.GREED.desc": "경험치 획득 -{v}%",
  "toll.BLIND.name": "암야", "toll.BLIND.desc": "시야 반경 -{v}%",
  "toll.HUNGER.name": "갈증", "toll.HUNGER.desc": "초당 체력 -{v}",

  "awk.frail.name": "불사의 껍질", "awk.frail.quote": "부서지기 쉬운 것은, 부서지지 않는 법을 배운다.", "awk.frail.desc": "치명타 시 최대 체력 6% 회복 · 사망 시 1회 부활 · 체력이 낮을수록 공격력 상승",
  "awk.slow.name": "중력의 군주", "awk.slow.quote": "움직이지 않는 자가, 세상을 멈춘다.", "awk.slow.desc": "둔족 해제 · 반경 120px 내 적 이동속도 -40% · 느려진 적에게 데미지 +25%",
  "awk.myopia.name": "접촉의 광기", "awk.myopia.quote": "멀리 볼 수 없다면, 끌어안는 수밖에.", "awk.myopia.desc": "근시 해제 · 반경 80px 내 데미지 ×2.0 · 근접 시 공격속도 최대 +60%",
  "awk.greed.name": "탐욕의 왕관", "awk.greed.quote": "덜 받는 자가, 결국 전부 가진다.", "awk.greed.desc": "탐욕 해제 + 경험치 ×1.5 · 자석 ×4.0 · 골드 ×2.0 · 경험치 오브가 적을 관통하며 데미지",
  "awk.blind.name": "어둠의 눈", "awk.blind.quote": "눈을 감아라. 이제 다른 것으로 본다.", "awk.blind.desc": "시야 밖 적을 붉은 실루엣으로 감지 · 시야 밖 데미지 ×1.8 · 시야 밖 처치 경험치 2배",
  "awk.hunger.name": "진조의 갈증", "awk.hunger.quote": "굶주림은 멈추지 않는다. 그러니 멈추지 마라.", "awk.hunger.desc": "처치당 체력 +4 · 처치 시 반경 40px 피 폭발 · 연속 처치 시 이동속도 최대 +35%",
  "awk.ascension.name": "완전 흡혈귀화", "awk.ascension.quote": "이제 너는 나와 같다.", "awk.ascension.desc": "공격력 ×1.5 · 공격속도 ×1.3 · 이동속도 ×1.2 · 모든 대가 2배 · 초당 체력 -2.0",

  "meta.tough.name": "강인함", "meta.tough.desc": "최대 체력 +10",
  "meta.sharp.name": "예리함", "meta.sharp.desc": "공격력 +4%",
  "meta.swift.name": "신속", "meta.swift.desc": "이동 속도 +3%",
  "meta.greed.name": "탐욕", "meta.greed.desc": "골드 획득 +10%",
  "meta.awaken.name": "각성 촉진", "meta.awaken.desc": "각성 필요 중첩 -0.2",
  "meta.recontract.name": "재계약", "meta.recontract.desc": "런당 다시 뽑기 +1",

  "nocturne.line.01": "골라. 어느 쪽이든 나는 이득이야.",
  "nocturne.line.02": "그건 아프지 않아. 나중에 아프지.",
  "nocturne.line.03": "인간은 항상 눈앞의 것을 고르더군.",
  "nocturne.line.04": "좋은 선택이야. 나한테는.",
  "nocturne.line.05": "조금만 가져갈게. 늘 그랬듯이.",
  "nocturne.line.06": "네 심장, 아직 뛰고 있나?",
  "nocturne.line.07": "새벽까지 얼마 안 남았어. 서둘러.",
  "nocturne.line.08": "거절해도 돼. 죽어도 된다면.",
  "nocturne.line.09": "이번엔 조금 비싸. 그만큼 좋거든.",
  "nocturne.line.10": "손이 떨리는군. 벌써?",
  "nocturne.line.11": "셋 중 하나. 세상은 늘 그렇게 잔인해.",
  "nocturne.line.12": "내 사슬, 헐거워지는 소리가 들려.",

  "ending.defeat.title": "먹이",
  "ending.defeat.body": "아깝군. 다음 그릇을 기다려야겠어.",
  "ending.a.title": "인간",
  "ending.a.body": "성촉이 다시 타오른다. 에일라는 살아남았고, 아직 사람이다.",
  "ending.b.title": "서약자",
  "ending.b.body": "봉인은 유지됐다. 하지만 거울 속 얼굴이 낯설다.",
  "ending.c.title": "진조",
  "ending.c.body": "새벽이 온다. 에일라는 사슬 앞에 선다. 녹턴이 웃으며 자리를 비켜준다."
}
```

---

## 4. 세이브 데이터 스키마

### 4.1 저장 위치와 형식

| 항목 | 값 |
|---|---|
| 저장소 | **2층 write-through** — `localStorage`(동기 핫 캐시) + **`@capacitor/preferences`**(영속 계층) |
| 키 | `bloodsworn.save.v1` (양쪽 동일) |
| 형식 | `JSON.stringify` 단일 객체 |
| 쓰기 시점 | 런 종료 시 · 성소 구매 시 · 옵션 변경 시 (**런 중에는 쓰지 않는다** — 프레임 스파이크 방지) |
| 읽기 시점 | **부팅 시 1회** — Preferences 우선, 없으면 `localStorage`에서 읽어 마이그레이션 |
| 크기 예산 | < 4KB |

> ⚠ **`localStorage` 단독은 iOS에서 안전하지 않다 (2026-08-10 결정 변경).**
> Capacitor 공식 문서가 `localStorage`를 **transient**로 규정하고, **저장공간이 부족하면 OS가 WebView 저장소를 회수**한다고 명시한다.
> 사용자 입장에서는 **아무 경고 없이 진행이 사라진다.** `@capacitor/preferences`는 iOS `UserDefaults` / Android `SharedPreferences`를 쓰며
> WebKit 저장소 회수 대상이 아니다.
>
> **이 문서의 스키마 자체는 바뀌지 않는다** — 필드·타입·마이그레이션 규칙은 아래 §4.2 이후 그대로다. **저장 매체만 2층이 되었다.**
> 구현 계약과 근거 전문: `06-TECH-DESIGN.md` §12.0 · 리스크: `16-RISKS-AND-SCOPE-CUTS.md` R23 · 검증: `13-QA-TEST-PLAN.md` SV-12~14

### 4.2 필드 규격

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `version` | int | ✅ | 1 | 마이그레이션 기준 |
| `gold` | int | ✅ | 0 | 보유 골드 |
| `sanctum` | object | ✅ | 전부 0 | 성소 강화 단계. 키 = `meta-upgrades.json`의 `id` |
| `unlocks.stage2` | bool | ✅ | false | 스테이지 2 해금 |
| `unlocks.char2` | bool | ✅ | false | 캐릭터 2 「배교자」 |
| `unlocks.awakenCodex` | string[] | ✅ | `[]` | 발동 경험한 각성 ID 목록 |
| `stats.*` | number | ✅ | 0 | 누적 통계 (§10.1 계측 지표의 원천) |
| `options.*` | mixed | ✅ | §4.3 | 옵션 |
| `lastPlayedAt` | int | ✅ | 0 | epoch ms |

### 4.3 JSON Schema (draft-07) + 기본 세이브

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/save.v1",
  "type": "object",
  "required": ["version","gold","sanctum","unlocks","stats","options","lastPlayedAt"],
  "additionalProperties": false,
  "properties": {
    "version": { "type": "integer", "minimum": 1 },
    "gold": { "type": "integer", "minimum": 0 },
    "sanctum": {
      "type": "object", "additionalProperties": false,
      "required": ["meta_tough","meta_sharp","meta_swift","meta_greed","meta_awaken_boost","meta_recontract"],
      "properties": {
        "meta_tough": { "type": "integer", "minimum": 0, "maximum": 5 },
        "meta_sharp": { "type": "integer", "minimum": 0, "maximum": 5 },
        "meta_swift": { "type": "integer", "minimum": 0, "maximum": 5 },
        "meta_greed": { "type": "integer", "minimum": 0, "maximum": 5 },
        "meta_awaken_boost": { "type": "integer", "minimum": 0, "maximum": 2 },
        "meta_recontract": { "type": "integer", "minimum": 0, "maximum": 3 }
      }
    },
    "unlocks": {
      "type": "object", "additionalProperties": false,
      "required": ["stage2","char2","awakenCodex"],
      "properties": {
        "stage2": { "type": "boolean" },
        "char2": { "type": "boolean" },
        "awakenCodex": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
      }
    },
    "stats": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "runs": { "type": "integer", "minimum": 0 },
        "clears": { "type": "integer", "minimum": 0 },
        "deaths": { "type": "integer", "minimum": 0 },
        "bestTimeSec": { "type": "number", "minimum": 0 },
        "totalKills": { "type": "integer", "minimum": 0 },
        "totalAwakenings": { "type": "integer", "minimum": 0 },
        "sumFirstLevelUpAt": { "type": "number", "minimum": 0 },
        "sumDeathTime": { "type": "number", "minimum": 0 },
        "sumBossFightDuration": { "type": "number", "minimum": 0 },
        "sumFinalLevel": { "type": "integer", "minimum": 0 },
        "sumFinalHumanity": { "type": "integer", "minimum": 0 },
        "sumLevelUpCount": { "type": "integer", "minimum": 0 },
        "sumFirstAwakenAt": { "type": "number", "minimum": 0 },
        "awakenOverflowCount": { "type": "integer", "minimum": 0 },
        "rerollUses": { "type": "integer", "minimum": 0 },
        "skipUses": { "type": "integer", "minimum": 0 },
        "sumGoldEarned": { "type": "integer", "minimum": 0 },
        "bossEncounters": { "type": "integer", "minimum": 0 }
      }
    },
    "options": {
      "type": "object", "additionalProperties": false,
      "required": ["bgm","sfx","screenShake","damageNumbers","joystickMode","lowSpec","lang"],
      "properties": {
        "bgm": { "type": "number", "minimum": 0, "maximum": 1 },
        "sfx": { "type": "number", "minimum": 0, "maximum": 1 },
        "screenShake": { "type": "boolean" },
        "damageNumbers": { "type": "boolean" },
        "joystickMode": { "enum": ["floating","fixed"] },
        "lowSpec": { "type": "boolean" },
        "lang": { "enum": ["ko","en"] }
      }
    },
    "lastPlayedAt": { "type": "integer", "minimum": 0 }
  }
}
```

```json
{
  "version": 1,
  "gold": 0,
  "sanctum": {
    "meta_tough": 0, "meta_sharp": 0, "meta_swift": 0,
    "meta_greed": 0, "meta_awaken_boost": 0, "meta_recontract": 0
  },
  "unlocks": { "stage2": false, "char2": false, "awakenCodex": [] },
  "stats": {
    "runs": 0, "clears": 0, "deaths": 0, "bestTimeSec": 0,
    "totalKills": 0, "totalAwakenings": 0,
    "sumFirstLevelUpAt": 0, "sumDeathTime": 0, "sumBossFightDuration": 0,
    "sumFinalLevel": 0, "sumFinalHumanity": 0, "sumLevelUpCount": 0,
    "sumFirstAwakenAt": 0, "awakenOverflowCount": 0,
    "rerollUses": 0, "skipUses": 0, "sumGoldEarned": 0, "bossEncounters": 0
  },
  "options": {
    "bgm": 0.9, "sfx": 0.8, "screenShake": true, "damageNumbers": true,
    "joystickMode": "fixed", "lowSpec": false, "lang": "ko"
  },
  "lastPlayedAt": 0
}
```

> `stats`가 **합계(sum) + 횟수(count)** 형태인 이유: 평균은 언제든 나눗셈으로 얻을 수 있고, 배열 누적보다 크기가 상수다.
> `05-COMBAT-AND-BALANCE.md` §10.1의 전 지표가 이 필드들로 계산된다.
> 예: `첫 사망 평균 시각 = sumDeathTime / deaths`, `각성 발동률 = totalAwakenings / runs`, `클리어율 = clears / runs`.

### 4.4 버전 마이그레이션 규칙

**원칙 3가지**
1. **키 이름은 절대 바꾸지 않는다.** 의미가 변하면 새 키를 추가하고 옛 키는 무시한다.
2. **삭제하지 않는다.** 안 쓰는 키는 남겨둔다(4KB 예산 안에서는 무해).
3. **마이그레이션은 단방향 함수 체인.** `v1→v2`, `v2→v3`를 각각 순수 함수로 만들고 순서대로 적용한다.

```js
// FE/src/data/saveMigrations.js
const MIGRATIONS = {
  // 1: (save) => ...   // v1이 최신이므로 아직 없음
  // 2: (save) => ({ ...save, version: 3, newField: defaultValue }),
};

export const CURRENT_SAVE_VERSION = 1;
export const SAVE_KEY = 'bloodsworn.save.v1';   // 키는 고정. version 필드로만 관리한다

// ★ 이 함수는 2층 저장 도입 후에도 동기 그대로 유지된다.
//   부팅 시 main.jsx에서 hydrateSave()가 먼저 실행되어 Preferences(영속) → localStorage(핫 캐시)로
//   값을 채우기 때문에, 여기서 읽는 localStorage는 "이미 hydrate된 캐시"다.
//   이 구조 덕분에 마이그레이션 로직을 async로 승격할 필요가 없다.
//   부팅 순서와 hydrateSave()/writeSave() 구현: 06-TECH-DESIGN.md §12.1~12.2
export function loadSave(defaults) {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    raw = null;                       // 손상된 JSON → 신규 세이브로 취급
  }
  if (!raw || typeof raw !== 'object') return structuredClone(defaults);

  let save = raw;
  let v = Number.isInteger(save.version) ? save.version : 1;

  while (v < CURRENT_SAVE_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) { console.warn(`[save] no migration for v${v}, resetting`); return structuredClone(defaults); }
    save = fn(save);
    v = save.version;
  }
  if (v > CURRENT_SAVE_VERSION) {      // 구버전 앱으로 롤백된 경우
    console.warn('[save] future version, keeping read-only');
    return { ...structuredClone(defaults), __readonly: true };
  }
  return deepMergeDefaults(structuredClone(defaults), save);  // 신규 키는 기본값으로 채움
}
```

| 상황 | 처리 |
|---|---|
| `localStorage`에 값 없음 | 기본 세이브 생성 |
| JSON 파싱 실패 | 기본 세이브로 리셋 (백업 없음 — 7일 스코프) |
| `version` < 현재 | `MIGRATIONS` 체인 순차 적용 |
| `version` > 현재 | 읽기 전용 모드. 덮어쓰지 않는다 |
| 신규 필드 추가 | `deepMergeDefaults`가 기본값으로 자동 채움 → **마이그레이션 함수 불필요** |
| 필드 의미 변경 | 반드시 새 키 + 마이그레이션 함수 (예: `gold`의 단위가 바뀌면 `goldV2` 신설) |

> **7일 스코프 판단:** 출시 전이므로 v1 이후 마이그레이션이 필요할 가능성은 낮다.
> 그러나 `loadSave()` 골격(파싱 실패 방어 + `deepMergeDefaults`)만은 **Day 1에 넣는다.**
> 개발 중 스키마가 계속 바뀌는데, 이게 없으면 매번 개발자 도구로 `localStorage.clear()`를 치게 된다.

---

## 5. 에셋 매니페스트 스키마 (`assets.json`)

### 5.1 목적

`PreloadScene`이 하드코딩된 `this.load.spritesheet(...)` 수십 줄을 갖지 않도록 한다.
에셋 추가 = **JSON 한 줄 추가**.

### 5.2 필드 규격

| 필드 | 타입 | 필수 | 허용값 | 설명 |
|---|---|---|---|---|
| `basePath` | string | ✅ | — | 모든 `url`의 공통 접두사 |
| `assets[].key` | string | ✅ | 고유 | Phaser 텍스처 키 |
| `assets[].type` | string | ✅ | `image`·`spritesheet`·`atlas`·`audio`·`tilemapTiledJSON`·`bitmapFont` | 로더 분기 |
| `assets[].url` | string | ✅ | — | `basePath` 기준 상대 경로 |
| `assets[].atlasURL` | string | `atlas`일 때 ✅ | — | JSON 경로 |
| `assets[].frameConfig` | object | `spritesheet`일 때 ✅ | `{frameWidth,frameHeight,startFrame?,endFrame?,margin?,spacing?}` | — |
| `assets[].group` | string | ✅ | `boot`·`core`·`stage1`·`ui`·`audio` | 로딩 그룹. `boot`만 BootScene에서 선로드 |
| `assets[].animations[]` | array | — | `{key,frames,frameRate,repeat}` | 등록할 애니메이션 |

### 5.3 JSON Schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "bloodsworn/assets.json",
  "type": "object",
  "required": ["schemaVersion","basePath","assets"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "basePath": { "type": "string" },
    "assets": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["key","type","url","group"],
        "additionalProperties": false,
        "properties": {
          "key": { "type": "string", "pattern": "^[a-z0-9_]+$" },
          "type": { "enum": ["image","spritesheet","atlas","audio","tilemapTiledJSON","bitmapFont"] },
          "url": { "type": "string" },
          "atlasURL": { "type": "string" },
          "fontDataURL": { "type": "string" },
          "frameConfig": {
            "type": "object",
            "required": ["frameWidth","frameHeight"],
            "properties": {
              "frameWidth": { "type": "integer", "exclusiveMinimum": 0 },
              "frameHeight": { "type": "integer", "exclusiveMinimum": 0 },
              "startFrame": { "type": "integer", "minimum": 0 },
              "endFrame": { "type": "integer", "minimum": -1 },
              "margin": { "type": "integer", "minimum": 0 },
              "spacing": { "type": "integer", "minimum": 0 }
            }
          },
          "group": { "enum": ["boot","core","stage1","ui","audio"] },
          "animations": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["key","frames","frameRate"],
              "properties": {
                "key": { "type": "string" },
                "frames": { "type": "array", "items": { "type": "integer" }, "minItems": 1 },
                "frameRate": { "type": "integer", "exclusiveMinimum": 0 },
                "repeat": { "type": "integer", "minimum": -1, "default": -1 }
              }
            }
          }
        }
      }
    }
  }
}
```

### 5.4 샘플 데이터 (발췌)

```json
{
  "schemaVersion": 1,
  "basePath": "assets/",
  "assets": [
    { "key": "logo", "type": "image", "url": "ui/logo.png", "group": "boot" },
    { "key": "loading_bar", "type": "image", "url": "ui/loading_bar.png", "group": "boot" },

    {
      "key": "player_eila", "type": "spritesheet",
      "url": "character/FREE_Adventurer 2D Pixel Art/adventurer.png",
      "frameConfig": { "frameWidth": 96, "frameHeight": 80 },
      "group": "core",
      "animations": [
        { "key": "eila_idle_down", "frames": [0,1,2,3],     "frameRate": 6,  "repeat": -1 },
        { "key": "eila_run_down",  "frames": [8,9,10,11],   "frameRate": 10, "repeat": -1 },
        { "key": "eila_attack",    "frames": [24,25,26,27], "frameRate": 14, "repeat": 0 }
      ]
    },
    {
      "key": "enemy_vampire_bat", "type": "spritesheet",
      "url": "enemy/Basic Undead/Vampire Bat/vampire_bat.png",
      "frameConfig": { "frameWidth": 16, "frameHeight": 16 },
      "group": "core",
      "animations": [ { "key": "e1_fly", "frames": [0,1,2,3], "frameRate": 12, "repeat": -1 } ]
    },
    {
      "key": "boss_bringer_of_death", "type": "spritesheet",
      "url": "bosses/Bringer-Of-Death/bringer_of_death.png",
      "frameConfig": { "frameWidth": 100, "frameHeight": 100 },
      "group": "stage1",
      "animations": [
        { "key": "boss_idle",   "frames": [0,1,2,3,4,5,6,7], "frameRate": 8,  "repeat": -1 },
        { "key": "boss_scythe", "frames": [16,17,18,19,20],  "frameRate": 12, "repeat": 0 }
      ]
    },

    { "key": "fx_slash",        "type": "spritesheet", "url": "effect/Free/Part16.png", "frameConfig": { "frameWidth": 64, "frameHeight": 64 }, "group": "core" },
    { "key": "fx_firebullet",   "type": "spritesheet", "url": "projectile/All_Fire_Bullet_1.png", "frameConfig": { "frameWidth": 16, "frameHeight": 16 }, "group": "core" },
    { "key": "fx_holy_pool",    "type": "spritesheet", "url": "effect/Free/Part23.png", "frameConfig": { "frameWidth": 64, "frameHeight": 64 }, "group": "core" },
    { "key": "fx_chain_bolt",   "type": "spritesheet", "url": "effect/Free/Part30.png", "frameConfig": { "frameWidth": 64, "frameHeight": 64 }, "group": "core" },

    { "key": "icons_16", "type": "spritesheet", "url": "icons/raven_fantasy_icons.png", "frameConfig": { "frameWidth": 16, "frameHeight": 16 }, "group": "ui" },

    { "key": "tiles_main", "type": "image", "url": "tileset/mainlevbuild.png", "group": "stage1" },
    { "key": "map_stage1", "type": "tilemapTiledJSON", "url": "map/stage1.json", "group": "stage1" },

    { "key": "bgm_ambient",        "type": "audio", "url": "audio/bgm_ambient.ogg", "group": "audio" },
    { "key": "sfx_awakening_bell", "type": "audio", "url": "audio/sfx_bell.ogg", "group": "audio" }
  ]
}
```

### 5.5 PreloadScene 사용 예

```js
import manifest from '../../data/assets.json';

const LOADERS = {
  image:            (s, a) => s.load.image(a.key, manifest.basePath + a.url),
  spritesheet:      (s, a) => s.load.spritesheet(a.key, manifest.basePath + a.url, a.frameConfig),
  atlas:            (s, a) => s.load.atlas(a.key, manifest.basePath + a.url, manifest.basePath + a.atlasURL),
  audio:            (s, a) => s.load.audio(a.key, manifest.basePath + a.url),
  tilemapTiledJSON: (s, a) => s.load.tilemapTiledJSON(a.key, manifest.basePath + a.url),
  bitmapFont:       (s, a) => s.load.bitmapFont(a.key, manifest.basePath + a.url, manifest.basePath + a.fontDataURL),
};

export function loadGroup(scene, group) {
  for (const a of manifest.assets) {
    if (a.group !== group) continue;
    LOADERS[a.type](scene, a);
  }
}

export function registerAnimations(scene) {
  for (const a of manifest.assets) {
    for (const anim of a.animations ?? []) {
      if (scene.anims.exists(anim.key)) continue;
      scene.anims.create({
        key: anim.key,
        frames: scene.anims.generateFrameNumbers(a.key, { frames: anim.frames }),
        frameRate: anim.frameRate,
        repeat: anim.repeat ?? -1,
      });
    }
  }
}
```

---

## 6. 검증 전략 — `validateData()`

### 6.1 방침

7일 스코프에서 **AJV 같은 런타임 스키마 검증기를 번들에 넣지 않는다.**
대신 손으로 쓴 **개발 모드 전용 검증 함수 하나**를 둔다. 200줄 미만이고 프로덕션 번들에서 트리셰이킹된다.

| 잡을 것 | 안 잡을 것 |
|---|---|
| ID 오타 / 참조 깨짐 (`bls_w9`, `enemyId: "E9"`) | 타입 세부 검증(number vs string) — 상수 파일이라 실수 확률 낮음 |
| 배열 길이 (레벨 5개, 구간 12개) | JSON 문법 오류 — Vite가 import 단계에서 잡음 |
| 가중치 합 ≠ 100 | 성능 |
| 스탯 키 화이트리스트 위반 | |
| `special` 훅 ID 미구현 | |
| 문서 표(`dpsSingle`)와 실제 수치 불일치 | |
| `strings.ko.json` 키 누락 | |

### 6.2 구현

```js
// FE/src/data/validateData.js
import weapons from './weapons.json';
import passives from './passives.json';
import enemies from './enemies.json';
import waves from './waves.json';
import blessings from './blessings.json';
import tolls from './tolls.json';
import awakenings from './awakenings.json';
import metaUpgrades from './meta-upgrades.json';
import strings from './strings.ko.json';

const STAT_KEYS = new Set([
  'maxHp','moveSpeed','damageMult','attackSpeed','rangeMult','projectileAdd',
  'critRate','critMult','lifesteal','pickupRadius','expMult','goldMult',
  'visionRadius','humanity','hpDrain','areaMult',
]);

const OPS = new Set(['add','mul','mulReduce','set','levelUp','special']);

const SPECIAL_IDS = new Set([
  'w1_double_slash','w2_pierce_plus','w3_orb_plus','w4_duration_x2','w5_chain_double',
  'blood_crystal','husk_crit_heal','husk_revive','husk_lowhp_damage',
  'weight_slow_aura','weight_bonus_vs_slowed','madness_close_damage','madness_close_attackspeed',
  'avarice_orb_projectile','nyx_offscreen_marker','nyx_offscreen_damage','nyx_offscreen_exp',
  'thirst_kill_explosion','thirst_killstreak_speed','ascension_visual',
  'awaken_threshold_reduce','reroll_plus',
]);

export function validateData() {
  if (!import.meta.env.DEV) return true;          // 프로덕션에서는 통째로 제거됨

  const errors = [];
  const warns = [];
  const E = (m) => errors.push(m);
  const W = (m) => warns.push(m);

  const weaponIds  = new Set(weapons.weapons.map(w => w.id));
  const passiveIds = new Set(passives.passives.map(p => p.id));
  const enemyIds   = new Set(enemies.enemies.map(e => e.id));
  const tagIds     = new Set(tolls.tolls.map(t => t.tag));
  const awkIds     = new Set(awakenings.awakenings.map(a => a.id));

  // --- 1. 모디파이어 공통 검증 -------------------------------------------
  const checkMods = (mods, where) => {
    for (const m of mods ?? []) {
      if (!OPS.has(m.op)) E(`${where}: unknown op "${m.op}"`);
      if (['add','mul','mulReduce','set'].includes(m.op)) {
        if (!STAT_KEYS.has(m.stat)) E(`${where}: unknown stat "${m.stat}"`);
        if (typeof m.value !== 'number' || Number.isNaN(m.value)) E(`${where}: bad value`);
      }
      if (m.op === 'levelUp' && !weaponIds.has(m.target) && !passiveIds.has(m.target)) {
        E(`${where}: levelUp target "${m.target}" not found`);
      }
      if (m.op === 'special' && !SPECIAL_IDS.has(m.id)) E(`${where}: unimplemented special "${m.id}"`);
      if (m.sourceTag && !tagIds.has(m.sourceTag)) E(`${where}: unknown sourceTag "${m.sourceTag}"`);
    }
  };

  // --- 2. weapons --------------------------------------------------------
  for (const w of weapons.weapons) {
    if (w.levels.length !== 5) E(`weapon ${w.id}: levels must be 5, got ${w.levels.length}`);
    w.levels.forEach((l, i) => {
      if (l.lv !== i + 1) E(`weapon ${w.id}: levels[${i}].lv should be ${i + 1}`);
      if (l.damage <= 0 || l.cooldown <= 0) E(`weapon ${w.id} Lv${l.lv}: damage/cooldown must be > 0`);
      if (i > 0 && l.damage < w.levels[i - 1].damage) W(`weapon ${w.id} Lv${l.lv}: damage decreased`);
      if (typeof l.dpsSingle === 'number' && ['melee_cone','projectile','chain'].includes(w.type)) {
        const calc = l.damage / l.cooldown;
        if (Math.abs(calc - l.dpsSingle) / l.dpsSingle > 0.02) {
          W(`weapon ${w.id} Lv${l.lv}: dpsSingle ${l.dpsSingle} != calc ${calc.toFixed(2)} (doc drift)`);
        }
      }
    });
  }

  // --- 3. enemies --------------------------------------------------------
  for (const e of enemies.enemies) {
    if (e.baseHp <= 0) E(`enemy ${e.id}: baseHp must be > 0`);
    if (e.hitbox.w <= 0 || e.hitbox.h <= 0) E(`enemy ${e.id}: bad hitbox`);
    for (const p of e.patterns ?? []) {
      if (p.windup < 0.6) E(`enemy ${e.id} pattern ${p.id}: windup ${p.windup} < 0.6 (GDD 7.3)`);
      if (p.type === 'summon' && !enemyIds.has(p.params.enemyId)) E(`enemy ${e.id}: summon target not found`);
    }
  }

  // --- 4. waves ----------------------------------------------------------
  if (waves.segments.length !== 12) E(`waves: expected 12 segments, got ${waves.segments.length}`);
  let prevEnd = 0;
  for (const s of waves.segments) {
    if (s.start !== prevEnd) E(`waves ${s.id}: start ${s.start} != previous end ${prevEnd}`);
    prevEnd = s.end;
    const sum = Object.values(s.weights).reduce((a, b) => a + b, 0);
    if (sum !== 100) E(`waves ${s.id}: weights sum ${sum} != 100`);
    for (const [eid, w] of Object.entries(s.weights)) {
      const en = enemies.enemies.find(x => x.id === eid);
      if (!en) { E(`waves ${s.id}: unknown enemy "${eid}"`); continue; }
      if (en.spawnable === false) E(`waves ${s.id}: "${eid}" is not spawnable via weights`);
      if (w > 0 && en.unlockAt > s.start) E(`waves ${s.id}: "${eid}" unlockAt ${en.unlockAt} > segment start ${s.start}`);
    }
    if (s.maxAlive > waves.globalMaxAlive) E(`waves ${s.id}: maxAlive exceeds global cap`);
    for (const ev of s.events ?? []) {
      if (ev.enemyId && !enemyIds.has(ev.enemyId)) E(`waves ${s.id}: event enemy "${ev.enemyId}" not found`);
      if (ev.at !== undefined && (ev.at < s.start || ev.at >= s.end)) E(`waves ${s.id}: event at ${ev.at} outside segment`);
    }
  }
  if (prevEnd !== 360) E(`waves: last segment must end at 360, got ${prevEnd}`);
  if (!enemyIds.has(waves.boss.enemyId)) E(`waves: boss enemy not found`);

  // --- 5. blessings ------------------------------------------------------
  const blsIds = new Set();
  for (const b of blessings.blessings) {
    if (blsIds.has(b.id)) E(`blessing ${b.id}: duplicate id`);
    blsIds.add(b.id);
    checkMods(b.effects, `blessing ${b.id}`);
    if (b.requires?.weapon && !weaponIds.has(b.requires.weapon)) E(`blessing ${b.id}: requires unknown weapon`);
  }
  for (const w of weapons.weapons) {
    if (w.priority !== 'COULD' && !blsIds.has(w.blessingId)) E(`weapon ${w.id}: blessing "${w.blessingId}" missing`);
  }
  for (const p of passives.passives) {
    if (!blsIds.has(p.blessingId)) E(`passive ${p.id}: blessing "${p.blessingId}" missing`);
  }

  // --- 6. tolls & awakenings --------------------------------------------
  if (tolls.tolls.length !== 6) E(`tolls: expected 6, got ${tolls.tolls.length}`);
  for (const t of tolls.tolls) {
    checkMods(t.effects, `toll ${t.id}`);
    if (!awkIds.has(t.awakeningId)) E(`toll ${t.id}: awakening "${t.awakeningId}" not found`);
    if (t.clamp.floor === undefined && t.clamp.cap === undefined) E(`toll ${t.id}: clamp needs floor or cap (safety S1)`);
  }
  for (const a of awakenings.awakenings) {
    checkMods(a.effects, `awakening ${a.id}`);
    if (a.tag !== null && !tagIds.has(a.tag)) E(`awakening ${a.id}: unknown tag`);
  }
  for (const tag of tagIds) {
    if (!awakenings.awakenings.some(a => a.tag === tag)) E(`tag ${tag}: no awakening defined`);
  }

  // --- 7. meta-upgrades --------------------------------------------------
  for (const u of metaUpgrades.upgrades) {
    if (u.costs.length !== u.maxLevel) E(`meta ${u.id}: costs length ${u.costs.length} != maxLevel ${u.maxLevel}`);
    for (let i = 1; i < u.costs.length; i++) {
      if (u.costs[i] <= u.costs[i - 1]) W(`meta ${u.id}: cost not increasing at step ${i + 1}`);
    }
    checkMods([u.effectPerLevel], `meta ${u.id}`);
  }

  // --- 8. strings --------------------------------------------------------
  const needKeys = [
    ...weapons.weapons.map(w => w.nameKey),
    ...passives.passives.map(p => p.nameKey),
    ...enemies.enemies.map(e => e.nameKey),
    ...blessings.blessings.flatMap(b => [b.nameKey, b.descKey]),
    ...tolls.tolls.flatMap(t => [t.nameKey, t.descKey]),
    ...awakenings.awakenings.flatMap(a => [a.nameKey, a.quoteKey, a.descKey]),
    ...metaUpgrades.upgrades.flatMap(u => [u.nameKey, u.descKey]),
  ];
  for (const k of new Set(needKeys)) {
    if (typeof strings[k] !== 'string') E(`strings.ko: missing key "${k}"`);
  }

  // --- 출력 --------------------------------------------------------------
  if (warns.length) console.warn(`[validateData] ${warns.length} warning(s)\n` + warns.join('\n'));
  if (errors.length) {
    console.error(`[validateData] ${errors.length} ERROR(s)\n` + errors.join('\n'));
    throw new Error(`데이터 검증 실패: ${errors.length}건. 콘솔을 확인하세요.`);
  }
  console.info('[validateData] OK');
  return true;
}
```

### 6.3 호출 위치

```js
// FE/src/main.jsx
import { validateData } from './data/validateData';
if (import.meta.env.DEV) validateData();   // 앱 마운트 전. 실패하면 즉시 throw
```

**설계 의도:** 개발 모드에서 **앱이 아예 안 뜨게** 만든다.
경고만 띄우면 무시하고 넘어가서, "왜 3:00부터 적이 안 나오지?"를 30분 디버깅하게 된다.
데이터 오타는 **로딩 시점에 큰 소리로 죽는 것**이 7일 스코프에서 가장 싸다.

### 6.4 추가 안전망 (선택, 여유 있을 때만)

| 항목 | 비용 | 효과 |
|---|---|---|
| `npm run validate` — Node에서 `validateData()`만 실행 | 15분 | 커밋 전 CI 없이 체크 |
| `.vscode/settings.json`에 `json.schemas` 매핑 | 10분 | **에디터에서 실시간 자동완성 + 오타 표시.** 가성비 최상 |
| AJV로 draft-07 스키마 실제 검증 | 1시간+ | 이번 주 스코프 밖 |

```json
{
  "json.schemas": [
    { "fileMatch": ["/FE/src/data/weapons.json"],  "url": "./docs/schema/weapons.schema.json" },
    { "fileMatch": ["/FE/src/data/enemies.json"],  "url": "./docs/schema/enemies.schema.json" },
    { "fileMatch": ["/FE/src/data/waves.json"],    "url": "./docs/schema/waves.schema.json" }
  ]
}
```

---

## 7. 데이터 ↔ 문서 정합성 체크리스트

수치를 고칠 때 **반드시 함께 갱신할 위치**.

| 바꾸는 것 | 함께 고칠 곳 |
|---|---|
| 무기 데미지/쿨 | `weapons.json` · `05` §2 해당 무기표 · `05` §2.7 성장률 요약 · `05` §6.1 보스 HP 역산 |
| 적 `expValue` | `enemies.json` · `05` §4.2 · `05` §7.2 EXP 시뮬레이션 전체 |
| 웨이브 배율/간격 | `waves.json` · `05` §5.2 · `05` §5.4 처치 수 · `05` §7.2 |
| 대가 `value` / `clamp` | `tolls.json` · `05` §8 PACT 검산 · `04-PACT` §4 (정본 수정 필요) |
| 등급 가중치 | `blessings.json` · `05` §8.2 · `04-PACT` §3.1 (정본 수정 필요) |
| BOSS HP | `enemies.json` · `05` §6.1 · `05` §6.3 |
| 성소 비용 | `meta-upgrades.json` · `05` §5.4 골드 수명 계산 · `03-GDD` §9.1 |

---

## 8. 다음 문서

- 수치의 설계 근거와 검산: → `05-COMBAT-AND-BALANCE.md`
- 구현 아키텍처(StatSystem / PactSystem / EventBus / 오브젝트 풀): → `06-TECH-DESIGN.md`
- PACT 시스템 원본 명세: → `04-PACT-SYSTEM.md`
- 7일 일정: → `11-ROADMAP-7DAYS.md`
