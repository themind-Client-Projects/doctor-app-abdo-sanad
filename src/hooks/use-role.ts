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
  // A doctor has TWO ids and they are not interchangeable: `partnerId` points at
  // the Partner row that owns the wallet and the orders, `doctorProfileId` at
  // the DoctorProfile that owns the appointments and the prescriptions. The
  // session has carried both all along; only `partnerId` was exposed, so the
  // doctor's screens had to ask `/api/v1/me` — the PATIENT endpoint, which does
  // not return a doctor profile — and concluded every doctor had none.
  const doctorProfileId: string | null = session?.user?.doctorProfileId ?? null;
  const userId = session?.user?.id ?? null;
  const userName = session?.user?.name || "مستخدم";
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  return {
    role,
    partnerId,
    doctorProfileId,
    userId,
    userName,
    isLoading,
    isAuthenticated,
    session,
  };
}
