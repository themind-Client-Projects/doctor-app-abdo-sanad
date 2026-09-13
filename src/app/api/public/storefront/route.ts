import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

const querySchema = z.object({
  /** Which storefront is asking: / is DIRECT, /sanad is SANAD. */
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
});

/**
 * GET /api/public/storefront — everything the patient home screen renders
 * above its doctor list: banners, subscription plans, live offers, and the
 * specialty filter row.
 *
 * ONE endpoint rather than four, because the home screen needs all of it to
 * paint a single above-the-fold view. Four round-trips on an Iraqi mobile
 * connection is four chances to show a half-built page — and these are four
 * small, uncorrelated reads that Postgres runs concurrently anyway.
 *
 * Public by design: the patient app browses before it signs in. Only
 * presentation fields are selected — nothing here is keyed to a person.
 */

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { channel } = parseQuery(req.nextUrl.searchParams, querySchema);
  const now = new Date();

  // A NULL channel means "every storefront", so each query matches its own
  // channel OR the unscoped rows — not one or the other.
  const inChannel = { OR: [{ channel }, { channel: null }] };

  const [banners, plans, offers, specialties] = await Promise.all([
    prisma.banner.findMany({
      where: {
        isActive: true,
        // A flight window is optional on both sides: null means "no bound".
        AND: [
          inChannel,
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, subtitle: true, imageUrl: true, href: true },
    }),

    prisma.healthPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        durationDays: true,
        discountPercent: true,
        accent: true,
        icon: true,
        isPopular: true,
        isComingSoon: true,
        // The card's rows. Selected here so the home screen's carousel and the
        // full pricing page render from ONE query shape — a second, thinner
        // plan payload is how the two screens start disagreeing about what a
        // package includes.
        benefits: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, label: true, quota: true, state: true, serviceType: true },
        },
      },
    }),

    // Offers are `Campaign` rows that are live right now — the model already
    // carries the discount, the window and the targeted services.
    prisma.campaign.findMany({
      where: { isActive: true, startDate: { lte: now }, endDate: { gte: now }, ...inChannel },
      orderBy: { endDate: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        discountType: true,
        discountValue: true,
        endDate: true,
        targetServices: true,
      },
    }),

    prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, icon: true, color: true },
    }),
  ]);

  return ok({ banners, plans, offers, specialties }, { requestId });
});
