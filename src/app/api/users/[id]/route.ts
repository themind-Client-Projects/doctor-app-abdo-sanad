import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TX_OPTIONS, prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone";
import {
  AccountRuleError,
  assertMayDisable,
  endSessions,
} from "@/server/services/user-admin";

type Ctx = { params: Promise<{ id: string }> };

// `role` and `password` are deliberately absent: with `.strict()` either key is
// a 400 rather than being silently dropped. Each has its own endpoint, because
// a privilege or credential change must not ride along in the same request that
// edits a phone number.
const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email({ message: "البريد الإلكتروني غير صالح" }).optional(),
    phone: z.string().trim().min(6).optional(),
    isActive: z.boolean().optional(),
    governorateId: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * What the admin sees of an account.
 *
 * An explicit select, never `include` on the whole row: `include` returned
 * `passwordHash` to the browser. Admin-only, but a bcrypt hash has no business
 * leaving the server — it is exactly the input an offline cracker wants.
 */
const DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  image: true,
  governorateId: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  governorate: { select: { id: true, name: true } },
  partner: { select: { id: true, name: true, type: true, status: true } },
} as const satisfies Prisma.UserSelect;

function present<T extends { passwordHash: string | null }>(row: T) {
  const { passwordHash, ...rest } = row;
  return { ...rest, hasPassword: passwordHash !== null };
}

// GET /api/users/[id] — Read a single user.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const data = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: DETAIL_SELECT,
  });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });
  return ok(present(data), { requestId });
});

// PATCH /api/users/[id] — Update a user's profile fields, or switch them off.
//
// The body used to be spread straight into prisma.user.update, so a caller could
// PATCH {"role":"SUPER_ADMIN"} (or overwrite passwordHash) on any account.
// Only the profile fields below are writable here.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateUserSchema);

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });

  // Switching an account OFF is the one edit here that can lock the platform
  // out of itself. The role endpoint already refused a self-demotion; this
  // one used to accept a self-deactivation, which is the same lockout.
  const disabling = input.isActive === false && target.isActive;
  if (disabling) {
    try {
      await assertMayDisable(identity.userId, target);
    } catch (error) {
      if (error instanceof AccountRuleError) {
        return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, { requestId });
      }
      throw error;
    }
  }

  let phone: string | undefined;
  if (input.phone !== undefined) {
    const canonical = normalizePhone(input.phone);
    if (!canonical) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "رقم الهاتف غير صالح", {
        requestId,
        details: [{ field: "phone", code: "invalid", message: "رقم الهاتف غير صالح" }],
      });
    }
    phone = canonical;
  }

  const data = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      // Explicit allow-list — never spread the request body into Prisma.
      data: {
        name: input.name,
        email: input.email,
        phone,
        isActive: input.isActive,
        governorateId: input.governorateId,
      },
      select: DETAIL_SELECT,
    });

    if (input.isActive !== undefined && input.isActive !== target.isActive) {
      await tx.activityLog.create({
        data: {
          userId: identity.userId,
          action: input.isActive ? "تفعيل حساب" : "إيقاف حساب",
          entityType: "user",
          entityId: id,
          details: { isActive: input.isActive },
        },
      });
    }

    return updated;
  }, TX_OPTIONS);

  // After the commit, not inside it: if revocation failed, the account is still
  // switched off and the refresh endpoint refuses an inactive user on its own.
  // Doing it first would leave sessions revoked on an account the update then
  // failed to disable.
  if (disabling) await endSessions(id);

  return ok(present(data), { requestId });
});

// DELETE /api/users/[id] — remove an account from the platform.
//
// A SOFT delete. This was `prisma.user.delete`: every order, appointment,
// prescription and wallet row that names the account either blocked the delete
// on a foreign key — a 500 — or, where the relation cascades, took the
// patient's clinical history with it. The row stays so that history still
// resolves a name; the account itself can no longer sign in or be listed.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, name: true, email: true, phone: true },
  });
  if (!target) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });

  try {
    await assertMayDisable(identity.userId, target);
  } catch (error) {
    if (error instanceof AccountRuleError) {
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, { requestId });
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        // Released so the same person can be registered again. Left in place,
        // a deleted account would hold its phone and email `@unique` forever
        // and the next sign-up with that number would fail as a duplicate.
        email: null,
        phone: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: "حذف حساب",
        entityType: "user",
        entityId: id,
        // What the account was, since the row no longer carries it.
        details: { role: target.role, name: target.name, email: target.email, phone: target.phone },
      },
    }),
  ]);

  await endSessions(id);

  return ok({ message: "تم حذف الحساب" }, { requestId });
});
