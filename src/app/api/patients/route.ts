import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  /** Name or phone. Two characters is the floor, matching `/api/search`. */
  q: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(80).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/patients — look up a patient account, for operations.
 *
 * The call centre takes an order over the phone and has to attach it to an
 * ACCOUNT: `Order.patientId` is what links the order to the patient's wallet,
 * their tracking screen and their history. Typing a name into a free-text field
 * would create an order the patient could never see.
 *
 * `/api/users` is the obvious source and is `ROLES.ADMIN` — correctly, since it
 * lists every staff account and administrator on the platform. So operations
 * had no way to name a patient, and `POST /api/orders` sat unreachable.
 *
 * This is deliberately the narrowest thing that closes that:
 *
 *  - **PATIENT only.** Never a staff or admin row.
 *  - **Three columns.** Id, name, phone — what a dispatch form needs. No email,
 *    no address, no governorate, no timestamps.
 *  - **A query is required** for anything but the newest page, and the result
 *    is capped at 50. This is not a directory to page through.
 *
 * `ROLES.OPERATIONS` (SUPER_ADMIN + OPERATIONS), which is strictly narrower
 * than `/api/search` — already available to the same roles, and it returns the
 * same patients by the same fields.
 */
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { q, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const where: Prisma.UserWhereInput = { role: "PATIENT", deletedAt: null };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const data = await prisma.user.findMany({
    where,
    select: { id: true, name: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok(data, { requestId });
});
