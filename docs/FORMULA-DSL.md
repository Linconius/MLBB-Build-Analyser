# Formula DSL

Skill algorithms and item passive effects express their magnitudes as **arithmetic
formula strings** over a fixed, closed set of variables. Formulas are evaluated by
[`expr-eval`](https://www.npmjs.com/package/expr-eval) — a small math grammar with **no
member access, no property lookup, and no code execution**. There is no `eval`, no
`Function()`, and no JS callbacks living next to the data.

A formula may use:

- numbers and the operators `+ - * / ^ ( )`
- the whitelisted functions: `min, max, floor, ceil, round, abs`
- variables drawn **only** from the vocabulary below

The validator parses every formula and rejects any that references a variable outside
this vocabulary, so a typo can never silently become a `0`.

## Variable vocabulary (closed set)

These resolve, at each simulation tick, to the hero's effective stats at the current
level/build, plus the configured target's stats.

### Caster (the hero)
| Variable | Meaning |
|---|---|
| `physical_attack` | Effective (total) physical attack |
| `magic_power` | Effective (total) magic power |
| `bonus_physical_attack` | Physical attack from items/emblems only (total − hero base) — for skills that scale with "Extra Physical Attack" |
| `bonus_magic_power` | Magic power from items only (total − hero base) |
| `physical_defense` | Effective physical defense |
| `magic_defense` | Effective magic defense |
| `max_hp` | Maximum HP |
| `current_hp` | Current HP (sim assumes full unless modelled) |
| `missing_hp` | `max_hp - current_hp` |
| `max_mana` | Maximum mana/resource |
| `current_mana` | Current mana |
| `attack_speed` | Attacks per second (capped 3.0) |
| `movement_speed` | Movement speed |
| `crit_chance` | Crit chance (0–1) |
| `crit_damage` | Crit damage multiplier |
| `cooldown_reduction` | CDR fraction (0–0.45) |
| `physical_penetration_flat` | Flat physical pen |
| `physical_penetration_pct` | % physical pen (0–1) |
| `magic_penetration_flat` | Flat magic pen |
| `magic_penetration_pct` | % magic pen (0–1) |
| `adaptive_attack` | Resolved adaptive value |
| `hero_level` | 1–15 |
| `skill_level` | 1–N for the skill owning the formula |

### Target (a configurable dummy in the simulator)
| Variable | Meaning |
|---|---|
| `target_max_hp` | Target maximum HP |
| `target_current_hp` | Target current HP |
| `target_missing_hp` | `target_max_hp - target_current_hp` |
| `target_physical_defense` | Target physical defense |
| `target_magic_defense` | Target magic defense |

## Conditionals

There are **no ternaries or branches inside a formula** — keep each formula a pure
arithmetic expression so a balance change is a one-token diff. Conditional behaviour
("deal 25% more to targets below 50% HP") is modelled as a **separate algorithm** with a
`condition` field — itself a DSL formula evaluating to `0` or `1` — that gates whether
that algorithm's outputs apply. Example:

```json
{ "id": "execute_bonus", "condition": "target_current_hp / target_max_hp < 0.5", "outputs": [ ... ] }
```

## Magnitude units

An output's number is interpreted via `magnitudeUnit`:

- `flat` — the formula result is the raw magnitude.
- `stat_value` — already a stat amount (used by buffs).
- `percent_target_max_hp` / `percent_target_current_hp` / `percent_target_missing_hp` —
  the result is a percentage of that target HP pool.
- `percent_caster_max_hp` / `percent_caster_current_hp` / `percent_caster_missing_hp` —
  percentage of the caster's HP pool.

Damage outputs of type `damage_physical` / `damage_magic` additionally pass through the
target's defense mitigation (`120 / (120 + effectiveDefense)`); `damage_true` ignores
defense. See [STAT-CONVENTIONS.md](STAT-CONVENTIONS.md).
