import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/me/bookings/[id]/cancel — إلغاء الحجز.
 *
 * One endpoint for both kinds, because "cancel my booking" is one action to
 * the person doing it. The alternative was the screen choosing between
 * `PATCH /appointments/[id]` and an order route with different verbs, different
 * role rules and different status vocabularies — three chances to cancel the
 * wrong thing.
 *
 * Ownership is checked against `identity.userId` on the row itself, never on a
 * value from the client. This is the shape of route where "authenticated" gets
 * mistaken for "authorised".
 */
export const POST = withAuth<Ctx>({}, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  // An appointment and an order can never share an id, so trying both is
  // unambiguous — and it keeps the client from having to know which it holds.
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, patientId: true, status: true, date: true },
  });

  if (appointment) {
    if (appointment.patientId !== identity.userId) {
      return fail(ErrorCode.FORBIDDEN, 403, "ليس لديك صلاحية", { requestId });
    }
    if (appointment.status === "cancelled") {
      return ok({ id, status: "cancelled" }, { requestId });
    }
    // A visit that already happened cannot be un-happened; the record of it is
    // what the medical file and any settlement are built on.
    if (appointment.status === "completed") {
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "لا يمكن إلغاء موعد مكتمل", {
        requestId,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "cancelled" },
      select: { id: true, status: true },
    });
    return ok(updated, { requestId });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, patientId: true, status: true, paymentStatus: true },
  });
  if (!order) return fail(ErrorCode.NOT_FOUND, 404, "الحجز غير موجود", { requestId });
  if (order.patientId !== identity.userId) {
    return fail(ErrorCode.FORBIDDEN, 403, "ليس لديك صلاحية", { requestId });
  }
  if (order.status === "CANCELLED") return ok({ id, status: "CANCELLED" }, { requestId });

  // Once someone is on their way — or has arrived, or has started — cancelling
  // from the app would strand a provider mid-job. Those need the call centre,
  // which can also settle what is owed for the trip already made.
  const TOO_LATE = ["IN_TRANSIT", "ARRIVED", "IN_PROGRESS", "COMPLETED"];
  if (TOO_LATE.includes(order.status)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "بدأ تنفيذ الطلب — تواصل مع خدمة العملاء للإلغاء",
      { requestId }
    );
  }

  // Recorded in the ActivityLog, NOT the timeline: `OrderTimeline.step` is an
  // Int in the fixed 11-step lifecycle with @@unique([orderId, step]), so a
  // cancellation has no number to take — inventing one would either collide or
  // claim a stage the order never reached.
  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: "ألغى المريض الحجز من التطبيق",
        entityType: "order",
        entityId: id,
      },
    }),
  ]);

  return ok(updated, { requestId });
});
