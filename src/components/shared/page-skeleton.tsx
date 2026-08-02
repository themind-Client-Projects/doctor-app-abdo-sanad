/**
 * Route-level loading UI for the patient app.
 *
 * Distinct from the in-page skeletons already in the browse screens: those
 * cover the DATA fetch, this covers the gap BEFORE the component exists — the
 * route's JavaScript being downloaded and parsed. On a slow Iraqi mobile
 * connection that gap is the visible one, and without a `loading.tsx` the
 * previous page simply freezes with no feedback that a tap registered.
 *
 * A server component on purpose: it ships as part of the shell, so it can paint
 * before any client bundle has loaded. Adding `"use client"` here would make it
 * wait for the very thing it exists to cover.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24" aria-busy="true" aria-live="polite">
      <span className="sr-only">جاري التحميل</span>

      {/* Header */}
      <div className="bg-white px-5 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="mt-4 h-12 w-full rounded-2xl bg-gray-100 animate-pulse" />
      </div>

      <div className="px-5 mt-6 space-y-4">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 shrink-0 rounded-full bg-gray-100 animate-pulse" />
          ))}
        </div>

        {/* Cards. Staggered so it reads as loading rather than as a frozen
            block of identical grey boxes. */}
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-28 rounded-3xl border border-gray-100 bg-white animate-pulse"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
