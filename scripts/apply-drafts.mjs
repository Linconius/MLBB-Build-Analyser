/**
 * Applies skill-extraction drafts (numbers only) to seeded hero files, generating valid
 * DSL formulas centrally so agents can't emit invalid formulas. Reads every JSON file in
 * .drafts/ (each an array of { id, skills:[{slot, baseMin, baseMax, scaleStat, scaleRatio,
 * damageType, hits?, cooldown?[], mana?[], cc?[] }] }).
 *
 *   node scripts/apply-drafts.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEROES = join(ROOT, "data", "heroes");
const DRAFTS = join(ROOT, ".drafts");
const SLOT_MAX = { passive: 1, skill_1: 6, skill_2: 6, skill_3: 6, ultimate: 3 };
const SCALE_OK = new Set(["physical_attack", "magic_power", "bonus_physical_attack", "bonus_magic_power"]);
const DMG_OK = new Set(["physical", "magic", "true"]);
const CC_OK = new Set(["stun", "slow", "airborne", "knockback", "knockup", "root", "suppression", "silence", "taunt", "fear", "blind"]);
const r4 = (n) => Math.round(n * 10000) / 10000;

function buildAlgorithms(slot, s, maxLevel) {
  const outputs = [];
  const hasDmg = s.baseMin != null && DMG_OK.has(s.damageType);
  if (hasDmg) {
    const min = Number(s.baseMin);
    const max = s.baseMax != null ? Number(s.baseMax) : min;
    const step = maxLevel > 1 ? r4((max - min) / (maxLevel - 1)) : 0;
    let base = maxLevel > 1 && step !== 0 ? `(${r4(min)} + ${step} * (skill_level - 1))` : `${r4(min)}`;
    const scale = SCALE_OK.has(s.scaleStat) && s.scaleRatio ? ` + ${r4(Number(s.scaleRatio))} * ${s.scaleStat}` : "";
    const out = { type: `damage_${s.damageType}`, formula: base + scale, magnitudeUnit: "flat" };
    if (s.hits && s.hits > 1) out.hits = Math.round(s.hits);
    outputs.push(out);
  }
  for (const c of s.cc ?? []) {
    if (!CC_OK.has(c.type)) continue;
    const out = { type: c.type };
    if (typeof c.valuePercent === "number") out.valuePercent = c.valuePercent;
    if (typeof c.durationSeconds === "number") out.durationSeconds = c.durationSeconds;
    outputs.push(out);
  }
  const inputs = [];
  if (hasDmg && SCALE_OK.has(s.scaleStat) && s.scaleRatio) inputs.push(s.scaleStat);
  if (maxLevel > 1 && hasDmg) inputs.push("skill_level");
  return [{ id: `${slot}_auto`, trigger: "on_cast", ...(inputs.length ? { inputs } : {}), outputs }];
}

function applyHero(draft, stats) {
  const file = join(HEROES, `${draft.id}.json`);
  if (!existsSync(file)) return { id: draft.id, status: "missing" };
  const hero = JSON.parse(readFileSync(file, "utf8"));
  const bySlot = new Map((draft.skills ?? []).map((s) => [s.slot, s]));

  let covered = 0;
  for (const skill of hero.skills) {
    const s = bySlot.get(skill.slot);
    if (!s) continue;
    covered++;
    const maxLevel = skill.maxLevel ?? SLOT_MAX[skill.slot] ?? 6;
    skill.algorithms = buildAlgorithms(skill.slot, s, maxLevel);
    // cooldown / mana only when the array length matches the skill's level count.
    if (Array.isArray(s.cooldown) && s.cooldown.length === maxLevel) skill.cooldownSeconds = s.cooldown;
    else delete skill.cooldownSeconds;
    if (hero.resourceType !== "none" && Array.isArray(s.mana) && s.mana.length === maxLevel) skill.manaCost = s.mana;
    else delete skill.manaCost;
  }
  hero.skillsVerified = covered === hero.skills.length;
  const srcUrl = `https://mobile-legends.fandom.com/wiki/${hero.name.replace(/ /g, "_")}`;
  hero.sources = [hero.sources?.[0], { field: "skills", url: srcUrl, retrieved: "2026-06-29" }].filter(Boolean);
  writeFileSync(file, JSON.stringify(hero, null, 2) + "\n");
  stats[hero.skillsVerified ? "verified" : "partial"]++;
  return { id: draft.id, status: hero.skillsVerified ? "verified" : "partial" };
}

const stats = { verified: 0, partial: 0 };
if (!existsSync(DRAFTS)) { console.log("no .drafts/ dir"); process.exit(0); }
const drafts = readdirSync(DRAFTS).filter((f) => f.endsWith(".json"));
let applied = 0;
for (const f of drafts) {
  const arr = JSON.parse(readFileSync(join(DRAFTS, f), "utf8"));
  for (const draft of Array.isArray(arr) ? arr : [arr]) {
    const r = applyHero(draft, stats);
    if (r.status === "missing") console.log(`  ! ${r.id}: no seeded file`);
    else applied++;
  }
}
console.log(`Applied ${applied} hero(es): ${stats.verified} fully verified, ${stats.partial} partial.`);
