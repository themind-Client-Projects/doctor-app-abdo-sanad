import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";
import { unsettledOrderWhere } from "@/server/services/commission";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  type: z.preprocess(
    emptyToUndefined,
    z.enum(["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"]).optional()
  ),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/wallets — All partner wallets (admin view, req L239-246)
//
// Was unbounded: one row per partner, so the response grew with the platform.
// Ordering moved from `balance desc` to the keyset order `(createdAt, id) desc`
// — a balance-ordered cursor is not stable, because a balance changes between
// pages and the client would see rows twice or not at all.
//
// Each row now carries its partner's OPEN debts, and `meta.summary` totals the
// whole platform. The screen's KPI tiles summed the loaded page and labelled it
// as the platform total — a figure that silently stopped being true at wallet
// number 101.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { q, type, cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const filters: Prisma.WalletWhereInput[] = [];
  if (q) filters.push({ partner: { name: { contains: q, mode: "insensitive" } } });
  if (type) filters.push({ partner: { type } });
  const where: Prisma.WalletWhereInput = filters.length ? { AND: filters } : {};

  const OPEN = { notIn: ["paid", "cancelled"] };

  const [wallets, totals, overdrafts, debtTotals, dues] = await Promise.all([
    prisma.wallet.findMany({
      where: keyset.where ? { AND: [where, keyset.where] } : where,
      include: { partner: { select: { id: true, name: true, type: true } } },
      orderBy: keyset.orderBy,
      take: keyset.take,
    }),
    prisma.wallet.aggregate({ _sum: { balance: true, totalEarnings: true }, _count: true }),
    // A wallet below zero is money the PLATFORM is owed, and `_sum(balance)`
    // nets it off against everyone else's credit — so «إجمالي الأرصدة» quietly
    // understated what Warid owes by exactly the amount it is owed back.
    //
    // Reversal is where this comes from: it claws back the partner's full
    // share, and if the partner had already withdrawn it the balance goes
    // negative. That is correct — flooring the decrement would forgive a real
    // debt — but it has to be visible rather than netted.
    prisma.wallet.aggregate({ where: { balance: { lt: 0 } }, _sum: { balance: true }, _count: true }),
    prisma.debt.aggregate({ where: { status: OPEN }, _sum: { amount: true }, _count: true }),
    // المستحقات across the platform: delivered, priced, not yet settled — the
    // same definition `partnerDues` applies per partner.
    prisma.order.aggregate({
      where: unsettledOrderWhere(),
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  const { items, page } = toPage(wallets, limit);

  // One grouped query for the page's partners, not one per row.
  const debts = await prisma.debt.groupBy({
    by: ["partnerId"],
    where: { status: OPEN, partnerId: { in: items.map((w) => w.partnerId) } },
    _sum: { amount: true },
  });
  const debtBy = new Map(debts.map((d) => [d.partnerId, d._sum.amount]));
  const zero = new Prisma.Decimal(0);

  return okList(
    items.map((w) => ({ ...w, openDebts: debtBy.get(w.partnerId) ?? zero })),
    page,
    {
      requestId,
      summary: {
        wallets: totals._count,
        balance: totals._sum.balance ?? zero,
        earnings: totals._sum.totalEarnings ?? zero,
        // Reported as a positive magnitude: "this much is owed back to Warid".
        overdrafts: (overdrafts._sum.balance ?? zero).negated(),
        overdraftCount: overdrafts._count,
        openDebts: debtTotals._sum.amount ?? zero,
        openDebtCount: debtTotals._count,
        dues: dues._sum.totalAmount ?? zero,
        duesOrders: dues._count,
      },
    }
  );
});
