import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, parseBody, parseQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** The `BloodType` enum from prisma/schema.prisma. */
const bloodType = z.enum(
  ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
  { message: "زمرة الدم غير صالحة" }
);

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const dateValue = z
  .union([z.string(), z.number()])
  .pipe(z.coerce.date({ message: "موعد السحب غير صالح" }));

/** `""` and `null` mean "no appointment", as they did before. */
const drawAppointment = z
  .union([z.literal(""), z.null(), dateValue], { message: "موعد السحب غير صالح" })
  .transform((value) => (value instanceof Date ? value : null));

// `.strict()` so an unexpected key is a 400 rather than being silently written:
// the body used to be spread straight into Prisma, so any column was writable
// and an unknown blood group crashed as a 500 instead of a 400.
const createBloodBankRequestSchema = z
  .object({
    /** The toggle at the top of the form: طالب دم or متبرع دم. */
    requestType: z.enum(["REQUESTER", "DONOR"], { message: "نوع الطلب مطلوب" }),
    userId: nonEmpty.optional(),

    // ── Identity ────────────────────────────────────────────────────────────
    fullName: z.string().trim().min(3, { message: "الاسم الثلاثي مطلوب" }).max(120),
    phone: z.string().trim().min(6, { message: "رقم الهاتف مطلوب" }).max(32),
    photoUrl: z.string().trim().max(500).optional(),
    age: z.number().int().min(1).max(120).optional(),
    gender: z.string().trim().max(16).optional(),
    residence: z.string().trim().max(240).optional(),
    landmark: z.string().trim().max(160).optional(),
    bloodType,
    governorateId: nonEmpty.optional(),
    lastDonation: drawAppointment.optional(),

    // ── REQUESTER only ──────────────────────────────────────────────────────
    operationType: z.string().trim().max(160).optional(),
    bagsNeeded: z.number().int().min(1).max(50).optional(),
    operationPlace: z.string().trim().max(240).optional(),

    // ── Workflow — set by the employee, not by the form ─────────────────────
    status: nonEmpty.default("new"),
    donorId: nonEmpty.optional(),
    donorName: z.string().optional(),
    drawAppointment: drawAppointment.optional(),
    testStatus: z.string().optional(),
    deliveryStatus: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict()
  // A blood REQUEST without an operation, a bag count and a place is not
  // actionable — the employee cannot match donors against it. A DONOR
  // registration carries none of those, which is why this is conditional.
  .refine((v) => v.requestType !== "REQUESTER" || Boolean(v.operationType && v.bagsNeeded && v.operationPlace), {
    message: "نوع العملية وعدد الأكياس ومكان العملية مطلوبة لطلب الدم",
    path: ["operationType"],
  });

// GET /api/blood-bank — Blood bank requests (req L433-443)
//
// Was unbounded: requests are kept after they are fulfilled, so this returned
// the entire history of the blood bank on every load.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.bloodBankRequest.findMany({
    where: keyset.where ?? {},
    include: { governorate: true },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/blood-bank — Create a request.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createBloodBankRequestSchema);

  const data = await prisma.bloodBankRequest.create({
    data: {
      requestType: input.requestType,
      userId: input.userId ?? null,
      fullName: input.fullName,
      phone: input.phone,
      photoUrl: input.photoUrl ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      residence: input.residence ?? null,
      landmark: input.landmark ?? null,
      lastDonation: input.lastDonation ?? null,
      operationType: input.operationType ?? null,
      bagsNeeded: input.bagsNeeded ?? null,
      operationPlace: input.operationPlace ?? null,
      notes: input.notes ?? null,
      bloodType: input.bloodType,
      governorateId: input.governorateId ?? null,
      status: input.status,
      donorId: input.donorId ?? null,
      donorName: input.donorName ?? null,
      drawAppointment: input.drawAppointment ?? null,
      testStatus: input.testStatus ?? null,
      deliveryStatus: input.deliveryStatus ?? null,
    },
  });

  return ok(data, { status: 201, requestId });
});
