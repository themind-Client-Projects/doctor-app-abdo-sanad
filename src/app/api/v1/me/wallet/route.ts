import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

/**
 * GET /api/v1/me/wallet — the signed-in patient's balance and movements.
 *
 * GLOBAL, not channel-scoped: one balance, spendable inside سند and outside it.
 * That is why `PatientTransaction` carries an optional `orderId` — the order it
 * paid for knows its own `source`, so a movement can be traced back to the
 * storefront that produced it without the wallet itself being split in two.
 *
 * Scoped to `identity.userId` and never to a client-supplied id: this is the
 * exact shape of route where "authenticated" was previously mistaken for
 * "authorised".
 *
 * Read-only, and that is a correctness point rather than a style one: a GET
 * that creates rows meant two simultaneous loads raced to insert the same
 * wallet and the loser returned 409 to a page that was only trying to display
 * a balance. A patient with no wallet yet simply has zero and no movements —
 * the row is created by the first thing that actually puts money in it.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { limit } = parseQuery(req.nextUrl.searchParams, querySchema);

  const wallet = await prisma.patientWallet.findUnique({
    where: { userId: identity.userId },
    select: { id: true, balance: true },
  });

  if (!wallet) return ok({ balance: 0, transactions: [] }, { requestId });

  const transactions = await prisma.patientTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      type: true,
      reason: true,
      description: true,
      createdAt: true,
      // `source` is what makes a single wallet legible across both storefronts.
      order: { select: { id: true, orderNumber: true, serviceType: true, source: true } },
    },
  });

  return ok({ balance: wallet.balance, transactions }, { requestId });
});
