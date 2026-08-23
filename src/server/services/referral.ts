import type { Prisma } from "@prisma/client";
import {
  parseClinical,
  referralNumber,
  type ReferralKind,
} from "./referral-forms";
import { prisma } from "@/lib/prisma";
import type { Identity } from "@/lib/api-auth";
import { isPlatformRole } from "@/lib/roles";
import { documentVerifyCode, documentVerifyUrl } from "@/lib/document-verify";

export * from "./referral-rules";
export * from "./referral-forms";

/**
 * Referral within a medical complex — the rules, in one place.
 *
 * "A doctor in a complex sends the patient's case to THE complex's pharmacy or
 * lab, and they reply with the result." Three facts decide every request here:
 *
 *   1. WHICH complex the caller belongs to — never taken from the request.
 *   2. WHETHER the other party is in that same complex.
 *   3. WHETHER the caller genuinely holds the patient being named — by an
 *      order, an appointment, or a referral they are party to.
 *
 * (3) is the one that is easy to skip and expensive to skip. A referral carries
 * a patient's name and phone, so without it any partner could name any user id
 * and read back contact details for a stranger — a lookup oracle over the whole
 * patient table, dressed as a clinical form.
 */

/* ------------------------------- membership ------------------------------- */

export type ComplexContext = {
  /** The caller's own Partner row — who a referral is from, or to. */
  partnerId: string;
  complexId: string;
  complexName: string;
  /** True when the caller IS the complex, rather than a member of one. */
  isOwner: boolean;
};

/**
 * Which complex the caller can refer within, resolved from the session.
 *
 * Two ways to belong: as a member (`Partner.complexId`) or as the complex
 * itself (`MedicalComplex.partnerId` — a complex is a Partner too). The owner is
 * included deliberately; a complex's own reception desk routes patients exactly
 * as its doctors do.
 *
 * Returns null for a partner in no complex, and for platform roles — SUPER_ADMIN
 * has no complex of their own, and referral is a member-to-member act, not an
 * administrative one.
 */
export async function complexContextFor(identity: Identity): Promise<ComplexContext | null> {
  if (isPlatformRole(identity.role) || !identity.partnerId) return null;

  // A PATIENT never has a referral context, even holding a partnerId.
  //
  // `auth.ts` sets `token.partnerId` from the user's Partner link with no
  // condition on role, and both `PUT /api/users/[id]/role` and
  // `POST /api/partners` can leave a User at `role: PATIENT` with that link
  // live. Such an account would otherwise resolve a real complex here, and
  // `referralScopeFor` would hand it the from/to clause — partner scope
  // standing in for a role check it was never meant to make.
  //
  // Closed here rather than at each caller so no future reader of a referral
  // has to remember: the API routes already gate on ROLES.STAFF, but the
  // printed document is served outside that wrapper.
  if (identity.role === "PATIENT") return null;

  const partner = await prisma.partner.findFirst({
    where: { id: identity.partnerId, deletedAt: null },
    select: {
      id: true,
      complex: { select: { id: true, name: true } },
      ownedComplex: { select: { id: true, name: true } },
    },
  });
  if (!partner) return null;

  // Owning wins over membership. A complex cannot sit inside another complex —
  // the members endpoint refuses it — so in practice only one is ever set.
  const complex = partner.ownedComplex ?? partner.complex;
  if (!complex) return null;

  return {
    partnerId: partner.id,
    complexId: complex.id,
    complexName: complex.name,
    isOwner: partner.ownedComplex !== null,
  };
}

