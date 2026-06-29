/**
 * Validates every file under data/ against the JSON Schemas in schema/, then runs a
 * semantic pass Ajv can't express: DSL formula lint, referential integrity, cross-field
 * rules. Exits non-zero (with precise messages) on any failure.
 *
 *   npm run validate
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Parser } from "expr-eval";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMA_DIR = join(ROOT, "schema");
const HEROES_DIR = join(ROOT, "data", "heroes");
const ITEMS_DIR = join(ROOT, "data", "items");

/** Closed variable vocabulary a DSL formula may reference. Keep in sync with FORMULA-DSL.md. */
const VOCABULARY = new Set<string>([
  // caster
  "physical_attack", "magic_power", "physical_defense", "magic_defense",
  "max_hp", "current_hp", "missing_hp", "max_mana", "current_mana",
  "attack_speed", "movement_speed", "crit_chance", "crit_damage",
  "cooldown_reduction",
  "physical_penetration_flat", "physical_penetration_pct",
  "magic_penetration_flat", "magic_penetration_pct",
  "adaptive_attack", "hero_level", "skill_level",
  // target
  "target_max_hp", "target_current_hp", "target_missing_hp",
  "target_physical_defense", "target_magic_defense",
]);

const formulaParser = new Parser();

const errors: string[] = [];
const fail = (file: string, msg: string) => errors.push(`${file} → ${msg}`);

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
}

// --- Ajv setup -------------------------------------------------------------
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
for (const name of ["common.defs.schema.json", "hero.schema.json", "item.schema.json"]) {
  ajv.addSchema(readJson(join(SCHEMA_DIR, name)));
}
const validateHero = ajv.getSchema("https://mlbb-build-analyser/schema/hero.schema.json")!;
const validateItem = ajv.getSchema("https://mlbb-build-analyser/schema/item.schema.json")!;

// --- Formula lint helper ---------------------------------------------------
function lintFormula(file: string, where: string, formula: unknown): void {
  if (typeof formula !== "string" || formula.trim() === "") return;
  let expr;
  try {
    expr = formulaParser.parse(formula);
  } catch (e) {
    fail(file, `${where}: cannot parse formula "${formula}" (${(e as Error).message})`);
    return;
  }
  for (const v of expr.variables()) {
    if (!VOCABULARY.has(v)) {
      fail(file, `${where}: formula "${formula}" uses unknown variable "${v}"`);
    }
  }
}

// --- Heroes ----------------------------------------------------------------
const heroIds = new Set<string>();
for (const path of listJson(HEROES_DIR)) {
  const file = `data/heroes/${basename(path)}`;
  const hero = readJson(path);

  if (!validateHero(hero)) {
    for (const e of validateHero.errors ?? []) fail(file, `${e.instancePath || "/"} ${e.message}`);
    continue;
  }
  heroIds.add(hero.id);

  const expectedId = basename(path, ".json");
  if (hero.id !== expectedId) fail(file, `id "${hero.id}" must equal filename "${expectedId}"`);

  let anyTodo = false;
  for (const skill of hero.skills as any[]) {
    const label = `skills[${skill.slot}]`;
    if (skill.cooldownSeconds && skill.cooldownSeconds.length !== skill.maxLevel)
      fail(file, `${label}: cooldownSeconds length ${skill.cooldownSeconds.length} != maxLevel ${skill.maxLevel}`);
    if (skill.manaCost) {
      if (hero.resourceType === "none")
        fail(file, `${label}: resourceType "none" but skill has manaCost`);
      else if (skill.manaCost.length !== skill.maxLevel)
        fail(file, `${label}: manaCost length ${skill.manaCost.length} != maxLevel ${skill.maxLevel}`);
    }
    for (const algo of skill.algorithms as any[]) {
      if (algo.todo) anyTodo = true;
      lintFormula(file, `${label}.${algo.id}.condition`, algo.condition);
      for (const out of algo.outputs as any[]) {
        lintFormula(file, `${label}.${algo.id}.${out.type}`, out.formula);
        if (typeof out.durationSeconds === "string")
          lintFormula(file, `${label}.${algo.id}.${out.type}.duration`, out.durationSeconds);
      }
    }
  }
  if (hero.skillsVerified === true && anyTodo)
    fail(file, `skillsVerified is true but a skill algorithm still has a "todo" stub`);
}

// --- Items -----------------------------------------------------------------
const itemIds = new Set<string>();
const itemFiles: { path: string; item: any }[] = [];
for (const path of listJson(ITEMS_DIR)) {
  const file = `data/items/${basename(path)}`;
  const item = readJson(path);
  if (!validateItem(item)) {
    for (const e of validateItem.errors ?? []) fail(file, `${e.instancePath || "/"} ${e.message}`);
    continue;
  }
  itemIds.add(item.id);
  itemFiles.push({ path, item });
  const expectedId = basename(path, ".json");
  if (item.id !== expectedId) fail(file, `id "${item.id}" must equal filename "${expectedId}"`);

  for (const block of [...(item.passives ?? []), ...(item.actives ?? [])] as any[]) {
    if (typeof block.condition === "string") lintFormula(file, `${block.name}.condition`, block.condition);
    for (const eff of (block.effects ?? []) as any[]) lintFormula(file, `${block.name}.effect`, eff.formula);
  }
}

// Referential integrity: components resolve.
for (const { path, item } of itemFiles) {
  const file = `data/items/${basename(path)}`;
  for (const comp of item.cost?.components ?? []) {
    if (!itemIds.has(comp)) fail(file, `cost.components references unknown item "${comp}"`);
  }
}

// --- Report ----------------------------------------------------------------
const counts = `${heroIds.size} hero(es), ${itemIds.size} item(s)`;
if (errors.length) {
  console.error(`✗ validation failed (${counts}): ${errors.length} error(s)\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`✓ validation passed: ${counts}`);
