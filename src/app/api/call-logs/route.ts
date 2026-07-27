import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, parseBody } from "@/lib/validation";

// `callerId` is deliberately absent — it is the verified caller, never a
// client-supplied id. `.strict()` makes an unknown key a 400.
const createCallLogSchema = z
  .object({
    orderId: nonEmpty.optional(),
    receiverId: z
      .string({ message: "المستقبل مطلوب" })
      .trim()
      .min(1, { message: "المستقبل مطلوب" }),
    receiverType: z
      .string({ message: "نوع المستقبل مطلوب" })
      .trim()
      .min(1, { message: "نوع المستقبل مطلوب" }),
    duration: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .strict();

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
  const input = await parseBody(req, createCallLogSchema);

  const data = await prisma.callLog.create({
    data: {
      orderId: input.orderId ?? null,
      callerId: identity.userId,
      receiverId: input.receiverId,
      receiverType: input.receiverType,
      duration: input.duration ?? null,
      notes: input.notes ?? null,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
