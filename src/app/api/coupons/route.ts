import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

const date = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data });
});

// POST /api/coupons — the body used to be spread into create, so `usedCount`
// could be reset to 0 to make a spent coupon reusable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { code, discountType, discountValue, maxUses, isActive } = body;
  const expiresAt = date(body.expiresAt);

  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "رمز الكوبون مطلوب" }, { status: 400 });
  }
  if (
    typeof discountType !== "string" ||
    !DISCOUNT_TYPES.includes(discountType as (typeof DISCOUNT_TYPES)[number])
  ) {
    return NextResponse.json({ error: "نوع الخصم غير صالح" }, { status: 400 });
  }
  if (typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue < 0) {
    return NextResponse.json({ error: "قيمة الخصم غير صالحة" }, { status: 400 });
  }
  if (!expiresAt) {
    return NextResponse.json({ error: "تاريخ الانتهاء مطلوب" }, { status: 400 });
  }

  const data = await prisma.coupon.create({
    // Explicit allow-list — `usedCount` is server-owned and not writable here.
    data: {
      code,
      discountType,
      discountValue,
      expiresAt,
      maxUses: typeof maxUses === "number" && Number.isInteger(maxUses) && maxUses >= 0 ? maxUses : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
