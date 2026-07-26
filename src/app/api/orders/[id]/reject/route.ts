import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/orders/[id]/reject — Reject order (req L319 "رفض")
//
// The rejection reason was parsed out of the body and then thrown away, so a
// cancelled order carried no record of why. It is now written to the timeline
// alongside the acting employee, who is the verified caller rather than a
// client-supplied id.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const reason =
      body && typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;

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

    return NextResponse.json({ data: order });
  }
);
