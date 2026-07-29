import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
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
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { type, governorate, complexesOnly, channel, service, q, limit } = parseQuery(
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
    ...(service
      ? {
          serviceConfigs: {
            some: { serviceType: service, status: { in: ["ACTIVE", "REACTIVATED"] as const } },
          },
        }
      : {}),
    ...(governorate ? { governorate: { name: governorate } } : {}),
    ...(complexesOnly === "true" ? { ownedComplex: { isNot: null } } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const rows = await prisma.partner.findMany({
    where,
    take: limit,
    orderBy: [{ rating: "desc" }, { name: "asc" }],
    select: {
      id: true,
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

  const data = rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    phone: p.phone,
    location: p.governorate?.name ?? "",
    address: p.address ?? "",
    latitude: p.latitude,
    longitude: p.longitude,
    rating: p.rating,
    reviewCount: p.totalTasks,
    complex: p.ownedComplex,
    services: p.serviceConfigs.map((s) => s.serviceType),
    hasHomeService: p.serviceConfigs.some((s) => s.isHomeService),
    hasBloodDraw: p.serviceConfigs.some((s) => s.isBloodDraw),
  }));

  return ok(data, { requestId });
});
