import type { MatchSettings } from "../state/buildConfig";
import { LANES, LANE_PRESETS } from "../state/buildConfig";
import type { Lane } from "../types";

export function AssumptionsPanel({
  settings, onChange,
}: {
  settings: MatchSettings;
  onChange: (s: MatchSettings) => void;
}) {
  const set = (patch: Partial<MatchSettings>) => onChange({ ...settings, ...patch });
  const preset = LANE_PRESETS[settings.lane];

  return (
    <div className="panel">
      <h2>Match assumptions (shared across builds)</h2>

      <label className="field">
        <span className="row"><span>Lane</span><span className="val">{preset.gpm} g/min · {preset.lpm.toFixed(1)} lvl/min</span></span>
        <div className="stat-toggles" style={{ marginTop: 4 }}>
          {LANES.map((l) => (
            <span key={l}
              className={"chip" + (l === settings.lane ? " on" : "")}
              style={l === settings.lane ? { background: "var(--accent)", borderColor: "var(--accent)" } : undefined}
              onClick={() => set({ lane: l as Lane })}>
              {l}
            </span>
          ))}
        </div>
      </label>

      <label className="field">
        <span className="row"><span>Match length</span><span className="val">{settings.matchMinutes} min</span></span>
        <input type="range" min={5} max={25} step={1} value={settings.matchMinutes}
          onChange={(e) => set({ matchMinutes: Number(e.target.value) })} />
      </label>

      <label className="field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={settings.assumeConditionalsActive}
          onChange={(e) => set({ assumeConditionalsActive: e.target.checked })} />
        <span>Assume conditional item passives active</span>
      </label>
    </div>
  );
}
