import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { PROVIDER_SLOTS_IN_PRECEDENCE } from "@/lib/order-slots";
import { unsettledOrderWhere } from "@/server/services/commission";

/**
 * GET /api/settlements — the money the commission engine has and has not moved.
 *
 * Settlement ran only as a best-effort step at the end of `POST /complete`, and
 * the only notice that it had failed was a toast on whoever happened to be
 * looking. Retry (`POST /api/orders/[id]/settle`) and reversal (`DELETE`) both
 * existed and nothing in the app called either one, so a settlement that failed
 * stayed failed: the order was delivered, the patient had paid, and no partner
 * was ever credited. The only figure anywhere was an aggregate tile of
 * «المستحقات» — a single number with no way to see or act on what was inside it.
 *
 * Two views over the same money:
 *
 *  - `pending` — delivered, priced, and not paid out. `unsettledOrderWhere` is
 *    the engine's own settleable rule, so every row here is an order the retry
 *    button can actually act on.
 *  - `history` — the settlements that did run, including reversed ones, which
 *    are the audit trail of money that was taken back.
 *
 * OPERATIONS, matching `POST /api/orders/[id]/settle`: whoever may retry a
 * settlement must be able to see which ones need retrying. Reversal is the
 * discretionary act and stays ADMIN, on its own endpoint.
 */

const querySchema = z.object({
  view: z.enum(["pending", "history"]).default("pending"),
  /** `history` only — narrow to live or reversed settlements. */
  status: z.enum(["SETTLED", "REVERSED"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const PROVIDER_INCLUDE = { select: { id: true, name: true, type: true } } as const;

type AssignedPartner = { id: string; name: string; type: string } | null;

/**
 * The partner this order would pay out to, resolved in the same precedence the
 * engine uses — so the row names the partner who is actually waiting for the
 * money, not whichever slot happens to be filled.
 */
function providerOf(order: Record<string, unknown>): AssignedPartner {
  for (const slot of PROVIDER_SLOTS_IN_PRECEDENCE) {
    // `assignedLabId` → `assignedLab`.
    const relation = slot.replace(/Id$/, "");
    const partner = order[relation] as AssignedPartner | undefined;
    if (partner) return partner;
  }
  return null;
}

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { view, status, cursor, limit } = parseQuery(req.nextUrl.searchParams, querySchema);

  const keyset = keysetArgs(cursor, limit);

  if (view === "pending") {
    const where = unsettledOrderWhere();
    const [orders, totals] = await Promise.all([
      prisma.order.findMany({
        where: keyset.where ? { AND: [where, keyset.where] } : where,
        orderBy: keyset.orderBy,
        take: keyset.take,
        select: {
          id: true,
          orderNumber: true,
          patientName: true,
          serviceType: true,
          totalAmount: true,
          currency: true,
          paymentStatus: true,
          createdAt: true,
          assignedDoctor: PROVIDER_INCLUDE,
          assignedLab: PROVIDER_INCLUDE,
          assignedPharmacy: PROVIDER_INCLUDE,
          assignedRadiology: PROVIDER_INCLUDE,
          assignedNurse: PROVIDER_INCLUDE,
          assignedDriver: PROVIDER_INCLUDE,
          // A row with a reversal behind it is money that was clawed back, not
          // a settlement that never ran. The two look identical in a list of
          // "unsettled" orders and mean opposite things.
          orderSettlement: { select: { status: true, reversedAt: true } },
        },
      }),
      prisma.order.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
    ]);

    const { items, page } = toPage(orders, limit);

    return okList(
      items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        patientName: o.patientName,
        serviceType: o.serviceType,
        totalAmount: o.totalAmount,
        currency: o.currency,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        provider: providerOf(o),
        reversedAt: o.orderSettlement?.reversedAt ?? null,
      })),
      page,
      {
        requestId,
        summary: {
          orders: totals._count,
          amount: totals._sum.totalAmount ?? new Prisma.Decimal(0),
        },
      }
    );
  }

  const where: Prisma.OrderSettlementWhereInput = status ? { status } : {};
  const [settlements, settled, reversed] = await Promise.all([
    prisma.orderSettlement.findMany({
      where: keyset.where ? { AND: [where, keyset.where] } : where,
      orderBy: keyset.orderBy,
      take: keyset.take,
      include: {
        shares: { select: { party: true, partnerId: true, percentage: true, amount: true } },
        order: {
          select: { id: true, orderNumber: true, patientName: true, serviceType: true },
        },
      },
    }),
    prisma.orderSettlement.aggregate({
      where: { status: "SETTLED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.orderSettlement.aggregate({
      where: { status: "REVERSED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  const { items, page } = toPage(settlements, limit);

  return okList(items, page, {
    requestId,
    summary: {
      settledCount: settled._count,
      settledAmount: settled._sum.totalAmount ?? new Prisma.Decimal(0),
      reversedCount: reversed._count,
      reversedAmount: reversed._sum.totalAmount ?? new Prisma.Decimal(0),
    },
  });
});
