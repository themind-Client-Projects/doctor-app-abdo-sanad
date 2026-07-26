import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// GET — Partner performance evaluation (req L148, L176 "تقييم الأداء")
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    select: { rating: true, totalTasks: true },
  });
  if (!partner) return NextResponse.json({ error: "الشريك غير موجود" }, { status: 404 });

  // Every order this partner was assigned to, in any role.
  const assignedToPartner = {
    OR: [
      { assignedNurseId: id },
      { assignedDriverId: id },
      { assignedLabId: id },
      { assignedPharmacyId: id },
      { assignedRadiologyId: id },
    ],
  };

  const [completedOrders, feedbacks] = await Promise.all([
    prisma.order.count({ where: { ...assignedToPartner, status: "COMPLETED" } }),
    // Was `where: { orderId: { not: null } }` — no partner filter at all, so
    // every partner's performance page showed the same global feed of patient
    // comments, including comments about other partners. Now joined through the
    // order's assignee fields so a partner only sees feedback on its own orders.
    prisma.patientFeedback.findMany({
      where: { order: { is: assignedToPartner } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: { ...partner, completedOrders, recentFeedbacks: feedbacks },
  });
});
