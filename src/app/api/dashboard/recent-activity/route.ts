import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/dashboard/recent-activity — Recent activity feed (req L70-76)
export const GET = withAuth({ roles: ROLES.STAFF }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const activities = await prisma.activityLog.findMany({
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return ok(activities, { requestId });
});
