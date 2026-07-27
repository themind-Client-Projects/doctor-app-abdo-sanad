import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
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
  .strict();

// GET /api/commissions — List commission rules (req L210-230 ⭐)
export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.commissionRule.findMany({
    include: { contract: { select: { partnerId: true } } },
  });
  return NextResponse.json({ data });
});

// POST /api/commissions — Create commission rule.
// The body used to be spread into create with no validation at all, so the
// revenue split (the most critical config in the product) could be written with
// missing or nonsense values.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
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

  return NextResponse.json({ data }, { status: 201 });
});
