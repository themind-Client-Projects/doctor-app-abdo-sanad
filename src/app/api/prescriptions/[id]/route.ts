import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — see prisma/schema.prisma (Prescription).
const PRESCRIPTION_STATUSES: readonly string[] = [
  "new",
  "preparing",
  "ready",
  "delivered",
  "returned",
];

/** `medications` is the core clinical payload: a JSON array of objects. */
function isMedicationList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((m) => typeof m === "object" && m !== null && !Array.isArray(m))
  );
}

// GET /api/prescriptions/[id]
export const GET = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (_req, { params }) => {
  const { id } = await params;

  const data = await prisma.prescription.findUnique({ where: { id } });
  if (!data) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data });
});

// PATCH /api/prescriptions/[id] — Update a prescription.
// The body was spread into update, so anyone could rewrite `medications` — a
// forged dosage on a dispensed prescription is a patient-safety issue, not just
// a data one. Every writable field is now allow-listed and type-checked.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { medications, status, pharmacyId, orderId, notes } = body;

  if (medications !== undefined && !isMedicationList(medications)) {
    return NextResponse.json({ error: "الأدوية غير صالحة" }, { status: 400 });
  }
  if (status !== undefined && !PRESCRIPTION_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.prescription.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  // Explicit allow-list — `undefined` leaves a column untouched in Prisma.
  // doctorId / patientId are deliberately not writable here.
  const data = await prisma.prescription.update({
    where: { id },
    data: {
      medications:
        medications === undefined ? undefined : (medications as Prisma.InputJsonValue),
      status: typeof status === "string" ? status : undefined,
      pharmacyId: typeof pharmacyId === "string" ? pharmacyId : undefined,
      orderId: typeof orderId === "string" ? orderId : undefined,
      notes: typeof notes === "string" ? notes : undefined,
    },
  });

  return NextResponse.json({ data });
});
