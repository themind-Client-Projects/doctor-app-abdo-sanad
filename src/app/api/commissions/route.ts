import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody, percentage, serviceTypeSchema } from "@/lib/validation";

const createCommissionSchema = z
  .object({
    contractId: z.string().trim().min(1, { message: "العقد ونوع الخدمة مطلوبان" }),
    serviceType: serviceTypeSchema,
    partnerShare: percentage,
    waridShare: percentage,
    complexShare: percentage.default(0),
    nurseShare: percentage.default(0),
    driverShare: percentage.default(0),
  })
  .strict()
  // Enforced at SAVE time, not only at settlement. A rule totalling 120% used
  // to save cleanly and then fail for every order of that partner — surfacing
  // only as a string inside a 200 OK, so revenue silently stopped moving.
  .refine(
    (v) =>
      v.partnerShare + v.waridShare + v.complexShare + v.nurseShare + v.driverShare === 100,
    { message: "مجموع النسب يجب أن يساوي 100%", path: ["partnerShare"] }
  );

// GET /api/commissions — List commission rules (req L210-230 ⭐)
//
// NOT cursor-paginated: `CommissionRule` has no `createdAt` column, so there is
// no stable keyset to page over. It is bounded in practice by
// @@unique([contractId, serviceType]) — at most one rule per service per
// contract — but it still grows with the number of contracts. Paging it needs a
// `createdAt` on the model first.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.commissionRule.findMany({
    include: {
      contract: {
        select: {
          partnerId: true,
          isActive: true,
          endDate: true,
          // The admin screen needs a name to show; a partner id is not usable
          // in a UI that claims to display contract-driven percentages.
          partner: { select: { name: true, type: true } },
        },
      },
    },
    orderBy: [{ contractId: "asc" }, { serviceType: "asc" }],
  });
  return ok(data, { requestId });
});

// POST /api/commissions — Create commission rule.
// The body used to be spread into create with no validation at all, so the
// revenue split (the most critical config in the product) could be written with
// missing or nonsense values.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createCommissionSchema);

  const data = await prisma.commissionRule.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      contractId: input.contractId,
      serviceType: input.serviceType,
      partnerShare: input.partnerShare,
      waridShare: input.waridShare,
      complexShare: input.complexShare,
      nurseShare: input.nurseShare,
      driverShare: input.driverShare,
    },
  });

  return ok(data, { status: 201, requestId });
});
