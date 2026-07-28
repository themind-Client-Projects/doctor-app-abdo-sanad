import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { OrderError, completeOrder } from "@/server/services/orders";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/orders/[id]/complete — finish the order and distribute the revenue.
//
// This is the ONLY path to COMPLETED. Nothing previously reached that status,
// which is why settlement — which refuses anything else — could never fire.
export const POST = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  try {
    const result = await completeOrder({ orderId: id, actorId: identity.userId });

    // Settlement is reported, never silently swallowed: the service really was
    // delivered, so the order stays completed even if (say) the partner's
    // contract has expired — but an operator must be able to see that the
    // money did not move.
    return ok(
      {
        order: result.order,
        settled: Boolean(result.settlement),
        settlement: result.settlement,
        settlementError: result.settlementError,
      },
      { requestId }
    );
  } catch (error) {
    if (error instanceof OrderError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "NOT_PRICED" ? 422 : 409;
      const code =
        error.code === "NOT_FOUND"
          ? ErrorCode.NOT_FOUND
          : error.code === "NOT_PRICED"
            ? ErrorCode.BUSINESS_RULE_VIOLATION
            : ErrorCode.INVALID_STATE_TRANSITION;
      return fail(code, status, error.message, { requestId });
    }
    throw error;
  }
});
