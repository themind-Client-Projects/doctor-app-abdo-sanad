import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, isPlatformRole, partnerScope, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

// A prescription concerns exactly two partners: the doctor who wrote it and the
// pharmacy dispensing it. LAB / NURSE / RADIOLOGY were in ROLES.CLINICAL and so
// could list every prescription on the platform — they have no business here.
const PRESCRIPTION_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "PHARMACY",
] as const satisfies readonly UserRole[];

// Prescription.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (Prescription).
const prescriptionStatus = z.enum(["new", "preparing", "ready", "delivered", "returned"], {
  message: "حالة غير صالحة",
});

/** `medications` is the core clinical payload: a JSON array of objects. */
const medications = z
  .array(z.record(z.string(), z.unknown()), { message: "الأدوية غير صالحة" })
  .min(1, { message: "الأدوية غير صالحة" });

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  patientId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  doctorId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  pharmacyId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  status: z.preprocess(emptyToUndefined, prescriptionStatus.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread straight into prisma.prescription.create.
const createPrescriptionSchema = z
  .object({
    doctorId: z.string({ message: "الطبيب مطلوب" }).trim().min(1, { message: "الطبيب مطلوب" }),
    patientId: z.string({ message: "المريض مطلوب" }).trim().min(1, { message: "المريض مطلوب" }),
    pharmacyId: nonEmpty.optional(),
    orderId: nonEmpty.optional(),
    medications,
    status: prescriptionStatus.default("new"),
    notes: z.string().optional(),
  })
  .strict();

// GET /api/prescriptions — List prescriptions.
// Previously took no filters at all, so a pharmacy had to page through every
// prescription in the system to find its own.
export const GET = withAuth({ roles: PRESCRIPTION_ROLES }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, patientId, doctorId, pharmacyId, status, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.PrescriptionWhereInput = {};
  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (pharmacyId) where.pharmacyId = pharmacyId;
  if (status) where.status = status;

  // Tenant scope, applied LAST so it overrides the client-supplied filters —
  // those may only narrow within the caller's own slice, never widen past it.
  // A platform role gets `{}` and still sees everything.
  if (identity.role === "PHARMACY") {
    Object.assign(where, partnerScope(identity, "pharmacyId"));
  } else if (identity.role === "DOCTOR") {
    Object.assign(where, { doctorId: identity.doctorProfileId ?? "" });
  } else if (!isPlatformRole(identity.role)) {
    // Unreachable while PRESCRIPTION_ROLES holds, but keeps the default at
    // "match nothing" if a role is ever added to the list without a scope.
    where.id = "";
  }

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new prescriptions are written between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.prescription.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items, pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [data, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.prescription.count({ where }),
  ]);

  return okList(
    data,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/prescriptions — Create a prescription.
export const POST = withAuth({ roles: PRESCRIPTION_ROLES }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createPrescriptionSchema);

  // A doctor prescribes as themselves — the body's `doctorId` is not trusted,
  // otherwise a prescription could be written under another doctor's name.
  let doctorId = input.doctorId;
  if (identity.role === "DOCTOR") {
    if (!identity.partnerId) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
    }
    doctorId = identity.partnerId;
  }

  const data = await prisma.prescription.create({
    data: {
      doctorId,
      patientId: input.patientId,
      pharmacyId: input.pharmacyId ?? null,
      orderId: input.orderId ?? null,
      medications: input.medications as Prisma.InputJsonValue,
      status: input.status,
      notes: input.notes ?? null,
    },
  });

  return ok(data, { status: 201, requestId });
});
