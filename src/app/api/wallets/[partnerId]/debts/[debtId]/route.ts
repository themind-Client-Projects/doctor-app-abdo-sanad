import { z } from "zod";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { PartnerWalletError, debtState, settleDebt } from "@/server/services/partner-wallet";

type Ctx = { params: Promise<{ partnerId: string; debtId: string }> };

/**
 * PATCH /api/wallets/[partnerId]/debts/[debtId] — settle a debt.
 *
 * Two ways a partner pays: outside the platform (cash, bank transfer), which
 * only needs recording, or out of the balance the platform already holds for
 * them. `fromWallet` is the second, and moves the money in the same
 * transaction that closes the debt — see `settleDebt`.
 *
 * Only `status: "paid"` is accepted. A debt is closed, never reopened: that
 * would let a settled amount be charged twice with no record of why.
 */
const settleSchema = z
  .object({
    status: z.literal("paid", { message: "الإجراء الوحيد المتاح هو التسديد" }),
    fromWallet: z.boolean().default(false),
  })
  .strict();

export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { partnerId, debtId } = await params;
  const input = await parseBody(req, settleSchema);

  try {
    const debt = await settleDebt({
      debtId,
      partnerId,
      fromWallet: input.fromWallet,
      adminId: identity.userId,
    });
    return ok({ ...debt, state: debtState(debt) }, { requestId });
  } catch (error) {
    if (error instanceof PartnerWalletError) {
      if (error.code === "NOT_FOUND" || error.code === "NO_WALLET") {
        return fail(ErrorCode.NOT_FOUND, 404, error.message, { requestId });
      }
      return fail(
        error.code === "ALREADY_SETTLED" ? ErrorCode.INVALID_STATE_TRANSITION : ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        error.message,
        { requestId }
      );
    }
    throw error;
  }
});
