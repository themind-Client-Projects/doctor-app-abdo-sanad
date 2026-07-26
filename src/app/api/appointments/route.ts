import { NextResponse } from "next/server";
import type { AppointmentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// Appointment.status is a free-text `String` column; `type` is a real enum.
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

// GET /api/appointments — List appointments.
export const GET = withAuth(
  { roles: [...ROLES.CLINICAL, "PATIENT"] },
  async (req, _ctx, identity) => {
    const sp = req.nextUrl.searchParams;
    const doctorId = sp.get("doctorId");
    const patientId = sp.get("patientId");
    const status = sp.get("status");

    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

    const where: Prisma.AppointmentWhereInput = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) {
      if (!APPOINTMENT_STATUSES.includes(status)) {
        return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      }
      where.status = status;
    }

    // A patient sees only their own appointments, whatever ?patientId= says.
    if (identity.role === "PATIENT") where.patientId = identity.userId;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { doctor: { select: { userId: true } } },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);

    return NextResponse.json({
      data: appointments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
);

// POST /api/appointments — Create an appointment.
//
// This used to be `prisma.appointment.create({ data: body })`, which let the
// client dictate `price` — POST {"price":0} bought a free consultation. `price`
// is now never read from the body: it stays unset and is server-controlled.
export const POST = withAuth(
  { roles: [...ROLES.CLINICAL, "PATIENT"] },
  async (req, _ctx, identity) => {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const { doctorId, patientId, complexId, type, date, time, status, notes } = body;

    if (typeof doctorId !== "string" || !doctorId.trim()) {
      return NextResponse.json({ error: "الطبيب مطلوب" }, { status: 400 });
    }
    if (typeof time !== "string" || !time.trim()) {
      return NextResponse.json({ error: "الوقت مطلوب" }, { status: 400 });
    }
    if (typeof date !== "string" && typeof date !== "number") {
      return NextResponse.json({ error: "التاريخ مطلوب" }, { status: 400 });
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }
    if (type !== undefined && !APPOINTMENT_TYPES.includes(type as string)) {
      return NextResponse.json({ error: "نوع الموعد غير صالح" }, { status: 400 });
    }
    if (status !== undefined && !APPOINTMENT_STATUSES.includes(status as string)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    // A patient may only book for themselves; staff book on a patient's behalf.
    const resolvedPatientId =
      identity.role === "PATIENT"
        ? identity.userId
        : typeof patientId === "string" && patientId.trim()
          ? patientId
          : null;
    if (!resolvedPatientId) {
      return NextResponse.json({ error: "المريض مطلوب" }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      // Explicit allow-list. `price` is intentionally absent — it must never
      // come from the client.
      data: {
        doctorId,
        patientId: resolvedPatientId,
        complexId: typeof complexId === "string" ? complexId : null,
        type: (type as AppointmentType) ?? "IN_PERSON",
        date: parsedDate,
        time,
        status: typeof status === "string" ? status : "scheduled",
        notes: typeof notes === "string" ? notes : null,
      },
    });

    return NextResponse.json({ data: appointment }, { status: 201 });
  }
);
