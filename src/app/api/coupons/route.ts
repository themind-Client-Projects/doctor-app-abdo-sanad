import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { dateish, parseBody } from "@/lib/validation";

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

// `usedCount` is server-owned and deliberately absent, so `.strict()` turns an
// attempt to reset it (and revive a spent coupon) into a 400.
const createCouponSchema = z
  .object({
    code: z.string().trim().min(1, { message: "رمز الكوبون مطلوب" }),
    discountType,
    discountValue,
    maxUses: z.number().int().nonnegative().default(0),
    expiresAt: dateish,
    isActive: z.boolean().default(true),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data });
});

// POST /api/coupons — the body used to be spread into create, so `usedCount`
// could be reset to 0 to make a spent coupon reusable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createCouponSchema);

  const data = await prisma.coupon.create({
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

  return NextResponse.json({ data }, { status: 201 });
});
