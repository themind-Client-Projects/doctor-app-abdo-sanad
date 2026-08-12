import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Identity } from "@/lib/api-auth";
import { canAccessPatientRecord } from "@/server/services/patient-access";

/**
 * Who may open a patient's medical file.
 *
 * The file holds history, chronic diseases, allergies and current medications.
 * The route authenticated the caller and stopped there: every doctor, lab,
 * pharmacy and radiology centre on the platform could read ANY patient's file
 * by id, and any doctor or nurse could REWRITE it. An erased penicillin allergy
 * is not a privacy incident, it is a clinical safety one — which is why this
 * rule gets its own tests rather than riding on the referral suite's.
 *
 * The relationship required is the same one the referral form uses, so the two
 * cannot drift apart on what "your patient" means.
 */

const TAG = `pra-${Date.now().toString().slice(-6)}`;
const D = Prisma.Decimal;

type Party = { partnerId: string; userId: string; identity: Identity };

let complexId: string;
let treating: Party;
let stranger: Party;
let labWithOrder: Party;
let patientId: string;
let otherPatientId: string;

const partnerIds: string[] = [];
const userIds: string[] = [];
const orderIds: string[] = [];

async function makePartner(type: "DOCTOR" | "LAB", inComplex: boolean): Promise<Party> {
  const user = await prisma.user.create({
    data: { email: `${TAG}-${type}-${partnerIds.length}@record.test`, name: `${TAG} ${type}`, role: type },
    select: { id: true },
  });
  userIds.push(user.id);

  const partner = await prisma.partner.create({
    data: {
      name: `${TAG} ${type}`,
      type,
      phone: `964770${Math.floor(Math.random() * 10_000_000)}`,
      userId: user.id,
      ...(inComplex ? { complexId } : {}),
    },
    select: { id: true },
  });
  partnerIds.push(partner.id);

  let doctorProfileId: string | null = null;
  if (type === "DOCTOR") {
    const p = await prisma.doctorProfile.create({ data: { userId: user.id }, select: { id: true } });
    doctorProfileId = p.id;
  }

  return { partnerId: partner.id, userId: user.id, identity: { userId: user.id, role: type, partnerId: partner.id, doctorProfileId } };
}

beforeAll(async () => {
  complexId = (await prisma.medicalComplex.findFirstOrThrow({ select: { id: true } })).id;

  treating = await makePartner("DOCTOR", true);
  stranger = await makePartner("DOCTOR", true);
  labWithOrder = await makePartner("LAB", true);

  const patients = await prisma.user.findMany({ where: { role: "PATIENT" }, select: { id: true }, take: 2 });
  patientId = patients[0].id;
  otherPatientId = patients[1].id;

  // The treating doctor's consultation, and a lab order for the same patient.
  for (const [slot, partnerId, service] of [
    ["assignedDoctorId", treating.partnerId, "IN_PERSON_CONSULT"],
    ["assignedLabId", labWithOrder.partnerId, "LAB_TEST"],
  ] as const) {
    const o = await prisma.order.create({
      data: {
        orderNumber: `${TAG}-${slot}`,
        patientId,
        patientName: "مريض الملف",
        patientPhone: "9647700000999",
        serviceType: service,
        source: "DIRECT",
        status: "COMPLETED",
        totalAmount: new D(1000),
        [slot]: partnerId,
      },
      select: { id: true },
    });
    orderIds.push(o.id);
  }
});

afterAll(async () => {
  if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  if (partnerIds.length) await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
  if (userIds.length) {
    await prisma.doctorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

const platform = (role: "SUPER_ADMIN" | "OPERATIONS"): Identity => ({
  userId: `${TAG}-platform`,
  role,
  partnerId: null,
  doctorProfileId: null,
});

const asPatient = (id: string): Identity => ({ userId: id, role: "PATIENT", partnerId: null, doctorProfileId: null });

describe("a care relationship opens the file", () => {
  it("the doctor who took the consultation may open it", async () => {
    expect(await canAccessPatientRecord(treating.identity, patientId)).toBe(true);
  });

  it("a lab holding an order for the same patient may open it", async () => {
    // A lab about to draw blood has a real need to know the allergy list.
    expect(await canAccessPatientRecord(labWithOrder.identity, patientId)).toBe(true);
  });
});

describe("belonging to a clinical role does not", () => {
  it("a doctor with no record of this patient is refused", async () => {
    expect(await canAccessPatientRecord(stranger.identity, patientId)).toBe(false);
  });

  it("and is refused for every other patient too", async () => {
    expect(await canAccessPatientRecord(stranger.identity, otherPatientId)).toBe(false);
  });

  it("a treating doctor's access does not extend to OTHER patients", async () => {
    expect(await canAccessPatientRecord(treating.identity, otherPatientId)).toBe(false);
  });
});

describe("the two cases that are not relationships", () => {
  it("a patient may open their own file, and only their own", async () => {
    expect(await canAccessPatientRecord(asPatient(patientId), patientId)).toBe(true);
    expect(await canAccessPatientRecord(asPatient(patientId), otherPatientId)).toBe(false);
  });

  it("platform roles may open any file — they dispatch and support across it", async () => {
    expect(await canAccessPatientRecord(platform("SUPER_ADMIN"), patientId)).toBe(true);
    expect(await canAccessPatientRecord(platform("OPERATIONS"), otherPatientId)).toBe(true);
  });
});

describe("a referral counts, so the file follows the patient", () => {
  it("the recipient of a referral may open the file", async () => {
    const before = await canAccessPatientRecord(stranger.identity, patientId);
    expect(before).toBe(false);

    const referral = await prisma.complexReferral.create({
      data: {
        complexId,
        fromPartnerId: treating.partnerId,
        toPartnerId: stranger.partnerId,
        patientId,
        patientName: "مريض الملف",
        patientPhone: "9647700000999",
        title: `${TAG} إحالة`,
        status: "sent",
      },
      select: { id: true },
    });

    try {
      // Being sent the patient is what grants access — the same rule the
      // referral form uses to decide who may be named.
      expect(await canAccessPatientRecord(stranger.identity, patientId)).toBe(true);
    } finally {
      await prisma.complexReferral.delete({ where: { id: referral.id } });
    }
  });
});
