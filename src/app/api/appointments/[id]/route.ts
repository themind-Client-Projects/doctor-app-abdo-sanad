import { NextResponse } from "next/server";
import type { AppointmentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const APPOINTMENT_STATUSES: readonly string[] = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
];
const APPOINTMENT_TYPES: readonly string[] = [
  "IN_PERSON",
  "ONLINE",
  "HOME_VISIT",
  "SURGERY",
];

const PATIENT_ROLES = [...ROLES.CLINICAL, "PATIENT"] as const;

// GET /api/appointments/[id]
export const GET = withAuth<Ctx>({ roles: PATIENT_ROLES }, async (_req, { params }, identity) => {
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: true },
  });
  if (!appointment) {
    return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
  }

  // Authentication alone would let any signed-up patient read every booking.
  if (identity.role === "PATIENT" && appointment.patientId !== identity.userId) {
    throw new AuthError(403, "ليس لديك صلاحية");
  }

  return NextResponse.json({ data: appointment });
});

// PATCH /api/appointments/[id] — Update an appointment.
// The body was spread into update, so the client could set `price` (and
// doctorId/patientId). `price` is server-controlled and not accepted here.
export const PATCH = withAuth<Ctx>({ roles: PATIENT_ROLES }, async (req, { params }, identity) => {
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { type, date, time, status, notes, complexId } = body;

  if (type !== undefined && !APPOINTMENT_TYPES.includes(type as string)) {
    return NextResponse.json({ error: "نوع الموعد غير صالح" }, { status: 400 });
  }
  if (status !== undefined && !APPOINTMENT_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  let parsedDate: Date | undefined;
  if (date !== undefined) {
    if (typeof date !== "string" && typeof date !== "number") {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }
    parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, patientId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
  }
  if (identity.role === "PATIENT" && existing.patientId !== identity.userId) {
    throw new AuthError(403, "ليس لديك صلاحية");
  }

  // Explicit allow-list — `undefined` leaves a column untouched in Prisma.
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      type: type === undefined ? undefined : (type as AppointmentType),
      date: parsedDate,
      time: typeof time === "string" ? time : undefined,
      status: typeof status === "string" ? status : undefined,
      notes: typeof notes === "string" ? notes : undefined,
      complexId: typeof complexId === "string" ? complexId : undefined,
    },
  });

  return NextResponse.json({ data: appointment });
});

// DELETE /api/appointments/[id] — Cancel an appointment.
export const DELETE = withAuth<Ctx>(
  { roles: PATIENT_ROLES },
  async (_req, { params }, identity) => {
    const { id } = await params;

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
    }
    // A patient may only cancel their own booking — this route previously
    // deleted any appointment by id, with no authentication at all.
    if (identity.role === "PATIENT" && existing.patientId !== identity.userId) {
      throw new AuthError(403, "ليس لديك صلاحية");
    }

    await prisma.appointment.delete({ where: { id } });

    return NextResponse.json({ message: "تم حذف الموعد" });
  }
);
