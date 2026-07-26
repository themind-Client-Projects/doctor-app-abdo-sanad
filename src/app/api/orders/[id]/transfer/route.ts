import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

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
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const targetEmployeeId =
      body && typeof body.targetEmployeeId === "string" ? body.targetEmployeeId : null;

    if (!targetEmployeeId) {
      return NextResponse.json({ error: "الموظف المستهدف مطلوب" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, operationsEmployeeId: true },
    });
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
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
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });
    }
    if (target.role !== "OPERATIONS" && target.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "لا يمكن تحويل الطلب إلى هذا المستخدم" },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { operationsEmployeeId: targetEmployeeId },
    });

    return NextResponse.json({ data: updated });
  }
);
