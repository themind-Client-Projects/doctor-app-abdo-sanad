import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// Complex stats (req L139)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const [partners, departments] = await Promise.all([
    prisma.partner.count({ where: { complexId: id } }),
    prisma.department.count({ where: { complexId: id } }),
  ]);
  return ok({ partners, departments }, { requestId });
});
