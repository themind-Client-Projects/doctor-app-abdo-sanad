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

export const SERVICE_STATUS_LABELS = {
  ACTIVE: "مفعّلة",
  SUSPENDED: "معلّقة",
  PAUSED: "متوقفة مؤقتاً",
  REACTIVATED: "أُعيد تفعيلها",
} as const;

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

/** Look a label up without throwing on a value the DB has but the map doesn't. */
export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}

/** Options for a `<select>` / `FilterDef`, in declaration order. */
export function optionsOf(map: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
