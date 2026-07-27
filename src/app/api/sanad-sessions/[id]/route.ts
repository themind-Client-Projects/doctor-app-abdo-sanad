import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** req L445-453 — waiting → calling → in_session → ended. */
const sessionStatus = z.enum(["waiting", "calling", "in_session", "ended"], {
  message: "حالة الجلسة غير صالحة",
});

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const dateValue = z
  .union([z.string(), z.number()])
  .pipe(z.coerce.date({ message: "تاريخ غير صالح" }));

/** `""` and `null` clear the timestamp, as they did before. */
const nullableTimestamp = z
  .union([z.literal(""), z.null(), dateValue], { message: "تاريخ غير صالح" })
  .transform((value) => (value instanceof Date ? value : null));

// The body used to be spread into prisma.sanadSession.update, so a caller could
// rewrite doctorId / patientId and hand somebody else's consultation over — both
// are deliberately absent here. `.strict()` makes an unknown key a 400.
const updateSanadSessionSchema = z
  .object({
    status: sessionStatus.optional(),
    startedAt: nullableTimestamp.optional(),
    endedAt: nullableTimestamp.optional(),
  })
  .strict();

// PATCH /api/sanad-sessions/[id] — Advance a session (req L445-453).
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const input = await parseBody(req, updateSanadSessionSchema);

    const existing = await prisma.sanadSession.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
    }

    // `undefined` leaves a column untouched in Prisma.
    const data = await prisma.sanadSession.update({
      where: { id },
      data: {
        status: input.status,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
      },
    });

    return ok(data, { requestId });
  }
);
