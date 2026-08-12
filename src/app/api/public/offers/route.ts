import { z } from "zod";
import type { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { SERVICE_TYPE_LABELS } from "@/lib/labels";

/**
 * GET /api/public/offers — العروض الطبية.
 *
 * The card shows a before-and-after price, and BOTH are derived here rather
 * than stored: the "before" is the live `PriceConfig` for the targeted service
 * in this channel, and the "after" applies the campaign's own discount. Storing
 * either would let a card advertise a saving that the checkout then contradicts
 * the moment an admin edits a price.
 *
 * `expiresInDays` is sent as a number, not a phrase. "يومين" is a rendering
 * decision, and a server that ships prose cannot be localised or re-sorted by
 * the client.
 */

const querySchema = z.object({
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
  /** A `ServiceType` member — the category chips filter on this. */
  service: z.string().trim().optional(),
  governorate: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

/** The channel decides the "before" price, exactly as `quoteService` does. */
function basePriceFor(
  cfg: { basePrice: unknown; sanadPrice: unknown; complexPrice: unknown } | undefined,
  channel: "DIRECT" | "SANAD" | "COMPLEX"
): number | null {
  if (!cfg) return null;
  const pick =
    channel === "SANAD"
      ? (cfg.sanadPrice ?? cfg.basePrice)
      : channel === "COMPLEX"
        ? (cfg.complexPrice ?? cfg.basePrice)
        : cfg.basePrice;
  return pick === null || pick === undefined ? null : Number(pick);
}

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { channel, service, governorate, limit } = parseQuery(req.nextUrl.searchParams, querySchema);
  const now = new Date();

  const where: Prisma.CampaignWhereInput = {
    isActive: true,
    startDate: { lte: now },
    endDate: { gte: now },
    // A NULL channel is a platform-wide campaign — it runs in every storefront.
    OR: [{ channel }, { channel: null }],
    ...(governorate ? { partner: { governorate: { name: governorate } } } : {}),
  };

  const [rows, prices] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: [{ endDate: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        discountType: true,
        discountValue: true,
        endDate: true,
        targetServices: true,
        imageUrl: true,
        partner: {
          select: {
            id: true,
            name: true,
            type: true,
            rating: true,
            totalTasks: true,
            address: true,
            governorate: { select: { name: true } },
            // A doctor's public profile is keyed by DoctorProfile.id, not by
            // the Partner id — without it an offer card has nowhere to lead.
            user: { select: { doctorProfile: { select: { id: true } } } },
          },
        },
      },
    }),
    // One read for the whole price table (14 rows) rather than a lookup per
    // campaign.
    prisma.priceConfig.findMany({
      select: { serviceType: true, basePrice: true, sanadPrice: true, complexPrice: true },
    }),
  ]);

  const priceBy = new Map(prices.map((p) => [p.serviceType, p]));

  const data = rows
    .map((c) => {
      const targets = Array.isArray(c.targetServices) ? (c.targetServices as string[]) : [];
      const primary = targets[0] as ServiceType | undefined;
      const oldPrice = primary ? basePriceFor(priceBy.get(primary), channel) : null;

      const value = Number(c.discountValue);
      const newPrice =
        oldPrice === null
          ? null
          : c.discountType === "PERCENTAGE"
            ? Math.max(0, Math.round(oldPrice * (1 - value / 100)))
            : Math.max(0, oldPrice - value);

      // Shown as "خصم N%", so a fixed-amount campaign is converted rather than
      // printed as a raw dinar figure in a percent badge.
      const discountPercent =
        oldPrice && oldPrice > 0 && newPrice !== null
          ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
          : c.discountType === "PERCENTAGE"
            ? Math.round(value)
            : null;

      return {
        id: c.id,
        title: c.name,
        description: c.description,
        image: c.imageUrl,
        clinic: c.partner?.name ?? null,
        // Identity of the provider behind the offer. The card was a dead
        // `<div>` — it carried `cursor-pointer` and led nowhere — because the
        // response named the clinic but never said which one it was.
        partnerId: c.partner?.id ?? null,
        partnerType: c.partner?.type ?? null,
        doctorProfileId: c.partner?.user?.doctorProfile?.id ?? null,
        location: c.partner?.governorate?.name ?? c.partner?.address ?? null,
        rating: c.partner?.rating ?? null,
        reviews: c.partner?.totalTasks ?? null,
        serviceType: primary ?? null,
        category: primary ? (SERVICE_TYPE_LABELS[primary] ?? primary) : null,
        oldPrice,
        newPrice,
        discountPercent,
        // Ceil, so an offer with six hours left reads "ينتهي خلال يوم" rather
        // than "0" — which looks expired while it is still live.
        expiresInDays: Math.max(0, Math.ceil((c.endDate.getTime() - now.getTime()) / 86_400_000)),
        endDate: c.endDate,
      };
    })
    // A card with no price cannot show the before/after it is built around.
    .filter((o) => o.oldPrice !== null);

  // The chips, derived from what is actually on offer — a category that filters
  // to nothing is worse than one that is absent.
  const categories = [...new Set(data.map((o) => o.category).filter(Boolean))];

  return ok({ offers: data, categories }, { requestId });
});
