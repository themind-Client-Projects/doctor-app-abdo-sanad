import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CommissionError, computeSplit, type ShareInput } from "@/server/services/commission";

const D = Prisma.Decimal;
const pct = (n: number | string) => new D(n);

/**
 * The referrer is a settlement party in its own right.
 *
 * A complex member plays two roles that must never be conflated:
 *
 *   - PARTNER  — it performed the service itself
 *   - REFERRER — it sent the patient to ANOTHER member, and takes a cut of
 *                that member's order
 *
 * On a referred lab test the lab is the PARTNER and the referring doctor is the
 * REFERRER — same order, different percentages. And the referrer is any member,
 * not only a doctor: a lab may refer on to the complex's pharmacy exactly as a
 * doctor refers to the lab.
 *
 * Before this existed a doctor could not be a provider at all: `settleOrder`
 * only ever resolved lab / pharmacy / radiology / nurse / driver, so the seed
 * wrote doctors into `assignedNurseId` — 44 orders paid a doctor through the
 * nurse slot.
 */

const share = (party: ShareInput["party"], partnerId: string | null, p: number): ShareInput => ({
  party,
  partnerId,
  percentage: pct(p),
});

const allocated = (shares: { amount: Prisma.Decimal }[]) =>
  shares.reduce((acc, s) => acc.plus(s.amount), new D(0));

describe("a referred order splits between provider, referrer, complex and platform", () => {
  it("pays the lab, the referring doctor, the complex and the platform exactly", () => {
    const total = new D(100_000);
    const shares = computeSplit(total, [
      share("PARTNER", "lab-1", 60),
      share("REFERRER", "doctor-1", 15),
      share("COMPLEX", "complex-1", 15),
      share("WARID", null, 10),
    ]);

    const by = Object.fromEntries(shares.map((s) => [s.party, s.amount.toString()]));
    expect(by.PARTNER).toBe("60000");
    expect(by.REFERRER).toBe("15000");
    expect(by.COMPLEX).toBe("15000");
    expect(by.WARID).toBe("10000");
    // Conservation: the split must never create or lose money.
    expect(allocated(shares).equals(total)).toBe(true);
  });

  it("keeps the provider and the referrer distinct even when both are the same type", () => {
    // A doctor performing a service AND a different doctor having referred.
    const shares = computeSplit(new D(50_000), [
      share("PARTNER", "doctor-provider", 70),
      share("REFERRER", "doctor-referrer", 20),
      share("WARID", null, 10),
    ]);

    const partner = shares.find((s) => s.party === "PARTNER");
    const referrer = shares.find((s) => s.party === "REFERRER");
    expect(partner?.partnerId).toBe("doctor-provider");
    expect(referrer?.partnerId).toBe("doctor-referrer");
    expect(partner?.partnerId).not.toBe(referrer?.partnerId);
  });

  it("still refuses a split that does not total 100%", () => {
    expect(() =>
      computeSplit(new D(100_000), [
        share("PARTNER", "lab-1", 60),
        share("REFERRER", "doctor-1", 15),
        share("WARID", null, 10),
      ])
    ).toThrow(CommissionError);
  });

  it("gives the rounding remainder to the platform, not to the referrer", () => {
    // 3 parties over an amount that does not divide evenly.
    const total = new D("10000.001");
    const shares = computeSplit(total, [
      share("PARTNER", "lab-1", 33),
      share("REFERRER", "doctor-1", 33),
      share("WARID", null, 34),
    ]);
    expect(allocated(shares).equals(total)).toBe(true);
    // The referrer must never be quietly overpaid by the remainder.
    const referrer = shares.find((s) => s.party === "REFERRER")!;
    expect(referrer.amount.equals(total.times(33).dividedBy(100).toDecimalPlaces(3, D.ROUND_DOWN))).toBe(
      true
    );
  });

  it("a consultation with no referrer splits between provider and platform only", () => {
    const shares = computeSplit(new D(25_000), [
      share("PARTNER", "doctor-1", 80),
      share("WARID", null, 20),
    ]);
    expect(shares.some((s) => s.party === "REFERRER")).toBe(false);
    expect(allocated(shares).equals(new D(25_000))).toBe(true);
  });
});
