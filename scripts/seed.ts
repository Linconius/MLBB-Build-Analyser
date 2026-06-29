/**
 * Seeds data/heroes/*.json from the Mobile Legends Fandom wiki via the MediaWiki API.
 *
 * Pulls each hero's base-stat table (the wiki publishes Level-1, Level-15 AND a growth
 * column) and derives metadata (roles, resource, damage type, lanes, specialties, release
 * year) from page categories. Skill *names/slots* are captured, but every skill algorithm
 * is left as a TODO stub — skill damage formulas are NOT in any source and must be authored
 * by hand (see docs/CONTRIBUTING.md). Existing files are skipped unless --force.
 *
 *   npm run seed -- [--limit N] [--force] [--only Hero,Names]
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "node-html-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HEROES_DIR = join(ROOT, "data", "heroes");
const API = "https://mobile-legends.fandom.com/api.php";
const UA = "MLBB-Build-Analyser/0.1 (data seeding; +https://github.com/)";
const TODAY = new Date().toISOString().slice(0, 10);

const argv = process.argv.slice(2);
const getArg = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FORCE = argv.includes("--force");
const ITEMS = argv.includes("--items");
const LIMIT = getArg("--limit") ? Number(getArg("--limit")) : Infinity;
const ONLY = getArg("--only")?.split(",").map((s) => s.trim());
const ITEMS_DIR = join(ROOT, "data", "items");

const ROLES = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
const LANE_CAT: Record<string, string> = {
  "Gold Lane heroes": "Gold", "Mid Lane heroes": "Mid", "Exp Lane heroes": "Exp",
  "Jungle heroes": "Jungle", "Roaming heroes": "Roam", "Roam heroes": "Roam",
};
const STAT_KEY: Record<string, string> = {
  "HP": "hp", "HP Regen": "hpRegen", "Mana": "mana", "Mana Regen": "manaRegen",
  "Physical Attack": "physicalAttack", "Magic Power": "magicPower",
  "Physical Defense": "physicalDefense", "Magic Defense": "magicDefense",
  "Attack Speed": "attackSpeed", "Movement Speed": "movementSpeed",
  "Critical Chance": "critChance", "Crit Chance": "critChance",
};
const HEADING_SLOT: Record<string, string> = {
  "Passive": "passive", "Skill 1": "skill_1", "Skill 2": "skill_2",
  "Skill 3": "skill_3", "Ultimate": "ultimate",
};
const SLOT_MAXLEVEL: Record<string, number> = {
  passive: 1, skill_1: 6, skill_2: 6, skill_3: 6, ultimate: 3,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function api(params: Record<string, string>): Promise<any> {
  const url = API + "?" + new URLSearchParams({ format: "json", ...params }).toString();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.json();
    } catch { /* retry */ }
    await sleep(500 * (attempt + 1));
  }
  throw new Error("api failed: " + url);
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const num = (text: string): number => {
  const m = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

function emptyBaseStats() {
  const zero = () => ({ base: 0, growth: 0 });
  return {
    hp: zero(), hpRegen: zero(), mana: zero(), manaRegen: zero(),
    physicalAttack: zero(), magicPower: zero(), physicalDefense: zero(), magicDefense: zero(),
    attackSpeed: { base: 1.0, growth: 0 }, attackSpeedRatio: 1.0,
    movementSpeed: { base: 240, growth: 0 }, critChance: zero(),
  } as any;
}

function parseStatTable(html: string): any | null {
  const root = parse(html);
  const table = root.querySelectorAll("table.wikitable").find((t) => {
    const txt = t.text;
    return txt.includes("Hero stats") && txt.includes("Growth");
  });
  if (!table) return null;
  const stats = emptyBaseStats();
  for (const row of table.querySelectorAll("tr")) {
    const tds = row.querySelectorAll("td");
    if (tds.length < 2) continue;
    const name = tds[0].text.split("(")[0].replace(/\s+/g, " ").trim();
    if (name === "Attack Speed Ratio") {
      const raw = tds[1].text;
      stats.attackSpeedRatio = raw.includes("%") ? num(raw) / 100 : num(raw);
      continue;
    }
    const key = STAT_KEY[name];
    if (!key) continue;
    const base = num(tds[1].text);
    const growth = tds.length >= 4 ? num(tds[tds.length - 1].text) : 0;
    stats[key] = { base, growth };
  }
  return stats;
}

function deriveMeta(categories: string[]) {
  const roles = ROLES.filter((r) => categories.includes(`${r} heroes`));
  const lanes = Object.entries(LANE_CAT).filter(([c]) => categories.includes(c)).map(([, l]) => l);
  const specialties = categories
    .map((c) => c.match(/^(.+) specialty heroes$/)?.[1])
    .filter((x): x is string => !!x);
  const yearCat = categories.find((c) => /^\d{4} heroes$/.test(c));
  const resourceType = categories.includes("Energy-based heroes") ? "energy"
    : categories.includes("Mana-based heroes") ? "mana"
    : (categories.some((c) => /No-resource|resourceless/i.test(c)) ? "none" : "mana");
  const damageType = categories.includes("Magic damage heroes") ? "magic"
    : categories.includes("Physical damage heroes") ? "physical"
    : roles.includes("Mage") ? "magic" : "physical";
  return {
    roles, lanes, specialties,
    releaseYear: yearCat ? Number(yearCat.slice(0, 4)) : undefined,
    resourceType, damageType,
  };
}

function buildSkillStubs(wikitext: string, url: string) {
  // Locate each skill heading and scope name extraction to that heading's own section, so
  // a skill name always aligns to the correct slot even if some sections lack the template.
  const headingRe = /^={2,3}\s*([^=\n]+?)\s*={2,3}\s*$/gm;
  const marks: { title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(wikitext))) marks.push({ title: m[1].trim(), start: m.index, end: headingRe.lastIndex });

  const stub = () => [{ id: "todo", todo: `Author from wiki: ${url}`, outputs: [] }];
  const skills: any[] = [];
  for (let i = 0; i < marks.length; i++) {
    const slot = HEADING_SLOT[marks[i].title];
    if (!slot) continue;
    const section = wikitext.slice(marks[i].end, marks[i + 1]?.start ?? wikitext.length);
    const name = section.match(/\|\s*name\s*=\s*([^|\n}]+)/)?.[1]?.trim() || marks[i].title;
    skills.push({ slot, name, maxLevel: SLOT_MAXLEVEL[slot] ?? 6, algorithms: stub() });
  }

  if (skills.length === 0) {
    for (const slot of ["passive", "skill_1", "skill_2", "ultimate"]) {
      skills.push({ slot, name: slot.replace("_", " "), maxLevel: SLOT_MAXLEVEL[slot], algorithms: stub() });
    }
  }
  return skills;
}