/** Everyone the caller may refer to: the complex's other members, plus its owner. */
export async function eligibleRecipients(ctx: ComplexContext) {
  const [members, complex] = await Promise.all([
    prisma.partner.findMany({
      where: { complexId: ctx.complexId, deletedAt: null, id: { not: ctx.partnerId } },
      select: { id: true, name: true, type: true, phone: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    // The complex's own Partner row, so a member can refer back to reception.
    prisma.medicalComplex.findUnique({
      where: { id: ctx.complexId },
      select: { partner: { select: { id: true, name: true, type: true, phone: true } } },
    }),
  ]);

  const owner = complex?.partner;
  const all = owner && owner.id !== ctx.partnerId ? [owner, ...members] : members;

  // Deduplicate: the owner could also appear via `complexId` on bad legacy data.
  const seen = new Set<string>();
  return all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Is this partner someone the caller may send a referral to? */
export async function isEligibleRecipient(
  ctx: ComplexContext,
  partnerId: string
): Promise<boolean> {
  if (partnerId === ctx.partnerId) return false;
  const recipients = await eligibleRecipients(ctx);
  return recipients.some((p) => p.id === partnerId);
}

/* --------------------------------- patient -------------------------------- */

/**
 * Which patients this caller may name in a referral.
 *
 * Delegates to `patient-access`, which owns the care-relationship rule so that
 * the referral form, "مرضاي" and the medical file cannot drift apart on who
 * counts as your patient. Re-exported here because the referral routes read
 * everything about referrals from this module.
 */
export { resolvePatientForCaller as resolveReferablePatient } from "./patient-access";

/* --------------------------------- reading -------------------------------- */

/** The join every referral view needs: who sent it, who received it. */
export const REFERRAL_INCLUDE = {
  // The parties, and the details the printed form puts under their names:
  // specialty, licence number and facility for a doctor.
  fromPartner: {
    select: {
      id: true, name: true, type: true, phone: true, address: true,
      user: {
        select: {
          doctorProfile: {
            select: { licenseNumber: true, specialty: { select: { name: true } } },
          },
        },
      },
    },
  },
  toPartner: {
    select: {
      id: true, name: true, type: true, phone: true, address: true,
      user: {
        select: {
          doctorProfile: {
            select: { licenseNumber: true, specialty: { select: { name: true } } },
          },
        },
      },
    },
  },
  complex: { select: { id: true, name: true } },
  // The five-stage track the client's form draws, each step with its own time.
  events: {
    select: { id: true, status: true, at: true, byUserId: true, note: true },
    orderBy: { at: "asc" },
  },
  // إعادة الإحالة — the chain, one link in each direction.
  //
  // IDENTITY ONLY. Not the parent's `resultSummary`, `clinical`, description or
  // attachments — and that restraint is the point: the recipient of a
  // re-referral is NOT a party to its parent, so `referralScopeFor` gives them
  // no right to read it. Selecting the parent's result here would have handed a
  // pharmacy the lab's full report as a side effect of the join, quietly
  // widening a rule the rest of this module enforces deliberately.
  //
  // The re-referral form does not need it either: it is opened from a row in
  // the sender's OWN list, so it reads that referral's result directly, from a
  // document they are genuinely party to.
  parent: {
    select: {
      id: true, kind: true, seq: true, createdAt: true, status: true,
      fromPartner: { select: { id: true, name: true, type: true } },
      toPartner: { select: { id: true, name: true, type: true } },
    },
  },
  // The parties are selected so `decorateReferral` can drop the children the
  // viewer is not entitled to see — a child is a separate document with its own
  // two parties, and the recipient of THIS referral is not automatically one of
  // them. Without that filter, a lab that ran a test would learn that the
  // doctor afterwards sent the patient to a particular pharmacy: downstream
  // care it has no part in.
  children: {
    select: {
      id: true, kind: true, seq: true, createdAt: true, status: true,
      fromPartnerId: true, toPartnerId: true,
      toPartner: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.ComplexReferralInclude;

/**
 * Which side of a referral the caller is on.
 *
 * ONE vocabulary, because the same key on the same resource must not mean
 * different things on different endpoints. The list emitted
 * `incoming|outgoing|observed` while the detail and the reply emitted
 * `recipient|sender|observer` — two disjoint sets under one name, so a typed
 * client that decoded the list and then opened a row failed on a non-optional
 * enum, and a `direction === "outgoing"` guard on the withdraw button rendered
 * an actionless screen.
 */
export type ReferralDirection = "incoming" | "outgoing" | "observed";

export type ReferralActor = "recipient" | "sender" | "observer";

export function directionFor(actor: ReferralActor): ReferralDirection {
  if (actor === "recipient") return "incoming";
  if (actor === "sender") return "outgoing";
  return "observed";
}

/**
 * Everything the printed document needs, computed rather than stored.
 *
 * `referenceNumber`, the verification code and the patient's number and age are
 * derived from the sequence, the identity and the date of birth — one source of
 * truth, and no column that can drift out of step with the row it describes.
 */
export function decorateReferral<
  T extends {
    id: string;
    kind: ReferralKind;
    seq: number;
    createdAt: Date;
    clinical: Prisma.JsonValue;
    expiresAt: Date | null;
    // REQUIRED, not optional. Every caller reads with `REFERRAL_INCLUDE`, and
    // making these optional meant a row without them decorated to
    // `parent: null, children: []` — "this document begins and ends a chain",
    // which is a claim, not an absence. A compile error is the right answer.
    parent: ChainLink | null;
    children: ChainLinkWithParties[];
  },
>(row: T, viewerPartnerId?: string | null) {
  const referenceNumber = referralNumber(row.kind, row.seq, row.createdAt);

  return {
    ...row,
    referenceNumber,
    /**
     * The QR's payload — what a phone camera opens to check this document.
     *
     * Null rather than thrown when the signing secret is missing or too short.
     * This function is on the read path of EVERY referral endpoint, so letting
     * it throw would turn one misconfigured environment variable into a 500 on
     * the whole worklist — a printing concern taking down clinical data.
     */
    verifyUrl: safeVerifyUrl(row, referenceNumber),
    clinical: parseClinical(row.kind, row.clinical),
    /** True once a pharmacy or an imaging centre should refuse to act on it. */
    isExpired: row.expiresAt !== null && row.expiresAt.getTime() < Date.now(),
    // The chain, with its numbers already rendered. A client showing "أُعيدت
    // إلى RX-2026-00043" must not have to know how a reference is built.
    parent: row.parent ? withReference(row.parent) : null,
    children: row.children
      // A child is its own document with its own two parties. Platform roles
      // (no partner) see the whole chain, as they do everywhere else.
      .filter(
        (child) =>
          !viewerPartnerId ||
          child.fromPartnerId === viewerPartnerId ||
          child.toPartnerId === viewerPartnerId
      )
      .map(withReference),
  };
}

/** The minimum `REFERRAL_INCLUDE` selects for a parent or a child. */
type ChainLink = { kind: ReferralKind; seq: number; createdAt: Date };
type ChainLinkWithParties = ChainLink & { fromPartnerId: string; toPartnerId: string };

/** Generic so the caller keeps every field it selected, plus the number. */
function withReference<L extends ChainLink>(link: L) {
  return { ...link, referenceNumber: referralNumber(link.kind, link.seq, link.createdAt) };
}

function safeVerifyUrl(
  doc: { id: string; kind: ReferralKind; seq: number; createdAt: Date },
  reference: string
): string | null {
  try {
    return documentVerifyUrl(reference, documentVerifyCode(doc));
  } catch (error) {
    console.error("[referral] cannot sign a document verification code", error);
    return null;
  }
}

/**
 * Limit a referral query to what this caller is party to.
 *
 * A referral is visible to its sender and its recipient — nobody else in the
 * complex, since it carries another provider's clinical note about a patient.
 * Platform roles see everything, as they do elsewhere.
 *
 * Fails closed: a caller in no complex matches nothing.
 */
export function referralScopeFor(
  identity: Identity,
  ctx: ComplexContext | null
): Prisma.ComplexReferralWhereInput {
  if (isPlatformRole(identity.role)) return {};
  if (!ctx) return { id: "__no_such_referral__" };
  return { OR: [{ fromPartnerId: ctx.partnerId }, { toPartnerId: ctx.partnerId }] };
}
