"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";

/**
 * The signed-in PARTNER's own record — the staff-side counterpart to `useMe`.
 *
 * Its first job is the sidebar: الإحالات only means something for a partner
 * inside a medical complex, and a menu item that leads to "you are not in a
 * complex" for most providers is a dead link with extra steps. Every other
 * screen that needs the partner's own name, channels or contract dates can read
 * it from here rather than fetching `/api/partners/me` again by hand.
 *
 * Returns nulls rather than failing for a caller with no partner row — a
 * platform admin browsing the dashboard is a normal state, not an error.
 */

export type PartnerMe = {
  id: string;
  name: string;
  type: string;
  status: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  rating: number | null;
  totalTasks: number | null;
  governorate: { name: string } | null;
  complex: { id: string; name: string } | null;
  ownedComplex: { id: string; name: string } | null;
  channels: { channel: string; status: string }[];
  serviceConfigs: { serviceType: string; status: string }[];
  contract: { startDate: string; endDate: string | null; isActive: boolean } | null;
};

export function usePartnerMe() {
  const { data, isLoading, error, refetch } = useDashboardData<PartnerMe>({
    url: "/api/partners/me",
  });

  // Owning a complex counts: a complex's own reception routes patients to its
  // members exactly as its doctors do, and the referral API treats it the same.
  const complex = data?.ownedComplex ?? data?.complex ?? null;

  return {
    partner: data ?? null,
    complex,
    /** False while the answer is still in flight, so nothing flashes in. */
    isComplexMember: complex !== null,
    isLoading,
    error,
    refetch,
  };
}
