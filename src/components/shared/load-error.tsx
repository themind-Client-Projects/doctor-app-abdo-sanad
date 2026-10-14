'use client';

/**
 * "The request failed" — said out loud, instead of as an empty list.
 *
 * `useDashboardData` resolves a failed fetch to `{ isLoading: false, data: null,
 * error: "…" }`, which is indistinguishable from a genuinely empty result
 * unless the caller reads `error`. Six patient screens destructured it and
 * never read it, so a 500 rendered «لا يوجد أطباء متاحين» — the app told the
 * patient the platform had no doctors.
 *
 * The markup is lifted from the three screens that already got this right
 * (حجوزاتي, العروض, المحفظة) so the behaviour is one idiom rather than six.
 *
 * ONE RULE FOR CALLERS, and it is the whole reason this takes a `rows` count
 * rather than just `error`: show this only when the fetch failed AND there is
 * nothing to show. `useDashboardData` revalidates in the background and keeps
 * serving cached rows (`src/hooks/use-dashboard-data.ts`), so a screen holding
 * good data whose next poll fails must keep displaying it. Use `loadFailed`
 * below, never a bare `error !== null`.
 */
export function loadFailed(error: unknown, rowCount: number): boolean {
  return error != null && rowCount === 0;
}

export function LoadError({
  message,
  onRetry,
}: {
  /** What failed to load, in the screen's own words: «تعذّر تحميل قائمة الأطباء». */
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-gray-500 font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-primary font-bold"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
