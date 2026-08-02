"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";

/**
 * The single gate a guest hits when they try to commit to something.
 *
 * Browsing is public on purpose — a visitor can read the whole catalogue, see
 * every price and compare doctors without an account. What they cannot do is
 * BOOK, because every reservation is written against a patient id.
 *
 * One hook rather than a check per screen: there are six booking surfaces
 * (doctors, surgeries, home care, nursing, taxi, blood bank) and a rule
 * copied six times is a rule that will disagree with itself.
 *
 * Gate at the ENTRY to a flow, not at its end. Letting someone pick a date,
 * choose a slot and reach "متابعة للدفع" before telling them to sign in wastes
 * the work they just did; the drawer in that state cannot even submit.
 *
 * This is UX, not security — every write endpoint enforces its own `withAuth`,
 * because a client-side check is advice, not a boundary.
 */
export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoading } = useMe();

  /**
   * Run `action` when signed in; otherwise send them to sign in and come back.
   *
   * Returns whether the action ran, so a caller that needs to abort further
   * work (closing a drawer, resetting a form) can tell.
   */
  const ensureSignedIn = useCallback(
    (action?: () => void): boolean => {
      // Never bounce a signed-in user because their session had not resolved
      // yet — that turns a slow connection into a spurious sign-in prompt.
      if (isLoading) return false;

      if (!isSignedIn) {
        toast.error("سجّل الدخول أولاً لإتمام الحجز");
        // Keep the query string. Someone filtered to a specialty or a city and
        // then tapped احجز should come back to THAT list, not to an unfiltered
        // one they have to narrow down again.
        const query = searchParams.toString();
        const here = query ? `${pathname}?${query}` : pathname;
        router.push(`/signin?callbackUrl=${encodeURIComponent(here)}`);
        return false;
      }

      action?.();
      return true;
    },
    [isLoading, isSignedIn, router, pathname, searchParams]
  );

  return { isSignedIn, isLoading, ensureSignedIn };
}
