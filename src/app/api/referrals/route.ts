import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, parseBody, parseQuery, serviceTypeSchema } from "@/lib/validation";
import { PARTNER_TYPE_LABELS } from "@/lib/labels";
import {
  KIND_RECIPIENTS,
  KIND_SERVICE,
  REFERRAL_INCLUDE,
  REFERRAL_KIND_LABELS,
  clinicalSchemaFor,
  complexContextFor,
  decorateReferral,
  isEligibleRecipient,
  referralExpiry,
  referralKindSchema,
  referralScopeFor,
  referralStatusSchema,
  resolveReferablePatient,
} from "@/server/services/referral";

/**
 * الإحالات — referrals between members of the same medical complex.
 *
 * Every rule lives in `@/server/services/referral`; this file is transport. The
 * three that matter: the complex comes from the session, the recipient must be
 * in that complex, and the patient must be one the sender has actually treated.
 */

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  /**
   * Which side of the exchange: what I sent, what reached me, or both.
   *
   * `.catch("all")` silently swallowed a typo and returned everything, which
   * contradicts the rule every other filter follows — an invalid value is a 400
   * so a mistake in a client build fails loudly instead of quietly showing the
   * user the wrong list. Absent still means "all"; only a WRONG value is refused.
   */
  box: z.enum(["inbox", "outbox", "all"], { message: "قيمة box غير صالحة" }).default("all"),
  status: z.preprocess(emptyToUndefined, referralStatusSchema.optional()),
  patientId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createSchema = z
  .object({
    /** Which of the client's four documents this is. */
    kind: referralKindSchema.default("DOCTOR"),
    toPartnerId: nonEmpty,
    patientId: nonEmpty,
    title: nonEmpty.max(160),
    description: z.string().trim().max(4000).optional(),
    serviceType: serviceTypeSchema.optional(),
    /** عادي / مهم / عاجل — printed on all four forms. */
    priority: z.enum(["NORMAL", "URGENT", "CRITICAL"]).default("NORMAL"),
    /**
     * The half that differs per document — radiology safety answers, the
     * medication table, the clinical summary. Validated against `kind` below
     * rather than here, because Zod cannot pick a shape from a sibling field
     * and still report which field failed.
     */
    clinical: z.unknown().optional(),
    /** The order this referral came out of — the consultation being acted on. */
    orderId: nonEmpty.optional(),
  })
  .strict();

// GET /api/referrals
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { box, status, patientId, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const ctx = await complexContextFor(identity);

  const filters: Prisma.ComplexReferralWhereInput = {};
  if (status) filters.status = status;
  if (patientId) filters.patientId = patientId;

  // Direction narrows WITHIN the caller's own slice; it can never widen it.
  // `referralScopeFor` is ANDed on top and fails closed, so `?box=inbox` from a
  // partner in no complex still matches nothing rather than everything.
  if (ctx && box !== "all") {
    filters[box === "inbox" ? "toPartnerId" : "fromPartnerId"] = ctx.partnerId;
  }

  const where: Prisma.ComplexReferralWhereInput = {
    AND: [filters, referralScopeFor(identity, ctx)],
  };

  const take = limit ?? 20;
  const keyset = keysetArgs(cursor, take);
  const cursorWhere = "where" in keyset ? keyset.where : undefined;

  const rows = await prisma.complexReferral.findMany({
    ...keyset,
    include: REFERRAL_INCLUDE,
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
  });

  const { items, page } = toPage(rows, take);

  // The viewer's own side, computed server-side. The UI needs it on every row
  // to decide between "respond" and "withdraw", and deriving it in the browser
  // from partner ids means shipping the caller's partnerId to do it.
  const data = items.map((row) => ({
    ...decorateReferral(row),
    direction: isPlatformRole(identity.role)
      ? ("observed" as const)
      : row.toPartnerId === ctx?.partnerId
        ? ("incoming" as const)
        : ("outgoing" as const),
  }));

  return okList(data, page, { requestId });
});

