import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * تقييم الخدمة — a patient rates an order they received.
 *
 * The first thing that ever WRITES `PatientFeedback`. The owner's home screen,
 * the reports page, partner performance and مؤشرات الجودة all read it, and
 * `/api/feedback` was GET-only — so every one of those showed an average of
 * nothing, for as long as the platform had run.
 *
 * The rules:
 *   - the caller's OWN order, and only when it is COMPLETED — rating a lab test
 *     that has not happened yet is not feedback on anything
 *   - one rating per order: a second submission edits the first, so a
 *     double-tap on the stars cannot count twice in the average
 *
 * `/api/v1` because this is the patient app's action, for the mobile client as
 * much as the web.
 */

const feedbackSchema = z
  .object({
    rating: z.number().int().min(1, { message: "التقييم من 1 إلى 5" }).max(5, { message: "التقييم من 1 إلى 5" }),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

async function ownOrder(orderId: string, userId: string) {
  return prisma.order.findFirst({
    // Scoped in the query: an order that is not the caller's is a 404, not a
    // 403, so the endpoint cannot confirm which order ids exist.
    where: { id: orderId, patientId: userId, deletedAt: null },
    select: { id: true, status: true },
  });
}

// GET — the caller's rating for this order, or null.
export const GET = withAuth<Ctx>({}, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const order = await ownOrder(id, identity.userId);
  if (!order) return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });

  const feedback = await prisma.patientFeedback.findUnique({
    where: { orderId_patientId: { orderId: id, patientId: identity.userId } },
    select: { rating: true, comment: true, createdAt: true, updatedAt: true },
  });

  return ok(feedback, { requestId });
});

// POST — rate, or change an existing rating.
export const POST = withAuth<Ctx>({}, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, feedbackSchema);

  const order = await ownOrder(id, identity.userId);
  if (!order) return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });

  if (order.status !== "COMPLETED") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "يمكن تقييم الخدمة بعد اكتمالها",
      { requestId }
    );
  }

  const data = await prisma.patientFeedback.upsert({
    where: { orderId_patientId: { orderId: id, patientId: identity.userId } },
    create: {
      orderId: id,
      patientId: identity.userId,
      rating: input.rating,
      comment: input.comment || null,
    },
    update: {
      rating: input.rating,
      comment: input.comment || null,
    },
    select: { rating: true, comment: true, createdAt: true, updatedAt: true },
  });

  return ok(data, { status: 201, requestId });
});

/**
 * Re-exported for `scripts/generate-openapi.ts` — the published schema is
 * derived from this object, so the mobile contract cannot drift from it.
 */
export { feedbackSchema as orderFeedbackSchema };
