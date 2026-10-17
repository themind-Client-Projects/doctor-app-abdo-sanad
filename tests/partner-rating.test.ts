import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  readPartnerRating,
  recomputePartnerRating,
  recomputeRatingsForOrder,
} from "@/server/services/partner-rating";

/**
 * A partner's star rating is the average of what patients actually said.
 *
 * `Partner.rating` was read on six patient surfaces and written by nothing, so
 * every score was the one `seed.ts` invented — and flattering: صيدلية الرازي
 * displayed 4.7 against a real 3.92 across its 12 ratings, and 35 of 41
 * partners carried a rating with no feedback behind it at all.
 *
 * These run against the real tables because the thing worth pinning is the
 * ATTRIBUTION: feedback reaches a partner through `Order`'s six assignment
 * columns, and a join through the wrong one silently scores somebody else.
 */

const SLOTS = [
  "assignedDoctorId",
  "assignedLabId",
  "assignedPharmacyId",
  "assignedRadiologyId",
  "assignedNurseId",
  "assignedDriverId",
] as const;

let createdFeedbackId: string | null = null;
let touchedPartnerIds: string[] = [];

afterAll(async () => {
  if (createdFeedbackId) {
    await prisma.patientFeedback.delete({ where: { id: createdFeedbackId } }).catch(() => {});
    // Leave the averages as they were found.
    await Promise.all(touchedPartnerIds.map((id) => recomputePartnerRating(id)));
  }
});

describe("partner rating", () => {
  it("equals the average of the feedback on that partner's own orders", async () => {
    const partner = await prisma.partner.findFirst({
      where: { rating: { gt: 0 }, deletedAt: null },
      select: { id: true, name: true, rating: true },
    });
    if (!partner) {
      console.warn("SKIP: no rated partner fixture");
      return;
    }

    // Computed here independently, from the rows themselves.
    const rows = await prisma.patientFeedback.findMany({
      where: { order: { is: { OR: SLOTS.map((s) => ({ [s]: partner.id })) } } },
      select: { rating: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    const expected = Number(
      (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(2)
    );

    const read = await readPartnerRating(partner.id);
    expect(read.count).toBe(rows.length);
    expect(read.average).toBe(expected);
    // And the stored column agrees with the live computation.
    expect(partner.rating).toBe(expected);
  });

  it("is 0 — not a seeded number — for a partner nobody has rated", async () => {
    const unrated = await prisma.partner.findFirst({
      where: { deletedAt: null, rating: 0 },
      select: { id: true },
    });
    if (!unrated) {
      console.warn("SKIP: every partner has feedback");
      return;
    }
    const read = await readPartnerRating(unrated.id);
    expect(read.count).toBe(0);
    expect(read.average).toBe(0);
  });

  it("moves when a patient rates an order, for every partner on it", async () => {
    // An order with an assigned provider and no feedback yet.
    const order = await prisma.order.findFirst({
      where: {
        deletedAt: null,
        feedbacks: { none: {} },
        OR: SLOTS.map((s) => ({ [s]: { not: null } })),
      },
      select: {
        id: true,
        patientId: true,
        assignedDoctorId: true,
        assignedLabId: true,
        assignedPharmacyId: true,
        assignedRadiologyId: true,
        assignedNurseId: true,
        assignedDriverId: true,
      },
    });
    if (!order) {
      console.warn("SKIP: no unrated order with a provider");
      return;
    }

    const partnerIds = [
      ...new Set(
        SLOTS.map((s) => order[s as keyof typeof order] as string | null).filter(
          (v): v is string => Boolean(v)
        )
      ),
    ];
    touchedPartnerIds = partnerIds;
    const before = await Promise.all(partnerIds.map((id) => readPartnerRating(id)));

    const fb = await prisma.patientFeedback.create({
      data: { orderId: order.id, patientId: order.patientId, rating: 1, comment: "vitest" },
      select: { id: true },
    });
    createdFeedbackId = fb.id;

    const recomputed = await recomputeRatingsForOrder(order.id);
    expect(recomputed.sort()).toEqual(partnerIds.sort());

    // A 1-star rating must drag every assigned partner's average down, and the
    // count must rise by exactly one for each.
    for (let i = 0; i < partnerIds.length; i += 1) {
      const after = await readPartnerRating(partnerIds[i]);
      expect(after.count).toBe(before[i].count + 1);
      if (before[i].count > 0) expect(after.average).toBeLessThan(before[i].average);

      const stored = await prisma.partner.findUniqueOrThrow({
        where: { id: partnerIds[i] },
        select: { rating: true },
      });
      expect(stored.rating).toBe(after.average);
    }
  });
});
