'use client';

import { useState, useCallback } from 'react';
import type { Doctor } from '@/types/patient';

/**
 * Shared hook for managing the doctor booking drawer state.
 * Replaces duplicate useState + handler pattern in 4 page components.
 */
export function useBookingDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const openBooking = useCallback((doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setDrawerOpen(true);
  }, []);

  const closeBooking = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return {
    drawerOpen,
    setDrawerOpen,
    selectedDoctor,
    openBooking,
    closeBooking,
  };
}
