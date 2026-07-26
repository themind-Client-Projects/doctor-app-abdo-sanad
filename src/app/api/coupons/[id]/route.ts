import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

const date = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// PUT /api/coupons/[id] — the body used to be spread into update, so a caller
// could reset `usedCount` and revive an exhausted coupon.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { code, discountType, discountValue, maxUses, isActive } = body;

  if (
    discountType !== undefined &&
    (typeof discountType !== "string" ||
      !DISCOUNT_TYPES.includes(discountType as (typeof DISCOUNT_TYPES)[number]))
  ) {
    return NextResponse.json({ error: "نوع الخصم غير صالح" }, { status: 400 });
  }
  if (
    discountValue !== undefined &&
    (typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue < 0)
  ) {
    return NextResponse.json({ error: "قيمة الخصم غير صالحة" }, { status: 400 });
  }
  if (body.expiresAt !== undefined && !date(body.expiresAt)) {
    return NextResponse.json({ error: "تاريخ الانتهاء غير صالح" }, { status: 400 });
  }

  const data = await prisma.coupon.update({
    where: { id },
    // Explicit allow-list — `usedCount` is server-owned and not writable here.
    data: {
      code: typeof code === "string" ? code : undefined,
      discountType: typeof discountType === "string" ? discountType : undefined,
      discountValue: typeof discountValue === "number" ? discountValue : undefined,
      expiresAt: date(body.expiresAt),
      maxUses:
        typeof maxUses === "number" && Number.isInteger(maxUses) && maxUses >= 0
          ? maxUses
          : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
