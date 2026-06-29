import { describe, it, expect } from "vitest";
import layla from "../../../data/heroes/layla.json";
import saberData from "../../../data/heroes/saber.json";
import blade from "../../../data/items/blade-of-despair.json";
import legionData from "../../../data/items/legion-sword.json";
import daggerData from "../../../data/items/dagger.json";
import divineGlaive from "../../../data/items/divine-glaive.json";
import maleficRoar from "../../../data/items/malefic-roar.json";
import maleficGun from "../../../data/items/malefic-gun.json";
import type { Hero, Item } from "../types";
import { aggregateStats, AS_CAP, statNum } from "./stats";
import { skillDamage, DEFAULT_TARGET } from "./skills";
import { computeUnlocks, ownedAtMinute } from "./buildOrder";
import { levelAtMinute, simulate } from "./timeline";

const hero = layla as unknown as Hero;
const bod = blade as unknown as Item;
const legion = legionData as unknown as Item;
const dagger = daggerData as unknown as Item;
// Resolver covering Blade of Despair's recipe tree: BoD = 2x Legion Sword; Legion Sword = 2x Dagger.
const resolveItem = (id: string): Item | undefined =>
  ({ "blade-of-despair": bod, "legion-sword": legion, dagger }[id]);
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
    expect(stats.physicalAttack).toBe(252 + statNum(bod.stats.physicalAttack)); // base L15 + item AD
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
  const innate = { physicalAttack: 252, magicPower: 0 }; // Layla base+growth at L15
  it("Layla ult at 15, no items, vs default target", () => {
    const { stats } = aggregateStats(hero, 15, []);
    // raw = (500 + 150*2) + 1.5*252 = 1178; mult = 120/(120+50) = 0.70588
    const dmg = skillDamage(ult, stats, innate, 15, 3, DEFAULT_TARGET);
    expect(dmg).toBeCloseTo(1178 * (120 / 170), 2);
  });
  it("ult scales with Blade of Despair", () => {
    const { stats } = aggregateStats(hero, 15, [{ item: bod, secondsOwned: 0 }]);
    // raw = 800 + 1.5 * (252 base L15 + item AD); mult = 120/(120+50)
    const raw = 800 + 1.5 * (252 + statNum(bod.stats.physicalAttack));
    const dmg = skillDamage(ult, stats, innate, 15, 3, DEFAULT_TARGET);
    expect(dmg).toBeCloseTo(raw * (120 / 170), 2);
  });
});

describe("bonus_physical_attack scaling", () => {
  const saber = saberData as unknown as Hero;
  it("Saber ult scales with item AD, not base AD", () => {
    const { stats } = aggregateStats(saber, 15, [{ item: bod, secondsOwned: 0 }]);
    const ultS = saber.skills.find((s) => s.slot === "ultimate")!;
    const innate = { physicalAttack: 118 + 9.71 * 14, magicPower: 0 };
    const bonus = statNum(bod.stats.physicalAttack);
    // two strikes (180 + 1*bonus) + final (360 + 2*bonus), then 120/(120+50) mitigation
    const raw = 2 * (180 + bonus) + (360 + 2 * bonus);
    const dmg = skillDamage(ultS, stats, innate, 15, 3, DEFAULT_TARGET);
    expect(dmg).toBeCloseTo(raw * (120 / 170), 1);
  });
});

describe("build unlocks", () => {
  it("Blade unlocks at cost/gpm (no resolver → single lump step)", () => {
    const steps = computeUnlocks([bod], 600);
    expect(steps.length).toBe(1);
    expect(steps[0].unlockMinute).toBeCloseTo(3010 / 600, 5);
  });
});

describe("recipe expansion", () => {
  it("buys components before the final; final still unlocks at total/gpm", () => {
    const steps = computeUnlocks([bod], 600, { resolveItem });
    const final = steps[steps.length - 1];
    expect(final.item.id).toBe("blade-of-despair");
    expect(final.unlockMinute).toBeCloseTo(3010 / 600, 5); // unchanged from the lump model
    expect(steps[0].item.id).toBe("dagger"); // cheapest leaf completes first
    expect(steps[0].unlockMinute).toBeLessThan(final.unlockMinute);
  });

  it("owned set transitions from components to the final (no double-count)", () => {
    const steps = computeUnlocks([bod], 600, { resolveItem });
    const finalMin = steps[steps.length - 1].unlockMinute;
    const before = ownedAtMinute(steps, finalMin - 0.01).map((o) => o.item.id);
    expect(before).toContain("legion-sword");
    expect(before).not.toContain("blade-of-despair");
    const after = ownedAtMinute(steps, finalMin).map((o) => o.item.id);
    expect(after).toEqual(["blade-of-despair"]); // components consumed by the combine
  });

  it("a no-component item yields exactly one step even with a resolver", () => {
    const steps = computeUnlocks([dagger], 600, { resolveItem });
    expect(steps.length).toBe(1);
    expect(steps[0].item.id).toBe("dagger");
  });
});

