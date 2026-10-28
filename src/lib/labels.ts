import type { ServiceStatus } from "@prisma/client";

/**
 * Arabic display labels for the enums the admin screens render.
 *
 * These were previously redeclared inline in each page — and drifted: the
 * services screen carried a `serviceTypeLabels` map of ten keys
 * (`IN_PERSON`, `X_RAY`, `CT_SCAN`…) that matched **no** member of the
 * `ServiceType` enum, so every row rendered its raw key. One map, imported.
 *
 * Keys mirror prisma/schema.prisma exactly. Adding an enum member without a
 * label here is caught by `Record<Type, string>` at compile time.
 */

export const SERVICE_TYPE_LABELS = {
  IN_PERSON_CONSULT: "استشارة حضورية",
  ONLINE_CONSULT: "استشارة أونلاين",
  HOME_VISIT: "زيارة منزلية",
  HOME_BLOOD_DRAW: "سحب دم منزلي",
  HOME_LAB_TEST: "تحليل منزلي",
  LAB_TEST: "تحاليل مختبرية",
  RADIOLOGY: "أشعة",
  PHARMACY_DISPENSE: "صرف وصفات",
  MEDICINE_DELIVERY: "دواء مع توصيل",
  NURSING: "تمريض",
  PHYSIOTHERAPY: "علاج طبيعي",
  SURGERY: "عمليات",
  BLOOD_BANK: "بنك الدم",
  TAXI: "نقل",
} as const;

export type ServiceTypeKey = keyof typeof SERVICE_TYPE_LABELS;
export const SERVICE_TYPE_KEYS = Object.keys(SERVICE_TYPE_LABELS) as ServiceTypeKey[];

/**
 * `AppointmentType` — how the consultation happens, which is NOT the same axis
 * as `ServiceType`.
 *
 * حجوزاتي labelled every appointment "عيادة" because the card discarded this
 * column, so an ONLINE consultation and a SURGERY read identically to an
 * in-person clinic visit. A patient could set out for a clinic to attend a
 * video call.
 */
export const APPOINTMENT_TYPE_LABELS = {
  IN_PERSON: "حضوري",
  ONLINE: "أونلاين",
  HOME_VISIT: "زيارة منزلية",
  SURGERY: "عملية",
} as const;

export const SERVICE_STATUS_LABELS = {
  ACTIVE: "مفعّلة",
  SUSPENDED: "معلّقة",
  PAUSED: "متوقفة مؤقتاً",
  REACTIVATED: "أُعيد تفعيلها",
} as const;

/**
 * The statuses at which a ServiceConfig is LIVE, and therefore bookable.
 *
 * "إعادة التفعيل" writes REACTIVATED — it never writes ACTIVE back. So a
 * predicate spelled `=== "ACTIVE"` permanently blacklists every service an
 * administrator ever turned back on: the doctor keeps the service switched on,
 * the admin screen says أُعيد تفعيلها, and the directory renders «غير متاح»
 * forever. Two places disagreed about this and the disagreement was visible —
 * the detail route listed a reactivated doctor as available while the list
 * route did not, and the booking gate refused a provider the directory still
 * offered.
 *
 * Prisma accepts the tuple directly in `status: { in: ... }`.
 */
export const LIVE_SERVICE_STATUSES = ["ACTIVE", "REACTIVATED"] as const satisfies readonly ServiceStatus[];

export function isServiceLive(status: string | null | undefined): boolean {
  return status === "ACTIVE" || status === "REACTIVATED";
}

export const PARTNER_STATUS_LABELS = {
  ACTIVE: "نشط",
  SUSPENDED: "معلّق",
  PENDING: "قيد المراجعة",
  PAUSED: "متوقف",
} as const;

export const USER_ROLE_LABELS = {
  SUPER_ADMIN: "مدير عام",
  OPERATIONS: "موظف عمليات",
  DOCTOR: "طبيب",
  LAB: "مختبر",
  PHARMACY: "صيدلية",
  NURSE: "ممرض",
  DRIVER: "سائق",
  RADIOLOGY: "أشعة",
  PATIENT: "مريض",
} as const;

