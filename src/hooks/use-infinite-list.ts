"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cursor-paged fetching with an infinite-scroll sentinel.
 *
 * The patient app is a phone app: numbered pagination means tapping a small
 * target to see twelve more results, which nobody does. This loads the next
 * page when a sentinel scrolls into view.
 *
 * Keyset, not offset. Every list here is ordered by `createdAt desc`, so a row
 * inserted between page 1 and page 2 shifts everything down — with offsets the
 * reader sees a duplicate and silently misses a record. `nextCursor` comes from
 * the API's own `meta.page`.
 *
 * Written against `fetch` rather than `useDashboardData` because that hook
 * discards `meta`, and `meta.page.nextCursor` is the whole mechanism.
 */

type Page<T> = {
  data: T[];
  meta?: { page?: { nextCursor: string | null; hasMore: boolean } };
};

export function useInfiniteList<T>({
  url,
  params,
  pageSize = 12,
}: {
  url: string;
  /** Filters. Changing any value RESETS the list — see below. */
  params?: Record<string, string | undefined>;
  pageSize?: number;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A primitive, so the effect below compares by VALUE — callers pass an inline
  // object literal, which is a new reference on every render.
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") query.set(k, v);
  }
  const filterKey = query.toString();

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // Guards against a sentinel that fires repeatedly while a page is in flight.
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (replace) setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);

      try {
        const qs = new URLSearchParams(filterKey);
        qs.set("limit", String(pageSize));
        if (nextCursor) qs.set("cursor", nextCursor);

        const res = await fetch(`${url}?${qs}`, { signal: controller.signal });
        const body = (await res.json().catch(() => null)) as Page<T> | null;
        if (!res.ok) throw new Error(body ? "فشل في تحميل البيانات" : "فشل في تحميل البيانات");
        if (!mountedRef.current) return;

        const rows = body?.data ?? [];
        // Replace on a filter change, append on a scroll — appending after a
        // filter change would stack yesterday's results under today's.
        setItems((prev) => (replace ? rows : [...prev, ...rows]));
        setCursor(body?.meta?.page?.nextCursor ?? null);
        setHasMore(Boolean(body?.meta?.page?.hasMore));
      } catch (err) {
        // An abort is a cancellation, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (mountedRef.current) setError(err instanceof Error ? err.message : "خطأ غير معروف");
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [url, filterKey, pageSize]
  );

  // Any filter change starts a fresh list from the top.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    void fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    void fetchPage(cursor, false);
  }, [hasMore, cursor, fetchPage]);

  /**
   * Attach to an element at the end of the list.
   *
   * A callback ref rather than `useRef` + `useEffect`: the sentinel unmounts
   * whenever the list is empty or loading, and a ref object would still point
   * at the detached node, so the observer would watch something no longer on
   * the page and never fire again.
   */
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) loadMore();
        },
        // Start fetching before the sentinel is actually visible, so the next
        // page is usually there by the time the reader arrives.
        { rootMargin: "400px" }
      );
      observerRef.current.observe(node);
    },
    [loadMore]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    sentinelRef,
    loadMore,
    refetch: useCallback(() => fetchPage(null, true), [fetchPage]),
  };
}
