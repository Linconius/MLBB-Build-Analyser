import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Timeline } from "../sim/timeline";
import type { TargetProfile } from "../sim/skills";

const AXIS = "#8b97b3";
const GRID = "#2a3556";
const SLOT_COLOR: Record<string, string> = {
  passive: "#7fd9c8", skill_1: "#5b8cff", skill_2: "#a36bff", skill_3: "#f06c9c", ultimate: "#f5c451",
};

function TargetSlider({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 120 }}>
      <span className="row"><span>{label}</span><span className="val">{value}</span></span>
      <input type="range" min={min} max={max} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function SkillDamagePanel({
  timeline, target, onTarget,
}: {
  timeline: Timeline;
  target: TargetProfile;
  onTarget: (t: TargetProfile) => void;
}) {
  const last = timeline.snapshots.at(-1);
  if (!last) return null;
  const rows = last.perSkill.filter((p) => p.damage > 0 || p.slot !== "passive");

  return (
    <div className="panel">
      <h2>Skill damage at full build (min {last.minute}, level {last.level})</h2>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <TargetSlider label="Target Phys Def" value={target.physicalDefense} min={0} max={300}
          onChange={(v) => onTarget({ ...target, physicalDefense: v })} />
        <TargetSlider label="Target Magic Def" value={target.magicDefense} min={0} max={300}
          onChange={(v) => onTarget({ ...target, magicDefense: v })} />
        <TargetSlider label="Target Max HP" value={target.maxHp} min={1000} max={12000}
          onChange={(v) => onTarget({ ...target, maxHp: v, currentHp: v })} />
      </div>

      <div className="chart-wrap short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" stroke={AXIS} tick={{ fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)} />
            <YAxis type="category" dataKey="name" stroke={AXIS} tick={{ fontSize: 11 }} width={110} />
            <Tooltip contentStyle={{ background: "#171f33", border: `1px solid ${GRID}`, borderRadius: 8 }}
              formatter={(v: number) => [Math.round(v).toLocaleString(), "Damage"]} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="damage" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.slot} fill={SLOT_COLOR[r.slot] ?? "#888"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="readout">
        <span className="stat">Combo burst<b>{last.skillBurst.toLocaleString()}</b></span>
        <span className="stat">Basic DPS<b>{Math.round(last.derived.dpsBasic).toLocaleString()}</b></span>
        <span className="stat">Phys Attack<b>{Math.round(last.stats.physicalAttack).toLocaleString()}</b></span>
        <span className="stat">Magic Power<b>{Math.round(last.stats.magicPower).toLocaleString()}</b></span>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
        Damage is one cast per skill vs the target above, after the {`120/(120+DEF)`} mitigation and the hero's
        penetration. Conditional/positional passives (e.g. Layla's range bonus) are simplified.
      </p>
    </div>
  );
}
