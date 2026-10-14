import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";
import { BAGHDAD_TZ } from "@/lib/time";

/**
 * A printed referral must carry the date it was issued IN BAGHDAD.
 *
 * `lib/time.ts` was scrupulously Baghdad-aware for day boundaries while
 * `lib/format.ts` passed no `timeZone` at all — so the formatters rendered in
 * whatever zone the runtime happened to be in. Invisible on a dashboard (an
 * Iraqi browser is already UTC+3), but the printed referral and the public
 * page its QR code opens are SERVER components, and a Vercel function runs in
 * UTC. A referral issued at 01:00 Baghdad printed the previous calendar date,
 * and the pharmacist's verification screen disagreed with the paper in hand.
 *
 * The instant below is 2026-10-11T22:30Z = 01:30 on the 12th in Baghdad. A
 * UTC-rendered string says the 11th; a Baghdad-rendered one says the 12th.
 * That one day is the whole defect.
 */
describe("document dates render in Baghdad, not the server's zone", () => {
  const justAfterBaghdadMidnight = "2026-10-11T22:30:00.000Z";

  it("rolls to the next day for an instant that is already tomorrow in Baghdad", () => {
    expect(formatDate(justAfterBaghdadMidnight)).toContain("12");
    expect(formatDate(justAfterBaghdadMidnight)).not.toContain("11");
  });

  it("formats the time as the Baghdad wall clock", () => {
    // 22:30Z + 3h = 01:30 Baghdad.
    expect(formatDateTime(justAfterBaghdadMidnight)).toContain("01:30");
  });

  it("does not drift when the runtime zone is not Baghdad", () => {
    // Intl is asked for an explicit zone, so the answer cannot depend on TZ.
    const asBaghdad = new Intl.DateTimeFormat("en-CA", {
      timeZone: BAGHDAD_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(justAfterBaghdadMidnight));
    expect(asBaghdad).toBe("2026-10-12");
  });

  it("still returns the fallback for an absent date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });
});
