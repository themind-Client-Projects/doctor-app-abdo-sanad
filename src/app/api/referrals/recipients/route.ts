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
// ROLES.CLINICAL, not STAFF — the same boundary the writes use.
//
// STAFF includes DRIVER, so a driver who happens to be a complex member got
// the whole referrals screen: a populated complex, a recipients list, and four
// controls — «إحالة مريض», «الرد», «إعادة الإحالة», «سحب» — every one of which
// 403s, because POST and PATCH are CLINICAL. Reading a patient's clinical
// referral is not a courier's business either way, and /api/dashboard/patients
// already draws the line here.
export const GET = withAuth({ roles: ROLES.CLINICAL }, async (req, _ctx, identity) => {
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
