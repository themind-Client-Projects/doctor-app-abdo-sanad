import { describe, expect, it } from "vitest";
import { LIVE_SERVICE_STATUSES, isServiceLive } from "@/lib/labels";

/**
 * A ServiceConfig is live at ACTIVE *or* REACTIVATED.
 *
 * "إعادة التفعيل" on the admin services screen writes REACTIVATED — it never
 * writes ACTIVE back. Two predicates disagreed about that and the disagreement
 * was user-visible: the doctor directory rendered a reactivated doctor as
 * «غير متاح» while that same doctor's profile page said the service was
 * offered, and the booking gate refused a provider `/api/public/partners` had
 * just listed.
 *
 * Pure, so it runs with the database unavailable — which is exactly when the
 * ACTIVE-only spelling would otherwise slip back in unnoticed.
 */
describe("isServiceLive", () => {
  it("counts both live statuses", () => {
    expect(isServiceLive("ACTIVE")).toBe(true);
    expect(isServiceLive("REACTIVATED")).toBe(true);
  });

  it("excludes the two that are not live", () => {
    expect(isServiceLive("PAUSED")).toBe(false);
    expect(isServiceLive("SUSPENDED")).toBe(false);
  });

  it("treats an absent service config as not live, never as live", () => {
    // `serviceConfigs[0]?.status` is undefined when the partner has no config
    // row for the service at all — failing closed is the whole point.
    expect(isServiceLive(undefined)).toBe(false);
    expect(isServiceLive(null)).toBe(false);
    expect(isServiceLive("")).toBe(false);
  });

  it("keeps the tuple and the predicate in agreement", () => {
    // A member added to one and not the other is the drift this guards.
    for (const status of LIVE_SERVICE_STATUSES) {
      expect(isServiceLive(status)).toBe(true);
    }
    expect(LIVE_SERVICE_STATUSES).toHaveLength(2);
  });
});
