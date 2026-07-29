'use client';

import { useMemo } from 'react';
import { useFilters } from '@/hooks/use-filters';
import { useLocationStore } from '@/stores/patient/location.store';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import type { Channel } from '@/hooks/use-storefront';
import type { Doctor } from '@/types/patient';

const ITEMS_PER_PAGE = 5;

interface UseDoctorsOptions {
  /** Limit results instead of paginating (e.g. for home page featured list) */
  limit?: number;
  /**
   * Which storefront is asking. This is the whole reason /doctors and
   * /sanad/doctors can share one component: the pool AND the quoted price both
   * come from the channel, so the Sanad page shows Sanad providers at
   * `sanadPrice` while the same markup on / shows everyone at `basePrice`.
   */
  channel?: Channel;
}

/**
 * Doctor filtering, search and pagination for every browse surface.
 *
 * Reads `/api/public/doctors` — a public endpoint, because the patient app
 * browses before it signs in. It previously called `getAllDoctors()`, which
 * returned fourteen invented doctors from `src/lib/constants/demo-data.ts`:
 * nobody an admin could edit, and nobody a booking could ever resolve to.
 *
 * Search and specialty filtering stay client-side on purpose. The result set is
 * capped at 60 rows, so filtering in the browser is instant and does not fire a
 * request per keystroke over a mobile connection.
 */
export function useDoctors(options?: UseDoctorsOptions) {
  const { searchQuery, category, page } = useFilters();
  const { selectedCity } = useLocationStore();
  const channel = options?.channel ?? 'DIRECT';

  const { data, isLoading, error, refetch } = useDashboardData<Doctor[]>({
    url: '/api/public/doctors',
    params: { channel },
  });

  const allDoctors = useMemo(() => data ?? [], [data]);

  const filteredDoctors = useMemo(() => {
    return allDoctors.filter(doctor => {
      const matchesSpecialty = category === 'all' || doctor.specialtyId === category;
      const matchesCity = !selectedCity || doctor.location.includes(selectedCity);
      const matchesSearch = !searchQuery ||
        doctor.name.includes(searchQuery) ||
        doctor.specialty.includes(searchQuery) ||
        doctor.location.includes(searchQuery);
      return matchesSpecialty && matchesSearch && matchesCity;
    });
  }, [allDoctors, category, searchQuery, selectedCity]);

  const paginatedDoctors = useMemo(() => {
    if (options?.limit) {
      return filteredDoctors.slice(0, options.limit);
    }
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredDoctors.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDoctors, page, options?.limit]);

  const totalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE);

  return {
    allDoctors,
    filteredDoctors,
    paginatedDoctors,
    totalPages,
    totalCount: filteredDoctors.length,
    itemsPerPage: ITEMS_PER_PAGE,
    isLoading,
    error,
    refetch,
  };
}
