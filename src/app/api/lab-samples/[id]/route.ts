import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — validated against the documented vocabulary so a
// bogus status cannot corrupt the row. See prisma/schema.prisma (LabSample).
const SAMPLE_STATUSES: readonly string[] = [
  "received",
  "in_lab",
  "testing",
  "ready",
  "sent_to_doctor",
  "sent_to_patient",
];

// GET /api/lab-samples/[id]
export const GET = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (_req, { params }) => {
  const { id } = await params;

  const data = await prisma.labSample.findUnique({ where: { id } });
  if (!data) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data });
});

// PATCH /api/lab-samples/[id] — Update a sample.
// `results` is the actual lab result. The whole body used to be spread into
// update, so any column (labId, createdAt, …) was rewritable alongside it.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { status, results, nurseId, sampleType, labId } = body;

  if (status !== undefined && !SAMPLE_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  if (results !== undefined && results !== null && typeof results !== "object") {
    return NextResponse.json({ error: "النتائج غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.labSample.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  // Explicit allow-list — `undefined` leaves a column untouched in Prisma.
  const data = await prisma.labSample.update({
    where: { id },
    data: {
      status: typeof status === "string" ? status : undefined,
      results:
        results === undefined || results === null
          ? undefined
          : (results as Prisma.InputJsonValue),
      nurseId: typeof nurseId === "string" ? nurseId : undefined,
      sampleType: typeof sampleType === "string" ? sampleType : undefined,
      labId: typeof labId === "string" ? labId : undefined,
    },
  });

  return NextResponse.json({ data });
});
