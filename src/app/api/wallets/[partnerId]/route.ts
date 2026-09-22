import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { partnerDues } from "@/server/services/partner-wallet";

type Ctx = { params: Promise<{ partnerId: string }> };

/**
 * GET /api/wallets/[partnerId] — the six figures the owner's screen promises.
 *
 * "الرصيد، المستحقات، التحويلات، الأرباح، الفواتير، الديون". The page listed
 * them in its subtitle and showed three, one of which (`pendingAmount`) is a
 * column nothing maintains and so read zero for every partner. All six now come
 * from where the money actually is:
 *
 *   الرصيد      Wallet.balance — held for the partner now
 *   المستحقات   delivered, priced, unsettled work — see `partnerDues`
 *   الأرباح     Wallet.totalEarnings — credited only by settlement
 *   التحويلات   the Transaction ledger (latest, and totals)
 *   الفواتير    open invoices raised against the partner
 *   الديون      open debts the partner owes the platform
 */
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;

  const wallet = await prisma.wallet.findUnique({
    where: { partnerId },
    include: {
      partner: { select: { id: true, name: true, type: true, phone: true } },
      transactions: { take: 20, orderBy: { createdAt: "desc" } },
    },
  });
  if (!wallet) return fail(ErrorCode.NOT_FOUND, 404, "لا توجد محفظة لهذا الشريك", { requestId });

  const now = new Date();
  const OPEN = { notIn: ["paid", "cancelled"] };

  const [dues, paidOut, openInvoices, openDebts, overdueDebts] = await Promise.all([
    partnerDues(partnerId),
    prisma.transaction.aggregate({
      where: { walletId: wallet.id, type: "DEBIT" },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { partnerId, status: OPEN },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.debt.aggregate({
      where: { partnerId, status: OPEN },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.debt.count({ where: { partnerId, status: OPEN, dueDate: { lt: now } } }),
  ]);

  const zero = new Prisma.Decimal(0);

  return ok(
    {
      ...wallet,
      figures: {
        balance: wallet.balance,
        dues,
        earnings: wallet.totalEarnings,
        paidOut: paidOut._sum.amount ?? zero,
        openInvoices: { amount: openInvoices._sum.amount ?? zero, count: openInvoices._count },
        openDebts: { amount: openDebts._sum.amount ?? zero, count: openDebts._count, overdue: overdueDebts },
      },
    },
    { requestId }
  );
});
