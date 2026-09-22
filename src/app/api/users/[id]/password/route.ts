import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
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
 * POST /api/users/[id]/password — set or reset a staff member's password.
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
 * The owner types the new password and hands it over; nothing here emails or
 * texts it, because no delivery channel for staff exists yet and sending a
 * password over an unconfigured channel would silently lose it.
 */
const setPasswordSchema = z.object({ password: passwordSchema }).strict();

export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { password } = await parseBody(req, setPasswordSchema);

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true },
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
