import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";
import {
  InsufficientBalance,
  MembershipError,
  activeMembershipFor,
  purchaseMembership,
} from "@/server/services/membership";

/**
 * عضويتي — the patient's own membership, and buying one.
 *
 * PAYMENT IS THE WALLET. There is no gateway: the admin credits a patient's
 * balance by hand and a membership is bought out of it. So the only failure a
 * client has to handle specially is "not enough money", and it comes back as a
 * 422 carrying the shortfall rather than a bare refusal — "top up 12,000 د.ع"
 * is a different instruction from "that did not work".
 */

const purchaseSchema = z.object({ planId: nonEmpty }).strict();

// GET /api/v1/me/membership — null when the patient holds none.
export const GET = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const membership = await activeMembershipFor(identity.userId);

  // `null` rather than a 404: having no membership is a normal state the
  // subscribe screen is built around, not a missing resource.
  if (!membership) return ok(null, { requestId });

  return ok(
    {
      ...membership,
      entitlements: membership.entitlements.map((entitlement) => ({
        ...entitlement,
        // Computed here so every client agrees on what "متبقٍ" means, including
        // that unlimited has no number.
        remaining: entitlement.quota === null ? null : Math.max(entitlement.quota - entitlement.used, 0),
      })),
      daysRemaining: Math.max(
        Math.ceil((membership.expiresAt.getTime() - Date.now()) / 86_400_000),
        0
      ),
    },
    { requestId }
  );
});

// POST /api/v1/me/membership — buy or renew.
export const POST = withAuth({}, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { planId } = await parseBody(req, purchaseSchema);

  try {
    const result = await purchaseMembership({ userId: identity.userId, planId });

    return ok(
      {
        membership: result.membership,
        walletBalance: result.walletBalance,
        renewed: result.renewed,
        message: result.renewed ? "تم تجديد عضويتك" : "تم تفعيل عضويتك",
      },
      { status: result.renewed ? 200 : 201, requestId }
    );
  } catch (error) {
    if (error instanceof InsufficientBalance) {
      return fail(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        422,
        "رصيد المحفظة لا يكفي لشراء هذه الباقة",
        {
          requestId,
          // The numbers, so the screen can say how much is missing instead of
          // making the patient work it out.
          details: [
            { field: "balance", code: "insufficient", message: error.balance },
            { field: "required", code: "insufficient", message: error.required },
          ],
        }
      );
    }

    if (error instanceof MembershipError) {
      return fail(
        error.code === "PLAN_NOT_FOUND"
          ? ErrorCode.NOT_FOUND
          : ErrorCode.BUSINESS_RULE_VIOLATION,
        error.code === "PLAN_NOT_FOUND" ? 404 : 422,
        error.message,
        { requestId }
      );
    }

    throw error;
  }
});

/**
 * Re-exported for `scripts/generate-openapi.ts`.
 *
 * The published schema is derived from THIS object, so the contract handed to
 * the mobile team and the validation the server runs cannot drift apart.
 */
export { purchaseSchema as purchaseMembershipSchema };
