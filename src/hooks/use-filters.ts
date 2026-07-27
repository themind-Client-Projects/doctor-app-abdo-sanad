import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get current values
  const searchQuery = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Helper to update the URL
  const updateUrl = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      
      // Reset page to 1 when changing search or category
      if (key !== 'page') {
        params.set('page', '1');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const setSearchQuery = useCallback(
    (val: string) => updateUrl('q', val),
    [updateUrl]
  );

  const setCategory = useCallback(
    (val: string) => updateUrl('category', val),
    [updateUrl]
  );

  const setPage = useCallback(
    (val: number) => updateUrl('page', val.toString()),
    [updateUrl]
  );

  return {
    searchQuery,
    setSearchQuery,
    category,
    setCategory,
    page,
    setPage,
  };
}
