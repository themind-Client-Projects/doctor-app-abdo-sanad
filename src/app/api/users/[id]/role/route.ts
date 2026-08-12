import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Change a user's role — "الصلاحيات والأدوار" (req L264).
 *
 * Its own endpoint on purpose. `PATCH /api/users/[id]` rejects a `role` key
 * outright, because a privilege change must not ride along in the same request
 * that edits a phone number: it needs its own authorisation, its own guards,
 * and its own audit entry.
 */

// `.strict()` like every other write schema here. Nothing but `role` is read,
// so an extra key was never writable — but on the one endpoint that changes
// privileges, a request carrying keys the server ignores should be refused
// rather than half-honoured.
const roleSchema = z
  .object({
    role: z.enum([
      "SUPER_ADMIN",
      "OPERATIONS",
      "DOCTOR",
      "LAB",
      "PHARMACY",
      "NURSE",
      "DRIVER",
      "RADIOLOGY",
      "PATIENT",
    ]),
  })
  .strict();

export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { role } = await parseBody(req, roleSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, email: true, partner: { select: { id: true } } },
  });
  if (!target) return fail(ErrorCode.NOT_FOUND, 404, "المستخدم غير موجود", { requestId });
  if (target.role === role) return ok(target, { requestId });

  // An admin demoting themselves is how an organisation locks itself out of its
  // own platform — and it is irreversible from inside the app.
  if (target.id === identity.userId) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "لا يمكنك تغيير دور حسابك الخاص",
      { requestId }
    );
  }

  // Same failure by a different route: demoting the last remaining admin.
  if (target.role === "SUPER_ADMIN") {
    const admins = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null },
    });
    if (admins <= 1) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        "لا يمكن تغيير دور آخر مدير عام في النظام",
        { requestId }
      );
    }
  }

  // A Partner row carries its own `type` used for dispatch and settlement.
  // Changing the user's role without it would leave a "NURSE" account whose
  // partner record still receives lab orders.
  if (target.partner && role !== "PATIENT" && role !== "SUPER_ADMIN" && role !== "OPERATIONS") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "هذا المستخدم مرتبط بسجل شريك — غيّر نوع الشريك من صفحة الشركاء بدلاً من ذلك",
      { requestId }
    );
  }

  const [data] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
    // A privilege change with no audit trail is the one change you most need
    // an audit trail for.
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `تغيير دور المستخدم من ${target.role} إلى ${role}`,
        entityType: "user",
        entityId: id,
        details: { from: target.role, to: role },
      },
    }),
  ]);

  return ok(data, { requestId });
});
