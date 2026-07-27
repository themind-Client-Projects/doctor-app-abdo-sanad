'use client';

import { useFilters } from '@/hooks/use-filters';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  className?: string;
}

export function Pagination({ totalItems, itemsPerPage, className = '' }: PaginationProps) {
  const { page, setPage } = useFilters();
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center gap-2 py-4 ${className}`}>
      <button
        onClick={() => setPage(page - 1)}
        disabled={page <= 1}
        className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:scale-95 transition-colors"
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className="w-5 h-5 text-gray-600" />
      </button>
      
      <div className="flex items-center gap-1 px-4">
        <span className="text-sm font-bold text-gray-900">{page}</span>
        <span className="text-xs font-medium text-gray-400">من</span>
        <span className="text-sm font-bold text-gray-600">{totalPages}</span>
      </div>

      <button
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
        className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:scale-95 transition-colors"
        aria-label="الصفحة التالية"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
}
