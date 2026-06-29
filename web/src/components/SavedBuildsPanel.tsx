import { heroById } from "../data/loader";
import { Icon } from "./Icon";
import type { SavedBuild } from "../state/storage";

export function SavedBuildsPanel({
  saved, onSave, onLoad, onDelete,
}: {
  saved: SavedBuild[];
  onSave: () => void;
  onLoad: (b: SavedBuild) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="panel">
      <h2>Saved builds</h2>
      <button className="build-add" style={{ width: "100%" }} onClick={onSave}>＋ Save current build</button>
      {saved.length === 0 && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Nothing saved yet — saved builds persist in this browser.</p>}
      <ul className="build-list" style={{ marginTop: 10 }}>
        {saved.map((b) => {
          const hero = heroById.get(b.config.heroId);
          return (
            <li key={b.id}>
              <Icon kind="heroes" id={b.config.heroId} size={22} alt={hero?.name} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>{hero?.name}</span>
              <button title="Load" onClick={() => onLoad(b)} style={{ color: "var(--accent-2)" }}>Load</button>
              <button title="Delete" onClick={() => onDelete(b.id)}>✕</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