// --- Item seeding ----------------------------------------------------------
const ITEM_CATEGORIES = ["Attack", "Magic", "Defense", "Movement", "Jungle", "Roaming"];

// Ordered so longer/more-specific names match before generic ones (hp regen before hp).
const ITEM_STAT_RULES: { re: RegExp; key: string; pct?: boolean; flat?: boolean }[] = [
  { re: /physical lifesteal/, key: "physicalLifestealPct", pct: true },
  { re: /spell vamp/, key: "spellVampPct", pct: true },
  { re: /lifesteal/, key: "lifestealPct", pct: true },
  { re: /hp regen/, key: "hpRegen" },
  { re: /mana regen/, key: "manaRegen" },
  { re: /attack speed/, key: "attackSpeedPct", pct: true },
  { re: /critical chance|crit chance/, key: "critChancePct", pct: true },
  { re: /critical damage|crit damage/, key: "critDamagePct", pct: true },
  { re: /cooldown reduction/, key: "cooldownReductionPct", pct: true },
  { re: /movement speed/, key: "movementSpeed" }, // pct variant handled below
  { re: /physical penetration/, key: "physicalPenetration" }, // flat/pct below
  { re: /magic penetration/, key: "magicPenetration" },
  { re: /adaptive attack/, key: "adaptiveAttack" },
  { re: /physical attack/, key: "physicalAttack" },
  { re: /magic power/, key: "magicPower" },
  { re: /physical defense/, key: "physicalDefense" },
  { re: /magic defense/, key: "magicDefense" },
  { re: /mana/, key: "mana" },
  { re: /hp/, key: "hp" },
];

