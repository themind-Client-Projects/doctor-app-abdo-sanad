import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";

/**
 * الملف الطبي المختصر can be written, and reads back what was written.
 *
 * `PUT /api/medical-records/[patientId]` was the only writer of
 * `PatientMedicalRecord` and NOTHING called it — no screen, no service, no
 * seed. The GET therefore 404'd for every patient and the operations screen
 * sat on its empty state forever. The clinical cost was specific: allergies
 * are captured inside a referral form and copied nowhere, so a nurse opening a
 * patient before a home blood draw had no allergy information and no way for
 * anyone to enter it.
 *
 * Run through the real handlers, because what matters is the care-relationship
 * check and the id spaces — `treatingDoctorId` holds a `DoctorProfile.id`,
 * which is not the doctor's `User.id`.
 */

let patientId: string | null = null;
let createdRecord = false;

function req(url: string, init: { method: string; body?: unknown; bearer: string }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method,
    headers: { "content-type": "application/json", authorization: `Bearer ${init.bearer}` },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function bearerFor(where: object) {
  const u = await prisma.user.findFirst({
    where: where as never,
    select: { id: true, role: true, partner: { select: { id: true } }, doctorProfile: { select: { id: true } } },
  });
  if (!u) return null;
  return {
    u,
    token: await signAccessToken({
      sub: u.id,
      role: u.role,
      partnerId: u.partner?.id ?? null,
      doctorProfileId: u.doctorProfile?.id ?? null,
    }),
  };
}

afterAll(async () => {
  if (createdRecord && patientId) {
    await prisma.patientMedicalRecord.deleteMany({ where: { patientId } });
  }
});

describe("the brief medical file has a writer", () => {
  it("an admin can write allergies, and they read back", async () => {
    const admin = await bearerFor({ role: "SUPER_ADMIN", deletedAt: null, isActive: true });
    // A patient the admin can reach — SUPER_ADMIN is a platform role, so the
    // care-relationship check admits them for any patient.
    const patient = await prisma.user.findFirst({
      where: { role: "PATIENT", deletedAt: null },
      select: { id: true },
    });
    if (!admin || !patient) {
      console.warn("SKIP: no admin or patient fixture");
      return;
    }
    patientId = patient.id;
    const existing = await prisma.patientMedicalRecord.findUnique({ where: { patientId } });
    createdRecord = existing === null;

    const { PUT, GET } = await import("@/app/api/medical-records/[patientId]/route");

    const put = await PUT(
      req(`/api/medical-records/${patientId}`, {
        method: "PUT",
        bearer: admin.token,
        body: {
          medicalHistory: "اختبار: ربو منذ الطفولة",
          chronicDiseases: ["ربو"],
          allergies: ["بنسلين"],
          currentMedications: ["سالبوتامول"],
        },
      }),
      { params: Promise.resolve({ patientId }) } as never
    );
    const putBody = await put.json();
    expect(put.status, JSON.stringify(putBody)).toBe(200);

    // It is really in the table, not just echoed.
    const row = await prisma.patientMedicalRecord.findUniqueOrThrow({ where: { patientId } });
    expect(row.allergies).toEqual(["بنسلين"]);

    // And the GET — which used to 404 for every patient — returns it.
    const get = await GET(
      req(`/api/medical-records/${patientId}`, { method: "GET", bearer: admin.token }),
      { params: Promise.resolve({ patientId }) } as never
    );
    const body = await get.json();
    expect(get.status, JSON.stringify(body)).toBe(200);
    expect(body.data.allergies).toEqual(["بنسلين"]);
    expect(body.data.medicalHistory).toContain("ربو");
  });

  it("derives آخر التحاليل / الوصفات from the real records rather than a typed copy", async () => {
    const admin = await bearerFor({ role: "SUPER_ADMIN", deletedAt: null, isActive: true });
    // A patient who actually has prescriptions on file.
    const withRx = await prisma.prescription.findFirst({ select: { patientId: true } });
    if (!admin || !withRx) {
      console.warn("SKIP: no prescription fixture");
      return;
    }

    const { GET } = await import("@/app/api/medical-records/[patientId]/route");
    const res = await GET(
      req(`/api/medical-records/${withRx.patientId}`, { method: "GET", bearer: admin.token }),
      { params: Promise.resolve({ patientId: withRx.patientId }) } as never
    );
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    // The point: this patient may have no stored record at all, and the file
    // still shows their prescriptions. A 404 here was the old behaviour.
    expect(Array.isArray(body.data.previousPrescriptions)).toBe(true);
    expect(body.data.previousPrescriptions.length).toBeGreaterThan(0);
  });

  it("refuses a clinician with no care relationship", async () => {
    // A pharmacy is in ROLES.CLINICAL and can reach the GET, but may only read
    // a patient it actually serves — and may never write at all.
    const pharmacy = await bearerFor({ role: "PHARMACY", deletedAt: null, isActive: true });
    if (!pharmacy || !patientId) {
      console.warn("SKIP: no pharmacy fixture");
      return;
    }
    // `withAuth` turns an AuthError into a 403 RESPONSE rather than throwing
    // out of the handler (api-auth.ts:332-334).
    const { PUT } = await import("@/app/api/medical-records/[patientId]/route");
    const res = await PUT(
      req(`/api/medical-records/${patientId}`, {
        method: "PUT",
        bearer: pharmacy.token,
        body: { allergies: [] },
      }),
      { params: Promise.resolve({ patientId }) } as never
    );
    expect(res.status).toBe(403);

    // And the stored allergies are untouched — the refusal is not cosmetic.
    const row = await prisma.patientMedicalRecord.findUnique({ where: { patientId } });
    expect(row?.allergies).toEqual(["بنسلين"]);
  });
});
