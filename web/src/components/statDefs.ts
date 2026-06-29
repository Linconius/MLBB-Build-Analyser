import type { StatSnapshot } from "../sim/timeline";

export interface StatDef {
  key: string;
  label: string;
  color: string;
  get: (s: StatSnapshot) => number;
  fmt?: (v: number) => string;
}

const r0 = (v: number) => Math.round(v).toLocaleString();
const r2 = (v: number) => v.toFixed(2);
const pct0 = (v: number) => `${Math.round(v)}%`;

export const STAT_DEFS: StatDef[] = [
  { key: "physicalAttack", label: "Phys Attack", color: "#f5a35b", get: (s) => s.stats.physicalAttack, fmt: r0 },
  { key: "magicPower", label: "Magic Power", color: "#a36bff", get: (s) => s.stats.magicPower, fmt: r0 },
  { key: "hp", label: "HP", color: "#56d364", get: (s) => s.stats.hp, fmt: r0 },
  { key: "physicalDefense", label: "Phys Def", color: "#e0a44d", get: (s) => s.stats.physicalDefense, fmt: r0 },
  { key: "magicDefense", label: "Magic Def", color: "#5bb0ff", get: (s) => s.stats.magicDefense, fmt: r0 },
  { key: "attackSpeed", label: "Attack Speed", color: "#f06c9c", get: (s) => s.stats.attackSpeed, fmt: r2 },
  { key: "movementSpeed", label: "Move Speed", color: "#7fd9c8", get: (s) => s.stats.movementSpeed, fmt: r0 },
  { key: "cooldownReduction", label: "CDR %", color: "#c0a6ff", get: (s) => s.stats.cooldownReduction * 100, fmt: r0 },
  // Penetration shown as a single combined value per type: flat × (1 + pct). The pct fields
  // are already a 0..1 fraction post-aggregation, so no extra /100. Damage math (skills.ts)
  // still applies flat and pct separately — this combination is display-only. Side effect:
  // a percent-only pen item (flat 0) reads 0 here until a flat-pen item joins the build.
  // TODO: confirm against the game how flat vs % penetration interact and that this display
  // heuristic faithfully represents it (the damage math in stats.ts is already correct).
  { key: "physicalPen", label: "Phys Pen", color: "#d98a4d",
    get: (s) => s.stats.physicalPenetrationFlat * (1 + s.stats.physicalPenetrationPct), fmt: r0 },
  { key: "magicPen", label: "Magic Pen", color: "#4d8ad9",
    get: (s) => s.stats.magicPenetrationFlat * (1 + s.stats.magicPenetrationPct), fmt: r0 },
  { key: "lifestealPct", label: "Lifesteal %", color: "#e0566b", get: (s) => s.stats.lifestealPct, fmt: pct0 },
  { key: "spellVampPct", label: "Spell Vamp %", color: "#b65be0", get: (s) => s.stats.spellVampPct, fmt: pct0 },
  { key: "dpsBasic", label: "Basic DPS", color: "#ff8f5b", get: (s) => s.derived.dpsBasic, fmt: r0 },
  { key: "effHpPhysical", label: "Eff. HP (phys)", color: "#6cd39a", get: (s) => s.derived.effHpPhysical, fmt: r0 },
  { key: "skillBurst", label: "Combo Burst", color: "#f5c451", get: (s) => s.skillBurst, fmt: r0 },
];

export const STAT_BY_KEY = new Map(STAT_DEFS.map((d) => [d.key, d]));
