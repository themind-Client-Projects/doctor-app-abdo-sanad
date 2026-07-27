import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `partnerId` (the complex owner) is deliberately absent — only the name is
// editable, and `.strict()` makes any other key a 400.
const updateComplexSchema = z
  .object({
    name: z.string().trim().min(1, { message: "الاسم مطلوب" }),
  })
  .strict();

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
  const { name } = await parseBody(req, updateComplexSchema);

  const data = await prisma.medicalComplex.update({ where: { id }, data: { name } });
  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.medicalComplex.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
