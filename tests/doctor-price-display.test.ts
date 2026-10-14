import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/format";

/**
 * A doctor's fee is a DISPLAY STRING, and "" is how the API says "unknown".
 *
 * `/api/public/doctors` emits `price: channelPrice === null ? "" : String(...)`,
 * so a specialty with no PriceConfig row sent "" — and the patient screens
 * rendered it bare, which React draws as nothing. The fee line vanished with
 * no indication that a price existed at all. Every one of those surfaces now
 * goes through `formatCurrency`, which turns "" into "—".
 *
 * The second case is the trap that comes with that decision: `formatCurrency`
 * maps ANY non-numeric string to the same "—". A value already formatted for
 * display — `'50,000 د.ع'`, the shape in `constants/demo-data.ts` — would
 * therefore be shown as "unknown" while being perfectly well known. No live
 * path feeds that shape into these components today (every call site reads the
 * API), and this test is here so that stays true: if someone wires a demo
 * fallback behind the doctor card, this is the line that should make them stop.
 */
describe("doctor fee display", () => {
  it("renders an unknown fee as — rather than as nothing", () => {
    expect(formatCurrency("")).toBe("—");
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });

  it("formats the numeric string the API actually sends", () => {
    // `String(channelPrice)` — a bare integer, never pre-formatted.
    expect(formatCurrency("25000")).toContain("25,000");
    expect(formatCurrency("25000")).toContain("د.ع");
  });

  it("turns an ALREADY-formatted price into — , which is why none may be passed", () => {
    expect(formatCurrency("50,000 د.ع")).toBe("—");
  });
});