describe("hybrid stats count as both physical and magical", () => {
  const mk = (stats: Item["stats"]) => ({ ...bod, id: "fake", stats, passives: [] } as unknown as Item);
  it("hybridLifestealPct → lifesteal AND spell vamp; hybridPenetrationFlat → both pen flats", () => {
    const { stats } = aggregateStats(hero, 15, [{ item: mk({ hybridLifestealPct: 10, hybridPenetrationFlat: 8 }), secondsOwned: 0 }]);
    expect(stats.lifestealPct).toBe(10);
    expect(stats.spellVampPct).toBe(10);
    expect(stats.physicalPenetrationFlat).toBe(8);
    expect(stats.magicPenetrationFlat).toBe(8);
  });
  it("adaptivePenetration resolves to physical for a physical hero, magic for a magic hero", () => {
    const item = mk({ adaptivePenetration: 12 });
    const phys = aggregateStats(hero, 15, [{ item, secondsOwned: 0 }]).stats;
    expect(phys.physicalPenetrationFlat).toBe(12);
    expect(phys.magicPenetrationFlat).toBe(0);
    const magicHero = { ...hero, damageType: "magic" } as Hero;
    const mag = aggregateStats(magicHero, 15, [{ item, secondsOwned: 0 }]).stats;
    expect(mag.magicPenetrationFlat).toBe(12);
    expect(mag.physicalPenetrationFlat).toBe(0);
  });
});

describe("authored penetration data", () => {
  it("Divine Glaive grants 40% magic pen (stored as 0.4 fraction)", () => {
    const { stats } = aggregateStats(hero, 15, [{ item: divineGlaive as unknown as Item, secondsOwned: 0 }]);
    expect(stats.magicPenetrationPct).toBeCloseTo(0.4, 5);
  });
  it("Malefic Roar + Malefic Gun share the 'Armor Buster' unique → 30% phys pen, not 60%", () => {
    const owned = [
      { item: maleficRoar as unknown as Item, secondsOwned: 0 },
      { item: maleficGun as unknown as Item, secondsOwned: 0 },
    ];
    const { stats } = aggregateStats(hero, 15, owned);
    expect(stats.physicalPenetrationPct).toBeCloseTo(0.3, 5); // unique attribute does not stack
  });
});

describe("unique-attribute stat grants", () => {
  const mk = (id: string, stats: Item["stats"]) => ({ ...bod, id, stats, passives: [] } as unknown as Item);
  it("same unique name does not stack (highest wins); plain stats still stack", () => {
    const a = mk("a", { movementSpeedPct: { value: 5, unique: "Swift" }, physicalAttack: 10 });
    const b = mk("b", { movementSpeedPct: { value: 5, unique: "Swift" }, physicalAttack: 10 });
    const one = aggregateStats(hero, 1, [{ item: a, secondsOwned: 0 }]).stats;
    const two = aggregateStats(hero, 1, [{ item: a, secondsOwned: 0 }, { item: b, secondsOwned: 0 }]).stats;
    expect(two.movementSpeed).toBeCloseTo(one.movementSpeed, 5); // unique MS% counted once
    expect(two.physicalAttack).toBeCloseTo(one.physicalAttack + 10, 5); // plain AD stacks
  });
  it("keeps the highest value among same-named uniques", () => {
    const a = mk("a", { movementSpeedPct: { value: 5, unique: "Swift" } });
    const c = mk("c", { movementSpeedPct: { value: 9, unique: "Swift" } });
    const mix = aggregateStats(hero, 1, [{ item: a, secondsOwned: 0 }, { item: c, secondsOwned: 0 }]).stats;
    const only9 = aggregateStats(hero, 1, [{ item: c, secondsOwned: 0 }]).stats;
    expect(mix.movementSpeed).toBeCloseTo(only9.movementSpeed, 5);
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
