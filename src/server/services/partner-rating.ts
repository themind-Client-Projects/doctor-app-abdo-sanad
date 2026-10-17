import { prisma } from "@/lib/prisma";
import { PROVIDER_SLOTS_IN_PRECEDENCE } from "@/lib/order-slots";

/**
 * A partner's star rating, derived from what patients actually said.
 *
 * `Partner.rating` is read on six surfaces — the doctor directory, the browse
 * lists, the complex pages, search, the offers strip and the doctor profile —
 * and NOTHING in the codebase ever wrote it. Every value was the one `seed.ts`
 * invented, frozen for good, and systematically flattering: صيدلية الرازي
 * displayed 4.7 against a real average of 3.92 across its 12 ratings, and
 * د. علي الجبوري displayed 4.8 against 4.07 across 15. Thirty-five of the
 * forty-one partners carried a rating with no feedback behind it at all.
 *
 * `PatientFeedback` is the only quality signal the platform holds, and it has
 * been written since the order-rating endpoint landed. This closes the loop:
 * the column is now a cache of that table rather than a number somebody typed.
 *
 * ATTRIBUTION follows the rule `/api/partners/[id]/performance` already uses —
 * a partner owns the feedback on any order it was assigned to, in any slot.
 * That page already shows a partner exactly those comments as "theirs", so
 * scoring them on the same set is the only way the two can agree.
 *
 * Recomputed from scratch rather than nudged incrementally: a running average
 * drifts, and an edited rating (the endpoint upserts — a patient may change
 * their mind) would need the old value to undo. A full average over a handful
 * of rows is cheap and cannot drift.
 */

/** Orders this partner was assigned to, in any provider slot. */
function assignedToPartner(partnerId: string) {
  return { OR: PROVIDER_SLOTS_IN_PRECEDENCE.map((slot) => ({ [slot]: partnerId })) };
}

export type PartnerRating = { average: number; count: number };

/** What patients have actually said about this partner. Does not write. */
export async function readPartnerRating(partnerId: string): Promise<PartnerRating> {
  const agg = await prisma.patientFeedback.aggregate({
    where: { order: { is: assignedToPartner(partnerId) } },
    _avg: { rating: true },
    _count: true,
  });
  return {
    // Two decimals: the column is a Float and the UI prints one place, but
    // rounding at write time would make the stored number disagree with the
    // same average recomputed later.
    average: agg._count === 0 ? 0 : Number((agg._avg.rating ?? 0).toFixed(2)),
    count: agg._count,
  };
}

/**
 * Recompute and store one partner's rating.
 *
 * Zero when nobody has rated them — NOT a neutral 3, and not the seeded value
 * left in place. Every patient-facing surface already hides the chip at 0,
 * which is the honest rendering of "not rated yet".
 */
export async function recomputePartnerRating(partnerId: string): Promise<PartnerRating> {
  const rating = await readPartnerRating(partnerId);
  await prisma.partner.update({
    where: { id: partnerId },
    data: { rating: rating.average },
  });
  return rating;
}

/**
 * Recompute every partner assigned to one order.
 *
 * Called after a patient rates it. An order can carry several providers — a
 * nurse and the driver who brought them — and the feedback is on the ORDER, so
 * each assigned partner's average moves. That matches the performance page,
 * which shows that same comment to each of them.
 */
export async function recomputeRatingsForOrder(orderId: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      assignedDoctorId: true,
      assignedLabId: true,
      assignedPharmacyId: true,
      assignedRadiologyId: true,
      assignedNurseId: true,
      assignedDriverId: true,
    },
  });
  if (!order) return [];

  const partnerIds = [...new Set(Object.values(order).filter((v): v is string => Boolean(v)))];
  await Promise.all(partnerIds.map((id) => recomputePartnerRating(id)));
  return partnerIds;
}

/**
 * Recompute every partner on the platform.
 *
 * For the one-off backfill that replaces the seeded values, and safe to re-run.
 */
export async function recomputeAllPartnerRatings(): Promise<{ updated: number; rated: number }> {
  const partners = await prisma.partner.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let rated = 0;
  for (const p of partners) {
    const r = await recomputePartnerRating(p.id);
    if (r.count > 0) rated += 1;
  }
  return { updated: partners.length, rated };
}
