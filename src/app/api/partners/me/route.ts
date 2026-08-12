import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

/**
 * GET /api/partners/me — the caller's own provider record.
 *
 * Everything else about a partner is ADMIN-scoped, and rightly so: the name,
 * status, channels and services are contract terms. But a partner still has to
 * be able to SEE their own terms, and there was no route that let them — the
 * only way in was `/api/partners/[id]`, which a partner cannot call.
 *
 * Read-only by design. Changing any of this is an administrator's action, so
 * offering a write here would be offering a button that always returns 403.
 */
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // Resolved from the session, never from a parameter — this route exists
  // precisely so that no id has to be trusted.
  if (!identity.partnerId) {
    return fail(ErrorCode.NOT_FOUND, 404, "لا سجل مزوّد مرتبط بحسابك", { requestId });
  }

  const partner = await prisma.partner.findFirst({
    where: { id: identity.partnerId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      phone: true,
      email: true,
      address: true,
      rating: true,
      totalTasks: true,
      governorate: { select: { name: true } },
      complex: { select: { id: true, name: true } },
      ownedComplex: { select: { id: true, name: true } },
      channels: { select: { channel: true, status: true } },
      serviceConfigs: { select: { serviceType: true, status: true } },
      // The contract's end date matters to the partner — an expired contract is
      // why settlement stops — but its commission percentages are not exposed
      // here: those are negotiated, and this endpoint is a mirror, not a
      // disclosure surface.
      contract: { select: { startDate: true, endDate: true, isActive: true } },
    },
  });

  if (!partner) {
    return fail(ErrorCode.NOT_FOUND, 404, "سجل المزوّد غير موجود", { requestId });
  }

  return ok(partner, { requestId });
});
