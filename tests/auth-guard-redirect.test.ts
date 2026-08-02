import { describe, expect, it } from "vitest";
import { resolveHomePath } from "@/lib/roles";

/**
 * The round trip a guest makes when they tap احجز.
 *
 *   /doctors?category=cardiology
 *     → /signin?callbackUrl=/doctors%3Fcategory%3Dcardiology
 *       → /complete-profile?next=/doctors%3Fcategory%3Dcardiology
 *         → back to /doctors?category=cardiology
 *
 * Each hop hands the destination to the next through `resolveHomePath`, so the
 * open-redirect guard is applied at every step rather than only the first.
 */
describe("return-to-page after signing in", () => {
  it("returns to the exact page, filters included", () => {
    const from = "/doctors?category=cardiology";
    // Hop 1: the sign-in page reads callbackUrl.
    const afterSignin = resolveHomePath("PATIENT", from);
    expect(afterSignin).toBe(from);
    // Hop 2: onboarding reads `next` and must not mangle it.
    expect(resolveHomePath("PATIENT", afterSignin)).toBe(from);
  });

  it("keeps a query string on every patient surface it can come from", () => {
    for (const from of [
      "/doctors?category=dentistry&page=2",
      "/sanad/doctors?governorate=بغداد",
      "/labs",
      "/services/taxi",
      "/services/surgeries",
      "/nursing",
      "/services/blood-bank",
    ]) {
      expect(resolveHomePath("PATIENT", from)).toBe(from);
    }
  });

  it("still refuses an absolute URL carrying a query", () => {
    // The query-string support must not become a hole in the redirect guard.
    expect(resolveHomePath("PATIENT", "https://evil.com/?x=1")).toBe("/");
    expect(resolveHomePath("PATIENT", "//evil.com/?x=1")).toBe("/");
  });

  it("still refuses a staff area even with a query", () => {
    expect(resolveHomePath("PATIENT", "/admin?tab=partners")).toBe("/");
    expect(resolveHomePath("PATIENT", "/dashboard?x=1")).toBe("/");
  });

  it("judges the PATH, not the whole string", () => {
    // The regression this guards: authorising the raw value made
    // "/doctors?x=1" an unknown route, so the filter was silently dropped and
    // the user landed on "/" instead of the list they were looking at.
    expect(resolveHomePath("PATIENT", "/doctors?x=1")).not.toBe("/");
  });
});
