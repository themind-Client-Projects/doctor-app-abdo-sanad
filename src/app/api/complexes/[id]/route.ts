import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.medicalComplex.findUnique({
    where: { id },
    include: {
      departments: true,
      partners: { include: { user: { select: { name: true } } } },
    },
  });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ data });
});

// PATCH — the body used to be spread into update, so `partnerId` (the complex
// owner) was rewritable by anyone. Only the name is editable here.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = body && typeof body === "object" ? body.name : undefined;

  if (typeof name !== "string" || name.length === 0) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }

  const data = await prisma.medicalComplex.update({ where: { id }, data: { name } });
  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.medicalComplex.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
