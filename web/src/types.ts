// Domain types mirroring schema/hero.schema.json and schema/item.schema.json.

export type ResourceType = "mana" | "energy" | "none";
export type DamageType = "physical" | "magic" | "true" | "hybrid";
export type Role = "Tank" | "Fighter" | "Assassin" | "Mage" | "Marksman" | "Support";
export type Lane = "Gold" | "Mid" | "Exp" | "Jungle" | "Roam";

export interface StatLinear {
  base: number;
  growth: number;
}

export interface SkillOutput {
  type: string;
  formula?: string;
  magnitudeUnit?: string;
  stat?: string;
  valuePercent?: number;
  durationSeconds?: number | string;
  hits?: number;
}

export interface Algorithm {
  id: string;
  trigger?: string;
  note?: string;
  todo?: string;
  condition?: string;
  inputs?: string[];
  outputs: SkillOutput[];
}

export interface Skill {
  slot: "passive" | "skill_1" | "skill_2" | "skill_3" | "ultimate";
  name: string;
  description?: string;
  maxLevel: number;
  cooldownSeconds?: number[];
  manaCost?: number[];
  iconAsset?: string;
  algorithms: Algorithm[];
}

export interface Hero {
  schemaVersion: string;
  id: string;
  name: string;
  title?: string;
  releaseYear?: number;
  lastPatch?: string;
  skillsVerified?: boolean;
  resourceType: ResourceType;
  damageType: DamageType;
  roles: Role[];
  specialties?: string[];
  lanes?: Lane[];
  maxLevel: 15;
  baseStats: {
    hp: StatLinear;
    hpRegen: StatLinear;
    mana: StatLinear;
    manaRegen: StatLinear;
    physicalAttack: StatLinear;
    magicPower: StatLinear;
    physicalDefense: StatLinear;
    magicDefense: StatLinear;
    attackSpeed: StatLinear;
    attackSpeedRatio: number;
    movementSpeed: StatLinear;
    critChance: StatLinear;
  };
  skills: Skill[];
}

export interface ItemEffect {
  type: string;
  stat?: string;
  magnitudeUnit?: string;
  value?: number;
  formula?: string;
  maxStacks?: number;
  secondsPerStack?: number;
  requiresFullStacks?: boolean;
  appliesWhen?: string;
}

export interface ItemEffectBlock {
  name: string;
  unique?: boolean;
  alwaysOn?: boolean;
  condition?: string;
  description: string;
  cooldownSeconds?: number;
  effects?: ItemEffect[];
}

/** Closed set of flat stat keys an item may grant. */
export type ItemStatKey =
  | "physicalAttack" | "magicPower" | "hp" | "mana" | "physicalDefense" | "magicDefense"
  | "hpRegen" | "manaRegen" | "attackSpeedPct" | "critChancePct" | "critDamagePct"
  | "cooldownReductionPct" | "movementSpeed" | "movementSpeedPct"
  | "physicalPenetrationFlat" | "physicalPenetrationPct"
  | "magicPenetrationFlat" | "magicPenetrationPct"
  | "lifestealPct" | "physicalLifestealPct" | "spellVampPct" | "hybridLifestealPct"
  | "hybridPenetrationFlat" | "hybridPenetrationPct"
  | "adaptiveAttack" | "adaptivePenetration";

/**
 * A stat grant on an item. Either a plain number (stacks across items) or a value flagged
 * with a unique-attribute name: same-named flagged grants do NOT stack across the build —
 * only the highest counts. See docs/STAT-CONVENTIONS.md.
 */
export type ItemStatValue = number | { value: number; unique: string };

export interface Item {
  schemaVersion: string;
  id: string;
  name: string;
  category: "Attack" | "Magic" | "Defense" | "Movement" | "Jungle" | "Roaming";
  tier: number;
  lastPatch?: string;
  iconAsset?: string;
  cost: { total: number; combine?: number; components?: string[] };
  stats: Partial<Record<ItemStatKey, ItemStatValue>>;
  passives?: ItemEffectBlock[];
  actives?: ItemEffectBlock[];
}

export interface Source {
  field?: string;
  url: string;
  retrieved?: string;
}

/** An emblem set, taken at MAX level. Stats use the closed itemStatKey vocabulary; "hybrid"
 *  defense/regen is expanded into the concrete keys at the data layer. */
export interface Emblem {
  schemaVersion: string;
  id: string;
  name: string;
  lastPatch?: string;
  iconAsset?: string;
  stats: Partial<Record<ItemStatKey, ItemStatValue>>;
  sources?: Source[];
}

/** A talent in one of the 3 tiers. Tier-1 talents carry `stats`; tier 2/3 are mostly
 *  conditional/active effects captured as `effect` text (not applied to stats in v1). */
export interface Talent {
  schemaVersion: string;
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  stats?: Partial<Record<ItemStatKey, ItemStatValue>>;
  effect?: string;
  sources?: Source[];
}

/** Resolved emblem + chosen talents → a single stat block folded into the sim from minute 0. */
export interface Loadout {
  stats: Partial<Record<ItemStatKey, ItemStatValue>>;
}
