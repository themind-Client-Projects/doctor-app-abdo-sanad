import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const partnerStatus = z.enum(["ACTIVE", "SUSPENDED", "PENDING", "PAUSED"], {
  message: "حالة غير صالحة",
});

// `rating`, `totalTasks` and `userId` are derived/immutable here and are
// deliberately absent — `.strict()` makes an attempt to set them a 400.
const updatePartnerSchema = z
  .object({
    name: nonEmpty.optional(),
    phone: nonEmpty.optional(),
    email: nonEmpty.optional(),
    governorateId: nonEmpty.optional(),
    address: nonEmpty.optional(),
    status: partnerStatus.optional(),
    isSanadLinked: z.boolean().optional(),
    complexId: nonEmpty.optional(),
  })
  .strict();

// GET /api/partners/[id] — dispatch (OPERATIONS) reads partner detail.
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, image: true } },
      governorate: true,
      complex: true,
      contract: { include: { commissionRules: true } },
      serviceConfigs: true,
      wallet: true,
      debts: true,
      invoices: true,
    },
  });
  if (!partner) return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير موجود", { requestId });
  return ok(partner, { requestId });
});

// PATCH /api/partners/[id]
// The body used to be spread into prisma.partner.update — `rating`, `totalTasks`
// and `userId` were all client-writable. Allow-list only the editable profile
// fields; rating/totalTasks are derived and must not be set over the wire.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updatePartnerSchema);

  const partner = await prisma.partner.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      governorateId: input.governorateId,
      address: input.address,
      status: input.status,
      isSanadLinked: input.isSanadLinked,
      complexId: input.complexId,
    },
  });

  return ok(partner, { requestId });
});

/**
 * DELETE /api/partners/[id] — retire a partner.
 *
 * A soft delete, because a hard one destroys history. `Order.assignedNurseId`
 * and its five siblings are optional FKs, so Prisma's default action on delete
 * is SET NULL: removing a nurse would silently blank out who performed every
 * visit they ever made, and the settlement rows would point at a party that no
 * longer exists. `Partner.deletedAt` is in the schema for exactly this, and the
 * list endpoint filters on it, so a retired partner disappears from every
 * picker while every order still names who served it.
 */
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      userId: true,
      deletedAt: true,
      wallet: { select: { balance: true, pendingAmount: true } },
    },
  });
  if (!partner || partner.deletedAt) {
    return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير موجود", { requestId });
  }

  // Retiring a partner who is still owed money would strand the balance: there
  // is no screen that lists retired partners to pay them from.
  const owed = Number(partner.wallet?.balance ?? 0) + Number(partner.wallet?.pendingAmount ?? 0);
  if (owed > 0) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "لا يمكن إيقاف شريك له رصيد أو مستحقات — سوِّ الحساب أولاً",
      { requestId }
    );
  }

  await prisma.$transaction([
    prisma.partner.update({
      where: { id },
      data: { deletedAt: new Date(), status: "SUSPENDED" },
    }),
    // Retiring the partner without disabling the login leaves a working
    // account for a provider the platform no longer works with.
    prisma.user.update({ where: { id: partner.userId }, data: { isActive: false } }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `إيقاف الشريك: ${partner.name}`,
        entityType: "partner",
        entityId: id,
      },
    }),
  ]);

  return ok({ message: "تم إيقاف الشريك" }, { requestId });
});
