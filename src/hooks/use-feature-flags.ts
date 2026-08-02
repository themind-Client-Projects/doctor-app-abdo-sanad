"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";

/**
 * Which optional features the admin has switched on.
 *
 * Read from the PUBLIC endpoint because the patient app is public and has to
 * know BEFORE it renders: a button for a suspended feature is worse than no
 * button, since tapping it produces a failure the user cannot explain.
 *
 * Defaults to OFF while loading and on failure. A flag that appears when the
 * request succeeds and vanishes when it does not would flicker; and for
 * anything gated behind an admin switch, the safe default is hidden.
 */

export type FlagKey =
  | "booking.electronic_deduction"
  | "booking.electronic_booking"
  | "taxi.nursing_addon"
  | "sanad.in_doctor_booking";

type Flags = Record<string, { enabled: boolean; value: number | null }>;

export function useFeatureFlags() {
  const { data, isLoading } = useDashboardData<Flags>({ url: "/api/public/feature-flags" });

  const isEnabled = (key: FlagKey) => Boolean(data?.[key]?.enabled);
  /** The flag's numeric parameter — e.g. the taxi nursing add-on's price. */
  const valueOf = (key: FlagKey) => data?.[key]?.value ?? null;

  return { isEnabled, valueOf, isLoading };
}
