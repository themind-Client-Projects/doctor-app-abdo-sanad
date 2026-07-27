import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, isPlatformRole, partnerScope, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

// A radiology study concerns the referring doctor, the imaging centre and the
// platform. LAB / PHARMACY / NURSE were in ROLES.CLINICAL and so could read —
// and rewrite the report on — every centre's studies.
const RADIOLOGY_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "RADIOLOGY",
] as const satisfies readonly UserRole[];

// RadiologyRequest.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (RadiologyRequest).
const radiologyStatus = z.enum(
  ["scheduled", "imaged", "report_ready", "images_attached", "sent_to_doctor"],
  { message: "حالة غير صالحة" }
);

/** `images` is a JSON array of storage URLs. */
const images = z.array(z.string(), { message: "الصور غير صالحة" });

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const appointmentDate = z
  .union([z.string(), z.number()], { message: "تاريخ الموعد غير صالح" })
  .pipe(z.coerce.date({ message: "تاريخ الموعد غير صالح" }));

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

// NOTE: RadiologyRequest has no patientId column (it links to a patient through
// `order`), so the filters are status / centerId / orderId.
//
// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, radiologyStatus.optional()),
  centerId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  orderId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread into create, so a caller could plant a `report` or
// `images` on a brand-new request.
const createRadiologyRequestSchema = z
  .object({
    centerId: z.string({ message: "المركز مطلوب" }).trim().min(1, { message: "المركز مطلوب" }),
    requestType: z
      .string({ message: "نوع الطلب مطلوب" })
      .trim()
      .min(1, { message: "نوع الطلب مطلوب" }),
    equipmentType: z.string().optional(),
    // `null` means "no appointment yet", as it did before.
    appointmentDate: z
      .union([z.null(), appointmentDate], { message: "تاريخ الموعد غير صالح" })
      .optional(),
    orderId: nonEmpty.optional(),
    status: radiologyStatus.default("scheduled"),
    report: z.string().optional(),
    images: images.optional(),
  })
  .strict();

// GET /api/radiology-requests — List requests.
// Previously had zero filters and a hard take: 50, so a centre could not query
// its own work.
export const GET = withAuth({ roles: RADIOLOGY_ROLES }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, status, centerId, orderId, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.RadiologyRequestWhereInput = {};
  if (status) where.status = status;
  if (centerId) where.centerId = centerId;
  if (orderId) where.orderId = orderId;

  // Tenant scope, applied LAST so it overrides the client-supplied `?centerId=`
  // — that filter may only narrow within the caller's own centre. A platform
  // role gets `{}` and may still filter by any centre.
  //
  // NOTE: RadiologyRequest has no doctor column (it reaches a patient through
  // `order`), so a DOCTOR is scoped to `centerId` too and therefore matches
  // nothing here. That is deliberate: fail closed rather than expose every
  // centre's studies. A referring-doctor view needs an order-based scope.
  Object.assign(where, partnerScope(identity, "centerId"));

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new requests arrive between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.radiologyRequest.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items, pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [data, total] = await Promise.all([
    prisma.radiologyRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.radiologyRequest.count({ where }),
  ]);

  return okList(
    data,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/radiology-requests — Create a request.
export const POST = withAuth({ roles: RADIOLOGY_ROLES }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createRadiologyRequestSchema);

  // The owning centre comes from the session, not the body — otherwise a
  // partner-scoped account could plant a request (with a `report` and
  // `images` on it) in another centre's queue. Platform roles may still
  // create on behalf of any centre.
  let centerId = input.centerId;
  if (!isPlatformRole(identity.role)) {
    if (!identity.partnerId) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
    }
    centerId = identity.partnerId;
  }

  const data = await prisma.radiologyRequest.create({
    data: {
      centerId,
      requestType: input.requestType,
      equipmentType: input.equipmentType ?? null,
      appointmentDate: input.appointmentDate ?? null,
      orderId: input.orderId ?? null,
      status: input.status,
      report: input.report ?? null,
      images: input.images ?? [],
    },
  });

  return ok(data, { status: 201, requestId });
});
