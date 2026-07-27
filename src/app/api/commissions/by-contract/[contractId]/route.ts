import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ contractId: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { contractId } = await params;
  const data = await prisma.commissionRule.findMany({ where: { contractId } });
  return ok(data, { requestId });
});
