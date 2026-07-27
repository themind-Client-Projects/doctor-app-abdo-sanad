import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPartnerScope, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// LAB / PHARMACY / NURSE were in ROLES.CLINICAL and so could read any study —
// and PATCH its `report` and `images`.
const RADIOLOGY_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "RADIOLOGY",
] as const satisfies readonly UserRole[];

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
export const GET = withAuth<Ctx>({ roles: RADIOLOGY_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.radiologyRequest.findUnique({ where: { id } });
  if (!data) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // Load first, then check ownership: a partner-scoped role may only read its
  // own centre's studies. A missing row still 404s, so the status code cannot
  // be used to probe for ids outside the caller's tenant.
  if (!isPlatformRole(identity.role)) {
    assertPartnerScope(identity, data.centerId);
  }

  return ok(data, { requestId });
});

// PATCH /api/radiology-requests/[id] — Update a request.
export const PATCH = withAuth<Ctx>({ roles: RADIOLOGY_ROLES }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateRadiologyRequestSchema);

  const existing = await prisma.radiologyRequest.findUnique({
    where: { id },
    select: { id: true, centerId: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // Load first, then check ownership. `report` is the radiologist's finding and
  // `images` are the study URLs — a non-owning centre writing either is a
  // patient-safety issue, so it is rejected outright rather than filtered.
  if (!isPlatformRole(identity.role)) {
    assertPartnerScope(identity, existing.centerId);
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

  return ok(data, { requestId });
});
