import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

/**
 * Route groups and the roles allowed into each.
 *
 * NOTE: this is a UX redirect layer, not the security boundary. Every API route
 * enforces its own authorisation via `withAuth` (src/lib/api-auth.ts), because
 * middleware has historically been bypassable and must never be the only gate.
 */
const roleRoutes: Record<string, readonly UserRole[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/operations": ["OPERATIONS", "SUPER_ADMIN"],
  "/dashboard": [
    "DOCTOR",
    "LAB",
    "PHARMACY",
    "NURSE",
    "DRIVER",
    "RADIOLOGY",
  ],
};

/** Where each role belongs after signing in. */
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
function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const matchedRoute = Object.keys(roleRoutes).find((route) =>
    matchesRoute(pathname, route)
  );
  if (!matchedRoute) return NextResponse.next();

  const user = req.auth?.user;

  // Guard on a concrete identity rather than object existence. Auth.js can
  // populate `req.auth` with an error object on a config failure, which makes
  // a bare `if (!req.auth)` check fail open (GHSA-8fpg-xm3f-6cx3).
  if (!user?.id || !user.role) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const allowedRoles = roleRoutes[matchedRoute];
  if (!allowedRoles.includes(user.role)) {
    // Send the user somewhere they can actually use, rather than a dead end.
    const home = roleHomePath[user.role] ?? "/";
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("from", pathname);
    url.searchParams.set("home", home);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/operations/:path*"],
};
