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

// GET /api/wallets/[partnerId]/debts — was unbounded: debts are kept after they
// are settled, so a long-lived partner's history returned in full every time.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);

  const rows = await prisma.debt.findMany({
    // The partner filter is ANDed with the cursor predicate, never replaced by
    // it — overwriting `where` here would return every partner's debts.
    where: { AND: [{ partnerId }, keyset.where ?? {}] },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});
