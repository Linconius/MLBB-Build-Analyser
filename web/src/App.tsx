import { useMemo, useState } from "react";
import { heroes, heroById, itemById, emblemById, talentById } from "./data/loader";
import { simulate } from "./sim/timeline";
import { resolveLoadout } from "./sim/loadout";
import { DEFAULT_TARGET, type TargetProfile } from "./sim/skills";
import { HeroPicker } from "./components/HeroPicker";
import { BuildEditor } from "./components/BuildEditor";
import { AssumptionsPanel } from "./components/AssumptionsPanel";
import { LoadoutPicker, defaultLoadoutIds } from "./components/LoadoutPicker";
import { StatChart } from "./components/StatChart";
import { SkillDamagePanel } from "./components/SkillDamagePanel";
import { CompareChart } from "./components/CompareChart";
import { SavedBuildsPanel } from "./components/SavedBuildsPanel";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { KEYS, STORAGE_VERSION, sanitizeConfig, type SavedBuild } from "./state/storage";
import {
  makeBuild, LANE_PRESETS, MAX_BUILDS, type BuildConfig, type MatchSettings,
} from "./state/buildConfig";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s${Date.now()}${Math.round(Math.random() * 1e6)}`;

function makeInitialBuild(index: number): BuildConfig {
  return makeBuild({ index, heroId: heroes[0]?.id ?? "", ...defaultLoadoutIds(), role: "Gold" });
}

export function App() {
  const [builds, setBuilds] = useState<BuildConfig[]>([makeInitialBuild(0)]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [mode, setMode] = useState<"detail" | "compare">("detail");
  const [settings, setSettings] = useState<MatchSettings>({ lane: "Gold", matchMinutes: 15, assumeConditionalsActive: false });
  const [target, setTarget] = useState<TargetProfile>(DEFAULT_TARGET);
  const [favourites, setFavourites] = useLocalStorage<string[]>(KEYS.favourites, []);
  const [saved, setSaved] = useLocalStorage<SavedBuild[]>(KEYS.savedBuilds, []);

  const focus = builds[Math.min(focusIdx, builds.length - 1)];

  const timelines = useMemo(() => {
    const { gpm, lpm } = LANE_PRESETS[settings.lane];
    return builds.map((cfg) => {
      const hero = heroById.get(cfg.heroId) ?? heroes[0];
      const items = cfg.items.map((id) => itemById.get(id)!).filter(Boolean);
      const loadout = resolveLoadout(emblemById.get(cfg.emblemId), cfg.talentIds.map((id) => talentById.get(id)));
      return simulate(hero, { items }, {
        gpm, lpm, matchMinutes: settings.matchMinutes, tickSeconds: 60,
        assumeConditionalsActive: settings.assumeConditionalsActive, target, loadout,
      });
    });
  }, [builds, settings, target]);

  if (!focus || !heroById.get(focus.heroId)) {
    return <div className="app"><p>No hero data found. Run <code>npm run seed</code>.</p></div>;
  }
  const hero = heroById.get(focus.heroId)!;

  const patch = (p: Partial<BuildConfig>) =>
    setBuilds((bs) => bs.map((b, i) => (i === focusIdx ? { ...b, ...p } : b)));
  const focusBuild = (i: number) => { setFocusIdx(i); setSettings((s) => ({ ...s, lane: builds[i].role })); };
  const setRole = (p: Partial<BuildConfig>) => {
    patch(p);
    if (p.role) setSettings((s) => ({ ...s, lane: p.role! }));
  };
  const addBuild = () => {
    if (builds.length >= MAX_BUILDS) return;
    const i = builds.length;
    const dup: BuildConfig = { ...focus, ...makeBuild({ index: i, heroId: focus.heroId, emblemId: focus.emblemId, talentIds: focus.talentIds, role: focus.role }), items: [...focus.items] };
    setBuilds((bs) => [...bs, dup]);
    setFocusIdx(i);
    setMode("compare");
  };
  const removeBuild = (i: number) => {
    if (builds.length <= 1) return;
    setBuilds((bs) => bs.filter((_, j) => j !== i));
    setFocusIdx((f) => Math.max(0, f >= i ? f - 1 : f));
  };

  const toggleFavourite = (id: string) =>
    setFavourites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const saveCurrent = () => {
    const name = window.prompt("Name this build", focus.name)?.trim();
    if (!name) return;
    const entry: SavedBuild = { id: newId(), name, version: STORAGE_VERSION, config: { ...focus, name }, savedAt: new Date().toISOString() };
    setSaved((s) => [entry, ...s]);
  };
  const loadBuild = (b: SavedBuild) => {
    const cfg = sanitizeConfig(b.config);
    if (!cfg) return;
    setBuilds((bs) => bs.map((x, i) => (i === focusIdx ? { ...cfg, id: x.id, color: x.color } : x)));
    setMode("detail");
  };
  const deleteBuild = (id: string) => setSaved((s) => s.filter((x) => x.id !== id));

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="accent">MLBB</span> Build Analyser</h1>
        <span className="sub">stats &amp; skill damage across a match as gold and levels accrue</span>
      </header>

      <div className="banner">
        ⚠️ Leveling uses an assumed <b>levels-per-minute</b> per lane, not a real EXP curve. Emblems &amp; talents
        are taken at <b>max level</b> (flat stats folded; conditional effects listed, not applied).
      </div>

      {/* Build tab strip + mode toggle */}
      <div className="build-tabs">
        {builds.map((b, i) => (
          <span key={b.id}
            className={"build-tab" + (i === focusIdx ? " on" : "")}
            style={{ borderColor: b.color }}
            onClick={() => focusBuild(i)}>
            <span className="dot" style={{ background: b.color }} />
            {b.name}
            {builds.length > 1 && <button title="Remove" onClick={(e) => { e.stopPropagation(); removeBuild(i); }}>✕</button>}
          </span>
        ))}
        {builds.length < MAX_BUILDS && <button className="build-add" onClick={addBuild}>+ Add build</button>}
        {builds.length > 1 && (
          <div className="mode-toggle">
            <span className={"chip" + (mode === "detail" ? " on" : "")} onClick={() => setMode("detail")}>Detail</span>
            <span className={"chip" + (mode === "compare" ? " on" : "")} onClick={() => setMode("compare")}>Compare</span>
          </div>
        )}
      </div>

      <div className="grid">
        <div>
          <HeroPicker hero={hero} onSelect={(id) => patch({ heroId: id })}
            favourites={favourites} onToggleFavourite={toggleFavourite} />
          <BuildEditor build={focus.items} onChange={(items) => patch({ items })} />
          <LoadoutPicker build={focus} onChange={setRole} />
          <AssumptionsPanel settings={settings} onChange={setSettings} />
          <SavedBuildsPanel saved={saved} onSave={saveCurrent} onLoad={loadBuild} onDelete={deleteBuild} />
        </div>
        <div>
          {mode === "compare" && builds.length > 1 ? (
            <CompareChart builds={builds} timelines={timelines} />
          ) : (
            <>
              <StatChart timeline={timelines[focusIdx]} />
              <SkillDamagePanel timeline={timelines[focusIdx]} target={target} onTarget={setTarget} />
            </>
          )}
        </div>
      </div>

      <p className="footer">
        Data &amp; images derived from the{" "}
        <a href="https://mobile-legends.fandom.com/wiki/MLBB_Wiki" target="_blank" rel="noreferrer">MLBB Fandom wiki</a>{" "}
        (CC BY-SA). Fan project, not affiliated with Moonton.
      </p>
    </div>
  );
}
