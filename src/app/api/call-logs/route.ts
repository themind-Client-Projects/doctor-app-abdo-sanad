import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, parseBody, parseQuery } from "@/lib/validation";

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

// `limit` alone could only ever return the newest N calls — there was no way to
// reach call N+1. `cursor` walks the whole log.
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/call-logs — Recent calls (req L421-431)
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const keyset = keysetArgs(cursor, limit);

  // No pre-existing filter on this list, so the cursor predicate — which
  // `keysetArgs` puts in `where` — is the whole clause.
  const rows = await prisma.callLog.findMany({
    ...keyset,
    include: {
      caller: { select: { name: true } },
      receiver: { select: { name: true } },
    },
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/call-logs — Log a call.
//
// The body used to be spread straight into prisma.callLog.create, so the caller
// id was whatever the client claimed. It is now the verified session user.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createCallLogSchema);

  // `receiverId` is a foreign key and was written straight through, so a stale
  // or mistyped id surfaced as a Prisma constraint error — a 500 for what is
  // plainly a bad request.
  const receiver = await prisma.user.findUnique({
    where: { id: input.receiverId },
    select: { id: true },
  });
  if (!receiver) {
    return fail(ErrorCode.NOT_FOUND, 404, "المستقبل غير موجود", { requestId });
  }

  if (input.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true },
    });
    if (!order) {
      return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
    }
  }

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

  return ok(data, { status: 201, requestId });
});
