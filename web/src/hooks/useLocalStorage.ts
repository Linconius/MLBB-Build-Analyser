import { useCallback, useState } from "react";

/** Persisted state backed by localStorage (client-only). Swallows quota/parse errors. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* quota / unavailable — keep in-memory */
        }
        return v;
      });
    },
    [key],
  );

  return [value, set] as const;
}
