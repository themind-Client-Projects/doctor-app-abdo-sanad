import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/notifications — the caller's own notifications.
//
// The userId used to come from a query parameter, so anyone could read any
// user's notifications. It is now taken from the verified session only.
export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50") || 50)
  );

  const data = await prisma.notification.findMany({
    where: { userId: identity.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok(data, { requestId });
});
