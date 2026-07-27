import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/dashboard/calendar — Today's appointments only (req L79-82 "مواعيد اليوم فقط")
export const GET = withAuth({ roles: ROLES.STAFF }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: today, lt: tomorrow },
    },
    include: {
      doctor: { select: { userId: true } },
    },
    orderBy: { time: "asc" },
  });

  return ok(appointments, { requestId });
});
