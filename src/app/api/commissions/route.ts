import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
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
  // `?history=1` returns every version, newest first — "what was this partner's
  // share last month" is exactly what versioning exists to answer.
  const history = req.nextUrl.searchParams.get("history") === "1";
  // Validated, not passed through: an unknown value would be a Prisma enum
  // error (a 500) rather than a bad request.
  const rawService = req.nextUrl.searchParams.get("serviceType");
  const parsedService = rawService ? serviceTypeSchema.safeParse(rawService) : null;
  const serviceFilter = parsedService?.success ? parsedService.data : undefined;

  const data = await prisma.commissionRule.findMany({
    // Only the version in force. Closed versions are history: showing them
    // beside live rules would read as several conflicting splits for one
    // service. They stay reachable through the order that was settled under
    // them, and through ?history=1 below.
    where: history ? (serviceFilter ? { serviceType: serviceFilter } : {}) : { effectiveTo: null },
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
    orderBy: history
      ? [{ contractId: "asc" }, { serviceType: "asc" }, { effectiveFrom: "desc" }]
      : [{ contractId: "asc" }, { serviceType: "asc" }],
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

  // One OPEN version per (contract, service) — enforced by a partial unique
  // index. Checked here so the answer names the problem.
  const existing = await prisma.commissionRule.findFirst({
    where: { contractId: input.contractId, serviceType: input.serviceType, effectiveTo: null },
    select: { id: true },
  });
  if (existing) {
    return fail(
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      "لهذه الخدمة قاعدة سارية في هذا العقد — عدّلها بدلاً من إضافة قاعدة جديدة",
      { requestId }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
    select: { startDate: true },
  });
  if (!contract) {
    return fail(ErrorCode.NOT_FOUND, 404, "العقد غير موجود", { requestId });
  }

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
