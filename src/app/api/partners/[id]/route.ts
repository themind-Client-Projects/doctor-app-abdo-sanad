import { NextResponse } from "next/server";
import type { PartnerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const PARTNER_STATUSES: readonly PartnerStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "PENDING",
  "PAUSED",
];

// GET /api/partners/[id] — dispatch (OPERATIONS) reads partner detail.
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, image: true } },
      governorate: true,
      complex: true,
      contract: { include: { commissionRules: true } },
      serviceConfigs: true,
      wallet: true,
      debts: true,
      invoices: true,
    },
  });
  if (!partner) return NextResponse.json({ error: "الشريك غير موجود" }, { status: 404 });
  return NextResponse.json({ data: partner });
});

// PATCH /api/partners/[id]
// The body used to be spread into prisma.partner.update — `rating`, `totalTasks`
// and `userId` were all client-writable. Allow-list only the editable profile
// fields; rating/totalTasks are derived and must not be set over the wire.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { name, phone, email, governorateId, address, status, isSanadLinked, complexId } = body;

  if (status !== undefined && !PARTNER_STATUSES.includes(status as PartnerStatus)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const partner = await prisma.partner.update({
    where: { id },
    data: {
      name: typeof name === "string" ? name : undefined,
      phone: typeof phone === "string" ? phone : undefined,
      email: typeof email === "string" ? email : undefined,
      governorateId: typeof governorateId === "string" ? governorateId : undefined,
      address: typeof address === "string" ? address : undefined,
      status: status === undefined ? undefined : (status as PartnerStatus),
      isSanadLinked: typeof isSanadLinked === "boolean" ? isSanadLinked : undefined,
      complexId: typeof complexId === "string" ? complexId : undefined,
    },
  });

  return NextResponse.json({ data: partner });
});

// DELETE /api/partners/[id]
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.partner.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
