'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

/**
 * Search + filters for every patient browse screen.
 *
 * The patient equivalent of the admin `DataTable` toolbar. Six screens were
 * each hand-rolling a search box and a row of chips — and three of those boxes
 * had no state behind them at all, so they filtered nothing while looking like
 * they worked.
 *
 * State lives in the URL. That is what makes the back button behave, makes a
 * filtered list shareable, and lets the sign-in round trip return someone to
 * the exact list they were reading.
 */

export type FacetOption = { value: string; label: string };

export type Facet = {
  /** URL parameter name, also the API's query key. */
  key: string;
  label: string;
  options: FacetOption[];
};

export type BrowseState = {
  q: string;
  /** Selected value per facet key; absent means "all". */
  facets: Record<string, string>;
};

/** Debounce, so typing does not fire a request per keystroke over 3G. */
function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Owns the browse state and keeps it in the URL.
 *
 * Returns `params` ready to hand straight to `useInfiniteList` — the debounced
 * query, not the raw one, so the input stays responsive while the fetch waits.
 */
export function useBrowseState(facets: Facet[] = []) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const debouncedQ = useDebounced(q);

  // Read once on mount. Not kept in sync afterwards: the component owns the
  // state from here, and re-reading would fight the user's own typing.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp.get('q') ?? '');
    const next: Record<string, string> = {};
    for (const f of facets) {
      const v = sp.get(f.key);
      if (v) next[f.key] = v;
    }
    setSelected(next);
    // Facets are a static config per screen; re-running on identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `replaceState`, not push: every keystroke would otherwise add a history
  // entry, and the back button would walk letter by letter out of the search.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    debouncedQ ? sp.set('q', debouncedQ) : sp.delete('q');
    for (const f of facets) {
      const v = selected[f.key];
      v ? sp.set(f.key, v) : sp.delete(f.key);
    }
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, selected]);

  const params = useMemo(
    () => ({ q: debouncedQ || undefined, ...selected }),
    [debouncedQ, selected]
  );

  const setFacet = useCallback((key: string, value: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      // Tapping the active chip clears it — a filter you cannot remove is a trap.
      if (!value || prev[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setQ('');
    setSelected({});
  }, []);

  const activeCount = Object.keys(selected).length + (q ? 1 : 0);

  return { q, setQ, selected, setFacet, clearAll, params, activeCount };
}

export function BrowseToolbar({
  placeholder = 'ابحث...',
  facets = [],
  /** The first facet renders as a chip row; the rest live in the sheet. */
  state,
}: {
  placeholder?: string;
  facets?: Facet[];
  state: ReturnType<typeof useBrowseState>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { q, setQ, selected, setFacet, clearAll, activeCount } = state;

  const [primary, ...rest] = facets;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 px-4">
        <div className="relative flex-1">
          <label htmlFor="browse-search" className="sr-only">
            {placeholder}
          </label>
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-gray-400">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <input
            id="browse-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-[52px] w-full rounded-2xl border border-gray-200 bg-white ps-12 pe-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
        </div>

        {rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`الفلاتر${activeCount ? ` (${activeCount} مفعّل)` : ''}`}
            className="relative flex h-[52px] w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition-transform hover:border-primary/50 hover:text-primary active:scale-95"
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            {activeCount > 0 ? (
              <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {/* Primary facet as a horizontal chip row — the one people actually use. */}
      {primary ? (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar">
          <Chip active={!selected[primary.key]} onClick={() => setFacet(primary.key, '')}>
            {primary.label}
          </Chip>
          {primary.options.map((o) => (
            <Chip
              key={o.value}
              active={selected[primary.key] === o.value}
              onClick={() => setFacet(primary.key, o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      ) : null}

      {activeCount > 0 ? (
        <div className="px-4">
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition-colors hover:text-gray-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            مسح الفلاتر
          </button>
        </div>
      ) : null}

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-extrabold">الفلاتر</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 pb-8">
            {rest.map((f) => (
              <fieldset key={f.key}>
                <legend className="mb-2 text-sm font-bold text-gray-700">{f.label}</legend>
                <div className="flex flex-wrap gap-2">
                  <Chip active={!selected[f.key]} onClick={() => setFacet(f.key, '')}>
                    الكل
                  </Chip>
                  {f.options.map((o) => (
                    <Chip
                      key={o.value}
                      active={selected[f.key] === o.value}
                      onClick={() => setFacet(f.key, o.value)}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        active
          ? 'bg-primary text-white shadow-sm shadow-primary/20'
          : 'border border-gray-200 bg-white text-gray-600 hover:border-primary/50'
      }`}
    >
      {children}
    </button>
  );
}
