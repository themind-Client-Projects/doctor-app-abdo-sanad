import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// Complex revenue (req L138)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const partners = await prisma.partner.findMany({
    where: { complexId: id },
    select: { wallet: true },
  });
  return ok(
    partners.map((p) => p.wallet),
    { requestId }
  );
});
