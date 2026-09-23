"use client";

import { memo } from "react";
import { fieldClass } from "@/components/data/form-dialog";

// ─────────────────────────────────────────────────────────────
// نتائج الفحص — the measurements on a lab sample.
//
// `LabSample.results` is a Json OBJECT (the endpoint validates it as
// `z.record(z.string(), jsonValue)`), which is the right storage shape and the
// wrong editing shape: an object has no order and cannot hold a half-typed key.
// So the editor works on rows and converts once, on submit.
//
// Kept deliberately plain — name, value, and an optional reference range, which
// is what a result slip carries. Anything richer belongs to a structured test
// catalogue the platform does not have yet, and inventing one here would put
// fields on screen that nothing reads back.
// ─────────────────────────────────────────────────────────────

export type ResultRow = {
  name: string;
  value: string;
  /** "3.5 – 5.1 mmol/L" — printed beside the value so it can be read. */
  reference?: string;
};

/** A name with no value is a row somebody started and did not finish. */
export function resultsComplete(rows: readonly ResultRow[]): boolean {
  return (
    rows.length > 0 && rows.every((r) => r.name.trim() !== "" && r.value.trim() !== "")
  );
}

/** Rows → the Json object the server stores. */
export function toResultsObject(rows: readonly ResultRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const reference = row.reference?.trim();
    out[name] = reference ? { value: row.value.trim(), reference } : row.value.trim();
  }
  return out;
}

/**
 * The stored Json → rows, tolerating both shapes.
 *
 * Older samples stored a bare scalar per test; newer ones store
 * `{ value, reference }`. A malformed row must render as "no results", never
 * throw — this is a Json column, so anything at all could be in it.
 */
export function readResults(value: unknown): ResultRow[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>).map(([name, raw]) => {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const obj = raw as { value?: unknown; reference?: unknown };
      return {
        name,
        value: obj.value === undefined || obj.value === null ? "" : String(obj.value),
        reference: typeof obj.reference === "string" ? obj.reference : undefined,
      };
    }
    return { name, value: raw === null || raw === undefined ? "" : String(raw) };
  });
}

export const ResultRows = memo(function ResultRows({
  value,
  onChange,
  disabled,
}: {
  value: readonly ResultRow[];
  onChange: (next: ResultRow[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<ResultRow>) =>
    onChange(value.map((r, index) => (index === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">القياسات</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, { name: "", value: "" }])}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          إضافة قياس
        </button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          لا قياسات بعد — النتيجة لا تُحفظ فارغة
        </p>
      ) : null}

      <div className="space-y-2">
        {value.map((row, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">قياس {i + 1}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, index) => index !== i))}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                aria-label={`إزالة القياس ${i + 1}`}
              >
                إزالة
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className={fieldClass}
                placeholder="اسم الفحص — Hemoglobin"
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={120}
                disabled={disabled}
                aria-label={`اسم الفحص ${i + 1}`}
              />
              <input
                className={fieldClass}
                placeholder="القيمة — 13.4"
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                maxLength={120}
                disabled={disabled}
                aria-label={`قيمة الفحص ${i + 1}`}
              />
              <input
                className={fieldClass}
                placeholder="المدى الطبيعي (اختياري)"
                value={row.reference ?? ""}
                onChange={(e) => update(i, { reference: e.target.value })}
                maxLength={120}
                disabled={disabled}
                aria-label={`المدى الطبيعي ${i + 1}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/** The same measurements, read-only — what a doctor or operations opens. */
export function ResultList({ value }: { value: readonly ResultRow[] }) {
  if (value.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        لم تُسجَّل نتيجة بعد
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {value.map((row, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2">
          <span className="min-w-0 truncate text-sm text-foreground">{row.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground" dir="ltr">
            {row.value}
            {row.reference ? (
              <span className="mr-2 text-xs font-normal text-muted-foreground">
                ({row.reference})
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
