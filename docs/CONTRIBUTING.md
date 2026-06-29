# Contributing

## Setup

```
npm install
npm run validate    # schema + formula + referential checks
```

## Editing data

- One JSON file per hero/item under `data/`. Keep keys in their existing order and use
  2-space indentation with a trailing newline (minimal diffs).
- Read [DATA-MODEL.md](DATA-MODEL.md), [STAT-CONVENTIONS.md](STAT-CONVENTIONS.md), and
  [FORMULA-DSL.md](FORMULA-DSL.md) before adding fields.
- Every numeric change should cite a `sources[]` url + `retrieved` date.
- Run `npm run validate` before committing. CI runs it on every PR and a failure blocks
  merge.

## ⚠️ Skill formulas are authored by hand

No open dataset contains MLBB skill damage formulas. The seed pipeline can fill base stats,
item stats, and effect **text**, but **every `algorithms[].formula` is written by a human**
from the [Fandom wiki](https://mobile-legends.fandom.com/wiki/MLBB_Wiki) skill descriptions.
Seeded heroes ship with `todo` stubs and `skillsVerified: false` until someone fills and
verifies them.

When authoring a skill:

1. Find the skill's effect text on the hero's wiki page.
2. Translate each scaling line into an `output` with a DSL `formula` (see FORMULA-DSL.md).
3. Remove the `todo`, fill `inputs[]`, and add a `sources[]` entry.
4. Set `skillsVerified: true` only when **all** of the hero's skills are authored.

## Patches

See [PATCH-WORKFLOW.md](PATCH-WORKFLOW.md) for the commit/tag conventions.

## Licensing & attribution

Hero/item text and images are sourced from the Mobile Legends: Bang Bang Fandom wiki, which
is licensed **CC BY-SA**. Preserve `sources[]` provenance and the attribution in the README.
This project is fan-made and not affiliated with or endorsed by Moonton.