function parseStatLine(line: string): { key: string; value: number } | null {
  const m = line.trim().match(/^\+?\s*([\d.]+)\s*(%?)\s*(.+?)\s*$/);
  if (!m) return null;
  const value = Number(m[1]);
  const isPct = m[2] === "%";
  const name = m[3].toLowerCase();
  for (const rule of ITEM_STAT_RULES) {
    if (!rule.re.test(name)) continue;
    let key = rule.key;
    if (key === "movementSpeed" && isPct) key = "movementSpeedPct";
    if (key === "physicalPenetration") key = isPct ? "physicalPenetrationPct" : "physicalPenetrationFlat";
    if (key === "magicPenetration") key = isPct ? "magicPenetrationPct" : "magicPenetrationFlat";
    return { key, value };
  }
  return null;
}

function parseEffectBlock(text: string): { block: any; kind: "passive" | "active" } {
  const m = text.match(/^\s*(Unique\s+)?(Passive|Active)\s*-\s*([^:]+):\s*([\s\S]+)$/i);
  if (m) {
    return {
      kind: m[2].toLowerCase() as "passive" | "active",
      block: { name: m[3].trim(), unique: !!m[1], description: m[4].replace(/\s+/g, " ").trim(), effects: [] },
    };
  }
  return { kind: "passive", block: { name: text.split(":")[0].slice(0, 40).trim() || "Passive", description: text.replace(/\s+/g, " ").trim(), effects: [] } };
}

function inferTier(total: number, hasUnique: boolean): number {
  if (total >= 1800 || hasUnique) return 3;
  if (total >= 900) return 2;
  return 1;
}

async function seedItem(title: string): Promise<"written" | "skipped" | "notitem"> {
  const slug = slugify(title);
  const file = join(ITEMS_DIR, `${slug}.json`);
  if (!FORCE && existsSync(file)) return "skipped";

  const url = `https://mobile-legends.fandom.com/wiki/${title.replace(/ /g, "_")}`;
  const r = await api({ action: "parse", page: title, prop: "text|categories", redirects: "1" });
  if (!r.parse) return "notitem";
  const categories = (r.parse.categories as { "*": string }[]).map((c) => c["*"].replace(/_/g, " "));
  const category = ITEM_CATEGORIES.find((c) => categories.includes(`${c} equipment`));
  if (!category) return "notitem";
  const root = parse(r.parse.text["*"] as string);
  const box = root.querySelector(".portable-infobox");
  if (!box) return "notitem";

  // Stats from the "bonus" data block (lines separated by <br>).
  const stats: Record<string, number> = {};
  const bonus = box.querySelector('[data-source="bonus"] .pi-data-value');
  if (bonus) {
    for (const line of bonus.innerHTML.split(/<br\s*\/?>/i)) {
      const parsed = parseStatLine(parse(line).text);
      if (parsed) stats[parsed.key] = (stats[parsed.key] ?? 0) + parsed.value;
    }
  }

  // Passive/active effect blocks (text only — numeric effects are hand-authored).
  const passives: any[] = [];
  const actives: any[] = [];
  for (const node of box.querySelectorAll(".pi-data")) {
    const src = node.getAttribute("data-source") ?? "";
    if (!/^unique|^passive|^active/.test(src)) continue;
    const text = node.querySelector(".pi-data-value")?.text?.trim();
    if (!text) continue;
    const { block, kind } = parseEffectBlock(text);
    (kind === "active" ? actives : passives).push(block);
  }

  // Price: first cell = total, second = upgrade/combine fee.
  const priceTable = box.querySelector('[data-source="total_price"]')?.closest("table");
  const priceCells = priceTable?.querySelectorAll("td").map((t) => num(t.text)) ?? [];
  const total = priceCells[0] ?? 0;

  const item = {
    schemaVersion: "1.0.0",
    id: slug,
    name: title,
    category,
    tier: inferTier(total, passives.some((p) => p.unique)),
    cost: { total, ...(priceCells[1] ? { combine: priceCells[1] } : {}) },
    stats,
    ...(passives.length ? { passives } : {}),
    ...(actives.length ? { actives } : {}),
    sources: [{ field: "stats", url, retrieved: TODAY }],
  };
  writeFileSync(file, JSON.stringify(item, null, 2) + "\n");
  return "written";
}

