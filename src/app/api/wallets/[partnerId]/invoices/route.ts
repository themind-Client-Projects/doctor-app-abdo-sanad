import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ partnerId: string }> };

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/wallets/[partnerId]/invoices — was unbounded: one row per invoice
// ever raised against the partner, growing without limit.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.invoice.findMany({
    // The partner filter is ANDed with the cursor predicate, never replaced by
    // it — overwriting `where` here would return every partner's invoices.
    where: { AND: [{ partnerId }, keyset.where ?? {}] },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});
