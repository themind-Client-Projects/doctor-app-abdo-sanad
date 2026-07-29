"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The small pieces every admin CRUD screen repeats: page header with a primary
 * action, row edit/delete buttons, a status pill, and a stat tile.
 *
 * Kept together because they are only meaningful as a set — a screen that uses
 * `PageHeader` uses `RowActions` too. Splitting them into five files would add
 * imports without adding clarity.
 */

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          {Icon ? <Icon size={20} className="shrink-0 text-primary" aria-hidden="true" /> : null}
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} aria-hidden="true" />
          {action.label}
        </button>
      ) : null}
    </header>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  label,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Names the row, so screen readers hear "تعديل د. أحمد" not just "تعديل". */
  label: string;
}) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`تعديل ${label}`}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`حذف ${label}`}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export type PillTone = "positive" | "warning" | "danger" | "info" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  neutral: "bg-muted text-muted-foreground",
};

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Tone for the status values shared across Partner / ServiceConfig / Invoice. */
export function toneForStatus(status: string): PillTone {
  switch (status) {
    case "ACTIVE":
    case "REACTIVATED":
    case "paid":
      return "positive";
    case "PAUSED":
    case "PENDING":
    case "pending":
      return "warning";
    case "SUSPENDED":
    case "overdue":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
