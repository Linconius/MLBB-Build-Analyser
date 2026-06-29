import type { BuildConfig } from "./buildConfig";
import { heroById, itemById, emblemById, talentById } from "../data/loader";

export const STORAGE_VERSION = 1;
export const KEYS = {
  favourites: `mlbb:v${STORAGE_VERSION}:favouriteHeroes`,
  savedBuilds: `mlbb:v${STORAGE_VERSION}:savedBuilds`,
};

export interface SavedBuild {
  id: string;
  name: string;
  version: number;
  config: BuildConfig;
  savedAt: string;
}

/** Drop references to data that no longer exists (renamed/removed across patches). */
export function sanitizeConfig(c: BuildConfig): BuildConfig | null {
  if (!heroById.has(c.heroId)) return null;
  return {
    ...c,
    items: c.items.filter((id) => itemById.has(id)),
    emblemId: emblemById.has(c.emblemId) ? c.emblemId : (emblemById.keys().next().value ?? c.emblemId),
    talentIds: c.talentIds.map((id) => (talentById.has(id) ? id : id)) as [string, string, string],
  };
}
