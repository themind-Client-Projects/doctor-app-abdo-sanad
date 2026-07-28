import { z } from "zod";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { PricingError } from "@/server/services/pricing";
import { OrderError, priceOrder } from "@/server/services/orders";

type Ctx = { params: Promise<{ id: string }> };

const priceSchema = z
  .object({
    couponCode: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

// POST /api/orders/[id]/price — resolve and store the order's amount.
//
// Order.totalAmount existed but nothing ever wrote it, so every order arrived
// at settlement with nothing to split. Pricing is a separate, explicit step so
// the amount is committed (and any coupon consumed) before completion.
export const POST = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, priceSchema);

  try {
    const { order, quote } = await priceOrder({ orderId: id, couponCode: input.couponCode });
    return ok(
      {
        orderId: order.id,
        subtotal: quote.subtotal.toString(),
        discountTotal: quote.discountTotal.toString(),
        totalAmount: quote.totalAmount.toString(),
        currency: quote.currency,
        appliedCoupon: quote.appliedCoupon,
        // Surfaced so an operator can see WHY a discount did not fully apply.
        minimumApplied: quote.minimumApplied,
      },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PricingError) {
      const status = error.code === "NO_PRICE" ? 422 : 409;
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, status, error.message, { requestId });
    }
    if (error instanceof OrderError) {
      return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
    }
    throw error;
  }
});
