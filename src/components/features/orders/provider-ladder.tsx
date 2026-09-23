"use client";

import { memo, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import type { TimelineStep } from "@/hooks/use-order-actions";

// ─────────────────────────────────────────────────────────────
// The rung a provider presses next.
//
// The nurse's visits screen and the driver's trips screen each hard-coded three
// buttons keyed off `order.status` — في الطريق / وصلت / بدء التنفيذ — which left
// two of the six provider steps unreachable from anywhere in the app:
//
//   • **تم التواصل** (step 4) sits between ASSIGNED and IN_TRANSIT and shares
//     the ASSIGNED status with step 3, so a status-keyed ladder cannot express
//     it. Skipping it is not harmless: `advanceOrder` refuses a step whose
//     predecessors are missing, so pressing "في الطريق" first is a 409 and the
//     order can never leave ASSIGNED.
//   • **تم إنهاء الخدمة** (step 8) is how a visit ends. Without it a nurse who
//     finished at the patient's home left the order reading "بدأ التنفيذ"
//     forever, and operations could not complete it.
//
// So the ladder is driven by the TIMELINE, which the orders list already
// returns, not by the status: the next rung is `max(completed) + 1`, exactly
// the one the server will accept. Steps 1-3 and 10-11 are operations' — a
// provider is told who they are waiting on rather than shown a button that
// answers 403.
// ─────────────────────────────────────────────────────────────

/** Step number → what a provider presses. Mirrors `TIMELINE_STEPS`. */
const PROVIDER_RUNGS: Record<number, { code: TimelineStep; label: string; asks: boolean }> = {
  4: { code: "CONTACTED", label: "تم التواصل", asks: false },
  5: { code: "IN_TRANSIT", label: "في الطريق", asks: false },
  6: { code: "ARRIVED", label: "وصلت", asks: false },
  7: { code: "STARTED", label: "بدء التنفيذ", asks: false },
  // Finishing is when there is something to say about what was done, so this
  // one collects a note. The travel rungs stay one press — a driver at the
  // wheel should not be filling a form.
  8: { code: "SERVICE_DONE", label: "إنهاء الخدمة", asks: true },
  9: { code: "RESULTS_UPLOADED", label: "رفع النتائج", asks: true },
};

export type TimelineRow = { step: number };

/** The rung this order is waiting on, or why there is none for a provider. */
export function nextRung(timeline: readonly TimelineRow[] | null | undefined) {
  const completed = timeline?.length ? Math.max(...timeline.map((t) => t.step)) : 0;
  return PROVIDER_RUNGS[completed + 1] ?? null;
}

export const ProviderLadder = memo(function ProviderLadder({
  timeline,
  disabled,
  label,
  onAdvance,
}: {
  timeline: readonly TimelineRow[] | null | undefined;
  disabled?: boolean;
  /** Names the row for screen readers — six identical buttons say nothing. */
  label: string;
  onAdvance: (step: TimelineStep, description?: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const rung = useMemo(() => nextRung(timeline), [timeline]);

  if (!rung) {
    const completed = timeline?.length ? Math.max(...timeline.map((t) => t.step)) : 0;
    return (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {completed >= 9 ? "بانتظار الإكمال من العمليات" : "بانتظار الإسناد من العمليات"}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (rung.asks ? setAsking(true) : onAdvance(rung.code))}
        aria-label={`${label} — تسجيل: ${rung.label}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={12} aria-hidden />
        {rung.label}
      </button>

      {asking ? (
        <NoteDialog
          title={rung.label}
          description={label}
          isPending={disabled}
          onClose={() => setAsking(false)}
          onConfirm={(note) => {
            setAsking(false);
            onAdvance(rung.code, note);
          }}
        />
      ) : null}
    </>
  );
});

function NoteDialog({
  title,
  description,
  isPending,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <FormDialog
      open
      title={title}
      description={description}
      onClose={onClose}
      onSubmit={() => onConfirm(note.trim() || undefined)}
      isPending={isPending}
      submitLabel="تسجيل"
    >
      <Field
        label="ملاحظة"
        htmlFor="rung-note"
        hint="اختياري — تُحفظ على سجل الطلب ويراها المريض"
      >
        <textarea
          id="rung-note"
          className={`${fieldClass} h-24 py-2.5`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="ما الذي تم؟"
        />
      </Field>
    </FormDialog>
  );
}
