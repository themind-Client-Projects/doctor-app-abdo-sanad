import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { nonEmpty, safeUrl } from "@/lib/validation";

/**
 * Referral rules with no I/O — the state machine and the attachment shape.
 *
 * Split out of `referral.ts` because that module reaches the database and the
 * session, which drags in `next-auth`. These rules are the part most worth
 * testing exhaustively, and they should not need an auth runtime to be tested.
 * `referral.ts` re-exports everything here, so route files still have one
 * import.
 */

/* ------------------------------- vocabulary ------------------------------- */

/**
 * sent → received → in_progress → completed, or cancelled by the sender.
 *
 * A plain `String` column rather than a Prisma enum, matching `Prescription`
 * and `Order`'s own status columns; the vocabulary is enforced here and by the
 * Zod schemas below, so nothing writes a status the UI cannot label.
 */
export const REFERRAL_STATUSES = [
  "sent",
  "received",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const referralStatusSchema = z.enum(REFERRAL_STATUSES, { message: "حالة غير صالحة" });

/**
 * What the TIMELINE can record — a superset of what the status column can hold.
 *
 * The client's form draws أُرسل ← استُلم ← رُوجع ← أُعيدت ← عُولجت. Four of those
 * are statuses a referral enters, but "أُعيدت الإحالة" is not: re-referring
 * creates a NEW document and leaves the old one exactly where it was. It is
 * something that HAPPENED to the referral, which is precisely what an event log
 * is for and what a status column cannot express.
 *
 * Keeping it out of `REFERRAL_STATUSES` is deliberate: `canTransition` must
 * never offer it, and no row's `status` may ever be written to it.
 */
export const REFERRAL_EVENT_STATUSES = [...REFERRAL_STATUSES, "re_referred"] as const;

export type ReferralEventStatus = (typeof REFERRAL_EVENT_STATUSES)[number];

/** One label map for the timeline, so the track reads the same wherever drawn. */
export const REFERRAL_EVENT_LABELS: Record<ReferralEventStatus, string> = {
  sent: "أُرسلت",
  received: "استُلمت",
  in_progress: "قيد التنفيذ",
  completed: "عُولجت",
  cancelled: "سُحبت",
  re_referred: "أُعيدت الإحالة",
};

/** Statuses the RECIPIENT may move a referral to, keyed by where it is now. */
const RECIPIENT_TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
  sent: ["received", "in_progress", "completed"],
  received: ["in_progress", "completed"],
  in_progress: ["completed"],
  // Terminal. A finished referral is a clinical record; reopening it would let
  // a result be rewritten after the fact with nothing recording that it changed.
  completed: [],
  cancelled: [],
};

/**
 * The sender may withdraw — but only before the recipient has started.
 *
 * Once the blood is drawn or the medicine dispensed, "cancelled" would be a
 * false record of what happened to the patient.
 */
const SENDER_TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
  sent: ["cancelled"],
  received: ["cancelled"],
  in_progress: [],
  completed: [],
  cancelled: [],
};

export type ReferralActor = "sender" | "recipient";

export function canTransition(
  from: ReferralStatus,
  to: ReferralStatus,
  actor: ReferralActor
): boolean {
  const allowed = actor === "recipient" ? RECIPIENT_TRANSITIONS[from] : SENDER_TRANSITIONS[from];
  return allowed.includes(to);
}

/* ------------------------------- attachments ------------------------------ */

/**
 * A result file — a scan, a photo of a report.
 *
 * `url` goes through `safeUrl`, so `javascript:` and friends cannot be stored
 * and later rendered as a link in a doctor's dashboard.
 *
 * These are URLs, not uploads: `SUPABASE_SERVICE_ROLE_KEY` is not configured,
 * so `createAdminClient()` cannot write to a bucket and a file picker would
 * fail on every attempt. When that key lands, an upload endpoint can return a
 * URL into this same shape — the stored data does not change.
 */
export const attachmentSchema = z
  .object({
    url: safeUrl,
    name: nonEmpty.max(120),
  })
  .strict();

export const attachmentsSchema = z.array(attachmentSchema).max(10);

export type Attachment = z.infer<typeof attachmentSchema>;

/**
 * Read `ComplexReferral.attachments` back out of the `Json` column.
 *
 * Anything that does not match the shape is dropped rather than thrown: a row
 * written before this validation existed must not break the whole list.
 */
export function parseAttachments(value: Prisma.JsonValue | null | undefined): Attachment[] {
  const result = attachmentsSchema.safeParse(value);
  if (result.success) return result.data;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const one = attachmentSchema.safeParse(item);
    return one.success ? [one.data] : [];
  });
}
