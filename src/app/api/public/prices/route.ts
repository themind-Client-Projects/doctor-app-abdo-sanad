import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery, serviceTypeSchema } from "@/lib/validation";

/**
 * GET /api/public/prices — what a service costs in a given storefront.
 *
 * `PriceConfig` has a row per `ServiceType` with a base, a سند and a complex
 * price, and every one of them is real and admin-editable. Nothing public
 * exposed it except the doctors endpoints, which read the consultation rows
 * for their own quote — so every other patient screen that needed to show a
 * price wrote one into its source instead. تكسي سند advertised three tiers at
 * 5,000 / 12,000 / 15,000 while the single real TAXI row says 7,500 (6,000 in
 * سند), and حجز العمليات did the same for surgery.
 *
 * The channel precedence here is the one `quoteService()` applies when the
 * order is actually placed, so a screen cannot advertise a number the checkout
 * then contradicts.
 */

const querySchema = z.object({
  service: serviceTypeSchema,
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
});

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { service, channel } = parseQuery(req.nextUrl.searchParams, querySchema);

  const row = await prisma.priceConfig.findUnique({
    where: { serviceType: service },
    select: { basePrice: true, sanadPrice: true, complexPrice: true },
  });

  // `null`, not 0 — an unpriced service is not a free one, and the caller must
  // be able to say "السعر غير محدد" rather than advertising nothing to pay.
  if (!row) return ok({ serviceType: service, channel, price: null }, { requestId });

  const price =
    channel === "SANAD"
      ? (row.sanadPrice ?? row.basePrice)
      : channel === "COMPLEX"
        ? (row.complexPrice ?? row.basePrice)
        : row.basePrice;

  return ok({ serviceType: service, channel, price }, { requestId });
});
