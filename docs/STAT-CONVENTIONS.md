# Stat conventions

The numbers in `data/` follow these conventions. Keep them consistent — the simulator
depends on them.

## Linear growth

Every per-level stat is stored as `{ "base": <L1 value>, "growth": <per level> }` and the
value at level `L` is:

```
value(L) = base + growth * (L - 1)     for L in 1..15
```

Heroes cap at **level 15**. Keep `growth: 0` explicit (don't omit it) so a future patch
that grants growth shows up as a value change, not a key addition.

Derive `growth` from the wiki's L1 and L15 columns as `growth = (L15 - L1) / 14` when only
the endpoints are published.

## Attack speed

- `attackSpeed` is stored as **attacks per second** (e.g. Layla L1 = 1.06).
- `attackSpeedRatio` converts an item's **% attack speed** into effective AS:
  `effectiveAS = baseAS * (1 + sumOfItemASPercent)`, then capped at **3.0**.

## Resource type

`resourceType` is `mana`, `energy`, or `none`.

- For `mana` heroes, `baseStats.mana` / `manaRegen` are the real pool.
- For `energy` heroes, the resource pool is a fixed cap (energy does not grow); store it in
  the `mana` fields with `growth: 0` and label the hero `energy`.
- For `none` heroes, set `mana`/`manaRegen` to `{base:0,growth:0}` and omit `manaCost` on
  skills.

## Defense and mitigation

Incoming damage of a given type is multiplied by:

```
multiplier = 120 / (120 + effectiveDefense)
```

So effective HP against that type is `HP * (120 + DEF) / 120`. `true` damage ignores
defense entirely.

### Penetration order

When computing a target's `effectiveDefense`, apply in this order (each floored at 0):

1. `% defense reduction` (debuffs)
2. `flat defense reduction`
3. `% penetration`
4. `flat penetration`

### Penetration units & display

`physicalPenetrationPct` / `magicPenetrationPct` are summed in **percent points** during
aggregation and divided by 100 in the final step to become a `0..1` fraction (the form
damage math consumes). Flat penetration is a plain number throughout. Lifesteal / spell vamp
are summed as percent points and are **not** divided by 100.

In charts and per-hero final stat displays, penetration is shown as a single combined value
per type, `flat × (1 + pct)`. This is **display-only** — the damage calculation still applies
flat and % penetration separately, in the order above.

## Caps

| Stat | Cap |
|---|---|
| Cooldown reduction | 40% (45% with a CDR-cap-raising item) |
| Attack speed | 3.0 attacks/sec |
| Movement speed | no hard cap; effective zone 230–420 (annotated, not re-curved in v1) |

## Adaptive vs hybrid stats

**Adaptive** stats resolve to **one** type based on the hero's `damageType` (or the larger of
physical attack / magic power for true-hybrid heroes); the resolved value populates the
appropriate caster variable before formula evaluation:

- `adaptiveAttack` → physical attack or magic power.
- `adaptivePenetration` → physical or magic **flat** penetration.

**Hybrid** stats count as **both** the physical and magical version simultaneously, independent
of the hero. They add to both sides during aggregation:

- `hybridLifestealPct` → both lifesteal and spell vamp.
- `hybridPenetrationFlat` → both physical and magic flat penetration.
- `hybridPenetrationPct` → both physical and magic % penetration (folded as percent points,
  before the final `/100`).

## Unique attributes

An item `stats` entry is normally a plain number that **stacks** across items. An entry may
instead be flagged with a unique-attribute name:

```json
"movementSpeedPct": { "value": 5, "unique": "Swift Boots" }
```

Same-named flagged grants do **not** stack across a build — only the **highest** value counts
(ties resolve to the first owned). Plain numeric grants are unaffected and still stack. This is
how MLBB "Unique Passive" attributes (e.g. a `+5%` movement passive shared by several boots)
behave. The two mechanisms coexist with the `passives` / `buff_stat` blocks, which are
unchanged.
