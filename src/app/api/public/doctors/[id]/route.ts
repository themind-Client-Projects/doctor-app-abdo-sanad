import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { SERVICE_TYPE_LABELS } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/public/doctors/[id] — one doctor, for the profile screen.
 *
 * The detail pages were looking the id up in `demo-data.ts`, so every link from
 * the now-real listing resolved to nothing and rendered "لم يتم العثور على
 * الطبيب" — the list was wired and the page it linked to was not.
 *
 * `id` is a `DoctorProfile.id`, matching what the list returns. Public, like
 * the list: a visitor can read a profile before signing in, and only booking
 * is gated.
 */

const querySchema = z.object({
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
});

function toGender(value: string | null): "male" | "female" {
  return value === "FEMALE" || value === "أنثى" ? "female" : "male";
}

export const GET = withPublic<Ctx>(async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { channel } = parseQuery(req.nextUrl.searchParams, querySchema);

  const d = await prisma.doctorProfile.findFirst({
    where: {
      id,
      // Same visibility rule as the list. A doctor who is not bookable must not
      // have a reachable profile with a booking button on it.
      user: {
        isActive: true,
        deletedAt: null,
        partner: {
          status: "ACTIVE",
          deletedAt: null,
          channels: { some: { channel, status: { not: "SUSPENDED" } } },
        },
      },
    },
    select: {
      id: true,
      experience: true,
      gender: true,
      specialty: { select: { slug: true, name: true } },
      schedules: {
        where: { isActive: true },
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
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
              serviceConfigs: {
                where: { status: { in: ["ACTIVE", "REACTIVATED"] } },
                select: { serviceType: true },
              },
            },
          },
        },
      },
    },
  });

  if (!d) return fail(ErrorCode.NOT_FOUND, 404, "الطبيب غير موجود", { requestId });

  const price = await prisma.priceConfig.findUnique({
    where: { serviceType: "IN_PERSON_CONSULT" },
    select: { basePrice: true, sanadPrice: true, complexPrice: true },
  });
  // The channel decides the quote, exactly as the list and `quoteService` do —
  // a profile must not advertise a price the list disagreed with.
  const quoted = !price
    ? null
    : channel === "SANAD"
      ? Number(price.sanadPrice ?? price.basePrice)
      : channel === "COMPLEX"
        ? Number(price.complexPrice ?? price.basePrice)
        : Number(price.basePrice);

  const services = d.user.partner?.serviceConfigs ?? [];

  return ok(
    {
      // The `Doctor` shape the existing cards and drawer already render.
      id: d.id,
      name: d.user.name ?? "",
      specialty: d.specialty?.name ?? "",
      specialtyId: d.specialty?.slug ?? "",
      rating: d.user.partner?.rating ?? 0,
      reviewCount: d.user.partner?.totalTasks ?? 0,
      location: d.user.governorate?.name ?? "",
      clinic: d.user.partner?.address ?? "",
      phone: d.user.phone ?? "",
      price: quoted === null ? "" : String(quoted),
      isAvailable: services.some((s) => s.serviceType === "IN_PERSON_CONSULT"),
      experience: d.experience === null ? "" : String(d.experience),
      gender: toGender(d.gender),
      image: d.user.image ?? undefined,
      // Profile-only detail the list does not carry.
      services: services.map((s) => ({
        serviceType: s.serviceType,
        name: SERVICE_TYPE_LABELS[s.serviceType] ?? s.serviceType,
      })),
      schedules: d.schedules,
    },
    { requestId }
  );
});
