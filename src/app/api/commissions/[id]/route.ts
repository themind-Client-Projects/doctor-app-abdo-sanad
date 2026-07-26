import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const share = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;

// PUT /api/commissions/[id] — update a commission rule.
// The body used to be spread into update, so `contractId` could be repointed at
// another partner's contract and the shares accepted any value.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  for (const key of [
    "partnerShare",
    "complexShare",
    "waridShare",
    "nurseShare",
    "driverShare",
  ] as const) {
    if (body[key] !== undefined && share(body[key]) === undefined) {
      return NextResponse.json({ error: "نسب العمولة غير صالحة" }, { status: 400 });
    }
  }

  const data = await prisma.commissionRule.update({
    where: { id },
    // Explicit allow-list — contractId is not rewritable here.
    data: {
      serviceType: typeof body.serviceType === "string" ? body.serviceType : undefined,
      partnerShare: share(body.partnerShare),
      complexShare: share(body.complexShare),
      waridShare: share(body.waridShare),
      nurseShare: share(body.nurseShare),
      driverShare: share(body.driverShare),
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.commissionRule.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
