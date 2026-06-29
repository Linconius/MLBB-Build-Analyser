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

export const STAT_DEFS: StatDef[] = [
  { key: "physicalAttack", label: "Phys Attack", color: "#f5a35b", get: (s) => s.stats.physicalAttack, fmt: r0 },
  { key: "magicPower", label: "Magic Power", color: "#a36bff", get: (s) => s.stats.magicPower, fmt: r0 },
  { key: "hp", label: "HP", color: "#56d364", get: (s) => s.stats.hp, fmt: r0 },
  { key: "physicalDefense", label: "Phys Def", color: "#e0a44d", get: (s) => s.stats.physicalDefense, fmt: r0 },
  { key: "magicDefense", label: "Magic Def", color: "#5bb0ff", get: (s) => s.stats.magicDefense, fmt: r0 },
  { key: "attackSpeed", label: "Attack Speed", color: "#f06c9c", get: (s) => s.stats.attackSpeed, fmt: r2 },
  { key: "movementSpeed", label: "Move Speed", color: "#7fd9c8", get: (s) => s.stats.movementSpeed, fmt: r0 },
  { key: "cooldownReduction", label: "CDR %", color: "#c0a6ff", get: (s) => s.stats.cooldownReduction * 100, fmt: r0 },
  { key: "dpsBasic", label: "Basic DPS", color: "#ff8f5b", get: (s) => s.derived.dpsBasic, fmt: r0 },
  { key: "effHpPhysical", label: "Eff. HP (phys)", color: "#6cd39a", get: (s) => s.derived.effHpPhysical, fmt: r0 },
  { key: "skillBurst", label: "Combo Burst", color: "#f5c451", get: (s) => s.skillBurst, fmt: r0 },
];

export const STAT_BY_KEY = new Map(STAT_DEFS.map((d) => [d.key, d]));
