import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * The admin-controlled switches — "يكون معلق تفعيله من الادمن فقط".
 *
 * Read-and-update only: there is no POST. Keys are seeded because the code has
 * to branch on them, and a flag nobody reads is a switch that silently does
 * nothing — the admin toggles it, sees no effect, and cannot tell a bug from
 * the intent.
 */
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const data = await prisma.featureFlag.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
  return ok(data, { requestId });
});
