export interface SimAssumptions {
  gpm: number;
  lpm: number;
  matchMinutes: number;
  assumeConditionalsActive: boolean;
}

function Slider({
  label, value, min, max, step, fmt, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span className="row">
        <span>{label}</span>
        <span className="val">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function AssumptionsPanel({
  a, onChange,
}: {
  a: SimAssumptions;
  onChange: (a: SimAssumptions) => void;
}) {
  const set = (patch: Partial<SimAssumptions>) => onChange({ ...a, ...patch });
  return (
    <div className="panel">
      <h2>Match assumptions</h2>
      <Slider label="Gold / min" value={a.gpm} min={200} max={900} step={10}
        fmt={(v) => `${v} g`} onChange={(gpm) => set({ gpm })} />
      <Slider label="Levels / min" value={a.lpm} min={0.5} max={2.5} step={0.1}
        fmt={(v) => v.toFixed(1)} onChange={(lpm) => set({ lpm })} />
      <Slider label="Match length" value={a.matchMinutes} min={5} max={25} step={1}
        fmt={(v) => `${v} min`} onChange={(matchMinutes) => set({ matchMinutes })} />
      <label className="field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={a.assumeConditionalsActive}
          onChange={(e) => set({ assumeConditionalsActive: e.target.checked })} />
        <span>Assume conditional item passives active</span>
      </label>
    </div>
  );
}
