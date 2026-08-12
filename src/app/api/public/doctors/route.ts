import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/public/doctors — the directory a visitor browses before signing in.
 *
 * Distinct from `/api/v1/doctors`, which is the authenticated mobile surface
 * and is keyset-paginated. This one exists because the browse pages are public
 * and were therefore reading `src/lib/constants/demo-data.ts` — fourteen
 * invented doctors that no admin could edit and no booking could resolve.
 *
 * The shape matches `Doctor` in `src/types/patient` on purpose, so the existing
 * cards, filters and booking drawer render against real rows without a single
 * markup change.
 */

const listQuerySchema = z.object({
  /** Which storefront the visitor is browsing: /doctors vs /sanad/doctors. */
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
  specialty: z.string().trim().min(1).optional(), // slug
  q: z.string().trim().min(1).max(80).optional(),
  governorate: z.string().trim().min(1).optional(), // name, as the city picker uses
  limit: z.coerce.number().int().min(1).max(100).default(12),
  /** Opaque keyset cursor over (createdAt, id) — see api-response.ts. */
  cursor: z.string().optional(),
});

/** `DoctorProfile.gender` is a free String; the UI type is a strict union. */
function toGender(value: string | null): "male" | "female" {
  return value === "FEMALE" || value === "أنثى" ? "female" : "male";
}

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { channel, specialty, q, governorate, limit, cursor } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.DoctorProfileWhereInput = {
    // Only a doctor with a live partner record can actually be booked. Showing
    // a suspended one produces a booking that dispatch will reject.
    user: {
      isActive: true,
      deletedAt: null,
      partner: {
        status: "ACTIVE",
        deletedAt: null,
        // /doctors and /sanad/doctors are the same page against different pools.
        channels: { some: { channel, status: { not: "SUSPENDED" } } },
      },
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(governorate ? { governorate: { name: governorate } } : {}),
    },
    ...(specialty ? { specialty: { slug: specialty } } : {}),
  };

  // Keyset, not offset: the list is ordered by createdAt desc, so a doctor
  // onboarded between page 1 and page 2 shifts everything down — the reader
  // sees a duplicate and silently misses someone.
  const keyset = keysetArgs(cursor, limit);
  const rows = await prisma.doctorProfile.findMany({
    where: keyset.where ? { AND: [where, keyset.where] } : where,
    take: keyset.take,
    orderBy: keyset.orderBy,
    select: {
      createdAt: true,
      id: true,
      experience: true,
      gender: true,
      specialty: { select: { slug: true, name: true } },
      user: {
        select: {
          name: true,
          image: true,
          phone: true,
          governorate: { select: { name: true } },
          partner: {
            select: {
              rating: true,
              totalTasks: true,
              address: true,
              status: true,
              // The consultation price the patient is quoted comes from the
              // partner's own service config, not from a hardcoded string.
              serviceConfigs: {
                where: { serviceType: "IN_PERSON_CONSULT" },
                select: { status: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  // One lookup for the platform base price, rather than a join per doctor.
  const priceRow = await prisma.priceConfig.findUnique({
    where: { serviceType: "IN_PERSON_CONSULT" },
    select: { basePrice: true, sanadPrice: true, complexPrice: true },
  });
  // The channel decides the price the patient is quoted — the same precedence
  // `quoteService()` applies when the order is actually placed, so the browse
  // page cannot advertise a number the checkout then contradicts.
  const channelPrice = !priceRow
    ? null
    : channel === "SANAD"
      ? Number(priceRow.sanadPrice ?? priceRow.basePrice)
      : channel === "COMPLEX"
        ? Number(priceRow.complexPrice ?? priceRow.basePrice)
        : Number(priceRow.basePrice);

  const { items, page } = toPage(rows, limit);

  const data = items.map((d) => ({
    id: d.id,
    name: d.user.name ?? "",
    specialty: d.specialty?.name ?? "",
    specialtyId: d.specialty?.slug ?? "",
    rating: d.user.partner?.rating ?? 0,
    reviewCount: d.user.partner?.totalTasks ?? 0,
    location: d.user.governorate?.name ?? "",
    clinic: d.user.partner?.address ?? "",
    phone: d.user.phone ?? "",
    price: channelPrice === null ? "" : String(channelPrice),
    // "Available" means the in-person consultation service is switched on —
    // the same flag the admin toggles on إدارة الخدمات.
    isAvailable: d.user.partner?.serviceConfigs?.[0]?.status === "ACTIVE",
    experience: d.experience === null ? "" : String(d.experience),
    gender: toGender(d.gender),
    image: d.user.image ?? undefined,
  }));

  return okList(data, page, { requestId });
});
