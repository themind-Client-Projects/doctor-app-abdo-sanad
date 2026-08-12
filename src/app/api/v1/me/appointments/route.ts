import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/v1/me/appointments — "حجوزاتي".
 *
 * `/api/appointments` filters on doctorId only, so there was no way for a
 * patient to fetch their own bookings — the screen the whole app exists for.
 * The patient id comes from the verified session, never from a parameter.
 */
const listQuerySchema = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("all"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { scope, cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const now = new Date();
  const where: Prisma.AppointmentWhereInput = {
    patientId: identity.userId,
    ...(scope === "upcoming"
      ? { date: { gte: now }, status: { notIn: ["cancelled"] } }
      : scope === "past"
        ? { OR: [{ date: { lt: now } }, { status: { in: ["completed", "cancelled"] } }] }
        : {}),
  };

  const keyset = keysetArgs(cursor, limit);
  const cursorWhere = "where" in keyset ? keyset.where : undefined;

  const rows = await prisma.appointment.findMany({
    ...keyset,
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    select: {
      id: true,
      createdAt: true,
      date: true,
      time: true,
      type: true,
      status: true,
      price: true,
      doctor: {
        select: {
          id: true,
          specialty: { select: { slug: true, name: true } },
          user: { select: { name: true, image: true } },
        },
      },
    },
  });

  const { items, page } = toPage(rows, limit);

  return okList(
    items.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      type: a.type,
      status: a.status,
      price: a.price,
      doctor: a.doctor
        ? {
            id: a.doctor.id,
            name: a.doctor.user.name,
            image: a.doctor.user.image,
            specialty: a.doctor.specialty,
          }
        : null,
    })),
    page,
    { requestId }
  );
});
