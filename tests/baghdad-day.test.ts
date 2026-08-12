import { describe, expect, it } from "vitest";
import {
  baghdadDayKey,
  startOfBaghdadDay,
  startOfBaghdadDayOffset,
  startOfBaghdadMonth,
} from "@/lib/time";

/**
 * Every "today" figure in the app is bounded by these helpers.
 *
 * The server runs in UTC and Iraq is UTC+3, so a naive `setHours(0,0,0,0)`
 * boundary lands at 03:00 Baghdad: between midnight and 3am, every daily
 * counter, calendar and report silently reported yesterday. That bug was fixed
 * in one route and left in five others, which is what these tests exist to stop
 * happening again.
 *
 * The 00:00–03:00 Baghdad window is the whole point — a test that only checks
 * midday would pass against the broken implementation.
 */

/** 01:30 Baghdad on 3 Aug 2026 — i.e. 22:30 UTC on 2 Aug. The dangerous case. */
const EARLY_MORNING = new Date("2026-08-02T22:30:00.000Z");
/** 04:00 Baghdad, safely after the UTC boundary. */
const MORNING = new Date("2026-08-03T01:00:00.000Z");
/** 23:30 Baghdad, the last half hour of the same day. */
const LATE_NIGHT = new Date("2026-08-03T20:30:00.000Z");

/** Baghdad midnight on 3 Aug 2026 is 21:00 UTC on 2 Aug 2026. */
const DAY_START = "2026-08-02T21:00:00.000Z";

describe("startOfBaghdadDay", () => {
  it.each([
    ["01:30 Baghdad", EARLY_MORNING],
    ["04:00 Baghdad", MORNING],
    ["23:30 Baghdad", LATE_NIGHT],
  ])("puts %s on the same Baghdad day", (_label, at) => {
    expect(startOfBaghdadDay(at).toISOString()).toBe(DAY_START);
  });

  it("returns a bound the instant itself falls inside", () => {
    for (const at of [EARLY_MORNING, MORNING, LATE_NIGHT]) {
      const start = startOfBaghdadDay(at);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      expect(at.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(at.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("does not agree with a naive UTC boundary before 03:00 — the original bug", () => {
    const naive = new Date(EARLY_MORNING);
    naive.setUTCHours(0, 0, 0, 0);
    // The naive boundary is 2 Aug; an order placed at 01:30 on 3 Aug Baghdad
    // would be counted against the wrong day.
    expect(naive.toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(baghdadDayKey(EARLY_MORNING)).toBe("2026-08-03");
  });
});

describe("baghdadDayKey", () => {
  it.each([
    ["01:30 Baghdad", EARLY_MORNING],
    ["04:00 Baghdad", MORNING],
    ["23:30 Baghdad", LATE_NIGHT],
  ])("labels %s as 2026-08-03", (_label, at) => {
    expect(baghdadDayKey(at)).toBe("2026-08-03");
  });

  it("is NOT the day-start instant re-serialized", () => {
    // This is the trap: startOfBaghdadDay returns 21:00 UTC on the PREVIOUS
    // day, so slicing its ISO string yields a date one day early. A trend chart
    // built that way is consistently mislabelled.
    const wrong = startOfBaghdadDay(MORNING).toISOString().slice(0, 10);
    expect(wrong).toBe("2026-08-02");
    expect(baghdadDayKey(MORNING)).toBe("2026-08-03");
  });
});

describe("startOfBaghdadDayOffset", () => {
  it("walks back whole Baghdad days", () => {
    expect(startOfBaghdadDayOffset(1, MORNING).toISOString()).toBe("2026-08-01T21:00:00.000Z");
    expect(startOfBaghdadDayOffset(7, MORNING).toISOString()).toBe("2026-07-26T21:00:00.000Z");
  });

  it("keeps consecutive buckets exactly 24h apart", () => {
    const days = Array.from({ length: 7 }, (_, i) => startOfBaghdadDayOffset(i, MORNING).getTime());
    for (let i = 1; i < days.length; i++) {
      expect(days[i - 1] - days[i]).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe("startOfBaghdadMonth", () => {
  it("starts at Baghdad midnight on the 1st", () => {
    // 1 Aug 2026 Baghdad midnight == 31 Jul 2026 21:00 UTC.
    expect(startOfBaghdadMonth(MORNING).toISOString()).toBe("2026-07-31T21:00:00.000Z");
  });

  it("does not roll back a month for an early-morning instant", () => {
    // 00:30 Baghdad on 1 Aug == 21:30 UTC on 31 Jul. A UTC-based month start
    // would call this July.
    const firstOfMonthEarly = new Date("2026-07-31T21:30:00.000Z");
    expect(startOfBaghdadMonth(firstOfMonthEarly).toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(baghdadDayKey(firstOfMonthEarly)).toBe("2026-08-01");
  });
});
