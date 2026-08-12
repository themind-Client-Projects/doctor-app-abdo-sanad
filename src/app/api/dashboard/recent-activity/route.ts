import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/dashboard/recent-activity — Recent activity feed (req L70-76)
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // The platform's audit trail — who changed pricing, who suspended a partner,
  // named. Every staff role could read all of it. A partner sees their own
  // actions, which is what the widget on their dashboard is for; the full feed
  // stays with the platform roles.
  const where: Prisma.ActivityLogWhereInput = isPlatformRole(identity.role)
    ? {}
    : { userId: identity.userId };

  const activities = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return ok(activities, { requestId });
});
