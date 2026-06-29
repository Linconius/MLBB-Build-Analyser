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

## Caps

| Stat | Cap |
|---|---|
| Cooldown reduction | 40% (45% with a CDR-cap-raising item) |
| Attack speed | 3.0 attacks/sec |
| Movement speed | no hard cap; effective zone 230–420 (annotated, not re-curved in v1) |

## Adaptive stats

`adaptiveAttack` / `adaptivePenetration` resolve to physical or magic based on the hero's
`damageType` (or the larger of physical attack / magic power for true-hybrid heroes). The
resolved value populates the appropriate caster variable before formula evaluation.
