import { useState } from "react";
import { assetUrl } from "../data/loader";

/** Square icon for a hero/item; renders nothing if the image is missing (404). */
export function Icon({ kind, id, size = 28, alt }: { kind: "heroes" | "items"; id: string; size?: number; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img
      src={assetUrl(kind, id)}
      alt={alt ?? id}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ borderRadius: 6, objectFit: "cover", flex: "0 0 auto", background: "var(--panel-2)" }}
    />
  );
}
