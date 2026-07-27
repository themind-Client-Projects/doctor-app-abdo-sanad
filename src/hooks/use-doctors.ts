'use client';

import { useMemo } from 'react';
import { useFilters } from '@/hooks/use-filters';
import { useLocationStore } from '@/stores/patient/location.store';
import { getAllDoctors } from '@/services/doctors.service';
import type { Doctor } from '@/types/patient';

const ITEMS_PER_PAGE = 5;

interface UseDoctorsOptions {
  /** Limit results instead of paginating (e.g. for home page featured list) */
  limit?: number;
}

/**
 * Centralized hook for doctor filtering, search, and pagination.
 * Replaces duplicate logic in: home, doctors, teleconsultation, complexes pages.
 */
export function useDoctors(options?: UseDoctorsOptions) {
  const { searchQuery, category, page } = useFilters();
  const { selectedCity } = useLocationStore();

  const allDoctors = useMemo(() => getAllDoctors(), []);

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
  };
}
