import { Prisma } from "@prisma/client";
import { TX_OPTIONS, prisma } from "@/lib/prisma";
import { PROVIDER_SLOT, isProviderRole } from "@/lib/order-slots";

/**
 * A partner's wallet as the OWNER moves it — payouts, adjustments and debts.
 *
 * Settlement (`commission.ts`) is the only thing that EARNS money into a
 * wallet: it credits `balance` and `totalEarnings` together, per settled order.
 * Everything here is the owner acting on that money afterwards, and none of it
 * touches `totalEarnings` — a payout is money leaving the platform to the
 * partner, not money the partner stops having earned.
 *
 * The rule this module exists to enforce: THE LEDGER AND THE BALANCE MOVE
 * TOGETHER. `POST /api/wallets/[partnerId]/transfers` inserted a Transaction
 * row and never touched `Wallet.balance`, so a payout appeared in the history
 * while the balance kept showing money already paid out — and a DEBIT had no
 * guard, so nothing stopped paying out more than was held.
 */

const D = Prisma.Decimal;

export class PartnerWalletError extends Error {
  constructor(
    readonly code: "NO_WALLET" | "INSUFFICIENT_BALANCE" | "NOT_FOUND" | "ALREADY_SETTLED",
    message: string,
    readonly detail?: { balance: string; required: string }
  ) {
    super(message);
    this.name = "PartnerWalletError";
  }
}

/**
 * Pay a partner out (DEBIT) or adjust them up (CREDIT) — atomically.
 *
 * The DEBIT guard is in the UPDATE's own predicate, the same pattern as the
 * patient wallet: a read-then-write check is a race two concurrent payouts
 * both win.
 */
export async function recordPartnerTransfer(params: {
  partnerId: string;
  type: "CREDIT" | "DEBIT";
  amount: number | Prisma.Decimal;
  description?: string;
  orderId?: string | null;
  adminId: string;
}) {
  const amount = new D(params.amount);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { partnerId: params.partnerId } });
    if (!wallet) throw new PartnerWalletError("NO_WALLET", "لا توجد محفظة لهذا الشريك");

    if (params.type === "DEBIT") {
      const { count } = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (count === 0) {
        throw new PartnerWalletError(
          "INSUFFICIENT_BALANCE",
          "المبلغ أكبر من رصيد الشريك",
          { balance: wallet.balance.toString(), required: amount.toString() }
        );
      }
    } else {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
    }

    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: params.type,
        description:
          params.description?.trim() ||
          (params.type === "DEBIT" ? "تحويل إلى الشريك" : "إضافة رصيد من الإدارة"),
        orderId: params.orderId ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.adminId,
        action: params.type === "DEBIT" ? "تحويل مستحقات إلى شريك" : "إضافة رصيد لمحفظة شريك",
        entityType: "partner_wallet",
        entityId: params.partnerId,
        details: { amount: amount.toString(), type: params.type, transactionId: transaction.id },
      },
    });

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return { transaction, wallet: updated };
  }, TX_OPTIONS);
}

/* ---------------------------------- debts --------------------------------- */

/** A debt past its due date that nobody has settled. Computed, never stored —
 *  a status column would need a job to flip it, and would be wrong until then. */
export function debtState(debt: { status: string; dueDate: Date }, now = new Date()) {
  if (debt.status === "paid") return "paid" as const;
  if (debt.status === "cancelled") return "cancelled" as const;
  return debt.dueDate < now ? ("overdue" as const) : ("pending" as const);
}

/** Money the partner owes the platform — a penalty, an advance, a correction. */
export async function recordDebt(params: {
  partnerId: string;
  amount: number;
  reason: string;
  dueDate: Date;
  adminId: string;
}) {
  const partner = await prisma.partner.findUnique({
    where: { id: params.partnerId },
    select: { id: true, userId: true, name: true },
  });
  if (!partner) throw new PartnerWalletError("NOT_FOUND", "الشريك غير موجود");

  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.create({
      data: {
        partnerId: partner.id,
        amount: new D(params.amount),
        reason: params.reason,
        dueDate: params.dueDate,
        status: "pending",
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.adminId,
        action: `تسجيل دين على ${partner.name}`,
        entityType: "debt",
        entityId: debt.id,
        details: { amount: String(params.amount), reason: params.reason },
      },
    });

    // The partner has to learn they owe money, not discover it in a statement.
    if (partner.userId) {
      await tx.notification.create({
        data: {
          userId: partner.userId,
          title: "تم تسجيل مبلغ مستحق عليك",
          body: `${params.amount} د.ع — ${params.reason}`,
          type: "debt",
        },
      });
    }

    return debt;
  }, TX_OPTIONS);
}

