import { z } from "zod";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { MembershipError, terminateMembership } from "@/server/services/membership";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/memberships/[id]/terminate — end a membership now, optionally with
 * money back to the patient's wallet.
 *
 * A POST to a named action rather than a DELETE: nothing is removed. The row
 * stays as the record of what was sold, and the refund — when there is one —
 * is a second, audited movement of money that a DELETE would hide.
 *
 * The reason is required. Ending someone's paid membership is exactly the
 * decision a later dispute asks "why?" about.
 */
const terminateSchema = z
  .object({
    reason: z.string().trim().min(3, { message: "اذكر سبب الإنهاء" }).max(300),
    refundAmount: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const input = await parseBody(req, terminateSchema);

  try {
    const result = await terminateMembership({
      membershipId: id,
      adminId: identity.userId,
      reason: input.reason,
      refundAmount: input.refundAmount,
    });
    return ok(
      {
        membership: result.membership,
        refunded: result.refunded,
        message: result.refunded.gt(0) ? "تم إنهاء العضوية وإعادة المبلغ إلى المحفظة" : "تم إنهاء العضوية",
      },
      { requestId }
    );
  } catch (error) {
    if (error instanceof MembershipError) {
      return fail(
        error.code === "PLAN_NOT_FOUND" ? ErrorCode.NOT_FOUND : ErrorCode.BUSINESS_RULE_VIOLATION,
        error.code === "PLAN_NOT_FOUND" ? 404 : 422,
        error.message,
        { requestId }
      );
    }
    throw error;
  }
});
