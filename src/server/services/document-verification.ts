import { prisma } from "@/lib/prisma";
import { verifyDocumentCode } from "@/lib/document-verify";
import { REFERRAL_KINDS, type ReferralKind } from "./referral-forms";

/**
 * "هل هذه الوثيقة صحيحة؟" — the one question the public verifier answers.
 *
 * A pharmacy holding a printed prescription, or an imaging centre holding a
 * radiology request, scans the QR and needs to know three things: it came out
 * of this system, it is about the document it claims to be, and it is still
 * in force.
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN
 *
 * Every other read of a referral is fenced by `referralScopeFor` to its two
 * parties, precisely because the row carries a patient's name and phone plus
 * another provider's clinical note. This is the one unauthenticated read in the
 * codebase, so it is built as a yes/no with the minimum context that makes the
 * answer meaningful: the reference, the document type, the dates, the status,
 * and the two facility names that are already printed on the paper in the
 * verifier's hand.
 *
 * No patient name, no phone, no clinical payload, no description, no result,
 * no attachments. Whoever scans the QR already holds the document; the verifier
 * confirms what they can see rather than disclosing what they cannot.
 */

export type VerificationResult =
  | { ok: false; reason: "not_found" }
  | {
      ok: true;
      referenceNumber: string;
      kind: ReferralKind;
      status: string;
      issuedAt: Date;
      expiresAt: Date | null;
      isExpired: boolean;
      /** Present only once the recipient has acted — the paper cannot show this. */
      respondedAt: Date | null;
      fromPartner: string;
      toPartner: string;
      complex: string;
    };

/** `RAD-2024-05120` → its parts, or null when the shape is not ours. */
export function parseReference(
  reference: string
): { kind: ReferralKind; year: number; seq: number } | null {
  const match = /^(REF|RAD|RX|LAB)-(\d{4})-(\d{1,9})$/i.exec(reference.trim());
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  const kind = (
    { REF: "DOCTOR", RAD: "RADIOLOGY", RX: "PHARMACY", LAB: "LAB" } as const
  )[prefix as "REF" | "RAD" | "RX" | "LAB"];
  if (!REFERRAL_KINDS.includes(kind)) return null;

  return { kind, year: Number(match[2]), seq: Number(match[3]) };
}

/**
 * Look a document up and check its code.
 *
 * EVERY failure returns the same `not_found`: a malformed reference, an unknown
 * one, and a real reference with the wrong code are indistinguishable. Telling
 * them apart would turn this into an oracle for which reference numbers exist —
 * and the sequence is an incrementing integer, so that oracle would enumerate
 * the platform's entire referral volume.
 */
export async function verifyReferralDocument(
  reference: string,
  code: string | null | undefined
): Promise<VerificationResult> {
  const parsed = parseReference(reference);
  if (!parsed || !code) return { ok: false, reason: "not_found" };

  const row = await prisma.complexReferral.findFirst({
    where: { seq: parsed.seq, kind: parsed.kind },
    select: {
      id: true,
      kind: true,
      seq: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      respondedAt: true,
      fromPartner: { select: { name: true } },
      toPartner: { select: { name: true } },
      complex: { select: { name: true } },
    },
  });
  if (!row) return { ok: false, reason: "not_found" };

  // The year is part of the printed reference but not of the lookup key, so a
  // row whose year does not match the paper is not the document being checked.
  if (row.createdAt.getUTCFullYear() !== parsed.year) {
    return { ok: false, reason: "not_found" };
  }

  if (!verifyDocumentCode(row, code)) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    referenceNumber: reference.trim().toUpperCase(),
    kind: row.kind as ReferralKind,
    status: row.status,
    issuedAt: row.createdAt,
    expiresAt: row.expiresAt,
    isExpired: row.expiresAt !== null && row.expiresAt.getTime() < Date.now(),
    respondedAt: row.respondedAt,
    fromPartner: row.fromPartner.name,
    toPartner: row.toPartner.name,
    complex: row.complex.name,
  };
}
