import { useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { Timeline } from "../sim/timeline";
import type { BuildConfig } from "../state/buildConfig";
import { STAT_DEFS, STAT_BY_KEY } from "./statDefs";

const AXIS = "#8b97b3";
const GRID = "#2a3556";
const VIEWS = [
  { key: "single", label: "One stat" },
  { key: "multiples", label: "Small multiples" },
  { key: "dual", label: "Two stats" },
] as const;
type View = (typeof VIEWS)[number]["key"];
const MULTIPLES = ["physicalAttack", "hp", "physicalDefense", "attackSpeed", "dpsBasic", "skillBurst"];
const axisFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`);

function StatChips({ value, onPick, exclude }: { value: string; onPick: (k: string) => void; exclude?: string }) {
  return (
    <div className="stat-toggles">
      {STAT_DEFS.filter((d) => d.key !== exclude).map((d) => (
        <span key={d.key}
          className={"chip" + (d.key === value ? " on" : "")}
          style={d.key === value ? { background: d.color, borderColor: d.color } : undefined}
          onClick={() => onPick(d.key)}>
          {d.label}
        </span>
      ))}
    </div>
  );
}

export function CompareChart({ builds, timelines }: { builds: BuildConfig[]; timelines: Timeline[] }) {
  const [view, setView] = useState<View>("single");
  const [statA, setStatA] = useState("physicalAttack");
  const [statB, setStatB] = useState("attackSpeed");

  const len = timelines[0]?.snapshots.length ?? 0;
  const minutes = timelines[0]?.snapshots.map((s) => s.minute) ?? [];
  const rowsFor = (keys: { id: string; statKey: string }[]) =>
    Array.from({ length: len }, (_, i) => {
      const row: Record<string, number> = { minute: minutes[i] };
      for (const { id, statKey } of keys) {
        const bi = builds.findIndex((b) => b.id === id);
        const def = STAT_BY_KEY.get(statKey)!;
        row[`${id}:${statKey}`] = def.get(timelines[bi].snapshots[i]);
      }
      return row;
    });

  const tip = (
    <Tooltip contentStyle={{ background: "#171f33", border: `1px solid ${GRID}`, borderRadius: 8 }}
      labelStyle={{ color: "#e6ebf5" }} labelFormatter={(l) => `Minute ${l}`} />
  );

  const single = () => {
    const def = STAT_BY_KEY.get(statA)!;
    const data = rowsFor(builds.map((b) => ({ id: b.id, statKey: statA })));
    return (
      <>
        <StatChips value={statA} onPick={setStatA} />
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
              <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={52} tickFormatter={axisFmt} />
              {tip}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {builds.map((b) => (
                <Line key={b.id} dataKey={`${b.id}:${statA}`} name={`${b.name} · ${def.label}`}
                  stroke={b.color} dot={false} strokeWidth={2.5} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  };

  const dual = () => {
    const defA = STAT_BY_KEY.get(statA)!, defB = STAT_BY_KEY.get(statB)!;
    const data = rowsFor(builds.flatMap((b) => [{ id: b.id, statKey: statA }, { id: b.id, statKey: statB }]));
    return (
      <>
        <div className="axis-row"><span className="axis-label">Solid · left</span><StatChips value={statA} onPick={setStatA} exclude={statB} /></div>
        <div className="axis-row"><span className="axis-label">Dashed · right</span><StatChips value={statB} onPick={setStatB} exclude={statA} /></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
              <YAxis yAxisId="left" stroke={AXIS} tick={{ fontSize: 11 }} width={48} tickFormatter={axisFmt} />
              <YAxis yAxisId="right" orientation="right" stroke={AXIS} tick={{ fontSize: 11 }} width={44} tickFormatter={axisFmt} />
              {tip}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {builds.map((b) => (
                <Line key={b.id + "A"} yAxisId="left" dataKey={`${b.id}:${statA}`} name={`${b.name} · ${defA.label}`}
                  stroke={b.color} dot={false} strokeWidth={2.5} isAnimationActive={false} />
              ))}
              {builds.map((b) => (
                <Line key={b.id + "B"} yAxisId="right" dataKey={`${b.id}:${statB}`} name={`${b.name} · ${defB.label}`}
                  stroke={b.color} strokeDasharray="4 3" dot={false} strokeWidth={2} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  };

  const multiples = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
      {MULTIPLES.map((key) => {
        const def = STAT_BY_KEY.get(key)!;
        const data = rowsFor(builds.map((b) => ({ id: b.id, statKey: key })));
        return (
          <div key={key}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>{def.label}</div>
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="minute" stroke={AXIS} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}`} />
                  <YAxis stroke={AXIS} tick={{ fontSize: 9 }} width={40} tickFormatter={axisFmt} />
                  {tip}
                  {builds.map((b) => (
                    <Line key={b.id} dataKey={`${b.id}:${key}`} name={b.name}
                      stroke={b.color} dot={false} strokeWidth={2} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Compare builds</h2>
        <div className="stat-toggles" style={{ marginBottom: 0 }}>
          {VIEWS.map((v) => (
            <span key={v.key}
              className={"chip" + (v.key === view ? " on" : "")}
              style={v.key === view ? { background: "var(--accent-2)", borderColor: "var(--accent-2)" } : undefined}
              onClick={() => setView(v.key)}>
              {v.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {view === "single" && single()}
        {view === "dual" && dual()}
        {view === "multiples" && multiples()}
      </div>
    </div>
  );
}
