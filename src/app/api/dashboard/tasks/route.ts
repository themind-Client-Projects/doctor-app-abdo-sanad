import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/dashboard/tasks — Current tasks per role (req L48-58 ⭐)
//
// `role` used to come from the query string, so any signed-in caller could ask
// for another role's work queue. It is now the caller's own session role; the
// `?role=` parameter the web client still sends is ignored.
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let data;

  switch (identity.role) {
    case "DOCTOR":
      data = await prisma.appointment.findMany({
        where: { date: { gte: today } },
        orderBy: { time: "asc" },
        take: 20,
      });
      break;
    case "LAB":
      data = await prisma.labSample.findMany({
        where: { status: { not: "sent_to_patient" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    case "PHARMACY":
      data = await prisma.prescription.findMany({
        where: { status: { not: "delivered" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    default:
      data = await prisma.order.findMany({
        where: { status: { not: "COMPLETED" }, createdAt: { gte: today } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
  }

  return ok(data, { requestId });
});
