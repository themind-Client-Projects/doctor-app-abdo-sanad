import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, type Identity, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";
import { medicationSchema } from "@/server/services/referral-forms";

type Ctx = { params: Promise<{ id: string }> };

// Only the two partners a prescription concerns, plus the platform. LAB /
// NURSE / RADIOLOGY were in ROLES.CLINICAL and could read and rewrite any
// prescription in the system.
const PRESCRIPTION_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "PHARMACY",
] as const satisfies readonly UserRole[];

/**
 * Allow only the prescribing doctor, the assigned pharmacy, or the platform.
 *
 * Called after the row is loaded — the tenant columns live on the row, so
 * ownership cannot be decided from the request alone. Fails closed: a
 * partner-scoped caller with no Partner row matches nobody.
 */
function assertPrescriptionAccess(
  identity: Identity,
  row: { doctorId: string; pharmacyId: string | null }
): void {
  if (isPlatformRole(identity.role)) return;

  const partnerId = identity.partnerId;
  if (partnerId) {
    if (identity.role === "DOCTOR" && row.doctorId === partnerId) return;
    if (identity.role === "PHARMACY" && row.pharmacyId === partnerId) return;
  }

  throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
}

// Free-text `String` column — see prisma/schema.prisma (Prescription).
const prescriptionStatus = z.enum(["new", "preparing", "ready", "delivered", "returned"], {
  message: "حالة غير صالحة",
});

/**
 * The same table the create route enforces — not a looser copy.
 *
 * This was `z.array(z.record(z.string(), z.unknown()))`: any object at all. The
 * create route was tightened and this one was missed, which left the hole open
 * on the path that matters MORE — a prescription can be edited after a pharmacy
 * has seen it, so a dose could be removed from a live one.
 */
const medications = z
  .array(medicationSchema, { message: "الأدوية غير صالحة" })
  .min(1, { message: "أضف دواءً واحداً على الأقل" })
  .max(30);

// The body was spread into update, so anyone could rewrite `medications` — a
// forged dosage on a dispensed prescription is a patient-safety issue, not just
// a data one. doctorId / patientId are deliberately absent, and `.strict()`
// makes an unknown key a 400.
const updatePrescriptionSchema = z
  .object({
    medications: medications.optional(),
    status: prescriptionStatus.optional(),
    pharmacyId: nonEmpty.optional(),
    orderId: nonEmpty.optional(),
    notes: z.string().optional(),
    /**
     * اسم الصيدلي — "تم صرف الأدوية" on the form is a box somebody signs.
     * `dispensedAt` is stamped server-side from the status, never sent: a
     * client-supplied dispensing time could disagree with the record it dates.
     */
    pharmacistName: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

// GET /api/prescriptions/[id]
export const GET = withAuth<Ctx>({ roles: PRESCRIPTION_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.prescription.findUnique({ where: { id } });
  if (!data) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  assertPrescriptionAccess(identity, data);

  return ok(data, { requestId });
});

// PATCH /api/prescriptions/[id] — Update a prescription.
export const PATCH = withAuth<Ctx>({ roles: PRESCRIPTION_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updatePrescriptionSchema);

  const existing = await prisma.prescription.findUnique({
    where: { id },
    select: { id: true, doctorId: true, pharmacyId: true, status: true, expiresAt: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // Load first, then check ownership — a forged dosage on somebody else's
  // prescription is a patient-safety issue, not just a data one.
  assertPrescriptionAccess(identity, existing);

  // Routing a prescription to a pharmacy belongs to the prescribing doctor or
  // the platform. A pharmacy must not be able to reassign the work it holds.
  const mayRoute = isPlatformRole(identity.role) || identity.role === "DOCTOR";

  // "صالحة لمدة 30 يوماً" is printed on the paper, so dispensing against an
  // expired one has to be refused rather than merely discouraged.
  const expired = existing.expiresAt !== null && existing.expiresAt.getTime() < Date.now();
  if (expired && input.status === "delivered") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "انتهت صلاحية الوصفة — يلزم إصدار وصفة جديدة",
      { requestId }
    );
  }

  // Naming the pharmacist is the pharmacy's act, not the doctor's.
  if (input.pharmacistName !== undefined && identity.role === "DOCTOR") {
    return fail(ErrorCode.FORBIDDEN, 403, "اسم الصيدلي يُسجّل من الصيدلية", { requestId });
  }

  // Stamped here, from the status — the moment the record says it was handed
  // over is the moment it changed, not a time the client chose.
  const dispensing = input.status === "delivered" && existing.status !== "delivered";

  // `undefined` leaves a column untouched in Prisma.
  const data = await prisma.prescription.update({
    where: { id },
    data: {
      medications: input.medications as Prisma.InputJsonValue | undefined,
      status: input.status,
      pharmacyId: mayRoute ? input.pharmacyId : undefined,
      orderId: input.orderId,
      notes: input.notes,
      pharmacistName: input.pharmacistName,
      ...(dispensing ? { dispensedAt: new Date(), dispensedById: identity.userId } : {}),
    },
  });

  return ok(data, { requestId });
});
