import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { okList } from "@/lib/api-response";

// GET /api/users/staff — who an order can be handed to (req L321 "تحويل")
//
// `/api/users` is SUPER_ADMIN-only, and rightly so: it projects email and phone
// for every user, patients included. But the employee who actually transfers an
// order is OPERATIONS, so pointing the transfer dialog at that route would have
// left the dropdown permanently empty for the only role that uses it.
//
// So: a separate, narrower read. Same set the transfer endpoint is willing to
// accept — active OPERATIONS and SUPER_ADMIN — projected down to id, name and
// role. No contact details, because a colleague picker does not need them.
//
// Keeping the two in agreement matters: anything this route offers, that route
// accepts, so the dialog cannot present a choice the server will reject.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  // Small and bounded by headcount — one page, no cursor.
  return okList(staff, { nextCursor: null, hasMore: false, limit: staff.length }, { requestId });
});
