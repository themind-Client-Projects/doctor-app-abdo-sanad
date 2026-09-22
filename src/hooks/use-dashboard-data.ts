"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_STALE_TIME_MS,
  invalidate,
  load,
  snapshot,
  subscribe,
  type ResponseMeta,
  type Snapshot,
} from "@/lib/request-cache";

interface UseDashboardDataOptions {
  url: string;
  params?: Record<string, string | undefined>;
  /** ms — polling interval. Omit for a one-shot fetch. */
  refreshInterval?: number;
  /** Skip fetching entirely (e.g. waiting on a required param). */
  enabled?: boolean;
  /**
   * How long a result is reused without going to the network.
   *
   * Raise it for data that rarely moves — governorates, specialties, feature
   * flags — so navigating between screens does not re-fetch a list that is
   * effectively constant.
   */
  staleTime?: number;
}

interface UseDashboardDataReturn<T> {
  data: T | null;
  /** The envelope's `meta` — page info and any server-side `summary`. */
  meta: ResponseMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Read a JSON endpoint that follows the API response contract.
 *
 * State lives in `@/lib/request-cache`, keyed by the full URL, so every
 * component asking for the same resource shares one request and one copy of the
 * answer. Loading `/doctors` used to open 26 sockets for 5 resources — not from
 * any loop, but because a header, a list and a drawer each legitimately wanted
 * `me` or `feature-flags`, and StrictMode doubled all of it.
 *
 * What this hook still owns:
 *
 *  - **`isLoading` means "and I have nothing to show"**, so a component with
 *    cached data does not flash a skeleton over data it already has while a
 *    background revalidation runs.
 *  - **Undefined and empty params are dropped**, so `?status=undefined` never
 *    reaches the server as a literal string that fails query validation.
 *  - **Polling**, which revalidates through the same shared path — two
 *    components polling the same URL still produce one request per tick.
 *
 * Torn reads are not possible: `useSyncExternalStore` is React's contract for
 * an external store, and the cache notifies every subscriber on the same tick.
 */
export function useDashboardData<T>({
  url,
  params,
  refreshInterval,
  enabled = true,
  staleTime = DEFAULT_STALE_TIME_MS,
}: UseDashboardDataOptions): UseDashboardDataReturn<T> {
  // The cache key IS the request. Built from primitives so it stays stable
  // across renders even though every caller passes an inline `params` literal.
  const key = useMemo(() => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== "") search.set(k, v);
    }
    const qs = search.toString();
    return qs ? `${url}?${qs}` : url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params ?? {})]);

  const active = enabled && url !== "";

  const store = useSyncExternalStore<Snapshot<T>>(
    useCallback((onChange) => (active ? subscribe(key, onChange) : () => {}), [key, active]),
    useCallback(() => snapshot<T>(key), [key]),
    // The server renders nothing for a client-fetched resource; without a
    // distinct server snapshot React warns about a hydration mismatch.
    useCallback(() => EMPTY as Snapshot<T>, [])
  );

  useEffect(() => {
    if (!active) return;
    void load(key, { staleTime });
  }, [key, active, staleTime]);

  useEffect(() => {
    if (!refreshInterval || !active) return;
    const timer = setInterval(() => void load(key, { force: true }), refreshInterval);
    return () => clearInterval(timer);
  }, [key, active, refreshInterval]);

  const refetch = useCallback(async () => {
    if (!active) return;
    // A refetch follows a write, so the freshness window must not apply — the
    // data it would serve is precisely the data the write invalidated.
    invalidate(key);
    await load(key, { force: true });
  }, [key, active]);

  return {
    data: store.data,
    /** `meta.summary` is an aggregate over the whole filtered set, not the page. */
    meta: store.meta,
    // Only a load with nothing to show is "loading". A revalidation over
    // existing data is deliberately silent, so lists do not blink every poll.
    isLoading: active && store.isEmpty && store.error === null,
    error: store.error,
    refetch,
  };
}

const EMPTY: Snapshot<unknown> = { data: null, meta: null, error: null, isFetching: false, isEmpty: true };
