import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { amount, nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const updatePricingSchema = z
  .object({
    serviceType: nonEmpty.optional(),
    basePrice: amount.optional(),
    // Nullable columns: an explicit `null` clears them.
    sanadPrice: amount.nullish(),
    complexPrice: amount.nullish(),
    discountPercent: amount.nullish(),
    isActive: z.boolean().optional(),
  })
  .strict();

// PUT /api/pricing/[id] — the body used to be spread straight into update.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, updatePricingSchema);

  const data = await prisma.priceConfig.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      serviceType: input.serviceType,
      basePrice: input.basePrice,
      sanadPrice: input.sanadPrice,
      complexPrice: input.complexPrice,
      discountPercent: input.discountPercent,
      isActive: input.isActive,
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.priceConfig.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
