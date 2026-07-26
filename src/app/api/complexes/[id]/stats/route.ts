import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// Complex stats (req L139)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const [partners, departments] = await Promise.all([
    prisma.partner.count({ where: { complexId: id } }),
    prisma.department.count({ where: { complexId: id } }),
  ]);
  return NextResponse.json({ data: { partners, departments } });
});
