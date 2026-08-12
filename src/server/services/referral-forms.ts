import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { nonEmpty } from "@/lib/validation";

/**
 * The four referral documents, and the fields each one must carry.
 *
 * The client sent four papers, not one note. They share a header — parties,
 * patient, priority, attachments — and diverge completely below it: a radiology
 * request has to answer three safety questions, a prescription has to give a
 * dose and a duration for every drug. Modelling them as one free-text
 * `description` meant a form could be submitted with none of that and nothing
 * would notice.
 *
 * `ComplexReferral.clinical` holds the divergent half, validated here against
 * `ComplexReferral.kind`. No route parses this by hand.
 */

/* ------------------------------ the documents ----------------------------- */

export const REFERRAL_KINDS = ["DOCTOR", "RADIOLOGY", "PHARMACY", "LAB"] as const;
export type ReferralKind = (typeof REFERRAL_KINDS)[number];

export const referralKindSchema = z.enum(REFERRAL_KINDS, { message: "نوع النموذج غير صالح" });

/** The prefix printed on the paper, per document. */
const PREFIX: Record<ReferralKind, string> = {
  DOCTOR: "REF",
  RADIOLOGY: "RAD",
  PHARMACY: "RX",
  LAB: "LAB",
};

export const REFERRAL_KIND_LABELS: Record<ReferralKind, string> = {
  DOCTOR: "إحالة حالة مريض",
  RADIOLOGY: "طلب أشعة",
  PHARMACY: "وصفة طبية",
  LAB: "طلب تحاليل",
};

/**
 * The number on the form — `RAD-2024-05120`.
 *
 * Derived from the database sequence rather than stored, so there is one source
 * of truth and no second write after the insert. The sequence is allocated by
 * Postgres, so two referrals created at the same instant cannot collide — which
 * a `count() + 1` would not guarantee.
 */
export function referralNumber(kind: ReferralKind, seq: number, createdAt: Date): string {
  return `${PREFIX[kind]}-${createdAt.getUTCFullYear()}-${String(seq).padStart(5, "0")}`;
}

/** `PNT-2024-00125` — the patient number printed on every document. */
export function patientNumber(seq: number, createdAt: Date): string {
  return `PNT-${createdAt.getUTCFullYear()}-${String(seq).padStart(5, "0")}`;
}

