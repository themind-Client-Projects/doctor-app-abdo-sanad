'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useFilters } from '@/hooks/use-filters';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
}

export function SearchInput({ placeholder = 'ابحث...', className = '' }: SearchInputProps) {
  const { searchQuery, setSearchQuery } = useFilters();
  const [localValue, setLocalValue] = useState(searchQuery);

  // Sync local state if URL changes externally (e.g. user hits back button)
  useEffect(() => {
    setLocalValue(searchQuery);
  }, [searchQuery]);

  // Debounce the search input to avoid hitting the URL router on every keystroke
  // This drastically improves performance and prevents input lagging
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== searchQuery) {
        setSearchQuery(localValue);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(handler);
  }, [localValue, searchQuery, setSearchQuery]);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
        <Search className="w-5 h-5 text-gray-400" />
      </div>
      <input
        type="text"
        className="bg-white border-none text-gray-900 text-sm rounded-[1.5rem] focus:ring-2 focus:ring-primary/20 block w-full ps-11 p-4 shadow-sm"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </div>
  );
}
