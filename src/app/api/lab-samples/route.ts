import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// LabSample.status is a free-text `String` column, so without validation a
// caller could write {"status":"banana"} and drop a sample out of every
// worklist. Vocabulary from prisma/schema.prisma (LabSample).
const SAMPLE_STATUSES: readonly string[] = [
  "received",
  "in_lab",
  "testing",
  "ready",
  "sent_to_doctor",
  "sent_to_patient",
];

// GET /api/lab-samples — List samples, optionally filtered.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const labId = sp.get("labId");
  const orderId = sp.get("orderId");

  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

  const where: Prisma.LabSampleWhereInput = {};
  if (status) {
    if (!SAMPLE_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    where.status = status;
  }
  if (labId) where.labId = labId;
  if (orderId) where.orderId = orderId;

  const [data, total] = await Promise.all([
    prisma.labSample.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.labSample.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/lab-samples — Create a sample.
// The raw body used to be spread into prisma.labSample.create, so an anonymous
// caller could attach fabricated `results` to a sample at creation time.
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { labId, sampleType, nurseId, orderId, status, results } = body;

  if (typeof labId !== "string" || !labId.trim()) {
    return NextResponse.json({ error: "المختبر مطلوب" }, { status: 400 });
  }
  if (typeof sampleType !== "string" || !sampleType.trim()) {
    return NextResponse.json({ error: "نوع العينة مطلوب" }, { status: 400 });
  }
  if (status !== undefined && !SAMPLE_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  if (results !== undefined && results !== null && typeof results !== "object") {
    return NextResponse.json({ error: "النتائج غير صالحة" }, { status: 400 });
  }

  const data = await prisma.labSample.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      labId,
      sampleType,
      nurseId: typeof nurseId === "string" ? nurseId : null,
      orderId: typeof orderId === "string" ? orderId : null,
      status: typeof status === "string" ? status : "received",
      results:
        results === undefined || results === null
          ? undefined
          : (results as Prisma.InputJsonValue),
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
