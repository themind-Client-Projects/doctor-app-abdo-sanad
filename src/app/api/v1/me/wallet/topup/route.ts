import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { TopupUnavailable, startTopup } from "@/server/services/topup";
import { MIN_AMOUNT_IQD, isConfigured } from "@/server/services/wayl";

/**
 * POST /api/v1/me/wallet/topup — open a Wayl payment link for the signed-in
 * patient and hand back its URL.
 *
 * The wallet is NOT credited here. It is credited when Wayl confirms, which is
 * the entire reason the webhook exists: crediting on "the user was sent to the
 * checkout page" pays out for payments nobody made.
 */
const bodySchema = z
  .object({
    // Whole IQD: Wayl's `total` is in major units, and a fractional dinar is
    // not a thing anyone can pay.
    amount: z
      .number()
      .int({ message: "المبلغ يجب أن يكون رقماً صحيحاً" })
      .min(MIN_AMOUNT_IQD, { message: `أقل مبلغ للشحن ${MIN_AMOUNT_IQD} د.ع` })
      .max(5_000_000),
  })
  .strict();

export const GET = withAuth({}, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  // Lets the UI hide the top-up button rather than offer one that 503s.
  return ok({ available: isConfigured(), minAmount: MIN_AMOUNT_IQD, currency: "IQD" }, { requestId });
});

export const POST = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { amount } = await parseBody(req, bodySchema);

  // Wayl calls US, so it needs a public origin — localhost would never be
  // reached and the payment would sit PENDING forever.
  const origin = process.env.APP_PUBLIC_URL ?? req.nextUrl.origin;

  try {
    const intent = await startTopup({
      userId: identity.userId,
      amount,
      webhookUrl: `${origin}/api/webhooks/wayl`,
      redirectionUrl: `${origin}/wallet`,
    });

    return ok(
      { reference: intent.reference, checkoutUrl: intent.checkoutUrl, amount: intent.amount },
      { status: 201, requestId }
    );
  } catch (error) {
    if (error instanceof TopupUnavailable) {
      return fail(ErrorCode.UPSTREAM_UNAVAILABLE, 503, error.message, { requestId });
    }
    throw error;
  }
});
