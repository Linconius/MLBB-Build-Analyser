// Loads all hero/item JSON from the repo's data/ directory at build time. Vite bundles
// the files via import.meta.glob (eager), so there is no runtime fetch — the deployed
// build is atomic with the data it shipped from.
import type { Hero, Item } from "../types";

const heroModules = import.meta.glob("../../../data/heroes/*.json", { eager: true });
const itemModules = import.meta.glob("../../../data/items/*.json", { eager: true });

function collect<T>(modules: Record<string, unknown>): T[] {
  return Object.values(modules).map((m) => (m as { default: T }).default);
}

export const heroes: Hero[] = collect<Hero>(heroModules).sort((a, b) => a.name.localeCompare(b.name));
export const items: Item[] = collect<Item>(itemModules).sort((a, b) => a.name.localeCompare(b.name));

export const heroById = new Map(heroes.map((h) => [h.id, h]));
export const itemById = new Map(items.map((i) => [i.id, i]));
