import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePatientForCaller } from "@/server/services/patient-access";
import { withPatients } from "@/server/services/patient-contacts";
import { AuthError, isPlatformRole, partnerScope, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";
import { medicationSchema, prescriptionExpiry } from "@/server/services/referral-forms";

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

/**
 * `medications` is the core clinical payload — and it is now a table, not a bag.
 *
 * This was `z.array(z.record(z.string(), z.unknown()))`: ANY array of objects.
 * A prescription with no dose and no duration was accepted, stored, and handed
 * to a pharmacy that then had to telephone the doctor to learn what to dispense.
 * The client's printed form has a column for each of these, so each is required.
 */
const medications = z
  .array(medicationSchema, { message: "الأدوية غير صالحة" })
  .min(1, { message: "أضف دواءً واحداً على الأقل" })
  .max(30);

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

  // The worklist has to say WHO the prescription is for. The order carries the
  // contact details as given at booking — but `orderId` is OPTIONAL, and every
  // prescription a doctor writes in clinic has none. Those rows rendered
  // "بلا طلب مرتبط" and no patient at all, so `withPatients` below fills the
  // name in from the account for exactly those.
  const include = {
    order: {
      select: { id: true, orderNumber: true, patientName: true, patientPhone: true },
    },
  } as const;

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new prescriptions are written between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.prescription.findMany({
      ...keyset,
      include,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(await withPatients(items), pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [data, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.prescription.count({ where }),
  ]);

  return okList(
    await withPatients(data),
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/prescriptions — Create a prescription.
export const POST = withAuth({ roles: PRESCRIPTION_ROLES }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createPrescriptionSchema);

  // A PHARMACY must not write prescriptions.
  //
  // It was in this route's role list with the body's `doctorId` trusted, so a
  // pharmacy could mint a prescription under any doctor's name, for any
  // patient, routed to itself — and then "dispense" it. Prescribing is the
  // doctor's act; the pharmacy's half of this record is the dispensing fields
  // on PATCH.
  if (identity.role === "PHARMACY") {
    throw new AuthError(403, "الوصفة يكتبها الطبيب — الصيدلية تسجّل الصرف فقط");
  }

  // A doctor prescribes as themselves — the body's `doctorId` is not trusted,
  // otherwise a prescription could be written under another doctor's name.
  //
  // `doctorProfileId`, NOT `partnerId`: `Prescription.doctorId` is a foreign
  // key to `DoctorProfile.id`, and a Partner id there failed the constraint on
  // every insert. A doctor could not write a single prescription — the request
  // came back 409 "مرجع غير صالح" every time.
  let doctorId = input.doctorId;
  if (identity.role === "DOCTOR") {
    if (!identity.doctorProfileId) {
      throw new AuthError(403, "لا يوجد ملف طبيب مرتبط بحسابك");
    }
    doctorId = identity.doctorProfileId;

    // Prescribing for someone you are not treating would make this an oracle
    // over the patient table, and a prescription nobody asked for.
    const patient = await resolvePatientForCaller(identity, input.patientId);
    if (!patient) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        "لا يمكن وصف دواء لمريض ليس لديك معه حجز أو موعد أو إحالة",
        { requestId }
      );
    }
  } else {
    // Operations writing one on a doctor's behalf: the id must name a real
    // doctor, or the insert fails the same foreign key with a 409 the caller
    // cannot act on.
    const exists = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!exists) {
      return fail(ErrorCode.INVALID_REFERENCE, 422, "الطبيب غير موجود", { requestId });
    }
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
      // "صالحة لمدة 30 يوماً من تاريخ الإصدار" — printed on the form, and
      // enforced when a pharmacy tries to mark it dispensed.
      expiresAt: prescriptionExpiry(),
    },
  });

  return ok(data, { status: 201, requestId });
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published OpenAPI schema for this endpoint is derived from THIS object via
 * `z.toJSONSchema`, so the contract handed to the mobile team and the validation
 * the server actually runs cannot drift apart.
 */
export { createPrescriptionSchema };
