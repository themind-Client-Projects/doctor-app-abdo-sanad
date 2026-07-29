import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/v1/doctors — the patient-facing doctor directory.
 *
 * `/api/partners?type=DOCTOR` returns *partner* rows: commercial records with
 * no specialty, gender, experience or consultation price. This returns what a
 * patient actually chooses on, and only the fields they may see.
 */
const listQuerySchema = z.object({
  specialty: z.string().trim().min(1).optional(), // slug
  gender: z.enum(["ذكر", "أنثى"]).optional(),
  governorateId: z.string().trim().min(1).optional(),
  minExperience: z.coerce.number().int().min(0).max(80).optional(),
  /** Kept for existing mobile clients; equivalent to channel=SANAD. */
  sanadOnly: z.enum(["true", "false"]).optional(),
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withAuth({}, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { specialty, gender, governorateId, minExperience, sanadOnly, channel, q, cursor, limit } =
    parseQuery(req.nextUrl.searchParams, listQuerySchema);

  // Channel membership lives on the partner, not the doctor profile: it used to
  // be duplicated on both with nothing keeping them in agreement.
  const wanted = channel ?? (sanadOnly === "true" ? "SANAD" : undefined);

  const where: Prisma.DoctorProfileWhereInput = {
    // A doctor is only bookable through an active partner record.
    user: {
      isActive: true,
      deletedAt: null,
      partner: {
        status: "ACTIVE",
        deletedAt: null,
        ...(wanted ? { channels: { some: { channel: wanted, status: { not: "SUSPENDED" } } } } : {}),
      },
      ...(governorateId ? { governorateId } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    ...(specialty ? { specialty: { slug: specialty } } : {}),
    ...(gender ? { gender } : {}),
    ...(minExperience !== undefined ? { experience: { gte: minExperience } } : {}),
  };

  const keyset = keysetArgs(cursor, limit);
  const cursorWhere = "where" in keyset ? keyset.where : undefined;

  const rows = await prisma.doctorProfile.findMany({
    ...keyset,
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    select: {
      id: true,
      createdAt: true,
      experience: true,
      gender: true,
      specialty: { select: { slug: true, name: true } },
      user: {
        select: {
          name: true,
          image: true,
          governorate: { select: { name: true } },
          // Rating lives on the partner record.
          partner: {
            select: {
              rating: true,
              address: true,
              channels: { select: { channel: true } },
            },
          },
        },
      },
    },
  });

  const { items, page } = toPage(rows, limit);

  return okList(
    items.map((d) => ({
      id: d.id,
      name: d.user.name,
      image: d.user.image,
      specialty: d.specialty,
      experience: d.experience,
      gender: d.gender,
      channels: d.user.partner?.channels.map((c) => c.channel) ?? [],
      rating: d.user.partner?.rating ?? null,
      address: d.user.partner?.address ?? null,
      governorate: d.user.governorate?.name ?? null,
    })),
    page,
    { requestId }
  );
});
