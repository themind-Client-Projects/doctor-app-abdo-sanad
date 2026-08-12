import { z } from "zod";
import { nonEmpty, safeUrl } from "@/lib/validation";

/**
 * The blood-bank request vocabulary, shared by the collection and item routes.
 *
 * The two files had grown their own copies of `bloodType`, `dateValue` and
 * `drawAppointment` — three definitions of the same fact, in the same folder.
 * The item route's copy was already the narrower one: it accepted `status` as a
 * strict enum while the collection route still took `nonEmpty`, so a request
 * could be CREATED in a status no filter matched and no screen could show.
 */

/** The `BloodType` enum from prisma/schema.prisma. */
export const bloodType = z.enum(
  ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
  { message: "زمرة الدم غير صالحة" }
);

/** new → broadcast (أُرسلت للمتبرعين) → matched → fulfilled → cancelled. */
export const requestStatus = z.enum(
  ["new", "broadcast", "matched", "fulfilled", "cancelled"],
  { message: "حالة غير صالحة" }
);

export const requestType = z.enum(["REQUESTER", "DONOR"], { message: "نوع الطلب مطلوب" });

/** An ISO string or epoch number — a bare coercion would also accept booleans. */
const dateValue = z
  .union([z.string(), z.number()])
  .pipe(z.coerce.date({ message: "التاريخ غير صالح" }));

/** `""` and `null` mean "no date" / clear it. */
const nullableDate = z
  .union([z.literal(""), z.null(), dateValue], { message: "التاريخ غير صالح" })
  .transform((value) => (value instanceof Date ? value : null));

/**
 * Optional free text where emptiness CLEARS the column rather than storing a
 * blank that later reads as a real value.
 *
 * Both spellings of empty are accepted. `""` is what a cleared `<input>`
 * produces; `null` is what a client sends for a field that no longer applies —
 * switching an استمارة from طالب دم to متبرع has to blank the operation fields,
 * and it sends `null` for them. Taking only `""` rejected that with
 * "expected string, received null" on a form the user had filled in correctly.
 */
const clearableText = (max: number) =>
  z
    .union([z.null(), z.string().trim().max(max)])
    .transform((v) => (v === null || v === "" ? null : v));

/**
 * Everything a blood-bank record holds, minus the derived columns.
 *
 * `broadcastAt` is absent by design: it evidences when the case actually went
 * out to donors, and is stamped server-side from the status.
 */
const fields = {
  /** The toggle at the top of the form: طالب دم or متبرع دم. */
  requestType,
  userId: nonEmpty.optional(),

  // ── Identity ──────────────────────────────────────────────────────────────
  fullName: z.string().trim().min(3, { message: "الاسم الثلاثي مطلوب" }).max(120),
  phone: z.string().trim().min(6, { message: "رقم الهاتف مطلوب" }).max(32),
  // Rendered back to the operations employee reviewing the request, so it goes
  // through `safeUrl` — a `javascript:` photo link would run in their session.
  photoUrl: safeUrl.optional(),
  age: z.number().int().min(1).max(120).nullish(),
  gender: clearableText(16).optional(),
  residence: clearableText(240).optional(),
  landmark: clearableText(160).optional(),
  bloodType,
  governorateId: z
    .union([z.literal(""), z.null(), nonEmpty])
    .transform((v) => (v ? v : null))
    .optional(),
  /// آخر تبرع — drives donor eligibility, which is why it is a date not a note.
  lastDonation: nullableDate.optional(),

  // ── REQUESTER only ────────────────────────────────────────────────────────
  operationType: clearableText(160).optional(),
  bagsNeeded: z.number().int().min(1).max(50).nullish(),
  operationPlace: clearableText(240).optional(),

  // ── Workflow — the employee's side, not the form's ────────────────────────
  status: requestStatus,
  donorId: nonEmpty.optional(),
  donorName: clearableText(120).optional(),
  drawAppointment: nullableDate.optional(),
  testStatus: clearableText(60).optional(),
  deliveryStatus: clearableText(60).optional(),
  notes: clearableText(1000).optional(),
};

export const REQUESTER_FIELDS_MESSAGE =
  "نوع العملية وعدد الأكياس ومكان العملية مطلوبة لطلب الدم";

/**
 * A blood REQUEST without an operation, a bag count and a place is not
 * actionable — the employee cannot match donors against it. A DONOR
 * registration carries none of those, which is why this is conditional.
 */
const requesterFieldsPresent = (v: {
  requestType: string;
  operationType?: string | null;
  bagsNeeded?: number | null;
  operationPlace?: string | null;
}) =>
  v.requestType !== "REQUESTER" ||
  Boolean(v.operationType && v.bagsNeeded && v.operationPlace);

// `.strict()` so an unexpected key is a 400 rather than being silently written:
// the body used to be spread straight into Prisma, so any column was writable
// and an unknown blood group crashed as a 500 instead of a 400.
export const createBloodBankRequestSchema = z
  .object({ ...fields, status: requestStatus.default("new") })
  .strict()
  .refine(requesterFieldsPresent, {
    message: REQUESTER_FIELDS_MESSAGE,
    path: ["operationType"],
  });

/**
 * Every field is optional on a patch, and the cross-field rule is NOT checked
 * here — a partial body cannot see the row it is merging into. The item route
 * applies it to the merged result instead.
 */
export const updateBloodBankRequestSchema = z
  .object(fields)
  .partial()
  .strict();

export type CreateBloodBankRequest = z.infer<typeof createBloodBankRequestSchema>;
export type UpdateBloodBankRequest = z.infer<typeof updateBloodBankRequestSchema>;
