import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

// GET /api/call-logs — Recent calls (req L421-431)
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50") || 50)
  );

  const data = await prisma.callLog.findMany({
    include: {
      caller: { select: { name: true } },
      receiver: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ data });
});

// POST /api/call-logs — Log a call.
//
// The body used to be spread straight into prisma.callLog.create, so the caller
// id was whatever the client claimed. It is now the verified session user.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req, _ctx, identity) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { receiverId, receiverType } = body;
  if (typeof receiverId !== "string" || !receiverId) {
    return NextResponse.json({ error: "المستقبل مطلوب" }, { status: 400 });
  }
  if (typeof receiverType !== "string" || !receiverType) {
    return NextResponse.json({ error: "نوع المستقبل مطلوب" }, { status: 400 });
  }

  const duration =
    typeof body.duration === "number" && Number.isFinite(body.duration)
      ? Math.max(0, Math.trunc(body.duration))
      : null;

  const data = await prisma.callLog.create({
    data: {
      orderId: typeof body.orderId === "string" && body.orderId ? body.orderId : null,
      callerId: identity.userId,
      receiverId,
      receiverType,
      duration,
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
