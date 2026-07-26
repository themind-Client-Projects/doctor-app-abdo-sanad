import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const price = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.priceConfig.findMany();
  return NextResponse.json({ data });
});

// POST /api/pricing — the body used to be spread into create, so prices were
// written with no type checking at all.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { serviceType, isActive } = body;
  const basePrice = price(body.basePrice);

  if (typeof serviceType !== "string" || serviceType.length === 0) {
    return NextResponse.json({ error: "نوع الخدمة مطلوب" }, { status: 400 });
  }
  if (basePrice === undefined) {
    return NextResponse.json({ error: "السعر الأساسي غير صالح" }, { status: 400 });
  }

  const data = await prisma.priceConfig.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      serviceType,
      basePrice,
      sanadPrice: price(body.sanadPrice) ?? null,
      complexPrice: price(body.complexPrice) ?? null,
      discountPercent: price(body.discountPercent) ?? null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
