import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { dateish, parseBody } from "@/lib/validation";
import { couponCode, discountType, discountValue, percentageCap } from "@/server/services/coupon-rules";

type Ctx = { params: Promise<{ id: string }> };

// `usedCount` is server-owned and deliberately absent, so `.strict()` turns an
// attempt to reset it (and revive an exhausted coupon) into a 400.
const updateCouponSchema = z
  .object({
    code: couponCode.optional(),
    discountType: discountType.optional(),
    discountValue: discountValue.optional(),
    maxUses: z.number().int().nonnegative().optional(),
    expiresAt: dateish.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// GET /api/coupons/[id] — one coupon, with who redeemed it.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { redeemedAt: "desc" },
        take: 50,
        select: { id: true, userId: true, orderId: true, amount: true, redeemedAt: true },
      },
    },
  });
  if (!data) return fail(ErrorCode.NOT_FOUND, 404, "الكوبون غير موجود", { requestId });
  return ok(data, { requestId });
});

// PUT /api/coupons/[id] — the body used to be spread into update, so a caller
// could reset `usedCount` and revive an exhausted coupon.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateCouponSchema);

  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { discountType: true, discountValue: true, usedCount: true },
  });
  if (!existing) return fail(ErrorCode.NOT_FOUND, 404, "الكوبون غير موجود", { requestId });

  // The cap is checked against the MERGED result: changing only the type to
  // PERCENTAGE on a coupon worth 5,000 would otherwise slip a 5000% through.
  const merged = {
    discountType: input.discountType ?? existing.discountType,
    discountValue: input.discountValue ?? Number(existing.discountValue),
  };
  if (!percentageCap(merged)) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, "نسبة الخصم لا تتجاوز 100%", {
      requestId,
      details: [{ field: "discountValue", code: "too_big", message: "نسبة الخصم لا تتجاوز 100%" }],
    });
  }

  // Lowering the cap below uses already made is allowed — it simply closes the
  // coupon — but saying so beats a coupon that "has 3 of 2 uses".
  if (input.maxUses !== undefined && input.maxUses > 0 && input.maxUses < existing.usedCount) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `استُخدم هذا الكوبون ${existing.usedCount} مرة — لا يمكن أن يقلّ الحد الأقصى عن ذلك. لإيقافه أوقف تفعيله`,
      { requestId }
    );
  }

  const data = await prisma.coupon.update({
    where: { id },
    // Explicit allow-list — `usedCount` is server-owned and not writable here.
    data: {
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      isActive: input.isActive,
    },
  });

  return ok(data, { requestId });
});

// DELETE /api/coupons/[id]
//
// A coupon somebody used is DEACTIVATED, not deleted. `CouponRedemption`
// cascades on delete, so removing a used coupon erased the record of who was
// given which discount — while their orders still carry the reduced price. The
// money would be visible with no explanation behind it.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { code: true, usedCount: true, _count: { select: { redemptions: true } } },
  });
  if (!coupon) return fail(ErrorCode.NOT_FOUND, 404, "الكوبون غير موجود", { requestId });

  if (coupon._count.redemptions > 0 || coupon.usedCount > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return ok(
      {
        deactivated: true,
        message: `استُخدم الكوبون ${coupon._count.redemptions} مرة — أُوقف بدل حذفه ليبقى سجل الخصومات`,
      },
      { requestId }
    );
  }

  await prisma.$transaction([
    prisma.coupon.delete({ where: { id } }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `حذف كوبون ${coupon.code}`,
        entityType: "coupon",
        entityId: id,
      },
    }),
  ]);
  return ok({ deactivated: false, message: "تم حذف الكوبون" }, { requestId });
});
