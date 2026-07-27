import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

// RadiologyRequest.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (RadiologyRequest).
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

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

// NOTE: RadiologyRequest has no patientId column (it links to a patient through
// `order`), so the filters are status / centerId / orderId.
const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, radiologyStatus.optional()),
  centerId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  orderId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread into create, so a caller could plant a `report` or
// `images` on a brand-new request.
const createRadiologyRequestSchema = z
  .object({
    centerId: z.string({ message: "المركز مطلوب" }).trim().min(1, { message: "المركز مطلوب" }),
    requestType: z
      .string({ message: "نوع الطلب مطلوب" })
      .trim()
      .min(1, { message: "نوع الطلب مطلوب" }),
    equipmentType: z.string().optional(),
    // `null` means "no appointment yet", as it did before.
    appointmentDate: z
      .union([z.null(), appointmentDate], { message: "تاريخ الموعد غير صالح" })
      .optional(),
    orderId: nonEmpty.optional(),
    status: radiologyStatus.default("scheduled"),
    report: z.string().optional(),
    images: images.optional(),
  })
  .strict();

// GET /api/radiology-requests — List requests.
// Previously had zero filters and a hard take: 50, so a centre could not query
// its own work.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const { page, pageSize, status, centerId, orderId } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.RadiologyRequestWhereInput = {};
  if (status) where.status = status;
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
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const input = await parseBody(req, createRadiologyRequestSchema);

  const data = await prisma.radiologyRequest.create({
    data: {
      centerId: input.centerId,
      requestType: input.requestType,
      equipmentType: input.equipmentType ?? null,
      appointmentDate: input.appointmentDate ?? null,
      orderId: input.orderId ?? null,
      status: input.status,
      report: input.report ?? null,
      images: input.images ?? [],
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
