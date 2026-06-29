# Data model

All data lives under `data/` as one JSON file per entity, validated against the schemas in
`schema/` (JSON Schema draft 2020-12). The web app consumes these files directly.

```
data/
  heroes/<id>.json     one hero (the file's git log = its patch history)
  items/<id>.json      one item
  meta/patches.json    patch registry
  meta/index.json      generated id→name manifest (do not hand-edit)
```

`<id>` is a stable kebab-case slug equal to the filename. It never changes across patches —
that is what keeps the git history coherent.

## Hero (`schema/hero.schema.json`)

- Identity & metadata: `id`, `name`, `title`, `resourceType`, `damageType`, `roles[]`,
  `specialties[]`, `lanes[]`, `releaseYear`, `lastPatch`, `skillsVerified`.
- `baseStats`: each linear stat as `{base, growth}` (see
  [STAT-CONVENTIONS.md](STAT-CONVENTIONS.md)), plus the scalar `attackSpeedRatio`.
- `skills[]`: each has a `slot`, `name`, `description`, `maxLevel`, `cooldownSeconds[]`,
  `manaCost[]`, and `algorithms[]`.
  - `algorithm`: `id`, `trigger`, optional `condition` (DSL → 0/1), `inputs[]`, and
    `outputs[]`. A `todo` field marks an unverified stub.
  - `output`: a `type` (damage/CC/heal/shield/buff…), a `formula` (DSL string), a
    `magnitudeUnit`, and for CC `durationSeconds` / `valuePercent`.
- `sources[]`: provenance (url + retrieved date).

See [FORMULA-DSL.md](FORMULA-DSL.md) for the formula language and variable vocabulary.

## Item (`schema/item.schema.json`)

- Identity: `id`, `name`, `category`, `tier`.
- `cost`: `{ total, combine, components[] }` (components are item ids — referential
  integrity is checked).
- `stats`: a flat object keyed by the closed `itemStatKey` set (percent stats use the
  `Pct` suffix).
- `passives[]` / `actives[]`: named effect blocks with `description`, optional
  `cooldownSeconds`, `alwaysOn` / `condition`, and `effects[]`. Time-stacking effects carry
  `maxStacks` / `secondsPerStack` so the simulator can materialise them over match time.
- `sources[]`: provenance.

## Stubs

Seeded entities whose skill scaling could not be parsed ship with `algorithms[].todo` set
and `skillsVerified: false`. They validate, but the simulator treats stubbed outputs as
zero and the UI flags the hero. Hand-author them from the wiki to complete.
