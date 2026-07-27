import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ patientId: string }> };

/** Json columns: absent stays absent so a partial update can't blank a field. */
const jsonField = z.unknown().optional();

const updateRecordSchema = z
  .object({
    medicalHistory: z.string().optional(),
    chronicDiseases: jsonField,
    allergies: jsonField,
    currentMedications: jsonField,
    latestLabResults: jsonField,
    latestRadiology: jsonField,
    previousPrescriptions: jsonField,
    treatingDoctorId: z.string().trim().min(1).optional(),
  })
  .strict();

// GET /api/medical-records/[patientId] — Brief medical file (req L409-419, 8 fields)
//
// This is the most sensitive endpoint in the app: history, chronic diseases,
// allergies, current medications, lab results, radiology, prior prescriptions.
// It was previously readable — and writable — by anyone who could guess an id.
export const GET = withAuth<Ctx>(
  { roles: [...ROLES.CLINICAL, "PATIENT"] },
  async (_req, { params }, identity) => {
    const { patientId } = await params;

    // A patient may only read their own record.
    if (identity.role === "PATIENT" && identity.userId !== patientId) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا الملف");
    }

    const data = await prisma.patientMedicalRecord.findUnique({ where: { patientId } });
    if (!data) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ data });
  }
);

// PUT /api/medical-records/[patientId] — clinical staff only.
// Patients must not be able to rewrite their own allergies or medications.
export const PUT = withAuth<Ctx>(
  { roles: ROLES.CLINICAL },
  async (req, { params }) => {
    const { patientId } = await params;
    const input = await parseBody(req, updateRecordSchema);

    const json = (v: unknown) =>
      v === undefined ? undefined : (v as Prisma.InputJsonValue);

    const fields = {
      medicalHistory: input.medicalHistory,
      chronicDiseases: json(input.chronicDiseases),
      allergies: json(input.allergies),
      currentMedications: json(input.currentMedications),
      latestLabResults: json(input.latestLabResults),
      latestRadiology: json(input.latestRadiology),
      previousPrescriptions: json(input.previousPrescriptions),
      treatingDoctorId: input.treatingDoctorId,
    };

    const data = await prisma.patientMedicalRecord.upsert({
      where: { patientId },
      update: fields,
      create: { patientId, ...fields },
    });

    return NextResponse.json({ data });
  }
);
