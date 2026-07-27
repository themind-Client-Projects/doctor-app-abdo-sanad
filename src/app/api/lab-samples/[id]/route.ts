import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, assertPartnerScope, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
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
export const GET = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.labSample.findUnique({ where: { id } });
  if (!data) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // Load first, then check ownership: a partner-scoped role may only read its
  // own lab's samples. Missing rows still 404 rather than 403, so a caller
  // cannot use the status code to probe for ids outside its tenant.
  if (!isPlatformRole(identity.role)) {
    assertPartnerScope(identity, data.labId);
  }

  return ok(data, { requestId });
});

// PATCH /api/lab-samples/[id] — Update a sample.
export const PATCH = withAuth<Ctx>({ roles: ROLES.CLINICAL }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateLabSampleSchema);

  const existing = await prisma.labSample.findUnique({
    where: { id },
    select: { id: true, labId: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }

  // Load first, then check ownership — writing `results` on another lab's
  // sample is a patient-safety issue, not just a data one.
  const platform = isPlatformRole(identity.role);
  if (!platform) {
    assertPartnerScope(identity, existing.labId);
  }

  // `undefined` leaves a column untouched in Prisma.
  const data = await prisma.labSample.update({
    where: { id },
    data: {
      status: input.status,
      results: (input.results ?? undefined) as Prisma.InputJsonValue | undefined,
      nurseId: input.nurseId,
      sampleType: input.sampleType,
      // Reassignment is a platform-only operation: a lab must not be able to
      // hand another lab's sample — or its own — to a competitor.
      labId: platform ? input.labId : undefined,
    },
  });

  return ok(data, { requestId });
});
