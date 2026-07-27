import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Accepting takes no input: `.strict()` on an empty object means a body that
// still carries an `employeeId` is a 400 instead of being quietly ignored.
const acceptOrderSchema = z.object({}).strict();

// POST /api/orders/[id]/accept — Accept order (req L318 "قبول")
//
// The acting employee is the verified caller. It used to come from
// `body.employeeId`, so anyone could record the acceptance against another
// employee.
//
// Accepting twice used to throw P2002 on @@unique([orderId, step]), which
// rolled the status change back with a 500. The timeline row is now only
// created when it is absent, making a repeated accept a no-op.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    await parseBody(req, acceptOrderSchema);

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    const alreadyAccepted = await prisma.orderTimeline.findUnique({
      where: { orderId_step: { orderId: id, step: 2 } },
      select: { id: true },
    });

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        operationsEmployeeId: identity.userId,
        ...(alreadyAccepted
          ? {}
          : {
              timeline: {
                create: {
                  step: 2,
                  title: "تم قبول الطلب",
                  completedAt: new Date(),
                  completedBy: identity.userId,
                },
              },
            }),
      },
    });

    return ok(order, { requestId });
  }
);
