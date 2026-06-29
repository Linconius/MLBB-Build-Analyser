// Evaluates hero skill outputs (damage focus) at a given tick: builds the DSL scope from
// effective stats + skill level + target, runs each algorithm's formulas, and applies
// defense mitigation. See docs/FORMULA-DSL.md.
import type { Hero, Skill, SkillOutput } from "../types";
import { evalFormula, type Scope } from "./formula";
import { EffectiveStats, effectiveDefenseAfterPen, mitigationMultiplier } from "./stats";

export interface TargetProfile {
  maxHp: number;
  currentHp: number;
  physicalDefense: number;
  magicDefense: number;
}

export const DEFAULT_TARGET: TargetProfile = {
  maxHp: 4000,
  currentHp: 4000,
  physicalDefense: 50,
  magicDefense: 30,
};

const ULT_UNLOCK_LEVELS = [4, 8, 12];

/** Default skill-point plan: level the ultimate as soon as available, max basics in order. */
export function skillLevelsAtHeroLevel(hero: Hero, heroLevel: number): Map<string, number> {
  const result = new Map<string, number>();
  const ult = hero.skills.find((s) => s.slot === "ultimate");
  const ultPoints = ULT_UNLOCK_LEVELS.filter((l) => heroLevel >= l).length;
  const ultLevel = ult ? Math.min(ult.maxLevel, ultPoints) : 0;
  if (ult) result.set(ult.slot, ultLevel);

  let remaining = heroLevel - ultLevel;
  const basics = hero.skills.filter((s) => s.slot.startsWith("skill_"));
  for (const skill of basics) {
    const lvl = Math.min(skill.maxLevel, remaining);
    result.set(skill.slot, Math.max(0, lvl));
    remaining -= lvl;
  }
  for (const skill of hero.skills) {
    if (skill.slot === "passive") result.set(skill.slot, skill.maxLevel);
  }
  return result;
}

export interface InnateAttack {
  physicalAttack: number; // hero's own base+growth physical attack at this level (no items)
  magicPower: number;
}

function buildScope(
  stats: EffectiveStats,
  innate: InnateAttack,
  heroLevel: number,
  skillLevel: number,
  target: TargetProfile,
): Scope {
  return {
    physical_attack: stats.physicalAttack,
    magic_power: stats.magicPower,
    bonus_physical_attack: Math.max(0, stats.physicalAttack - innate.physicalAttack),
    bonus_magic_power: Math.max(0, stats.magicPower - innate.magicPower),
    physical_defense: stats.physicalDefense,
    magic_defense: stats.magicDefense,
    max_hp: stats.hp,
    current_hp: stats.hp,
    missing_hp: 0,
    max_mana: stats.mana,
    current_mana: stats.mana,
    attack_speed: stats.attackSpeed,
    movement_speed: stats.movementSpeed,
    crit_chance: stats.critChance,
    crit_damage: stats.critDamage,
    cooldown_reduction: stats.cooldownReduction,
    physical_penetration_flat: stats.physicalPenetrationFlat,
    physical_penetration_pct: stats.physicalPenetrationPct,
    magic_penetration_flat: stats.magicPenetrationFlat,
    magic_penetration_pct: stats.magicPenetrationPct,
    adaptive_attack: 0,
    hero_level: heroLevel,
    skill_level: skillLevel,
    target_max_hp: target.maxHp,
    target_current_hp: target.currentHp,
    target_missing_hp: target.maxHp - target.currentHp,
    target_physical_defense: target.physicalDefense,
    target_magic_defense: target.magicDefense,
  };
}

function magnitudeOf(out: { formula?: string; valuePercent?: number; magnitudeUnit?: string }, scope: Scope): number {
  let m = out.formula ? evalFormula(out.formula, scope) : out.valuePercent ?? 0;
  switch (out.magnitudeUnit) {
    case "percent_target_max_hp": m = (m / 100) * scope.target_max_hp; break;
    case "percent_target_current_hp": m = (m / 100) * scope.target_current_hp; break;
    case "percent_target_missing_hp": m = (m / 100) * scope.target_missing_hp; break;
    case "percent_caster_max_hp": m = (m / 100) * scope.max_hp; break;
    case "percent_caster_missing_hp": m = (m / 100) * scope.missing_hp; break;
    default: break;
  }
  return m;
}

/** Friendly grouping for the numeric (plottable) output types; null = non-numeric (CC etc.). */
export type OutputKind = "Damage" | "Heal" | "Shield";
export function numericKind(type: string): OutputKind | null {
  if (type.startsWith("damage_") || type.startsWith("dot_")) return "Damage";
  if (type === "heal") return "Heal";
  if (type === "shield") return "Shield";
  return null;
}

/**
 * Numeric magnitude of one output (post-mitigation for damage; raw for heal/shield/true).
 * Returns null for non-numeric outputs (slow/stun/etc.). `adaptive` damage resolves to
 * physical or magic by the build's higher of magic power / physical attack (stat-driven,
 * matching aggregateStats — see docs/STAT-CONVENTIONS.md).
 */
