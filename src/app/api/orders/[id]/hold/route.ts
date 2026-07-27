import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Holding takes no input: `.strict()` on an empty object means a body that still
// carries an `employeeId` is a 400 instead of being quietly ignored.
const holdOrderSchema = z.object({}).strict();

// POST /api/orders/[id]/hold — Hold order (req L320 "تعليق")
//
// The employee putting the order on hold is the verified caller, so the order
// records who is handling it rather than leaving it unattributed.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    await parseBody(req, holdOrderSchema);

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
        status: "DELAYED",
        operationsEmployeeId: identity.userId,
      },
    });

    return ok(order, { requestId });
  }
);
