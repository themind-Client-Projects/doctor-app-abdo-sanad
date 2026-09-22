import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { dateish, parseBody, parseQuery } from "@/lib/validation";
import { PartnerWalletError, debtState, recordDebt } from "@/server/services/partner-wallet";

type Ctx = { params: Promise<{ partnerId: string }> };

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Money a partner owes the platform — a penalty, an advance, a correction.
 *
 * The owner's wallets screen promised "الديون" and read this table, but nothing
 * anywhere ever wrote to it: the list could only ever be empty. POST is the
 * first path that creates a debt.
 */
const createDebtSchema = z
  .object({
    amount: z.number().finite().positive({ message: "المبلغ أكبر من صفر" }),
    reason: z.string().trim().min(3, { message: "اذكر سبب الدين" }).max(200),
    dueDate: dateish,
  })
  .strict();

// GET /api/wallets/[partnerId]/debts — was unbounded: debts are kept after they
// are settled, so a long-lived partner's history returned in full every time.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const { cursor, limit } = parseQuery(req.nextUrl.searchParams, listQuerySchema);
  const keyset = keysetArgs(cursor, limit);
  const now = new Date();

  const rows = await prisma.debt.findMany({
    // The partner filter is ANDed with the cursor predicate, never replaced by
    // it — overwriting `where` here would return every partner's debts.
    where: { AND: [{ partnerId }, keyset.where ?? {}] },
    orderBy: keyset.orderBy,
    take: keyset.take,
  });

  const { items, page } = toPage(rows, limit);
  // "overdue" is derived from the due date on every read. Stored, it would
  // need a job to flip it and would be wrong in the meantime.
  return okList(
    items.map((d) => ({ ...d, state: debtState(d, now) })),
    page,
    { requestId }
  );
});

// POST /api/wallets/[partnerId]/debts
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId } = await params;
  const input = await parseBody(req, createDebtSchema);

  try {
    const debt = await recordDebt({
      partnerId,
      amount: input.amount,
      reason: input.reason,
      dueDate: input.dueDate,
      adminId: identity.userId,
    });
    return ok({ ...debt, state: debtState(debt) }, { status: 201, requestId });
  } catch (error) {
    if (error instanceof PartnerWalletError) {
      return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
    }
    throw error;
  }
});
