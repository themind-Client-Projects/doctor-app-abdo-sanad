import { prisma } from "@/lib/prisma";
import { creditWallet, ensureWallet } from "@/server/services/patient-wallet";
import {
  MIN_AMOUNT_IQD,
  createPaymentLink,
  getPaymentLink,
  isConfigured,
  toInternalStatus,
} from "@/server/services/wayl";

/**
 * Topping a patient wallet up through Wayl.
 *
 * The whole design turns on one hazard: **the webhook can fire more than once**,
 * out of order, and from anyone who can reach a public URL. Crediting on the
 * strength of that POST is how a forged or repeated webhook mints money.
 *
 * So settlement does two things the naive version does not:
 *
 *  1. It CONFIRMS with Wayl (`getPaymentLink`) instead of trusting the payload.
 *     The webhook is only a hint that something changed.
 *  2. It credits inside a transition guarded by `settledAt: null` in the WHERE
 *     clause. Two concurrent webhooks both pass any `if (!settled)` check; only
 *     one can win an UPDATE that requires the row to still be unsettled.
 */

export class TopupUnavailable extends Error {
  constructor() {
    super("بوابة الدفع غير مهيأة حالياً");
    this.name = "TopupUnavailable";
  }
}

/** Start a top-up: our intent first, then Wayl's link. */
export async function startTopup(params: {
  userId: string;
  amount: number;
  webhookUrl?: string;
  redirectionUrl?: string;
}) {
  if (!isConfigured()) throw new TopupUnavailable();
  if (!Number.isInteger(params.amount) || params.amount < MIN_AMOUNT_IQD) {
    throw new Error(`أقل مبلغ للشحن ${MIN_AMOUNT_IQD} د.ع`);
  }

  const wallet = await ensureWallet(params.userId);

  // The intent is created BEFORE the gateway call. If Wayl then fails, we hold
  // a PENDING row that can be reconciled — where calling first and recording
  // second loses the payment entirely when the write fails.
  const intent = await prisma.paymentIntent.create({
    data: {
      walletId: wallet.id,
      // Our id IS the reference, so a retry cannot open a second link: Wayl's
      // `referenceId` is unique on their side too.
      reference: `wallet_${wallet.id}_${Date.now()}`,
      amount: params.amount,
      currency: "IQD",
      status: "PENDING",
    },
  });

  try {
    const link = await createPaymentLink({
      reference: intent.reference,
      amount: params.amount,
      label: "شحن المحفظة",
      webhookUrl: params.webhookUrl,
      redirectionUrl: params.redirectionUrl,
    });

    return prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerRef: link.id,
        checkoutUrl: link.url,
        providerStatus: link.status,
      },
    });
  } catch (error) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", providerStatus: "gateway_error" },
    });
    throw error;
  }
}

/**
 * Settle an intent — safe to call repeatedly, from a webhook or a poll.
 *
 * Returns what actually happened, so the caller can tell "credited" from
 * "already credited" rather than assuming.
 */
export async function settleTopup(reference: string): Promise<{
  outcome: "credited" | "already_settled" | "still_pending" | "failed" | "unknown_reference";
  amount?: string;
}> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { reference },
    include: { wallet: { select: { userId: true } } },
  });
  if (!intent) return { outcome: "unknown_reference" };
  if (intent.settledAt) return { outcome: "already_settled", amount: intent.amount.toString() };

  // Confirm with the gateway. The webhook body is untrusted input — it arrives
  // on a public URL and says whatever its sender wants it to say.
  const link = await getPaymentLink(reference);
  const status = toInternalStatus(link.status);

  if (status === "FAILED") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", providerStatus: link.status },
    });
    return { outcome: "failed" };
  }

  if (status !== "SETTLED") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { providerStatus: link.status },
    });
    return { outcome: "still_pending" };
  }

  // Never credit the amount the gateway reports back without checking it
  // against what we asked for — a mismatch is a bug or an attack, not a
  // discount to be silently applied.
  if (Number(link.total) !== Number(intent.amount)) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", providerStatus: `amount_mismatch:${link.total}` },
    });
    throw new Error(
      `Wayl reported ${link.total} for ${reference}, intent was ${intent.amount.toString()}`
    );
  }

  // The claim: only the request that flips settledAt from null may credit.
  // Two concurrent webhooks both reach here; exactly one updates a row.
  const { count } = await prisma.paymentIntent.updateMany({
    where: { id: intent.id, settledAt: null },
    data: { settledAt: new Date(), status: "SETTLED", providerStatus: link.status },
  });
  if (count === 0) return { outcome: "already_settled", amount: intent.amount.toString() };

  await creditWallet({
    userId: intent.wallet.userId,
    amount: intent.amount,
    reason: "TOPUP",
    description: "شحن المحفظة عبر واصل",
  });

  return { outcome: "credited", amount: intent.amount.toString() };
}
