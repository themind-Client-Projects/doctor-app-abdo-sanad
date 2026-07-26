import type { UserRole } from "@prisma/client";

/**
 * Where each role belongs after signing in.
 *
 * Login previously pushed every role to /dashboard, so PATIENT (the default
 * role for every new account), SUPER_ADMIN and OPERATIONS all landed on a page
 * they are not allowed to see.
 */
export const roleHomePath: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin",
  OPERATIONS: "/operations",
  DOCTOR: "/dashboard",
  LAB: "/dashboard",
  PHARMACY: "/dashboard",
  NURSE: "/dashboard",
  DRIVER: "/dashboard",
  RADIOLOGY: "/dashboard",
  PATIENT: "/",
};

/** Resolve a post-login destination, rejecting non-internal redirect targets. */
export function resolveHomePath(
  role: UserRole | null | undefined,
  callbackUrl?: string | null
): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return role ? roleHomePath[role] : "/";
}
