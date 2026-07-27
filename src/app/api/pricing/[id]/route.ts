import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { amount, nonEmpty, parseBody, serviceTypeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const updatePricingSchema = z
  .object({
    serviceType: serviceTypeSchema.optional(),
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
  const requestId = req.headers.get("x-request-id") ?? undefined;
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

  return ok(data, { requestId });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  await prisma.priceConfig.delete({ where: { id } });
  return ok({ message: "تم الحذف" }, { requestId });
});
