'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageBackButtonProps {
  className?: string;
}

export function PageBackButton({ className }: PageBackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={cn(
        'absolute right-4 top-14 w-10 h-10 flex items-center justify-center',
        'bg-white/20 hover:bg-white/30 transition-colors rounded-full',
        'text-white backdrop-blur-md z-20 active:scale-95',
        className
      )}
      aria-label="رجوع"
    >
      <ChevronRight className="w-6 h-6" />
    </button>
  );
}
