import { useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Timeline } from "../sim/timeline";
import type { TargetProfile } from "../sim/skills";

const AXIS = "#8b97b3";
const GRID = "#2a3556";
const SLOT_COLOR: Record<string, string> = {
  passive: "#7fd9c8", skill_1: "#5b8cff", skill_2: "#a36bff", skill_3: "#f06c9c", ultimate: "#f5c451",
};
const axisFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`);

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
  const defs = timeline.skillOutputDefs;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const last = timeline.snapshots.at(-1);
  if (!last) return null;

  const data = timeline.snapshots.map((s) => ({ minute: s.minute, ...s.skillOutputs }));
  const lastMinute = data.at(-1)?.minute ?? 0;
  const labelByKey = new Map(defs.map((d) => [d.key, d.label]));
  // Multiple outputs of one skill share its slot colour; later ones dash so they read apart.
  const slotSeen: Record<string, number> = {};
  const dashByKey = new Map(defs.map((d) => {
    const n = (slotSeen[d.slot] = (slotSeen[d.slot] ?? 0) + 1);
    return [d.key, n > 1 ? "5 3" : undefined] as const;
  }));

  const toggle = (k: string) =>
    setHidden((cur) => {
      const next = new Set(cur);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const unlockLines = timeline.unlocks
    .filter((u) => Number.isFinite(u.unlockMinute) && u.unlockMinute <= lastMinute)
    .map((u) => (
      <ReferenceLine key={u.key} x={Math.round(u.unlockMinute * 10) / 10}
        stroke="#f5c451" strokeDasharray="3 3" strokeOpacity={0.5} />
    ));

  return (
    <div className="panel">
      <h2>Skill outputs over the match — vs the target below</h2>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <TargetSlider label="Target Phys Def" value={target.physicalDefense} min={0} max={300}
          onChange={(v) => onTarget({ ...target, physicalDefense: v })} />
        <TargetSlider label="Target Magic Def" value={target.magicDefense} min={0} max={300}
          onChange={(v) => onTarget({ ...target, magicDefense: v })} />
        <TargetSlider label="Target Max HP" value={target.maxHp} min={1000} max={12000}
          onChange={(v) => onTarget({ ...target, maxHp: v, currentHp: v })} />
      </div>

      {defs.length === 0 ? (
        <p className="muted">This hero has no numeric skill outputs (damage / heal / shield) to chart.</p>
      ) : (
        <>
          <div className="stat-toggles">
            {defs.map((d) => (
              <span key={d.key}
                className={"chip" + (hidden.has(d.key) ? "" : " on")}
                style={hidden.has(d.key) ? undefined : { background: SLOT_COLOR[d.slot] ?? "#888", borderColor: SLOT_COLOR[d.slot] ?? "#888" }}
                onClick={() => toggle(d.key)}>
                {d.label}
              </span>
            ))}
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
                <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={52} tickFormatter={axisFmt} />
                <Tooltip contentStyle={{ background: "#171f33", border: `1px solid ${GRID}`, borderRadius: 8 }}
                  labelStyle={{ color: "#e6ebf5" }} labelFormatter={(l) => `Minute ${l}`}
                  formatter={(v: number, key) => [Math.round(v).toLocaleString(), labelByKey.get(String(key)) ?? key]} />
                {unlockLines}
                {defs.filter((d) => !hidden.has(d.key)).map((d) => (
                  <Line key={d.key} type="monotone" dataKey={d.key} stroke={SLOT_COLOR[d.slot] ?? "#888"}
                    strokeDasharray={dashByKey.get(d.key)} dot={false} strokeWidth={2} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="readout">
        <span className="stat">Combo burst<b>{last.skillBurst.toLocaleString()}</b></span>
        <span className="stat">Basic DPS<b>{Math.round(last.derived.dpsBasic).toLocaleString()}</b></span>
        <span className="stat">Phys Attack<b>{Math.round(last.stats.physicalAttack).toLocaleString()}</b></span>
        <span className="stat">Magic Power<b>{Math.round(last.stats.magicPower).toLocaleString()}</b></span>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
        One cast per skill vs the target above. Damage is post-{`120/(120+DEF)`} mitigation and the hero's
        penetration; heal/shield are raw. Crowd-control outputs aren't plotted. Combo burst is the full-build total.
      </p>
    </div>
  );
}
