// The match-time loop: combines leveling (LPM), gold/build unlocks (GPM), stat aggregation,
// item-passive folds, caps, and skill evaluation into a timeline the chart consumes.
import type { Hero, Item, Loadout } from "../types";
import { aggregateStats, type EffectiveStats, type DerivedStats } from "./stats";
import { computeUnlocks, ownedAtMinute, type ItemUnlock } from "./buildOrder";
import {
  evaluateSkills, evaluateSkillOutputs, enumerateSkillOutputs, DEFAULT_TARGET,
  type TargetProfile, type SkillDamageBreakdown, type SkillOutputDef,
} from "./skills";
import { itemById } from "../data/loader";

export interface Build {
  items: Item[]; // ordered = build order
}

export interface Assumptions {
  gpm: number;
  lpm: number;
  matchMinutes: number;
  tickSeconds: number;
  startingGold?: number;
  assumeConditionalsActive?: boolean;
  target?: TargetProfile;
  loadout?: Loadout;
}

export interface StatSnapshot {
  minute: number;
  level: number;
  gold: number;
  ownedItemIds: string[];
  stats: EffectiveStats;
  derived: DerivedStats;
  perSkill: SkillDamageBreakdown[];
  skillBurst: number;
  skillOutputs: Record<string, number>; // value per SkillOutputDef.key at this minute
}

export interface Timeline {
  snapshots: StatSnapshot[];
  unlocks: ItemUnlock[];
  skillOutputDefs: SkillOutputDef[]; // the line list + labels for the skill-output chart
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function levelAtMinute(lpm: number, minute: number): number {
  return clamp(Math.floor(1 + lpm * minute), 1, 15);
}

export function simulate(hero: Hero, build: Build, a: Assumptions): Timeline {
  const startingGold = a.startingGold ?? 0;
  const target = a.target ?? DEFAULT_TARGET;
  const unlocks = computeUnlocks(build.items, a.gpm, {
    startingGold,
    resolveItem: (id) => itemById.get(id),
  });
  const snapshots: StatSnapshot[] = [];

  const step = a.tickSeconds / 60; // minutes per tick
  for (let minute = 0; minute <= a.matchMinutes + 1e-9; minute += step) {
    const m = Math.round(minute * 1000) / 1000;
    const level = levelAtMinute(a.lpm, m);
    const gold = startingGold + a.gpm * m;
    const owned = ownedAtMinute(unlocks, m);
    const { stats, derived } = aggregateStats(hero, level, owned, {
      assumeConditionalsActive: a.assumeConditionalsActive,
      loadout: a.loadout,
    });
    const { perSkill, burst } = evaluateSkills(hero, stats, level, target);
    snapshots.push({
      minute: m,
      level,
      gold: Math.round(gold),
      ownedItemIds: owned.map((o) => o.item.id),
      stats,
      derived,
      perSkill,
      skillBurst: burst,
      skillOutputs: evaluateSkillOutputs(hero, stats, level, target),
    });
  }
  return { snapshots, unlocks, skillOutputDefs: enumerateSkillOutputs(hero) };
}
