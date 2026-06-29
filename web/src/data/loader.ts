// Loads all hero/item JSON from the repo's data/ directory at build time. Vite bundles
// the files via import.meta.glob (eager), so there is no runtime fetch — the deployed
// build is atomic with the data it shipped from.
import type { Hero, Item, Emblem, Talent } from "../types";

const heroModules = import.meta.glob("../../../data/heroes/*.json", { eager: true });
const itemModules = import.meta.glob("../../../data/items/*.json", { eager: true });
const emblemModules = import.meta.glob("../../../data/emblems/*.json", { eager: true });
const talentModules = import.meta.glob("../../../data/talents/*.json", { eager: true });

function collect<T>(modules: Record<string, unknown>): T[] {
  return Object.values(modules).map((m) => (m as { default: T }).default);
}
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export const heroes: Hero[] = collect<Hero>(heroModules).sort(byName);
export const items: Item[] = collect<Item>(itemModules).sort(byName);
export const emblems: Emblem[] = collect<Emblem>(emblemModules).sort(byName);
export const talents: Talent[] = collect<Talent>(talentModules).sort(byName);

export const heroById = new Map(heroes.map((h) => [h.id, h]));
export const itemById = new Map(items.map((i) => [i.id, i]));
export const emblemById = new Map(emblems.map((e) => [e.id, e]));
export const talentById = new Map(talents.map((t) => [t.id, t]));
export const talentsByTier = (tier: 1 | 2 | 3): Talent[] => talents.filter((t) => t.tier === tier);

/** URL for a bundled icon (respects the Pages base path). Missing files 404 and are hidden. */
export const assetUrl = (kind: "heroes" | "items" | "emblems", id: string) =>
  `${import.meta.env.BASE_URL}assets/${kind}/${id}.png`;
