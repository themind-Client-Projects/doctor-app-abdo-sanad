import { z } from "zod";

/**
 * What a coupon may be — the rules with no I/O.
 *
 * Out of the route file on purpose: routes import `@/lib/api-auth`, which drags
 * in `next-auth`, and these are exactly the rules worth testing exhaustively
 * without an auth runtime. Same split as `referral-rules.ts`.
 */

/**
 * The code as checkout will look it up.
 *
 * `validateCoupon` searches `code.trim().toUpperCase()`. The admin API stored
 * the code exactly as typed, so a coupon created as "save10" could NEVER be
 * redeemed: the owner saw it live, every patient was told "كوبون غير صالح".
 * Normalising on the way in is the only fix that cannot drift — the two sides
 * now agree by construction.
 */
export const couponCode = z
  .string()
  .trim()
  .min(3, { message: "رمز الكوبون 3 أحرف على الأقل" })
  .max(32, { message: "رمز الكوبون 32 حرفاً على الأكثر" })
  .regex(/^[A-Za-z0-9_-]+$/, { message: "رمز الكوبون بأحرف إنجليزية وأرقام فقط" })
  .transform((v) => v.toUpperCase());

export const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

export const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .positive({ message: "قيمة الخصم أكبر من صفر" });

/**
 * A percentage above 100 is refused.
 *
 * `quoteService` already caps any discount at the price, so a 150% coupon
 * could not produce a negative bill — but it would silently mean "free", which
 * is a decision nobody should make by mistyping a number.
 */
export const percentageCap = <T extends { discountType?: string; discountValue?: number }>(v: T) =>
  !(v.discountType === "PERCENTAGE" && (v.discountValue ?? 0) > 100);
