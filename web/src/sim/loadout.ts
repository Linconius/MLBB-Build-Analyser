// Resolves an emblem set + chosen talents into a single flat stat block (max level) that the
// simulator folds from minute 0. v1 = stats only; talent active/conditional effects are carried
// as `effect` text on the talent for display, not applied here.
import type { Emblem, Talent, Loadout, ItemStatKey, ItemStatValue } from "../types";
import { statNum } from "./stats";

export function resolveLoadout(
  emblem: Emblem | undefined,
  talents: (Talent | undefined)[],
): Loadout {
  const stats: Partial<Record<ItemStatKey, ItemStatValue>> = {};
  const add = (src?: Partial<Record<ItemStatKey, ItemStatValue>>) => {
    if (!src) return;
    for (const [k, v] of Object.entries(src) as [ItemStatKey, ItemStatValue][]) {
      stats[k] = statNum(stats[k]) + statNum(v);
    }
  };
  add(emblem?.stats);
  for (const t of talents) add(t?.stats);
  return { stats };
}
