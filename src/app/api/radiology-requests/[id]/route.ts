import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — see prisma/schema.prisma (RadiologyRequest).
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

// GET /api/radiology-requests/[id]
export const GET = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (_req, { params }) => {
  const { id } = await params;

  const data = await prisma.radiologyRequest.findUnique({ where: { id } });
  if (!data) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data });
});

// PATCH /api/radiology-requests/[id] — Update a request.
// `report` is the radiologist's finding and `images` are the study URLs; the
// body used to be spread into update, so either could be rewritten by anyone.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { status, report, images, equipmentType, appointmentDate, requestType } = body;

  if (status !== undefined && !RADIOLOGY_STATUSES.includes(status as string)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  if (images !== undefined && !isImageList(images)) {
    return NextResponse.json({ error: "الصور غير صالحة" }, { status: 400 });
  }

  let parsedDate: Date | undefined;
  if (appointmentDate !== undefined) {
    if (typeof appointmentDate !== "string" && typeof appointmentDate !== "number") {
      return NextResponse.json({ error: "تاريخ الموعد غير صالح" }, { status: 400 });
    }
    parsedDate = new Date(appointmentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "تاريخ الموعد غير صالح" }, { status: 400 });
    }
  }

  const existing = await prisma.radiologyRequest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  // Explicit allow-list — `undefined` leaves a column untouched in Prisma.
  const data = await prisma.radiologyRequest.update({
    where: { id },
    data: {
      status: typeof status === "string" ? status : undefined,
      report: typeof report === "string" ? report : undefined,
      images: images === undefined ? undefined : (images as Prisma.InputJsonValue),
      equipmentType: typeof equipmentType === "string" ? equipmentType : undefined,
      appointmentDate: parsedDate,
      requestType: typeof requestType === "string" ? requestType : undefined,
    },
  });

  return NextResponse.json({ data });
});
