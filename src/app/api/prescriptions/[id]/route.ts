import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — see prisma/schema.prisma (Prescription).
const prescriptionStatus = z.enum(["new", "preparing", "ready", "delivered", "returned"], {
  message: "حالة غير صالحة",
});

/** `medications` is the core clinical payload: a JSON array of objects. */
const medications = z
  .array(z.record(z.string(), z.unknown()), { message: "الأدوية غير صالحة" })
  .min(1, { message: "الأدوية غير صالحة" });

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
  })
  .strict();

// GET /api/prescriptions/[id]
export const GET = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.prescription.findUnique({ where: { id } });
  if (!data) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  return ok(data, { requestId });
});

// PATCH /api/prescriptions/[id] — Update a prescription.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updatePrescriptionSchema);

  const existing = await prisma.prescription.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // `undefined` leaves a column untouched in Prisma.
  const data = await prisma.prescription.update({
    where: { id },
    data: {
      medications: input.medications as Prisma.InputJsonValue | undefined,
      status: input.status,
      pharmacyId: input.pharmacyId,
      orderId: input.orderId,
      notes: input.notes,
    },
  });

  return ok(data, { requestId });
});
