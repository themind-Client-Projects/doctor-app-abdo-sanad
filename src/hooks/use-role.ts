"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@/types/dashboard";

export function useRole() {
  const { data: session, status } = useSession();

  // `role` is null when unauthenticated. It previously defaulted to "PATIENT",
  // which made an expired session look like a valid patient instead of
  // signalling that the user needs to sign in again.
  const role: UserRole | null = session?.user?.role ?? null;
  const partnerId: string | null = session?.user?.partnerId ?? null;
  const userId = session?.user?.id ?? null;
  const userName = session?.user?.name || "مستخدم";
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  return {
    role,
    partnerId,
    userId,
    userName,
    isLoading,
    isAuthenticated,
    session,
  };
}
