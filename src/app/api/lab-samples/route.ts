import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, isPlatformRole, partnerScope, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import {
  jsonValue,
  nonEmpty,
  paginationSchema,
  parseBody,
  parseQuery,
} from "@/lib/validation";

// LabSample.status is a free-text `String` column, so without validation a
// caller could write {"status":"banana"} and drop a sample out of every
// worklist. Vocabulary from prisma/schema.prisma (LabSample).
const sampleStatus = z.enum(
  ["received", "in_lab", "testing", "ready", "sent_to_doctor", "sent_to_patient"],
  { message: "حالة غير صالحة" }
);

/** `results` is a Json column: an object of test results. */
const results = z.record(z.string(), jsonValue);

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, sampleStatus.optional()),
  labId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  orderId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the raw body used to be spread into prisma.labSample.create.
const createLabSampleSchema = z
  .object({
    labId: z.string({ message: "المختبر مطلوب" }).trim().min(1, { message: "المختبر مطلوب" }),
    sampleType: z
      .string({ message: "نوع العينة مطلوب" })
      .trim()
      .min(1, { message: "نوع العينة مطلوب" }),
    nurseId: nonEmpty.optional(),
    orderId: nonEmpty.optional(),
    status: sampleStatus.default("received"),
    results: results.nullish(),
  })
  .strict();

// GET /api/lab-samples — List samples, optionally filtered.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, status, labId, orderId, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.LabSampleWhereInput = {};
  if (status) where.status = status;
  if (labId) where.labId = labId;
  if (orderId) where.orderId = orderId;

  // Tenant scope, applied LAST so it overrides the client-supplied `?labId=`.
  // `labId` was only ever an optional filter, so any clinical account could
  // page through every lab's samples by omitting it. A platform role still gets
  // `{}` and may filter by any lab; a partner-scoped role is pinned to its own
  // and can only narrow within it. Fails closed — no Partner row matches
  // nothing rather than everything.
  Object.assign(where, partnerScope(identity, "labId"));

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new samples are received between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.labSample.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items, pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [data, total] = await Promise.all([
    prisma.labSample.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.labSample.count({ where }),
  ]);

  return okList(
    data,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/lab-samples — Create a sample.
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createLabSampleSchema);

  // The owning lab comes from the session, not the body — otherwise any
  // clinical account could inject a sample into another lab's worklist.
  // Only a platform role may create on behalf of an arbitrary lab.
  let labId = input.labId;
  if (!isPlatformRole(identity.role)) {
    if (!identity.partnerId) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
    }
    labId = identity.partnerId;
  }

  const data = await prisma.labSample.create({
    data: {
      labId,
      sampleType: input.sampleType,
      nurseId: input.nurseId ?? null,
      orderId: input.orderId ?? null,
      status: input.status,
      results: (input.results ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return ok(data, { status: 201, requestId });
});
