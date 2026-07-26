import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const share = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;

// GET /api/commissions — List commission rules (req L210-230 ⭐)
export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.commissionRule.findMany({
    include: { contract: { select: { partnerId: true } } },
  });
  return NextResponse.json({ data });
});

// POST /api/commissions — Create commission rule.
// The body used to be spread into create with no validation at all, so the
// revenue split (the most critical config in the product) could be written with
// missing or nonsense values.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { contractId, serviceType } = body;
  const partnerShare = share(body.partnerShare);
  const waridShare = share(body.waridShare);

  if (typeof contractId !== "string" || typeof serviceType !== "string") {
    return NextResponse.json({ error: "العقد ونوع الخدمة مطلوبان" }, { status: 400 });
  }
  if (partnerShare === undefined || waridShare === undefined) {
    return NextResponse.json({ error: "نسب العمولة غير صالحة" }, { status: 400 });
  }

  const data = await prisma.commissionRule.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      contractId,
      serviceType,
      partnerShare,
      waridShare,
      complexShare: share(body.complexShare) ?? 0,
      nurseShare: share(body.nurseShare) ?? 0,
      driverShare: share(body.driverShare) ?? 0,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
