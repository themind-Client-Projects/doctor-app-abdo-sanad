import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// RadiologyRequest.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (RadiologyRequest).
const RADIOLOGY_STATUSES: readonly string[] = [
  "scheduled",
  "imaged",
  "report_ready",
  "images_attached",
  "sent_to_doctor",
];

/** `images` is a JSON array of storage URLs. */
function isImageList(value: unknown): boolean {
  return Array.isArray(value) && value.every((u) => typeof u === "string");
}

// GET /api/radiology-requests — List requests.
// Previously had zero filters and a hard take: 50, so a centre could not query
// its own work. NOTE: RadiologyRequest has no patientId column (it links to a
// patient through `order`), so the filters are status / centerId / orderId.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const centerId = sp.get("centerId");
  const orderId = sp.get("orderId");

  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "20") || 20));

  const where: Prisma.RadiologyRequestWhereInput = {};
  if (status) {
    if (!RADIOLOGY_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    where.status = status;
  }
  if (centerId) where.centerId = centerId;
  if (orderId) where.orderId = orderId;

  const [data, total] = await Promise.all([
    prisma.radiologyRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.radiologyRequest.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/radiology-requests — Create a request.
// The body used to be spread into create, so a caller could plant a `report`
// or `images` on a brand-new request.
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { centerId, requestType, equipmentType, appointmentDate, orderId, status, report, images } =
    body;

  if (typeof centerId !== "string" || !centerId.trim()) {
    return NextResponse.json({ error: "المركز مطلوب" }, { status: 400 });
  }
  if (typeof requestType !== "string" || !requestType.trim()) {
    return NextResponse.json({ error: "نوع الطلب مطلوب" }, { status: 400 });
  }
  if (status !== undefined && !RADIOLOGY_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  if (images !== undefined && !isImageList(images)) {
    return NextResponse.json({ error: "الصور غير صالحة" }, { status: 400 });
  }

  let parsedDate: Date | null = null;
  if (appointmentDate !== undefined && appointmentDate !== null) {
    if (typeof appointmentDate !== "string" && typeof appointmentDate !== "number") {
      return NextResponse.json({ error: "تاريخ الموعد غير صالح" }, { status: 400 });
    }
    parsedDate = new Date(appointmentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "تاريخ الموعد غير صالح" }, { status: 400 });
    }
  }

  const data = await prisma.radiologyRequest.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      centerId,
      requestType,
      equipmentType: typeof equipmentType === "string" ? equipmentType : null,
      appointmentDate: parsedDate,
      orderId: typeof orderId === "string" ? orderId : null,
      status: typeof status === "string" ? status : "scheduled",
      report: typeof report === "string" ? report : null,
      images: (images === undefined ? [] : images) as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
