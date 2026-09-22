import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revokeAllForUser } from "@/lib/tokens";

/**
 * The owner's control over accounts — the rules, in one place.
 *
 * Four endpoints change an account's standing: create, edit, delete, and reset
 * password. Each of them can lock an organisation out of its own platform if it
 * gets one rule wrong, so the rules live here rather than being re-derived per
 * route. The role endpoint already enforced two of them; the others did not,
 * which meant an admin could not demote themselves but could quite happily
 * deactivate themselves.
 */

/** Same cost as `scripts/set-password.ts`, so both paths produce equal hashes. */
const BCRYPT_ROUNDS = 12;

/**
 * Roles that sign in with a password.
 *
 * PATIENT is absent on purpose. Patients sign in by phone OTP or Google, and the
 * password grant does not check role — so giving a patient a password would open
 * a second, unthrottled-by-design door onto an account the product never meant
 * to have one.
 */
export const PASSWORD_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "LAB",
  "PHARMACY",
  "NURSE",
  "DRIVER",
  "RADIOLOGY",
];

export const canHavePassword = (role: UserRole) => PASSWORD_ROLES.includes(role);

/**
 * The password policy, stated once.
 *
 * Length, not composition rules: a long passphrase beats a short string with a
 * digit and a symbol, and composition rules mainly teach people to write
 * `Password1!` on a sticky note. 72 is bcrypt's own ceiling — past it, bytes are
 * silently ignored, so a longer "password" would be a lie about its strength.
 */
export const passwordSchema = z
  .string({ message: "كلمة المرور مطلوبة" })
  .min(10, { message: "كلمة المرور 10 أحرف على الأقل" })
  .max(72, { message: "كلمة المرور 72 حرفاً على الأكثر" });

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export class AccountRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountRuleError";
  }
}

/**
 * May the caller take this account out of service — deactivate or delete it?
 *
 * The two ways an organisation locks itself out: an admin disabling their own
 * account, and the last active SUPER_ADMIN being disabled by anyone. Both are
 * irreversible from inside the app, so both are refused here rather than
 * trusted to the UI hiding a button.
 *
 * @throws {AccountRuleError}
 */
export async function assertMayDisable(
  callerId: string,
  target: { id: string; role: UserRole }
): Promise<void> {
  if (target.id === callerId) {
    throw new AccountRuleError("لا يمكنك إيقاف أو حذف حسابك الخاص");
  }
  if (target.role === "SUPER_ADMIN") {
    const admins = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null },
    });
    if (admins <= 1) {
      throw new AccountRuleError("لا يمكن إيقاف آخر مدير عام في النظام");
    }
  }
}

/**
 * End every live session an account holds.
 *
 * Called on deactivation, deletion and password reset. The refresh endpoint
 * already refuses an inactive user, but only when the app next tries to
 * refresh — up to fifteen minutes later. Revoking here closes that window on
 * the refresh side immediately; the access token already in hand still runs to
 * its own short expiry, which is the stated cost of a stateless token.
 */
export function endSessions(userId: string) {
  return revokeAllForUser(userId);
}