function outputValue(
  out: SkillOutput,
  stats: EffectiveStats,
  scope: Scope,
  target: TargetProfile,
): number | null {
  if (!numericKind(out.type)) return null;
  const raw = magnitudeOf(out, scope) * (out.hits ?? 1);
  let t = out.type;
  if (t === "damage_adaptive") t = stats.magicPower > stats.physicalAttack ? "damage_magic" : "damage_physical";
  if (t === "damage_physical" || t === "dot_physical") {
    const def = effectiveDefenseAfterPen(target.physicalDefense, 0, 0, stats.physicalPenetrationPct, stats.physicalPenetrationFlat);
    return raw * mitigationMultiplier(def);
  }
  if (t === "damage_magic" || t === "dot_magic") {
    const def = effectiveDefenseAfterPen(target.magicDefense, 0, 0, stats.magicPenetrationPct, stats.magicPenetrationFlat);
    return raw * mitigationMultiplier(def);
  }
  return raw; // damage_true, dot_true, heal, shield
}

/** Total post-mitigation damage of one cast of a skill (sums only damage outputs). */
export function skillDamage(
  skill: Skill,
  stats: EffectiveStats,
  innate: InnateAttack,
  heroLevel: number,
  skillLevel: number,
  target: TargetProfile,
): number {
  if (skillLevel <= 0) return 0;
  const scope = buildScope(stats, innate, heroLevel, skillLevel, target);
  let total = 0;
  for (const algo of skill.algorithms) {
    if (algo.todo) continue;
    if (algo.condition && evalFormula(algo.condition, scope) === 0) continue;
    for (const out of algo.outputs) {
      if (numericKind(out.type) !== "Damage") continue;
      total += outputValue(out, stats, scope, target) ?? 0;
    }
  }
  return total;
}

export interface SkillDamageBreakdown {
  slot: string;
  name: string;
  level: number;
  damage: number;
}

/** Per-skill damage + combo-burst total at a hero level. */
export function evaluateSkills(
  hero: Hero,
  stats: EffectiveStats,
  heroLevel: number,
  target: TargetProfile,
): { perSkill: SkillDamageBreakdown[]; burst: number } {
  const levels = skillLevelsAtHeroLevel(hero, heroLevel);
  const lin = (s: { base: number; growth: number }) => s.base + s.growth * (heroLevel - 1);
  const innate: InnateAttack = {
    physicalAttack: lin(hero.baseStats.physicalAttack),
    magicPower: lin(hero.baseStats.magicPower),
  };
  const perSkill: SkillDamageBreakdown[] = [];
  let burst = 0;
  for (const skill of hero.skills) {
    const lvl = levels.get(skill.slot) ?? 0;
    const dmg = skillDamage(skill, stats, innate, heroLevel, lvl, target);
    perSkill.push({ slot: skill.slot, name: skill.name, level: lvl, damage: Math.round(dmg) });
    if (skill.slot !== "passive") burst += dmg;
  }
  return { perSkill, burst: Math.round(burst) };
}

/** One plottable skill-output line: a stable key + label across the whole timeline. */
export interface SkillOutputDef {
  key: string; // `${slot}:${algoIdx}:${outIdx}` — stable across snapshots
  slot: string;
  skillName: string;
  kind: OutputKind;
  outputType: string;
  label: string;
}

/**
 * Static list of every numeric (plottable) skill output for a hero, deterministic and
 * independent of stats/level. Outputs that share a skill+kind get a numeric suffix so
 * multi-hit / edge-vs-centre damages read as distinct lines.
 */
export function enumerateSkillOutputs(hero: Hero): SkillOutputDef[] {
  const defs: SkillOutputDef[] = [];
  for (const skill of hero.skills) {
    const total: Partial<Record<OutputKind, number>> = {};
    for (const algo of skill.algorithms)
      for (const out of algo.outputs) {
        const k = numericKind(out.type);
        if (k) total[k] = (total[k] ?? 0) + 1;
      }
    const seen: Partial<Record<OutputKind, number>> = {};
    skill.algorithms.forEach((algo, ai) =>
      algo.outputs.forEach((out, oi) => {
        const kind = numericKind(out.type);
        if (!kind) return;
        const n = (seen[kind] = (seen[kind] ?? 0) + 1);
        const suffix = (total[kind] ?? 0) > 1 ? ` ${n}` : "";
        defs.push({
          key: `${skill.slot}:${ai}:${oi}`,
          slot: skill.slot,
          skillName: skill.name,
          kind,
          outputType: out.type,
          label: `${skill.name} — ${kind}${suffix}`,
        });
      }),
    );
  }
  return defs;
}

/** Per-snapshot value for each numeric output (keyed like enumerateSkillOutputs); 0 when inactive. */
export function evaluateSkillOutputs(
  hero: Hero,
  stats: EffectiveStats,
  heroLevel: number,
  target: TargetProfile,
): Record<string, number> {
  const levels = skillLevelsAtHeroLevel(hero, heroLevel);
  const lin = (s: { base: number; growth: number }) => s.base + s.growth * (heroLevel - 1);
  const innate: InnateAttack = {
    physicalAttack: lin(hero.baseStats.physicalAttack),
    magicPower: lin(hero.baseStats.magicPower),
  };
  const values: Record<string, number> = {};
  for (const skill of hero.skills) {
    const lvl = levels.get(skill.slot) ?? 0;
    const scope = buildScope(stats, innate, heroLevel, lvl, target);
    skill.algorithms.forEach((algo, ai) => {
      const active = lvl > 0 && !algo.todo && !(algo.condition && evalFormula(algo.condition, scope) === 0);
      algo.outputs.forEach((out, oi) => {
        if (!numericKind(out.type)) return;
        const v = active ? outputValue(out, stats, scope, target) ?? 0 : 0;
        values[`${skill.slot}:${ai}:${oi}`] = Math.round(v);
      });
    });
  }
  return values;
}
