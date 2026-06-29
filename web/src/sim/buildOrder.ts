// Maps an ordered item build + assumed gold income to the minute each purchase completes.
// Items with a recipe (cost.components) expand into their precursor purchases so the gold
// timeline shows gradual stat bumps as each component finishes, then the combine merges them.
import type { Item } from "../types";

/**
 * One purchase along the gold axis: either a leaf component bought at its full `total`, or a
 * combine step that pays only `combine` and consumes the component steps it merges. Items with
 * no recipe produce a single leaf step — identical to the pre-recipe behaviour.
 */
export interface PurchaseStep {
  item: Item;
  key: string;            // globally unique per step: `${buildSlot}:${item.id}#${n}` (a component may recur)
  stepCost: number;       // full total for a leaf; combine fee for a combine
  cumulativeCost: number;
  unlockMinute: number;   // minute this purchase completes
  consumes: string[];     // exact child step keys merged away by this combine (empty for leaves)
  buildSlot: number;      // index of the owning final item in the build order
}

/** Kept for back-compat: callers (timeline, tests, chart) treat unlocks as purchase steps. */
export type ItemUnlock = PurchaseStep;

export interface ComputeUnlocksOptions {
  startingGold?: number;
  /** Resolves a component id to its Item. Omit to disable recipe expansion (every item is a leaf). */
  resolveItem?: (id: string) => Item | undefined;
}

/**
 * Post-order expansion of one final item into purchase steps. Components are bought first (leaf
 * steps at full cost), then a combine step pays `combine` and consumes them. Recurses through
 * multi-level recipes; cycle-guarded; unresolved components degrade the item to a single leaf so
 * partial authoring never breaks the gold axis. Returns the steps plus this item's own `rootKey`
 * (the key the parent's combine consumes). `counter` hands out globally unique step indices so a
 * component that recurs in one recipe (e.g. two Daggers) gets distinct keys.
 */
function expandItem(
  item: Item,
  buildSlot: number,
  resolve: (id: string) => Item | undefined,
  seen: Set<string>,
  counter: { n: number },
): { steps: PurchaseStep[]; rootKey: string } {
  const key = `${buildSlot}:${item.id}#${counter.n++}`;
  const ids = item.cost.components ?? [];
  const components = ids.map(resolve).filter((c): c is Item => c !== undefined);
  if (components.length === 0 || seen.has(item.id)) {
    // Leaf: a single purchase at full cost (the pre-recipe behaviour).
    return { steps: [stepOf(item, buildSlot, item.cost.total, [], key)], rootKey: key };
  }
  const next = new Set(seen).add(item.id);
  const children = components.map((c) => expandItem(c, buildSlot, resolve, next, counter));
  const steps = children.flatMap((c) => c.steps);
  const componentsTotal = components.reduce((sum, c) => sum + c.cost.total, 0);
  const combineCost = item.cost.combine ?? item.cost.total - componentsTotal;
  steps.push(stepOf(item, buildSlot, combineCost, children.map((c) => c.rootKey), key));
  return { steps, rootKey: key };
}

function stepOf(item: Item, buildSlot: number, stepCost: number, consumes: string[], key: string): PurchaseStep {
  return { item, key, stepCost, cumulativeCost: 0, unlockMinute: 0, consumes, buildSlot };
}

/**
 * Expands each build item to purchase steps, then walks cumulative gold so each step unlocks when
 * `startingGold + gpm*minutes` covers the running cost total. Because `total = Σcomponents + combine`,
 * the cumulative axis (and each final item's unlock minute) is unchanged from the lump-sum model.
 */
export function computeUnlocks(orderedItems: Item[], gpm: number, opts: ComputeUnlocksOptions = {}): PurchaseStep[] {
  const startingGold = opts.startingGold ?? 0;
  const resolve = opts.resolveItem ?? (() => undefined);

  const counter = { n: 0 };
  const steps = orderedItems.flatMap((item, slot) => expandItem(item, slot, resolve, new Set(), counter).steps);

  let cumulative = 0;
  for (const step of steps) {
    cumulative += step.stepCost;
    step.cumulativeCost = cumulative;
    const goldNeeded = cumulative - startingGold;
    step.unlockMinute = gpm > 0 ? Math.max(0, goldNeeded / gpm) : Infinity;
  }
  return steps;
}

/**
 * Items owned at a given minute, with how long each has been owned (for stacking passives).
 * A component is dropped once the combine that consumes it is owned, so stats transition from
 * the component set to the final item.
 */
export function ownedAtMinute(steps: PurchaseStep[], minute: number): { item: Item; secondsOwned: number }[] {
  const active = steps.filter((s) => minute >= s.unlockMinute);
  const consumed = new Set(active.flatMap((s) => s.consumes));
  return active
    .filter((s) => !consumed.has(s.key))
    .map((s) => ({ item: s.item, secondsOwned: (minute - s.unlockMinute) * 60 }));
}
