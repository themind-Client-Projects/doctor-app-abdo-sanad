import { Prisma, type UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, ROLES, withAuth } from "@/lib/api-auth";

// Who may WRITE a patient's file. ROLES.CLINICAL also contains LAB, PHARMACY,
// OPERATIONS and RADIOLOGY — a dispensing pharmacy could rewrite a patient's
// allergies and current medications. Writing the file is the treating
// clinician's job; the read side stays wider.
const RECORD_WRITE_ROLES = ["SUPER_ADMIN", "DOCTOR", "NURSE"] as const satisfies readonly UserRole[];
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { canAccessPatientRecord } from "@/server/services/patient-access";

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
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { patientId } = await params;

    // Belonging to a clinical role is not the same as treating this person.
    //
    // Authenticating this route stopped anonymous access but left it open to
    // every clinician on the platform: any doctor, lab, pharmacy or radiology
    // centre could read ANY patient's history, allergies and current
    // medications by id. `canAccessPatientRecord` requires an actual care
    // relationship — an order, an appointment, or a referral — and lets the
    // patient read their own.
    if (!(await canAccessPatientRecord(identity, patientId))) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا الملف");
    }

    // «يعرض» — the requirement (L409-419) says this file DISPLAYS eight things,
    // and four of them are records the platform already holds. آخر التحاليل،
    // آخر الأشعة and الوصفات السابقة are therefore DERIVED here rather than
    // read from their stored columns: "latest" has to mean the actual latest,
    // and a hand-typed copy is stale the moment the next result lands. The
    // columns stay for back-compatibility; nothing writes them any more.
    const [record, prescriptions, labs, radiology] = await Promise.all([
      prisma.patientMedicalRecord.findUnique({ where: { patientId } }),
      prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, medications: true, notes: true, status: true, createdAt: true },
      }),
      prisma.labSample.findMany({
        where: { order: { is: { patientId } }, results: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, results: true, status: true, createdAt: true },
      }),
      prisma.radiologyRequest.findMany({
        where: { order: { is: { patientId } } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    // A patient with no stored file but real results still has a file worth
    // showing — 404 here is what left the operations screen on its empty state
    // for every patient. It is only absent when there is genuinely nothing.
    const hasAnything =
      record !== null || prescriptions.length > 0 || labs.length > 0 || radiology.length > 0;
    if (!hasAnything) {
      return fail(ErrorCode.NOT_FOUND, 404, "الملف غير موجود", { requestId });
    }

    // الطبيب المعالج as a NAME. The column holds a `DoctorProfile.id`, and the
    // reader printed it raw — a cuid under an Arabic label.
    const treatingDoctor = record?.treatingDoctorId
      ? await prisma.doctorProfile.findUnique({
          where: { id: record.treatingDoctorId },
          select: { id: true, user: { select: { name: true } } },
        })
      : null;

    return ok(
      {
        patientId,
        medicalHistory: record?.medicalHistory ?? null,
        chronicDiseases: record?.chronicDiseases ?? [],
        allergies: record?.allergies ?? [],
        currentMedications: record?.currentMedications ?? [],
        latestLabResults: labs,
        latestRadiology: radiology,
        previousPrescriptions: prescriptions,
        treatingDoctorId: record?.treatingDoctorId ?? null,
        treatingDoctorName: treatingDoctor?.user.name ?? null,
        updatedAt: record?.updatedAt ?? null,
      },
      { requestId }
    );
  }
);

// PUT /api/medical-records/[patientId] — treating clinicians only.
// Patients must not be able to rewrite their own allergies or medications.
export const PUT = withAuth<Ctx>(
  { roles: RECORD_WRITE_ROLES },
  async (req, { params }, identity) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { patientId } = await params;
    const input = await parseBody(req, updateRecordSchema);

    // `patientId` was written straight into an upsert with nothing checking it
    // named a real person, and `PatientMedicalRecord.patientId` carries no
    // foreign key — so any string minted a medical file. A sweep sending an
    // empty body to a nonsense id created one.
    const patient = await prisma.user.findFirst({
      where: { id: patientId, role: "PATIENT" },
      select: { id: true },
    });
    if (!patient) {
      return fail(ErrorCode.NOT_FOUND, 404, "المريض غير موجود", { requestId });
    }

    // Writing is stricter than reading, and neither was checked. Any doctor or
    // nurse on the platform could rewrite ANY patient's allergies, chronic
    // diseases and current medications. That is not a privacy problem — an
    // erased penicillin allergy is a clinical safety one.
    if (!(await canAccessPatientRecord(identity, patientId))) {
      throw new AuthError(403, "ليس لديك صلاحية لتعديل هذا الملف");
    }

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

    return ok(data, { requestId });
  }
);
