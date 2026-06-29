// Stat aggregation: hero base+growth(by level) + item flats + percents + item-passive
// folds, then caps and derived combat values. See docs/STAT-CONVENTIONS.md.
import type { Hero, Item } from "../types";

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
  let adaptiveAttack = 0;
  let cdrCapRaised = false;

  // 2. Item flat + percent stats.
  for (const { item } of owned) {
    if (CDR_CAP_ITEMS.has(item.id)) cdrCapRaised = true;
    const st = item.stats;
    s.physicalAttack += st.physicalAttack ?? 0;
    s.magicPower += st.magicPower ?? 0;
    s.hp += st.hp ?? 0;
    s.mana += st.mana ?? 0;
    s.physicalDefense += st.physicalDefense ?? 0;
    s.magicDefense += st.magicDefense ?? 0;
    s.hpRegen += st.hpRegen ?? 0;
    s.manaRegen += st.manaRegen ?? 0;
    s.movementSpeed += st.movementSpeed ?? 0;
    s.physicalPenetrationFlat += st.physicalPenetrationFlat ?? 0;
    s.magicPenetrationFlat += st.magicPenetrationFlat ?? 0;
    s.physicalPenetrationPct += st.physicalPenetrationPct ?? 0;
    s.magicPenetrationPct += st.magicPenetrationPct ?? 0;
    s.lifestealPct += st.lifestealPct ?? 0;
    s.lifestealPct += st.physicalLifestealPct ?? 0;
    s.spellVampPct += st.spellVampPct ?? 0;
    adaptiveAttack += st.adaptiveAttack ?? 0;

    asPct += st.attackSpeedPct ?? 0;
    msPct += st.movementSpeedPct ?? 0;
    cdrPct += st.cooldownReductionPct ?? 0;
    critChancePct += st.critChancePct ?? 0;
    critDamagePct += st.critDamagePct ?? 0;
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

  // 4. Adaptive attack resolution.
  if (adaptiveAttack > 0) {
    if (hero.damageType === "magic") s.magicPower += adaptiveAttack;
    else s.physicalAttack += adaptiveAttack;
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
