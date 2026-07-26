import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Alert = {
  id: string;
  type: "urgent" | "delay";
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
};

// GET /api/dashboard/alerts — Active alerts (req L60-68)
export const GET = withAuth({ roles: ROLES.STAFF }, async (_req, _ctx, identity) => {
  // Get critical/urgent orders and recent issues
  const [criticalOrders, delayedOrders, unreadAlerts] = await Promise.all([
    prisma.order.findMany({
      where: { priority: "CRITICAL", status: { not: "COMPLETED" } },
      select: { id: true, orderNumber: true, patientName: true, createdAt: true },
      take: 5,
    }),
    prisma.order.findMany({
      where: { status: "DELAYED" },
      select: { id: true, orderNumber: true, patientName: true, createdAt: true },
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

  return NextResponse.json({ data: alerts });
});