async function listItems(): Promise<string[]> {
  const titles = new Set<string>();
  for (const c of ITEM_CATEGORIES) {
    const r = await api({ action: "query", list: "categorymembers", cmtitle: `Category:${c} equipment`, cmlimit: "500", cmtype: "page" });
    for (const m of (r.query?.categorymembers ?? []) as { title: string }[]) titles.add(m.title);
    await sleep(120);
  }
  return [...titles];
}

async function listHeroes(): Promise<string[]> {
  const r = await api({ action: "query", list: "categorymembers", cmtitle: "Category:Heroes", cmlimit: "500", cmtype: "page" });
  return (r.query.categorymembers as { title: string }[]).map((m) => m.title);
}

async function seedHero(title: string): Promise<"written" | "skipped" | "nostats" | "nothero"> {
  const slug = slugify(title);
  const file = join(HEROES_DIR, `${slug}.json`);
  if (!FORCE && existsSync(file)) return "skipped";

  const url = `https://mobile-legends.fandom.com/wiki/${title.replace(/ /g, "_")}`;
  const r = await api({ action: "parse", page: title, prop: "text|categories|wikitext", redirects: "1" });
  if (!r.parse) return "nothero";
  const html = r.parse.text["*"] as string;
  const wikitext = r.parse.wikitext["*"] as string;
  const categories = (r.parse.categories as { "*": string }[]).map((c) => c["*"].replace(/_/g, " "));

  const meta = deriveMeta(categories);
  if (meta.roles.length === 0) return "nothero"; // filters non-hero pages in Category:Heroes

  const baseStats = parseStatTable(html);
  if (!baseStats) return "nostats";

  const skills = buildSkillStubs(wikitext, url);

  const hero = {
    schemaVersion: "1.0.0",
    id: slug,
    name: title,
    ...(meta.releaseYear ? { releaseYear: meta.releaseYear } : {}),
    skillsVerified: false,
    resourceType: meta.resourceType,
    damageType: meta.damageType,
    roles: meta.roles,
    ...(meta.specialties.length ? { specialties: meta.specialties } : {}),
    ...(meta.lanes.length ? { lanes: meta.lanes } : {}),
    maxLevel: 15,
    baseStats,
    skills,
    sources: [{ field: "baseStats", url, retrieved: TODAY }],
  };

  writeFileSync(file, JSON.stringify(hero, null, 2) + "\n");
  return "written";
}

(async () => {
  const dir = ITEMS ? ITEMS_DIR : HEROES_DIR;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  let titles = ITEMS ? await listItems() : await listHeroes();
  if (ONLY) titles = titles.filter((t) => ONLY.includes(t));
  titles = titles.slice(0, LIMIT);
  console.log(`Seeding ${titles.length} candidate ${ITEMS ? "item" : "hero"} page(s)…`);

  const tally: Record<string, number> = {};
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
  for (const title of titles) {
    try {
      const result = ITEMS ? await seedItem(title) : await seedHero(title);
      bump(result);
      if (result === "written") console.log(`  ✓ ${title}`);
      else if (result === "nostats") console.log(`  ! ${title}: no stat table`);
    } catch (e) {
      bump("error");
      console.log(`  x ${title}: ${(e as Error).message}`);
    }
    await sleep(120);
  }
  console.log(`\nDone: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}.`);
})();
