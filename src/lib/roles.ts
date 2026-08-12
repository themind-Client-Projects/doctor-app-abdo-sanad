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
 * Patient routes that hold PERSONAL data and therefore need a session — but no
 * particular ROLE, since each one is scoped to whoever is signed in.
 *
 * Deliberately short. The rest of the patient app is browsable signed-out: the
 * doctor directory, the storefronts, the offers and the specialty filters are
 * all public, which is why `/api/public/*` and `withMaybeAuth` exist. Gating
 * the browse pages would hide the catalogue from the people it is meant to
 * attract.
 *
 * Kept OUT of `roleRoutes` on purpose: these are authentication-only, and
 * putting them there would make `canAccess` demand a role list none of them has.
 */
export const patientPrivateRoutes = [
  "/wallet",
  "/bookings",
  "/notifications",
  "/profile",
  // Onboarding: reachable only with a session, since it edits one.
  "/complete-profile",
] as const;

/** Does this path hold personal data that requires signing in? */
export function isPatientPrivate(pathname: string): boolean {
  return patientPrivateRoutes.some((route) => matchesRoute(pathname, route));
}

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

  // Open-redirect guard.
  //
  // A backslash is the hole a "starts with / but not //" check leaves open:
  // browsers normalise `\` to `/` while parsing, so `/\evil.example` is
  // fetched as `//evil.example` — an off-site hop the moment the user signs in,
  // which is exactly the phishing shape a sign-in redirect must not have.
  // Control characters get the same treatment: they can be stripped during
  // parsing and reveal a scheme this check never saw.
  if (callbackUrl.includes("\\")) return home;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(callbackUrl)) return home;
  // Reject protocol-relative and absolute URLs.
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return home;

  // Authorise the PATH, not the query string: `/doctors?category=cardiology`
  // must be judged as `/doctors`, or a preserved filter would look like an
  // unknown route and silently drop the user on their home page instead.
  const path = callbackUrl.split(/[?#]/)[0];
  if (role && !canAccess(role, path)) return home;

  return callbackUrl;
}

/**
 * Roles that see the whole platform rather than one partner's slice.
 *
 * Lives here rather than in `api-auth` because it is a pure predicate over a
 * role, with no request and no session behind it — while `api-auth` imports
 * NextAuth. Every tenancy helper needs this one function, so having it there
 * meant a scoping rule could not be unit-tested without an auth runtime.
 * `api-auth` re-exports it, so existing imports are unaffected.
 */
export function isPlatformRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "OPERATIONS";
}
