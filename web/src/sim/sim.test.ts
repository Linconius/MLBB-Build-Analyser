import { describe, it, expect } from "vitest";
import layla from "../../../data/heroes/layla.json";
import blade from "../../../data/items/blade-of-despair.json";
import type { Hero, Item } from "../types";
import { aggregateStats, AS_CAP } from "./stats";
import { skillDamage, DEFAULT_TARGET } from "./skills";
import { computeUnlocks } from "./buildOrder";
import { levelAtMinute, simulate } from "./timeline";

const hero = layla as unknown as Hero;
const bod = blade as unknown as Item;
const ult = hero.skills.find((s) => s.slot === "ultimate")!;

describe("levelAtMinute", () => {
  it("clamps 1..15", () => {
    expect(levelAtMinute(1.5, 0)).toBe(1);
    expect(levelAtMinute(1.5, 4)).toBe(7);
    expect(levelAtMinute(1.5, 100)).toBe(15);
  });
});

describe("aggregateStats base+growth", () => {
  it("Layla level 1 base stats", () => {
    const { stats } = aggregateStats(hero, 1, []);
    expect(stats.physicalAttack).toBe(133);
    expect(stats.hp).toBe(2250);
    expect(stats.attackSpeed).toBeCloseTo(1.06, 5);
  });
  it("Layla level 15 matches wiki (linear growth)", () => {
    const { stats } = aggregateStats(hero, 15, []);
    expect(stats.physicalAttack).toBe(252); // 133 + 8.5*14
    expect(stats.hp).toBe(4378); // 2250 + 152*14
  });
  it("adds item flat attack", () => {
    const { stats } = aggregateStats(hero, 15, [{ item: bod, secondsOwned: 0 }]);
    expect(stats.physicalAttack).toBe(422); // 252 + 170
  });
});

describe("attack speed cap", () => {
  it("never exceeds 3.0", () => {
    const fast = { ...bod, id: "fake-as", stats: { attackSpeedPct: 9999 } } as unknown as Item;
    const { stats, derived } = aggregateStats(hero, 15, [{ item: fast, secondsOwned: 0 }]);
    expect(stats.attackSpeed).toBe(AS_CAP);
    expect(derived.asCapped).toBe(true);
  });
});

describe("skill damage with mitigation", () => {
  it("Layla ult at 15, no items, vs default target", () => {
    const { stats } = aggregateStats(hero, 15, []);
    // raw = (500 + 150*2) + 1.5*252 = 1178; mult = 120/(120+50) = 0.70588
    const dmg = skillDamage(ult, stats, 15, 3, DEFAULT_TARGET);
    expect(dmg).toBeCloseTo(1178 * (120 / 170), 2);
  });
  it("ult scales with Blade of Despair", () => {
    const { stats } = aggregateStats(hero, 15, [{ item: bod, secondsOwned: 0 }]);
    // raw = 800 + 1.5*422 = 1433
    const dmg = skillDamage(ult, stats, 15, 3, DEFAULT_TARGET);
    expect(dmg).toBeCloseTo(1433 * (120 / 170), 2);
  });
});

describe("build unlocks", () => {
  it("Blade unlocks at cost/gpm", () => {
    const [u] = computeUnlocks([bod], 600);
    expect(u.unlockMinute).toBeCloseTo(3010 / 600, 5);
  });
});

describe("simulate end to end", () => {
  it("produces a snapshot per tick with rising attack", () => {
    const tl = simulate(hero, { items: [bod] }, { gpm: 600, lpm: 1.5, matchMinutes: 10, tickSeconds: 60 });
    expect(tl.snapshots.length).toBe(11); // minutes 0..10
    const first = tl.snapshots[0];
    const last = tl.snapshots[tl.snapshots.length - 1];
    expect(last.stats.physicalAttack).toBeGreaterThan(first.stats.physicalAttack);
    expect(last.level).toBe(15);
    expect(last.ownedItemIds).toContain("blade-of-despair");
  });
});
