import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ patientId: string }> };

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
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    // Explicit allow-list — the body used to be spread into upsert, so any
    // column on the model was writable.
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

    const fields = {
      medicalHistory: str(body.medicalHistory),
      chronicDiseases: json(body.chronicDiseases),
      allergies: json(body.allergies),
      currentMedications: json(body.currentMedications),
      latestLabResults: json(body.latestLabResults),
      latestRadiology: json(body.latestRadiology),
      previousPrescriptions: json(body.previousPrescriptions),
      treatingDoctorId: str(body.treatingDoctorId),
    };

    const data = await prisma.patientMedicalRecord.upsert({
      where: { patientId },
      update: fields,
      create: { patientId, ...fields },
    });

    return NextResponse.json({ data });
  }
);
