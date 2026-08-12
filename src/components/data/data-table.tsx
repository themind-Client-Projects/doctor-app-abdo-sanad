"use client";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

/**
 * The one table shell every admin CRUD screen uses.
 *
 * It exists because twelve screens each hand-rolled "search box + status pills
 * + table + loading + empty", no two the same, and each new screen added a
 * thirteenth variant. Everything a list screen needs is a prop here:
 * search, dropdown filters, sorting, pagination, row actions, toolbar.
 *
 * Three defects it fixes by construction, all of which shipped in the old
 * hand-rolled tables:
 *  - the body **scrolls** horizontally. 18 of 20 tables sat inside
 *    `overflow-hidden`, which CLIPPED columns with no scroll affordance and
 *    silently hid data on narrow screens;
 *  - it renders `error` as an error. Screens destructured only
 *    `{data, isLoading}`, so a 401 or a 500 looked exactly like an empty list;
 *  - long lists paginate, so a partner with 800 transactions does not mount
 *    800 rows.
 *
 * Performance: filtering/sorting/paging are one `useMemo` chain keyed on the
 * inputs, the query is deferred so typing never blocks on a large list, and
 * rows are a memoized component so re-rendering the page does not re-render
 * every cell.
 */

export type Column<T> = {
  key: string;
  header: string;
  /** Defaults to `String(row[key])`. */
  render?: (row: T) => React.ReactNode;
  /** Hidden below `md` — use for secondary columns on narrow screens. */
  secondary?: boolean;
  align?: "start" | "end";
  /** Value to sort on. Provide to make the header clickable. */
  sortValue?: (row: T) => string | number;
};

export type FilterDef<T> = {
  key: string;
  /** Shown as the "all" option, e.g. "كل الحالات". */
  label: string;
  options: { value: string; label: string }[];
  /** True when the row should survive the chosen value. */
  match: (row: T, value: string) => boolean;
};

const PAGE_SIZE = 25;

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  isLoading,
  error,
  onRetry,
  searchable,
  searchPlaceholder = "بحث...",
  filters,
  emptyMessage = "لا توجد بيانات بعد",
  actions,
  toolbar,
  pageSize = PAGE_SIZE,
}: {
  rows: T[] | null | undefined;
  columns: Column<T>[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Text to match a query against. Omit to hide the search box entirely —
   *  a search input that filters nothing is worse than none. */
  searchable?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  emptyMessage?: string;
  actions?: (row: T) => React.ReactNode;
  toolbar?: React.ReactNode;
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);

  // Keeps typing responsive: the input updates immediately, the (potentially
  // large) filter pass runs against the deferred value.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    let list = rows ?? [];

    if (filters) {
      for (const f of filters) {
        const value = active[f.key];
        if (value) list = list.filter((r) => f.match(r, value));
      }
    }

    const q = deferredQuery.trim().toLowerCase();
    if (searchable && q) {
      list = list.filter((r) => searchable(r).toLowerCase().includes(q));
    }
    return list;
  }, [rows, filters, active, deferredQuery, searchable]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    // Copy first — `filtered` may be the caller's array when nothing filtered.
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ar") * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  // Filtering down to fewer pages while on a later page would otherwise strand
  // the user on a blank page.
  useEffect(() => {
    setPage(1);
  }, [deferredQuery, active, sort]);

  const toggleSort = useCallback((key: string) => {
    setSort((s) =>
      s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null
    );
  }, []);

  const hasFilterApplied = query.trim() !== "" || Object.values(active).some(Boolean);
  const clearAll = useCallback(() => {
    setQuery("");
    setActive({});
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card">
      {(searchable || filters?.length || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
          {searchable ? (
            <div className="relative min-w-0 flex-1">
              <label htmlFor="table-search" className="sr-only">
                {searchPlaceholder}
              </label>
              <Search
                size={15}
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="table-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-xl border border-input bg-background pe-9 ps-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
            </div>
          ) : null}

          {filters?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`filter-${f.key}`} className="sr-only">
                    {f.label}
                  </label>
                  <select
                    id={`filter-${f.key}`}
                    value={active[f.key] ?? ""}
                    onChange={(e) =>
                      setActive((a) => ({ ...a, [f.key]: e.target.value }))
                    }
                    className={`h-10 rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10 ${
                      active[f.key]
                        ? "border-primary/50 text-foreground"
                        : "border-input text-muted-foreground"
                    }`}
                  >
                    <option value="">{f.label}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {hasFilterApplied ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X size={14} />
                  مسح
                </button>
              ) : null}
            </div>
          ) : null}

          {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <AlertCircle size={20} className="text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">
            {typeof error === "string" ? error : "تعذّر تحميل البيانات"}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              إعادة المحاولة
            </button>
          ) : null}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          جاري التحميل...
        </div>
      ) : paged.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          {hasFilterApplied ? "لا نتائج مطابقة" : emptyMessage}
        </p>
      ) : (
        // Scrolls rather than clips — a 7-column table cannot fit a phone.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      sort?.key === c.key
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={`px-4 py-2.5 font-medium ${
                      c.align === "end" ? "text-end" : "text-start"
                    } ${c.secondary ? "hidden md:table-cell" : ""}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                          sort?.key === c.key ? "text-foreground" : ""
                        }`}
                      >
                        {c.header}
                        <ChevronsUpDown size={12} aria-hidden="true" />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {actions ? (
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    إجراءات
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((row) => (
                <Row key={row.id} row={row} columns={columns} actions={actions} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && sorted.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {sorted.length === (rows ?? []).length
              ? `${sorted.length} سجل`
              : `${sorted.length} من ${(rows ?? []).length}`}
          </span>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <PageButton
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                label="السابق"
              >
                {/* RTL: "previous" points right */}
                <ChevronRight size={14} />
              </PageButton>
              <span className="px-2 tabular-nums">
                {safePage} / {pageCount}
              </span>
              <PageButton
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage === pageCount}
                label="التالي"
              >
                <ChevronLeft size={14} />
              </PageButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- row ---------------------------------- */

// Memoized so a parent re-render (dialog open, toast, poll) does not re-run
// every cell's `render` for every visible row.
const Row = memo(function Row<T extends { id: string }>({
  row,
  columns,
  actions,
}: {
  row: T;
  columns: Column<T>[];
  actions?: (row: T) => React.ReactNode;
}) {
  return (
    <tr className="transition-colors hover:bg-muted/40">
      {columns.map((c) => (
        <td
          key={c.key}
          className={`px-4 py-3 ${c.align === "end" ? "text-end" : "text-start"} ${
            c.secondary ? "hidden md:table-cell" : ""
          }`}
        >
          {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
        </td>
      ))}
      {actions ? <td className="px-4 py-3 text-end">{actions(row)}</td> : null}
    </tr>
  );
}) as <T extends { id: string }>(props: {
  row: T;
  columns: Column<T>[];
  actions?: (row: T) => React.ReactNode;
}) => React.ReactElement;

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg border border-border p-1.5 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
