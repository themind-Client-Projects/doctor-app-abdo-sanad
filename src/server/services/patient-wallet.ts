import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The patient wallet — a prepaid balance the patient spends, distinct from
 * `Wallet`, which is the provider EARNINGS ledger `settleOrder` writes.
 *
 * One invariant governs everything here: **balance == sum of transactions**.
 * Every mutation therefore writes the movement and adjusts the balance inside
 * the SAME transaction, and the balance is never assigned — only incremented,
 * so two concurrent debits cannot both read the old value and write back a
 * total that forgets one of them.
 */

/** Money is Decimal end to end; a float would drift on the third IQD. */
const D = Prisma.Decimal;

export class InsufficientBalance extends Error {
  constructor(
    readonly balance: string,
    readonly required: string
  ) {
    super("الرصيد غير كافٍ");
    this.name = "InsufficientBalance";
  }
}

export type WalletReason = "TOPUP" | "PAYMENT" | "REFUND" | "REWARD";

/** Resolve the wallet, creating it on first use so an older account still works. */
export async function ensureWallet(userId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.patientWallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

/**
 * Add money to a patient's wallet — the admin top-up ("admin can add money to
 * wallet"), and also how a refund lands.
 */
export async function creditWallet(params: {
  userId: string;
  amount: number | Prisma.Decimal;
  reason: Extract<WalletReason, "TOPUP" | "REFUND" | "REWARD">;
  description?: string;
  orderId?: string | null;
}) {
  const amount = new D(params.amount);
  if (amount.lte(0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(params.userId, tx);

    await tx.patientTransaction.create({
      data: {
        walletId: wallet.id,
        orderId: params.orderId ?? null,
        amount,
        type: "CREDIT",
        reason: params.reason,
        description: params.description ?? null,
      },
    });

    // `increment`, not a computed assignment: two concurrent credits must not
    // both read the same starting balance and write back a total missing one.
    return tx.patientWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });
  });
}

/**
 * Take money out — what "the wallet should decrease after going to a doctor or
 * a lab" means in practice.
 *
 * Refuses to overdraw. The check and the write are in one transaction and the
 * update carries the balance condition in its own predicate, so a double-tap
 * cannot pass the check twice and drive the balance negative.
 */
export async function debitWallet(params: {
  userId: string;
  amount: number | Prisma.Decimal;
  description?: string;
  orderId?: string | null;
}) {
  const amount = new D(params.amount);
  if (amount.lte(0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(params.userId, tx);

    // The guard lives in the WHERE clause, not in an `if` above it: an `if`
    // that reads the balance and then updates is a race two concurrent
    // requests both win.
    const { count } = await tx.patientWallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (count === 0) {
      throw new InsufficientBalance(wallet.balance.toString(), amount.toString());
    }

    await tx.patientTransaction.create({
      data: {
        walletId: wallet.id,
        orderId: params.orderId ?? null,
        amount,
        type: "DEBIT",
        reason: "PAYMENT",
        description: params.description ?? null,
      },
    });

    return tx.patientWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  });
}

/**
 * Pay for an order from the wallet, if the admin has switched electronic
 * deduction on.
 *
 * Returns `null` when the flag is off, so the caller falls through to whatever
 * payment method the order already carries rather than silently doing nothing.
 * The flag is read here — not at the call site — so there is exactly one place
 * that decides whether deduction happens.
 */
export async function payOrderFromWallet(orderId: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: "booking.electronic_deduction" },
    select: { isEnabled: true },
  });
  if (!flag?.isEnabled) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      patientId: true,
      totalAmount: true,
      paymentStatus: true,
      serviceType: true,
    },
  });
  if (!order?.totalAmount) return null;
  // Never charge twice for the same order.
  if (order.paymentStatus === "PAID") return null;

  const wallet = await debitWallet({
    userId: order.patientId,
    amount: order.totalAmount,
    orderId: order.id,
    description: "دفع رسوم خدمة",
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PAID", paymentMethod: "WALLET" },
  });

  return wallet;
}
