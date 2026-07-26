import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// GET /api/dashboard/recent-activity — Recent activity feed (req L70-76)
export const GET = withAuth({ roles: ROLES.STAFF }, async () => {
  const activities = await prisma.activityLog.findMany({
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ data: activities });
});
