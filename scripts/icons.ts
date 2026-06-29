/**
 * Downloads hero portraits and item icons from the Fandom wiki into
 * web/public/assets/{heroes,items}/<id>.png. The UI references these by id
 * convention and hides any that 404, so data files don't need an icon field.
 *
 *   npm run icons -- [--force]
 *
 * Images are CC BY-SA (Mobile Legends Fandom wiki) — see docs/CONTRIBUTING.md.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const API = "https://mobile-legends.fandom.com/api.php";
const UA = "MLBB-Build-Analyser/0.1 (icon fetch; +https://github.com/)";
const FORCE = process.argv.includes("--force");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const listJson = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

async function imageUrls(fileTitles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < fileTitles.length; i += 40) {
    const batch = fileTitles.slice(i, i + 40);
    const url = API + "?" + new URLSearchParams({
      action: "query", prop: "imageinfo", iiprop: "url", format: "json", titles: batch.join("|"),
    });
    try {
      const r = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
      for (const p of Object.values(r.query?.pages ?? {}) as any[]) {
        if (p.imageinfo?.[0]?.url) out.set(p.title, p.imageinfo[0].url);
      }
    } catch { /* skip batch */ }
    await sleep(150);
  }
  return out;
}

// Fallback for heroes whose File:<name>.png doesn't exist: use the page's portrait image.
async function heroPortraitUrl(name: string): Promise<string | null> {
  const url = API + "?" + new URLSearchParams({ action: "parse", page: name, prop: "images", format: "json" });
  try {
    const r = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
    const imgs: string[] = r.parse?.images ?? [];
    const pick =
      imgs.find((i) => /portrait/i.test(i) && /\.png$/i.test(i)) ??
      imgs.find((i) => i.toLowerCase().startsWith(name.toLowerCase()) && /\.png$/i.test(i));
    if (!pick) return null;
    const urls = await imageUrls([`File:${pick}`]);
    return urls.get(`File:${pick}`) ?? null;
  } catch {
    return null;
  }
}

async function download(url: string, dest: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
        return true;
      }
    } catch { /* retry */ }
    await sleep(400 * (attempt + 1));
  }
  return false;
}

const defaultTitle = (e: { name: string }) => `File:${e.name}.png`;

async function seedKind(
  kind: "heroes" | "items" | "emblems",
  fileTitle: (e: { id: string; name: string }) => string = defaultTitle,
): Promise<void> {
  const dataDir = join(ROOT, "data", kind);
  const outDir = join(ROOT, "web", "public", "assets", kind);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const entries = listJson(dataDir)
    .map((f) => readJson(join(dataDir, f)))
    .filter((e) => FORCE || !existsSync(join(outDir, `${e.id}.png`)));
  if (entries.length === 0) {
    console.log(`${kind}: all icons present (use --force to refresh).`);
    return;
  }

  const titleToId = new Map(entries.map((e) => [fileTitle(e), e.id]));
  console.log(`${kind}: resolving ${entries.length} image URL(s)…`);
  const urls = await imageUrls([...titleToId.keys()]);

  const idToName = new Map(entries.map((e) => [e.id, e.name]));
  let ok = 0, missing = 0;
  for (const [title, id] of titleToId) {
    let url = urls.get(title);
    if (!url && kind === "heroes") url = (await heroPortraitUrl(idToName.get(id)!)) ?? undefined;
    if (!url) { missing++; continue; }
    if (await download(url, join(outDir, `${id}.png`))) ok++;
    else missing++;
    await sleep(80);
  }
  console.log(`${kind}: ${ok} downloaded, ${missing} missing/failed.`);
}

(async () => {
  await seedKind("heroes");
  await seedKind("items");
  // Emblem images are "<Name> Emblem.png" (Common is "Basic Common Emblem.png").
  await seedKind("emblems", (e) => `File:${e.name === "Common" ? "Basic Common" : e.name} Emblem.png`);
  console.log("Done.");
})();
