'use client';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list-item' | 'search-result';
  count?: number;
  className?: string;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-200/70', className)} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
      <div className="flex items-start gap-4">
        <SkeletonPulse className="w-16 h-16 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2.5">
          <SkeletonPulse className="h-4 w-3/4" />
          <SkeletonPulse className="h-3 w-1/2" />
          <SkeletonPulse className="h-3 w-2/3" />
        </div>
      </div>
      <SkeletonPulse className="h-10 w-full rounded-xl" />
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <SkeletonPulse className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-4 w-2/3" />
        <SkeletonPulse className="h-3 w-1/2" />
      </div>
      <SkeletonPulse className="h-3 w-8" />
    </div>
  );
}

function SearchResultSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
      <SkeletonPulse className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-4 w-3/5" />
        <SkeletonPulse className="h-3 w-2/5" />
      </div>
    </div>
  );
}

export function LoadingSkeleton({ variant = 'card', count = 3, className }: LoadingSkeletonProps) {
  const SkeletonComponent = {
    card: CardSkeleton,
    'list-item': ListItemSkeleton,
    'search-result': SearchResultSkeleton,
  }[variant];

  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}
