import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** The `BloodType` enum from prisma/schema.prisma. */
const bloodType = z.enum(
  ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
  { message: "زمرة الدم غير صالحة" }
);

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const dateValue = z
  .union([z.string(), z.number()])
  .pipe(z.coerce.date({ message: "موعد السحب غير صالح" }));

/** `""` and `null` clear the appointment, as they did before. */
const drawAppointment = z
  .union([z.literal(""), z.null(), dateValue], { message: "موعد السحب غير صالح" })
  .transform((value) => (value instanceof Date ? value : null));

// Allow-list of the editable columns — the body used to be spread into
// prisma.bloodBankRequest.update, so every column (including the id) was
// rewritable in one call. `.strict()` makes an unknown key a 400.
const updateBloodBankRequestSchema = z
  .object({
    requestType: nonEmpty.optional(),
    bloodType: bloodType.optional(),
    governorateId: nonEmpty.optional(),
    // An enum, not a free string: the employee screen drives this workflow and
    // a typo used to be storable, leaving a request in a state no filter
    // matched and no one could see.
    status: z
      .enum(["new", "broadcast", "matched", "fulfilled", "cancelled"], {
        message: "حالة غير صالحة",
      })
      .optional(),
    donorId: nonEmpty.optional(),
    donorName: z.string().optional(),
    drawAppointment: drawAppointment.optional(),
    testStatus: z.string().optional(),
    deliveryStatus: z.string().optional(),
  })
  .strict();

// PATCH /api/blood-bank/[id] — Update a request (req L433-443).
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const input = await parseBody(req, updateBloodBankRequestSchema);

    const existing = await prisma.bloodBankRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
    }

    // `broadcastAt` is DERIVED, never sent: it records when the case actually
    // went out to donors, so letting a client supply it would allow a timestamp
    // that disagrees with the status it is supposed to evidence.
    const broadcastAt = input.status === "broadcast" ? new Date() : undefined;

    // `undefined` leaves a column untouched in Prisma.
    const data = await prisma.bloodBankRequest.update({
      where: { id },
      data: {
        broadcastAt,
        requestType: input.requestType,
        bloodType: input.bloodType,
        governorateId: input.governorateId,
        status: input.status,
        donorId: input.donorId,
        donorName: input.donorName,
        drawAppointment: input.drawAppointment,
        testStatus: input.testStatus,
        deliveryStatus: input.deliveryStatus,
      },
    });

    return ok(data, { requestId });
  }
);
