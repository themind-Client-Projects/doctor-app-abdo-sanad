import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { jsonValue, nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Free-text `String` column — validated against the documented vocabulary so a
// bogus status cannot corrupt the row. See prisma/schema.prisma (LabSample).
const sampleStatus = z.enum(
  ["received", "in_lab", "testing", "ready", "sent_to_doctor", "sent_to_patient"],
  { message: "حالة غير صالحة" }
);

/** `results` is a Json column: an object of test results. */
const results = z.record(z.string(), jsonValue);

// Allow-list of the editable columns — the whole body used to be spread into
// update, so any column (createdAt, id, …) was rewritable alongside `results`.
// `.strict()` makes an unknown key a 400.
const updateLabSampleSchema = z
  .object({
    status: sampleStatus.optional(),
    results: results.nullish(),
    nurseId: nonEmpty.optional(),
    sampleType: nonEmpty.optional(),
    labId: nonEmpty.optional(),
  })
  .strict();

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
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, updateLabSampleSchema);

  const existing = await prisma.labSample.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  // `undefined` leaves a column untouched in Prisma.
  const data = await prisma.labSample.update({
    where: { id },
    data: {
      status: input.status,
      results: (input.results ?? undefined) as Prisma.InputJsonValue | undefined,
      nurseId: input.nurseId,
      sampleType: input.sampleType,
      labId: input.labId,
    },
  });

  return NextResponse.json({ data });
});
