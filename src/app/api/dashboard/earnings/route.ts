import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { startOfBaghdadDay, startOfBaghdadMonth } from "@/lib/time";
import { orderScopeFor } from "@/lib/order-slots";

const D = Prisma.Decimal;

/**
 * GET /api/dashboard/earnings — what this partner has actually been paid.
 *
 * This returned `{ today: 0, month: 0, upcoming: 0 }` — hardcoded, with a TODO.
 * A partner opening their finance screen saw three confident zeros next to a
 * currency, indistinguishable from "you earned nothing". The figures now come
 * from the wallet ledger, which is the only record that decides what a partner
 * is owed.
 *
 * `balance` is the wallet's own figure and `today`/`month` are sums over its
 * CREDIT rows — the same ledger, so they cannot disagree.
 *
 * `upcoming` is deliberately NOT `Wallet.pendingAmount`: that column is a
 * number nothing maintains. It is counted from the orders this partner has
 * delivered that carry an amount and have not yet settled — money genuinely
 * still owed.
 */
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // A platform role has no wallet of its own; the screen is a partner's.
  if (isPlatformRole(identity.role) || !identity.partnerId) {
    return ok(
      { today: 0, month: 0, upcoming: 0, balance: 0, currency: "د.ع", hasWallet: false },
      { requestId }
    );
  }

  const wallet = await prisma.wallet.findUnique({
    where: { partnerId: identity.partnerId },
    select: { id: true, balance: true },
  });

  if (!wallet) {
    return ok(
      { today: 0, month: 0, upcoming: 0, balance: 0, currency: "د.ع", hasWallet: false },
      { requestId }
    );
  }

  const dayStart = startOfBaghdadDay();
  const monthStart = startOfBaghdadMonth();

  const [today, month, unsettled] = await Promise.all([
    prisma.transaction.aggregate({
      where: { walletId: wallet.id, type: "CREDIT", createdAt: { gte: dayStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { walletId: wallet.id, type: "CREDIT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    // Delivered, priced, and not yet settled — the honest meaning of "owed".
    prisma.order.aggregate({
      where: {
        ...orderScopeFor(identity),
        status: "COMPLETED",
        totalAmount: { gt: 0 },
        orderSettlement: null,
      },
      _sum: { totalAmount: true },
    }),
  ]);

  return ok(
    {
      today: Number(today._sum.amount ?? 0),
      month: Number(month._sum.amount ?? 0),
      // The gross value of unsettled work. The partner's share of it depends on
      // the commission rule that will apply, so this is labelled as the value
      // pending settlement rather than as a payout figure.
      upcoming: Number(new D(unsettled._sum.totalAmount ?? 0)),
      balance: Number(wallet.balance),
      currency: "د.ع",
      hasWallet: true,
    },
    { requestId }
  );
});
