import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Identity } from "@/lib/api-auth";
import { complexContextFor, resolveReferablePatient } from "@/server/services/referral";

/**
 * Which patients a partner may name in a referral.
 *
 * This rule is the one thing standing between the referral form and a lookup
 * oracle over the whole user table: a referral echoes back the patient's name
 * and phone, so if any `patientId` were accepted, any partner could read the
 * contact details of any stranger.
 *
 * It was widened to count a referral the caller is party to, alongside orders
 * and appointments — without that, the chain a complex exists for breaks at its
 * second hop: the doctor refers to the lab, the lab runs the test, and then
 * cannot send the patient on to the pharmacy because it never held an order.
 *
 * These tests exist to make sure the widening did not become a hole. Everything
 * is created here and removed in `afterAll`.
 */

const TAG = `rps-${Date.now().toString().slice(-6)}`;
const D = Prisma.Decimal;

type Party = { partnerId: string; userId: string; identity: Identity };

let complexId: string;
let complexOwnerPartnerId: string;
let doctor: Party;
let lab: Party;
let pharmacy: Party;
let outsider: Party;
let patientId: string;
let strangerId: string;

const createdPartnerIds: string[] = [];
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const createdReferralIds: string[] = [];

async function makePartner(type: "DOCTOR" | "LAB" | "PHARMACY" | "NURSE", inComplex: boolean): Promise<Party> {
  const user = await prisma.user.create({
    data: {
      email: `${TAG}-${type.toLowerCase()}@sources.test`,
      name: `${TAG} ${type}`,
      role: type,
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);

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
  createdPartnerIds.push(partner.id);

  let doctorProfileId: string | null = null;
  if (type === "DOCTOR") {
    const profile = await prisma.doctorProfile.create({
      data: { userId: user.id, ...(inComplex ? { complexId } : {}) },
      select: { id: true },
    });
    doctorProfileId = profile.id;
  }

  return {
    partnerId: partner.id,
    userId: user.id,
    identity: { userId: user.id, role: type, partnerId: partner.id, doctorProfileId },
  };
}

beforeAll(async () => {
  const complex = await prisma.medicalComplex.findFirstOrThrow({
    where: { partner: { deletedAt: null } },
    select: { id: true, partnerId: true },
  });
  complexId = complex.id;
  complexOwnerPartnerId = complex.partnerId;

  [doctor, lab, pharmacy, outsider] = await Promise.all([
    makePartner("DOCTOR", true),
    makePartner("LAB", true),
    makePartner("PHARMACY", true),
    makePartner("NURSE", false),
  ]);

  const patients = await prisma.user.findMany({
    where: { role: "PATIENT" },
    select: { id: true },
    take: 2,
  });
  patientId = patients[0].id;
  strangerId = patients[1].id;

  // The one order in the whole chain: the patient consulted the doctor.
  const order = await prisma.order.create({
    data: {
      orderNumber: `${TAG}-ORD`,
      patientId,
      patientName: "مريض السلسلة",
      patientPhone: "9647700000123",
      serviceType: "IN_PERSON_CONSULT",
      source: "COMPLEX",
      status: "COMPLETED",
      totalAmount: new D(10000),
      assignedDoctorId: doctor.partnerId,
    },
    select: { id: true },
  });
  createdOrderIds.push(order.id);
});

afterAll(async () => {
  if (createdReferralIds.length) {
    await prisma.complexReferral.deleteMany({ where: { id: { in: createdReferralIds } } });
  }
  if (createdOrderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  if (createdPartnerIds.length) {
    await prisma.partner.deleteMany({ where: { id: { in: createdPartnerIds } } });
  }
  if (createdUserIds.length) {
    await prisma.doctorProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

/** Send a referral straight to the table — the route's rules are tested elsewhere. */
async function sendReferral(from: Party, to: Party) {
  const row = await prisma.complexReferral.create({
    data: {
      complexId,
      fromPartnerId: from.partnerId,
      toPartnerId: to.partnerId,
      patientId,
      patientName: "مريض السلسلة",
      patientPhone: "9647700000123",
      title: `${TAG} إحالة`,
      status: "sent",
    },
    select: { id: true },
  });
  createdReferralIds.push(row.id);
  return row.id;
}

const resolveFor = async (party: Party, id: string) =>
  resolveReferablePatient(party.identity, id, await complexContextFor(party.identity));

describe("an order or appointment makes the patient yours", () => {
  it("the doctor who took the consultation may refer them", async () => {
    const patient = await resolveFor(doctor, patientId);
    expect(patient).not.toBeNull();
    expect(patient!.name).toBe("مريض السلسلة");
    expect(patient!.phone).toBe("9647700000123");
  });

  it("a partner with no record of them may not", async () => {
    expect(await resolveFor(lab, patientId)).toBeNull();
  });
});

describe("a referral you are party to also makes them yours", () => {
  it("the RECIPIENT may refer the patient onward — the second hop of the chain", async () => {
    await sendReferral(doctor, lab);

    const patient = await resolveFor(lab, patientId);
    expect(patient).not.toBeNull();
    // Contact details come off the referral, which denormalises them the way an
    // order does, so they survive a later profile edit.
    expect(patient!.phone).toBe("9647700000123");
  });

  it("and onward again, so doctor → lab → pharmacy completes", async () => {
    await sendReferral(lab, pharmacy);
    expect(await resolveFor(pharmacy, patientId)).not.toBeNull();
  });

  it("the SENDER keeps them too", async () => {
    expect(await resolveFor(doctor, patientId)).not.toBeNull();
  });
});

describe("the widening did not open a door", () => {
  it("a patient nobody referred stays out of reach", async () => {
    expect(await resolveFor(lab, strangerId)).toBeNull();
    expect(await resolveFor(pharmacy, strangerId)).toBeNull();
    expect(await resolveFor(doctor, strangerId)).toBeNull();
  });

  it("a partner in NO complex gets nothing, even for a referred patient", async () => {
    // `complexContextFor` returns null outside a complex, so the referral
    // source is never consulted — it cannot be used to borrow someone else's
    // patient list.
    expect(await complexContextFor(outsider.identity)).toBeNull();
    expect(await resolveFor(outsider, patientId)).toBeNull();
  });

  it("a complex member who is not a party to the referral gets nothing", async () => {
    // The complex's own partner row is a member, and referrals exist about this
    // patient — but none of them name it, so it holds no claim.
    const bystander: Party = {
      partnerId: complexOwnerPartnerId,
      userId: "irrelevant",
      identity: {
        userId: "irrelevant",
        role: "LAB",
        partnerId: complexOwnerPartnerId,
        doctorProfileId: null,
      },
    };
    const ctx = await complexContextFor(bystander.identity);
    expect(ctx).not.toBeNull();
    expect(await resolveReferablePatient(bystander.identity, patientId, ctx)).toBeNull();
  });
});
