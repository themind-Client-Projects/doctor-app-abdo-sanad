import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/appointments/today — Today's appointments only (req L82).
// Staff-facing worklist: this is the whole day's schedule across patients, so
// it is clinical-staff only, never PATIENT.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    include: { doctor: { select: { userId: true } } },
    orderBy: { time: "asc" },
  });

  return ok(appointments, { requestId });
});
