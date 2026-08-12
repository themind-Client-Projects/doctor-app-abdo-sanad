import { z } from "zod";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { OrderError, TIMELINE_STEPS, advanceOrder, getTimeline } from "@/server/services/orders";

type Ctx = { params: Promise<{ id: string }> };

const stepCodes = TIMELINE_STEPS.map((s) => s.code) as [string, ...string[]];

const advanceSchema = z
  .object({
    step: z.enum(stepCodes),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

function lifecycleFailure(error: OrderError, requestId?: string) {
  switch (error.code) {
    case "NOT_FOUND":
      return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
    case "STEP_ALREADY_DONE":
      return fail(ErrorCode.DUPLICATE_RESOURCE, 409, error.message, { requestId });
    case "INVALID_TRANSITION":
    case "OUT_OF_ORDER":
      return fail(ErrorCode.INVALID_STATE_TRANSITION, 409, error.message, { requestId });
    default:
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, { requestId });
  }
}

// GET /api/orders/[id]/advance — the 11-step ladder, done and pending.
//
// The tracking screen previously received only the completed rows, so it could
// not render the steps still ahead — the requirement's timeline is the whole
// ladder, not just its history.
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  return ok(await getTimeline(id), { requestId });
});

// POST /api/orders/[id]/advance — record the next step and move the status.
export const POST = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, advanceSchema);

  // COMPLETED is reachable here in principle — it is the 11th rung — but this
  // route only records the step and moves the status. `completeOrder` is what
  // distributes the revenue, and COMPLETED is terminal, so an order finished
  // through this door could never be settled afterwards: the partner would
  // simply never be paid. The ladder stops at step 10 from outside.
  if (input.step === "COMPLETED") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "أكمل الطلب عبر إجراء الإكمال ليتم توزيع الإيراد",
      { requestId }
    );
  }

  try {
    const order = await advanceOrder({
      orderId: id,
      stepCode: input.step as never,
      actorId: identity.userId,
      description: input.description,
    });
    return ok(order, { requestId });
  } catch (error) {
    if (error instanceof OrderError) return lifecycleFailure(error, requestId);
    throw error;
  }
});
