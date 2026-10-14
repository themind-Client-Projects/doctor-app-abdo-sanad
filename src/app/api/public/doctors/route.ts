import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { isServiceLive } from "@/lib/labels";

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
  /**
   * Which consultation this screen sells. It decides the quoted PRICE, the
   * «متاح» flag and the pool — all three were hardwired to IN_PERSON_CONSULT,
   * so مكالمة أطباء advertised «سعر المكالمة 25,000» when `ONLINE_CONSULT` is
   * 15,000, and marked a doctor available for a call on the strength of their
   * clinic-visit flag.
   */
  service: z.enum(["IN_PERSON_CONSULT", "ONLINE_CONSULT"]).default("IN_PERSON_CONSULT"),
  specialty: z.string().trim().min(1).optional(), // slug
  q: z.string().trim().min(1).max(80).optional(),
  governorate: z.string().trim().min(1).optional(), // name, as the city picker uses
  limit: z.coerce.number().int().min(1).max(100).default(12),
  /** Opaque keyset cursor over (createdAt, id) — see api-response.ts. */
  cursor: z.string().optional(),
  /**
   * Doctors belonging to one medical complex. `DoctorProfile.complexId` has
   * always held this; without the filter the complex page's «أطباء المجمع»
   * strip listed the first six doctors on the whole platform.
   */
  complexId: z.string().trim().min(1).optional(),
});

/** `DoctorProfile.gender` is a free String; the UI type is a strict union. */
function toGender(value: string | null): "male" | "female" {
  return value === "FEMALE" || value === "أنثى" ? "female" : "male";
}

export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { channel, service, specialty, q, governorate, complexId, limit, cursor } = parseQuery(
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
        // Only doctors who actually offer THIS consultation. Listing a doctor
        // who does not take calls on مكالمة أطباء produces a booking the
        // provider cannot serve.
        serviceConfigs: {
          some: { serviceType: service, status: { in: ["ACTIVE", "REACTIVATED"] as const } },
        },
      },
      ...(governorate ? { governorate: { name: governorate } } : {}),
    },
    ...(specialty ? { specialty: { slug: specialty } } : {}),
    // Two OR groups at one level would overwrite each other, so both live
    // inside AND. An empty AND is a no-op.
    AND: [
      // EITHER column. `DoctorProfile.complexId` is the one the requirement
      // names, but `Partner.complexId` is the one the onboarding screens
      // actually write — matching only the first returns nothing for every
      // complex in this database. They mean the same thing, so accept both
      // rather than silently listing no doctors.
      ...(complexId
        ? [{ OR: [{ complexId }, { user: { partner: { complexId } } }] }]
        : []),
      // `q` matched the doctor's NAME alone, so the search screen found nobody
      // for «قلب» or «المنصور» — both of which the card puts on screen next to
      // the name. A search that cannot find what it displays reads as an empty
      // directory. Every field here is one the result card renders.
      ...(q
        ? [
            {
              OR: [
                { user: { name: { contains: q, mode: "insensitive" as const } } },
                { specialty: { name: { contains: q, mode: "insensitive" as const } } },
                { user: { governorate: { name: { contains: q, mode: "insensitive" as const } } } },
                { user: { partner: { address: { contains: q, mode: "insensitive" as const } } } },
              ],
            },
          ]
        : []),
    ],
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
              // The booking endpoint matches `providerId` against `Partner`,
              // while this list is keyed by `DoctorProfile.id`. Without the
              // partner id the client has no way to name the provider it just
              // showed — the same id-space confusion that has produced three
              // shipped defects in this codebase.
              id: true,
              rating: true,
              totalTasks: true,
              address: true,
              status: true,
              // The consultation price the patient is quoted comes from the
              // partner's own service config, not from a hardcoded string.
              serviceConfigs: {
                where: { serviceType: service },
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
    where: { serviceType: service },
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
    /** `Partner.id` — what POST /api/v1/me/bookings needs as `providerId`. */
    partnerId: d.user.partner?.id ?? null,
    name: d.user.name ?? "",
    specialty: d.specialty?.name ?? "",
    specialtyId: d.specialty?.slug ?? "",
    rating: d.user.partner?.rating ?? 0,
    /** `Partner.totalTasks` — COMPLETED TASKS. Nothing in the schema counts
     *  reviews, and this was served as `reviewCount`, which two screens then
     *  printed as «مراجعة» and «من N زائر». Renamed for what it holds. */
    completedTasks: d.user.partner?.totalTasks ?? 0,
    location: d.user.governorate?.name ?? "",
    clinic: d.user.partner?.address ?? "",
    phone: d.user.phone ?? "",
    price: channelPrice === null ? "" : String(channelPrice),
    // "Available" means the REQUESTED consultation service is switched on —
    // the same flag the admin toggles on إدارة الخدمات. REACTIVATED counts:
    // "إعادة التفعيل" never writes ACTIVE back, so testing for ACTIVE alone
    // marked every reactivated doctor «غير متاح» for good — while this route's
    // own [id] sibling said the opposite about the same doctor.
    isAvailable: isServiceLive(d.user.partner?.serviceConfigs?.[0]?.status),
    experience: d.experience === null ? "" : String(d.experience),
    gender: toGender(d.gender),
    image: d.user.image ?? undefined,
  }));

  return okList(data, page, { requestId });
});
