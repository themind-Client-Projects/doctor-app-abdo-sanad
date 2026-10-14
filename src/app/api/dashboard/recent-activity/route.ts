import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import type { ActivityItem } from "@/types/dashboard";

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

  const rows = await prisma.activityLog.findMany({
    where,
    // `image` was selected and never rendered — dead PII on the wire.
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Mapped to the DTO the widget actually reads (`ActivityItem` in
  // types/dashboard), not returned raw. The component reads `timestamp` and
  // `userName`; Prisma supplies `createdAt` and `user.name`, so both arrived
  // undefined and every line rendered «قبل NaN يوم» with no actor — on the
  // one panel whose entire purpose is naming who did what.
  //
  // Annotated, so from here tsc holds this route to the contract.
  const activities: ActivityItem[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    // `?? undefined` is required, not cosmetic: Prisma types these
    // `string | null` while the DTO has them optional.
    entityType: r.entityType ?? undefined,
    entityId: r.entityId ?? undefined,
    timestamp: r.createdAt,
    userName: r.user?.name ?? undefined,
  }));

  return ok(activities, { requestId });
});
