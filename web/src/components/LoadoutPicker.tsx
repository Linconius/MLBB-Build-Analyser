import { emblems, emblemById, talentById, talentsByTier } from "../data/loader";
import { resolveLoadout } from "../sim/loadout";
import { statNum } from "../sim/stats";
import type { BuildConfig, MatchSettings } from "../state/buildConfig";
import { LANES } from "../state/buildConfig";
import { Icon } from "./Icon";
import type { Lane } from "../types";

const STAT_LABELS: Record<string, string> = {
  physicalAttack: "Phys Atk", magicPower: "Magic Power", hp: "HP", mana: "Mana",
  physicalDefense: "Phys Def", magicDefense: "Magic Def", hpRegen: "HP Regen", manaRegen: "Mana Regen",
  attackSpeedPct: "Atk Speed %", critChancePct: "Crit %", critDamagePct: "Crit Dmg %",
  cooldownReductionPct: "CDR %", movementSpeed: "Move Spd", movementSpeedPct: "Move Spd %",
  adaptiveAttack: "Adaptive Atk", adaptivePenetration: "Adaptive Pen",
  magicPenetrationFlat: "Magic Pen", physicalPenetrationFlat: "Phys Pen",
  lifestealPct: "Lifesteal %", spellVampPct: "Spell Vamp %", hybridLifestealPct: "Hybrid Vamp %",
};

export function LoadoutPicker({
  build, onChange,
}: {
  build: BuildConfig;
  onChange: (patch: Partial<BuildConfig>) => void;
}) {
  const emblem = emblemById.get(build.emblemId);
  const chosen = build.talentIds.map((id) => talentById.get(id));
  const loadout = resolveLoadout(emblem, chosen);
  const folded = Object.entries(loadout.stats).filter(([, v]) => statNum(v) !== 0);
  const effects = chosen.filter((t) => t?.effect).map((t) => t!);

  const setTalent = (tier: 1 | 2 | 3, id: string) => {
    const next = [...build.talentIds] as [string, string, string];
    next[tier - 1] = id;
    onChange({ talentIds: next });
  };
  const tierSelect = (tier: 1 | 2 | 3) => (
    <label className="field" style={{ marginBottom: 8 }}>
      <span className="row"><span>Tier {tier}</span></span>
      <select value={build.talentIds[tier - 1]} onChange={(e) => setTalent(tier, e.target.value)}>
        {talentsByTier(tier).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="panel">
      <h2>Emblem, talents &amp; role (max level)</h2>

      <label className="field" style={{ marginBottom: 8 }}>
        <span className="row"><span>Role / lane</span></span>
        <select value={build.role} onChange={(e) => onChange({ role: e.target.value as Lane })}>
          {LANES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <Icon kind="emblems" id={build.emblemId} size={28} alt={emblem?.name} />
        <select value={build.emblemId} onChange={(e) => onChange({ emblemId: e.target.value })} style={{ flex: 1 }}>
          {emblems.map((em) => <option key={em.id} value={em.id}>{em.name} Emblem</option>)}
        </select>
      </div>

      {tierSelect(1)}
      {tierSelect(2)}
      {tierSelect(3)}

      <div className="readout" style={{ marginTop: 4 }}>
        {folded.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No flat stat bonuses.</span>}
        {folded.map(([k, v]) => (
          <span key={k} className="stat" style={{ fontSize: 11.5 }}>
            {STAT_LABELS[k] ?? k}<b>+{statNum(v)}</b>
          </span>
        ))}
      </div>
      {effects.length > 0 && (
        <ul className="muted" style={{ fontSize: 11, margin: "8px 0 0", paddingLeft: 16 }}>
          {effects.map((t) => <li key={t.id}><b style={{ color: "var(--text)" }}>{t.name}:</b> {t.effect}</li>)}
        </ul>
      )}
      <p className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
        Active/conditional talent effects are listed but not applied to the stat graph (v1).
      </p>
    </div>
  );
}

// Re-exported for App's convenience when seeding default builds.
export function defaultLoadoutIds(): { emblemId: string; talentIds: [string, string, string] } {
  return {
    emblemId: emblems.find((e) => e.id === "common")?.id ?? emblems[0].id,
    talentIds: [talentsByTier(1)[0].id, talentsByTier(2)[0].id, talentsByTier(3)[0].id],
  };
}

export type { MatchSettings };
