import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

type Loaded<T> = { key: string; items: T[]; error: string };

/**
 * Loads an admin list and reloads it on demand. `refreshing` is derived from
 * which request the current data came from, so nothing is set synchronously in
 * the effect and stale replies from an earlier filter are dropped.
 */
export function useAdminList<T>(url: string) {
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: "", items: [], error: "" });
  const key = `${url}#${tick}`;

  useEffect(() => {
    let live = true;
    api<T[]>(url)
      .then((items) => live && setLoaded({ key, items, error: "" }))
      .catch((e: Error) => live && setLoaded((prev) => ({ key, items: prev.items, error: e.message })));
    return () => {
      live = false;
    };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { items: loaded.items, error: loaded.error, refreshing: loaded.key !== key, reload };
}

/** Short reference shown to the admin (DA-0007); older records fall back to the id's tail. */
export const refOf = (item: { id: string; ref?: unknown }) =>
  typeof item.ref === "string" && item.ref ? item.ref : `#${item.id.slice(-6).toUpperCase()}`;

/** True when every word of the query appears in one of the fields (case-insensitive). */
export function matches(query: string, ...fields: unknown[]): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter((f) => typeof f === "string").join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}
