import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, isPlatformRole, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * Platform-wide ledger — "سجل التحويلات" (req L243).
 *
 * `Transaction` was only reachable per-wallet via
 * `/api/wallets/[partnerId]/transfers`, so there was no way to see the
 * platform's money movement as one stream. Read-only on purpose: a transaction
 * is written by the settlement engine, never by hand — an admin-authored
 * balance change would break the invariant that every wallet balance is the
 * sum of its transactions.
 */

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  partnerId: z.string().trim().min(1).optional(),
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  /** Inclusive lower bound on `createdAt`. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit, partnerId, type, from, to } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const keyset = keysetArgs(cursor, limit);

  // The keyset predicate is itself a `createdAt` bound, so it has to be ANDed
  // with the date filter rather than merged — two `createdAt` keys in one
  // object would silently drop the first.
  const filters: Prisma.TransactionWhereInput[] = [];

  // Scoped to the caller's own wallet, applied LAST so it overrides any
  // `?partnerId=` the client sends.
  //
  // This was OPERATIONS-only, so a partner could not read the ledger behind
  // their own balance — their finance screen had nothing to show. Opening it to
  // staff is only safe because the scope is enforced here: a partner sees their
  // wallet's rows and no one else's, and a missing partner row matches nothing.
  if (!isPlatformRole(identity.role)) {
    filters.push({ wallet: { partnerId: identity.partnerId ?? "" } });
  } else if (partnerId) {
    filters.push({ wallet: { partnerId } });
  }
  if (type) filters.push({ type });
  if (from || to) {
    filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }
  if (keyset.where) filters.push(keyset.where);

  const rows = await prisma.transaction.findMany({
    where: filters.length ? { AND: filters } : {},
    include: {
      wallet: {
        select: {
          id: true,
          partnerId: true,
          partner: { select: { id: true, name: true, type: true } },
        },
      },
      order: { select: { id: true, orderNumber: true, serviceType: true } },
    },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});
