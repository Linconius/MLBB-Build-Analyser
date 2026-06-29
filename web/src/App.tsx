import { useMemo, useState } from "react";
import { heroes, heroById, itemById } from "./data/loader";
import { simulate } from "./sim/timeline";
import { DEFAULT_TARGET, type TargetProfile } from "./sim/skills";
import { HeroPicker } from "./components/HeroPicker";
import { BuildEditor } from "./components/BuildEditor";
import { AssumptionsPanel, type SimAssumptions } from "./components/AssumptionsPanel";
import { StatChart } from "./components/StatChart";
import { SkillDamagePanel } from "./components/SkillDamagePanel";

export function App() {
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? "");
  const [build, setBuild] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<SimAssumptions>({
    gpm: 500,
    lpm: 1.5,
    matchMinutes: 15,
    assumeConditionalsActive: false,
  });
  const [target, setTarget] = useState<TargetProfile>(DEFAULT_TARGET);

  const hero = heroById.get(heroId) ?? heroes[0];

  const timeline = useMemo(() => {
    if (!hero) return null;
    const items = build.map((id) => itemById.get(id)!).filter(Boolean);
    return simulate(hero, { items }, {
      gpm: assumptions.gpm,
      lpm: assumptions.lpm,
      matchMinutes: assumptions.matchMinutes,
      tickSeconds: 60,
      assumeConditionalsActive: assumptions.assumeConditionalsActive,
      target,
    });
  }, [hero, build, assumptions, target]);

  if (!hero) {
    return <div className="app"><p>No hero data found. Run <code>npm run seed</code> or add files under <code>data/heroes</code>.</p></div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="accent">MLBB</span> Build Analyser</h1>
        <span className="sub">stats &amp; skill damage across a match as gold and levels accrue</span>
      </header>

      <div className="banner">
        ⚠️ Leveling uses an assumed <b>levels-per-minute</b>, not a real EXP curve (MLBB does not publish one).
        Gold-per-minute drives item purchases in build order. Numbers reflect the data in this repo at patch{" "}
        {hero.lastPatch ?? "—"}.
      </div>

      <div className="grid">
        <div>
          <HeroPicker hero={hero} onSelect={setHeroId} />
          <BuildEditor build={build} onChange={setBuild} />
          <AssumptionsPanel a={assumptions} onChange={setAssumptions} />
        </div>
        <div>
          {timeline && <StatChart timeline={timeline} />}
          {timeline && <SkillDamagePanel timeline={timeline} target={target} onTarget={setTarget} />}
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
