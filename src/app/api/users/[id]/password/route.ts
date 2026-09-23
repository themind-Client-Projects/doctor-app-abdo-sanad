import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import {
  canHavePassword,
  endSessions,
  hashPassword,
  passwordSchema,
} from "@/server/services/user-admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/users/[id]/password — set or reset a password.
 *
 * The gap this closes: an account created from the dashboard could not sign in.
 * The password grant needs a hash, `PATCH /api/users/[id]` deliberately refuses
 * to write one, and the only other way to set it was `scripts/set-password.ts`
 * — a command run on the server. So every new doctor, lab or operations login
 * needed a developer.
 *
 * Its own endpoint, like the role change: a credential change must not ride
 * along in the same request that edits a name, needs its own audit entry, and
 * must end every session the old password opened.
 *
 * TWO callers, with different rules:
 *
 *  - **An administrator resetting somebody's password.** No current password —
 *    a reset exists precisely because nobody has the old one. The owner types
 *    the new password and hands it over; nothing here emails or texts it,
 *    because no delivery channel for staff exists yet and sending a password
 *    over an unconfigured channel would silently lose it.
 *
 *  - **Anyone changing their OWN.** This was ADMIN-only, so a doctor, lab or
 *    pharmacy whose password had been handed to them by the platform could
 *    never change it — not even after it had been read aloud over the phone.
 *    Self-service requires `currentPassword`: without it, a borrowed
 *    unattended session would be enough to take an account over permanently.
 */
const setPasswordSchema = z
  .object({
    password: passwordSchema,
    /** Required when changing your own; rejected on an administrator's reset. */
    currentPassword: z.string().min(1).max(72).optional(),
  })
  .strict();

// `ROLES.STAFF`, narrowed inside: anyone but a patient may reach this route,
// and a non-admin may only ever act on themselves.
export const POST = withAuth<Ctx>({ roles: ROLES.STAFF }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { password, currentPassword } = await parseBody(req, setPasswordSchema);

  const isSelf = id === identity.userId;
  if (!isSelf && !isPlatformRole(identity.role)) {
    return fail(ErrorCode.FORBIDDEN, 403, "يمكنك تغيير كلمة مرورك أنت فقط", { requestId });
  }

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, passwordHash: true },
  });
  if (!target) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });

  if (!canHavePassword(target.role)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "المرضى يدخلون برمز الهاتف أو Google — لا تُعيَّن لهم كلمة مرور",
      { requestId }
    );
  }

  // Proving you know the current one is what separates "I am changing my
  // password" from "I found this screen open". An administrator resetting
  // someone else's is exempt by definition — nobody has the old one.
  //
  // An account with no hash yet has nothing to prove, so a first password is
  // set without one; that account cannot have been signed into by password.
  if (isSelf && !isPlatformRole(identity.role) && target.passwordHash) {
    if (!currentPassword) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "أدخل كلمة المرور الحالية", {
        requestId,
        details: [
          { field: "currentPassword", code: "required", message: "أدخل كلمة المرور الحالية" },
        ],
      });
    }
    const matches = await bcrypt.compare(currentPassword, target.passwordHash);
    if (!matches) {
      return fail(ErrorCode.FORBIDDEN, 403, "كلمة المرور الحالية غير صحيحة", { requestId });
    }
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        // Never the password, never the hash — only that it changed.
        action: target.id === identity.userId ? "تغيير كلمة المرور" : "إعادة تعيين كلمة مرور",
        entityType: "user",
        entityId: id,
      },
    }),
  ]);

  // A reset is usually a response to "someone else knows this password", so
  // every session the old one opened ends now — including the caller's own
  // mobile sessions when they reset their own.
  const revoked = await endSessions(id);

  return ok({ message: "تم تعيين كلمة المرور", sessionsEnded: revoked }, { requestId });
});
