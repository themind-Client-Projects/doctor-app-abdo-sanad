import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { amount, parseBody, parseQuery } from "@/lib/validation";
import { PartnerWalletError, recordPartnerTransfer } from "@/server/services/partner-wallet";

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
    description: z.string().trim().max(200).optional(),
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

// POST — pay the partner out (DEBIT) or adjust their balance up (CREDIT).
//
// This was `data: { walletId: wallet.id, ...body }` — the spread came LAST, so a
// client-supplied `walletId` silently overrode the wallet resolved from the
// route param and money could be written to any partner's wallet. That was
// fixed; what remained is that it only INSERTED a Transaction row and never
// moved `Wallet.balance`. A payout appeared in the history while the balance
// still showed the money, and a DEBIT had no guard against paying out more
// than was held. `recordPartnerTransfer` moves both, atomically, and audits it.
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const input = await parseBody(req, createTransferSchema);

  try {
    const result = await recordPartnerTransfer({
      partnerId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      orderId: input.orderId,
      adminId: identity.userId,
    });
    return ok(
      { transaction: result.transaction, balance: result.wallet.balance },
      { status: 201, requestId }
    );
  } catch (error) {
    if (error instanceof PartnerWalletError) {
      if (error.code === "NO_WALLET") {
        return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
      }
      return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, error.message, {
        requestId,
        ...(error.detail
          ? {
              details: [
                { field: "balance", code: "insufficient", message: error.detail.balance },
                { field: "required", code: "insufficient", message: error.detail.required },
              ],
            }
          : {}),
      });
    }
    throw error;
  }
});
