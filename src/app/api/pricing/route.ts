import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
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

// GET /api/pricing — NOT cursor-paginated: `PriceConfig` has no `createdAt`
// column, so there is no stable keyset to page over. It is genuinely bounded —
// `serviceType` is @unique, so the table holds at most one row per member of the
// ServiceType enum (14 today) and cannot grow past that.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.priceConfig.findMany();
  return ok(data, { requestId });
});

// POST /api/pricing — the body used to be spread into create, so prices were
// written with no type checking at all.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
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

  return ok(data, { status: 201, requestId });
});
