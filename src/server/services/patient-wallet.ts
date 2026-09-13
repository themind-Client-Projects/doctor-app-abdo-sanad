import { Prisma } from "@prisma/client";
import { prisma, TX_OPTIONS } from "@/lib/prisma";

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

/**
 * Resolve the wallet, creating it on first use so an older account still works.
 *
 * `upsert` is NOT atomic against a unique constraint: Prisma reads, then
 * writes. Two requests arriving together both see "no wallet" and both insert,
 * and the loser gets P2002 — which `withAuth` maps to a 409. That is exactly
 * what the patient app produced, because React's dev double-invoke fires the
 * wallet fetch twice at once.
 *
 * Catching P2002 and re-reading is the fix: whichever request lost the race
 * still ends up with the row the winner created.
 */
export async function ensureWallet(userId: string, tx: Prisma.TransactionClient = prisma) {
  const existing = await tx.patientWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await tx.patientWallet.create({ data: { userId } });
  } catch (error) {
    // P2002 = someone else created it between the read and the write.
    if ((error as { code?: string })?.code !== "P2002") throw error;
    return tx.patientWallet.findUniqueOrThrow({ where: { userId } });
  }
}

export type CreditParams = {
  userId: string;
  amount: number | Prisma.Decimal;
  reason: Extract<WalletReason, "TOPUP" | "REFUND" | "REWARD">;
  description?: string;
  orderId?: string | null;
};

/**
 * Add money to a patient's wallet — the admin top-up ("admin can add money to
 * wallet"), and also how a refund lands.
 *
 * Pass `tx` to join a caller's transaction. A payment settlement has to mark
 * the intent settled and credit the balance atomically: done separately, a
 * failure between them leaves the intent flagged as paid with no money added,
 * and every webhook retry short-circuits on "already settled" — so the patient
 * pays and silently receives nothing.
 */
export async function creditWallet(params: CreditParams, tx?: Prisma.TransactionClient) {
  const amount = new D(params.amount);
  if (amount.lte(0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  if (tx) return creditIn(tx, params, amount);
  return prisma.$transaction((inner) => creditIn(inner, params, amount), TX_OPTIONS);
}

async function creditIn(
  tx: Prisma.TransactionClient,
  params: CreditParams,
  amount: Prisma.Decimal
) {
  {
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
  }
}

/**
 * Take money out — what "the wallet should decrease after going to a doctor or
 * a lab" means in practice.
 *
 * Refuses to overdraw. The check and the write are in one transaction and the
 * update carries the balance condition in its own predicate, so a double-tap
 * cannot pass the check twice and drive the balance negative.
 */
export type DebitParams = {
  userId: string;
  amount: number | Prisma.Decimal;
  description?: string;
  orderId?: string | null;
};

export async function debitWallet(params: DebitParams, tx?: Prisma.TransactionClient) {
  const amount = new D(params.amount);
  if (amount.lte(0)) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  // Joins a caller's transaction, exactly as `creditWallet` does. Buying a
  // membership has to take the money and grant the membership atomically:
  // separately, a failure between them charges the patient and hands them
  // nothing, which is the one outcome that must be impossible. This function
  // opened its own transaction and so could not be nested, which is the
  // asymmetry that made that impossible to write correctly.
  if (tx) return debitIn(tx, params, amount);
  return prisma.$transaction((inner) => debitIn(inner, params, amount), TX_OPTIONS);
}

async function debitIn(
  tx: Prisma.TransactionClient,
  params: DebitParams,
  amount: Prisma.Decimal
) {
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

  const transaction = await tx.patientTransaction.create({
    data: {
      walletId: wallet.id,
      orderId: params.orderId ?? null,
      amount,
      type: "DEBIT",
      reason: "PAYMENT",
      description: params.description ?? null,
    },
  });

  const updated = await tx.patientWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  // The transaction id comes back so a caller can record WHICH debit paid for
  // what it just created — the audit trail from a membership back to the money.
  return Object.assign(updated, { transactionId: transaction.id });
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
