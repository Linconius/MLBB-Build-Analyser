# Patch workflow

The git history of each data file **is** the deliverable: `git log` on a hero/item file
should read as that entity's patch-by-patch balance history.

## Applying a patch

1. Read the official patch notes.
2. Edit **only the numbers/formulas that changed** in each affected
   `data/heroes/<id>.json` / `data/items/<id>.json`. Keep diffs minimal — don't reformat.
3. Bump each touched file's `lastPatch` to the new version.
4. Run `npm run validate`.
5. Commit **one file per commit** (cleanest per-file log) with the message format below.
6. Tag the patch and update `data/meta/patches.json`.

## Commit message format

```
data(hero/layla): patch 1.8.44 — Q base 200→260, ult AD ratio 2.0→2.2

- skill_1.q_primary coefficient 80→90 per level
- ultimate cooldown 40/35/30 → 38/34/30
Source: https://mobile-legends.fandom.com/wiki/Patch_Notes/1.8.44 (retrieved 2026-06-29)
```

Prefix scheme: `data(hero/<id>)`, `data(item/<id>)`, `schema(...)`, `web(...)`, `sim(...)`.

## Tags & registry

```
git tag -a patch-1.8.44 -m "MLBB patch 1.8.44"
```

Add the patch to `data/meta/patches.json` in the same set:

```json
{ "current": "1.8.44",
  "patches": { "1.8.44": { "date": "2026-06-29", "tag": "patch-1.8.44", "notesUrl": "https://mobile-legends.fandom.com/wiki/Patch_Notes/1.8.44" } } }
```

Then `git log patch-1.8.43..patch-1.8.44 -- data/heroes/` shows everything a patch changed,
and `git log --follow data/heroes/layla.json` is Layla's full balance history.
