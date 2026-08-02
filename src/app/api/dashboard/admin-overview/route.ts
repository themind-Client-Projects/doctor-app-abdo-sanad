import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/dashboard/admin-overview — the Super Admin Command Center
 * (req L117-127).
 *
 * `/api/dashboard/summary` has no SUPER_ADMIN branch, so it fell through to
 * `default: kpis = []` and the admin home rendered zeros for everything.
 *
 * Every figure here is an aggregate over real rows. Where the platform cannot
 * honestly measure something — server response time, error counts — it is
 * omitted rather than invented, which is the mistake `/api/system-monitoring`
 * makes by reporting a fabricated healthy system.
 */

const D = Prisma.Decimal;
const TREND_DAYS = 7;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Percent change, or null when there is no baseline to compare against. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [
    totalUsers,
    usersYesterday,
    totalOrders,
    ordersToday,
    ordersYesterday,
    revenueAgg,
    platformAgg,
    txToday,
    txYesterday,
    satisfaction,
    ordersByStatus,
    partnersByStatus,
    revenueByService,
    trendRows,
    topPartnerRows,
    recentActivity,
    activeServices,
    ordersByChannel,
    partnersByChannel,
    patientWallets,
    featureFlags,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { lt: today } } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.order.count({
      where: { deletedAt: null, createdAt: { gte: yesterday, lt: today } },
    }),
    prisma.orderSettlement.aggregate({
      _sum: { totalAmount: true },
      where: { status: "SETTLED" },
    }),
    // The platform's own cut. Recorded since the commission engine landed but
    // surfaced nowhere until now.
    prisma.settlementShare.aggregate({
      _sum: { amount: true },
      where: { party: "WARID", settlement: { status: "SETTLED" } },
    }),
    prisma.transaction.count({ where: { createdAt: { gte: today } } }),
    prisma.transaction.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.patientFeedback.aggregate({ _avg: { rating: true }, _count: true }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
    prisma.partner.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
    prisma.order.groupBy({
      by: ["serviceType"],
      _sum: { totalAmount: true },
      _count: { _all: true },
      where: { status: "COMPLETED", deletedAt: null },
    }),
    prisma.order.findMany({
      where: { deletedAt: null, createdAt: { gte: trendStart } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.settlementShare.groupBy({
      by: ["partnerId"],
      _sum: { amount: true },
      where: { party: { in: ["PARTNER", "COMPLEX"] }, partnerId: { not: null } },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.serviceConfig.groupBy({ by: ["status"], _count: { _all: true } }),

    // ── Added with the sales-channel model ──────────────────────────────────
    // Revenue and volume per storefront. سند discounts heavily, so the split
    // by COUNT and the split by MONEY are different questions and the dashboard
    // has to answer both — a channel can carry most of the orders and a
    // minority of the revenue.
    prisma.order.groupBy({
      by: ["source"],
      where: { deletedAt: null },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    // Which providers sell where. Counted from PartnerChannel rather than the
    // boolean it replaced, so a partner in two channels is counted in both.
    prisma.partnerChannel.groupBy({
      by: ["channel"],
      where: { status: { not: "SUSPENDED" } },
      _count: { _all: true },
    }),
    // Money the platform is holding on behalf of patients — a liability, not
    // revenue, and previously invisible.
    prisma.patientWallet.aggregate({ _sum: { balance: true }, _count: true }),
    // Optional features the admin has switched on, so the home screen shows
    // the platform's actual configuration rather than assuming defaults.
    prisma.featureFlag.findMany({
      select: { key: true, label: true, isEnabled: true },
      orderBy: { group: "asc" },
    }),
  ]);

  // Names for the top-partner table — groupBy cannot join.
  const topPartnerIds = topPartnerRows.map((r) => r.partnerId!).filter(Boolean);
  const partnerNames = new Map(
    (
      await prisma.partner.findMany({
        where: { id: { in: topPartnerIds } },
        select: { id: true, name: true, type: true },
      })
    ).map((p) => [p.id, p])
  );

  // Bucket the trend by local day.
  const byDay = new Map<string, { revenue: Prisma.Decimal; orders: number }>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), { revenue: new D(0), orders: 0 });
  }
  for (const row of trendRows) {
    const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.revenue = bucket.revenue.plus(row.totalAmount ?? 0);
    bucket.orders += 1;
  }

  const totalOrderCount = ordersByStatus.reduce((a, r) => a + r._count._all, 0);
  const completedCount =
    ordersByStatus.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
  const totalPartners = partnersByStatus.reduce((a, r) => a + r._count._all, 0);

  return ok(
    {
      kpis: {
        totalUsers: { value: totalUsers, change: change(totalUsers, usersYesterday) },
        totalOrders: { value: totalOrders, change: change(ordersToday, ordersYesterday) },
        totalRevenue: { value: Number(revenueAgg._sum.totalAmount ?? 0), change: null },
        platformProfit: { value: Number(platformAgg._sum.amount ?? 0), change: null },
        transactionsToday: { value: txToday, change: change(txToday, txYesterday) },
        satisfaction: {
          value: satisfaction._avg.rating
            ? Math.round(satisfaction._avg.rating * 10) / 10
            : null,
          count: satisfaction._count,
          change: null,
        },
      },

      ordersByStatus: ordersByStatus
        .map((r) => ({
          status: r.status,
          count: r._count._all,
          percent: totalOrderCount
            ? Math.round((r._count._all / totalOrderCount) * 100)
            : 0,
        }))
        .sort((a, b) => b.count - a.count),

      partnersByStatus: partnersByStatus
        .map((r) => ({
          status: r.status,
          count: r._count._all,
          percent: totalPartners ? Math.round((r._count._all / totalPartners) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count),

      revenueByService: revenueByService
        .map((r) => ({
          serviceType: r.serviceType,
          revenue: Number(r._sum.totalAmount ?? 0),
          orders: r._count._all,
        }))
        .sort((a, b) => b.revenue - a.revenue),

      // Per-storefront split — count and money separately, because سند's
      // discounts make them tell different stories.
      byChannel: ordersByChannel
        .map((r) => ({
          channel: r.source,
          orders: r._count._all,
          revenue: Number(r._sum.totalAmount ?? 0),
          partners: partnersByChannel.find((p) => p.channel === r.source)?._count._all ?? 0,
        }))
        .sort((a, b) => b.orders - a.orders),

      patientWallets: {
        count: patientWallets._count,
        totalBalance: Number(patientWallets._sum.balance ?? 0),
      },

      featureFlags: featureFlags.map((f) => ({
        key: f.key,
        label: f.label,
        isEnabled: f.isEnabled,
      })),

      revenueTrend: Array.from(byDay.entries()).map(([date, v]) => ({
        date,
        revenue: Number(v.revenue),
        orders: v.orders,
      })),

      topPartners: topPartnerRows.map((r) => ({
        partnerId: r.partnerId,
        name: partnerNames.get(r.partnerId!)?.name ?? r.partnerId,
        type: partnerNames.get(r.partnerId!)?.type ?? null,
        revenue: Number(r._sum.amount ?? 0),
      })),

      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        at: a.createdAt,
        user: a.user?.name ?? null,
        role: a.user?.role ?? null,
      })),

      // Only what can be measured from real rows. Response time, uptime and
      // error counts need instrumentation that does not exist yet, so they are
      // absent rather than fabricated.
      health: {
        totalOrders: totalOrderCount,
        completedOrders: completedCount,
        successRate: totalOrderCount
          ? Math.round((completedCount / totalOrderCount) * 1000) / 10
          : null,
        activeServices: activeServices
          .filter((s) => s.status === "ACTIVE")
          .reduce((a, s) => a + s._count._all, 0),
        totalServices: activeServices.reduce((a, s) => a + s._count._all, 0),
      },
    },
    { requestId }
  );
});
