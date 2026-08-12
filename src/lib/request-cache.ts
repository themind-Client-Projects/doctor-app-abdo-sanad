"use client";

/**
 * One request per resource, however many components ask for it.
 *
 * Loading `/doctors` fired **26 requests for 5 resources**: `/api/v1/me` eight
 * times, `/api/public/feature-flags` seven, and so on. Nothing was looping —
 * each was a different component honestly asking for what it needed:
 *
 *   - the header wants `me`, and so does the profile page
 *   - the browse list wants `feature-flags`, and so does the booking drawer
 *   - React StrictMode mounts every effect twice in development, doubling the
 *     lot and aborting the first of each pair (the cancelled rows in devtools)
 *
 * Every one of those is reasonable in isolation, which is why this belongs in
 * one shared layer rather than in the components. Two mechanisms:
 *
 *   **In-flight sharing.** A second ask for a key that is already being fetched
 *   joins the existing promise instead of opening a socket. This is what
 *   collapses the mount storm — and StrictMode's double-invoke with it.
 *
 *   **A freshness window.** A key fetched within `staleTime` is served from
 *   memory. This is what stops a navigation back to a screen re-fetching data
 *   that is seconds old.
 *
 * Deliberately not a dependency. SWR or React Query would do this and more, but
 * they would mean rewriting forty call sites; putting it behind
 * `useDashboardData` fixes every screen at once and leaves the call sites
 * untouched.
 */

type Entry = {
  data?: unknown;
  error?: string;
  /** When `data`/`error` last landed. 0 means never. */
  fetchedAt: number;
  /**
   * Marked by `invalidate` so the next read goes to the network.
   *
   * A separate flag rather than resetting `fetchedAt`, because "stale" and
   * "never loaded" are different facts and the UI treats them oppositely:
   * zeroing the timestamp made `isEmpty` true, so every post-write refetch
   * flashed a skeleton over data the user was already reading.
   */
  stale?: boolean;
  inflight?: Promise<void>;
  listeners: Set<() => void>;
  /**
   * The last snapshot handed out, reused until something actually changes.
   *
   * `useSyncExternalStore` compares snapshots by identity: a `getSnapshot` that
   * builds a fresh object every call makes React believe the store changed on
   * every render and re-render forever. Caching it here is what makes the whole
   * hook safe — the classic way to get this wrong.
   */
  view?: Snapshot<unknown>;
};

const cache = new Map<string, Entry>();

/**
 * How long a result is served without going to the network.
 *
 * The default is short on purpose: most of what this app reads is operational —
 * orders, referrals, worklists — where showing a minute-old queue is worse than
 * a round trip. It exists to collapse the mount storm, not to hold data.
 */
export const DEFAULT_STALE_TIME_MS = 5_000;

/**
 * Named tiers, so the choice is made once rather than as a magic number at ten
 * call sites — and so it is obvious WHY a given resource holds longer.
 *
 * Everything here is invalidated by a write through `refetch`, so a longer
 * window never means an admin edits a governorate and nobody sees it; it means
 * the browse screen stops re-fetching the list of Iraqi governorates every time
 * the user opens it.
 */
export const STALE_TIME = {
  /** Lists an admin edits occasionally: governorates, specialties. */
  reference: 10 * 60_000,
  /** Feature flags — read at startup to decide which screens exist at all. */
  config: 5 * 60_000,
  /** The home storefront: real content that rotates, so only briefly held. */
  storefront: 60_000,
} as const;

function entryFor(key: string): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { fetchedAt: 0, listeners: new Set() };
    cache.set(key, entry);
  }
  return entry;
}

/** Anything that changes what a subscriber would see must go through here. */
function notify(entry: Entry) {
  // Drop the memoized view so the next `getSnapshot` builds a fresh identity —
  // that identity change is the signal React re-renders on.
  entry.view = undefined;
  for (const listen of entry.listeners) listen();
}

export type Snapshot<T> = {
  data: T | null;
  error: string | null;
  /** True while a request for this key is open. */
  isFetching: boolean;
  /** True when nothing has ever landed for this key. */
  isEmpty: boolean;
};

export function snapshot<T>(key: string): Snapshot<T> {
  const entry = cache.get(key);
  if (!entry) return EMPTY_SNAPSHOT as Snapshot<T>;

  // Stable identity between notifications — see `Entry.view`.
  entry.view ??= {
    data: entry.data ?? null,
    error: entry.error ?? null,
    isFetching: Boolean(entry.inflight),
    isEmpty: entry.fetchedAt === 0,
  };
  return entry.view as Snapshot<T>;
}

/** One frozen instance, so an unknown key is also referentially stable. */
const EMPTY_SNAPSHOT: Snapshot<unknown> = Object.freeze({
  data: null,
  error: null,
  isFetching: false,
  isEmpty: true,
});

export function subscribe(key: string, listener: () => void): () => void {
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    // Keep the DATA when the last component leaves — that is the whole point of
    // a cache, and it is what makes going back to a screen instant. Only the
    // bookkeeping goes.
    if (entry.listeners.size === 0 && !entry.inflight && entry.fetchedAt === 0) {
      cache.delete(key);
    }
  };
}

/**
 * Fetch `key`, unless someone already is or the result is still fresh.
 *
 * @param force skip the freshness window and start a new request — what a
 *              refetch after a mutation needs, since data from before the write
 *              is exactly what must not be reused.
 */
export function load(
  key: string,
  opts: { force?: boolean; staleTime?: number } = {}
): Promise<void> {
  const entry = entryFor(key);
  const staleTime = opts.staleTime ?? DEFAULT_STALE_TIME_MS;

  // Join whatever is already open. Even a forced refetch joins: a request that
  // has not resolved yet will return post-write data anyway, and a second
  // socket for the same URL is the thing this module exists to prevent.
  if (entry.inflight) return entry.inflight;

  const fresh =
    !entry.stale && entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < staleTime;
  if (!opts.force && fresh) return Promise.resolve();

  const run = (async () => {
    try {
      const response = await fetch(key);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "فشل في تحميل البيانات");
      }
      entry.data = body?.data ?? body;
      entry.error = undefined;
    } catch (err) {
      // No abort handling: a request is shared now, so one component unmounting
      // must not cancel what the others are waiting on. The cost is a response
      // nobody reads after a fast navigation; the benefit is not re-fetching
      // the same URL for every mount.
      entry.error = err instanceof Error ? err.message : "خطأ غير معروف";
    } finally {
      entry.fetchedAt = Date.now();
      entry.stale = false;
      entry.inflight = undefined;
      notify(entry);
    }
  })();

  entry.inflight = run;
  // Tell subscribers a request opened, so they can show a spinner.
  notify(entry);
  return run;
}

/**
 * Mark keys stale so the next read goes to the network.
 *
 * `prefix` matches the start of the key, which is the URL — so
 * `invalidate("/api/orders")` covers every query string over that resource.
 * Called with no argument it invalidates everything, which is what signing in
 * or out should do.
 */
export function invalidate(prefix?: string): void {
  for (const [key, entry] of cache) {
    if (prefix && !key.startsWith(prefix)) continue;
    // The data stays readable while the refetch runs — see `Entry.stale`.
    entry.stale = true;
  }
}

/** Drop everything, data included — for a sign-out, where staleness is not the
 *  issue but the previous user's data sitting in memory is. */
export function clearCache(): void {
  for (const entry of cache.values()) notify(entry);
  cache.clear();
}

/** Test/diagnostic hook: how many distinct keys are held. */
export function cacheSize(): number {
  return cache.size;
}
