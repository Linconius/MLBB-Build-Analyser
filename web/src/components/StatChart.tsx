import { useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { Timeline } from "../sim/timeline";
import { STAT_DEFS, STAT_BY_KEY } from "./statDefs";

const AXIS = "#8b97b3";
const GRID = "#2a3556";

const OVERVIEW_DEFAULT = ["physicalAttack", "hp", "physicalDefense", "attackSpeed"];
const axisFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`);

export function StatChart({ timeline }: { timeline: Timeline }) {
  const [primary, setPrimary] = useState("physicalAttack");
  const [secondary, setSecondary] = useState<string | null>("attackSpeed");
  const [overview, setOverview] = useState<string[]>(OVERVIEW_DEFAULT);

  const def = STAT_BY_KEY.get(primary)!;
  const secDef = secondary ? STAT_BY_KEY.get(secondary)! : null;

  const data = timeline.snapshots.map((s) => {
    const row: Record<string, number> = { minute: s.minute };
    for (const d of STAT_DEFS) row[d.key] = d.get(s);
    return row;
  });

  // Normalize overview series to % of each stat's own max so different scales coexist.
  const maxByKey = new Map<string, number>();
  for (const d of STAT_DEFS) maxByKey.set(d.key, Math.max(1, ...data.map((r) => r[d.key])));
  const normData = data.map((r) => {
    const row: Record<string, number> = { minute: r.minute };
    for (const k of overview) row[k] = (r[k] / maxByKey.get(k)!) * 100;
    return row;
  });

  const lastMinute = data.at(-1)?.minute ?? 0;
  const unlockLines = (yAxisId?: string) =>
    timeline.unlocks
      .filter((u) => Number.isFinite(u.unlockMinute) && u.unlockMinute <= lastMinute)
      .map((u) => (
        <ReferenceLine key={u.item.id} x={Math.round(u.unlockMinute * 10) / 10} {...(yAxisId ? { yAxisId } : {})}
          stroke="#f5c451" strokeDasharray="3 3"
          label={{ value: u.item.name, position: "top", fill: "#f5c451", fontSize: 10 }} />
      ));

  const tipFormatter = (v: number, key: string) => {
    const d = STAT_BY_KEY.get(key);
    return [d?.fmt ? d.fmt(v) : Math.round(v), d?.label ?? key];
  };
  const toggleOverview = (k: string) =>
    setOverview((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const pickSecondary = (k: string) => setSecondary((cur) => (cur === k ? null : k));

  return (
    <div className="panel">
      <h2>Stat over the match — dual axis</h2>
      <div className="axis-row">
        <span className="axis-label">Bars · left axis</span>
        <div className="stat-toggles">
          {STAT_DEFS.map((d) => (
            <span key={d.key}
              className={"chip" + (d.key === primary ? " on" : "")}
              style={d.key === primary ? { background: d.color, borderColor: d.color } : undefined}
              onClick={() => setPrimary(d.key)}>
              {d.label}
            </span>
          ))}
        </div>
      </div>
      <div className="axis-row">
        <span className="axis-label">Line · right axis</span>
        <div className="stat-toggles">
          {STAT_DEFS.map((d) => (
            <span key={d.key}
              className={"chip" + (d.key === secondary ? " on" : "")}
              style={d.key === secondary ? { background: d.color, borderColor: d.color } : { borderStyle: "dashed" }}
              onClick={() => pickSecondary(d.key)}>
              {d.label}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
            <YAxis yAxisId="left" stroke={def.color} tick={{ fontSize: 11 }} width={52} tickFormatter={axisFmt} />
            <YAxis yAxisId="right" orientation="right" stroke={secDef?.color ?? AXIS}
              tick={{ fontSize: 11 }} width={48} tickFormatter={axisFmt} />
            <Tooltip contentStyle={{ background: "#171f33", border: `1px solid ${GRID}`, borderRadius: 8 }}
              labelStyle={{ color: "#e6ebf5" }}
              formatter={(v: number, key) => tipFormatter(v, String(key))}
              labelFormatter={(l) => `Minute ${l}`} />
            <Legend formatter={(k) => STAT_BY_KEY.get(String(k))?.label ?? k} wrapperStyle={{ fontSize: 11 }} />
            {unlockLines("left")}
            <Bar yAxisId="left" dataKey={primary} fill={def.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {secondary && secDef && (
              <Line yAxisId="right" type="monotone" dataKey={secondary} stroke={secDef.color}
                dot={false} strokeWidth={2.5} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h2 style={{ marginTop: 18 }}>All stats overview — normalized % of own max</h2>
      <div className="stat-toggles">
        {STAT_DEFS.map((d) => (
          <span key={d.key}
            className={"chip" + (overview.includes(d.key) ? " on" : "")}
            style={overview.includes(d.key) ? { background: d.color, borderColor: d.color } : undefined}
            onClick={() => toggleOverview(d.key)}>
            {d.label}
          </span>
        ))}
      </div>
      <div className="chart-wrap short">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={normData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={36} domain={[0, 100]}
              tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={{ background: "#171f33", border: `1px solid ${GRID}`, borderRadius: 8 }}
              labelFormatter={(l) => `Minute ${l}`}
              formatter={(v: number, key) => [`${Math.round(v)}%`, STAT_BY_KEY.get(String(key))?.label ?? key]} />
            <Legend formatter={(k) => STAT_BY_KEY.get(String(k))?.label ?? k} wrapperStyle={{ fontSize: 11 }} />
            {unlockLines()}
            {overview.map((k) => (
              <Line key={k} type="monotone" dataKey={k} stroke={STAT_BY_KEY.get(k)!.color}
                dot={false} strokeWidth={2} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
