import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { canTransition } from "@/server/services/orders";
import { refundOrderToWallet } from "@/server/services/patient-wallet";

type Ctx = { params: Promise<{ id: string }> };

const cancelOrderSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * POST /api/orders/[id]/cancel — إلغاء طلب جارٍ.
 *
 * `reject` only reaches an order that is NEW or ACCEPTED: it writes the
 * accept/reject decision onto timeline step 2, which is wrong for an order
 * already assigned and on the road, and the orders screen offered it nowhere
 * else. So once a provider had been assigned, an order that had to be stopped
 * — the patient is not home, the provider's car broke down, the lab closed —
 * could not be stopped at all. It stayed in the queue forever.
 *
 * Three things this does that `reject` does not:
 *
 *  1. It works from any live status. `TRANSITIONS` already allows CANCELLED
 *     from every non-terminal state; nothing exposed it.
 *  2. It REFUNDS. `payOrderFromWallet` takes the fee when the order is priced
 *     and nothing ever gave it back, so a cancelled wallet-paid order left the
 *     patient charged for a service they never received. Best-effort and
 *     idempotent — see `refundOrderToWallet` — because the order must end up
 *     cancelled either way.
 *  3. It records WHY, in the ActivityLog rather than the timeline:
 *     `OrderTimeline.step` is an Int in the fixed 11-step lifecycle with
 *     `@@unique([orderId, step])`, so a cancellation has no number to take.
 *     Inventing one would either collide or claim a stage the order never
 *     reached.
 */
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const input = await parseBody(req, cancelOrderSchema);
    const reason = input.reason || null;

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, orderNumber: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    // Already cancelled is the state the caller asked for, so it is a success,
    // not a conflict — a double-tap must not produce an error toast.
    if (existing.status === "CANCELLED") {
      return ok({ id, status: "CANCELLED", refund: null }, { requestId });
    }

    // COMPLETED is terminal: the service was delivered and, once settled, the
    // partner has been paid out of it. Reversing that is a finance operation,
    // not a dispatch one.
    if (!canTransition(existing.status, "CANCELLED")) {
      return fail(
        ErrorCode.INVALID_STATE_TRANSITION,
        409,
        "لا يمكن إلغاء طلب مكتمل — التسوية تمت بالفعل",
        { requestId }
      );
    }

    const [order] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: "CANCELLED", operationsEmployeeId: identity.userId },
      }),
      prisma.activityLog.create({
        data: {
          userId: identity.userId,
          action: `إلغاء الطلب ${existing.orderNumber}`,
          entityType: "order",
          entityId: id,
          details: { reason, previousStatus: existing.status },
        },
      }),
    ]);

    // After the cancellation, not inside it: the refund is its own transaction
    // against the wallet, and a failure there must leave the order cancelled
    // rather than roll the cancellation back and strand the provider.
    const refund = await refundOrderToWallet({
      orderId: id,
      description: reason ? `استرجاع رسوم طلب ملغي — ${reason}` : undefined,
    });

    return ok({ ...order, refund }, { requestId });
  }
);
