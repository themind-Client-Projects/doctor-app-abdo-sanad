import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { startOfBaghdadDay, startOfBaghdadMonth } from "@/lib/time";
import { unsettledOrderWhere } from "@/server/services/commission";

// GET /api/reports — All 9 report types (req L255-264)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = startOfBaghdadDay();
  const thisMonth = startOfBaghdadMonth();

  const [
    totalOrders,
    completedOrders,
    avgRating,
    topDoctors,
    topLabs,
    topPharmacies,
    settledThisMonth,
    reversedThisMonth,
    unsettled,
  ] = await Promise.all([
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
      // التسويات — this report had no settlement query at all, so the one
      // report that is supposed to answer "where did the money go" could not
      // say whether it had been distributed.
      prisma.orderSettlement.aggregate({
        where: { status: "SETTLED", settledAt: { gte: thisMonth } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.orderSettlement.aggregate({
        where: { status: "REVERSED", reversedAt: { gte: thisMonth } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Not scoped to the month: unsettled work is a backlog that carries, and
      // an order stuck since last month is exactly the one worth seeing.
      prisma.order.aggregate({
        where: unsettledOrderWhere(),
        _sum: { totalAmount: true },
        _count: true,
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
      settlements: {
        settledCount: settledThisMonth._count,
        settledAmount: settledThisMonth._sum.totalAmount ?? 0,
        reversedCount: reversedThisMonth._count,
        reversedAmount: reversedThisMonth._sum.totalAmount ?? 0,
        pendingCount: unsettled._count,
        pendingAmount: unsettled._sum.totalAmount ?? 0,
      },
    },
    { requestId }
  );
});