// POST /api/referrals — send a patient's case to another member of my complex.
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  // Never from the body: a referral is always FROM the caller, within the
  // caller's own complex.
  const ctx = await complexContextFor(identity);
  if (!ctx) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "الإحالة متاحة لأعضاء المجمّعات فقط — حسابك غير مرتبط بمجمّع",
      { requestId }
    );
  }

  if (!(await isEligibleRecipient(ctx, input.toPartnerId))) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `الجهة المستلمة ليست ضمن «${ctx.complexName}»`,
      { requestId }
    );
  }

  // A prescription goes to a pharmacy, an imaging request to a radiology
  // centre. Without this the form would happily send a drug list to a lab,
  // which would accept it and have nothing to do with it.
  const recipient = await prisma.partner.findUnique({
    where: { id: input.toPartnerId },
    select: { type: true, name: true },
  });
  const allowedTypes = KIND_RECIPIENTS[input.kind];
  if (!recipient || !allowedTypes.includes(recipient.type)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `«${REFERRAL_KIND_LABELS[input.kind]}» تُرسل إلى ${allowedTypes
        .map((t) => PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t)
        .join(" أو ")} فقط`,
      { requestId }
    );
  }

  // The document's own required fields — the radiology safety answers, the dose
  // and duration on every drug. A generic `description` let a form through with
  // none of it.
  const clinical = clinicalSchemaFor(input.kind).safeParse(input.clinical ?? {});
  if (!clinical.success) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, "بيانات النموذج غير مكتملة", {
      requestId,
      details: clinical.error.issues.map((issue) => ({
        field: `clinical.${issue.path.join(".") || "(root)"}`,
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  const patient = await resolveReferablePatient(identity, input.patientId, ctx);
  if (!patient) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "لا يمكن إحالة مريض ليس لديك معه حجز أو موعد أو إحالة",
      { requestId }
    );
  }

  // An order may only be attached if it is one of the caller's own.
  if (input.orderId) {
    const own = await prisma.order.findFirst({
      where: { id: input.orderId, patientId: patient.id, deletedAt: null },
      select: { id: true },
    });
    if (!own) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }
  }

  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.complexReferral.create({
      data: {
        complexId: ctx.complexId,
        fromPartnerId: ctx.partnerId,
        toPartnerId: input.toPartnerId,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        kind: input.kind,
        priority: input.priority,
        clinical: clinical.data as Prisma.InputJsonValue,
        // "صالحة لمدة 30 يوماً" — after this the recipient should refuse it.
        expiresAt: referralExpiry(),
        serviceType: input.serviceType ?? (KIND_SERVICE[input.kind] as never) ?? null,
        title: input.title,
        description: input.description ?? null,
        orderId: input.orderId ?? null,
        status: "sent",
        // The first stage of the printed track. Every later move appends here,
        // so the timeline is a record rather than a guess from the status.
        events: { create: { status: "sent", byUserId: identity.userId } },
      },
      include: REFERRAL_INCLUDE,
    });

    // "تظهر لهم أنه تم إرسال مريض فلان" — the recipient has to LEARN about it,
    // not discover it by refreshing a list.
    const recipient = await tx.partner.findUnique({
      where: { id: input.toPartnerId },
      select: { userId: true },
    });
    if (recipient?.userId) {
      await tx.notification.create({
        data: {
          userId: recipient.userId,
          title: "إحالة مريض جديدة",
          body: `${created.fromPartner.name} أحال المريض ${patient.name} — ${input.title}`,
          type: "referral_new",
        },
      });
    }

    return created;
  });

  // A create is always outgoing for its author. Omitting it made the create
  // response the one referral payload with no `direction`, so a client could
  // not reuse its list model to render what it had just sent.
  return ok(
    { ...decorateReferral(referral), direction: "outgoing" as const },
    { status: 201, requestId }
  );
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { createSchema as createReferralSchema };
