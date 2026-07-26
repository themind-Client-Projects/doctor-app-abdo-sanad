import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async () => {
  const data = await prisma.medicalComplex.findMany({
    include: {
      departments: true,
      partners: { select: { id: true, name: true, type: true } },
    },
  });
  return NextResponse.json({ data });
});

// POST /api/complexes — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { partnerId, name } = body;
  if (typeof partnerId !== "string" || typeof name !== "string" || name.length === 0) {
    return NextResponse.json({ error: "الشريك والاسم مطلوبان" }, { status: 400 });
  }

  const data = await prisma.medicalComplex.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: { partnerId, name },
  });
  return NextResponse.json({ data }, { status: 201 });
});