/**
 * Close a debt — paid in cash/bank, or taken out of the partner's own balance.
 *
 * `fromWallet` debits the wallet and records the Transaction in the SAME
 * transaction that marks the debt paid, with the balance guard in the
 * predicate: a debt settled from money the partner does not have would leave a
 * negative balance and a debt that reads as paid.
 */
export async function settleDebt(params: {
  debtId: string;
  partnerId: string;
  fromWallet: boolean;
  adminId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Scoped to the partner in the URL, so a debt id from another partner is a
    // not-found rather than a settlement against the wrong account.
    const debt = await tx.debt.findFirst({
      where: { id: params.debtId, partnerId: params.partnerId },
    });
    if (!debt) throw new PartnerWalletError("NOT_FOUND", "الدين غير موجود");
    if (debt.status === "paid" || debt.status === "cancelled") {
      throw new PartnerWalletError("ALREADY_SETTLED", "هذا الدين مُسدَّد مسبقاً");
    }

    if (params.fromWallet) {
      const wallet = await tx.wallet.findUnique({ where: { partnerId: params.partnerId } });
      if (!wallet) throw new PartnerWalletError("NO_WALLET", "لا توجد محفظة لهذا الشريك");

      const { count } = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: debt.amount } },
        data: { balance: { decrement: debt.amount } },
      });
      if (count === 0) {
        throw new PartnerWalletError(
          "INSUFFICIENT_BALANCE",
          "رصيد الشريك لا يكفي لتسديد الدين منه",
          { balance: wallet.balance.toString(), required: debt.amount.toString() }
        );
      }

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: debt.amount,
          type: "DEBIT",
          description: `تسديد دين — ${debt.reason ?? ""}`.trim(),
        },
      });
    }

    // Only a debt still open can be closed — the status is in the predicate,
    // so two admins settling the same debt cannot both debit the wallet.
    const { count } = await tx.debt.updateMany({
      where: { id: debt.id, status: { notIn: ["paid", "cancelled"] } },
      data: { status: "paid" },
    });
    if (count === 0) throw new PartnerWalletError("ALREADY_SETTLED", "هذا الدين مُسدَّد مسبقاً");

    await tx.activityLog.create({
      data: {
        userId: params.adminId,
        action: params.fromWallet ? "تسديد دين من رصيد الشريك" : "تسجيل تسديد دين",
        entityType: "debt",
        entityId: debt.id,
        details: { amount: debt.amount.toString(), fromWallet: params.fromWallet },
      },
    });

    return tx.debt.findUniqueOrThrow({ where: { id: debt.id } });
  }, TX_OPTIONS);
}

/* --------------------------------- dues ----------------------------------- */

/**
 * "المستحقات" — the value of work delivered and not yet settled.
 *
 * NOT `Wallet.pendingAmount`: that column is a number nothing maintains, and it
 * read zero for every partner on the owner's screen. This is the same figure
 * the partner's own earnings screen already computes — completed, priced,
 * unsettled orders in the one slot this partner's type occupies.
 */
export async function partnerDues(partnerId: string): Promise<Prisma.Decimal> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { type: true },
  });
  if (!partner || !isProviderRole(partner.type)) return new D(0);

  const slot = PROVIDER_SLOT[partner.type];
  const result = await prisma.order.aggregate({
    where: {
      [slot]: partnerId,
      status: "COMPLETED",
      totalAmount: { gt: 0 },
      orderSettlement: null,
      deletedAt: null,
    },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount ?? new D(0);
}
