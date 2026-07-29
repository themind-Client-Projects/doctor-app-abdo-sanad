import { prisma } from "@/lib/prisma";
import { AuthError, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { getTimeline } from "@/server/services/orders";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/orders/[id]/timeline — order tracking (req L384-407).
 *
 * Returns all 11 steps, done and pending, so the client can render the ladder
 * ahead rather than only the history.
 */
export const GET = withAuth<Ctx>({}, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, patientId: true, status: true, orderNumber: true },
  });

  if (!order) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }

  // Ownership: a patient may only track their own order. Staff may track any.
  if (identity.role === "PATIENT" && order.patientId !== identity.userId) {
    throw new AuthError(403, "ليس لديك صلاحية لتتبع هذا الطلب");
  }

  return ok(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      steps: await getTimeline(order.id),
    },
    { requestId }
  );
});
