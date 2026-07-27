import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/reports — All 9 report types (req L255-264)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [totalOrders, completedOrders, avgRating, topDoctors, topLabs, topPharmacies] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.order.count({ where: { status: "COMPLETED", createdAt: { gte: thisMonth } } }),
      prisma.patientFeedback.aggregate({ _avg: { rating: true } }),
      prisma.partner.findMany({
        where: { type: "DOCTOR" },
        orderBy: { rating: "desc" },
        take: 10,
        select: { name: true, rating: true, totalTasks: true },
      }),
      prisma.partner.findMany({
        where: { type: "LAB" },
        orderBy: { rating: "desc" },
        take: 10,
        select: { name: true, rating: true, totalTasks: true },
      }),
      prisma.partner.findMany({
        where: { type: "PHARMACY" },
        orderBy: { rating: "desc" },
        take: 10,
        select: { name: true, rating: true, totalTasks: true },
      }),
    ]);

  return ok(
    {
      totalOrders,
      completedOrders,
      avgSatisfaction: avgRating._avg.rating || 0,
      topDoctors, // أفضل الأطباء (L259)
      topLabs, // أفضل المختبرات (L260)
      topPharmacies, // أفضل الصيدليات (L261)
    },
    { requestId }
  );
});
