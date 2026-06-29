import { useState } from "react";
import { heroes } from "../data/loader";
import { Icon } from "./Icon";
import type { Hero } from "../types";

export function HeroPicker({ hero, onSelect }: { hero: Hero; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = heroes.filter((h) => h.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="panel">
      <h2>Hero</h2>
      <input
        type="search"
        placeholder={`Search ${heroes.length} heroes…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <select value={hero.id} onChange={(e) => onSelect(e.target.value)} size={1}>
        {filtered.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
            {h.title ? ` — ${h.title}` : ""}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <Icon kind="heroes" id={hero.id} size={56} alt={hero.name} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{hero.name}</div>
          {hero.title && <div className="muted" style={{ fontSize: 12 }}>{hero.title}</div>}
        </div>
      </div>

      <div className="hero-meta">
        {hero.roles.map((r) => (
          <span key={r} className="tag role">{r}</span>
        ))}
        <span className="tag">{hero.damageType}</span>
        <span className="tag">{hero.resourceType}</span>
        {hero.skillsVerified === false && <span className="tag warn">skills unverified</span>}
      </div>
    </div>
  );
}
