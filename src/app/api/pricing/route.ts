import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { amount, parseBody, serviceTypeSchema } from "@/lib/validation";

const createPricingSchema = z
  .object({
    serviceType: serviceTypeSchema,
    basePrice: amount,
    sanadPrice: amount.nullish(),
    complexPrice: amount.nullish(),
    discountPercent: amount.nullish(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.priceConfig.findMany();
  return NextResponse.json({ data });
});

// POST /api/pricing — the body used to be spread into create, so prices were
// written with no type checking at all.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createPricingSchema);

  const data = await prisma.priceConfig.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      serviceType: input.serviceType,
      basePrice: input.basePrice,
      sanadPrice: input.sanadPrice ?? null,
      complexPrice: input.complexPrice ?? null,
      discountPercent: input.discountPercent ?? null,
      isActive: input.isActive,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
