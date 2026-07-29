import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * Patient satisfaction — backs "مؤشرات الجودة" (req L262).
 *
 * `PatientFeedback` is the only quality signal the system actually holds, so
 * it is the only one the quality screen shows. Response time and uptime are
 * not measured anywhere; displaying them would be inventing numbers.
 *
 * `summary=true` returns the aggregate (average, per-star distribution,
 * per-service averages) computed in SQL rather than shipping every row to the
 * browser to be reduced there.
 */

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit, minRating, maxRating, from, to } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const keyset = keysetArgs(cursor, limit);
  const filters: Prisma.PatientFeedbackWhereInput[] = [];
  if (minRating || maxRating) {
    filters.push({
      rating: { ...(minRating ? { gte: minRating } : {}), ...(maxRating ? { lte: maxRating } : {}) },
    });
  }
  if (from || to) {
    filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }
  const scoped: Prisma.PatientFeedbackWhereInput = filters.length ? { AND: [...filters] } : {};
  const paged: Prisma.PatientFeedbackWhereInput = keyset.where
    ? { AND: [...filters, keyset.where] }
    : scoped;

  const [rows, distribution] = await Promise.all([
    prisma.patientFeedback.findMany({
      where: paged,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, orderNumber: true, serviceType: true, status: true } },
      },
      orderBy: keyset.orderBy,
      take: keyset.take,
    }),
    // Counted over the FILTERED set, not the page — a summary that only
    // describes 50 visible rows would be misread as describing everything.
    prisma.patientFeedback.groupBy({
      by: ["rating"],
      where: scoped,
      _count: { _all: true },
    }),
  ]);

  const { items, page } = toPage(rows, limit);

  const counts = Object.fromEntries(distribution.map((d) => [d.rating, d._count._all]));
  const total = distribution.reduce((sum, d) => sum + d._count._all, 0);
  const weighted = distribution.reduce((sum, d) => sum + d.rating * d._count._all, 0);

  // `okList` has no slot for a domain summary, so it goes in `meta` — which
  // keeps the `{data, meta}` envelope every other endpoint returns.
  return okList(items, page, {
    requestId,
    summary: {
      total,
      average: total ? Math.round((weighted / total) * 100) / 100 : 0,
      counts: {
        1: counts[1] ?? 0,
        2: counts[2] ?? 0,
        3: counts[3] ?? 0,
        4: counts[4] ?? 0,
        5: counts[5] ?? 0,
      },
    },
  });
});
