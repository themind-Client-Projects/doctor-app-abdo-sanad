import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/orders/[id]/hold — Hold order (req L320 "تعليق")
//
// The employee putting the order on hold is the verified caller, so the order
// records who is handling it rather than leaving it unattributed.
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

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: "DELAYED",
        operationsEmployeeId: identity.userId,
      },
    });

    return NextResponse.json({ data: order });
  }
);
