/**
 * Regenerates data/meta/index.json — a compact id→name manifest the web app loads first
 * for hero/item pickers without parsing every full file.
 *
 *   npm run build-index
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HEROES_DIR = join(ROOT, "data", "heroes");
const ITEMS_DIR = join(ROOT, "data", "items");
const OUT = join(ROOT, "data", "meta", "index.json");

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const listJson = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : [];

const heroes = listJson(HEROES_DIR)
  .map((p) => {
    const h = readJson(p);
    return {
      id: h.id,
      name: h.name,
      title: h.title ?? null,
      roles: h.roles,
      resourceType: h.resourceType,
      damageType: h.damageType,
      skillsVerified: h.skillsVerified ?? false,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const items = listJson(ITEMS_DIR)
  .map((p) => {
    const it = readJson(p);
    return { id: it.id, name: it.name, category: it.category, tier: it.tier, cost: it.cost.total };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(
  OUT,
  JSON.stringify({ generated: true, heroCount: heroes.length, itemCount: items.length, heroes, items }, null, 2) + "\n",
);
console.log(`✓ wrote ${basename(OUT)}: ${heroes.length} heroes, ${items.length} items`);
