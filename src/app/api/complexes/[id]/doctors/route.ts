import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.partner.findMany({
    where: { complexId: id, type: "DOCTOR" },
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json({ data });
});
