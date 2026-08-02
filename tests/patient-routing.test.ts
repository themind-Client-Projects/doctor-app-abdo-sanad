import { describe, expect, it } from "vitest";
import { canAccess, isPatientPrivate, matchesRoute, resolveHomePath } from "@/lib/roles";

/**
 * Which patient screens require a session, and where an unauthenticated visitor
 * is sent.
 *
 * The split matters: personal data needs a sign-in, but BROWSING does not. The
 * whole public catalogue surface (`/api/public/*`, `withMaybeAuth`) exists so a
 * visitor can look at doctors, offers and prices before signing up — gating
 * those pages would hide the catalogue from the people it is meant to attract.
 */

describe("patient-private routes", () => {
  it("covers the screens that hold personal data", () => {
    for (const path of ["/wallet", "/bookings", "/notifications", "/profile"]) {
      expect(isPatientPrivate(path)).toBe(true);
    }
  });

  it("covers their sub-paths too", () => {
    expect(isPatientPrivate("/bookings/abc123")).toBe(true);
    expect(isPatientPrivate("/profile/edit")).toBe(true);
  });

  it("leaves the browse surface public", () => {
    for (const path of [
      "/",
      "/sanad",
      "/doctors",
      "/sanad/doctors",
      "/labs",
      "/pharmacies",
      "/nursing",
      "/physiotherapy",
      "/services",
      "/services/offers",
      "/doctors-directory",
      "/complexes/abc",
      "/signin",
    ]) {
      expect(isPatientPrivate(path)).toBe(false);
    }
  });

  it("matches on whole segments, so a lookalike path is not gated", () => {
    // `/profiles` is a different route; a `startsWith` check would swallow it.
    expect(isPatientPrivate("/profiles")).toBe(false);
    expect(isPatientPrivate("/walletx")).toBe(false);
    expect(matchesRoute("/dashboardfoo", "/dashboard")).toBe(false);
  });

  it("does not gate the staff areas — those redirect to /login instead", () => {
    for (const path of ["/admin", "/operations", "/dashboard"]) {
      expect(isPatientPrivate(path)).toBe(false);
    }
  });
});

describe("post-sign-in destination", () => {
  it("returns a patient to the page they were bounced from", () => {
    expect(resolveHomePath("PATIENT", "/wallet")).toBe("/wallet");
    expect(resolveHomePath("PATIENT", "/bookings")).toBe("/bookings");
  });

  it("sends a patient home when there is no callback", () => {
    expect(resolveHomePath("PATIENT", null)).toBe("/");
  });

  it("refuses an absolute URL — the open-redirect guard", () => {
    // Without this, /signin?callbackUrl=https://evil.com turns the sign-in page
    // into a redirector that borrows this app's credibility.
    expect(resolveHomePath("PATIENT", "https://evil.com")).toBe("/");
    expect(resolveHomePath("PATIENT", "//evil.com")).toBe("/");
    expect(resolveHomePath("PATIENT", "http://evil.com/x")).toBe("/");
  });

  it("refuses a callback the role cannot open", () => {
    // A patient bounced from /admin must not be sent back into it after
    // signing in, only to hit /unauthorized.
    expect(resolveHomePath("PATIENT", "/admin")).toBe("/");
    expect(resolveHomePath("PATIENT", "/dashboard")).toBe("/");
    expect(canAccess("PATIENT", "/admin")).toBe(false);
  });

  it("still lets staff reach their own area", () => {
    expect(resolveHomePath("SUPER_ADMIN", "/admin/partners")).toBe("/admin/partners");
    expect(resolveHomePath("DOCTOR", "/dashboard")).toBe("/dashboard");
    // ...and not somebody else's.
    expect(resolveHomePath("DOCTOR", "/admin")).toBe("/dashboard");
  });
});
