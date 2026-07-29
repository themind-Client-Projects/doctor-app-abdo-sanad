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
 * The wallet is created on first read rather than at signup, so an account that
 * predates the model still resolves instead of 404ing.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { limit } = parseQuery(req.nextUrl.searchParams, querySchema);

  const wallet = await prisma.patientWallet.upsert({
    where: { userId: identity.userId },
    update: {},
    create: { userId: identity.userId },
    select: { id: true, balance: true },
  });

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
