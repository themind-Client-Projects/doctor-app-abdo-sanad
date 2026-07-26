import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

const date = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// PUT /api/campaigns/[id] — the body used to be spread straight into update.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { name, description, discountType, discountValue, targetServices, isActive } = body;

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
  if (
    (body.startDate !== undefined && !date(body.startDate)) ||
    (body.endDate !== undefined && !date(body.endDate))
  ) {
    return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
  }

  const data = await prisma.campaign.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: typeof name === "string" ? name : undefined,
      description: typeof description === "string" ? description : undefined,
      discountType: typeof discountType === "string" ? discountType : undefined,
      discountValue: typeof discountValue === "number" ? discountValue : undefined,
      startDate: date(body.startDate),
      endDate: date(body.endDate),
      targetServices:
        targetServices === undefined || targetServices === null
          ? undefined
          : (targetServices as Prisma.InputJsonValue),
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
