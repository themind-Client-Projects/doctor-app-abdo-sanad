import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { startOfBaghdadDay } from "@/lib/time";

// GET /api/dashboard/tasks — Current tasks per role (req L48-58 ⭐)
//
// `role` used to come from the query string, so any signed-in caller could ask
// for another role's work queue. It is now the caller's own session role; the
// `?role=` parameter the web client still sends is ignored.
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const today = startOfBaghdadDay();

  // Fail closed. Taking the role from the session stopped role spoofing, but
  // left the DATA unscoped — every lab saw every other lab's samples. A
  // partner-scoped user with no Partner row must match nothing, not everything.
  const scopeId = identity.partnerId ?? "";
  // Appointment.doctorId FKs DoctorProfile.id, not Partner.id.
  const doctorScopeId = identity.doctorProfileId ?? "";

  let data;

  switch (identity.role) {
    case "DOCTOR":
      data = await prisma.appointment.findMany({
        where: { date: { gte: today }, doctorId: doctorScopeId },
        orderBy: { time: "asc" },
        take: 20,
      });
      break;
    case "LAB":
      data = await prisma.labSample.findMany({
        where: { status: { not: "sent_to_patient" }, labId: scopeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    case "PHARMACY":
      data = await prisma.prescription.findMany({
        where: { status: { not: "delivered" }, pharmacyId: scopeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    case "RADIOLOGY":
      data = await prisma.radiologyRequest.findMany({
        where: { status: { not: "sent_to_doctor" }, centerId: scopeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    case "NURSE":
      data = await prisma.order.findMany({
        where: { status: { not: "COMPLETED" }, assignedNurseId: scopeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    case "DRIVER":
      data = await prisma.order.findMany({
        where: { status: { not: "COMPLETED" }, assignedDriverId: scopeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      break;
    default:
      // OPERATIONS and SUPER_ADMIN legitimately see the whole queue.
      data = await prisma.order.findMany({
        where: { status: { not: "COMPLETED" }, createdAt: { gte: today } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
  }

  return ok(data, { requestId });
});
