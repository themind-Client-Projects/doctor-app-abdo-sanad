import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — see prisma/schema.prisma (RadiologyRequest).
const radiologyStatus = z.enum(
  ["scheduled", "imaged", "report_ready", "images_attached", "sent_to_doctor"],
  { message: "حالة غير صالحة" }
);

/** `images` is a JSON array of storage URLs. */
const images = z.array(z.string(), { message: "الصور غير صالحة" });

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const appointmentDate = z
  .union([z.string(), z.number()], { message: "تاريخ الموعد غير صالح" })
  .pipe(z.coerce.date({ message: "تاريخ الموعد غير صالح" }));

// Allow-list of the editable columns: `report` is the radiologist's finding and
// `images` are the study URLs; the body used to be spread into update, so either
// could be rewritten by anyone. `.strict()` makes an unknown key a 400.
const updateRadiologyRequestSchema = z
  .object({
    status: radiologyStatus.optional(),
    report: z.string().optional(),
    images: images.optional(),
    equipmentType: z.string().optional(),
    appointmentDate: appointmentDate.optional(),
    requestType: nonEmpty.optional(),
  })
  .strict();

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
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, updateRadiologyRequestSchema);

  const existing = await prisma.radiologyRequest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  // `undefined` leaves a column untouched in Prisma.
  const data = await prisma.radiologyRequest.update({
    where: { id },
    data: {
      status: input.status,
      report: input.report,
      images: input.images,
      equipmentType: input.equipmentType,
      appointmentDate: input.appointmentDate,
      requestType: input.requestType,
    },
  });

  return NextResponse.json({ data });
});
