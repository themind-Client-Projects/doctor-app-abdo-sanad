import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CommissionError, computeSplit, type ShareInput } from "@/server/services/commission";

const D = Prisma.Decimal;
const pct = (n: number | string) => new D(n);

/** Sum of every allocated share — must always equal the order total exactly. */
function allocated(shares: { amount: Prisma.Decimal }[]) {
  return shares.reduce((acc, s) => acc.plus(s.amount), new D(0));
}

const warid = (p: number | string): ShareInput => ({
  party: "WARID",
  partnerId: null,
  percentage: pct(p),
});

describe("computeSplit — money conservation", () => {
  it("splits the requirement's own 70/20/10 example exactly", () => {
    const shares = computeSplit(new D(100_000), [
      { party: "PARTNER", partnerId: "p1", percentage: pct(70) },
      { party: "COMPLEX", partnerId: "c1", percentage: pct(20) },
      warid(10),
    ]);

    expect(allocated(shares).equals(100_000)).toBe(true);
    expect(shares[0].amount.equals(70_000)).toBe(true);
  });

  it("conserves money on a 4-way split of an amount that does not divide cleanly", () => {
    const shares = computeSplit(new D(33_333), [
      { party: "PARTNER", partnerId: "l1", percentage: pct(60) },
      { party: "NURSE", partnerId: "n1", percentage: pct(15) },
      { party: "DRIVER", partnerId: "d1", percentage: pct(10) },
      warid(15),
    ]);

    expect(allocated(shares).equals(33_333)).toBe(true);
  });

  it("does not lose a sub-unit amount to rounding", () => {
    const shares = computeSplit(new D("0.001"), [
      { party: "PARTNER", partnerId: "p", percentage: pct("33.333") },
      warid("66.667"),
    ]);

    expect(allocated(shares).equals(new D("0.001"))).toBe(true);
  });

  it("gives the rounding remainder to the platform, never to a partner", () => {
    const shares = computeSplit(new D("100.001"), [
      { party: "PARTNER", partnerId: "p", percentage: pct("33.333") },
      warid("66.667"),
    ]);

    const partner = shares.find((s) => s.party === "PARTNER")!;
    const platform = shares.find((s) => s.party === "WARID")!;
    // ROUND_DOWN each, remainder to WARID.
    expect(partner.amount.equals(new D("100.001").times(pct("33.333")).dividedBy(100).toDecimalPlaces(3, D.ROUND_DOWN))).toBe(true);
    expect(allocated(shares).equals(new D("100.001"))).toBe(true);
    expect(platform.amount.greaterThan(0)).toBe(true);
  });

  it("accumulates 1000 consecutive splits with zero drift", () => {
    const total = new D("10000.007");
    let running = new D(0);

    for (let i = 0; i < 1000; i++) {
      running = running.plus(
        allocated(
          computeSplit(total, [
            { party: "PARTNER", partnerId: "p", percentage: pct("33.3333") },
            warid("66.6667"),
          ])
        )
      );
    }

    expect(running.equals(total.times(1000))).toBe(true);
  });

  it("handles a zero-value order without producing phantom money", () => {
    const shares = computeSplit(new D(0), [
      { party: "PARTNER", partnerId: "p", percentage: pct(70) },
      warid(30),
    ]);
    expect(allocated(shares).isZero()).toBe(true);
  });
});

describe("computeSplit — refusal cases", () => {
  it("rejects shares that do not total 100%", () => {
    expect(() =>
      computeSplit(new D(1000), [
        { party: "PARTNER", partnerId: "p", percentage: pct(70) },
        warid(20),
      ])
    ).toThrowError(CommissionError);
  });

  it("rejects shares that exceed 100%", () => {
    expect(() =>
      computeSplit(new D(1000), [
        { party: "PARTNER", partnerId: "p", percentage: pct(90) },
        warid(30),
      ])
    ).toThrowError(CommissionError);
  });

  it("refuses to place the remainder when there is no platform share", () => {
    // Regression guard: this used to fall back to `computed[0]`, silently
    // handing the rounding remainder to the partner.
    expect(() =>
      computeSplit(new D("100.001"), [
        { party: "PARTNER", partnerId: "p", percentage: pct("33.333") },
        { party: "NURSE", partnerId: "n", percentage: pct("66.667") },
      ])
    ).toThrowError(/حصة للمنصة/);
  });

  it("rejects an empty share set", () => {
    expect(() => computeSplit(new D(1000), [])).toThrowError(CommissionError);
  });
});
