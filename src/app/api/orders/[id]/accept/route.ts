import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

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
  async (_req, { params }, identity) => {
    const { id } = await params;

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
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

    return NextResponse.json({ data: order });
  }
);
