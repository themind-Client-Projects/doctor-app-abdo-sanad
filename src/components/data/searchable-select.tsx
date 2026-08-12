"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * A `<select>` you can type into.
 *
 * A plain select stops being usable somewhere around thirty options, and the
 * pickers that matter here — the medical complex a partner belongs to, the
 * partner a rule is written for — grow with the business. This keeps the same
 * shape as the other form controls (`fieldClass`) so a form does not visibly
 * change character when one field gains search.
 *
 * No combobox library: the app already carries two dialog implementations, and
 * a third dependency for one control would cost more than it saves.
 *
 * The accessible parts, which are the ones easy to get wrong:
 * `role="combobox"` with `aria-expanded` / `aria-controls` / `aria-activedescendant`,
 * a `listbox` of `option`s, arrow-key navigation with the active option scrolled
 * into view, Enter to choose, Escape to close, and a click outside that closes
 * without selecting.
 */
export type SelectOption = {
  value: string;
  label: string;
  /** Second line — a type, a governorate, anything that disambiguates. */
  hint?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "— اختر —",
  searchPlaceholder = "ابحث...",
  emptyMessage = "لا نتائج",
  disabled,
  clearable = true,
}: {
  id?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Matches the hint too: "مختبر" should find a partner whose label is a name
    // and whose type is the thing being searched for.
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)
    );
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  // A click outside closes WITHOUT selecting — abandoning a picker must not
  // commit whatever happened to be highlighted.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange(option.value);
      close();
    },
    [onChange, close]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (filtered.length === 0) return;
      setActive((i) =>
        e.key === "ArrowDown"
          ? (i + 1) % filtered.length
          : (i - 1 + filtered.length) % filtered.length
      );
      return;
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={controlId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-start text-sm text-foreground outline-none transition-shadow focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground/70"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="مسح الاختيار"
              onClick={(e) => {
                // Clearing must not also toggle the popover open.
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} aria-hidden />
            </span>
          ) : null}
          <ChevronDown size={16} aria-hidden className="text-muted-foreground" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="relative border-b border-border">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={
                filtered[active] ? `${listId}-${filtered[active].value}` : undefined
              }
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none ps-9 pe-3"
            />
          </div>

          <ul ref={listRef} id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    id={`${listId}-${o.value}`}
                    role="option"
                    aria-selected={o.value === value}
                    data-index={i}
                    disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-start text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      i === active ? "bg-accent" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{o.label}</span>
                      {o.hint ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.hint}
                        </span>
                      ) : null}
                    </span>
                    {o.value === value ? (
                      <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
