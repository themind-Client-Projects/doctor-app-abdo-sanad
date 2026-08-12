"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Filter state that goes to the SERVER, not to a client-side `.filter()`.
 *
 * `DataTable`'s own search and dropdowns narrow the rows already loaded, which
 * is right for a screen that loads everything it has. It is wrong for a screen
 * whose endpoint is paged: /admin/blood-bank fetched the newest 100 rows and
 * filtered those, so "كل الحالات → مكتمل" searched 100 records and reported
 * nothing for anything older — a blood bank keeps its history, so that boundary
 * arrives quickly, and the answer it gives is silently false.
 *
 * The hook holds the chosen values and hands back a `params` object for
 * `useDashboardData`. Everything is debounced together: typing must not fire a
 * request per keystroke, and 300ms is imperceptible on a dropdown.
 *
 * ```ts
 * const filters = useServerFilters({ status: "", q: "" });
 * const { data } = useDashboardData({ url: "/api/blood-bank", params: filters.params });
 * ```
 */
export function useServerFilters<T extends Record<string, string>>(
  initial: T,
  delayMs = 300
) {
  /** What the controls show — updated on every keystroke. */
  const [values, setValues] = useState<T>(initial);
  /** What the server is asked for — updated once typing stops. */
  const [settled, setSettled] = useState<T>(initial);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(values), delayMs);
    return () => clearTimeout(timer);
  }, [values, delayMs]);

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => setValues((v) => ({ ...v, [key]: value })),
    []
  );

  const reset = useCallback(() => {
    setValues(initial);
    // `initial` is a module constant at every call site; taking it as a
    // dependency would give `reset` a new identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Empty strings are dropped, so `?status=` never reaches the server. */
  const params = useMemo(() => {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(settled)) {
      out[key] = value === "" ? undefined : value;
    }
    return out;
  }, [settled]);

  const isActive = useMemo(() => Object.values(values).some((v) => v !== ""), [values]);

  return { values, set, reset, params, isActive };
}
