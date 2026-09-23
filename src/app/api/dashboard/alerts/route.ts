import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { orderScopeFor } from "@/lib/order-slots";

type Alert = {
  id: string;
  type: "urgent" | "delay";
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
};

/**
 * GET /api/dashboard/alerts — Active alerts (req L60-68)
 *
 * SCOPED TO THE CALLER. The two order queries had no `where` on ownership, so
 * every partner's home screen listed the platform's critical and delayed
 * orders — with patient names — including orders they have nothing to do with.
 * A lab read a nurse's patients; a driver read a clinic's. That is a PHI leak
 * on the first screen after sign-in, and it also buried each partner's own
 * alerts under other people's noise.
 *
 * `orderScopeFor` is the same rule the worklists use: a platform role sees
 * everything, a partner sees only orders in their own assignment slot, and it
 * fails closed for anyone who can hold no assignment.
 */
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // Get critical/urgent orders and recent issues
  const [criticalOrders, delayedOrders, unreadAlerts] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [
          orderScopeFor(identity),
          {
            priority: "CRITICAL",
            // CANCELLED was counted as an open urgent order, so a cancelled
            // job kept raising an alarm nobody could clear.
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            deletedAt: null,
          },
        ],
      },
      select: { id: true, orderNumber: true, patientName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { AND: [orderScopeFor(identity), { status: "DELAYED", deletedAt: null }] },
      select: { id: true, orderNumber: true, patientName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // The result of this query used to be discarded. It is now emitted below —
    // and scoped to the caller, since notifications are per-user and returning
    // them unfiltered would have shown every user's alerts to every user.
    prisma.notification.findMany({
      where: {
        userId: identity.userId,
        isRead: false,
        type: { in: ["critical_result", "delay", "urgent_order"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const alerts: Alert[] = [
    ...criticalOrders.map((o) => ({
      id: o.id,
      type: "urgent" as const,
      title: "طلب عاجل",
      description: `طلب #${o.orderNumber} — ${o.patientName}`,
      timestamp: o.createdAt,
      isRead: false,
    })),
    ...delayedOrders.map((o) => ({
      id: o.id,
      type: "delay" as const,
      title: "تأخير",
      description: `طلب #${o.orderNumber} متأخر`,
      timestamp: o.createdAt,
      isRead: false,
    })),
    ...unreadAlerts.map((n) => ({
      id: n.id,
      type: n.type === "delay" ? ("delay" as const) : ("urgent" as const),
      title: n.title,
      description: n.body,
      timestamp: n.createdAt,
      isRead: n.isRead,
    })),
  ];

  return ok(alerts, { requestId });
});
