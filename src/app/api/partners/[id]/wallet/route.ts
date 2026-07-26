import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.wallet.findUnique({
    where: { partnerId: id },
    include: { transactions: { take: 20, orderBy: { createdAt: "desc" } } },
  });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ data });
});
