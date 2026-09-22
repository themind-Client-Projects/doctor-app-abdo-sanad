"use client";

import { fieldClass } from "@/components/data/form-dialog";

/**
 * The search box and dropdowns for a list whose filtering happens on the SERVER.
 *
 * Promoted out of /admin/blood-bank, where it was written first. `DataTable`'s
 * own search narrows the rows already loaded — right for a short list, and
 * silently wrong for a paged one, which only ever searches the first page. The
 * screens that page (blood bank, users, coupons, memberships) need this shape
 * instead, and four local copies of it would drift the way the labels did.
 *
 * Pair it with `useServerFilters`: this renders the controls, that hook holds
 * the values and debounces them into `params` for `useDashboardData`.
 */

export type ServerFilterSelect = {
  key: string;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
};

export function ServerFilterBar({
  idPrefix,
  search,
  selects = [],
  values,
  onChange,
  isActive,
  onReset,
}: {
  /** Keeps element ids unique when two bars share a page. */
  idPrefix: string;
  /** The free-text field, stored under the `q` key. Omit for no search box. */
  search?: { placeholder: string };
  selects?: ServerFilterSelect[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  isActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 lg:flex-row lg:items-center">
      {search ? (
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idPrefix}-q`} className="sr-only">
            {search.placeholder}
          </label>
          <input
            id={`${idPrefix}-q`}
            type="search"
            value={values.q ?? ""}
            onChange={(e) => onChange("q", e.target.value)}
            placeholder={search.placeholder}
            className={fieldClass}
          />
        </div>
      ) : null}

      {selects.map((select) => (
        <div key={select.key} className="shrink-0">
          <label htmlFor={`${idPrefix}-${select.key}`} className="sr-only">
            {select.label}
          </label>
          <select
            id={`${idPrefix}-${select.key}`}
            value={values[select.key] ?? ""}
            onChange={(e) => onChange(select.key, e.target.value)}
            className={`${fieldClass} w-auto min-w-[9rem]`}
          >
            <option value="">{select.placeholder}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {isActive ? (
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          مسح
        </button>
      ) : null}
    </div>
  );
}
