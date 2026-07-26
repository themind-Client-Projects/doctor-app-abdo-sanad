import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// Prescription.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (Prescription).
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

// GET /api/prescriptions — List prescriptions.
// Previously took no filters at all, so a pharmacy had to page through every
// prescription in the system to find its own.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const sp = req.nextUrl.searchParams;
  const patientId = sp.get("patientId");
  const doctorId = sp.get("doctorId");
  const pharmacyId = sp.get("pharmacyId");
  const status = sp.get("status");

  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

  const where: Prisma.PrescriptionWhereInput = {};
  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (pharmacyId) where.pharmacyId = pharmacyId;
  if (status) {
    if (!PRESCRIPTION_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.prescription.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/prescriptions — Create a prescription.
// The body used to be spread straight into prisma.prescription.create, so an
// unauthenticated caller could write any column of a prescription record.
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { doctorId, patientId, pharmacyId, orderId, medications, status, notes } = body;

  if (typeof doctorId !== "string" || !doctorId.trim()) {
    return NextResponse.json({ error: "الطبيب مطلوب" }, { status: 400 });
  }
  if (typeof patientId !== "string" || !patientId.trim()) {
    return NextResponse.json({ error: "المريض مطلوب" }, { status: 400 });
  }
  if (!isMedicationList(medications)) {
    return NextResponse.json({ error: "الأدوية غير صالحة" }, { status: 400 });
  }
  if (status !== undefined && !PRESCRIPTION_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const data = await prisma.prescription.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      doctorId,
      patientId,
      pharmacyId: typeof pharmacyId === "string" ? pharmacyId : null,
      orderId: typeof orderId === "string" ? orderId : null,
      medications: medications as Prisma.InputJsonValue,
      status: typeof status === "string" ? status : "new",
      notes: typeof notes === "string" ? notes : null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
