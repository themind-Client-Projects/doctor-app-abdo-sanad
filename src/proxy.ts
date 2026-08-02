import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  canAccess,
  isPatientPrivate,
  matchesRoute,
  roleHomePath,
  roleRoutes,
} from "@/lib/roles";

/**
 * Page-level access control.
 *
 * NOTE: this is a UX redirect layer, not the security boundary. Every API route
 * enforces its own authorisation via `withAuth` (src/lib/api-auth.ts), because
 * middleware has historically been bypassable and must never be the only gate.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const user = req.auth?.user;
  // Guard on a concrete identity rather than object existence. Auth.js can
  // populate `req.auth` with an error object on a config failure, which makes
  // a bare `if (!req.auth)` check fail open (GHSA-8fpg-xm3f-6cx3).
  const signedIn = Boolean(user?.id && user.role);

  // Already signed in and asking for a sign-in page: send them home rather than
  // showing a form for a session they already hold.
  if (pathname === "/signin" || pathname === "/login") {
    if (!signedIn) return NextResponse.next();
    return NextResponse.redirect(new URL(roleHomePath[user!.role!] ?? "/", req.url));
  }

  // Personal patient screens: any signed-in user, redirected to the PATIENT
  // sign-in. Sending them to /login would offer a staff email+password form for
  // an account that has neither — patients sign in by phone.
  if (isPatientPrivate(pathname)) {
    if (signedIn) return NextResponse.next();
    const signinUrl = new URL("/signin", req.url);
    signinUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signinUrl);
  }

  const isProtected = Object.keys(roleRoutes).some((route) =>
    matchesRoute(pathname, route)
  );
  if (!isProtected) return NextResponse.next();

  if (!signedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccess(user!.role!, pathname)) {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("from", pathname);
    url.searchParams.set("home", roleHomePath[user!.role!] ?? "/");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Staff areas.
    "/dashboard/:path*",
    "/admin/:path*",
    "/operations/:path*",
    // Personal patient screens. The browse pages are deliberately absent — the
    // patient app is meant to be explored before signing up.
    "/wallet/:path*",
    "/bookings/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/complete-profile",
    // So an already-signed-in user is not shown a sign-in form.
    "/signin",
    "/login",
  ],
};
