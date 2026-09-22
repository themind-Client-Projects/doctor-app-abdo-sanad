"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Modal used by the admin CRUD screens for create / edit / delete-confirm.
 *
 * Deliberately small rather than pulling in a dialog library: the app already
 * carries two (@base-ui and Radix via the ported primitives), and a third
 * pattern for one modal shape would be worse than a focused component.
 *
 * Accessibility is the part that is easy to get wrong and is handled here:
 * `role="dialog"` + `aria-modal`, a labelled title, Escape to close, focus
 * moved in on open and restored on close, and a focus trap so Tab cannot
 * wander into the page behind.
 */
export function FormDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel = "حفظ",
  submitTone = "primary",
  isPending,
  submitDisabled,
  readOnly = false,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitTone?: "primary" | "danger";
  isPending?: boolean;
  /**
   * Blocks submit while the form is not yet valid.
   *
   * For rules the server will reject outright — a commission split that does
   * not total 100%, say — refusing here is kinder than sending a request whose
   * only possible answer is an error toast.
   */
  submitDisabled?: boolean;
  /**
   * A view, not a form: one "إغلاق" button and no <form> element.
   *
   * For a detail panel there is nothing to submit, and rendering a form anyway
   * produced two buttons that both closed it. Just as important, it means a
   * panel can hold its own actions without nesting a <form> inside a <form> —
   * where React bubbles the inner submit up to the outer handler.
   */
  readOnly?: boolean;
  children?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    // Focus the first control so a keyboard user lands inside the dialog.
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button"
    );
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling under the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Only a click on the backdrop itself closes — not a drag that ends there.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-dialog-title"
        dir="rtl"
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="form-dialog-title" className="text-base font-bold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {readOnly ? (
          <>
            <div className="space-y-4">{children}</div>
            <div className="mt-6">
              <button
                type="button"
                onClick={onClose}
                className="h-11 w-full rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                إغلاق
              </button>
            </div>
          </>
        ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-4">{children}</div>

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={isPending || submitDisabled}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                submitTone === "danger"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              إلغاء
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- fields --------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-4 focus:ring-primary/10";
