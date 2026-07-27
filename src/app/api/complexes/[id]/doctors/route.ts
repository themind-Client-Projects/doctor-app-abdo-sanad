import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const data = await prisma.partner.findMany({
    where: { complexId: id, type: "DOCTOR" },
    include: { user: { select: { name: true } } },
  });
  return ok(data, { requestId });
});