/** Whole years, the way the form prints "٢٨ سنة". */
export function ageFrom(dateOfBirth: Date | null | undefined, at: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

/** "صالحة لمدة 30 يوماً من تاريخ الإصدار" — printed on the prescription and the referral. */
export const REFERRAL_VALIDITY_DAYS = 30;

export function referralExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFERRAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/** The same window on a standalone `Prescription`, which prints it too. */
export const PRESCRIPTION_VALIDITY_DAYS = REFERRAL_VALIDITY_DAYS;

export function prescriptionExpiry(from: Date = new Date()): Date {
  return referralExpiry(from);
}

/* ------------------------------- RAD — أشعة ------------------------------- */

/**
 * The exam menu, exactly as the form groups it.
 *
 * A closed vocabulary rather than free text: the imaging centre schedules a
 * different machine for each, and "سونار بطن" typed four different ways cannot
 * be scheduled, counted, or priced.
 */
export const RADIOLOGY_EXAMS = {
  XRAY: ["chest", "bone", "opg", "other"],
  ULTRASOUND: ["abdomen_pelvis", "thyroid", "breast", "doppler", "other"],
  CT: ["brain", "chest", "abdomen", "pelvis", "other"],
  PET_CT: ["pet_ct", "other"],
} as const;

export const RADIOLOGY_EXAM_LABELS: Record<string, string> = {
  "XRAY:chest": "أشعة صدر",
  "XRAY:bone": "أشعة عظام",
  "XRAY:opg": "أشعة أسنان OPG",
  "XRAY:other": "أشعة عادية — أخرى",
  "ULTRASOUND:abdomen_pelvis": "سونار البطن والحوض",
  "ULTRASOUND:thyroid": "سونار الغدة الدرقية",
  "ULTRASOUND:breast": "سونار الثدي",
  "ULTRASOUND:doppler": "سونار دوبلر",
  "ULTRASOUND:other": "سونار — أخرى",
  "CT:brain": "مقطعية على الدماغ",
  "CT:chest": "مقطعية على الصدر",
  "CT:abdomen": "مقطعية على البطن",
  "CT:pelvis": "مقطعية للحوض",
  "CT:other": "مقطعية — أخرى",
  "PET_CT:pet_ct": "PET-CT",
  "PET_CT:other": "PET-CT — أخرى",
};

const examCode = z
  .string()
  .refine((v) => v in RADIOLOGY_EXAM_LABELS, { message: "نوع فحص غير معروف" });

/**
 * الأشعة — the safety half is the point.
 *
 * `contrastAllergy`, `possiblePregnancy` and `metalImplant` are required
 * booleans, not optional flags. An imaging centre needs a stated NO, and an
 * absent field reads as "nobody asked" — which for a metal implant and an MRI
 * scanner is the difference between a scan and an injury. Making them
 * `.optional()` would let a form submit silence and look complete.
 */
export const radiologyClinicalSchema = z
  .object({
    examTypes: z.array(examCode).min(1, { message: "اختر نوع فحص واحداً على الأقل" }).max(10),
    /** "أخرى ..............." on the form. */
    examOther: z.string().trim().max(160).optional(),

    contrastAllergy: z.boolean({ message: "أجب عن الحساسية من الصبغة" }),
    possiblePregnancy: z.boolean({ message: "أجب عن احتمال الحمل" }),
    metalImplant: z.boolean({ message: "أجب عن وجود جهاز معدني" }),
    otherSafetyNotes: z.string().trim().max(500).optional(),

    /** ملاحظات لطبيب الأشعة، وتعليمات للمريض. */
    radiologistNotes: z.string().trim().max(1000).optional(),
    patientInstructions: z.string().trim().max(1000).optional(),
  })
  .strict();

/* ------------------------------- RX — وصفة -------------------------------- */

export const MEDICATION_FORMS = [
  "tablet", "capsule", "syrup", "injection", "inhaler", "drops", "cream", "suppository", "other",
] as const;

export const MEDICATION_FORM_LABELS: Record<string, string> = {
  tablet: "أقراص",
  capsule: "كبسولات",
  syrup: "شراب",
  injection: "حقن",
  inhaler: "بخاخ",
  drops: "قطرة",
  cream: "مرهم",
  suppository: "تحاميل",
  other: "أخرى",
};

/**
 * One row of the prescription table.
 *
 * Every column the form prints is required except the notes. The old shape was
 * `z.record(z.string(), z.unknown())` — any object at all — so a prescription
 * with no dose and no duration was accepted, stored, and handed to a pharmacy
 * that then had to phone the doctor to find out what to dispense.
 */
export const medicationSchema = z
  .object({
    /** "Augmentin 1g / أوجمنتين 1 جم" — name and strength together, as written. */
    name: nonEmpty.max(160),
    form: z.enum(MEDICATION_FORMS, { message: "الشكل الدوائي غير صالح" }),
    /** "1 قرص" */
    dose: nonEmpty.max(80),
    /** "كل 12 ساعة" */
    route: nonEmpty.max(120),
    /** "7 أيام" */
    duration: nonEmpty.max(80),
    notes: z.string().trim().max(240).optional(),
  })
  .strict();

export const pharmacyClinicalSchema = z
  .object({
    medications: z
      .array(medicationSchema)
      .min(1, { message: "أضف دواءً واحداً على الأقل" })
      .max(30),
    doctorNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

/* ------------------------------ REF — إحالة ------------------------------- */

/**
 * The clinical summary the form prints as bullet points, with the vitals given
 * their own fields so "130/85" and "96" stay readable and comparable rather
 * than buried in a paragraph.
 */
export const doctorClinicalSchema = z
  .object({
    /** "إحالة تخصص" */
    referralType: z.string().trim().max(80).optional(),
    vitals: z
      .object({
        bloodPressure: z.string().trim().max(20).optional(),
        pulse: z.number().int().min(20).max(300).optional(),
        temperature: z.number().min(30).max(45).optional(),
      })
      .strict()
      .optional(),
    /** الملخص السريري — one line per bullet on the printed form. */
    summary: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
    allergies: z.string().trim().max(300).optional(),
  })
  .strict();

/* ------------------------------- LAB — تحاليل ----------------------------- */

export const labClinicalSchema = z
  .object({
    tests: z.array(nonEmpty.max(120)).min(1, { message: "اختر فحصاً واحداً على الأقل" }).max(30),
    /** الصيام مطلوب — the instruction a lab must give the patient. */
    fastingRequired: z.boolean().optional(),
    clinicalNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

/* -------------------------------- dispatch -------------------------------- */

const BY_KIND = {
  DOCTOR: doctorClinicalSchema,
  RADIOLOGY: radiologyClinicalSchema,
  PHARMACY: pharmacyClinicalSchema,
  LAB: labClinicalSchema,
} as const;

export type ClinicalFor<K extends ReferralKind> = z.infer<(typeof BY_KIND)[K]>;

/** The schema this document's `clinical` payload must satisfy. */
export function clinicalSchemaFor(kind: ReferralKind) {
  return BY_KIND[kind];
}

/**
 * Read a stored `clinical` payload back out.
 *
 * Returns `{}` rather than throwing when a row predates its schema: one
 * malformed record must not break a whole list. The routes validate on write,
 * so this is the reader's safety net, not its guarantee.
 */
export function parseClinical(kind: ReferralKind, value: Prisma.JsonValue | null | undefined) {
  const result = clinicalSchemaFor(kind).safeParse(value ?? {});
  return result.success ? result.data : {};
}

/**
 * Which partner types may receive each document.
 *
 * A prescription goes to a pharmacy, not to a radiology centre. Without this
 * the recipient picker offers every member of the complex for every form, and
 * the wrong one silently accepts it.
 *
 * `DOCTOR` is the GENERAL case and is deliberately open. The client titles that
 * form "إحالة بين الأطباء" because their example is doctor to doctor, but the
 * requirement is broader — "ابو المختبر ارسال حالة مريض عن طريق فورم كذلك ابو
 * صيدلية" — a lab or a pharmacy hands a patient's case to whichever colleague
 * should see it next. Restricting it to doctors broke exactly that chain.
 *
 * The other three are requests for a specific procedure, so each has exactly
 * one kind of provider that can perform it.
 */
const ANY_PROVIDER = ["DOCTOR", "LAB", "PHARMACY", "RADIOLOGY", "NURSE", "COMPLEX"] as const;

export const KIND_RECIPIENTS: Record<ReferralKind, readonly string[]> = {
  DOCTOR: ANY_PROVIDER,
  RADIOLOGY: ["RADIOLOGY"],
  PHARMACY: ["PHARMACY"],
  LAB: ["LAB"],
};

/** The service each document maps to, so pricing and dispatch agree with it. */
export const KIND_SERVICE: Record<ReferralKind, string | null> = {
  DOCTOR: "IN_PERSON_CONSULT",
  RADIOLOGY: "RADIOLOGY",
  PHARMACY: "PHARMACY_DISPENSE",
  LAB: "LAB_TEST",
};
