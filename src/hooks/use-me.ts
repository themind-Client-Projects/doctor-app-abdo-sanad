"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";

/**
 * The signed-in patient and their wallet balance — what every patient header
 * shows.
 *
 * Returns nulls for a visitor instead of failing, because the patient app is
 * browsable signed-out and an anonymous reader is a normal state, not an error.
 * Callers decide what to render for it: the header hides the wallet chip and
 * greets without a name.
 */

export type Me = {
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    image: string | null;
    role: string;
  } | null;
  wallet: { balance: number } | null;
};

export function useMe() {
  const { data, isLoading, error, refetch } = useDashboardData<Me>({ url: "/api/v1/me" });

  return {
    user: data?.user ?? null,
    balance: data?.wallet?.balance ?? null,
    /** True once we know one way or the other — the header must not flash a
     *  wallet chip at a visitor while the answer is still in flight. */
    isSignedIn: Boolean(data?.user),
    isLoading,
    error,
    refetch,
  };
}
