import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

// Prescription.status is a free-text `String` column. Vocabulary from
// prisma/schema.prisma (Prescription).
const prescriptionStatus = z.enum(["new", "preparing", "ready", "delivered", "returned"], {
  message: "حالة غير صالحة",
});

/** `medications` is the core clinical payload: a JSON array of objects. */
const medications = z
  .array(z.record(z.string(), z.unknown()), { message: "الأدوية غير صالحة" })
  .min(1, { message: "الأدوية غير صالحة" });

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = paginationSchema.extend({
  patientId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  doctorId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  pharmacyId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  status: z.preprocess(emptyToUndefined, prescriptionStatus.optional()),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the body used to be spread straight into prisma.prescription.create.
const createPrescriptionSchema = z
  .object({
    doctorId: z.string({ message: "الطبيب مطلوب" }).trim().min(1, { message: "الطبيب مطلوب" }),
    patientId: z.string({ message: "المريض مطلوب" }).trim().min(1, { message: "المريض مطلوب" }),
    pharmacyId: nonEmpty.optional(),
    orderId: nonEmpty.optional(),
    medications,
    status: prescriptionStatus.default("new"),
    notes: z.string().optional(),
  })
  .strict();

// GET /api/prescriptions — List prescriptions.
// Previously took no filters at all, so a pharmacy had to page through every
// prescription in the system to find its own.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const { page, pageSize, patientId, doctorId, pharmacyId, status } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.PrescriptionWhereInput = {};
  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (pharmacyId) where.pharmacyId = pharmacyId;
  if (status) where.status = status;

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
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const input = await parseBody(req, createPrescriptionSchema);

  const data = await prisma.prescription.create({
    data: {
      doctorId: input.doctorId,
      patientId: input.patientId,
      pharmacyId: input.pharmacyId ?? null,
      orderId: input.orderId ?? null,
      medications: input.medications as Prisma.InputJsonValue,
      status: input.status,
      notes: input.notes ?? null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
