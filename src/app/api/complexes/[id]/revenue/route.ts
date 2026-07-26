import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// Complex revenue (req L138)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const partners = await prisma.partner.findMany({
    where: { complexId: id },
    select: { wallet: true },
  });
  return NextResponse.json({ data: partners.map((p) => p.wallet) });
});
