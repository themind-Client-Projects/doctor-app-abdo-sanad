import { describe, expect, it } from "vitest";
import { BENEFIT_STATES, addDays } from "@/server/services/membership";

/**
 * The commercial promises a membership makes, tested where they are pure.
 *
 * The interesting rules here — one active membership, snapshot-at-purchase,
 * the conditional UPDATE that stops two bookings spending the same last visit —
 * are all database-shaped and live in `purchaseMembership` and
 * `consumeEntitlement`. What is testable without a connection is the arithmetic
 * a patient reads off the card: when does this expire, and what do the three
 * row states mean.
 */

describe("how long a membership runs", () => {
  it("gives each of the client's four packages the period its card promises", () => {
    const bought = new Date("2026-09-13T08:00:00.000Z");

    // باقة يومي — "صالح لمدة يوم واحد"
    expect(addDays(bought, 1).toISOString()).toBe("2026-09-14T08:00:00.000Z");
    // باقة أسبوعي — "صالح لمدة 7 أيام"
    expect(addDays(bought, 7).toISOString()).toBe("2026-09-20T08:00:00.000Z");
    // باقة شهري — "صالح لمدة 30 يوم"
    expect(addDays(bought, 30).toISOString()).toBe("2026-10-13T08:00:00.000Z");
    // باقة سنوي — "صالح لمدة 12 شهر"
    expect(addDays(bought, 365).toISOString()).toBe("2027-09-13T08:00:00.000Z");
  });

  it("keeps the time of day, so a membership bought at 23:00 is not short a day", () => {
    const late = new Date("2026-09-13T23:30:00.000Z");
    expect(addDays(late, 1).toISOString()).toBe("2026-09-14T23:30:00.000Z");
  });

  it("carries the remaining days forward when a renewal extends from the end", () => {
    // The renewal path adds to `expiresAt`, not to today. A patient who renews
    // a 30-day package with 10 days left must end up with 40, not 30.
    const bought = new Date("2026-09-01T00:00:00.000Z");
    const expires = addDays(bought, 30);
    const renewed = addDays(expires, 30);

    const daysHeld = (renewed.getTime() - bought.getTime()) / 86_400_000;
    expect(daysHeld).toBe(60);
  });

  it("crosses a month and a leap day without drifting", () => {
    // `setDate` is the idiom that breaks here; the implementation adds
    // milliseconds instead.
    expect(addDays(new Date("2028-02-28T12:00:00.000Z"), 1).toISOString()).toBe(
      "2028-02-29T12:00:00.000Z"
    );
    expect(addDays(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-01T12:00:00.000Z"
    );
  });
});

describe("the three states a card row can be in", () => {
  it("names exactly the marks the client's card draws", () => {
    // Green check, "معلق", padlock. A fourth would render as nothing.
    expect(BENEFIT_STATES).toEqual(["AVAILABLE", "SUSPENDED", "LOCKED"]);
  });

  it("keeps SUSPENDED distinct from LOCKED", () => {
    // The distinction is the point: "معلق" is printed on the card as a benefit
    // that is announced but not yet honoured, while a padlock is a benefit that
    // is not part of the package at all. Collapsing them would either promise
    // something unavailable or hide something the client chose to advertise.
    expect(BENEFIT_STATES).toContain("SUSPENDED");
    expect(BENEFIT_STATES).toContain("LOCKED");
    expect(new Set(BENEFIT_STATES).size).toBe(BENEFIT_STATES.length);
  });
});
