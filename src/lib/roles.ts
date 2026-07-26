import type { UserRole } from "@prisma/client";

/**
 * Route groups and the roles allowed into each.
 *
 * Shared by the proxy (which enforces it) and the login redirect (which must
 * not send a user somewhere they'd immediately be bounced from).
 */
export const roleRoutes: Record<string, readonly UserRole[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/operations": ["OPERATIONS", "SUPER_ADMIN"],
  "/dashboard": ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"],
};

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

/** Exact-segment match, so `/dashboardfoo` does not match `/dashboard`. */
export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Is this role permitted to open this path? */
export function canAccess(role: UserRole, pathname: string): boolean {
  const matched = Object.keys(roleRoutes).find((route) => matchesRoute(pathname, route));
  if (!matched) return true; // unprotected path
  return roleRoutes[matched].includes(role);
}

/**
 * Resolve a post-login destination.
 *
 * Honours callbackUrl only when it is internal AND the role can actually open
 * it — otherwise signing in from /login?callbackUrl=/dashboard as a SUPER_ADMIN
 * would redirect straight into /unauthorized.
 */
export function resolveHomePath(
  role: UserRole | null | undefined,
  callbackUrl?: string | null
): string {
  const home = role ? roleHomePath[role] : "/";

  if (!callbackUrl) return home;
  // Reject protocol-relative and absolute URLs — open-redirect guard.
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return home;
  if (role && !canAccess(role, callbackUrl)) return home;

  return callbackUrl;
}
