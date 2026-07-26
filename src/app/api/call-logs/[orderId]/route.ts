import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ orderId: string }> };

// GET /api/call-logs/[orderId] — Calls logged against one order (req L421-431)
export const GET = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (_req, { params }) => {
    const { orderId } = await params;

    const data = await prisma.callLog.findMany({
      where: { orderId },
      include: {
        caller: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  }
);
