import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, okList, toPage } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ orderId: string }> };

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/call-logs/[orderId] — Calls logged against one order (req L421-431)
//
// Was unbounded. A long-running or disputed order accumulates calls without
// limit, and each row carries `notes` (@db.Text), so the payload is unbounded
// in bytes as well as in rows.
export const GET = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { orderId } = await params;
    const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
    const keyset = keysetArgs(cursor, limit);

    const rows = await prisma.callLog.findMany({
      // The order filter is ANDed with the cursor predicate, never replaced by
      // it — overwriting `where` here would return every order's call logs.
      where: { AND: [{ orderId }, keyset.where ?? {}] },
      include: {
        caller: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: keyset.orderBy,
      take: keyset.take,
    });

    const { items, page } = toPage(rows, limit);
    return okList(items, page, { requestId });
  }
);
