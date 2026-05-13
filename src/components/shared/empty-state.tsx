'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 leading-relaxed max-w-[280px] mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
