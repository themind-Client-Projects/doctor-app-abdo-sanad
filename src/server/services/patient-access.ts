import type { Prisma } from "@prisma/client";
import type { Identity } from "@/lib/api-auth";
import { isPlatformRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { orderScopeFor } from "@/lib/order-slots";
import { complexContextFor, type ComplexContext } from "./referral";

/**
 * Does this caller have a care relationship with this patient?
 *
 * One question, asked by three different features, and it has to be answered
 * the same way each time:
 *
 *   - the referral form, deciding who may be named in a referral
 *   - "مرضاي", deciding whose patients to list
 *   - the medical file, deciding who may read and rewrite allergies
 *
 * The third is why this is a module rather than a helper inside the referral
 * service. The file endpoint had NO relationship check: any doctor in the
 * system could read any patient's allergies, chronic diseases and current
 * medications by id, and any doctor or nurse could REWRITE them. A wrong
 * allergy list is not a privacy problem, it is a clinical safety one.
 *
 * Four ways to hold a patient:
 *
 *   1. An **order** assigned to you — a walk-in at a lab or a pharmacy.
 *   2. An **appointment** — a doctor's consultation.
 *   3. A **referral you are party to** — the colleague down the corridor sent
 *      them to you. Without this the chain inside a complex breaks at its
 *      second hop.
 *   4. A **prescription** you wrote, or that names you as the pharmacy.
 *      `Prescription.orderId` is optional, so a pharmacy can dispense to
 *      someone it holds through no order at all — and without this it would see
 *      that patient on its prescriptions screen while "مرضاي" and the referral
 *      form both denied the person existed.
 *
 * Platform roles (SUPER_ADMIN, OPERATIONS) are not asked: they dispatch and
 * support across the whole platform, and every screen they use is already
 * theirs. The patient themselves is not asked either — callers check that
 * separately, because "is this me" is a different question from "am I treating
 * this person".
 */

export type PatientContact = { id: string; name: string; phone: string };

/**
 * Which prescriptions count as this caller's, or null when none ever can.
 *
 * Null rather than a fails-closed `where`, so the caller skips the query
 * entirely — a LAB, NURSE, RADIOLOGY or DRIVER holds no prescriptions by any
 * column, and asking the database to prove that on every request is waste.
 */
export function prescriptionScopeFor(
  identity: Identity
): Prisma.PrescriptionWhereInput | null {
  // `deletedAt: null` on every branch, matching the order and appointment
  // sources beside it. A soft-deleted prescription must not keep a care
  // relationship alive that the platform has already retracted.
  if (isPlatformRole(identity.role)) return { deletedAt: null };
  if (identity.role === "PHARMACY") {
    // No partnerId means the account is not linked to a pharmacy yet; matching
    // `pharmacyId: null` would hand it every unassigned prescription.
    return identity.partnerId
      ? { pharmacyId: identity.partnerId, deletedAt: null }
      : null;
  }
  if (identity.role === "DOCTOR" && identity.doctorProfileId) {
    return { doctorId: identity.doctorProfileId, deletedAt: null };
  }
  return null;
}

/**
 * The strongest evidence this caller holds the patient, or null.
 *
 * Returns the contact details denormalised on whichever record carried them, so
 * a recipient still reads the right name and number after a profile edit.
 *
 * `ctx` is the caller's complex, passed in when the caller already resolved it
 * (the referral routes do) and resolved here otherwise.
 */
export async function resolvePatientForCaller(
  identity: Identity,
  patientId: string,
  ctx?: ComplexContext | null
): Promise<PatientContact | null> {
  const complex = ctx === undefined ? await complexContextFor(identity) : ctx;
  const prescriptionScope = prescriptionScopeFor(identity);

  const [order, appointment, referral, prescription] = await Promise.all([
    prisma.order.findFirst({
      where: { patientId, deletedAt: null, ...orderScopeFor(identity) },
      select: { patientName: true, patientPhone: true },
      orderBy: { createdAt: "desc" },
    }),
    identity.doctorProfileId
      ? prisma.appointment.findFirst({
          where: { patientId, doctorId: identity.doctorProfileId, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
    complex
      ? prisma.complexReferral.findFirst({
          where: {
            patientId,
            // Either direction. Receiving one is how the patient reached you;
            // having sent one means you already held them when you did.
            OR: [{ toPartnerId: complex.partnerId }, { fromPartnerId: complex.partnerId }],
          },
          select: { patientName: true, patientPhone: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
    prescriptionScope
      ? prisma.prescription.findFirst({
          where: { patientId, ...prescriptionScope },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!order && !appointment && !referral && !prescription) return null;

  // Whichever record we have carries the details as given at booking — the most
  // reliable contact we hold. An appointment carries none, so fall back to the
  // account.
  const denormalised = order ?? referral;
  if (denormalised?.patientName && denormalised.patientPhone) {
    return { id: patientId, name: denormalised.patientName, phone: denormalised.patientPhone };
  }

  const user = await prisma.user.findUnique({
    where: { id: patientId },
    select: { name: true, phone: true },
  });
  if (!user) return null;

  return {
    id: patientId,
    name: denormalised?.patientName ?? user.name ?? "—",
    phone: denormalised?.patientPhone ?? user.phone ?? "—",
  };
}

/**
 * May this caller open this patient's medical file?
 *
 * The file is the most sensitive record in the app, so the rule is the care
 * relationship above — plus the two cases that are not relationships at all:
 * a platform role, and the patient reading their own file.
 */
export async function canAccessPatientRecord(
  identity: Identity,
  patientId: string
): Promise<boolean> {
  if (isPlatformRole(identity.role)) return true;
  if (identity.role === "PATIENT") return identity.userId === patientId;
  return (await resolvePatientForCaller(identity, patientId)) !== null;
}
