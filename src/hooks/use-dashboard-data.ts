"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseDashboardDataOptions {
  url: string;
  params?: Record<string, string | undefined>;
  /** ms — polling interval. Omit for a one-shot fetch. */
  refreshInterval?: number;
  /** Skip fetching entirely (e.g. waiting on a required param). */
  enabled?: boolean;
}

interface UseDashboardDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Read a JSON endpoint that follows the API response contract.
 *
 * Three things this handles that the previous version did not, and that every
 * screen in the app inherited:
 *
 *  - **Abort on unmount / re-fetch.** An in-flight request used to resolve into
 *    `setState` after the component was gone, and a slow first request could
 *    land *after* a fast second one and overwrite fresher data with staler.
 *    Each run now owns an `AbortController` and a sequence number; only the
 *    newest run is allowed to commit.
 *  - **`isLoading` on refetch.** Loading was set false in the first `finally`
 *    and never set true again, so a poll or a post-mutation refetch showed
 *    stale rows with no indication anything was happening.
 *  - **Undefined params are dropped**, so `?status=undefined` never reaches the
 *    server as a literal string that fails query validation.
 */
export function useDashboardData<T>({
  url,
  params,
  refreshInterval,
  enabled = true,
}: UseDashboardDataOptions): UseDashboardDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // A primitive, so `fetchData` stays referentially stable when a caller passes
  // an inline `params` object literal (which every caller does).
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") search.set(k, v);
  }
  const queryString = search.toString() ? `?${search}` : "";

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;

    // Only the newest run may touch state — a superseded run is a no-op.
    const isCurrent = () => mountedRef.current && runIdRef.current === runId;

    if (isCurrent()) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`${url}${queryString}`, { signal: controller.signal });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "فشل في تحميل البيانات");
      }
      if (isCurrent()) setData((body?.data ?? body) as T);
    } catch (err) {
      // An abort is a cancellation, not a failure — never surface it.
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isCurrent()) setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [url, queryString, enabled]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!refreshInterval || !enabled) return;
    const interval = setInterval(() => void fetchData(), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, enabled]);

  return { data, isLoading, error, refetch: fetchData };
}
