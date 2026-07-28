import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { CommissionError, reverseSettlement, settleOrder } from "@/server/services/commission";

type Ctx = { params: Promise<{ id: string }> };

/** Map a domain error to the right HTTP status + contract code. */
function settlementFailure(error: CommissionError, requestId?: string) {
  switch (error.code) {
    case "ALREADY_SETTLED":
      return fail(ErrorCode.DUPLICATE_RESOURCE, 409, error.message, { requestId });
    case "ORDER_NOT_COMPLETED":
      return fail(ErrorCode.INVALID_STATE_TRANSITION, 409, error.message, { requestId });
    case "NOT_SETTLED":
      return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
    default:
      // NO_CONTRACT / NO_RULE / SHARES_INVALID / NO_AMOUNT are all
      // "the data does not permit this", not "the request was malformed".
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, { requestId });
  }
}

// GET /api/orders/[id]/settle — the settlement actually applied to this order
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const settlement = await prisma.orderSettlement.findUnique({
    where: { orderId: id },
    include: { shares: true },
  });

  if (!settlement) {
    return fail(ErrorCode.NOT_FOUND, 404, "لا توجد تسوية لهذا الطلب", { requestId });
  }

  return ok(settlement, { requestId });
});

// POST /api/orders/[id]/settle — split the revenue and credit every wallet.
//
// Admin-only: this moves money. Idempotent on orderId, so a retry returns 409
// rather than paying every party twice.
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  try {
    return ok(await settleOrder(id, identity.userId), { status: 201, requestId });
  } catch (error) {
    if (error instanceof CommissionError) return settlementFailure(error, requestId);
    throw error;
  }
});

// DELETE /api/orders/[id]/settle — reverse a settlement (refund / dispute).
// The original rows are kept; a reversal is a new ledger entry, never an edit.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  try {
    return ok(await reverseSettlement(id, identity.userId), { requestId });
  } catch (error) {
    if (error instanceof CommissionError) return settlementFailure(error, requestId);
    throw error;
  }
});
