import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { startOfBaghdadDay } from "@/lib/time";
import { withPatients } from "@/server/services/patient-contacts";

// GET /api/dashboard/calendar — Today's appointments only (req L79-82 "مواعيد اليوم فقط")
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  // Baghdad midnight, not the server's UTC midnight — otherwise "today's
  // appointments" means yesterday's until 03:00 local.
  const today = startOfBaghdadDay();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // Scoped to the caller. Every clinical role could read the whole platform's
  // appointment book — a lab or a driver could page through today's patients
  // for every doctor. A doctor sees their own; a platform role sees all.
  const where: Prisma.AppointmentWhereInput = { date: { gte: today, lt: tomorrow } };
  if (!isPlatformRole(identity.role)) {
    // Appointment.doctorId references DoctorProfile.id, not Partner.id — using
    // partnerId here would match nothing and read as "no appointments".
    where.doctorId = identity.doctorProfileId ?? "";
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      doctor: { select: { userId: true } },
    },
    orderBy: { time: "asc" },
  });

  // `patientId` is a bare String with no relation, so the widget was rendering
  // an empty name beside every time — today's calendar with nobody on it.
  const hydrated = await withPatients(appointments);

  return ok(
    hydrated.map((a) => ({
      id: a.id,
      patientName: a.patient?.name ?? "حساب غير متاح",
      time: a.time,
      type: a.type,
      status: a.status,
    })),
    { requestId }
  );
});
