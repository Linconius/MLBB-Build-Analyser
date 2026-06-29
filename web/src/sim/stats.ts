// Stat aggregation: hero base+growth(by level) + item flats + percents + item-passive
// folds, then caps and derived combat values. See docs/STAT-CONVENTIONS.md.
import type { Hero, Item, ItemStatKey, ItemStatValue, Loadout } from "../types";

/** Numeric magnitude of a stat grant (a plain number, or a unique-flagged `{value}`). */
export const statNum = (v: ItemStatValue | undefined): number =>
  typeof v === "object" ? v.value : v ?? 0;

export const AS_CAP = 3.0;
export const CDR_CAP = 0.4;
export const CDR_CAP_RAISED = 0.45;
export const BASE_CRIT_DAMAGE = 2.0; // 200% — MLBB default
export const MITIGATION_CONST = 120;

export interface EffectiveStats {
  hp: number;
  hpRegen: number;
  mana: number;
  manaRegen: number;
  physicalAttack: number;
  magicPower: number;
  physicalDefense: number;
  magicDefense: number;
  attackSpeed: number;
  movementSpeed: number;
  critChance: number;
  critDamage: number;
  cooldownReduction: number;
  physicalPenetrationFlat: number;
  physicalPenetrationPct: number;
  magicPenetrationFlat: number;
  magicPenetrationPct: number;
  lifestealPct: number;
  spellVampPct: number;
}

export interface DerivedStats {
  effHpPhysical: number;
  effHpMagic: number;
  dpsBasic: number;
  cdrCapped: boolean;
  asCapped: boolean;
}

export interface OwnedItem {
  item: Item;
  secondsOwned: number;
}

export interface AggregateOptions {
  /** Fold conditional item passives (alwaysOn=false) as if their trigger were active. */
  assumeConditionalsActive?: boolean;
  /** Emblem + talent loadout (max level), folded as flat stats present from minute 0. */
  loadout?: Loadout;
}

const lin = (s: { base: number; growth: number }, level: number) => s.base + s.growth * (level - 1);

/** Items that raise the CDR cap to 45% (their unique passive). */
const CDR_CAP_ITEMS = new Set(["enchanted-talisman"]);

