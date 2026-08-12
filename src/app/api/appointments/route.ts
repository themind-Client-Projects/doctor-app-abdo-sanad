import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_ROLES, appointmentScope, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
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

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  doctorId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  patientId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  status: z.preprocess(emptyToUndefined, appointmentStatus.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
  { roles: APPOINTMENT_ROLES },
  async (req, _ctx, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { page, pageSize, doctorId, patientId, status, cursor, limit } = parseQuery(
      req.nextUrl.searchParams,
      listQuerySchema
    );

    const where: Prisma.AppointmentWhereInput = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    // Tenant scope, applied LAST so it overrides the client-supplied filters —
    // those may only narrow within the caller's own slice. A patient saw only
    // their own already; a DOCTOR did not, so `?doctorId=` let one doctor read
    // another's whole book.
    Object.assign(where, appointmentScope(identity));

    const include = { doctor: { select: { userId: true } } } as const;

    // Keyset paging — preferred. The cursor is over `(createdAt, id)`, so this
    // path orders by insertion rather than by `date`: an appointment can be
    // rescheduled between pages, which makes a date-ordered cursor unstable.
    if (cursor !== undefined || limit !== undefined) {
      const take = limit ?? 20;
      const keyset = keysetArgs(cursor, take);
      const cursorWhere = "where" in keyset ? keyset.where : undefined;

      const rows = await prisma.appointment.findMany({
        ...keyset,
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include,
      });

      const { items, page: pageMeta } = toPage(rows, take);
      return okList(items, pageMeta, { requestId });
    }

    // Legacy offset mode — response shape and `date desc` ordering unchanged.
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);

    return okList(
      appointments,
      { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
      { requestId, legacy: { total, page, pageSize } }
    );
  }
);

// POST /api/appointments — Create an appointment.
export const POST = withAuth(
  { roles: APPOINTMENT_ROLES },
  async (req, _ctx, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const input = await parseBody(req, createAppointmentSchema);

    // A patient may only book for themselves; staff book on a patient's behalf.
    const resolvedPatientId =
      identity.role === "PATIENT" ? identity.userId : (input.patientId ?? null);
    if (!resolvedPatientId) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "المريض مطلوب", { requestId });
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

    return ok(appointment, { status: 201, requestId });
  }
);
