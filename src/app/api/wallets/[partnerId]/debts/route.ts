import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ partnerId: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { partnerId } = await params;
  const data = await prisma.debt.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data });
});
