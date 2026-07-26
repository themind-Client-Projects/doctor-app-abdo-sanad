import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// GET /api/wallets — All partner wallets (admin view, req L239-246)
export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const wallets = await prisma.wallet.findMany({
    include: { partner: { select: { name: true, type: true } } },
    orderBy: { balance: "desc" },
  });
  return NextResponse.json({ data: wallets });
});
