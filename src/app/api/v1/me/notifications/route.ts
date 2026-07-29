import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/v1/me/notifications — the signed-in user's notifications.
 *
 * GLOBAL: one inbox across both storefronts, which is why there is no channel
 * filter here. `/api/notifications` already exists but is the staff-side list;
 * this is the patient surface, scoped to `identity.userId` and nothing else.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.enum(["true", "false"]).optional(),
});

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { limit, unreadOnly } = parseQuery(req.nextUrl.searchParams, querySchema);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: identity.userId,
        ...(unreadOnly === "true" ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: identity.userId, isRead: false } }),
  ]);

  return ok({ items, unread }, { requestId });
});
