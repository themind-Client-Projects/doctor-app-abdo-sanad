import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { amount, parseBody, parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ partnerId: string }> };

// The old hard `take: 50` becomes the default page size, so the existing client
// sees the same first page — but transaction 51 is now reachable via `cursor`,
// which it previously was not at all.
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// `walletId` is deliberately absent — it is resolved from the route param only.
// `.strict()` turns a client-supplied `walletId` into a 400 instead of letting
// it reach Prisma.
const createTransferSchema = z
  .object({
    amount,
    type: z.enum(["CREDIT", "DEBIT"], { message: "نوع العملية غير صالح" }),
    description: z.string().optional(),
    orderId: z.string().optional(),
  })
  .strict();

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const wallet = await prisma.wallet.findUnique({ where: { partnerId } });
  if (!wallet) return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });

  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.transaction.findMany({
    // The wallet filter is ANDed with the cursor predicate, never replaced by
    // it — overwriting `where` here would return every wallet's transactions.
    where: { AND: [{ walletId: wallet.id }, keyset.where ?? {}] },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST — Record a transaction against this partner's wallet.
//
// This was `data: { walletId: wallet.id, ...body }` — the spread came LAST, so a
// client-supplied `walletId` silently overrode the wallet resolved from the
// route param and money could be written to any partner's wallet. `amount` and
// `type` were also unvalidated (a string amount or an arbitrary `type` went
// straight to the DB). walletId now comes only from the looked-up wallet.
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const input = await parseBody(req, createTransferSchema);

  const wallet = await prisma.wallet.findUnique({ where: { partnerId } });
  if (!wallet) return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });

  const data = await prisma.transaction.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      walletId: wallet.id,
      amount: input.amount,
      type: input.type,
      description: input.description ?? null,
      orderId: input.orderId ?? null,
    },
  });

  return ok(data, { status: 201, requestId });
});
