"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { STALE_TIME } from "@/lib/request-cache";

/**
 * The storefront content for one channel: banners, subscription plans, live
 * offers and the specialty filter row.
 *
 * `channel` is what makes /  and /sanad different pages rather than the same
 * page twice: the main home and the Sanad home run their own promos, while the
 * plans and specialties come back identical because both are global — a
 * subscriber uses their plan in either world, and a cardiologist is a
 * cardiologist in both.
 *
 * One request rather than four: these all paint the same above-the-fold view,
 * and four round-trips on a patchy mobile connection is four chances to show a
 * half-built screen.
 */

export type Channel = "DIRECT" | "SANAD" | "COMPLEX";

export type StorefrontBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string | null;
};

export type StorefrontPlan = {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  features: string[];
  accent: string;
  icon: string;
  isPopular: boolean;
};

export type StorefrontOffer = {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  endDate: string;
  targetServices: string[];
};

export type StorefrontSpecialty = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type Storefront = {
  banners: StorefrontBanner[];
  plans: StorefrontPlan[];
  offers: StorefrontOffer[];
  specialties: StorefrontSpecialty[];
};

const EMPTY: Storefront = { banners: [], plans: [], offers: [], specialties: [] };

export function useStorefront(channel: Channel = "DIRECT") {
  const { data, isLoading, error, refetch } = useDashboardData<Storefront>({
    url: "/api/public/storefront",
    staleTime: STALE_TIME.storefront,
    params: { channel },
  });

  // Never hand a caller `null` collections: every consumer maps over these, and
  // a `?? []` at each call site is a guard someone eventually forgets.
  return { storefront: data ?? EMPTY, isLoading, error, refetch };
}
