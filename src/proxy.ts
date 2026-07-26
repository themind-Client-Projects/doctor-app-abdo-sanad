import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccess, matchesRoute, roleHomePath, roleRoutes } from "@/lib/roles";

/**
 * Page-level access control.
 *
 * NOTE: this is a UX redirect layer, not the security boundary. Every API route
 * enforces its own authorisation via `withAuth` (src/lib/api-auth.ts), because
 * middleware has historically been bypassable and must never be the only gate.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isProtected = Object.keys(roleRoutes).some((route) =>
    matchesRoute(pathname, route)
  );
  if (!isProtected) return NextResponse.next();

  const user = req.auth?.user;

  // Guard on a concrete identity rather than object existence. Auth.js can
  // populate `req.auth` with an error object on a config failure, which makes
  // a bare `if (!req.auth)` check fail open (GHSA-8fpg-xm3f-6cx3).
  if (!user?.id || !user.role) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccess(user.role, pathname)) {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("from", pathname);
    url.searchParams.set("home", roleHomePath[user.role] ?? "/");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/operations/:path*"],
};
