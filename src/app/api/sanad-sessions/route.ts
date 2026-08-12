import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/validation";

/** req L445-453 — waiting → calling → in_session → ended. */
const sessionStatus = z.enum(["waiting", "calling", "in_session", "ended"], {
  message: "حالة الجلسة غير صالحة",
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread straight into Prisma, so every column was writable
// and a missing appointmentTime surfaced as a 500 rather than a 400.
const createSanadSessionSchema = z
  .object({
    doctorId: z.string({ message: "الطبيب مطلوب" }).trim().min(1, { message: "الطبيب مطلوب" }),
    patientId: z.string({ message: "المريض مطلوب" }).trim().min(1, { message: "المريض مطلوب" }),
    appointmentTime: z
      .union([z.string(), z.number()], { message: "موعد الجلسة مطلوب" })
      .pipe(z.coerce.date({ message: "موعد الجلسة غير صالح" })),
    status: sessionStatus.default("waiting"),
  })
  .strict();

// `limit` alone could only ever return the newest N rows — there was no way to
// reach row N+1. `cursor` walks the whole list.
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/sanad-sessions — Online consultation sessions (req L445-453)
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const keyset = keysetArgs(cursor, limit);

  // No pre-existing filter on this list, so the cursor predicate — which
  // `keysetArgs` puts in `where` — is the whole clause.
  const rows = await prisma.sanadSession.findMany({
    ...keyset,
    // The screen is a waiting room: it has to name the doctor and the patient.
    // It previously received `doctor.userId` and nothing else, so it displayed
    // `doctorName` / `patientName` fields that were never in the response.
    include: {
      doctor: {
        select: {
          id: true,
          userId: true,
          user: { select: { name: true, phone: true } },
          specialty: { select: { name: true } },
        },
      },
    },
  });

  const { items, page } = toPage(rows, limit);

  // `SanadSession.patientId` is a plain column with no relation, so the patient
  // cannot be joined — one lookup for the page's ids rather than one per row.
  const patientIds = [...new Set(items.map((s) => s.patientId))];
  const patients = patientIds.length
    ? await prisma.user.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const byId = new Map(patients.map((p) => [p.id, p]));

  return okList(
    items.map((s) => ({ ...s, patient: byId.get(s.patientId) ?? null })),
    page,
    { requestId }
  );
});

// POST /api/sanad-sessions — Book a session.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSanadSessionSchema);

  const data = await prisma.sanadSession.create({
    data: {
      doctorId: input.doctorId,
      patientId: input.patientId,
      appointmentTime: input.appointmentTime,
      status: input.status,
    },
  });

  return ok(data, { status: 201, requestId });
});
