'use client';

import { Loader2, SearchX } from 'lucide-react';

/**
 * The list half of the browse kit: results, the scroll sentinel, and every
 * state a list can be in.
 *
 * Those states are the point. The hand-rolled lists this replaces conflated
 * "still loading" with "nothing found" — an empty array during the first fetch
 * rendered "لا يوجد أطباء", which reads as a broken app rather than a slow one.
 * Here loading, error, empty-because-filtered and empty-because-empty are four
 * different things and say four different things.
 */
export function InfiniteList<T>({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  sentinelRef,
  onRetry,
  renderItem,
  skeleton,
  emptyTitle = 'لا توجد نتائج',
  emptyHint,
  isFiltered = false,
  className = 'space-y-4',
}: {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  sentinelRef: (node: HTMLElement | null) => void;
  onRetry?: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  skeleton?: React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  /** Changes the empty copy: "nothing matches" vs "nothing here yet". */
  isFiltered?: boolean;
  className?: string;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="font-bold text-gray-800">تعذّر تحميل النتائج</p>
        {onRetry ? (
          <button onClick={onRetry} className="text-sm font-bold text-primary">
            إعادة المحاولة
          </button>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        {skeleton ??
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-3xl border border-gray-100 bg-white"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
          <SearchX className="h-8 w-8 text-gray-300" aria-hidden="true" />
        </span>
        <h3 className="mb-1 font-bold text-gray-800">
          {isFiltered ? 'لا نتائج مطابقة' : emptyTitle}
        </h3>
        <p className="text-sm text-gray-500">
          {isFiltered ? 'جرّب تغيير كلمات البحث أو الفلاتر' : (emptyHint ?? '')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={className}>{items.map(renderItem)}</div>

      {/* The sentinel only exists while there IS more, so the observer is not
          left watching a node that can never trigger another fetch. */}
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-6" aria-hidden="true">
          {isLoadingMore ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <span className="h-6" />
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-gray-400">
          {items.length > 6 ? 'وصلت إلى نهاية النتائج' : ''}
        </p>
      )}

      {/* Announced to assistive tech, which cannot see a spinner scroll past. */}
      <span aria-live="polite" className="sr-only">
        {isLoadingMore ? 'جاري تحميل المزيد' : `${items.length} نتيجة`}
      </span>
    </>
  );
}
