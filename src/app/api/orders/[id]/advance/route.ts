import { z } from "zod";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { orderScopeFor } from "@/lib/order-slots";
import {
  OrderError,
  PROVIDER_STEPS,
  TIMELINE_STEPS,
  advanceOrder,
  getTimeline,
} from "@/server/services/orders";

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

/**
 * Is this order one the caller may move? Platform roles: any. A provider: only
 * an order sitting in THEIR assignment slot.
 *
 * Scoped in the query, so an order assigned to someone else is the same 404 as
 * an order that does not exist — the endpoint cannot be used to probe ids.
 */
async function reachable(orderId: string, identity: Parameters<typeof orderScopeFor>[0]) {
  const order = await prisma.order.findFirst({
    where: { AND: [{ id: orderId, deletedAt: null }, orderScopeFor(identity)] },
    select: { id: true },
  });
  return order !== null;
}

// GET /api/orders/[id]/advance — the 11-step ladder, done and pending.
//
// The tracking screen previously received only the completed rows, so it could
// not render the steps still ahead — the requirement's timeline is the whole
// ladder, not just its history. A provider may read the ladder of an order
// assigned to them, which is what tells their screen which step comes next.
export const GET = withAuth<Ctx>({ roles: ROLES.STAFF }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  if (!(await reachable(id, identity))) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }
  return ok(await getTimeline(id), { requestId });
});

// POST /api/orders/[id]/advance — record the next step and move the status.
//
// Was ROLES.OPERATIONS. The nurse's visits screen and the driver's trips screen
// render "في الطريق / تم الوصول / بدأ التنفيذ" and every press answered 403 —
// the two roles whose whole job is moving an order along could not move one.
//
// Now any member of staff, under two limits that keep dispatch decisions with
// operations:
//   1. a provider may only move an order assigned to THEM;
//   2. a provider may only record the steps a provider actually performs —
//      contacting the patient through to finishing the service and uploading
//      results. Accepting, assigning, notifying the patient and completing
//      stay with operations: those are decisions about the order, not reports
//      of work done on it.
export const POST = withAuth<Ctx>({ roles: ROLES.STAFF }, async (req, { params }, identity) => {
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

  if (!isPlatformRole(identity.role)) {
    if (!(PROVIDER_STEPS as readonly string[]).includes(input.step)) {
      return fail(
        ErrorCode.FORBIDDEN,
        403,
        "هذه الخطوة تسجّلها العمليات — يمكنك تسجيل خطوات تنفيذ الخدمة فقط",
        { requestId }
      );
    }
    if (!(await reachable(id, identity))) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }
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
