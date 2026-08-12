import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { complexContextFor, eligibleRecipients } from "@/server/services/referral";

/**
 * GET /api/referrals/recipients — who I can refer to.
 *
 * The other members of the caller's own complex, resolved from the session.
 *
 * A separate route rather than widening `/api/complexes/[id]/members`: that one
 * is OPERATIONS-only and takes the complex id from the URL, so opening it to
 * partners would mean any partner could enumerate the membership of any complex.
 * Here the complex is never asked for — it is derived — so there is no id to
 * tamper with.
 *
 * Returns an empty list, not an error, for a partner in no complex: the referral
 * screen renders a "you are not in a complex" state rather than a failure.
 */
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const ctx = await complexContextFor(identity);
  if (!ctx) {
    return ok({ complex: null, recipients: [] }, { requestId });
  }

  const recipients = await eligibleRecipients(ctx);

  return ok(
    {
      complex: { id: ctx.complexId, name: ctx.complexName, isOwner: ctx.isOwner },
      recipients,
    },
    { requestId }
  );
});
