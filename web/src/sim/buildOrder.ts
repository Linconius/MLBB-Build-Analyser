// Maps an ordered item build + assumed gold income to the minute each item completes.
import type { Item } from "../types";

export interface ItemUnlock {
  item: Item;
  cumulativeCost: number;
  unlockMinute: number; // minute the item finishes (cumulative gold reaches its cost)
}

/**
 * An item is "owned" once cumulative gold (startingGold + gpm*minutes) covers the running
 * total of item costs up to and including it.
 */
export function computeUnlocks(orderedItems: Item[], gpm: number, startingGold = 0): ItemUnlock[] {
  const unlocks: ItemUnlock[] = [];
  let cumulative = 0;
  for (const item of orderedItems) {
    cumulative += item.cost.total;
    const goldNeeded = cumulative - startingGold;
    const unlockMinute = gpm > 0 ? Math.max(0, goldNeeded / gpm) : Infinity;
    unlocks.push({ item, cumulativeCost: cumulative, unlockMinute });
  }
  return unlocks;
}

/** Items owned at a given minute, with how long each has been owned (for stacking passives). */
export function ownedAtMinute(unlocks: ItemUnlock[], minute: number): { item: Item; secondsOwned: number }[] {
  return unlocks
    .filter((u) => minute >= u.unlockMinute)
    .map((u) => ({ item: u.item, secondsOwned: (minute - u.unlockMinute) * 60 }));
}
