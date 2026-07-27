import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, parseBody, percentage } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `contractId` is deliberately absent — a rule must not be repointed at another
// partner's contract. `.strict()` makes an attempt to do so a 400.
const updateCommissionSchema = z
  .object({
    serviceType: nonEmpty.optional(),
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
  const { id } = await params;
  const input = await parseBody(req, updateCommissionSchema);

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

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.commissionRule.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
