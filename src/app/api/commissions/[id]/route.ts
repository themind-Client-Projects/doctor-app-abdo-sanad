import { z } from "zod";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody, percentage, serviceTypeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `contractId` is deliberately absent — a rule must not be repointed at another
// partner's contract. `.strict()` makes an attempt to do so a 400.
const updateCommissionSchema = z
  .object({
    serviceType: serviceTypeSchema.optional(),
    partnerShare: percentage.optional(),
    complexShare: percentage.optional(),
    waridShare: percentage.optional(),
    nurseShare: percentage.optional(),
    driverShare: percentage.optional(),
    referralShare: percentage.optional(),
  })
  .strict();

/** Raised when another request closed this version first. */
class SupersededError extends Error {}

// PUT /api/commissions/[id] — update a commission rule.
// The body used to be spread into update, so `contractId` could be repointed at
// another partner's contract and the shares accepted any value.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateCommissionSchema);

  // Every field is optional, so the sum can only be checked against the MERGED
  // row. `PUT {"partnerShare": 90}` on a rule already holding waridShare 10 +
  // nurseShare 20 used to save a rule totalling 120%, which then failed for
  // every order of that partner — visible only as a string inside a 200 OK.
  const current = await prisma.commissionRule.findUnique({
    where: { id },
    select: {
      contractId: true,
      serviceType: true,
      partnerShare: true,
      complexShare: true,
      waridShare: true,
      nurseShare: true,
      driverShare: true,
      referralShare: true,
      effectiveTo: true,
    },
  });
  if (!current) {
    return fail(ErrorCode.NOT_FOUND, 404, "القاعدة غير موجودة", { requestId });
  }

  // Editing a version that is already closed would fork history.
  if (current.effectiveTo !== null) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      409,
      "هذه نسخة تاريخية — عدّل النسخة السارية",
      { requestId }
    );
  }

  const merged = {
    partnerShare: input.partnerShare ?? Number(current.partnerShare),
    complexShare: input.complexShare ?? Number(current.complexShare),
    waridShare: input.waridShare ?? Number(current.waridShare),
    nurseShare: input.nurseShare ?? Number(current.nurseShare),
    driverShare: input.driverShare ?? Number(current.driverShare),
    referralShare: input.referralShare ?? Number(current.referralShare),
  };
  const total =
    merged.partnerShare +
    merged.complexShare +
    merged.waridShare +
    merged.nurseShare +
    merged.driverShare +
    merged.referralShare;

  if (total !== 100) {
    return fail(
      ErrorCode.VALIDATION_FAILED,
      400,
      `مجموع النسب يجب أن يساوي 100% (الناتج: ${total}%)`,
      { requestId }
    );
  }

  // A rate change CLOSES the current version and opens a new one — it never
  // rewrites the row.
  //
  // Overwriting destroyed the answer to "what was this partner's share last
  // month", and worse: settlement resolves the rule in force at the ORDER's
  // creation date, so an in-place edit silently re-priced every order already
  // delivered but not yet settled. Versioning makes the change apply from now
  // on and leaves everything before it alone.
  // A rate change CLOSES the current version and opens a new one — it never
  // rewrites the row.
  //
  // Overwriting destroyed the answer to "what was this partner's share last
  // month", and worse: settlement resolves the rule in force at the ORDER's
  // creation date, so an in-place edit silently re-priced every order already
  // delivered but not yet settled. Versioning applies the change from now on
  // and leaves everything before it untouched.
  const now = new Date();

  try {
    const data = await prisma.$transaction(async (tx) => {
      const closed = await tx.commissionRule.updateMany({
        // Guarded on `effectiveTo: null` so two concurrent edits cannot both
        // close the same version and leave two open ones behind.
        where: { id, effectiveTo: null },
        data: { effectiveTo: now },
      });
      if (closed.count === 0) throw new SupersededError();

      return tx.commissionRule.create({
        data: {
          contractId: current.contractId,
          serviceType: input.serviceType ?? current.serviceType,
          partnerShare: merged.partnerShare,
          complexShare: merged.complexShare,
          waridShare: merged.waridShare,
          nurseShare: merged.nurseShare,
          driverShare: merged.driverShare,
          referralShare: merged.referralShare,
          effectiveFrom: now,
        },
      });
    }, TX_OPTIONS);

    return ok(data, { requestId });
  } catch (error) {
    if (error instanceof SupersededError) {
      return fail(
        ErrorCode.DUPLICATE_RESOURCE,
        409,
        "عُدّلت هذه القاعدة من جلسة أخرى — أعد التحميل وحاول مجدداً",
        { requestId }
      );
    }
    throw error;
  }
});

// DELETE /api/commissions/[id] — stop applying this rule from now on.
//
// Closes the version rather than erasing the row. A hard delete would take the
// percentages of every ALREADY-SETTLED order down with it, since settlement
// resolves by the order's date — the history has to survive for those orders to
// remain explainable.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const closed = await prisma.commissionRule.updateMany({
    where: { id, effectiveTo: null },
    data: { effectiveTo: new Date() },
  });
  if (closed.count === 0) {
    return fail(ErrorCode.NOT_FOUND, 404, "القاعدة غير موجودة أو مغلقة مسبقاً", { requestId });
  }

  return ok({ message: "تم إيقاف العمل بالقاعدة" }, { requestId });
});
