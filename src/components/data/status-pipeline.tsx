"use client";

import { memo, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Pill, type PillTone } from "@/components/data/crud-kit";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Shared worklist plumbing.
//
// Five operations screens are the same screen: a queue of clinical items whose
// one and only mutation is moving a row along a fixed ladder — lab samples,
// radiology requests, prescriptions, Sanad sessions, blood bank cases. Each had
// its own hand-rolled pipeline strip and its own `<table>`, and none of them
// could actually change a status.
//
// So: one description of a ladder, and two pieces that read it.
// ─────────────────────────────────────────────────────────────

export type Stage = {
  /** The value stored in the DB — these columns are free-text, not enums. */
  key: string;
  label: string;
  tone: PillTone;
};

/** A stage's label, falling back to the raw value rather than blanking it. */
export function stageLabel(stages: readonly Stage[], value: string | null | undefined): string {
  if (!value) return "—";
  return stages.find((s) => s.key === value)?.label ?? value;
}

export function stageTone(stages: readonly Stage[], value: string | null | undefined): PillTone {
  return stages.find((s) => s.key === value)?.tone ?? "neutral";
}

/** `FilterDef` options for a ladder. */
export function stageOptions(stages: readonly Stage[]): { value: string; label: string }[] {
  return stages.map((s) => ({ value: s.key, label: s.label }));
}

/**
 * The count of rows sitting at each stage.
 *
 * Counting in one pass over the rows rather than one `filter` per stage, which
 * is what the lab screen did — six passes over the list on every render.
 */
export function useStageCounts<T>(
  rows: T[] | null | undefined,
  stages: readonly Stage[],
  statusOf: (row: T) => string
): Record<string, number> {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stages) counts[s.key] = 0;
    for (const row of rows ?? []) {
      const key = statusOf(row);
      if (key in counts) counts[key] += 1;
    }
    return counts;
    // `statusOf` is expected to be a module-level function or memoized by the
    // caller; the ladder is a module constant.
  }, [rows, stages, statusOf]);
}

/* -------------------------------------------------------------------------- */

/** The horizontal "how many are at each stage" strip. */
export const PipelineStrip = memo(function PipelineStrip({
  stages,
  counts,
  active,
  onSelect,
}: {
  stages: readonly Stage[];
  counts: Record<string, number>;
  /** Currently filtered stage, if the strip doubles as a filter. */
  active?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2 hide-scrollbar">
      {stages.map((stage, i) => {
        const count = counts[stage.key] ?? 0;
        const isActive = active === stage.key;
        const content = (
          <>
            <span className="mb-1.5 text-lg font-bold tabular-nums text-foreground">
              {formatNumber(count)}
            </span>
            <span className="text-center text-xs font-medium text-muted-foreground">
              {stage.label}
            </span>
          </>
        );

        return (
          <div key={stage.key} className="flex items-center">
            {onSelect ? (
              <button
                type="button"
                // Clicking a stage filters the table to it — the strip was
                // previously decorative, and the number it showed was the one
                // thing an employee wanted to click.
                onClick={() => onSelect(isActive ? null : stage.key)}
                aria-pressed={isActive}
                className={`flex min-w-[116px] flex-col items-center rounded-xl border p-3.5 transition-colors ${
                  isActive
                    ? "border-[hsl(var(--primary))] bg-primary/5"
                    : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                {content}
              </button>
            ) : (
              <div className="flex min-w-[116px] flex-col items-center rounded-xl border border-border bg-card p-3.5">
                {content}
              </div>
            )}
            {i < stages.length - 1 ? (
              // Flipped for RTL: the ladder runs right to left.
              <ChevronLeft size={16} aria-hidden className="mx-1 shrink-0 text-muted-foreground" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

/* -------------------------------------------------------------------------- */

/**
 * The in-row control that moves an item to the next stage.
 *
 * A button rather than a `<select>`: these ladders are walked forward one rung
 * at a time, and offering all six stages invites skipping five of them. The
 * current stage is shown beside it so the row still reads as a status.
 */
export const StageAdvance = memo(function StageAdvance({
  stages,
  current,
  onAdvance,
  disabled,
  label,
}: {
  stages: readonly Stage[];
  current: string;
  onAdvance: (nextKey: string) => void;
  disabled?: boolean;
  /** Names the row for screen readers — "التالي" ten times says nothing. */
  label: string;
}) {
  const index = stages.findIndex((s) => s.key === current);
  const next = index >= 0 ? stages[index + 1] : undefined;

  const handle = useCallback(() => {
    if (next) onAdvance(next.key);
  }, [next, onAdvance]);

  if (!next) {
    return (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {index >= 0 ? "اكتملت المراحل" : "حالة غير معروفة"}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      aria-label={`${label} — نقل إلى: ${next.label}`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ChevronLeft size={12} aria-hidden />
      {next.label}
    </button>
  );
});

/** The stage as a pill, for a table's status column. */
export function StagePill({
  stages,
  value,
}: {
  stages: readonly Stage[];
  value: string | null | undefined;
}) {
  return <Pill tone={stageTone(stages, value)}>{stageLabel(stages, value)}</Pill>;
}
