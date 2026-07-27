import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Only the transfer target is accepted — the employee handing the order on is
// the verified caller. `.strict()` makes an unknown key a 400.
const transferOrderSchema = z
  .object({
    targetEmployeeId: z
      .string({ message: "الموظف المستهدف مطلوب" })
      .trim()
      .min(1, { message: "الموظف المستهدف مطلوب" }),
  })
  .strict();

// POST /api/orders/[id]/transfer — Transfer order (req L321 "تحويل")
//
// `targetEmployeeId` used to be written straight into operationsEmployeeId with
// no checks at all, so an order could be handed to a non-existent user, or to a
// patient. The transfer is now scoped to the verified caller: an operations
// employee may only hand on an order that is unowned or already theirs, while a
// super admin may reassign anything.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const { targetEmployeeId } = await parseBody(req, transferOrderSchema);

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, operationsEmployeeId: true },
    });
    if (!order) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    if (
      identity.role !== "SUPER_ADMIN" &&
      order.operationsEmployeeId !== null &&
      order.operationsEmployeeId !== identity.userId
    ) {
      throw new AuthError(403, "لا يمكنك تحويل طلب غير مسند إليك");
    }

    const target = await prisma.user.findUnique({
      where: { id: targetEmployeeId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target || !target.isActive) {
      return fail(ErrorCode.NOT_FOUND, 404, "الموظف غير موجود", { requestId });
    }
    if (target.role !== "OPERATIONS" && target.role !== "SUPER_ADMIN") {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        400,
        "لا يمكن تحويل الطلب إلى هذا المستخدم",
        { requestId }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { operationsEmployeeId: targetEmployeeId },
    });

    return ok(updated, { requestId });
  }
);
