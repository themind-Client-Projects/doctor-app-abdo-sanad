import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** The execution timeline is a fixed 11-step ladder (req L384-407). */
const MIN_STEP = 1;
const MAX_STEP = 11;

const stepError = { message: "رقم الخطوة غير صالح" };

// `completedBy` is deliberately absent — it is the verified caller, not a
// client-supplied id. `.strict()` makes an unknown key a 400.
const createTimelineEntrySchema = z
  .object({
    step: z.number(stepError).int(stepError).min(MIN_STEP, stepError).max(MAX_STEP, stepError),
    title: z
      .string({ message: "عنوان الخطوة مطلوب" })
      .trim()
      .min(1, { message: "عنوان الخطوة مطلوب" }),
    description: z.string().trim().optional(),
  })
  .strict();

// GET /api/orders/[id]/timeline — Get order timeline (req L384-407, 11 steps)
export const GET = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const timeline = await prisma.orderTimeline.findMany({
      where: { orderId: id },
      orderBy: { step: "asc" },
    });
    // Not paged: the timeline is a bounded 11-step ladder ordered by `step`,
    // not by `createdAt`, so a keyset cursor has nothing stable to sit on.
    return ok(timeline, { requestId });
  }
);

// POST /api/orders/[id]/timeline — Add timeline step.
//
// `step` and `title` used to be taken verbatim from the client, so any integer
// (or a non-integer, which then failed inside Prisma as a 500) could be written
// outside the 11-step ladder. `completedBy` came from the body too, letting a
// caller attribute a step to somebody else — it is now the verified caller.
export const POST = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const { step, title, description } = await parseBody(req, createTimelineEntrySchema);

    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }

    // @@unique([orderId, step]) — report the clash instead of throwing a 500.
    const duplicate = await prisma.orderTimeline.findUnique({
      where: { orderId_step: { orderId: id, step } },
      select: { id: true },
    });
    if (duplicate) {
      return fail(ErrorCode.DUPLICATE_RESOURCE, 409, "الخطوة مسجلة مسبقاً", { requestId });
    }

    const entry = await prisma.orderTimeline.create({
      data: {
        orderId: id,
        step,
        title,
        description: description || null,
        completedAt: new Date(),
        completedBy: identity.userId,
      },
    });

    return ok(entry, { status: 201, requestId });
  }
);
