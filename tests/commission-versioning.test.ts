import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveCommissionRule } from "@/server/services/commission";

const D = Prisma.Decimal;

/**
 * Commission percentages are versioned, and settlement resolves the version
 * that was in force WHEN THE ORDER WAS PLACED.
 *
 * Two failures this prevents:
 *
 *   1. Editing a rate used to overwrite the row, so "what was this partner's
 *      share last month" became unanswerable — and an already-settled order
 *      could no longer be explained from its own rule.
 *
 *   2. Settlement resolved "the current rule" at COMPLETION time, so raising a
 *      percentage silently re-priced every order already delivered but not yet
 *      settled. Money agreed in January was paid at March's rate.
 */

const SERVICE = "LAB_TEST" as const;

/** Sentinel `effectiveTo` marking the real rule this file parked. */
const PARKED = new Date("2098-01-01");

let contractId: string;
let partnerId: string;
const created: string[] = [];

/**
 * The dates these fixtures occupy — deliberately far future.
 *
 * They were 2025-01-01 … 2027-01-01, which collides with real data: seeded
 * contracts start on 2025-01-01, and their rules inherit that `effectiveFrom`.
 * The recovery sweep below deletes "rules on fixture dates", so those dates
 * MUST belong to nothing else — with the old values it deleted live seeded
 * rules and left four labs unable to price a LAB_TEST.
 */
const FIXTURE_DATES = [
  new Date("2099-01-01"),
  new Date("2099-03-01"),
  new Date("2099-06-01"),
  new Date("2099-09-01"),
];

beforeAll(async () => {
  const partner = await prisma.partner.findFirstOrThrow({
    where: { type: "LAB", contract: { isNot: null } },
    select: { id: true, contract: { select: { id: true } } },
  });
  partnerId = partner.id;
  contractId = partner.contract!.id;

  // Recover from a PREVIOUS run that did not finish.
  //
  // These fixtures are real rows in a shared database. When a run dies partway
  // — a dropped connection is enough — its rules survive, and the next run
  // tries to open a second live version for the same service. The partial
  // unique index refuses, this file fails in `beforeAll`, and `order-lifecycle`
  // fails too because a lab it depends on is left with no rule in force. That
  // is exactly what happened once. Recovering here stops one bad run from
  // poisoning every run after it.
  await prisma.commissionRule.deleteMany({
    where: { contractId, serviceType: SERVICE, effectiveFrom: { in: FIXTURE_DATES } },
  });
  await prisma.commissionRule.updateMany({
    where: { contractId, serviceType: SERVICE, effectiveTo: PARKED },
    data: { effectiveTo: null },
  });

  // Park the live rule so the fixtures below own the window.
  await prisma.commissionRule.updateMany({
    where: { contractId, serviceType: SERVICE, effectiveTo: null },
    data: { effectiveTo: PARKED },
  });
});

afterAll(async () => {
  // Delete by shape, not only by the ids this run happens to remember: a test
  // that threw midway may have created rows before `created` was appended to.
  await prisma.commissionRule.deleteMany({
    where: {
      OR: [
        { id: { in: created } },
        { contractId, serviceType: SERVICE, effectiveFrom: { in: FIXTURE_DATES } },
      ],
    },
  });
  // Reopen whatever was live before.
  const parked = await prisma.commissionRule.findFirst({
    where: { contractId, serviceType: SERVICE, effectiveTo: PARKED },
    select: { id: true },
  });
  if (parked) {
    await prisma.commissionRule.update({ where: { id: parked.id }, data: { effectiveTo: null } });
  }
  await prisma.$disconnect();
});

async function addVersion(from: string, to: string | null, partnerShare: number) {
  const rule = await prisma.commissionRule.create({
    data: {
      contractId,
      serviceType: SERVICE,
      partnerShare: new D(partnerShare),
      complexShare: new D(0),
      waridShare: new D(100 - partnerShare),
      nurseShare: new D(0),
      driverShare: new D(0),
      referralShare: new D(0),
      effectiveFrom: new Date(from),
      effectiveTo: to ? new Date(to) : null,
    },
    select: { id: true },
  });
  created.push(rule.id);
  return rule.id;
}

describe("resolveCommissionRule picks the version in force at a given instant", () => {
  beforeAll(async () => {
    // Three eras: 60% until March, 70% until June, 80% from June onward.
    await addVersion("2099-01-01", "2099-03-01", 60);
    await addVersion("2099-03-01", "2099-06-01", 70);
    await addVersion("2099-06-01", null, 80);
  });

  it.each([
    ["mid-January", "2099-01-15", 60],
    ["the instant before a boundary", "2099-02-28T23:59:59Z", 60],
    ["exactly on a boundary — the NEW version owns it", "2099-03-01T00:00:00Z", 70],
    ["mid-April", "2099-04-10", 70],
    ["after the last boundary", "2099-07-01", 80],
    ["far beyond the last boundary — the open version still applies", "2100-01-01", 80],
  ])("resolves %s to %i%%", async (_label, at, expected) => {
    const rule = await resolveCommissionRule(partnerId, SERVICE, new Date(at));
    expect(Number(rule.partnerShare)).toBe(expected);
  });

  it("refuses an instant before any version existed, rather than guessing", async () => {
    await expect(
      resolveCommissionRule(partnerId, SERVICE, new Date("2098-06-01"))
    ).rejects.toThrow();
  });

  it("keeps an old order on its original rate after a later change", async () => {
    const orderDate = new Date("2099-01-15");
    const before = await resolveCommissionRule(partnerId, SERVICE, orderDate);

    // A new era opens — CLOSE the live version first, then open the new one.
    // That order is not incidental: a partial unique index allows only one open
    // version per (contract, service), so opening before closing is refused
    // outright. The API closes and re-opens inside one transaction for exactly
    // this reason.
    await prisma.commissionRule.updateMany({
      where: { contractId, serviceType: SERVICE, effectiveTo: null },
      data: { effectiveTo: new Date("2099-09-01") },
    });
    await addVersion("2099-09-01", null, 40);

    const after = await resolveCommissionRule(partnerId, SERVICE, orderDate);
    expect(Number(after.partnerShare)).toBe(Number(before.partnerShare));
    expect(Number(after.partnerShare)).toBe(60);

    // …while a new order gets the new rate.
    const fresh = await resolveCommissionRule(partnerId, SERVICE, new Date("2099-10-01"));
    expect(Number(fresh.partnerShare)).toBe(40);
  });
});
