import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const price = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

// PUT /api/pricing/[id] — the body used to be spread straight into update.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  for (const key of ["basePrice", "sanadPrice", "complexPrice", "discountPercent"] as const) {
    if (body[key] !== undefined && body[key] !== null && price(body[key]) === undefined) {
      return NextResponse.json({ error: "سعر غير صالح" }, { status: 400 });
    }
  }

  const data = await prisma.priceConfig.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      serviceType: typeof body.serviceType === "string" ? body.serviceType : undefined,
      basePrice: price(body.basePrice),
      sanadPrice: body.sanadPrice === null ? null : price(body.sanadPrice),
      complexPrice: body.complexPrice === null ? null : price(body.complexPrice),
      discountPercent: body.discountPercent === null ? null : price(body.discountPercent),
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.priceConfig.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
