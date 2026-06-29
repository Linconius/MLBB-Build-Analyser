// Evaluates hero skill outputs (damage focus) at a given tick: builds the DSL scope from
// effective stats + skill level + target, runs each algorithm's formulas, and applies
// defense mitigation. See docs/FORMULA-DSL.md.
import type { Hero, Skill } from "../types";
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

function buildScope(
  stats: EffectiveStats,
  heroLevel: number,
  skillLevel: number,
  target: TargetProfile,
): Scope {
  return {
    physical_attack: stats.physicalAttack,
    magic_power: stats.magicPower,
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

/** Total post-mitigation damage of one cast of a skill. */
export function skillDamage(
  skill: Skill,
  stats: EffectiveStats,
  heroLevel: number,
  skillLevel: number,
  target: TargetProfile,
): number {
  if (skillLevel <= 0) return 0;
  const scope = buildScope(stats, heroLevel, skillLevel, target);
  let total = 0;
  for (const algo of skill.algorithms) {
    if (algo.todo) continue;
    if (algo.condition && evalFormula(algo.condition, scope) === 0) continue;
    for (const out of algo.outputs) {
      const hits = out.hits ?? 1;
      const raw = magnitudeOf(out, scope) * hits;
      if (out.type === "damage_physical" || out.type === "dot_physical") {
        const def = effectiveDefenseAfterPen(target.physicalDefense, 0, 0, stats.physicalPenetrationPct, stats.physicalPenetrationFlat);
        total += raw * mitigationMultiplier(def);
      } else if (out.type === "damage_magic" || out.type === "dot_magic") {
        const def = effectiveDefenseAfterPen(target.magicDefense, 0, 0, stats.magicPenetrationPct, stats.magicPenetrationFlat);
        total += raw * mitigationMultiplier(def);
      } else if (out.type === "damage_true" || out.type === "dot_true") {
        total += raw;
      }
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
  const perSkill: SkillDamageBreakdown[] = [];
  let burst = 0;
  for (const skill of hero.skills) {
    const lvl = levels.get(skill.slot) ?? 0;
    const dmg = skillDamage(skill, stats, heroLevel, lvl, target);
    perSkill.push({ slot: skill.slot, name: skill.name, level: lvl, damage: Math.round(dmg) });
    if (skill.slot !== "passive") burst += dmg;
  }
  return { perSkill, burst: Math.round(burst) };
}
