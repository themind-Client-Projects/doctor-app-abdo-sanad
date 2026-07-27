import { DEMO_DOCTORS } from '@/lib/constants/demo-data';
import type { Doctor } from '@/types/patient';

// ─── Data Access Functions ──────────────────────────────────────────────
// Swap these internals with API calls when backend is ready.
// No page component changes needed.

export function getAllDoctors(): Doctor[] {
  return Object.values(DEMO_DOCTORS).flat();
}

export function getDoctorById(id: string): Doctor | undefined {
  return getAllDoctors().find(d => d.id === id);
}

export function getDoctorsBySpecialty(specialtyId: string): Doctor[] {
  return DEMO_DOCTORS[specialtyId] || [];
}
