import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * Audit trail — "سجل النشاطات" (req L70).
 *
 * Read-only by design, and admin-only: an audit log an admin can edit or
 * delete is not an audit log. There is deliberately no POST either — entries
 * are written by the services that perform the action, never by a client that
 * could claim any actor it likes.
 */

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit, userId, entityType, entityId, from, to } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const keyset = keysetArgs(cursor, limit);
  const filters: Prisma.ActivityLogWhereInput[] = [];
  if (userId) filters.push({ userId });
  if (entityType) filters.push({ entityType });
  if (entityId) filters.push({ entityId });
  if (from || to) {
    filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }
  if (keyset.where) filters.push(keyset.where);

  const rows = await prisma.activityLog.findMany({
    where: filters.length ? { AND: filters } : {},
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});
