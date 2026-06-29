# MLBB Build Analyser

**▶ Live app: https://linconius.github.io/MLBB-Build-Analyser/**

A **versioned, public data-source** for Mobile Legends: Bang Bang hero and item stats — plus
an **interactive build analyser** that graphs a hero's stats and skill damage over the course
of a match as gold buys items and levels accrue.

**Coverage:** 135 heroes and 98 items, seeded from the Fandom wiki with verified base stats,
growth, costs and effect text. Skill *damage formulas* are authored by hand (no source
publishes them) — 5 heroes done so far (Layla, Eudora, Saber, Alucard, Lesley); the rest carry
verified base stats with skills flagged "unverified" until authored.

Two things live in one repo:

1. **Data** (`data/`) — one JSON file per hero and per item. Each file's git history is its
   patch-by-patch balance log: `git log --follow data/heroes/layla.json` reads as Layla's
   change history. Schemas in `schema/` validate every file in CI.
2. **Web app** (`web/`) — a React + Vite + TypeScript UI deployed to GitHub Pages. Pick a
   hero, assemble an item build, set assumed **gold-per-minute** and **level-per-minute**, and
   watch a bar graph of the hero's stats (and a skill-damage view) evolve across the match.

## Quick start

```
npm install
npm run validate          # check all data against schema + formula + referential rules
npm run dev               # run the web app locally
```

| Command | What it does |
|---|---|
| `npm run validate` | Ajv schema + DSL formula lint + referential integrity over `data/` |
| `npm run seed` | Pull/refresh data from the Fandom MediaWiki API into `data/` (+ icons) |
| `npm run build-index` | Regenerate `data/meta/index.json` |
| `npm run dev` / `npm run build:web` | Run / build the web app |
| `npm test` | Simulator unit tests |

## How it models a match

Leveling is a **user-set assumption** (level-per-minute), not a real EXP curve — MLBB does not
publish the per-level EXP table, so this is a deliberate, clearly-flagged simplification.
Gold-per-minute drives item purchases in build order; each item completes when cumulative gold
passes its cost. The simulator then aggregates base+growth(by level) + item stats, folds item
passives, applies the real MLBB formulas/caps (`120/(120+DEF)`, CDR 40/45%, attack speed 3.0),
and evaluates each skill's damage. See [docs/](docs/).

## Documentation

- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — file layout and schema overview
- [docs/STAT-CONVENTIONS.md](docs/STAT-CONVENTIONS.md) — stat storage, growth, caps, formulas
- [docs/FORMULA-DSL.md](docs/FORMULA-DSL.md) — the skill/effect formula language
- [docs/PATCH-WORKFLOW.md](docs/PATCH-WORKFLOW.md) — commit/tag conventions for patches
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — how to add/verify data

## Attribution

Hero/item data and images are derived from the
[Mobile Legends: Bang Bang Fandom wiki](https://mobile-legends.fandom.com/wiki/MLBB_Wiki)
(licensed **CC BY-SA**). This is a fan project, not affiliated with or endorsed by Moonton.
