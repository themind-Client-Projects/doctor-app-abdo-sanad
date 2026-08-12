import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_ROLES, AuthError, isPlatformRole, withAuth } from "@/lib/api-auth";
import type { Identity } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Is this caller a party to this appointment?
 *
 * The parties are its patient, its doctor, and the platform roles who dispatch.
 * Only the patient half was checked, so any doctor could read, edit and delete
 * any other doctor's appointment by id — including rescheduling it.
 */
function isPartyTo(
  appointment: { patientId: string; doctorId: string },
  identity: Identity
): boolean {
  if (isPlatformRole(identity.role)) return true;
  if (identity.role === "PATIENT") return appointment.patientId === identity.userId;
  return Boolean(identity.doctorProfileId) && appointment.doctorId === identity.doctorProfileId;
}

const appointmentStatus = z.enum(["scheduled", "completed", "cancelled", "no_show"], {
  message: "حالة غير صالحة",
});
const appointmentType = z.enum(["IN_PERSON", "ONLINE", "HOME_VISIT", "SURGERY"], {
  message: "نوع الموعد غير صالح",
});

// The body was spread into update, so the client could set `price` (and
// doctorId / patientId). All three are deliberately absent: `price` is
// server-controlled, and a booking cannot be moved to another doctor or patient.
// `.strict()` makes an unknown key (including `price`) a 400.
const updateAppointmentSchema = z
  .object({
    type: appointmentType.optional(),
    date: z
      .union([z.string(), z.number()], { message: "التاريخ غير صالح" })
      .pipe(z.coerce.date({ message: "التاريخ غير صالح" }))
      .optional(),
    time: nonEmpty.optional(),
    status: appointmentStatus.optional(),
    notes: z.string().optional(),
    complexId: nonEmpty.optional(),
  })
  .strict();

// GET /api/appointments/[id]
export const GET = withAuth<Ctx>({ roles: APPOINTMENT_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: true },
  });
  if (!appointment) {
    return fail(ErrorCode.NOT_FOUND, 404, "الموعد غير موجود", { requestId });
  }

  // Authentication alone would let any signed-up patient read every booking —
  // and, before `appointmentScope`, let any doctor read another doctor's.
  if (!isPartyTo(appointment, identity)) {
    throw new AuthError(403, "ليس لديك صلاحية");
  }

  return ok(appointment, { requestId });
});

// PATCH /api/appointments/[id] — Update an appointment.
export const PATCH = withAuth<Ctx>({ roles: APPOINTMENT_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const input = await parseBody(req, updateAppointmentSchema);

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, patientId: true, doctorId: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "الموعد غير موجود", { requestId });
  }
  if (!isPartyTo(existing, identity)) {
    throw new AuthError(403, "ليس لديك صلاحية");
  }

  // Explicit allow-list — `undefined` leaves a column untouched in Prisma.
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      type: input.type,
      date: input.date,
      time: input.time,
      status: input.status,
      notes: input.notes,
      complexId: input.complexId,
    },
  });

  return ok(appointment, { requestId });
});

// DELETE /api/appointments/[id] — Cancel an appointment.
export const DELETE = withAuth<Ctx>(
  { roles: APPOINTMENT_ROLES },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, doctorId: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "الموعد غير موجود", { requestId });
    }
    // This route once deleted any appointment by id with no authentication at
    // all. Both parties are checked now, not just the patient.
    if (!isPartyTo(existing, identity)) {
      throw new AuthError(403, "ليس لديك صلاحية");
    }

    await prisma.appointment.delete({ where: { id } });

    return ok({ message: "تم حذف الموعد" }, { requestId });
  }
);
