"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Root error boundary.
 *
 * The app previously had zero error.tsx files, so any thrown error fell
 * through to Next's raw, unstyled, LTR default page inside an RTL Arabic app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Until an error tracker is wired up (see IMPLEMENTATION_PLAN.md), at least
    // make the failure visible instead of swallowing it.
    console.error("[ui] unhandled error", error);
  }, [error]);

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          تعذّر تحميل هذه الصفحة. يمكنك المحاولة مرة أخرى.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70" dir="ltr">
            {error.digest}
          </p>
        ) : null}

        <button
          onClick={reset}
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCw size={16} aria-hidden="true" />
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
