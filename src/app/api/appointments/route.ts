import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

// Appointment.status is a free-text `String` column; `type` is a real enum
// (`AppointmentType` in prisma/schema.prisma).
const appointmentStatus = z.enum(["scheduled", "completed", "cancelled", "no_show"], {
  message: "حالة غير صالحة",
});
const appointmentType = z.enum(["IN_PERSON", "ONLINE", "HOME_VISIT", "SURGERY"], {
  message: "نوع الموعد غير صالح",
});

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = paginationSchema.extend({
  doctorId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  patientId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  status: z.preprocess(emptyToUndefined, appointmentStatus.optional()),
});

// `price` is intentionally absent: this used to be
// `prisma.appointment.create({ data: body })`, which let the client dictate it —
// POST {"price":0} bought a free consultation. It is server-controlled and never
// read from the body. `.strict()` makes an unknown key (including `price`) a 400.
const createAppointmentSchema = z
  .object({
    doctorId: z.string({ message: "الطبيب مطلوب" }).trim().min(1, { message: "الطبيب مطلوب" }),
    patientId: nonEmpty.optional(),
    complexId: nonEmpty.optional(),
    type: appointmentType.default("IN_PERSON"),
    date: z
      .union([z.string(), z.number()], { message: "التاريخ مطلوب" })
      .pipe(z.coerce.date({ message: "التاريخ غير صالح" })),
    time: z.string({ message: "الوقت مطلوب" }).trim().min(1, { message: "الوقت مطلوب" }),
    status: appointmentStatus.default("scheduled"),
    notes: z.string().optional(),
  })
  .strict();

// GET /api/appointments — List appointments.
export const GET = withAuth(
  { roles: [...ROLES.CLINICAL, "PATIENT"] },
  async (req, _ctx, identity) => {
    const { page, pageSize, doctorId, patientId, status } = parseQuery(
      req.nextUrl.searchParams,
      listQuerySchema
    );

    const where: Prisma.AppointmentWhereInput = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

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
export const POST = withAuth(
  { roles: [...ROLES.CLINICAL, "PATIENT"] },
  async (req, _ctx, identity) => {
    const input = await parseBody(req, createAppointmentSchema);

    // A patient may only book for themselves; staff book on a patient's behalf.
    const resolvedPatientId =
      identity.role === "PATIENT" ? identity.userId : (input.patientId ?? null);
    if (!resolvedPatientId) {
      return NextResponse.json({ error: "المريض مطلوب" }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      // Explicit allow-list. `price` is intentionally absent — it must never
      // come from the client.
      data: {
        doctorId: input.doctorId,
        patientId: resolvedPatientId,
        complexId: input.complexId ?? null,
        type: input.type,
        date: input.date,
        time: input.time,
        status: input.status,
        notes: input.notes ?? null,
      },
    });

    return NextResponse.json({ data: appointment }, { status: 201 });
  }
);
