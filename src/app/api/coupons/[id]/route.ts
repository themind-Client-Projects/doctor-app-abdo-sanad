import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { dateish, nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

// `usedCount` is server-owned and deliberately absent, so `.strict()` turns an
// attempt to reset it (and revive an exhausted coupon) into a 400.
const updateCouponSchema = z
  .object({
    code: nonEmpty.optional(),
    discountType: discountType.optional(),
    discountValue: discountValue.optional(),
    maxUses: z.number().int().nonnegative().optional(),
    expiresAt: dateish.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// PUT /api/coupons/[id] — the body used to be spread into update, so a caller
// could reset `usedCount` and revive an exhausted coupon.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, updateCouponSchema);

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

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  await prisma.coupon.delete({ where: { id } });
  return ok({ message: "تم الحذف" }, { requestId });
});
