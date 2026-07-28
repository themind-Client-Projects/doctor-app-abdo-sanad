import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  })
  .strict();

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
      partnerShare: true,
      complexShare: true,
      waridShare: true,
      nurseShare: true,
      driverShare: true,
    },
  });
  if (!current) {
    return fail(ErrorCode.NOT_FOUND, 404, "القاعدة غير موجودة", { requestId });
  }

  const merged = {
    partnerShare: input.partnerShare ?? Number(current.partnerShare),
    complexShare: input.complexShare ?? Number(current.complexShare),
    waridShare: input.waridShare ?? Number(current.waridShare),
    nurseShare: input.nurseShare ?? Number(current.nurseShare),
    driverShare: input.driverShare ?? Number(current.driverShare),
  };
  const total =
    merged.partnerShare +
    merged.complexShare +
    merged.waridShare +
    merged.nurseShare +
    merged.driverShare;

  if (total !== 100) {
    return fail(
      ErrorCode.VALIDATION_FAILED,
      400,
      `مجموع النسب يجب أن يساوي 100% (الناتج: ${total}%)`,
      { requestId }
    );
  }

  const data = await prisma.commissionRule.update({
    where: { id },
    // Explicit allow-list — contractId is not rewritable here.
    data: {
      serviceType: input.serviceType,
      partnerShare: input.partnerShare,
      complexShare: input.complexShare,
      waridShare: input.waridShare,
      nurseShare: input.nurseShare,
      driverShare: input.driverShare,
    },
  });

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  await prisma.commissionRule.delete({ where: { id } });
  return ok({ message: "تم الحذف" }, { requestId });
});
