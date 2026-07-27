import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/wallets — All partner wallets (admin view, req L239-246)
//
// Was unbounded: one row per partner, so the response grew with the platform.
// Ordering moved from `balance desc` to the keyset order `(createdAt, id) desc`
// — a balance-ordered cursor is not stable, because a balance changes between
// pages and the client would see rows twice or not at all.
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const wallets = await prisma.wallet.findMany({
    where: keyset.where ?? {},
    include: { partner: { select: { name: true, type: true } } },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(wallets, limit);
  return okList(items, page, { requestId });
});
