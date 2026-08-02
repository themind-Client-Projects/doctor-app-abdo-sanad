'use client';

import { useState, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import type { Doctor } from '@/types/patient';

/**
 * Shared state for the doctor booking drawer.
 *
 * Also the single place doctor booking is gated. Every doctor surface opens the
 * drawer through here — the home page, /doctors, /sanad/doctors, the directory,
 * teleconsultation and the complex pages — so a guest is sent to sign in from
 * all of them without any of them knowing about it.
 */
export function useBookingDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const { ensureSignedIn } = useAuthGuard();

  const openBooking = useCallback((doctor: Doctor) => {
    // Checked BEFORE the drawer opens. Letting a guest pick a date and a slot
    // and only then demanding a sign-in throws away the work they just did —
    // and that drawer could never have submitted anyway.
    ensureSignedIn(() => {
      setSelectedDoctor(doctor);
      setDrawerOpen(true);
    });
  }, [ensureSignedIn]);

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
