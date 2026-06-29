import { useState } from "react";
import { items as allItems, itemById } from "../data/loader";

export function BuildEditor({
  build,
  onChange,
}: {
  build: string[];
  onChange: (ids: string[]) => void;
}) {
  const [add, setAdd] = useState("");
  const buildItems = build.map((id) => itemById.get(id)!).filter(Boolean);
  const totalCost = buildItems.reduce((sum, it) => sum + it.cost.total, 0);

  const addItem = (id: string) => {
    if (id && build.length < 6 && !build.includes(id)) onChange([...build, id]);
    setAdd("");
  };
  const remove = (id: string) => onChange(build.filter((b) => b !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= build.length) return;
    const next = [...build];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="panel">
      <h2>Build (order = purchase order) — {totalCost.toLocaleString()}g</h2>
      <ul className="build-list">
        {buildItems.map((it, i) => (
          <li key={it.id}>
            <span className="order">{i + 1}</span>
            <button title="Move up" onClick={() => move(i, -1)}>▲</button>
            <button title="Move down" onClick={() => move(i, 1)}>▼</button>
            <span>{it.name}</span>
            <span className="cost">{it.cost.total.toLocaleString()}g</span>
            <button title="Remove" onClick={() => remove(it.id)}>✕</button>
          </li>
        ))}
        {build.length === 0 && <li className="muted">No items yet — add up to 6.</li>}
      </ul>

      {build.length < 6 && (
        <div className="pick-add" style={{ marginTop: 8 }}>
          <select value={add} onChange={(e) => addItem(e.target.value)}>
            <option value="">+ Add item…</option>
            {allItems
              .filter((it) => !build.includes(it.id))
              .map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.category}, {it.cost.total.toLocaleString()}g)
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}
