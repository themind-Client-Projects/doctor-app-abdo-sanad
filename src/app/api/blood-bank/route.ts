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
    requestType: z
      .string({ message: "نوع الطلب مطلوب" })
      .trim()
      .min(1, { message: "نوع الطلب مطلوب" }),
    bloodType,
    governorateId: nonEmpty.optional(),
    status: nonEmpty.default("new"),
    donorId: nonEmpty.optional(),
    donorName: z.string().optional(),
    drawAppointment: drawAppointment.optional(),
    testStatus: z.string().optional(),
    deliveryStatus: z.string().optional(),
  })
  .strict();

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
