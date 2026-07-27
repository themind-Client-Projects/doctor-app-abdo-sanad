import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// GET — Partner performance evaluation (req L148, L176 "تقييم الأداء")
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    select: { rating: true, totalTasks: true },
  });
  if (!partner) return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير موجود", { requestId });

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
    // Fixed-size widget: the 10 most recent comments, deliberately not paginated.
    prisma.patientFeedback.findMany({
      where: { order: { is: assignedToPartner } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return ok({ ...partner, completedOrders, recentFeedbacks: feedbacks }, { requestId });
});