export type UserRoleKey = keyof typeof USER_ROLE_LABELS;
export const USER_ROLE_KEYS = Object.keys(USER_ROLE_LABELS) as UserRoleKey[];

export const PARTNER_TYPE_LABELS = {
  DOCTOR: "طبيب",
  LAB: "مختبر",
  PHARMACY: "صيدلية",
  NURSE: "ممرض",
  DRIVER: "سائق",
  RADIOLOGY: "أشعة",
} as const;

/**
 * The sales channels (`OrderSource`). Names both where an order came from and
 * which storefront a partner sells through — see the enum's doc comment.
 */
export const CHANNEL_LABELS = {
  DIRECT: "خارج سند",
  SANAD: "سند",
  COMPLEX: "عبر مجمع",
} as const;

export type ChannelKey = keyof typeof CHANNEL_LABELS;

/** Invoice / Debt `status` — a free String column, lower-case by convention. */
export const INVOICE_STATUS_LABELS = {
  pending: "قيد الانتظار",
  paid: "مدفوعة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
} as const;

export const TRANSACTION_TYPE_LABELS = {
  CREDIT: "إيداع",
  DEBIT: "سحب",
} as const;

/** `OrderStatus` — the 9 members of the Prisma enum, in lifecycle order. */
export const ORDER_STATUS_LABELS = {
  NEW: "جديد",
  ACCEPTED: "مقبول",
  ASSIGNED: "مُسند",
  IN_TRANSIT: "في الطريق",
  ARRIVED: "وصل",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
  DELAYED: "معلّق",
} as const;

export const ORDER_PRIORITY_LABELS = {
  NORMAL: "عادي",
  URGENT: "عاجل",
  CRITICAL: "حرج",
} as const;

/**
 * The same `Priority` enum, worded as the client's printed forms word it.
 *
 * "عادي / مهم / عاجل" is what the four referral documents show, and it does not
 * match the operations wording above — `URGENT` reads as عاجل on a delivery
 * order and مهم on a prescription. Two maps because they are two vocabularies,
 * both centralised here because the send dialog and the printed sheet must not
 * disagree about what a referral's own priority is called.
 */
export const REFERRAL_PRIORITY_LABELS = {
  NORMAL: "عادي",
  URGENT: "مهم",
  CRITICAL: "عاجل",
} as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: "نقداً",
  CARD: "بطاقة",
  WALLET: "محفظة",
} as const;

/**
 * `PaymentStatus` — whether the money for an order actually arrived.
 *
 * Settlement refuses to pay partners out of an order that is not PAID, so this
 * is the difference between "waiting on the patient" and "waiting on us".
 */
export const PAYMENT_STATUS_LABELS = {
  PENDING: "لم يُحصَّل",
  PAID: "محصَّل",
  FAILED: "فشل التحصيل",
  REFUNDED: "مُعاد",
} as const;

/** `BloodType` — the 8 groups, rendered the way people actually write them. */
export const BLOOD_TYPE_LABELS = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
} as const;

/**
 * Why a patient's wallet moved.
 *
 * Was defined twice — the patient wallet said "إيداع رصيد" while the admin's
 * view of the SAME row said "إيداع". One vocabulary, one place.
 */
export const WALLET_REASON_LABELS = {
  TOPUP: "إيداع رصيد",
  PAYMENT: "دفع رسوم خدمة",
  REFUND: "استرداد مبلغ",
  REWARD: "مكافأة",
} as const;

/** `SettlementParty` — who takes a cut of an order. */
export const SETTLEMENT_PARTY_LABELS = {
  PARTNER: "الشريك",
  COMPLEX: "المجمع",
  NURSE: "الممرض",
  DRIVER: "السائق",
  REFERRER: "المُحيل",
  WARID: "وريد",
} as const;

/** `CallLog.receiverType` — who was called about an order. */
export const CALL_RECEIVER_LABELS = {
  PATIENT: "المريض",
  NURSE: "الممرض",
  DRIVER: "السائق",
  LAB: "المختبر",
  PHARMACY: "الصيدلية",
  RADIOLOGY: "مركز الأشعة",
} as const;

/** Look a label up without throwing on a value the DB has but the map doesn't. */
export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}

/** Options for a `<select>` / `FilterDef`, in declaration order. */
export function optionsOf(map: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
