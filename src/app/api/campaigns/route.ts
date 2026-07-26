import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

const date = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data });
});

// POST /api/campaigns — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { name, description, discountType, discountValue, targetServices, isActive } = body;
  const startDate = date(body.startDate);
  const endDate = date(body.endDate);

  if (typeof name !== "string" || name.length === 0) {
    return NextResponse.json({ error: "اسم الحملة مطلوب" }, { status: 400 });
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
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "تاريخ البداية وتاريخ الانتهاء مطلوبان" },
      { status: 400 }
    );
  }

  const data = await prisma.campaign.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name,
      description: typeof description === "string" ? description : null,
      discountType,
      discountValue,
      startDate,
      endDate,
      targetServices:
        targetServices === undefined || targetServices === null
          ? undefined
          : (targetServices as Prisma.InputJsonValue),
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
