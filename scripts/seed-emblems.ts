/**
 * Authors the emblem + talent data files (max level). Numbers are best-effort from the wiki /
 * community guides (the post-rework values vary across sources); every file cites a source and
 * the live patch should be re-confirmed. "Hybrid" defense/regen is pre-expanded into concrete
 * keys; "adaptive" stays as adaptiveAttack/adaptivePenetration for the sim to resolve.
 *
 *   npm run seed-emblems
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMBLEM_DIR = join(ROOT, "data", "emblems");
const TALENT_DIR = join(ROOT, "data", "talents");
const SRC = (page = "Emblems") => [
  { field: "stats", url: `https://mobile-legends.fandom.com/wiki/${page}`, retrieved: "2026-06-29" },
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const EMBLEMS: { name: string; stats: Record<string, number> }[] = [
  { name: "Common", stats: { hp: 275, adaptiveAttack: 22, hpRegen: 12 } },
  { name: "Tank", stats: { hp: 500, physicalDefense: 10, magicDefense: 10, hpRegen: 4 } },
  { name: "Assassin", stats: { adaptiveAttack: 10, adaptivePenetration: 14, movementSpeedPct: 3 } },
  { name: "Fighter", stats: { adaptiveAttack: 22, physicalDefense: 6, magicDefense: 6, spellVampPct: 10 } },
  { name: "Mage", stats: { magicPower: 30, magicPenetrationFlat: 8, cooldownReductionPct: 5 } },
  { name: "Marksman", stats: { adaptiveAttack: 16, attackSpeedPct: 15, lifestealPct: 5 } },
  { name: "Support", stats: { cooldownReductionPct: 10, movementSpeedPct: 6 } },
];

// Tier 1 = pure stats. Tier 2/3 = conditional/active effects (text only in v1).
const TALENTS: { name: string; tier: 1 | 2 | 3; stats?: Record<string, number>; effect?: string }[] = [
  { name: "Thrill", tier: 1, stats: { adaptiveAttack: 16 } },
  { name: "Swift", tier: 1, stats: { attackSpeedPct: 10 } },
  { name: "Vitality", tier: 1, stats: { hp: 225 } },
  { name: "Inspire", tier: 1, stats: { cooldownReductionPct: 5, manaRegen: 2 } },
  { name: "Rupture", tier: 1, stats: { adaptivePenetration: 5 } },
  { name: "Firmness", tier: 1, stats: { physicalDefense: 8, magicDefense: 8 } },
  { name: "Fatal", tier: 1, stats: { critChancePct: 5, critDamagePct: 5 } },
  { name: "Agility", tier: 1, stats: { movementSpeedPct: 4 } },

  { name: "Seasoned Hunter", tier: 2, effect: "Deal 15% more damage to Lord and Turtle." },
  { name: "Weapon Master", tier: 2, effect: "Each basic attack grants +2% extra damage, stacking up to +8%." },
  { name: "Master Cutter", tier: 2, effect: "Deal +7% damage to an enemy hero when no allied hero is nearby (isolation)." },
  { name: "Tenacity", tier: 2, effect: "+5% damage reduction while HP is below 50%." },
  { name: "Wilderness Blessing", tier: 2, effect: "+10% movement speed in river/jungle (halved for a few seconds after hero combat)." },
  { name: "Festival of Blood", tier: 2, effect: "+6% spell vamp, plus 0.5% per kill/assist up to 8 stacks." },
  { name: "Bargain Hunter", tier: 2, effect: "Equipment costs 5% less gold." },
  { name: "Pull Yourself Together", tier: 2, effect: "-15% battle-spell and equipment-active cooldown." },

  { name: "Killing Spree", tier: 3, effect: "After a kill, restore 15% Max HP and gain 20% movement speed for 3s." },
  { name: "Impure Rage", tier: 3, effect: "Skill hits deal 4% of target Max HP as adaptive damage and restore mana (5s CD)." },
  { name: "Lethal Ignition", tier: 3, effect: "Hitting a hero 3 times in 5s scorches them for 162–750 adaptive burn damage." },
  { name: "Concussive Blast", tier: 3, effect: "Next basic after a skill deals 100 + 7% Max HP magic damage to nearby enemies." },
  { name: "Brave Smite", tier: 3, effect: "Dealing skill damage to a hero heals you for 5% Max HP (6s CD)." },
  { name: "Focusing Mark", tier: 3, effect: "Damaging a hero lets allies deal 6% more damage to it for 3s." },
  { name: "Weakness Finder", tier: 3, effect: "Basic attacks slow enemies ~30% and reduce their attack speed." },
  { name: "Quantum Charge", tier: 3, effect: "Basic-attack damage grants +30% movement speed for 1.5s and restores 75–180 HP (8s CD)." },
  { name: "War Cry", tier: 3, effect: "Every 3rd basic/skill hit grants +8% damage for 6s (6s CD)." },
  { name: "Temporal Reign", tier: 3, effect: "Casting your ultimate speeds up other skills' cooldowns 1.5x for 4s (20s CD)." },
];

for (const dir of [EMBLEM_DIR, TALENT_DIR]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

for (const e of EMBLEMS) {
  const id = slug(e.name);
  writeFileSync(join(EMBLEM_DIR, `${id}.json`),
    JSON.stringify({ schemaVersion: "1.0.0", id, name: e.name, iconAsset: `assets/emblems/${id}.png`, stats: e.stats, sources: SRC() }, null, 2) + "\n");
}
for (const t of TALENTS) {
  const id = slug(t.name);
  const obj: Record<string, unknown> = { schemaVersion: "1.0.0", id, name: t.name, tier: t.tier };
  if (t.stats) obj.stats = t.stats;
  if (t.effect) obj.effect = t.effect;
  obj.sources = SRC();
  writeFileSync(join(TALENT_DIR, `${id}.json`), JSON.stringify(obj, null, 2) + "\n");
}
console.log(`Wrote ${EMBLEMS.length} emblems + ${TALENTS.length} talents.`);
