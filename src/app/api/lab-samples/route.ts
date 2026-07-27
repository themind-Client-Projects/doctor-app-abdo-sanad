import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import {
  jsonValue,
  nonEmpty,
  paginationSchema,
  parseBody,
  parseQuery,
} from "@/lib/validation";

// LabSample.status is a free-text `String` column, so without validation a
// caller could write {"status":"banana"} and drop a sample out of every
// worklist. Vocabulary from prisma/schema.prisma (LabSample).
const sampleStatus = z.enum(
  ["received", "in_lab", "testing", "ready", "sent_to_doctor", "sent_to_patient"],
  { message: "حالة غير صالحة" }
);

/** `results` is a Json column: an object of test results. */
const results = z.record(z.string(), jsonValue);

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, sampleStatus.optional()),
  labId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  orderId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
});

// `.strict()` so an unexpected key is a 400 rather than being silently written —
// the raw body used to be spread into prisma.labSample.create.
const createLabSampleSchema = z
  .object({
    labId: z.string({ message: "المختبر مطلوب" }).trim().min(1, { message: "المختبر مطلوب" }),
    sampleType: z
      .string({ message: "نوع العينة مطلوب" })
      .trim()
      .min(1, { message: "نوع العينة مطلوب" }),
    nurseId: nonEmpty.optional(),
    orderId: nonEmpty.optional(),
    status: sampleStatus.default("received"),
    results: results.nullish(),
  })
  .strict();

// GET /api/lab-samples — List samples, optionally filtered.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const { page, pageSize, status, labId, orderId } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.LabSampleWhereInput = {};
  if (status) where.status = status;
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
export const POST = withAuth({ roles: ROLES.CLINICAL }, async (req) => {
  const input = await parseBody(req, createLabSampleSchema);

  const data = await prisma.labSample.create({
    data: {
      labId: input.labId,
      sampleType: input.sampleType,
      nurseId: input.nurseId ?? null,
      orderId: input.orderId ?? null,
      status: input.status,
      results: (input.results ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
