import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery, serviceTypeSchema } from "@/lib/validation";

/**
 * GET /api/public/partners — labs, pharmacies, radiology centres and complexes
 * as a visitor sees them.
 *
 * Backs the /labs, /pharmacies and "شركاؤنا" sections, which were rendering
 * five invented names. Only ACTIVE, non-deleted partners appear: listing a
 * suspended lab invites a booking that dispatch will refuse.
 *
 * Contact details are deliberately limited to what a patient needs in order to
 * reach the place — nothing commercial (contracts, wallets, ratings history).
 */

const listQuerySchema = z.object({
  type: z.enum(["LAB", "PHARMACY", "RADIOLOGY", "DOCTOR", "NURSE", "DRIVER"]).optional(),
  governorate: z.string().trim().min(1).optional(), // name
  /** Which storefront the visitor is browsing. */
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
  /**
   * Filter by the service a partner actually offers, which is how the browse
   * pages are scoped: /labs is LAB_TEST, /nursing is NURSING, /physiotherapy is
   * PHYSIOTHERAPY. Filtering by service rather than by partner type is what
   * lets /physiotherapy work at all — the client's partner taxonomy
   * (req L128-182) has no physiotherapy category, because it is a service.
   */
  service: serviceTypeSchema.optional(),
  /** Only partners that own a medical complex. */
  complexesOnly: z.enum(["true", "false"]).optional(),
  /**
   * Members OF one complex — its pharmacies, labs and clinics.
   *
   * `Partner.complexId` has always held this (indexed), and no patient-facing
   * route exposed it, so the complex detail page listed three invented
   * pharmacies and three invented labs instead of the real members.
   */
  complexId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  cursor: z.string().optional(),
});

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { type, governorate, complexesOnly, complexId, channel, service, q, limit, cursor } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.PartnerWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    // The whole point of the channel model: /labs and /sanad/labs are the same
    // page against different pools.
    channels: { some: { channel, status: { not: "SUSPENDED" } } },
    ...(type ? { type } : {}),
    ...(complexId ? { complexId } : {}),
    ...(service
      ? {
          serviceConfigs: {
            some: { serviceType: service, status: { in: ["ACTIVE", "REACTIVATED"] as const } },
          },
        }
      : {}),
    ...(governorate ? { governorate: { name: governorate } } : {}),
    ...(complexesOnly === "true" ? { ownedComplex: { isNot: null } } : {}),
    // Name alone missed «المنصور» and «شارع حيفا», which the card prints
    // under the name — see the same widening in the doctors sibling.
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { address: { contains: q, mode: "insensitive" as const } },
            { governorate: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const keyset = keysetArgs(cursor, limit);
  const rows = await prisma.partner.findMany({
    where: keyset.where ? { AND: [where, keyset.where] } : where,
    take: keyset.take,
    // Keyset requires ordering BY the cursor's columns, so rating can no longer
    // drive it — sorting by rating and paging by createdAt would skip rows.
    orderBy: keyset.orderBy,
    select: {
      id: true,
      createdAt: true,
      name: true,
      type: true,
      phone: true,
      address: true,
      latitude: true,
      longitude: true,
      rating: true,
      totalTasks: true,
      governorate: { select: { name: true } },
      ownedComplex: { select: { id: true, name: true } },
      // Which services this partner actually offers, so the browse page can
      // say "سحب دم منزلي" only where it is switched on.
      serviceConfigs: {
        where: { status: { in: ["ACTIVE", "REACTIVATED"] } },
        select: { serviceType: true, isHomeService: true, isBloodDraw: true },
      },
    },
  });

  const { items, page } = toPage(rows, limit);

  const data = items.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    phone: p.phone,
    location: p.governorate?.name ?? "",
    address: p.address ?? "",
    latitude: p.latitude,
    longitude: p.longitude,
    rating: p.rating,
    complex: p.ownedComplex,
    services: p.serviceConfigs.map((s) => s.serviceType),
    // Scoped to the service this screen SELLS. `.some()` over every config
    // put «خدمة منزلية» on a lab because that partner does home nursing, and
    // «سحب دم» on a physiotherapy centre that also runs a lab — badges about
    // one service, printed on a card selling another. With no `service`
    // filter the old any-service meaning is kept.
    hasHomeService: p.serviceConfigs.some((s) => (service ? s.serviceType === service : true) && s.isHomeService),
    hasBloodDraw: p.serviceConfigs.some((s) => (service ? s.serviceType === service : true) && s.isBloodDraw),
    /** What `reviewCount` used to be called. It is `Partner.totalTasks` — a
     *  lifetime COMPLETED-TASK counter — and nothing in the schema counts
     *  reviews, so printing it as «(156)» beside a star rating invented a
     *  review history. Renamed so no screen can mistake it again. */
    completedTasks: p.totalTasks,
  }));

  return okList(data, page, { requestId });
});
