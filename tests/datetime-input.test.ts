import { describe, expect, it } from "vitest";
import { toDateTimeInput } from "@/lib/format";

/**
 * A `datetime-local` round trip must be lossless, or a blood draw moves.
 *
 * The operations blood-bank dialog seeded its input with `iso.slice(0, 16)` —
 * the UTC wall clock — which the browser then rendered as a LOCAL wall clock.
 * On submit `new Date(value).toISOString()` read it back as local, so a draw
 * stored at 09:00 Baghdad was displayed as 06:00 and re-stored as 06:00
 * Baghdad: three hours earlier, on every save, compounding. The dialog also
 * read back the wrong time, so an employee quoting the appointment to a donor
 * by phone was wrong even without saving.
 *
 * The property that matters is the round trip, so that is what is asserted —
 * it holds in whatever zone the test runner happens to be in, which is also
 * the honest way to test it.
 */
describe("toDateTimeInput", () => {
  it("is the exact inverse of new Date() on the same machine", () => {
    const original = new Date("2026-10-11T06:00:00.000Z");
    const roundTripped = new Date(toDateTimeInput(original.toISOString()));
    expect(roundTripped.getTime()).toBe(original.getTime());
  });

  it("does not drift when the value is saved repeatedly", () => {
    // The old slice lost three hours per save. Ten saves must lose nothing.
    let iso = new Date("2026-10-11T06:00:00.000Z").toISOString();
    for (let i = 0; i < 10; i++) {
      iso = new Date(toDateTimeInput(iso)).toISOString();
    }
    expect(iso).toBe("2026-10-11T06:00:00.000Z");
  });

  it("renders the browser's own wall clock, not the UTC one", () => {
    const iso = "2026-10-11T06:00:00.000Z";
    const d = new Date(iso);
    const expectedHour = String(d.getHours()).padStart(2, "0");
    expect(toDateTimeInput(iso)).toContain(`T${expectedHour}:`);
  });

  it("treats an absent or unparseable value as an empty input", () => {
    expect(toDateTimeInput(null)).toBe("");
    expect(toDateTimeInput(undefined)).toBe("");
    expect(toDateTimeInput("")).toBe("");
    expect(toDateTimeInput("not a date")).toBe("");
  });
});
