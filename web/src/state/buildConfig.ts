import type { Lane } from "../types";

/** A full build: hero + ordered items + emblem + one talent per tier + role + display color. */
export interface BuildConfig {
  id: string;
  name: string;
  heroId: string;
  items: string[];
  emblemId: string;
  talentIds: [string, string, string]; // tier 1, 2, 3
  role: Lane;
  color: string;
}

/** Shared (across all compared builds) match assumptions. GPM/LPM derive from the lane. */
export interface MatchSettings {
  lane: Lane;
  matchMinutes: number;
  assumeConditionalsActive: boolean;
}

export const LANES: Lane[] = ["Gold", "Mid", "Jungle", "Exp", "Roam"];

/** Per-lane gold/min and levels/min presets — tunable assumptions surfaced in the UI. */
export const LANE_PRESETS: Record<Lane, { gpm: number; lpm: number }> = {
  Gold: { gpm: 520, lpm: 1.4 },
  Mid: { gpm: 440, lpm: 1.6 },
  Jungle: { gpm: 420, lpm: 1.7 },
  Exp: { gpm: 340, lpm: 1.3 },
  Roam: { gpm: 250, lpm: 1.2 },
};

export const BUILD_COLORS = ["#f5c451", "#5b8cff", "#56d364", "#f06c9c", "#a36bff"];
export const MAX_BUILDS = 5;

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `b${Date.now()}${Math.round(Math.random() * 1e6)}`;

export function makeBuild(args: {
  index: number;
  heroId: string;
  emblemId: string;
  talentIds: [string, string, string];
  role?: Lane;
  name?: string;
}): BuildConfig {
  return {
    id: newId(),
    name: args.name ?? `Build ${args.index + 1}`,
    heroId: args.heroId,
    items: [],
    emblemId: args.emblemId,
    talentIds: args.talentIds,
    role: args.role ?? "Gold",
    color: BUILD_COLORS[args.index % BUILD_COLORS.length],
  };
}
