"use client";

import { memo } from "react";
import { ArrowLeft, Check, CircleDot, Loader2 } from "lucide-react";
import type { TimelineStep } from "@/hooks/use-order-actions";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// متابعة التنفيذ — 11 خطوة (req L384-407)
//
// The ladder now comes from GET /api/orders/[id]/advance, which returns all 11
// rungs with their completion state. Previously the component held its own copy
// of the step titles and matched them against `step.isCompleted` — a field the
// API has never returned — so every rung rendered as pending no matter how far
// the order had actually progressed.
// ─────────────────────────────────────────────────────────────

export type LadderStep = {
  step: number;
  code: TimelineStep;
  title: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  description: string | null;
};

interface TimelineProps {
  steps: LadderStep[];
  /** Records the next rung. Omit for a read-only view. */
  onAdvance?: (code: TimelineStep) => void;
  isPending?: boolean;
  /** Set on a cancelled order: history stays visible, nothing may advance. */
  frozen?: boolean;
}

function TimelineImpl({ steps, onAdvance, isPending, frozen }: TimelineProps) {
  // The server refuses gaps, so exactly one rung is actionable: the first that
  // is not yet done.
  const nextStep = steps.find((s) => !s.completed) ?? null;

  return (
    <ol className="space-y-0">
      {steps.map((s, index) => {
        const isNext = !frozen && nextStep?.step === s.step;
        // Step 11 is deliberately not advanceable — it must go through the
        // completion action so the revenue is distributed.
        const canAdvance = isNext && s.code !== "COMPLETED" ? onAdvance : undefined;

        return (
          <li key={s.step} className="relative flex items-start gap-3 pb-6 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={`absolute top-6 h-full w-0.5 start-[11px] ${
                  s.completed ? "bg-primary" : "bg-border"
                }`}
              />
            ) : null}

            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                s.completed
                  ? "bg-primary text-primary-foreground"
                  : isNext
                    ? "border-2 border-primary bg-card text-primary"
                    : "border-2 border-border bg-card text-border"
              }`}
            >
              {s.completed ? <Check size={12} /> : <CircleDot size={10} />}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={`text-sm ${
                  s.completed
                    ? "font-medium text-foreground"
                    : isNext
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {s.title}
              </p>

              {s.completedAt ? (
                <p className="text-xs text-muted-foreground">{formatDateTime(s.completedAt)}</p>
              ) : null}

              {s.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
              ) : null}

              {canAdvance ? (
                <button
                  type="button"
                  onClick={() => canAdvance(s.code)}
                  disabled={isPending}
                  aria-label={`تسجيل: ${s.title}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ArrowLeft size={12} />
                  )}
                  تسجيل هذه الخطوة
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Memoized against the parent's own state — the tracking page has a search box,
// and typing in it should not re-render 11 rungs per keystroke. (It cannot help
// with polling: each response is a fresh array.)
export const Timeline = memo(TimelineImpl);
