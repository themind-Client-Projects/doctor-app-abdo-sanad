import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `reason` is the only client input; the acting employee is the verified caller,
// so no actor id is accepted here. `.strict()` makes an unknown key a 400.
const rejectOrderSchema = z
  .object({
    // An empty reason is recorded as "no reason given", as it was before.
    reason: z.string().trim().optional(),
  })
  .strict();

// POST /api/orders/[id]/reject — Reject order (req L319 "رفض")
//
// The rejection reason was parsed out of the body and then thrown away, so a
// cancelled order carried no record of why. It is now written to the timeline
// alongside the acting employee, who is the verified caller rather than a
// client-supplied id.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const input = await parseBody(req, rejectOrderSchema);
    const reason = input.reason || null;

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        operationsEmployeeId: identity.userId,
      },
    });

    // Step 2 is the accept/reject decision. Upserted so a repeated rejection
    // does not blow up on @@unique([orderId, step]).
    await prisma.orderTimeline.upsert({
      where: { orderId_step: { orderId: id, step: 2 } },
      create: {
        orderId: id,
        step: 2,
        title: "تم رفض الطلب",
        description: reason,
        completedAt: new Date(),
        completedBy: identity.userId,
      },
      update: {
        title: "تم رفض الطلب",
        description: reason,
        completedAt: new Date(),
        completedBy: identity.userId,
      },
    });

    return ok(order, { requestId });
  }
);
