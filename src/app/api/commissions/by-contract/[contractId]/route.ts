import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ contractId: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { contractId } = await params;
  const data = await prisma.commissionRule.findMany({ where: { contractId } });
  return NextResponse.json({ data });
});
