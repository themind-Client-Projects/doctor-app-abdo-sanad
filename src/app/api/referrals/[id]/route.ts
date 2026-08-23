import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import {
  REFERRAL_INCLUDE,
  type ReferralStatus,
  attachmentsSchema,
  canTransition,
  complexContextFor,
  decorateReferral,
  directionFor,
  parseAttachments,
  referralStatusSchema,
} from "@/server/services/referral";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One referral — read it, and reply to it.
 *
 * The reply is the half the feature exists for: "the pharmacy confirms the
 * patient received the treatment, or the lab updates the form to say the test
 * was done and the result is such-and-such, attaching an image, a name, a
 * description and a status."
 */

const respondSchema = z
  .object({
    status: referralStatusSchema.optional(),
    /** The result, the confirmation — what came back. */
    resultSummary: z.string().trim().max(4000).optional(),
    attachments: attachmentsSchema.optional(),
  })
  .strict()
  .refine(
    (body) => body.status !== undefined || body.resultSummary !== undefined || body.attachments !== undefined,
    { message: "لا يوجد تغيير" }
  );

/** Load a referral the caller is party to, or explain why they cannot have it. */
async function loadForCaller(id: string, identity: Parameters<typeof complexContextFor>[0]) {
  const referral = await prisma.complexReferral.findUnique({
    where: { id },
    include: REFERRAL_INCLUDE,
  });
  if (!referral) return { referral: null, ctx: null, actor: null } as const;

  const ctx = await complexContextFor(identity);

  if (isPlatformRole(identity.role)) {
    return { referral, ctx, actor: "observer" as const };
  }
  if (ctx && referral.toPartnerId === ctx.partnerId) {
    return { referral, ctx, actor: "recipient" as const };
  }
  if (ctx && referral.fromPartnerId === ctx.partnerId) {
    return { referral, ctx, actor: "sender" as const };
  }
  // A member of the same complex who is neither party still gets nothing: the
  // referral carries another provider's clinical note about a patient.
  return { referral, ctx, actor: null } as const;
}

// GET /api/referrals/[id]
export const GET = withAuth<Ctx>({ roles: ROLES.STAFF }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const { referral, actor, ctx } = await loadForCaller(id, identity);
  // Same 404 for "does not exist" and "not yours", so the endpoint cannot be
  // used to probe which referral ids are real.
  if (!referral || !actor) {
    return fail(ErrorCode.NOT_FOUND, 404, "الإحالة غير موجودة", { requestId });
  }

  return ok(
    {
      ...decorateReferral(referral, ctx?.partnerId ?? null),
      attachments: parseAttachments(referral.attachments),
      direction: directionFor(actor),
    },
    { requestId }
  );
});

// PATCH /api/referrals/[id] — the recipient replies, or the sender withdraws.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, respondSchema);

  const { referral, actor, ctx } = await loadForCaller(id, identity);
  if (!referral || !actor) {
    return fail(ErrorCode.NOT_FOUND, 404, "الإحالة غير موجودة", { requestId });
  }
  // An administrator can read a referral to support it; they are not a party to
  // it, and writing a clinical result under a provider's name is not support.
  if (actor === "observer") {
    return fail(ErrorCode.FORBIDDEN, 403, "الرد على الإحالة يخصّ طرفيها", { requestId });
  }

  const current = referral.status as ReferralStatus;

  // "صالحة لمدة 30 يوماً" is on the printed form, so it has to mean something.
  // A pharmacy dispensing against a two-month-old prescription is the case this
  // stops. Withdrawing an expired one stays allowed — closing it is housekeeping.
  const expired = referral.expiresAt !== null && referral.expiresAt.getTime() < Date.now();
  if (expired && input.status !== "cancelled") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "انتهت صلاحية هذا النموذج — اطلب إصداراً جديداً من المُحيل",
      { requestId }
    );
  }

  // Only the recipient produces a result — the sender withdrawing must not be
  // able to write what came back.
  if ((input.resultSummary !== undefined || input.attachments !== undefined) && actor !== "recipient") {
    return fail(ErrorCode.FORBIDDEN, 403, "النتيجة تُكتب من الجهة المستلمة فقط", { requestId });
  }

  const next = input.status;
  if (next !== undefined && next !== current && !canTransition(current, next, actor)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      current === "completed" || current === "cancelled"
        ? "الإحالة مغلقة ولا يمكن تعديلها"
        : "لا يمكن نقل الإحالة إلى هذه الحالة",
      { requestId }
    );
  }

  // A referral is only "completed" when it says what happened. Closing it empty
  // would leave the doctor with a green tick and no result — the exact thing
  // this feature exists to deliver.
  const resultAfter = input.resultSummary ?? referral.resultSummary;
  if (next === "completed" && !resultAfter?.trim()) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, "أضف نتيجة أو وصفاً قبل إنهاء الإحالة", {
      requestId,
    });
  }

  const data: Prisma.ComplexReferralUpdateInput = {};
  if (next !== undefined) data.status = next;
  if (input.resultSummary !== undefined) data.resultSummary = input.resultSummary;
  if (input.attachments !== undefined) data.attachments = input.attachments;
  // Stamped whenever the recipient says something, so the sender can tell a
  // reply from a referral that has merely been opened.
  if (actor === "recipient" && (input.resultSummary !== undefined || input.attachments !== undefined)) {
    data.respondedAt = new Date();
    data.respondedById = identity.userId;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // The event is written BEFORE the update, because the update is what reads
    // `events` back for the response. Writing it after left the timeline in
    // every reply one step behind the database it came from — the row said
    // "completed" while its own track stopped at "received".
    if (next !== undefined && next !== current) {
      await tx.referralEvent.create({
        data: {
          referralId: id,
          status: next,
          byUserId: identity.userId,
          note: input.resultSummary?.slice(0, 500) ?? null,
        },
      });
    }

    const row = await tx.complexReferral.update({
      where: { id },
      data,
      include: REFERRAL_INCLUDE,
    });

    // Tell the other side. The recipient learns of a withdrawal; the sender
    // learns their patient was seen — without either having to poll a list.
    const otherPartnerId = actor === "recipient" ? row.fromPartnerId : row.toPartnerId;
    const other = await tx.partner.findUnique({
      where: { id: otherPartnerId },
      select: { userId: true },
    });

    const changed = next !== undefined && next !== current;
    const replied = actor === "recipient" && input.resultSummary !== undefined;

    if (other?.userId && (changed || replied)) {
      const actorName = actor === "recipient" ? row.toPartner.name : row.fromPartner.name;
      await tx.notification.create({
        data: {
          userId: other.userId,
          title: next === "cancelled" ? "سُحبت إحالة" : "تحديث على إحالة",
          body: `${actorName} — ${row.patientName}: ${STATUS_LABEL[(next ?? current) as ReferralStatus]}`,
          type: "referral_update",
        },
      });
    }

    return row;
  });

  return ok(
    {
      ...decorateReferral(updated, ctx?.partnerId ?? null),
      attachments: parseAttachments(updated.attachments),
      direction: directionFor(actor),
    },
    { requestId }
  );
});

/** Arabic labels for the notification body. The UI has its own copy for badges. */
const STATUS_LABEL: Record<ReferralStatus, string> = {
  sent: "مُرسلة",
  received: "تم الاستلام",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { respondSchema as respondReferralSchema };