export function aggregateStats(
  hero: Hero,
  level: number,
  owned: OwnedItem[],
  opts: AggregateOptions = {},
): { stats: EffectiveStats; derived: DerivedStats } {
  const b = hero.baseStats;

  // 1. Base + growth.
  const s: EffectiveStats = {
    hp: lin(b.hp, level),
    hpRegen: lin(b.hpRegen, level),
    mana: lin(b.mana, level),
    manaRegen: lin(b.manaRegen, level),
    physicalAttack: lin(b.physicalAttack, level),
    magicPower: lin(b.magicPower, level),
    physicalDefense: lin(b.physicalDefense, level),
    magicDefense: lin(b.magicDefense, level),
    attackSpeed: lin(b.attackSpeed, level),
    movementSpeed: lin(b.movementSpeed, level),
    critChance: lin(b.critChance, level),
    critDamage: BASE_CRIT_DAMAGE,
    cooldownReduction: 0,
    physicalPenetrationFlat: 0,
    physicalPenetrationPct: 0,
    magicPenetrationFlat: 0,
    magicPenetrationPct: 0,
    lifestealPct: 0,
    spellVampPct: 0,
  };

  // Percent accumulators (in percent points).
  let asPct = 0, msPct = 0, cdrPct = 0, critChancePct = 0, critDamagePct = 0;
  let adaptiveAttack = 0, adaptivePen = 0;
  let cdrCapRaised = false;

  // Routes one numeric stat grant into the right accumulator. Hybrid keys count as BOTH the
  // physical and magical version; adaptive keys are collected here and resolved in step 4.
  const addStat = (key: ItemStatKey, v: number): void => {
    switch (key) {
      case "physicalAttack": s.physicalAttack += v; break;
      case "magicPower": s.magicPower += v; break;
      case "hp": s.hp += v; break;
      case "mana": s.mana += v; break;
      case "physicalDefense": s.physicalDefense += v; break;
      case "magicDefense": s.magicDefense += v; break;
      case "hpRegen": s.hpRegen += v; break;
      case "manaRegen": s.manaRegen += v; break;
      case "movementSpeed": s.movementSpeed += v; break;
      case "physicalPenetrationFlat": s.physicalPenetrationFlat += v; break;
      case "magicPenetrationFlat": s.magicPenetrationFlat += v; break;
      case "physicalPenetrationPct": s.physicalPenetrationPct += v; break;
      case "magicPenetrationPct": s.magicPenetrationPct += v; break;
      case "lifestealPct": s.lifestealPct += v; break;
      case "physicalLifestealPct": s.lifestealPct += v; break;
      case "spellVampPct": s.spellVampPct += v; break;
      // Hybrid → both physical and magical version.
      case "hybridLifestealPct": s.lifestealPct += v; s.spellVampPct += v; break;
      case "hybridPenetrationFlat": s.physicalPenetrationFlat += v; s.magicPenetrationFlat += v; break;
      case "hybridPenetrationPct": s.physicalPenetrationPct += v; s.magicPenetrationPct += v; break;
      case "adaptiveAttack": adaptiveAttack += v; break;
      case "adaptivePenetration": adaptivePen += v; break;
      case "attackSpeedPct": asPct += v; break;
      case "movementSpeedPct": msPct += v; break;
      case "cooldownReductionPct": cdrPct += v; break;
      case "critChancePct": critChancePct += v; break;
      case "critDamagePct": critDamagePct += v; break;
    }
  };

  // 2. Item flat + percent stats. Plain grants stack; unique-flagged grants are deferred to a
  // per-name bucket (only the highest counts across the whole build), applied after the loop.
  const uniques = new Map<string, { key: ItemStatKey; value: number }>();
  for (const { item } of owned) {
    if (CDR_CAP_ITEMS.has(item.id)) cdrCapRaised = true;
    for (const [k, raw] of Object.entries(item.stats) as [ItemStatKey, ItemStatValue][]) {
      if (typeof raw === "object") {
        const prev = uniques.get(raw.unique);
        if (!prev || raw.value > prev.value) uniques.set(raw.unique, { key: k, value: raw.value });
      } else {
        addStat(k, raw);
      }
    }
  }
  for (const { key, value } of uniques.values()) addStat(key, value);

  // 2b. Emblem + talent loadout — plain stat grants present from minute 0 (not gold-gated).
  if (opts.loadout) {
    for (const [k, raw] of Object.entries(opts.loadout.stats) as [ItemStatKey, ItemStatValue][]) {
      addStat(k, statNum(raw));
    }
  }

  // 3. Fold item passives (buff_stat effects). Always-on always; conditional when opted in.
  for (const { item, secondsOwned } of owned) {
    for (const block of item.passives ?? []) {
      const active = block.alwaysOn || (opts.assumeConditionalsActive && block.condition !== undefined);
      if (!active) continue;
      for (const eff of block.effects ?? []) {
        if (eff.type !== "buff_stat" || eff.value === undefined) continue;
        const stacks = eff.secondsPerStack
          ? Math.min(eff.maxStacks ?? 1, 1 + Math.floor(secondsOwned / eff.secondsPerStack))
          : 1;
        const amount = eff.value * stacks;
        applyBuff(s, eff.stat, eff.magnitudeUnit, amount, { asPct: (v) => (asPct += v), msPct: (v) => (msPct += v) });
      }
    }
  }

  // 4. Adaptive resolution — adaptive stats become physical OR magic by comparing the BUILD's
  // physical attack vs magic power (higher wins; tie → physical), evaluated before adding the
  // adaptive amount itself. Not the hero's static damageType, so off-type builds resolve correctly.
  const useMagic = s.magicPower > s.physicalAttack;
  if (adaptiveAttack > 0) {
    if (useMagic) s.magicPower += adaptiveAttack;
    else s.physicalAttack += adaptiveAttack;
  }
  if (adaptivePen > 0) {
    if (useMagic) s.magicPenetrationFlat += adaptivePen;
    else s.physicalPenetrationFlat += adaptivePen;
  }

  // 5. Apply percents and caps.
  s.attackSpeed = lin(b.attackSpeed, level) * (1 + asPct / 100);
  const asCapped = s.attackSpeed > AS_CAP;
  if (asCapped) s.attackSpeed = AS_CAP;

  s.movementSpeed = s.movementSpeed * (1 + msPct / 100);
  s.critChance = Math.min(1, lin(b.critChance, level) + critChancePct / 100);
  s.critDamage = BASE_CRIT_DAMAGE + critDamagePct / 100;

  const cdrCap = cdrCapRaised ? CDR_CAP_RAISED : CDR_CAP;
  const rawCdr = cdrPct / 100;
  const cdrCapped = rawCdr > cdrCap;
  s.cooldownReduction = Math.min(cdrCap, rawCdr);

  s.physicalPenetrationPct = s.physicalPenetrationPct / 100;
  s.magicPenetrationPct = s.magicPenetrationPct / 100;

  // 6. Derived combat values.
  const derived: DerivedStats = {
    effHpPhysical: s.hp * (MITIGATION_CONST + s.physicalDefense) / MITIGATION_CONST,
    effHpMagic: s.hp * (MITIGATION_CONST + s.magicDefense) / MITIGATION_CONST,
    dpsBasic: s.physicalAttack * s.attackSpeed * (1 + s.critChance * (s.critDamage - 1)),
    cdrCapped,
    asCapped,
  };

  return { stats: s, derived };
}

function applyBuff(
  s: EffectiveStats,
  stat: string | undefined,
  unit: string | undefined,
  amount: number,
  pct: { asPct: (v: number) => void; msPct: (v: number) => void },
): void {
  if (!stat) return;
  const isPct = unit === "percent";
  switch (stat) {
    case "physical_attack": s.physicalAttack += isPct ? s.physicalAttack * (amount / 100) : amount; break;
    case "magic_power": s.magicPower += isPct ? s.magicPower * (amount / 100) : amount; break;
    case "physical_defense": s.physicalDefense += amount; break;
    case "magic_defense": s.magicDefense += amount; break;
    case "max_hp": s.hp += unit === "percent_of_max_hp" ? s.hp * (amount / 100) : amount; break;
    case "attack_speed": if (isPct) pct.asPct(amount); else s.attackSpeed += amount; break;
    case "movement_speed": if (isPct) pct.msPct(amount); else s.movementSpeed += amount; break;
    case "cooldown_reduction": s.cooldownReduction += amount / 100; break;
    default: break;
  }
}

/** Effective target defense after the MLBB penetration order, floored at 0. */
export function effectiveDefenseAfterPen(
  targetDef: number,
  pctReduction: number,
  flatReduction: number,
  pctPen: number,
  flatPen: number,
): number {
  let d = targetDef * (1 - pctReduction) - flatReduction;
  d = d * (1 - pctPen) - flatPen;
  return Math.max(0, d);
}

/** Damage multiplier a defender applies: 120 / (120 + effectiveDefense). */
export function mitigationMultiplier(effectiveDefense: number): number {
  return MITIGATION_CONST / (MITIGATION_CONST + Math.max(0, effectiveDefense));
}
