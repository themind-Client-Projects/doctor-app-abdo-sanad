import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { canAccess, resolveHomePath, roleHomePath, safeInternalPath } from "@/lib/roles";

/**
 * Where each role lands, and what a supplied callback may do to that.
 *
 * The defect this pins: /signin resolved its destination as PATIENT before
 * knowing who was signing in — and Google is offered there and works for every
 * role. With no callback that produced `/`, so a SUPER_ADMIN signing in with
 * Google landed on the patient storefront instead of /admin; with a staff
 * callback it produced `/` too, because PATIENT cannot open /admin.
 * `safeInternalPath` now answers only "is this safely internal?", and the final
 * hop resolves it against the real role.
 */

const STAFF: UserRole[] = ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"];

describe("role home paths", () => {
  it("sends each role to a page it can actually open", () => {
    for (const role of Object.keys(roleHomePath) as UserRole[]) {
      const home = roleHomePath[role];
      expect(canAccess(role, home), `${role} cannot open its own home ${home}`).toBe(true);
    }
  });

  it("puts the platform roles in their own portals and providers in the dashboard", () => {
    expect(roleHomePath.SUPER_ADMIN).toBe("/admin");
    expect(roleHomePath.OPERATIONS).toBe("/operations");
    for (const role of STAFF) expect(roleHomePath[role]).toBe("/dashboard");
    expect(roleHomePath.PATIENT).toBe("/");
  });
});

describe("resolveHomePath honours the role, not a guess", () => {
  it("sends a Google-signed-in admin to /admin when no callback is given", () => {
    // The regression: this used to be asked as PATIENT and returned "/".
    expect(resolveHomePath("SUPER_ADMIN", null)).toBe("/admin");
    expect(resolveHomePath("OPERATIONS", undefined)).toBe("/operations");
  });

  it("keeps a callback the role may open", () => {
    expect(resolveHomePath("SUPER_ADMIN", "/admin/partners")).toBe("/admin/partners");
    expect(resolveHomePath("DOCTOR", "/dashboard/referrals")).toBe("/dashboard/referrals");
    // SUPER_ADMIN gained /dashboard; the callback must now survive.
    expect(resolveHomePath("SUPER_ADMIN", "/dashboard")).toBe("/dashboard");
  });

  it("drops a callback the role may NOT open, rather than bouncing them to /unauthorized", () => {
    expect(resolveHomePath("PATIENT", "/admin")).toBe("/");
    expect(resolveHomePath("DOCTOR", "/admin")).toBe("/dashboard");
    expect(resolveHomePath("OPERATIONS", "/dashboard")).toBe("/operations");
  });

  it("judges the path, not the query string", () => {
    expect(resolveHomePath("PATIENT", "/doctors?category=cardiology")).toBe(
      "/doctors?category=cardiology"
    );
  });
});

describe("safeInternalPath is a guard, not a policy", () => {
  it("accepts an internal path and reports nothing for an absent one", () => {
    expect(safeInternalPath("/admin")).toBe("/admin");
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
  });

  it("refuses every off-site shape", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",          // browsers normalise \ to / — reads as //evil
      "http://evil.example/x",
      "/ok\u0000/../evil",        // control characters can be stripped on parse
    ]) {
      expect(safeInternalPath(bad), `${JSON.stringify(bad)} must be refused`).toBeNull();
    }
  });

  it("does NOT apply role policy — that is the caller's job at the final hop", () => {
    // The whole point of the split: /signin cannot know the role yet.
    expect(safeInternalPath("/admin")).toBe("/admin");
    expect(resolveHomePath("PATIENT", "/admin")).toBe("/");
  });
});
